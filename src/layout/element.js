/**
 * @file <hyper-layout> custom element.
 *
 * The element wraps direct children in editor-owned shells, maps those
 * shells to parent-provided opaque item IDs, and delegates all coordinate
 * decisions to the DOM-free engine. Child custom elements remain oblivious:
 * their rendered internals are never inspected or used as identity.
 *
 * The element depends on the smaller layout modules for event dispatch,
 * position reconciliation, geometry conversion, pointer interactions, and
 * runtime CSS. Those modules depend on the host for public configuration and
 * lifecycle timing. Keeping the class as a coordinator makes the public API
 * easy to audit: methods here are the surface developers call, while helpers
 * own the algorithms behind those methods.
 */

import { HyperLayoutEngine } from './engine.js';
import {
  commitLayoutChange,
  currentLayoutPositions,
  defineLayoutOnChange,
  defineLayoutOnRemoved,
  emitLayoutEvent,
} from './events.js';
import { measureGrid, nodeToPixels, resolveColumns } from './geometry.js';
import { createLayoutInteractions, isOutsideHost } from './interactions.js';
import { isCoveringTrash, isOverTrash } from './removal.js';
import { ensureLayoutStyles } from './styles.js';
import { serializePositions } from './positions.js';
import { defineLayoutProperties } from './properties.js';
import { reconcileLayout } from './state.js';

// prettier-ignore
const OBSERVED_ATTRIBUTES = ['edit', 'items', 'positions', 'breakpoints', 'columns', 'max-row', 'float', 'compact', 'removable', 'trash', 'column-width', 'cell-height', 'margin', 'overlay'];

/**
 * Custom element implementing Hyper Layout.
 * Domain context: `<hyper-layout>` is an application-level dashboard wrapper.
 * It lets a parent component toggle edit mode for existing child widgets
 * without requiring those widgets to know where they live.
 *
 * Technical context: the class stores controlled inputs, internal fallback
 * positions, observers, and one engine instance. All layout mutations enter
 * through `reconcile()`, pointer interactions, or public methods so event
 * emission and persistence stay consistent.
 */
export class hyperLayoutElement extends HTMLElement {
  /**
   * Attributes that mirror simple public properties.
   * These names are observed because plain HTML users can configure a layout
   * with attributes, while Hyper Element render functions normally assign rich
   * properties directly.
   */
  static get observedAttributes() {
    return OBSERVED_ATTRIBUTES;
  }

  /**
   * Initialize state slots before connection.
   * The constructor installs property descriptors per instance because
   * callbacks such as `serialize`, `deserialize`, and `onchange` may arrive as
   * Hyper Element shared attributes before the element connects.
   */
  constructor() {
    super();
    this.engine = new HyperLayoutEngine();
    this._items = null;
    this._positions = null;
    this._breakpoints = null;
    this._onchange = null;
    this._onremoved = null;
    this._overlay = undefined;
    this._layoutPositions = null;
    this._observer = null;
    this._resizeObserver = null;
    this._interactions = null;
    this._layoutReconcileTicket = 0;
    defineLayoutProperties(this);
    defineLayoutOnChange(this);
    defineLayoutOnRemoved(this);
  }

  /**
   * Connect the element, wrap children, and start mutation observation.
   * Domain context: a parent can add or remove dashboard widgets by re-rendering
   * direct children. The mutation observer turns those DOM changes into
   * identity reconciliation instead of requiring a separate imperative refresh.
   *
   * Technical context: resize observation is host-width based because
   * responsive columns are resolved from the layout's own width, not the global
   * viewport. Pointer interactions are installed once and delegate through host
   * methods so custom overlays can share the same behavior.
   */
  connectedCallback() {
    ensureLayoutStyles();
    this._placeholder = ensureLayoutPlaceholder(this);
    this._interactions = createLayoutInteractions(this);
    this.reconcile('connect');
    this._observer = new MutationObserver(() =>
      this.reconcile('items-reconciled')
    );
    this._observer.observe(this, { childList: true, subtree: false });
    this._resizeObserver = new ResizeObserver(() => {
      if (this.resolveColumnCount() !== this.engine.columns)
        this.reconcile('attribute');
    });
    this._resizeObserver.observe(this);
  }

  /**
   * Disconnect browser resources owned by the layout host.
   * This prevents detached dashboard pages from retaining mutation, resize, or
   * pointer callbacks that would otherwise hold child elements in memory.
   */
  disconnectedCallback() {
    this._observer?.disconnect();
    this._resizeObserver?.disconnect();
    this._interactions?.destroy();
  }

  /**
   * Reconcile when simple attributes change.
   * Rich property setters call `reconcile()` themselves. This callback covers
   * attribute-driven configuration such as `<hyper-layout edit columns="6">`.
   *
   * The `edit` attribute is intentionally special. Product-wise, edit mode is
   * only an interaction state: users turn it on, move widgets, then turn it off
   * so the dashboard can be used at the new positions. Technically, the current
   * engine state is already authoritative after a drag or resize, and a full
   * reconcile would reload the original controlled `positions` input when the
   * parent has not re-rendered yet. Applying layout is enough because it
   * refreshes `data-edit`, overlay visibility, focus behavior, and host height
   * without touching node coordinates.
   *
   * @param {string} name - Changed attribute name.
   */
  attributeChangedCallback(name) {
    if (!this.isConnected) return;
    if (name === 'edit') {
      this.applyLayout();
      return;
    }
    this.reconcile('attribute');
  }

  /**
   * Return the current positions, serialized when requested by consumers.
   * Domain context: controlled parents persist this value and feed it back as
   * `positions` on the next render or reload.
   *
   * Technical context: uncontrolled layouts can still be saved for demos, but
   * their generated IDs are marked ephemeral because they are derived from
   * current child order and are not a reload-stable persistence contract.
   *
   * @returns {unknown} Serialized or canonical positions.
   */
  save() {
    const positions = this.currentPositions();
    if (positions.ephemeral)
      console.warn(
        'hyper-layout: save() output uses ephemeral IDs and is not reload-stable'
      );
    return serializePositions(positions, this.serialize || null);
  }

  /**
   * Load positions through the public method.
   * Domain context: applications can restore a saved dashboard without
   * rebuilding the element.
   *
   * Technical context: `load()` stores the raw controlled input, runs the
   * optional deserializer, then uses the same reconciliation path as property
   * updates so wrappers, engine state, and events remain aligned.
   *
   * @param {unknown} positions - Positions input.
   * @returns {void}
   */
  load(positions) {
    this._positions = this.deserialize
      ? this.deserialize(positions)
      : positions;
    this.reconcile('load');
  }

  /**
   * Compact and emit a logical change.
   * Domain context: compacting is an explicit user or application action that
   * changes persisted layout state, so it emits `change`.
   *
   * Technical context: compaction is delegated to the engine and then rendered
   * through `applyLayout()`; no DOM geometry is used to make the decision.
   *
   * @param {'compact'|'list'} mode - Compaction mode.
   */
  compact(mode = 'compact') {
    this.engine.compact(mode);
    this.applyLayout();
    this.commitChange('compact');
  }

  /**
   * Enable edit mode.
   */
  enable() {
    this.edit = true;
  }

  /**
   * Disable edit mode.
   */
  disable() {
    this.edit = false;
  }

  /**
   * Reconcile item identity, wrappers, and engine state.
   * @param {string} reason - Reason for reconciliation.
   */
  reconcile(reason = 'items-reconciled') {
    this._layoutReconcileTicket = 0;
    reconcileLayout(this, reason);
  }

  /**
   * Apply engine node positions to wrappers.
   * Domain context: child widgets should appear at the coordinates chosen by
   * the engine while retaining their own internal UI.
   *
   * Technical context: this is the only method that writes wrapper pixel
   * placement. It converts grid coordinates with current host measurements,
   * updates lock metadata for CSS, and stretches the host height to cover the
   * deepest occupied row.
   */
  applyLayout() {
    const grid = this.measure();
    let rows = 1;
    this.engine.save().forEach((node) => {
      const wrapper = this.querySelector(
        `[data-hl-item][data-layout-id="${CSS.escape(node.id)}"]`
      );
      if (!wrapper) return;
      const px = nodeToPixels(node, grid);
      Object.assign(wrapper.style, {
        left: `${px.left}px`,
        top: `${px.top}px`,
        width: `${px.width}px`,
        height: `${px.height}px`,
      });
      wrapper.dataset.hlLocked = String(!!node.locked);
      rows = Math.max(rows, node.y + node.h);
    });
    this.style.height = `${rows * grid.cellHeight + grid.margin * 2}px`;
    this.dataset.edit = String(this.edit);
  }

  /**
   * Measure active grid dimensions.
   * The geometry module owns the math, while the host supplies the current
   * configured columns, cell-height, and margin attributes.
   *
   * @returns {Object} Grid measurement.
   */
  measure() {
    return measureGrid(
      this,
      this.engine.columns,
      this.getAttribute('cell-height') || 'auto',
      this.getAttribute('margin') || 10
    );
  }

  /**
   * Remove an item when current removable settings request it.
   * Domain context: removal is opt-in because most dashboards should not delete
   * widgets just because a drag leaves the layout. The `removable` mode decides
   * whether trash, outside, or both release targets are accepted.
   *
   * Technical context: the engine removal is the source of truth. The wrapper
   * is removed only after the engine confirms the ID existed, preventing false
   * `removed` events for stale or missing IDs.
   *
   * @param {string} id - Node ID.
   * @param {PointerEvent} event - Release event.
   * @returns {Object|null} Removed node.
   */
  removeIfRequested(id, event) {
    const mode = this.getAttribute('removable') || '';
    const wrapper = this.querySelector(
      `[data-hl-item][data-layout-id="${CSS.escape(id)}"]`
    );
    const acceptsTrash = mode === 'trash' || mode === 'both';
    const selector = this.getAttribute('trash');
    const activeTrashPreview = wrapper?.dataset.hlRemoving === 'true';
    const overTrash =
      acceptsTrash &&
      (activeTrashPreview ||
        isOverTrash(selector, event.clientX, event.clientY) ||
        isCoveringTrash(selector, wrapper));
    const outside =
      (mode === 'outside' || mode === 'both') &&
      isOutsideHost(this, event.clientX, event.clientY);
    if (!overTrash && !outside) return null;
    const removed = this.engine.remove(id);
    if (!removed) return null;
    wrapper?.remove();
    this._layoutPositions = this.currentPositions();
    this.emit('removed', {
      removed: [id],
      nodes: [removed],
      positions: this._layoutPositions,
    });
    return removed;
  }

  /**
   * Emit a GridStack-like event.
   * The event helper owns the `onchange(event, positions)` adapter, so the host
   * method stays a thin public convenience wrapper.
   *
   * @param {string} name - Event name.
   * @param {Object} detail - Event detail.
   * @returns {CustomEvent} Dispatched event.
   */
  emit(name, detail = {}) {
    return emitLayoutEvent(this, name, detail);
  }

  /**
   * Emit a canonical change event with current positions.
   * This is used after every user-visible layout mutation so controlled parents
   * can persist the exact state the engine now owns.
   *
   * @param {string} reason - Change reason.
   * @param {Object} extra - Extra event detail.
   */
  commitChange(reason, extra = {}) {
    commitLayoutChange(this, reason, extra);
  }

  /**
   * Return canonical positions for current engine state.
   * Consumers, event dispatch, and uncontrolled persistence all rely on this
   * method for one consistent snapshot shape.
   *
   * @returns {Object} Current positions.
   */
  currentPositions() {
    return currentLayoutPositions(this);
  }

  /**
   * Resolve active columns from explicit attributes or responsive options.
   * @returns {number} Active column count.
   */
  resolveColumnCount() {
    return resolveColumns(this, {
      columns: Number(this.getAttribute('columns') || 0),
      breakpoints: this.breakpoints,
      columnWidth: Number(this.getAttribute('column-width') || 0),
    });
  }
}

if (!customElements.get('hyper-layout')) {
  customElements.define('hyper-layout', hyperLayoutElement);
}

/**
 * Ensure the host owns one internal placeholder element.
 * Domain context: active drags need an empty snap preview that is visually
 * separate from the floating widget. The placeholder must be owned by Hyper
 * Layout, not by child components, because it represents engine state.
 *
 * Technical context: the placeholder is inserted before mutation observation
 * starts and `layoutChildren()` ignores it. That keeps the internal element
 * from changing the parent-owned `items[index] -> child[index]` contract.
 *
 * @param {HTMLElement} host - Hyper Layout host.
 * @returns {HTMLElement} Internal placeholder element.
 */
function ensureLayoutPlaceholder(host) {
  const existing = Array.from(host.children).find(
    (child) => child.dataset.hlPlaceholder !== undefined
  );
  const placeholder = existing || document.createElement('div');
  placeholder.dataset.hlPlaceholder = 'true';
  placeholder.setAttribute('aria-hidden', 'true');
  if (!existing) host.appendChild(placeholder);
  return placeholder;
}
