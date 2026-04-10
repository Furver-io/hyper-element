/**
 * @file Core recursive tree builder for json-render specs.
 *
 * Takes a flat elements map ({ root, elements }) and recursively
 * renders each node by looking up its type in the component registry.
 * Uses Html.wire() for efficient keyed DOM reuse across re-renders.
 *
 * This is the engine that powers both the <jr-ui> custom element
 * and the standalone renderSpec() API. It's framework-internal —
 * consumers use the higher-level exports from index.js.
 *
 * @module hyper-element/json-render/renderer
 */

/**
 * Render a single node from a json-render spec.
 *
 * Walks the flat elements map starting from the given key, builds
 * children recursively, and dispatches to the registry for the
 * actual HTML template. Wire keys ensure stable DOM identity
 * across re-renders when the spec changes.
 *
 * @param {Object} Html - hyper-element's tagged template function (with .wire())
 * @param {string} key - Element key in the elements map
 * @param {Object} elements - Full elements map from the spec
 * @param {HTMLElement} hostEl - The host element (for event dispatch bubbling)
 * @param {Object} registry - Component registry { get(type) => renderFn }
 * @returns {Node} Rendered DOM node or template
 */
export function renderNode(Html, key, elements, hostEl, registry) {
  const def = elements[key];

  // Missing element reference — render a loading placeholder instead
  // of silently returning nothing. This handles partial specs during
  // streaming where children keys exist but their definitions haven't
  // arrived yet via input_json_delta events.
  if (!def) {
    return Html.wire(
      {},
      ':' + key
    )`<div class="jr-text muted">[loading...]</div>`;
  }

  // Recursively render children into an array of DOM nodes.
  // Each child is a key reference in the flat elements map.
  const kids = (def.children || []).map((childKey) =>
    renderNode(Html, childKey, elements, hostEl, registry)
  );

  // Look up the component type in the registry. The registry maps
  // type names (e.g. "Card", "Button") to entries that are either:
  //   - { render, catalog } objects (built-ins and catalog-registered)
  //   - plain functions (legacy registerComponent(type, fn) calls)
  const entry = registry.get(def.type);

  // Resolve the render function from the entry. Legacy registrations
  // store a bare function; catalog registrations store { render, catalog }.
  const renderFn = typeof entry === 'function' ? entry : entry?.render;

  // Unknown type — show a diagnostic placeholder instead of crashing.
  // This signals to the developer which type name isn't registered,
  // enabling debugging of custom component issues.
  if (!renderFn) {
    return Html.wire(def, ':' + key)`<div>[unknown: ${def.type}]</div>`;
  }

  // Delegate to the registered render function.
  // Each component receives: Html (for wire/template), the element
  // definition, the key (for wire identity), rendered children,
  // and the host element (for event dispatch).
  return renderFn(Html, def, key, kids, hostEl);
}

/**
 * Render a complete json-render spec into a DOM tree.
 *
 * This is the main entry point for spec rendering. It validates
 * the spec structure, then delegates to renderNode() for the
 * recursive build. Returns an Html template that can be inserted
 * into the DOM by hyper-element's rendering pipeline.
 *
 * @param {Object} Html - hyper-element's tagged template function
 * @param {Object} spec - json-render spec: { root: string, elements: Object }
 * @param {HTMLElement} hostEl - The host element for event bubbling
 * @param {Object} registry - Component registry with .get(type) method
 * @returns {Node} Rendered DOM tree wrapped in a jr-ui-root container
 * @throws {Error} If spec.root is not found in spec.elements
 */
export function renderSpecTree(Html, spec, hostEl, registry) {
  // Validate: root key must resolve to an element definition.
  // This catches mismatches between root and elements map early,
  // before the recursive walk produces confusing nested errors.
  if (!spec.elements[spec.root]) {
    throw new Error(`Spec error: root "${spec.root}" not found in elements`);
  }

  // Build the tree starting from the root element.
  // The result is wrapped in a container div for consistent
  // DOM structure and CSS targeting.
  return Html`<div class="jr-ui-root">${renderNode(Html, spec.root, spec.elements, hostEl, registry)}</div>`;
}
