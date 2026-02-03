/**
 * @file Style resolution module for +styled template syntax.
 * Provides a registry for component styled configs and resolves styles
 * based on base styles, shared selectors, prop flags, logic functions, and color palettes.
 * @module hyper-element/render/styled
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
 * Resolve color palette values in a style object.
 * Replaces color names with their hex values from the palette.
 *
 * @param {Object} styles - Style object with potential color names
 * @param {Object} colors - Color palette mapping names to hex values
 * @returns {Object} Style object with resolved colors
 */
function resolveColors(styles, colors) {
  const resolved = {};
  for (const [prop, value] of Object.entries(styles)) {
    if (typeof value === 'string') {
      // Direct color name match
      if (colors[value]) {
        resolved[prop] = colors[value];
      } else {
        // Check for color name within string (e.g., "1px solid primary")
        let newValue = value;
        for (const [name, hex] of Object.entries(colors)) {
          // Use word boundary to avoid partial matches
          newValue = newValue.replace(new RegExp(`\\b${name}\\b`, 'g'), hex);
        }
        resolved[prop] = newValue;
      }
    } else {
      resolved[prop] = value;
    }
  }
  return resolved;
}

/**
 * Check if a style object uses nested syntax (has a 'base' key).
 * Nested syntax enables prop flags mode.
 *
 * @param {Object} tagStyles - Style definition for a tag
 * @returns {boolean} True if nested syntax (prop flag mode)
 */
function isNestedSyntax(tagStyles) {
  return tagStyles && typeof tagStyles === 'object' && 'base' in tagStyles;
}

/**
 * Core style resolution logic.
 * Extracted to allow direct calls from SSR without registry lookup.
 *
 * @param {Object} entry - Styled entry with styled, ctx, store, colors
 * @param {string} tagName - The tag name (e.g., 'div', 'h2')
 * @param {*} styleValue - Value passed to style attribute (for logic function)
 * @param {PropFlag[]} propFlags - Array of prop flags from the element
 * @returns {Object|null} Resolved style object, or null if no styles apply
 */
export function resolveStylesWithEntry(entry, tagName, styleValue, propFlags) {
  const { styled, ctx, store, colors } = entry;

  // No styled config or invalid format
  if (!styled || !Array.isArray(styled) || !styled[0]) {
    if (styleValue && typeof styleValue === 'object' && !styleValue.__unsafe) {
      return styleValue;
    }
    return null;
  }

  const [base, logic] = styled;
  let result = {};
  let hasStyles = false;

  // Step 1: Base styles for this tag
  const tagStyles = base[tagName];
  if (tagStyles) {
    hasStyles = true;
    if (isNestedSyntax(tagStyles)) {
      // Nested syntax (prop flag mode) - use 'base' key
      result = { ...tagStyles.base };
    } else {
      // Simple syntax - use the object directly
      result = { ...tagStyles };
    }
  }

  // Step 2: Shared selectors (e.g., 'h2, span': {...})
  for (const key of Object.keys(base)) {
    if (key.includes(',')) {
      const tags = key.split(',').map((t) => t.trim());
      if (tags.includes(tagName)) {
        hasStyles = true;
        result = { ...result, ...base[key] };
      }
    }
  }

  // Step 3: Prop flags (in attribute order)
  if (
    propFlags &&
    propFlags.length > 0 &&
    tagStyles &&
    isNestedSyntax(tagStyles)
  ) {
    for (const flag of propFlags) {
      if (flag.active && tagStyles[flag.name]) {
        hasStyles = true;
        result = { ...result, ...tagStyles[flag.name] };
      }
    }
  }

  // Step 4: Logic function or style passthrough
  if (logic && typeof logic[tagName] === 'function') {
    const logicResult = logic[tagName](styleValue, ctx, store);
    if (logicResult && typeof logicResult === 'object') {
      hasStyles = true;
      result = { ...result, ...logicResult };
    }
  } else if (
    styleValue &&
    typeof styleValue === 'object' &&
    !styleValue.__unsafe
  ) {
    // Passthrough when no logic function - merge inline styles
    hasStyles = true;
    result = { ...result, ...styleValue };
  }

  // Step 5: Color palette resolution
  if (colors && Object.keys(colors).length > 0) {
    result = resolveColors(result, colors);
  }

  return hasStyles ? result : null;
}

/**
 * Resolve styles for a +styled element.
 * Applies styles in order: base → shared selectors → prop flags → logic function.
 *
 * @param {HTMLElement} instance - The component instance
 * @param {string} tagName - The tag name (e.g., 'div', 'h2')
 * @param {*} styleValue - Value passed to style attribute (for logic function)
 * @param {PropFlag[]} propFlags - Array of prop flags from the element
 * @returns {Object|null} Resolved style object, or null if no styles apply
 */
export function resolveStyles(instance, tagName, styleValue, propFlags) {
  const entry = registry.get(instance);
  if (!entry) {
    // No styled config registered - passthrough inline styles if object
    if (styleValue && typeof styleValue === 'object' && !styleValue.__unsafe) {
      return styleValue;
    }
    return null;
  }

  return resolveStylesWithEntry(entry, tagName, styleValue, propFlags);
}

/**
 * Apply resolved styles to a DOM node.
 * Sets individual style properties for proper merging.
 *
 * @param {HTMLElement} node - The DOM node to style
 * @param {Object} styles - Resolved style object
 */
export function applyStylesToNode(node, styles) {
  if (!styles || typeof styles !== 'object') return;

  for (const [prop, value] of Object.entries(styles)) {
    if (value == null || value === '') {
      node.style.removeProperty(prop.replace(/([A-Z])/g, '-$1').toLowerCase());
    } else {
      // Use setProperty for kebab-case support
      const kebabProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
      node.style.setProperty(kebabProp, String(value));
    }
  }
}

/**
 * Creates a styled style handler for +styled elements.
 * Uses rendering context or DOM traversal to find the component instance.
 * @param {string} tagName - The element's tag name
 * @param {Array|null} propFlags - Static prop flags from parsing
 * @returns {Function} Style update handler
 */
export const styledStyleHandler = (tagName, propFlags) => (node, value) => {
  let instance = getRenderingInstance();

  /* c8 ignore start -- DOM traversal fallback for updates outside render context */
  if (!instance) {
    let root = node;
    while (root && !root.__hyperInstance) {
      root = root.parentElement;
    }
    instance = root?.__hyperInstance;
  }

  if (!instance) {
    if (value && typeof value === 'object' && !value.__unsafe) {
      applyStylesToNode(node, value);
    } else if (typeof value === 'string') {
      node.setAttribute('style', value);
    }
    return;
  }
  /* c8 ignore stop */

  const activeFlags = propFlags
    ? propFlags.map((f) => ({ name: f.name, active: true }))
    : null;

  const resolved = resolveStyles(instance, tagName, value, activeFlags);
  if (resolved) {
    applyStylesToNode(node, resolved);
  }
};
