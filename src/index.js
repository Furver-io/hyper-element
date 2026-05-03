/**
 * @file hyper-element main entry point.
 * Exports the hyperElement base class for creating custom elements with hyperHTML templating.
 * Supports both class-based and functional API patterns.
 * @module hyper-element
 */

import { hyperElement as HyperElementClass } from './hyperElement.js';
import { createFunctionalElement } from './functional.js';
import { signal, computed, effect, batch, untracked } from './signals/index.js';
import { configureSSR } from './ssr/index.js';
import { withOptions } from './withOptions.js';
import { defineStyled } from './styled/index.js';
import {
  renderSpec,
  registerComponent,
  validateSpec,
  listComponentTypes,
  getCatalog,
} from './json-render/index.js';

/**
 * Throws error when hyperElement is instantiated directly.
 * Extracted to helper so V8 can properly track branch coverage.
 * (V8 profiler doesn't count throw statements as branches taken)
 */
function rejectDirectInstantiation() {
  throw new Error(
    'hyperElement cannot be instantiated directly. Use class extension or functional API.'
  );
}

/**
 * Dual-purpose hyperElement export:
 * - As class base: `class MyEl extends hyperElement {}`
 * - As factory: `hyperElement('tag-name', { render: ... })`
 *
 * Uses Proxy to intercept function calls while preserving class inheritance.
 */
const hyperElement = new Proxy(HyperElementClass, {
  /**
   * Intercepts function calls:
   *   hyperElement('tag-name', { ... })       - with tag
   *   hyperElement({ ... })                   - without tag
   *   hyperElement('tag-name', (...) => ...)  - shorthand with tag
   *   hyperElement((...) => ...)              - shorthand without tag
   * @param {Function} target - The original hyperElement class
   * @param {any} thisArg - The this value for the call
   * @param {Array} args - Arguments passed to the function call
   * @returns {typeof HyperElementClass} Generated class extending hyperElement
   */
  apply(target, thisArg, args) {
    if (args.length === 0) {
      throw new Error(
        'hyperElement requires a definition object or render function'
      );
    }
    return createFunctionalElement(...args);
  },

  /**
   * Intercepts new: allows subclass construction but blocks direct instantiation
   * @param {Function} target - The original hyperElement class
   * @param {Array} args - Arguments passed to the constructor
   * @param {Function} newTarget - The constructor that was originally called
   * @returns {Object} New instance of hyperElement subclass
   */
  construct(target, args, newTarget) {
    // Allow if called via subclass (class X extends hyperElement)
    if (newTarget !== hyperElement) {
      return Reflect.construct(target, args, newTarget);
    }
    rejectDirectInstantiation();
  },
});

export {
  hyperElement,
  withOptions,
  signal,
  computed,
  effect,
  batch,
  untracked,
  configureSSR,
  defineStyled,
  renderSpec,
  registerComponent,
  validateSpec,
  listComponentTypes,
  getCatalog,
};
export default hyperElement;
