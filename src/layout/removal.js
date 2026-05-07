/**
 * @file Trash-target detection and active removal previews for <hyper-layout>.
 *
 * Hyper Layout supports application-owned trash zones rather than owning a
 * permanent internal delete button. This module keeps that removal targeting
 * logic separate from pointer dragging so the same decision can be reused by
 * visual previews and final drop commits.
 *
 * The interaction adapter relies on this module while a drag is active. The
 * host element relies on the same helpers when deciding whether
 * `removeIfRequested()` should remove an item on pointer release. CSS relies
 * on `data-hl-removing` being present only during an active removable drag so
 * static hover styling never looks destructive.
 */

const REMOVAL_PREVIEW_SCALE = 0.8;

/**
 * Determine whether a drag release point is inside a matching trash selector.
 * Domain context: trash removal is opt-in and delegated to an application
 * element chosen by selector, so the layout can sit inside any dashboard
 * toolbar or page chrome.
 *
 * Technical context: rectangle containment is used instead of
 * `elementFromPoint()` because the floating dragged wrapper can visually cover
 * the trash zone at release time. The selector can match any element in the
 * document, allowing application-owned trash targets outside the layout host.
 *
 * @param {string} selector - Trash selector.
 * @param {number} x - Client x.
 * @param {number} y - Client y.
 * @returns {boolean} True when the pointer is inside a trash target.
 */
export function isOverTrash(selector, x, y) {
  if (!selector) return false;
  return trashTargets(selector).some((target) => pointInRect(target, x, y));
}

/**
 * Determine whether the floating wrapper currently overlaps a trash target.
 * Domain context: users often read the dragged card itself as the thing being
 * dropped, not just the pointer. A card that visibly covers the trash should
 * therefore receive the same destructive preview as a pointer inside trash.
 *
 * Technical context: wrapper geometry is read from the layout-owned pixel
 * styles rather than `getBoundingClientRect()` when possible. CSS transform
 * scaling changes the rendered rectangle, and using that transformed rectangle
 * for hit testing creates edge flicker where the preview turns itself off.
 * The cover test instead insets the stable layout footprint by the same 20%
 * visual shrink, so the preview only activates when the shrunken item will
 * still visibly intersect the trash target.
 *
 * @param {string} selector - Trash selector.
 * @param {HTMLElement} wrapper - Floating layout item wrapper.
 * @returns {boolean} True when wrapper and trash rectangles overlap.
 */
export function isCoveringTrash(selector, wrapper) {
  if (!selector || !wrapper) return false;
  const wrapperRect = scaledRemovalRect(wrapper);
  return trashTargets(selector).some((target) =>
    rectsOverlap(wrapperRect, target.getBoundingClientRect())
  );
}

/**
 * Toggle the active removal preview for the dragged wrapper.
 * Domain context: the preview communicates that dropping now will delete the
 * item. It must only appear for trash-enabled layouts and must clear as soon
 * as the pointer leaves or the drag ends.
 *
 * Technical context: the wrapper data attribute drives built-in CSS. The
 * overlay child also receives the same attribute so custom Hyper Element
 * overlays can react through CSS selectors without needing direct DOM calls or
 * framework-private state.
 *
 * @param {HTMLElement} host - Hyper Layout host.
 * @param {HTMLElement} wrapper - Active item wrapper.
 * @param {PointerEvent} event - Latest pointer move or release event.
 * @returns {boolean} True when the preview is active.
 */
export function updateRemovalPreview(host, wrapper, event) {
  const selector = host.getAttribute('trash') || '';
  const mode = host.getAttribute('removable') || '';
  const acceptsTrash = mode === 'trash' || mode === 'both';
  const overPointer = acceptsTrash
    ? isOverTrash(selector, event.clientX, event.clientY)
    : false;
  const overWrapper = acceptsTrash ? isCoveringTrash(selector, wrapper) : false;
  return setRemovalPreview(
    wrapper,
    acceptsTrash && (overPointer || overWrapper)
  );
}

/**
 * Clear any active removal preview from a wrapper.
 * Domain context: destructive styling should not remain visible after drop or
 * when the user drags away from trash.
 *
 * @param {HTMLElement} wrapper - Item wrapper.
 * @returns {boolean} Always false for call-site convenience.
 */
export function clearRemovalPreview(wrapper) {
  return setRemovalPreview(wrapper, false);
}

/**
 * Remove a stale wrapper without treating the internal cleanup as parent drift.
 * Domain context: controlled parents normally respond to `onremoved` by
 * re-rendering fewer children. When no parent listener exists, Hyper Layout
 * still needs to clear the deleted wrapper so the user sees the trash action
 * complete.
 *
 * Technical context: wrapper removal is delayed until the next frame so a
 * parent render gets the first chance to reconcile. If the wrapper still exists
 * then, the mutation observer is temporarily disconnected because this DOM
 * mutation is an internal cleanup, not an external child-count change.
 *
 * @param {HTMLElement} host - Hyper Layout host.
 * @param {HTMLElement|null} wrapper - Pending removal wrapper.
 * @param {string} id - Removed layout item ID.
 */
export function cleanupRemovedWrapper(host, wrapper, id) {
  requestAnimationFrame(() => {
    if (!wrapper?.isConnected || wrapper.dataset.layoutId !== id) return;
    host._observer?.disconnect();
    wrapper.remove();
    host._observer?.observe(host, { childList: true, subtree: false });
  });
}

/**
 * Resolve live trash target rectangles from a public selector.
 * @param {string} selector - Application-owned trash selector.
 * @returns {HTMLElement[]} Matching trash elements.
 */
function trashTargets(selector) {
  return Array.from(document.querySelectorAll(selector));
}

/**
 * Check whether a point is inside a DOM rectangle.
 * @param {HTMLElement} target - Trash target element.
 * @param {number} x - Client x.
 * @param {number} y - Client y.
 * @returns {boolean} True when the point is inside the target rectangle.
 */
function pointInRect(target, x, y) {
  const rect = target.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * Predict the visible dragged rectangle after the removal scale is applied.
 * Domain context: the red trash preview scales the card down by 20%. Requiring
 * the predicted scaled rectangle to overlap trash avoids a visual edge case
 * where a full-size card barely touches trash, shrinks away from it, then
 * repeatedly toggles the state.
 *
 * Technical context: the wrapper's untransformed layout rectangle is derived
 * from Hyper Layout's own `left`, `top`, `width`, and `height` styles. That
 * keeps targeting stable while CSS transitions and transforms are active.
 *
 * @param {HTMLElement} wrapper - Floating layout item wrapper.
 * @returns {Object|DOMRect} Rectangle used for trash-cover hit testing.
 */
function scaledRemovalRect(wrapper) {
  const rect = removalLayoutRect(wrapper);
  const insetX = (rect.width * (1 - REMOVAL_PREVIEW_SCALE)) / 2;
  const insetY = (rect.height * (1 - REMOVAL_PREVIEW_SCALE)) / 2;
  return {
    left: rect.left + insetX,
    top: rect.top + insetY,
    right: rect.right - insetX,
    bottom: rect.bottom - insetY,
    width: Math.max(0, rect.width - insetX * 2),
    height: Math.max(0, rect.height - insetY * 2),
  };
}

/**
 * Read the wrapper's unscaled layout footprint.
 * Hyper Layout always calls this for a live wrapper after `applyLayout()` has
 * written `left`, `top`, `width`, and `height`. A missing host or missing
 * styles would mean the item is not in the public drag/remove workflow, so the
 * helper keeps the invariant explicit instead of carrying dead fallback code.
 *
 * @param {HTMLElement} wrapper - Layout item wrapper.
 * @returns {Object} Viewport-relative unscaled rectangle.
 */
function removalLayoutRect(wrapper) {
  const hostRect = wrapper.closest('hyper-layout').getBoundingClientRect();
  const left = Number.parseFloat(wrapper.style.left);
  const top = Number.parseFloat(wrapper.style.top);
  const width = Number.parseFloat(wrapper.style.width);
  const height = Number.parseFloat(wrapper.style.height);
  return {
    left: hostRect.left + left,
    top: hostRect.top + top,
    right: hostRect.left + left + width,
    bottom: hostRect.top + top + height,
    width,
    height,
  };
}

/**
 * Check whether two rectangles have any visible overlap.
 * The overlap test is intentionally inclusive of positive area only, so a card
 * touching a trash edge without covering it does not show the destructive
 * preview.
 *
 * @param {DOMRect} a - First rectangle.
 * @param {DOMRect} b - Second rectangle.
 * @returns {boolean} True when the rectangles overlap with positive area.
 */
function rectsOverlap(a, b) {
  return (
    Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
    Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)
  );
}

/**
 * Reflect removal preview state onto the wrapper and hosted overlay element.
 * @param {HTMLElement} wrapper - Item wrapper.
 * @param {boolean} active - Whether removal preview should be active.
 * @returns {boolean} The active value.
 */
function setRemovalPreview(wrapper, active) {
  const overlay = wrapper?.querySelector('[data-hl-overlay] > *');
  if (active) {
    wrapper.dataset.hlRemoving = 'true';
    overlay?.setAttribute('data-hl-removing', 'true');
  } else {
    delete wrapper?.dataset.hlRemoving;
    overlay?.removeAttribute('data-hl-removing');
  }
  return active;
}
