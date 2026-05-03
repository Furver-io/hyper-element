/**
 * @file Update handlers for different interpolation types.
 * Creates specialized update functions based on attribute names and value types.
 */

import {
  ATTRIBUTE,
  ATTRIBUTE_TEMPLATE,
  COMMENT,
  COMMENT_ARRAY,
  DATA,
  DIRECT,
  EVENT,
  EVENT_ARRAY,
  KEY,
  PROP,
  TEXT,
  TOGGLE,
  UNSAFE,
  ATTRIBUTE_TYPE,
  ATTRIBUTE_TEMPLATE_TYPE,
  COMMENT_TYPE,
  TEXT_TYPE,
} from './constants.js';
import {
  commentArrayFactory,
  commentHoleFactory,
  commentUnsafe,
} from './comment.js';
import {
  styledAttributeHandler,
  styledCssHandler,
  styledStyleHandler,
} from '../styled/handler.js';

/** @type {symbol} */
export const ref = Symbol('ref');

// Track if current template has a key
let k = false;

/**
 * Returns whether the current template is keyed.
 */
export function isKeyed() {
  const wasKeyed = k;
  k = false;
  return wasKeyed;
}

// WeakMap for caching direct property handlers
const directRefs = new Map();

/**
 * Gets a cached direct property handler.
 * @param {string|symbol} name - Property name
 * @returns {Function} Property setter function
 */
const directFor = (name) => {
  let fn = directRefs.get(name);
  if (!fn) directRefs.set(name, (fn = direct(name)));
  return fn;
};

/**
 * Creates an attribute setter.
 * @param {string} name - Attribute name
 * @returns {Function} Attribute update function
 */
const attribute = (name) => (node, value) => {
  value == null ? node.removeAttribute(name) : node.setAttribute(name, value);
};

/**
 * Creates a direct property setter.
 * @param {string|symbol} name - Property name
 * @returns {Function} Property update function
 */
const direct = (name) => (node, value) => (node[name] = value);

/**
 * Toggles a boolean attribute.
 * @param {string} name - Attribute name
 * @returns {Function} Toggle update function
 */
const toggle = (name) => (node, value) => node.toggleAttribute(name, !!value);

/**
 * Updates data-* attributes.
 * @param {HTMLElement} element - Element with dataset
 * @param {Object} values - Key-value pairs to set
 */
const data = ({ dataset }, values) => {
  for (const [key, value] of Object.entries(values))
    value == null ? delete dataset[key] : (dataset[key] = value);
};

const templateState = new WeakMap(); // Partial interpolation state: node -> Map(name -> state)

/**
 * Partial interpolation handler - accumulates hole values, applies when complete.
 * @param {string} name - Attribute name
 * @param {string[]} parts - Static parts between holes
 * @param {number} holeIndex - This handler's hole index
 * @param {number} holeCount - Total holes in this attribute
 * @returns {Function} Handler that accumulates value and applies when complete
 */
const attributeTemplate =
  (name, parts, holeIndex, holeCount) => (node, value) => {
    let nodeState = templateState.get(node);
    if (!nodeState) templateState.set(node, (nodeState = new Map()));
    let s = nodeState.get(name);
    if (!s)
      nodeState.set(
        name,
        (s = { values: new Array(holeCount), remaining: holeCount })
      );
    s.values[holeIndex] = value;
    if (--s.remaining === 0) {
      let result = parts[0];
      for (let i = 0; i < holeCount; i++)
        result += (s.values[i] ?? '') + parts[i + 1];
      result === ''
        ? node.removeAttribute(name)
        : node.setAttribute(name, result);
      s.remaining = holeCount; // Reset for next render
    }
  };

/**
 * Converts a JS-style camelCase CSS property name to its kebab-case
 * CSS form (e.g. `borderRadius` → `border-radius`, `WebkitTransform`
 * → `-webkit-transform`). The CSSOM `setProperty()` / `removeProperty()`
 * methods require kebab-case and SILENTLY IGNORE camelCase input — so
 * a template like `style=${{ borderRadius: '12px' }}` would otherwise
 * never paint. Vendor prefixes (leading uppercase letter) get a leading
 * hyphen so `WebkitTransform` becomes `-webkit-transform` per spec.
 *
 * @param {string} prop - JS camelCase or already-kebab CSS property
 * @returns {string} kebab-case CSS property
 */
const cssKebab = (prop) => prop.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

/**
 * Updates style attribute - handles both strings and objects.
 * Object keys may be camelCase (`borderRadius`) or kebab-case
 * (`border-radius`); both forms are normalized via cssKebab() before
 * being handed to the CSSOM, because `setProperty()` does not
 * auto-convert camelCase and silently no-ops on unrecognized names.
 *
 * @param {HTMLElement} node - Target element
 * @param {string|Object|null} value - Style string or object
 */
const styleHandler = (node, value) => {
  if (value == null) node.removeAttribute('style');
  else if (typeof value === 'object') {
    for (const [prop, val] of Object.entries(value)) {
      const cssProp = cssKebab(prop);
      val == null
        ? node.style.removeProperty(cssProp)
        : node.style.setProperty(cssProp, val);
    }
  } else node.setAttribute('style', value);
};

/**
 * Creates an event listener handler.
 *
 * Identity short-circuit (`prev === value`): when the previously
 * bound listener reference is being reassigned unchanged, the
 * remove/add cycle is skipped entirely. Applied to the single-slot
 * variant (the overwhelmingly common case for `@click=${fn}` /
 * `onclick=${fn}` bindings); the `[handler, options]` array
 * variant intentionally does not add a second guard at this layer
 * because freshly-allocated tuples defeat an array-identity check
 * anyway, and `Hole.update()` already short-circuits on tuple
 * identity one level up (see "defensive redundancy" below).
 *
 * Defensive redundancy with Hole.update(): the primary render-loop
 * caller already avoids calling this update function in most
 * same-identity scenarios. `src/render/hole.js` (Hole.update,
 * approx. line 205) contains `if (value !== prev) update(...)` —
 * the per-slot `prev` stored in `entry[2]` is the most recent
 * value seen on the previous render, and if the hole re-evaluates
 * to the same reference the update factory is not invoked at all.
 * The guard added here therefore serves two narrower purposes:
 *   1. Alternative render paths that bypass Hole.update (direct
 *      update invocation, custom renderers, SSR replay hooks)
 *      still benefit from the skip at this layer.
 *   2. It makes the invariant explicit at the function that wires
 *      DOM listeners, rather than relying entirely on an upstream
 *      caller to enforce it.
 *
 * Freshly-allocated inline handlers (e.g. `onclick=${() => …}`
 * recreated each render) still rebind as before because their
 * identity changes per render — the old listener is removed and
 * the new one added in a single pass, preserving the
 * "swap, never stack" invariant the rest of the engine depends on.
 *
 * Branch-level guards inside the returned closures:
 *   - `prev?.length` (array variant): truthy only when `prev` is
 *     a non-empty tuple, handling both the first-render case
 *     (prev === undefined) and the degenerate empty-tuple case
 *     (prev === []) without a `removeEventListener` call.
 *   - `if (prev)` (single variant): same intent, simpler shape
 *     because `prev` is either a function or a nullish placeholder.
 *   - `if (value)` (both variants): a template hole that resolves
 *     to null/undefined/false is treated as "unbind" — a single
 *     truthy branch handles that without explicit null testing.
 *
 * @param {string} type - Event type
 * @param {symbol} at - Per-slot symbol used to store the previously
 *                       bound listener on the DOM node. Each event
 *                       binding site in the parsed template gets
 *                       its own symbol so sibling handlers for the
 *                       same event type do not collide.
 * @param {boolean} array - Whether value is a `[handler, options]`
 *                           array rather than a bare handler.
 * @returns {Function} Event update function with signature
 *                      `(node, value) => void` that binds, rebinds,
 *                      or unbinds the listener in place.
 */
const event = (type, at, array) =>
  array
    ? (node, value) => {
        const prev = node[at];
        if (prev?.length) node.removeEventListener(type, ...prev);
        if (value) node.addEventListener(type, ...value);
        node[at] = value;
      }
    : (node, value) => {
        const prev = node[at];
        if (prev === value) return;
        if (prev) node.removeEventListener(type, prev);
        if (value) node.addEventListener(type, value);
        node[at] = value;
      };

/**
 * Main update factory - creates the right handler based on type and name.
 * @param {Object} node - Parser node
 * @param {number} type - ATTRIBUTE_TYPE, COMMENT_TYPE, or TEXT_TYPE
 * @param {number[]} path - Path to node
 * @param {string} name - Attribute name
 * @param {unknown} hint - The interpolated value (for type detection)
 * @returns {[number[], Function, number]}
 */
export function update(node, type, path, name, hint) {
  switch (type) {
    case ATTRIBUTE_TEMPLATE_TYPE: {
      // Partial interpolation - hint contains { parts, holeIndex, holeCount }
      const { parts, holeIndex, holeCount } = hint;
      return [
        path,
        attributeTemplate(name, parts, holeIndex, holeCount),
        ATTRIBUTE_TEMPLATE,
      ];
    }
    case COMMENT_TYPE: {
      if (Array.isArray(hint))
        return [path, commentArrayFactory(node.xml), COMMENT_ARRAY];
      if (hint && typeof hint === 'object' && hint.__unsafe) {
        return [path, commentUnsafe(node.xml), UNSAFE];
      }
      return [path, commentHoleFactory(node.xml), COMMENT];
    }
    case TEXT_TYPE: {
      return [path, directFor('textContent'), TEXT];
    }
    case ATTRIBUTE_TYPE: {
      switch (name.charAt(0)) {
        case '@': {
          // Event listener
          const array = Array.isArray(hint);
          return [
            path,
            event(name.slice(1), Symbol(name), array),
            array ? EVENT_ARRAY : EVENT,
          ];
        }
        case '?': {
          // Boolean toggle
          return [path, toggle(name.slice(1)), TOGGLE];
        }
        case '.': {
          // Direct property
          if (name === '...') {
            // Spread operator
            return [
              path,
              (node, values) => {
                for (const [n, v] of Object.entries(values))
                  attribute(n)(node, v);
              },
              PROP,
            ];
          }
          return [path, direct(name.slice(1)), DIRECT];
        }
        default: {
          // Standard attributes
          if (name === 'data' && !/^object$/i.test(node.name)) {
            return [path, data, DATA];
          }
          if (name === 'key') {
            k = true;
            return [path, true, KEY];
          }
          if (name === 'ref') {
            return [path, directFor(ref), DIRECT];
          }
          if (name.startsWith('on')) {
            return [path, directFor(name.toLowerCase()), DIRECT];
          }
          if (name === 'style') {
            // Special handling for style - supports both strings and objects
            // Use styled handler for +styled elements
            if (node.isStyled) {
              return [
                path,
                styledStyleHandler(node.name, node.propFlags),
                ATTRIBUTE,
              ];
            }
            return [path, styleHandler, ATTRIBUTE];
          }
          if (name === 'css' && node.isStyled) {
            return [
              path,
              styledCssHandler(node.name, node.propFlags),
              ATTRIBUTE,
            ];
          }
          if (node.isStyled) {
            return [
              path,
              styledAttributeHandler(name, node.name, attribute(name)),
              ATTRIBUTE,
            ];
          }
          return [path, attribute(name), ATTRIBUTE];
        }
      }
    }
  }
}
