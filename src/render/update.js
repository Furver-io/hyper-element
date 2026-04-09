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
  children,
} from './constants.js';
import { createFragment } from './creator.js';
import { diff } from './diff.js';
import {
  diffFragment,
  nodes,
  PersistentFragment,
} from './persistent-fragment.js';
import { styledStyleHandler } from '../styled/handler.js';

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

// WeakMap for caching text nodes
const textCache = new WeakMap();

/**
 * Gets or creates a text node for a reference.
 * @param {object} ref - Reference object for caching
 * @param {string} value - Text value
 * @returns {Text} Text node
 */
const getText = (ref, value) => {
  let node = textCache.get(ref);
  if (node) {
    node.data = value;
  } else {
    textCache.set(ref, (node = document.createTextNode(value)));
  }
  return node;
};

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
const direct = (name) => (node, value) => {
  node[name] = value;
};

/**
 * Toggles a boolean attribute.
 * @param {string} name - Attribute name
 * @returns {Function} Toggle update function
 */
const toggle = (name) => (node, value) => {
  node.toggleAttribute(name, !!value);
};

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
const cssKebab = (prop) =>
  prop.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

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
 * @param {string} type - Event type
 * @param {symbol} at - Property key for storing listener
 * @param {boolean} array - Whether value is [handler, options] array
 * @returns {Function} Event update function
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
        if (prev) node.removeEventListener(type, prev);
        if (value) node.addEventListener(type, value);
        node[at] = value;
      };

/**
 * Converts array items to DOM nodes for diffing.
 * @param {Array} arr - Array of values
 * @param {boolean} xml - Whether in SVG/XML context
 * @returns {Array} Array of DOM nodes
 */
const toNodes = (arr, xml) =>
  arr.map((item) =>
    typeof item === 'string' || typeof item === 'number'
      ? document.createTextNode(String(item))
      : item && typeof item === 'object' && item.__unsafe
        ? PersistentFragment(createFragment(item.value, xml))
        : item
  );

/**
 * Creates an array update handler.
 * @param {boolean} xml - Whether in SVG/XML context
 * @returns {Function} Array update function
 */
const commentArrayFactory = (xml) => (node, value) => {
  // Convert strings/numbers to text nodes, handle __unsafe objects
  const nodeValue = toNodes(value, xml);
  node[nodes] = diff(node[nodes] || children, nodeValue, diffFragment, node);
};

/**
 * Helper to replace a comment node with new content.
 * @param {Node} node - Comment node placeholder
 * @param {unknown} value - Value to render
 */
const replaceComment = (node, value) => {
  const current =
    typeof value === 'object' ? (value ?? node) : getText(node, value);
  const prev = node[nodes] ?? node;
  if (current !== prev) {
    prev.replaceWith(diffFragment((node[nodes] = current), 1));
  }
};

/**
 * Creates a single node interpolation handler.
 * @param {boolean} xml - Whether this is SVG context
 */
const commentHoleFactory = (xml) => (node, value) => {
  // Handle __unsafe objects - render as raw HTML
  if (value && typeof value === 'object' && value.__unsafe) {
    const html = value.value;
    const prev = node[ref] ?? (node[ref] = {});
    if (prev.v !== html) {
      prev.f = PersistentFragment(createFragment(html, xml));
      prev.v = html;
    }
    value = prev.f;
  }
  replaceComment(node, value);
};

/**
 * Updates unsafe/raw HTML content.
 * @param {boolean} xml - Whether in XML mode
 * @returns {Function} Unsafe content update function
 */
const commentUnsafe = (xml) => (node, value) => {
  // Extract actual HTML from unsafe wrapper
  const html =
    value && typeof value === 'object' && value.__unsafe ? value.value : value;
  const prev = node[ref] ?? (node[ref] = {});
  if (prev.v !== html) {
    prev.f = PersistentFragment(createFragment(html, xml));
    prev.v = html;
  }
  replaceComment(node, prev.f);
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
          return [path, attribute(name), ATTRIBUTE];
        }
      }
    }
  }
}
