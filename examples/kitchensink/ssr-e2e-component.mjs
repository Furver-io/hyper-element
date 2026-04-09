/**
 * Shared component definition for SSR E2E testing.
 * This file is imported by BOTH:
 * - Server (Node.js) for renderElement()
 * - Client (Browser) for customElements.define()
 *
 * IMPORTANT: This file must be environment-agnostic.
 * NO imports from hyper-element or any environment-specific code.
 */

export const tagName = 'ssr-e2e-counter';

/**
 * Component definition object.
 * Used by server for SSR and by client for hydration.
 */
export const definition = {
  setup(onNext) {
    this.count = 0;
    return onNext(() => ({ count: this.count }));
  },

  handleClick() {
    this.count++;
    this.element.render();
  },

  render(Html, store) {
    Html`<button id="ssr-e2e-btn" onclick=${() => this.handleClick()}>Count: ${store?.count ?? 0}</button>`;
  },
};
