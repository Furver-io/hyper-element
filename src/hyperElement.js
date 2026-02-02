/**
 * @file hyperElement base class definition.
 * The main class that custom elements extend to use hyperHTML templating.
 */

import { manager } from './core/manager.js';
import { createdCallback } from './lifecycle/connectedCallback.js';
import { attachAttrs } from './attributes/attachAttrs.js';
import { getDataset, addDataset } from './attributes/dataset.js';

/**
 * Context object available as `this` in render() and setup() methods.
 * @typedef {Object} ElementContext
 * @property {HTMLElement} element - The DOM element
 * @property {Object} attrs - Parsed attributes from the element
 * @property {Object} dataset - Dataset proxy with automatic type coercion
 * @property {any} [store] - Store value from setup
 * @property {string} wrappedContent - Text content of element
 */

/**
 * Base class for creating custom elements with hyperHTML templating.
 * Extend this class and implement the render() method to create a custom element.
 *
 * @example
 * class MyElement extends hyperElement {
 *   render(Html) {
 *     Html`<div>Hello ${this.attrs.name}</div>`;
 *   }
 * }
 * customElements.define('my-element', MyElement);
 *
 * @extends HTMLElement
 */
export class hyperElement extends HTMLElement {
  /**
   * Unique identifier for this element instance.
   * @type {symbol}
   */
  identifier;

  /**
   * Gets the innerHTML of the element's shadow/content root.
   * @returns {string} The inner HTML content
   */
  get innerShadow() {
    return manager[this.identifier].shadow.innerHTML;
  }

  /**
   * Called when the element is inserted into a document.
   * Initializes the element, sets up observers, and triggers initial render.
   * @returns {void}
   */
  connectedCallback() {
    createdCallback.call(this);
  }

  /**
   * Adds a property to the dataset proxy with automatic type coercion.
   * @param {Object} dataset - The proxied dataset object
   * @param {string} dash_key - The kebab-case attribute key
   * @returns {void}
   */
  addDataset(dataset, dash_key) {
    addDataset.call(this, dataset, dash_key);
  }

  /**
   * Creates a proxied dataset object from the element's dataset.
   * @returns {Object} Proxied dataset with automatic type coercion
   */
  getDataset() {
    return getDataset.call(this);
  }

  /**
   * Attaches attributes from the element to the context object.
   * @param {NamedNodeMap} attributes - The element's attributes collection
   * @returns {Object} Object containing all parsed attributes
   */
  attachAttrs(attributes) {
    return attachAttrs.call(this, attributes);
  }

  /**
   * Called when an observed attribute changes.
   * Note: hyper-element uses MutationObserver for attribute reactivity,
   * so observedAttributes is not required. This callback is kept for
   * backwards compatibility with subclasses that override it.
   *
   * @param {string} name - The attribute name
   * @param {string|null} oldVal - The previous value
   * @param {string|null} newVal - The new value
   * @returns {void}
   */
  attributeChangedCallback(name, oldVal, newVal) {} // eslint-disable-line no-unused-vars

  /**
   * Called when the element is removed from the document.
   * Calls the teardown function if one was returned from setup().
   * @returns {void}
   */
  disconnectedCallback() {
    const ref = manager[this.identifier];
    ref.teardown && ref.teardown();
  }

  /**
   * Optional setup lifecycle method. Called once when the element is connected.
   * Use this to set up stores, subscriptions, or other initialization logic.
   *
   * @param {Function} onNext - Call this with a store value or getter to enable reactive updates
   * @returns {void|Function} Optional teardown function called when element is disconnected
   *
   * @example
   * setup(onNext) {
   *   const store = createStore({ count: 0 });
   *   onNext(store.getState);
   *   return store.subscribe(() => this.render());
   * }
   */
  setup(onNext) {} // eslint-disable-line no-unused-vars

  /**
   * SSR hydration lifecycle hook. Called before buffered events are replayed.
   * Override to filter or modify events before replay.
   *
   * @param {Array} events - Buffered events captured during SSR
   * @returns {Array} Filtered events to replay
   *
   * @example
   * onBeforeHydrate(events) {
   *   return events.filter(e => e.type !== 'focus');
   * }
   */
  onBeforeHydrate(events) {
    return events;
  }

  /**
   * SSR hydration lifecycle hook. Called after event replay completes.
   * Override to perform post-hydration setup.
   *
   * @example
   * onAfterHydrate() {
   *   console.log('Component hydrated');
   * }
   */
  onAfterHydrate() {}

  /**
   * Required render lifecycle method. Called on every render cycle.
   * Use the Html template tag to render content to the element.
   *
   * @param {Object} Html - Tagged template literal function for rendering
   * @param {...any} data - Additional data passed from store updates
   * @returns {void}
   *
   * @example
   * render(Html) {
   *   Html`<div>Hello ${this.attrs.name}!</div>`;
   * }
   */
  render(Html, ...data) {} // eslint-disable-line no-unused-vars
}
