/**
 * @file Registry for component styled configurations.
 * Manages the mapping between component instances and their styled config.
 * @module hyper-element/styled/registry
 */

/**
 * Registry mapping component instances to their styled configuration.
 * Uses WeakMap to allow garbage collection when instances are removed.
 * @type {WeakMap<object, StyledEntry>}
 */
const registry = new WeakMap();

/**
 * Current rendering context.
 * Set during render to provide styled handlers access to the component instance.
 * This is necessary because during first render, DOM nodes are in a detached
 * DocumentFragment and DOM traversal cannot find the component.
 * @type {HTMLElement|null}
 */
let renderingInstance = null;

/**
 * Set the current rendering instance.
 * Called before render starts to provide context for styled handlers.
 * @param {HTMLElement|null} instance - The component instance or null to clear
 */
export function setRenderingInstance(instance) {
  renderingInstance = instance;
}

/**
 * Get the current rendering instance.
 * Used by styled handlers to access the component during first render.
 * @returns {HTMLElement|null} The current rendering instance
 */
export function getRenderingInstance() {
  return renderingInstance;
}

/**
 * @typedef {Object} StyledEntry
 * @property {Array} styled - [baseStyles, logicFunctions] array
 * @property {Object} ctx - Component context (attrs, state, etc.)
 * @property {Object} store - Component store
 * @property {Object|null} colors - Color palette from withOptions
 */

/**
 * @typedef {Object} PropFlag
 * @property {string} name - The flag name (e.g., 'error', 'large')
 * @property {boolean} active - Whether the flag is active
 */

/**
 * Register a component's styled configuration.
 * Called during connectedCallback to make styled config available during rendering.
 *
 * @param {HTMLElement} instance - The component instance
 * @param {Array} styled - [baseStyles, logicFunctions] array from definition
 * @param {Object} ctx - Component context object
 * @param {Object} store - Component store object
 * @param {Object|null} colors - Color palette from withOptions, or null
 */
export function registerStyled(instance, styled, ctx, store, colors) {
  registry.set(instance, { styled, ctx, store, colors });
}

/**
 * Unregister a component's styled configuration.
 * Called during disconnectedCallback to clean up.
 *
 * @param {HTMLElement} instance - The component instance
 */
export function unregisterStyled(instance) {
  registry.delete(instance);
}

/**
 * Get a component's styled entry from the registry.
 * @param {HTMLElement} instance - The component instance
 * @returns {StyledEntry|undefined} The styled entry or undefined
 */
export function getStyledEntry(instance) {
  return registry.get(instance);
}
