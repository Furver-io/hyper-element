/**
 * @file DOM-free grid layout engine for <hyper-layout>.
 *
 * The engine owns only coordinates and constraints. It deliberately knows
 * nothing about custom elements, overlays, pointer events, or persistence
 * callbacks so the same behavior can be verified through public browser
 * workflows and safely changed without rewriting child components.
 *
 * The custom element relies on this module for all placement decisions. The
 * engine relies only on normalized nodes from `positions.js`; it does not read
 * DOM measurements, CSS, or pointer events. This separation matches the
 * GridStack architecture we are reproducing independently: browser adapters
 * translate user actions into grid intents, then the engine resolves collisions
 * and returns deterministic node state.
 */

/**
 * Create a layout engine instance.
 * Domain context: applications can import the engine for advanced tooling such
 * as previewing a saved layout before mounting a `<hyper-layout>`.
 *
 * @param {Object} options - Engine options.
 * @returns {HyperLayoutEngine} New engine.
 */
export function createLayoutEngine(options = {}) {
  return new HyperLayoutEngine(options);
}

/**
 * GridStack-inspired placement engine with compact, push, swap, and resize.
 * Domain context: dashboard users expect widgets to avoid overlap, shift when
 * space is occupied, and preserve row order during reorder gestures.
 *
 * Technical context: nodes are mutable coordinate records. Mutating them in
 * place lets the host keep object identity stable while `save()` returns fresh
 * serializable copies for events and persistence.
 */
export class HyperLayoutEngine {
  /**
   * Initialize an empty engine with global grid constraints.
   * `columns` and `maxRow` come from the host element. `float` mirrors the
   * GridStack-style option that disables automatic upward compaction after a
   * move or resize.
   *
   * @param {Object} options - Initial column and row constraints.
   */
  constructor(options = {}) {
    this.columns = Number(options.columns || 12);
    this.maxRow = Number(options.maxRow || 0);
    this.float = !!options.float;
    this.nodes = [];
  }

  /**
   * Replace engine state with normalized nodes and resolve collisions.
   * Domain context: controlled parents can pass a saved `positions` object, and
   * the engine must make that state safe before rendering it.
   *
   * Technical context: each node is cloned before insertion so callers do not
   * see intermediate collision pushes. Loading uses `add(..., false)` to
   * resolve overlaps consistently, then performs one final compact pass.
   *
   * @param {Array} nodes - Canonical position items.
   * @returns {HyperLayoutEngine} This engine.
   */
  load(nodes = []) {
    this.nodes = [];
    nodes.forEach((node) => this.add({ ...node }, false));
    this.compact('compact');
    return this;
  }

  /**
   * Add a node, auto-placing it when needed.
   * Domain context: newly rendered items with no saved position should appear
   * in the first sensible empty slot instead of stacking on an existing widget.
   *
   * Technical context: constraints are applied before collision checks, then
   * collisions are pushed downward from the inserted node. Optional compaction
   * is skipped during bulk `load()` so callers avoid repeated repacking.
   *
   * @param {Object} node - Node to add.
   * @param {boolean} compact - Whether to compact after add.
   * @returns {Object} Added node.
   */
  add(node, compact = true) {
    const next = this.constrain({ ...node });
    if (!next.id) next.id = `node-${this.nodes.length}`;
    if (this.collides(next)) this.findEmpty(next);
    this.nodes.push(next);
    this.pushCollisions(next);
    if (compact) this.compact('compact');
    return next;
  }

  /**
   * Remove a node by ID and compact the remaining layout.
   * Domain context: trash/outside removal should close the gap left by a
   * removed widget unless the layout is configured to float.
   *
   * Technical context: returning `null` for missing IDs lets the DOM layer avoid
   * misleading `removed` events when stale pointer releases arrive.
   *
   * @param {string} id - Node ID.
   * @returns {Object|null} Removed node.
   */
  remove(id) {
    const index = this.nodes.findIndex((node) => node.id === id);
    if (index === -1) return null;
    const removed = this.nodes.splice(index, 1)[0];
    this.compact('compact');
    return removed;
  }

  /**
   * Move a node and resolve collisions.
   * Domain context: releases into empty space use this method after live
   * pointer dragging has ended.
   *
   * Technical context: same-size touching overlaps first attempt a direct swap;
   * all other overlaps push affected nodes down. Compaction is skipped only when
   * `float` is enabled.
   *
   * @param {string} id - Node ID.
   * @param {Object} next - Target x/y coordinates.
   * @returns {Object|null} Moved node.
   */
  move(id, next) {
    const node = this.get(id);
    if (!node || node.locked || node.noMove) return null;
    const before = { ...node };
    Object.assign(node, this.constrain({ ...node, x: next.x, y: next.y }));
    if (!this.swapIfPossible(node, before)) {
      this.pushCollisions(node);
    }
    if (!this.float) this.compact('compact');
    return node;
  }

  /**
   * Resize a node and resolve collisions.
   * Domain context: stretching a widget can consume space that other widgets
   * currently occupy, so those widgets must be pushed rather than overlapped.
   *
   * Technical context: min/max constraints are applied through `constrain()`
   * before collision resolution so downstream logic only handles valid nodes.
   *
   * @param {string} id - Node ID.
   * @param {Object} next - Target width/height.
   * @returns {Object|null} Resized node.
   */
  resize(id, next) {
    const node = this.get(id);
    if (!node || node.locked || node.noResize) return null;
    Object.assign(node, this.constrain({ ...node, w: next.w, h: next.h }));
    this.pushCollisions(node);
    if (!this.float) this.compact('compact');
    return node;
  }

  /**
   * Reinsert one node around a covered target and repack the layout.
   * Domain context: during drag, covering more than half of another item should
   * insert the active widget into the ordered flow, moving neighbors to the
   * nearest available slots instead of stacking or endlessly swapping.
   *
   * Technical context: sorted node order becomes the source list. The active
   * node is removed, inserted before or after the covered target depending on
   * original order, then every node is placed again using first-empty search.
   *
   * @param {string} id - Active node ID.
   * @param {string} targetId - Target node ID.
   * @returns {Object|null} Reordered active node.
   */
  reorderAround(id, targetId) {
    const active = this.get(id);
    const target = this.get(targetId);
    if (!active || !target || active.locked || target.locked) return null;
    const sorted = this.sorted();
    const activeIndex = sorted.findIndex((node) => node.id === id);
    const targetIndex = sorted.findIndex((node) => node.id === targetId);
    const ordered = sorted.filter((node) => node.id !== id);
    const index = ordered.findIndex((node) => node.id === targetId);
    if (index === -1 || activeIndex === -1 || targetIndex === -1) return null;
    ordered.splice(index + (activeIndex < targetIndex ? 1 : 0), 0, active);
    this.nodes = [];
    ordered.forEach((node) => this.placeOrdered(node));
    return active;
  }

  /**
   * Compact items upward while preserving occupied cells and locked nodes.
   * Domain context: users expect dashboards to close vertical gaps after
   * removal, load normalization, or resize unless `float` mode is active.
   *
   * Technical context: each unlocked node walks upward one row at a time until
   * the next row would collide. Locked nodes retain their explicit position and
   * act as blockers for other nodes.
   *
   * @param {'compact'|'list'} mode - Compaction strategy.
   * @returns {HyperLayoutEngine} This engine.
   */
  compact(mode = 'compact') {
    const sorted = this.sorted();
    sorted.forEach((node, index) => {
      if (node.locked) return;
      if (mode === 'list' && index)
        node.y = Math.max(node.y, sorted[index - 1].y);
      while (
        node.y > 0 &&
        !this.collides({ ...node, y: node.y - 1 }, node.id)
      ) {
        node.y -= 1;
      }
    });
    this.nodes = this.sorted();
    return this;
  }

  /**
   * Change the active column count and scale current nodes into it.
   * Domain context: responsive host widths should preserve the approximate
   * shape of the current layout instead of reloading from stale initial
   * positions and losing user edits.
   *
   * Technical context: x/w values are multiplied by the column ratio, then
   * constrained and compacted so every node stays inside the new grid.
   *
   * @param {number} columns - New column count.
   * @returns {HyperLayoutEngine} This engine.
   */
  setColumns(columns) {
    const nextColumns = Math.max(1, Number(columns || this.columns));
    const ratio = nextColumns / this.columns;
    this.columns = nextColumns;
    this.nodes.forEach((node) => {
      node.x = Math.round(node.x * ratio);
      node.w = Math.max(1, Math.round(node.w * ratio));
      Object.assign(node, this.constrain(node));
    });
    return this.compact('compact');
  }

  /**
   * Return a serializable snapshot sorted top-left to bottom-right.
   * Consumers rely on stable ordering for persistence diffs and deterministic
   * event payloads. Each node is cloned so callers cannot mutate engine state
   * through the saved result.
   *
   * @returns {Array} Node positions.
   */
  save() {
    return this.sorted().map((node) => ({ ...node, meta: node.meta || {} }));
  }

  /**
   * Find a node by ID.
   * IDs are opaque parent-owned keys. The engine treats them as exact lookup
   * tokens and never derives meaning from their format.
   *
   * @param {string} id - Node ID.
   * @returns {Object|null} Node or null.
   */
  get(id) {
    return this.nodes.find((node) => node.id === id) || null;
  }

  /**
   * Constrain a node to columns, min/max sizes, and max rows.
   * Domain context: item-level constraints such as `minW`, `maxH`, `locked`,
   * `noMove`, and `noResize` come from persisted positions and parent
   * capabilities. Geometry must respect those constraints before collision
   * resolution.
   *
   * Technical context: this method mutates and returns the provided object to
   * keep engine updates cheap. Callers clone first when they need isolation.
   *
   * @param {Object} node - Node to constrain.
   * @returns {Object} Constrained copy.
   */
  constrain(node) {
    const minW = node.minW || 1;
    const minH = node.minH || 1;
    const maxW = Math.min(node.maxW || this.columns, this.columns);
    const maxH = node.maxH || this.maxRow || Number.MAX_SAFE_INTEGER;
    node.w = Math.max(minW, Math.min(maxW, Number(node.w || 1)));
    node.h = Math.max(minH, Math.min(maxH, Number(node.h || 1)));
    node.x = Math.max(0, Math.min(this.columns - node.w, Number(node.x || 0)));
    node.y = Math.max(0, Number(node.y || 0));
    if (this.maxRow)
      node.y = Math.min(node.y, Math.max(0, this.maxRow - node.h));
    return node;
  }

  /**
   * Push every collision below the active node.
   * Domain context: unlike absolute positioning, dashboard editing must never
   * leave widgets visually stacked after a move or resize.
   *
   * Technical context: the active collision chain moves downward one hit at a
   * time. The guard bounds pathological inputs so a malformed layout cannot
   * spin forever; later compaction or save still exposes the resolved state.
   *
   * @param {Object} active - Node occupying the target space.
   */
  pushCollisions(active) {
    let guard = 0;
    while (guard++ < this.nodes.length * 4) {
      const hit = this.nodes.find(
        (node) => node.id !== active.id && intersects(node, active)
      );
      if (!hit) return;
      if (hit.locked) {
        active.y = hit.y + hit.h;
        continue;
      }
      hit.y = active.y + active.h;
      this.constrain(hit);
      active = hit;
    }
  }

  /**
   * Place one ordered node into the first available grid slot.
   * Domain context: reorder gestures convert a visual insertion intent into a
   * packed row-major dashboard ordering.
   *
   * Technical context: unlocked nodes are reset to origin before scanning so
   * their prior position does not bias placement. Locked nodes keep their
   * constrained coordinate and reserve that space for later nodes.
   *
   * @param {Object} node - Node to place.
   */
  placeOrdered(node) {
    this.constrain(node);
    if (!node.locked) {
      node.x = 0;
      node.y = 0;
      this.findEmpty(node);
    }
    this.nodes.push(node);
  }

  /**
   * Swap same-sized touching nodes to preserve GridStack-like direct swaps.
   * Domain context: dragging a widget directly over an equal-sized neighbor is
   * a familiar dashboard interaction and should feel like a swap once the user
   * commits enough overlap.
   *
   * Technical context: this method is separate from live reorder insertion.
   * It handles release-based moves into grid coordinates and requires more than
   * 50% overlap to avoid vibration around shared edges.
   *
   * @param {Object} node - Active node.
   * @param {Object} before - Position before movement.
   * @returns {boolean} True when swapped.
   */
  swapIfPossible(node, before) {
    const hit = this.nodes.find(
      (other) => other.id !== node.id && intersects(other, node)
    );
    if (!hit || hit.locked || hit.w !== node.w || hit.h !== node.h)
      return false;
    if (!touches(before, hit)) return false;
    // GridStack uses drag coverage before committing collision swaps. Hyper
    // Layout applies the same idea at grid-coordinate level: a same-size item
    // must cover more than half of the candidate before the swap is real.
    // Otherwise tiny pointer jitter around the shared edge can alternately
    // satisfy opposite swaps on consecutive pointermove events. Sub-threshold
    // overlaps still flow through push collision handling, so ordinary drags
    // keep moving instead of freezing at the previous cell.
    if (overlapRatio(node, hit) <= 0.5) return false;
    // A same-size swap must exchange both grid origins. Pointer movement can
    // request a partial overlap such as x=5 over a widget at x=4; leaving the
    // active node at that raw pointer-derived coordinate would still stack the
    // two widgets after the displaced node moves back to `before`.
    const target = { x: hit.x, y: hit.y };
    node.x = target.x;
    node.y = target.y;
    hit.x = before.x;
    hit.y = before.y;
    return true;
  }

  /**
   * Find the first empty position for a node.
   * The scan is row-major because dashboard reading order is top-left to
   * bottom-right. The high y bound is a defensive cap for invalid inputs rather
   * than a product-level max; real max-row enforcement happens in `constrain()`.
   *
   * @param {Object} node - Node to place.
   */
  findEmpty(node) {
    for (let y = 0; y < 10000; y += 1) {
      for (let x = 0; x <= this.columns - node.w; x += 1) {
        if (!this.collides({ ...node, x, y }, node.id)) {
          node.x = x;
          node.y = y;
          return;
        }
      }
    }
  }

  /**
   * Check whether an area collides with current nodes.
   * This primitive is used by add, compact, empty-slot search, and validation
   * scenarios, so it deliberately accepts an arbitrary candidate area instead
   * of only existing engine nodes.
   *
   * @param {Object} area - Candidate grid area.
   * @param {string} skipId - Node ID to ignore.
   * @returns {boolean} True when occupied.
   */
  collides(area, skipId = '') {
    return this.nodes.some(
      (node) => node.id !== skipId && intersects(node, area)
    );
  }

  /**
   * Return sorted nodes from top-left to bottom-right.
   * This ordering is the persistence and visual flow order. It is intentionally
   * recalculated from coordinates so it remains correct after every mutation.
   *
   * @returns {Array} Sorted nodes.
   */
  sorted() {
    return [...this.nodes].sort((a, b) => a.y - b.y || a.x - b.x);
  }
}

/**
 * Check rectangular grid overlap.
 * Technical context: this is an axis-aligned rectangle intersection check in
 * grid units. Touching edges are not collisions because adjacent widgets are
 * allowed to share borders.
 *
 * @param {Object} a - First area.
 * @param {Object} b - Second area.
 * @returns {boolean} True when overlapping.
 */
function intersects(a, b) {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
}

/**
 * Calculate how much of the smaller rectangle is covered by the overlap.
 * Domain context: same-size swaps and drag insertion thresholds should be based
 * on intent, not any contact at all. A ratio lets callers require meaningful
 * coverage before changing layout order.
 *
 * @param {Object} a - First area.
 * @param {Object} b - Second area.
 * @returns {number} Overlap ratio from zero to one.
 */
function overlapRatio(a, b) {
  const width = Math.max(
    0,
    Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  );
  const height = Math.max(
    0,
    Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  );
  return (width * height) / Math.min(a.w * a.h, b.w * b.h);
}

/**
 * Check whether two areas touch on an edge or overlap.
 * This is intentionally looser than `intersects()` because swap eligibility
 * should include neighboring items that begin as direct edge contacts before a
 * pointer movement crosses into overlap.
 *
 * @param {Object} a - First area.
 * @param {Object} b - Second area.
 * @returns {boolean} True when directly adjacent or overlapping.
 */
function touches(a, b) {
  return !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  );
}
