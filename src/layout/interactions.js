/**
 * @file Pointer interactions for <hyper-layout>.
 *
 * This adapter is the only module that listens to browser pointer events.
 * It translates user intent into engine move/resize calls and lets the
 * custom element own rendering, event dispatch, and persistence.
 *
 * The DOM wrapper module relies on this adapter honoring wrapper data
 * attributes for capability checks. The engine relies on this adapter to send
 * grid intents, not pixel styles. The host relies on this adapter to emit the
 * start/stop/change lifecycle after engine mutations.
 */

import { deltaToMove, deltaToSize, isOutsideHost } from './geometry.js';
import { clearRemovalPreview, updateRemovalPreview } from './removal.js';
import { hideDragPlaceholder, updateDragPlaceholder } from './placeholder.js';

/**
 * Create a pointer interaction controller.
 * Domain context: edit mode should capture interaction on the layout overlay
 * while leaving child widgets untouched in static mode.
 *
 * Technical context: one delegated pointerdown listener is installed on the
 * host. Sessions then listen on `document` so dragging continues even when the
 * pointer leaves the active wrapper.
 *
 * @param {Object} host - Hyper layout element instance.
 * @returns {{destroy: Function}} Controller teardown.
 */
export function createLayoutInteractions(host) {
  /**
   * Start drag or resize from the edit overlay controls.
   * This is the generic path used by the default overlay and custom overlays
   * that rely on region inference instead of explicit callbacks.
   *
   * @param {PointerEvent} event - Pointer start event.
   */
  function onPointerDown(event) {
    const wrapper = event.target.closest('[data-hl-item]');
    const action = actionFromPointer(event, wrapper);
    if (action) beginAction(action, wrapper, event);
  }

  host._startLayoutAction = (action, id, event) => {
    const wrapper = host.querySelector(
      `[data-hl-item][data-layout-id="${CSS.escape(id)}"]`
    );
    beginAction(action, wrapper, event);
  };

  /**
   * Validate an action request and start a pointer session.
   * Domain context: locked, no-move, and no-resize constraints must be enforced
   * before a visual drag begins, not only after drop.
   *
   * Technical context: `wrapper.dataset.layoutId` is the bridge from DOM shell
   * back to the engine node. If the wrapper or node is stale, the request is
   * ignored rather than throwing during a pointer event.
   *
   * @param {'drag'|'resize'} action - Requested action.
   * @param {HTMLElement|null} wrapper - Item wrapper.
   * @param {PointerEvent} event - Pointer start event.
   */
  function beginAction(action, wrapper, event) {
    const node = wrapper && host.engine.get(wrapper.dataset.layoutId);
    if (!host.edit || !node || isBlocked(action, node)) return;
    event.preventDefault();
    startSession(event, action, wrapper, node);
  }

  /**
   * Track one pointer session until release.
   * Domain context: dragging should detach the active item under the pointer,
   * reorder neighbors once more than half a target is covered, and commit the
   * final state on release.
   *
   * Technical context: drag sessions keep the active wrapper floating with
   * pixel styles while the engine reorders the non-floating model. Resize
   * sessions update engine dimensions directly on each move. Both paths share
   * final event emission in `onUp()`.
   *
   * @param {PointerEvent} event - Pointer start event.
   * @param {'drag'|'resize'} action - Active action.
   * @param {HTMLElement} wrapper - Item wrapper.
   * @param {Object} node - Engine node.
   */
  function startSession(event, action, wrapper, node) {
    const start = { ...node };
    const grid = host.measure();
    const name = action === 'drag' ? 'drag' : 'resize';
    const startPixels = {
      left: Number.parseFloat(wrapper.style.left || '0'),
      top: Number.parseFloat(wrapper.style.top || '0'),
    };
    let lastTarget = '';
    wrapper.dataset.hlActive = 'true';
    if (action === 'drag') {
      wrapper.dataset.hlFloating = 'true';
      wrapper.dataset.hlDragging = 'true';
      clearRemovalPreview(wrapper);
      updateDragPlaceholder(host, start, grid);
    }
    host.emit(`${name}start`, { node: { ...node } });

    /**
     * Apply live pointer movement through the engine.
     * For drag, the floating wrapper is moved first so coverage detection uses
     * the user's current pointer intent. For resize, the engine can update
     * immediately because the active wrapper remains in the normal layout flow.
     *
     * @param {PointerEvent} moveEvent - Pointer move event.
     */
    function onMove(moveEvent) {
      const dx = moveEvent.clientX - event.clientX;
      const dy = moveEvent.clientY - event.clientY;
      if (action === 'drag') {
        floatWrapper(wrapper, startPixels, dx, dy);
        updateRemovalPreview(host, wrapper, moveEvent);
        const target = coveredTarget(host, wrapper);
        const targetKey = dragTargetKey(host, target);
        if (target && targetKey !== lastTarget) {
          host.engine.reorderAround(node.id, target);
          host.applyLayout();
          floatWrapper(wrapper, startPixels, dx, dy);
          // Remember the covered slot that already reacted to this pointer.
          // If the same item is pushed to a new grid coordinate, its key
          // changes and the user can move it again during the same drag.
          lastTarget = targetKey;
        }
        // Once the floating item is no longer covering a target, the same
        // target must be eligible again. This lets A move B, then move B
        // again at B's new location during the same continuous drag session.
        if (!target) lastTarget = '';
        updateDragPlaceholder(
          host,
          target || lastTarget
            ? host.engine.get(node.id)
            : previewDragNode(host, start, dx, dy, grid),
          grid
        );
      } else {
        host.engine.resize(node.id, deltaToSize(start, dx, dy, grid));
        host.applyLayout();
      }
    }

    /**
     * Commit the session, including optional removal.
     * Domain context: a release can either remove an item, commit an empty-space
     * move, or simply snap to the live reordered engine state.
     *
     * Technical context: the fallback `engine.move()` only runs when no reorder
     * target was activated. When reorder happened, engine state is already the
     * desired model and `applyLayout()` snaps the floating wrapper back into it.
     *
     * @param {PointerEvent} upEvent - Pointer release event.
     */
    function onUp(upEvent) {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      delete wrapper.dataset.hlActive;
      delete wrapper.dataset.hlFloating;
      delete wrapper.dataset.hlDragging;
      if (action === 'drag') hideDragPlaceholder(host);
      const removed =
        action === 'drag' ? host.removeIfRequested(node.id, upEvent) : null;
      clearRemovalPreview(wrapper);
      if (action === 'drag' && !removed && !lastTarget) {
        host.engine.move(
          node.id,
          deltaToMove(
            start,
            upEvent.clientX - event.clientX,
            upEvent.clientY - event.clientY,
            grid
          )
        );
      }
      if (!removed) host.applyLayout();
      host.emit(`${name}stop`, {
        node: host.engine.get(node.id) || { ...node },
      });
      const removal =
        removed && host._lastRemoval?.id === node.id ? host._lastRemoval : null;
      host.commitChange(
        removed ? 'remove' : `user-${action}`,
        removed
          ? { removed: [node.id], positions: removal?.positions }
          : { nodes: [node] }
      );
      if (removal) host._lastRemoval = null;
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  host.addEventListener('pointerdown', onPointerDown);
  return {
    /**
     * Remove all listeners owned by this interaction adapter.
     */
    destroy() {
      host.removeEventListener('pointerdown', onPointerDown);
      delete host._startLayoutAction;
    },
  };
}

/**
 * Create a drag cooldown key from the target's current grid slot.
 * Domain context: a drag should not vibrate by repeatedly reordering the same
 * item while the pointer is still covering the same slot. It must, however,
 * allow the same item to react again after the engine moves that item to a new
 * coordinate during the same continuous drag gesture.
 *
 * @param {Object} host - Hyper layout element instance.
 * @param {string} id - Covered target ID.
 * @returns {string} Target coordinate key or empty string.
 */
function dragTargetKey(host, id) {
  const node = id && host.engine.get(id);
  return node ? `${id}:${node.x}:${node.y}` : '';
}

/**
 * Infer the intended action from public item capabilities and pointer region.
 * Domain context: custom overlays should not need Hyper Layout marker
 * attributes for the common case. When both actions are allowed, the
 * lower-right region behaves as resize and the rest behaves as drag.
 *
 * @param {PointerEvent} event - Pointer start event.
 * @param {HTMLElement|null} wrapper - Item wrapper.
 * @returns {'drag'|'resize'|''} Resolved action.
 */
function actionFromPointer(event, wrapper) {
  const overlay = event.target.closest('[data-hl-overlay]');
  if (!wrapper || !overlay) return '';
  if (event.target.closest('[data-hl-drag]')) return 'drag';
  if (event.target.closest('[data-hl-resize]')) return 'resize';
  const canDrag = wrapper.dataset.hlCanDrag === 'true';
  const canResize = wrapper.dataset.hlCanResize === 'true';
  if (canDrag && !canResize) return 'drag';
  if (!canDrag && canResize) return 'resize';
  if (canDrag && canResize)
    return isResizeCorner(overlay, event) ? 'resize' : 'drag';
  return '';
}

/**
 * Check whether the action is blocked by engine constraints.
 * This mirrors engine enforcement so the UI does not visually start an action
 * that the engine will later reject.
 *
 * @param {'drag'|'resize'} action - Requested action.
 * @param {Object} node - Engine node.
 * @returns {boolean} True when action cannot start.
 */
function isBlocked(action, node) {
  return (
    node.locked ||
    (action === 'drag' && node.noMove) ||
    (action === 'resize' && node.noResize)
  );
}

/**
 * Treat the lower-right overlay region as the inferred resize handle.
 * Domain context: simple custom overlays should not need internal Hyper Layout
 * marker attributes. A familiar corner region is enough to choose resize when
 * both drag and resize are allowed.
 *
 * @param {HTMLElement} overlay - Overlay shell.
 * @param {PointerEvent} event - Pointer start event.
 * @returns {boolean} True when pointer starts inside the resize region.
 */
function isResizeCorner(overlay, event) {
  const rect = overlay.getBoundingClientRect();
  const hot = Math.max(28, Math.min(rect.width, rect.height) * 0.25);
  return (
    event.clientX >= rect.right - hot && event.clientY >= rect.bottom - hot
  );
}

/**
 * Keep the actively dragged wrapper under the pointer without relayout.
 * This writes only the active wrapper's pixel position. The engine still owns
 * logical grid positions for all persistence and final rendering.
 *
 * @param {HTMLElement} wrapper - Floating wrapper.
 * @param {Object} start - Starting pixel position.
 * @param {number} dx - Horizontal pointer delta.
 * @param {number} dy - Vertical pointer delta.
 */
function floatWrapper(wrapper, start, dx, dy) {
  wrapper.style.left = `${start.left + dx}px`;
  wrapper.style.top = `${start.top + dy}px`;
}

/**
 * Preview the grid node that an empty-space drag release would request.
 * Domain context: the placeholder should tell the user where the dragged item
 * will snap if they let go, even before the engine commits an empty-space move.
 *
 * Technical context: this creates a constrained copy instead of mutating the
 * engine. Reorder previews use the engine's live node because the model has
 * already been updated by `reorderAround()`.
 *
 * @param {Object} host - Hyper layout host.
 * @param {Object} start - Original node at pointerdown.
 * @param {number} dx - Horizontal pointer delta.
 * @param {number} dy - Vertical pointer delta.
 * @param {Object} grid - Measured grid values.
 * @returns {Object} Constrained preview node.
 */
function previewDragNode(host, start, dx, dy, grid) {
  return host.engine.constrain({
    ...start,
    ...deltaToMove(start, dx, dy, grid),
  });
}

/**
 * Find the item currently covered by more than half of the dragged wrapper.
 * Domain context: the 50% rule prevents jitter when a dragged item brushes an
 * edge and gives users a clear insertion threshold.
 *
 * Technical context: coverage uses wrapper style geometry instead of animated
 * DOM rectangles so CSS transitions cannot make hit testing lag behind the
 * pointer.
 *
 * @param {HTMLElement} host - Layout host.
 * @param {HTMLElement} active - Active wrapper.
 * @returns {string} Covered target ID or empty string.
 */
function coveredTarget(host, active) {
  const activeRect = layoutRect(host, active);
  let best = { id: '', ratio: 0 };
  host.querySelectorAll('[data-hl-item]').forEach((wrapper) => {
    if (wrapper === active) return;
    const ratio = rectCoverage(activeRect, layoutRect(host, wrapper));
    if (ratio > best.ratio) best = { id: wrapper.dataset.layoutId, ratio };
  });
  return best.ratio > 0.5 ? best.id : '';
}

/**
 * Read wrapper geometry from Hyper Layout's immediate positioning styles.
 * Domain context: during drag, the active item must react to the position the
 * user just requested, not to a browser animation frame that may still be
 * visually transitioning from the previous slot.
 *
 * @param {HTMLElement} host - Layout host.
 * @param {HTMLElement} wrapper - Item wrapper.
 * @returns {Object} Viewport-relative rectangle-like geometry.
 */
function layoutRect(host, wrapper) {
  const hostRect = host.getBoundingClientRect();
  const fallback = wrapper.getBoundingClientRect();
  const left = Number.parseFloat(wrapper.style.left);
  const top = Number.parseFloat(wrapper.style.top);
  const width = Number.parseFloat(wrapper.style.width);
  const height = Number.parseFloat(wrapper.style.height);
  const x = Number.isFinite(left) ? hostRect.left + left : fallback.left;
  const y = Number.isFinite(top) ? hostRect.top + top : fallback.top;
  const w = Number.isFinite(width) ? width : fallback.width;
  const h = Number.isFinite(height) ? height : fallback.height;
  return { left: x, top: y, right: x + w, bottom: y + h, width: w, height: h };
}

/**
 * Calculate overlap as the share of the smaller rectangle.
 * The smaller-rectangle denominator makes the threshold work for differently
 * sized widgets: covering half of the smaller item is enough to express intent.
 *
 * @param {DOMRect} a - First rectangle.
 * @param {DOMRect} b - Second rectangle.
 * @returns {number} Coverage ratio.
 */
function rectCoverage(a, b) {
  const width = Math.max(
    0,
    Math.min(a.right, b.right) - Math.max(a.left, b.left)
  );
  const height = Math.max(
    0,
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  );
  return (width * height) / Math.min(a.width * a.height, b.width * b.height);
}

export { isOutsideHost };
