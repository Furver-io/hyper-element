/**
 * @file Factory for creating customized hyperElement with shared options.
 * Enables features like color palettes that are shared across components.
 * @module hyper-element/withOptions
 */

import { createFunctionalElement } from './functional.js';

/**
 * Create a customized hyperElement factory with shared options.
 * Components created with the returned factory share the provided options.
 *
 * @param {Object} options - Shared options for all components
 * @param {Object} [options.colors] - Color palette mapping names to hex values
 * @returns {Function} Customized hyperElement factory
 *
 * @example
 * // Create a themed factory
 * const themed = withOptions({
 *   colors: {
 *     primary: '#007bff',
 *     danger: '#dc3545',
 *     light: '#f8f9fa'
 *   }
 * });
 *
 * // All components share the color palette
 * themed('my-button', {
 *   styled: [{
 *     button: {
 *       backgroundColor: 'primary',  // Resolves to #007bff
 *       color: 'light'               // Resolves to #f8f9fa
 *     }
 *   }],
 *   render: (Html) => Html`<button+styled><slot></slot></button>`
 * });
 */
export function withOptions(options = {}) {
  /**
   * Customized hyperElement factory.
   * Supports same signatures as hyperElement:
   *   - customElement('tag-name', definition)
   *   - customElement(definition)
   *   - customElement('tag-name', renderFn)
   *   - customElement(renderFn)
   *
   * @param {string|Object|Function} tagNameOrDefinition - Tag name, definition, or render function
   * @param {Object|Function} [definition] - Definition object or render function (if tag provided)
   * @returns {typeof HTMLElement} Generated class extending hyperElement
   */
  return function customHyperElement(tagNameOrDefinition, definition) {
    // Handle different call signatures
    let tagName = null;
    let def = null;

    if (typeof tagNameOrDefinition === 'string') {
      tagName = tagNameOrDefinition;
      def = definition;
    } else {
      def = tagNameOrDefinition;
    }

    // Normalize shorthand (render function only)
    if (typeof def === 'function') {
      def = { render: def };
    }

    // Attach options to definition for access during rendering
    if (def && typeof def === 'object') {
      def.__options = options;
    }

    // Delegate to createFunctionalElement
    if (tagName) {
      return createFunctionalElement(tagName, def);
    }
    return createFunctionalElement(def);
  };
}
