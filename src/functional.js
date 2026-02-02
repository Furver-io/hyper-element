/**
 * @file Functional API for defining hyperElement components.
 * Provides a factory function to create custom element classes from plain objects.
 */

import { hyperElement } from './hyperElement.js';

/**
 * Creates a hyperElement class from a functional definition.
 *
 * @param {string|Object|Function} tagOrDef - Tag name, definition object, or render function
 * @param {Object|Function} [definition] - Definition object or render function (if first arg is tag)
 * @returns {typeof hyperElement} Generated class extending hyperElement
 *
 * @example
 * // Full definition with tag (auto-registers)
 * hyperElement('my-counter', {
 *   setup: (ctx, onNext) => { ... },
 *   render: (Html, ctx) => Html`...`
 * });
 *
 * @example
 * // Shorthand with tag (auto-registers)
 * hyperElement('hello-world', (Html, ctx) => Html`<div>Hello</div>`);
 *
 * @example
 * // Definition without tag (returns class for manual registration)
 * const MyElement = hyperElement({
 *   render: (Html, ctx) => Html`...`
 * });
 * customElements.define('my-element', MyElement);
 *
 * @example
 * // Shorthand without tag (returns class for manual registration)
 * const Simple = hyperElement((Html, ctx) => Html`<div>Simple</div>`);
 * customElements.define('simple-elem', Simple);
 */
export function createFunctionalElement(tagOrDef, definition) {
  // Signature parsing: (definition) or (tagName, definition)
  let tagName = null;
  if (typeof tagOrDef === 'string') {
    tagName = tagOrDef;
  } else {
    definition = tagOrDef;
  }

  // Handle shorthand: just a render function
  if (typeof definition === 'function') {
    definition = { render: definition };
  }

  if (!definition || typeof definition !== 'object') {
    throw new Error(
      'hyperElement: definition must be an object or render function'
    );
  }

  const {
    setup: setupFn,
    render: renderFn,
    onBeforeHydrate: beforeHydrateFn,
    onAfterHydrate: afterHydrateFn,
    ...methods
  } = definition;

  if (!renderFn || typeof renderFn !== 'function') {
    throw new Error('hyperElement: render function is required');
  }

  // Generate class dynamically
  // Note: observedAttributes not needed - MutationObserver handles all attribute reactivity
  class FunctionalElement extends hyperElement {}

  // Add setup if provided (passes context explicitly)
  if (setupFn) {
    FunctionalElement.prototype.setup = function (onNext) {
      return setupFn(this, onNext);
    };
  }

  // Add render (required, passes context explicitly)
  FunctionalElement.prototype.render = function (Html, ...data) {
    return renderFn(Html, this, ...data);
  };

  // Add SSR hydration lifecycle hooks if provided
  if (beforeHydrateFn) {
    FunctionalElement.prototype.onBeforeHydrate = function (events) {
      return beforeHydrateFn(this, events);
    };
  }

  if (afterHydrateFn) {
    FunctionalElement.prototype.onAfterHydrate = function () {
      return afterHydrateFn(this);
    };
  }

  // Add other methods (context as first param)
  for (const [name, fn] of Object.entries(methods)) {
    if (typeof fn !== 'function') {
      continue; // Skip non-function properties
    }
    FunctionalElement.prototype[name] = function (...args) {
      return fn(this, ...args);
    };
  }

  // Auto-register if tag name provided
  if (tagName) {
    customElements.define(tagName, FunctionalElement);
  }

  return FunctionalElement;
}
