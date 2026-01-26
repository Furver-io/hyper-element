/**
 * @file MutationObserver setup for content and attribute changes.
 * Observes DOM mutations and triggers re-renders when content changes.
 * Handles ALL attribute reactivity (no observedAttributes needed).
 */

import { hyperHTML } from '../core/uhtml.js';

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

    // Check for attribute changes
    const attrMutations = mutations.filter((m) => m.type === 'attributes');
    if (attrMutations.length > 0) {
      // Re-attach attrs to pick up new shared attr values
      that.attrs = element.attachAttrs(element.attributes) || {};
      element.render();
      return;
    }

    // Handle content changes
    let textContent = element.textContent;

    ref.innerHTML = element.innerHTML;
    if (that.attrs.template) {
      that.attrs = element.attachAttrs(element.attributes) || {};
    }

    // Reset the element
    hyperHTML.bind(ref.shadow)``;

    that.wrappedContent = textContent;
    element.render();
  });

  mutationObserver.observe(element, {
    // Watch attribute changes to trigger re-renders
    attributes: true,

    // Set to true if additions and removals of the target node's child elements (including text nodes) are to be observed.
    childList: true,

    // Set to true if mutations to target and target's descendants are to be observed.
    subtree: true,
  });
}
