/**
 * @file Internal drag placeholder helpers for <hyper-layout>.
 *
 * The placeholder is a Hyper Layout-owned visual affordance, not application
 * data. It shows the empty snap box while a widget is actively dragged and is
 * ignored by item reconciliation so parent-owned `items[index] -> child[index]`
 * identity remains based only on real direct children.
 */

import { nodeToPixels } from './geometry.js';

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
export function ensureLayoutPlaceholder(host) {
  const existing = Array.from(host.children).find(
    (child) => child.dataset.hlPlaceholder !== undefined
  );
  const placeholder = existing || document.createElement('div');
  placeholder.dataset.hlPlaceholder = 'true';
  placeholder.setAttribute('aria-hidden', 'true');
  if (!existing) host.appendChild(placeholder);
  return placeholder;
}

/**
 * Position and reveal the internal drag placeholder.
 * Domain context: the placeholder is the empty dashed snap target shown under
 * the floating item during drag.
 *
 * Technical context: the placeholder uses the same `nodeToPixels()` conversion
 * as real wrappers, so the preview aligns with the eventual `applyLayout()`
 * snap destination.
 *
 * @param {HTMLElement} host - Hyper layout host.
 * @param {Object|null} node - Preview node.
 * @param {Object} grid - Measured grid values.
 */
export function updateDragPlaceholder(host, node, grid) {
  const placeholder = host._placeholder;
  if (!placeholder || !node) return;
  const px = nodeToPixels(node, grid);
  Object.assign(placeholder.style, {
    left: `${px.left}px`,
    top: `${px.top}px`,
    width: `${px.width}px`,
    height: `${px.height}px`,
  });
  placeholder.dataset.hlPlaceholderActive = 'true';
}

/**
 * Hide the internal drag placeholder after a drag session.
 * Domain context: the placeholder only communicates an active drag target; it
 * must disappear before the layout returns to normal interaction mode.
 *
 * @param {HTMLElement} host - Hyper layout host.
 */
export function hideDragPlaceholder(host) {
  if (host._placeholder) delete host._placeholder.dataset.hlPlaceholderActive;
}
