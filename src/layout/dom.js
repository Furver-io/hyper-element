/**
 * @file DOM wrapper helpers for <hyper-layout>.
 *
 * Hyper Layout owns wrapper elements so arbitrary child custom elements can
 * remain oblivious to editor controls. This module keeps that wrapping logic
 * separate from the host element's state and event lifecycle.
 *
 * The host element relies on this module after every reconciliation pass.
 * The position engine relies only on item IDs, so this DOM layer is the bridge
 * that attaches those IDs to live wrapper elements, stamps capability metadata,
 * and creates overlay children. The original direct child is moved into the
 * wrapper unchanged; Hyper Layout never mutates or inspects the child
 * component's internal DOM because descendants remain owned by that component.
 */

import { sharedAttrs } from '../core/manager.js';
import { makeid } from '../utils/makeid.js';

/**
 * Return logical children, unwrapping existing Hyper Layout item wrappers.
 * Domain context: parent render functions should keep writing direct children
 * as if no layout editor exists. On first connection the children are raw; on
 * later renders they may already be inside Hyper Layout wrappers. This helper
 * presents both cases as the same logical list so reconciliation can enforce
 * `items[index] -> child[index]` consistently.
 *
 * Technical context: only host children are inspected. Nested descendants are
 * deliberately ignored so a child component can use any internal structure
 * without accidentally becoming draggable or resizable.
 *
 * @param {HTMLElement} host - Layout host.
 * @returns {Array<{wrapper: HTMLElement|null, child: HTMLElement}>}
 */
export function layoutChildren(host) {
  return Array.from(host.children)
    .filter((element) => element.dataset.hlPlaceholder === undefined)
    .map((element) => {
      if (element.dataset.hlItem !== undefined) {
        return {
          wrapper: element,
          child: element.querySelector('[data-hl-content]')?.firstElementChild,
        };
      }
      return { wrapper: null, child: element };
    })
    .filter((entry) => entry.child);
}

/**
 * Wrap raw direct children and stamp wrappers with item identity.
 * Domain context: the parent owns item identity through the ordered `items`
 * manifest, while the wrapper owns edit UI. This keeps arbitrary dashboard
 * widgets layout-oblivious and reload-stable.
 *
 * Technical context: the engine must already contain the item nodes when this
 * function runs. The wrapper receives data attributes used by CSS,
 * interactions, and diagnostics. Custom overlays receive structured values via
 * Hyper Element shared attributes so their render functions read `ctx.attrs`
 * rather than reaching into DOM internals.
 *
 * @param {HTMLElement} host - Layout host.
 * @param {Array} children - Logical child entries.
 * @param {Array} items - Normalized item manifest.
 * @param {Object} engine - Layout engine.
 * @param {string} overlayTag - Optional custom overlay element tag.
 */
export function wrapLayoutChildren(host, children, items, engine, overlayTag) {
  children.forEach((entry, index) => {
    const item = items[index];
    const wrapper = entry.wrapper || document.createElement('div');
    const content =
      wrapper.querySelector('[data-hl-content]') ||
      document.createElement('div');
    const overlay =
      wrapper.querySelector('[data-hl-overlay]') || createLayoutOverlay();
    const node = engine.get(item.id);
    if (item.tag && entry.child.localName !== item.tag) {
      console.warn(
        `hyper-layout: items[${index}].tag "${item.tag}" does not match ` +
          `direct child <${entry.child.localName}>`
      );
    }
    wrapper.dataset.hlItem = '';
    wrapper.dataset.layoutId = item.id;
    wrapper.dataset.hlCanDrag = String(item.can.includes('drag'));
    wrapper.dataset.hlCanResize = String(item.can.includes('resize'));
    wrapper.dataset.hlLocked = String(!!node?.locked);
    content.dataset.hlContent = '';
    syncLayoutOverlay(overlay, overlayTag, host, wrapper, item, node);
    if (!entry.wrapper) {
      host.insertBefore(wrapper, entry.child);
      content.appendChild(entry.child);
      wrapper.append(content, overlay);
    }
  });
}

/**
 * Create the edit overlay controls for a wrapper.
 * Domain context: every item gets one editor-owned overlay shell so hover,
 * blur, drag, and resize affordances are independent from the child widget.
 *
 * Technical context: the visual child of this shell is selected later by
 * `syncLayoutOverlay()`, allowing the same wrapper to switch between the
 * default overlay and a user-supplied custom overlay tag during re-render.
 *
 * @returns {HTMLElement} Overlay element.
 */
export function createLayoutOverlay() {
  const overlay = document.createElement('div');
  overlay.dataset.hlOverlay = '';
  return overlay;
}

/**
 * Refresh the visual overlay hosted by Hyper Layout.
 * Domain context: overlays are visual affordances, not identity. Rebuilding
 * them from `items` keeps controlled parent re-renders deterministic.
 *
 * @param {HTMLElement} overlay - Hyper Layout overlay shell.
 * @param {string} overlayTag - Custom overlay tag name.
 * @param {HTMLElement} host - Layout host.
 * @param {HTMLElement} wrapper - Item wrapper.
 * @param {Object} item - Normalized manifest item.
 * @param {Object|null} node - Engine node.
 */
function syncLayoutOverlay(overlay, overlayTag, host, wrapper, item, node) {
  const tag = overlayTag ? String(overlayTag).toLowerCase() : '';
  const child = overlay.firstElementChild;
  if (!child || child.localName !== (tag || 'hyper-layout-default-overlay')) {
    overlay.replaceChildren(
      tag ? document.createElement(tag) : createDefaultOverlay()
    );
  }
  configureOverlayElement(overlay.firstElementChild, host, wrapper, item, node);
}

/**
 * Create the default blur-only overlay affordance.
 * Domain context: the default editor UI must be usable without application
 * setup and must not assume a light or dark theme. It therefore uses transparent
 * controls over the shared blurred overlay rather than an opaque panel.
 *
 * Technical context: the `data-hl-drag` and `data-hl-resize` markers are
 * internal affordance markers for the default overlay only. Custom overlays can
 * ignore them and call the typed callbacks supplied through `ctx.attrs`.
 *
 * @returns {HTMLElement} Default overlay element.
 */
function createDefaultOverlay() {
  const root = document.createElement('hyper-layout-default-overlay');
  root.innerHTML = `
    <button data-hl-drag type="button" aria-label="Move item">
      <svg data-hl-move-icon xmlns="http://www.w3.org/2000/svg" width="24" height="24"
        viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        aria-hidden="true">
        <polyline points="5 9 2 12 5 15"></polyline>
        <polyline points="9 5 12 2 15 5"></polyline>
        <polyline points="15 19 12 22 9 19"></polyline>
        <polyline points="19 9 22 12 19 15"></polyline>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <line x1="12" y1="2" x2="12" y2="22"></line>
      </svg>
      <svg data-hl-trash-icon xmlns="http://www.w3.org/2000/svg" width="24" height="24"
        viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        aria-hidden="true">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
    </button>
    <button data-hl-resize type="button" aria-label="Resize item">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
        viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        aria-hidden="true">
        <line x1="7" y1="7" x2="17" y2="17"></line>
        <polyline points="17 7 17 17 7 17"></polyline>
      </svg>
    </button>
  `;
  return root;
}

/**
 * Pass layout context into a default or custom overlay element.
 * Domain context: overlays need to know what the parent allowed for this item,
 * but item permissions are application data, not DOM state. The normalized item
 * and engine node are passed to the overlay as read-only render context.
 *
 * Technical context: default overlays use simple attributes for CSS hiding.
 * Custom Hyper Element overlays additionally receive object/function shared
 * attributes, which preserves the framework convention that component input is
 * read from `ctx.attrs`.
 *
 * @param {HTMLElement} element - Overlay visual element.
 * @param {HTMLElement} host - Layout host.
 * @param {HTMLElement} wrapper - Item wrapper.
 * @param {Object} item - Normalized manifest item.
 * @param {Object|null} node - Engine node.
 */
function configureOverlayElement(element, host, wrapper, item, node) {
  element.setAttribute('layout-id', item.id);
  toggleCapability(element, 'can-drag', item.can.includes('drag'));
  toggleCapability(element, 'can-resize', item.can.includes('resize'));
  if (element.localName !== 'hyper-layout-default-overlay') {
    setSharedOverlayAttr(element, 'can', [...item.can]);
    setSharedOverlayAttr(element, 'item', item);
    setSharedOverlayAttr(element, 'node', node);
    setSharedOverlayAttr(element, 'drag', (event) =>
      startOverlayAction(host, item.id, 'drag', event)
    );
    setSharedOverlayAttr(element, 'resize', (event) =>
      startOverlayAction(host, item.id, 'resize', event)
    );
  }
}

/**
 * Pass a typed value into an internally-created Hyper Element overlay.
 * Domain context: custom overlays are user-authored Hyper Elements, so their
 * data contract must be `ctx.attrs`, the same contract used by normal
 * template-rendered child elements.
 *
 * Technical context: Hyper Element's `attachAttrs()` restores object/function
 * values from `sharedAttrs` when it sees an `ob-*` or `fn-*` attribute whose
 * target `localName` matches the receiving custom element.
 *
 * @param {HTMLElement} element - Custom overlay element.
 * @param {string} name - Attribute name exposed through `ctx.attrs`.
 * @param {*} value - Structured value or callback to expose.
 */
function setSharedOverlayAttr(element, name, value) {
  const id = makeid();
  sharedAttrs[id] = {
    attrName: name,
    val: value,
    localName: element.localName,
  };
  element.setAttribute(
    name,
    `${typeof value === 'function' ? 'fn' : 'ob'}-${id}`
  );
}

/**
 * Start an action requested explicitly by a custom overlay component.
 * Domain context: custom overlays can decide their own visual layout and
 * control regions while Hyper Layout still owns the actual drag/resize
 * behavior and constraints.
 *
 * Technical context: the callback forwards to the interaction adapter installed
 * on the host. Event propagation is stopped so the same pointerdown does not
 * also flow through the generic overlay inference path.
 *
 * @param {HTMLElement} host - Layout host.
 * @param {string} id - Layout item ID.
 * @param {'drag'|'resize'} action - Requested action.
 * @param {PointerEvent} event - Pointer start event.
 */
function startOverlayAction(host, id, action, event) {
  event?.stopPropagation?.();
  host._startLayoutAction?.(action, id, event);
}

/**
 * Reflect a boolean capability as an attribute for custom overlay styling.
 * Domain context: CSS-only custom overlays should be able to hide disabled
 * controls without running JavaScript.
 *
 * Technical context: these attributes mirror the normalized `item.can` array
 * and are refreshed on every wrapper sync, so they stay correct after the
 * parent changes permissions.
 *
 * @param {HTMLElement} element - Overlay visual element.
 * @param {string} name - Attribute name.
 * @param {boolean} enabled - Whether the capability is enabled.
 */
function toggleCapability(element, name, enabled) {
  if (enabled) element.setAttribute(name, '');
  else element.removeAttribute(name);
}
