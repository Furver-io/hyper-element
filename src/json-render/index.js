/**
 * @file json-render public API for hyper-element.
 *
 * This module is the main entry point for json-render functionality.
 * It provides a spec-driven UI rendering system that turns flat JSON
 * specs (produced by LLM tool calls) into live DOM trees using
 * hyper-element's efficient tagged template rendering.
 *
 * Usage:
 *   // Auto-registers <jr-ui> custom element
 *   import 'hyper-element/json-render';
 *
 *   // Or use the API directly
 *   import { renderSpec, registerComponent, validateSpec } from 'hyper-element/json-render';
 *
 * The <jr-ui> element is registered as a side-effect of importing
 * this module. It reads a `data-spec` attribute containing a JSON
 * string and renders the spec to the DOM.
 *
 * @module hyper-element/json-render
 */

import { BUILT_IN_COMPONENTS } from './components.js';
import { renderNode, renderSpecTree } from './renderer.js';
import { validateSpec } from './validator.js';

/**
 * Component registry — maps type names to render functions.
 *
 * Initialized with all built-in types (Card, Button, Text, etc.).
 * Custom types can be added via registerComponent() and will be
 * available to all specs rendered after registration.
 *
 * @type {Map<string, Function>}
 */
const registry = new Map(BUILT_IN_COMPONENTS);

/**
 * Registry interface exposed to the renderer.
 * Wraps the Map with a .get() method matching the expected
 * interface in renderer.js.
 */
const registryInterface = {
  /** Look up a render function by component type name */
  get: (type) => registry.get(type),
  /** List all registered type names */
  all: () => [...registry.keys()],
};

/**
 * Register a custom component type for json-render specs.
 *
 * Custom components extend the built-in set (Card, Button, etc.)
 * and can be used in any spec by setting def.type to the registered name.
 *
 * @param {string} type - The component type name (e.g. "Chart", "Map")
 * @param {Function} renderFn - Render function: (Html, def, key, kids, hostEl) => HtmlTemplate
 *
 * @example
 * registerComponent('MyChart', (Html, def, key) =>
 *   Html.wire(def, ':' + key)`<div class="chart">${def.props?.data}</div>`
 * );
 */
export function registerComponent(type, renderFn) {
  if (typeof type !== 'string' || !type) {
    throw new Error('registerComponent: type must be a non-empty string');
  }
  if (typeof renderFn !== 'function') {
    throw new Error('registerComponent: renderFn must be a function');
  }
  // Warn when overriding a built-in type — usually unintentional
  if (BUILT_IN_COMPONENTS.has(type)) {
    console.warn(
      `json-render: overriding built-in component "${type}". ` +
        `This replaces the default implementation for all future renders.`
    );
  }
  registry.set(type, renderFn);
}

/**
 * Render a json-render spec using hyper-element's Html function.
 *
 * This is the core rendering API. It takes a spec (the { root, elements }
 * wire format) and produces a DOM tree using the registered components.
 * The Html function must come from a hyper-element render context
 * (either a component's render() method or a standalone bind()).
 *
 * @param {Object} Html - hyper-element's tagged template function
 * @param {Object} spec - json-render spec: { root: string, elements: Object }
 * @param {HTMLElement} hostEl - Host element for jr-action event dispatch
 * @returns {Node} Rendered DOM tree
 *
 * @example
 * hyperElement('my-view', (Html, ctx) => {
 *   const spec = JSON.parse(ctx.attrs['data-spec']);
 *   return renderSpec(Html, spec, ctx.element);
 * });
 */
export function renderSpec(Html, spec, hostEl) {
  return renderSpecTree(Html, spec, hostEl, registryInterface);
}

/**
 * List every component type currently registered (built-ins + customs).
 *
 * Useful for runtime introspection: debug tools, documentation generators,
 * and validators that want to know which types are valid without the
 * caller having to track every registerComponent() call themselves.
 *
 * The returned array is a snapshot — mutating it has no effect on the
 * registry. Subsequent registerComponent() calls will not appear until
 * listComponentTypes() is called again.
 *
 * @returns {string[]} Array of registered type names in registration order
 *
 * @example
 * import { listComponentTypes, registerComponent } from 'hyper-element/json-render';
 * registerComponent('MyChart', renderChart);
 * console.log(listComponentTypes());
 * // ['Card', 'Row', 'Column', ..., 'TextField', 'MyChart']
 */
export function listComponentTypes() {
  return registryInterface.all();
}

// Re-export for consumers who need standalone access
export { renderNode } from './renderer.js';
export { validateSpec } from './validator.js';
export { BUILT_IN_COMPONENTS } from './components.js';

// Auto-register the <jr-ui> custom element as a side effect.
// This import triggers the element definition so consumers
// can just `import 'hyper-element/json-render'` and start
// using <jr-ui data-spec='...'> in their HTML.
import './element.js';
