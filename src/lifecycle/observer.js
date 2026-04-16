/**
 * @file MutationObserver setup for content and attribute changes.
 * Observes DOM mutations and triggers re-renders when content changes.
 * Handles ALL attribute reactivity (no observedAttributes needed).
 */

import { bind } from '../render/index.js';

/**
 * Sets up a MutationObserver to watch for content and attribute changes.
 * Re-renders the element when mutations are detected.
 *
 * @this {HTMLElement} The custom element instance (must have attachAttrs, render methods)
 * @param {Object} ref - The manager reference for this element
 * @returns {void}
 */
export function observer(ref) {
  const that = ref.this;
  // Capture element reference - 'this' is not available inside the callback
  const element = this;

  const mutationObserver = new MutationObserver((mutations) => {
    if (!ref.observe) return;

    // Only the host element's own mutations should trigger a host re-render.
    // Why this guard exists:
    //   - hyper-element renders nested custom elements into each other's light DOM.
    //   - When a CHILD re-renders, its DOM writes appear as descendant
    //     childList/attribute mutations to every ancestor observer because the
    //     observer is attached with `subtree: true`.
    //   - Treating those descendant writes as "the ancestor's content changed"
    //     causes the ancestor to clear and re-render itself, which fans the
    //     update out through the whole tree.
    //
    // We therefore ignore any batch where no mutation targeted the host
    // element directly. This preserves the intended host reactivity
    // (setAttribute, innerHTML/textContent on the custom element itself)
    // while isolating child renders from parent renders.
    const hostMutations = mutations.filter((m) => m.target === element);
    if (hostMutations.length === 0) return;

    // Check for attribute changes
    const attrMutations = hostMutations.filter((m) => m.type === 'attributes');
    if (attrMutations.length > 0) {
      // Handle data-* attribute additions and removals
      attrMutations.forEach((m) => {
        const name = m.attributeName;
        if (name.startsWith('data-')) {
          const dataSetName = name.slice(5); // Remove 'data-' prefix
          const camelKey = dataSetName.replace(/-([a-z])/g, (g) =>
            g[1].toUpperCase()
          );
          // Check if attribute was added or removed
          if (element.hasAttribute(name)) {
            // Attribute was added - add property to dataset if not already present
            if (!(camelKey in that.dataset)) {
              element.addDataset(that.dataset, dataSetName);
            }
          } else {
            // Attribute was removed - delete property from dataset
            delete that.dataset[camelKey];
          }
        }
      });

      // Re-attach attrs to pick up new shared attr values
      that.attrs = element.attachAttrs(element.attributes) || {};
      element.render();
      return;
    }

    // Handle content changes
    const textContent = element.textContent;

    ref.innerHTML = element.innerHTML;
    if (that.attrs.template) {
      that.attrs = element.attachAttrs(element.attributes) || {};
    }

    // Reset the element
    bind(ref.shadow)``;

    that.wrappedContent = textContent;
    element.render();
  });

  // Store observer on ref so render can call takeRecords() to clear internal mutations
  ref.mutationObserver = mutationObserver;

  mutationObserver.observe(element, {
    // Watch attribute changes to trigger re-renders
    attributes: true,

    // Set to true if additions and removals of the target node's child elements (including text nodes) are to be observed.
    childList: true,

    // Set to true if mutations to target and target's descendants are to be observed.
    subtree: true,
  });
}
