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
import { renderSpecTree } from './renderer.js';
import { registry, registryInterface } from './registry.js';

/**
 * Register a custom component type for json-render specs.
 *
 * Accepts two signatures:
 *   1. Legacy: registerComponent(type, renderFn) — render only, no catalog
 *   2. Catalog: registerComponent(type, { render, catalog }) — render + metadata
 *
 * Catalog-registered components appear in getCatalog() output and are
 * visible to the LLM via prompt() and toolDefinition(). Legacy
 * function-only registrations render correctly but are invisible to
 * the catalog (the LLM won't know about them).
 *
 * @param {string} type - The component type name (e.g. "Chart", "Map")
 * @param {Function|Object} renderFnOrEntry - Render function or { render, catalog } entry
 *
 * @example
 * // Legacy — render only
 * registerComponent('MyChart', (Html, def, key) =>
 *   Html.wire(def, ':' + key)`<div class="chart">${def.props?.data}</div>`
 * );
 *
 * @example
 * // Catalog — render + metadata for LLM schema generation
 * registerComponent('MyChart', {
 *   render: (Html, def, key) =>
 *     Html.wire(def, ':' + key)`<div class="chart">${def.props?.data}</div>`,
 *   catalog: {
 *     description: 'Data visualization chart',
 *     props: { data: { type: 'array', required: true } },
 *     slots: [],
 *     actions: {},
 *   },
 * });
 */
export function registerComponent(type, renderFnOrEntry) {
  if (typeof type !== 'string' || !type) {
    throw new Error('registerComponent: type must be a non-empty string');
  }

  // Validate the entry: must be a function or an object with a render function
  const isFunction = typeof renderFnOrEntry === 'function';
  const isEntry =
    renderFnOrEntry &&
    typeof renderFnOrEntry === 'object' &&
    typeof renderFnOrEntry.render === 'function';

  if (!isFunction && !isEntry) {
    throw new Error(
      'registerComponent: second argument must be a render function or ' +
        '{ render: Function, catalog?: Object }'
    );
  }

  // Warn when overriding a built-in type — usually unintentional
  if (BUILT_IN_COMPONENTS.has(type)) {
    console.warn(
      `json-render: overriding built-in component "${type}". ` +
        `This replaces the default implementation for all future renders.`
    );
  }
  // Normalize legacy function-only registrations to the standard
  // { render, catalog } shape. This ensures all registry entries have
  // a consistent structure, simplifying downstream consumers (renderer,
  // catalog API). Legacy registrations get catalog: null — they render
  // correctly but are invisible to getCatalog() / LLM schema generation.
  const entry = isFunction
    ? { render: renderFnOrEntry, catalog: null }
    : renderFnOrEntry;
  registry.set(type, entry);
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

// Export the shared registry interface for internal use by element.js.
// This ensures <jr-ui> sees custom-registered components, not just built-ins.
export { registryInterface };

// Re-export for consumers who need standalone access
export { renderNode } from './renderer.js';
export { validateSpec } from './validator.js';
export { BUILT_IN_COMPONENTS } from './components.js';
export { getCatalog } from './catalog.js';

// Auto-register the <jr-ui> custom element as a side effect.
// This import triggers the element definition so consumers
// can just `import 'hyper-element/json-render'` and start
// using <jr-ui data-spec='...'> in their HTML.
import './element.js';
