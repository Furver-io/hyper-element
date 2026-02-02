/**
 * @file SSR string-based update handlers.
 * String equivalents of render/update.js for server-side rendering.
 * These handlers return values/strings instead of mutating DOM nodes.
 */

import {
  ATTRIBUTE,
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
  COMMENT_TYPE,
  TEXT_TYPE,
} from '../render/constants.js';
import { escapeHtml } from '../utils/escape.js';

/**
 * Converts a style object to a CSS string.
 * @param {Object} styleObj - Style object with camelCase or kebab-case keys
 * @returns {string} CSS string like "color: red; font-size: 12px"
 */
function styleObjectToString(styleObj) {
  if (!styleObj || typeof styleObj !== 'object') return '';
  return Object.entries(styleObj)
    .filter(([, value]) => value != null)
    .map(([prop, value]) => {
      // Convert camelCase to kebab-case
      const kebabProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${kebabProp}: ${value}`;
    })
    .join('; ');
}

/**
 * Creates an SSR attribute handler.
 * Returns the value to be set on the attribute.
 * @param {string} _name - Attribute name (unused, for API compatibility)
 * @returns {Function} Handler that returns escaped attribute value
 */
const stringAttribute = (_name) => (value) => {
  if (value == null) return null;
  return escapeHtml(String(value));
};

/**
 * SSR style handler - converts objects to string, passes strings through.
 * @param {string|Object|null} value - Style string or object
 * @returns {string|null} CSS string or null
 */
const stringStyle = (value) => {
  if (value == null) return null;
  if (typeof value === 'object') {
    return styleObjectToString(value);
  }
  return escapeHtml(String(value));
};

/**
 * SSR toggle handler - returns true for presence, null for absence.
 * @param {string} _name - Attribute name (unused, for API compatibility)
 * @returns {Function} Handler that returns boolean or null
 */
const stringToggle = (_name) => (value) => {
  return value ? true : null;
};

/**
 * SSR event handler - no-op, events are stripped in SSR.
 * @returns {Function} Handler that returns null
 */
const stringEvent = () => () => null;

/**
 * SSR direct property handler - no-op, properties don't exist in HTML strings.
 * @returns {Function} Handler that returns null
 */
const stringDirect = () => () => null;

/**
 * SSR data-* attributes handler.
 * @param {Object} values - Key-value pairs for data attributes
 * @returns {Object} Object with data-* keys and escaped values
 */
const stringData = (values) => {
  if (!values || typeof values !== 'object') return {};
  const result = {};
  for (const [key, value] of Object.entries(values)) {
    if (value != null) {
      result[`data-${key}`] = escapeHtml(String(value));
    }
  }
  return result;
};

/**
 * SSR comment/interpolation handler - escapes and returns value.
 * @param {unknown} value - Value to interpolate
 * @returns {string} Escaped string value
 */
const stringComment = (value) => {
  if (value == null) return '';
  if (typeof value === 'object' && value.__unsafe) {
    return value.value; // Raw HTML, no escaping
  }
  return escapeHtml(String(value));
};

/**
 * SSR array handler - joins array items as strings.
 * @param {Array} value - Array of values
 * @returns {string} Joined string
 */
const stringCommentArray = (value) => {
  if (!Array.isArray(value)) return stringComment(value);
  return value
    .map((item) => {
      if (item == null) return '';
      if (typeof item === 'object' && item.__unsafe) {
        return item.value;
      }
      // Numbers and strings get escaped
      if (typeof item === 'string' || typeof item === 'number') {
        return escapeHtml(String(item));
      }
      // Objects with toString (like Hole results)
      return String(item);
    })
    .join('');
};

/**
 * SSR unsafe/raw HTML handler - passes through without escaping.
 * @param {unknown} value - Value with __unsafe marker
 * @returns {string} Raw HTML string
 */
const stringUnsafe = (value) => {
  if (value && typeof value === 'object' && value.__unsafe) {
    return value.value;
  }
  return String(value ?? '');
};

/**
 * SSR text content handler.
 * @param {unknown} value - Text content
 * @returns {string} Escaped text
 */
const stringText = (value) => {
  if (value == null) return '';
  return escapeHtml(String(value));
};

/**
 * Main SSR update factory - creates the right handler based on type and name.
 * Returns [path, handler, type, attrName] tuple.
 * The 4th element (attrName) is included for attribute/toggle updates.
 * @param {Object} node - Parser node
 * @param {number} type - ATTRIBUTE_TYPE, COMMENT_TYPE, or TEXT_TYPE
 * @param {number[]} path - Path to node (used for tree walking)
 * @param {string} name - Attribute name
 * @param {unknown} hint - The interpolated value (for type detection)
 * @returns {[number[], Function, number, string|null]}
 */
export function ssrUpdate(node, type, path, name, hint) {
  switch (type) {
    case COMMENT_TYPE: {
      if (Array.isArray(hint))
        return [path, stringCommentArray, COMMENT_ARRAY, null];
      if (hint && typeof hint === 'object' && hint.__unsafe) {
        return [path, stringUnsafe, UNSAFE, null];
      }
      return [path, stringComment, COMMENT, null];
    }
    case TEXT_TYPE: {
      return [path, stringText, TEXT, null];
    }
    case ATTRIBUTE_TYPE: {
      switch (name.charAt(0)) {
        case '@': {
          // Event listener - ignored in SSR
          const array = Array.isArray(hint);
          return [path, stringEvent(), array ? EVENT_ARRAY : EVENT, null];
        }
        case '?': {
          // Boolean toggle - store actual attribute name (without ?)
          const attrName = name.slice(1);
          return [path, stringToggle(attrName), TOGGLE, attrName];
        }
        case '.': {
          // Direct property - ignored in SSR
          if (name === '...') {
            // Spread - convert to attributes
            return [
              path,
              (values) => {
                const result = {};
                for (const [n, v] of Object.entries(values || {})) {
                  if (v != null) result[n] = escapeHtml(String(v));
                }
                return result;
              },
              PROP,
              null,
            ];
          }
          return [path, stringDirect(), DIRECT, null];
        }
        default: {
          // Standard attributes
          if (name === 'data' && !/^object$/i.test(node.name)) {
            return [path, stringData, DATA, 'data'];
          }
          if (name === 'key') {
            // Key is for diffing, strip in SSR output
            return [path, () => null, KEY, null];
          }
          if (name === 'ref') {
            // Ref is for DOM access, ignored in SSR
            return [path, stringDirect(), DIRECT, null];
          }
          if (name.startsWith('on')) {
            // Inline event handlers - ignored in SSR
            return [path, stringDirect(), DIRECT, null];
          }
          if (name === 'style') {
            return [path, stringStyle, ATTRIBUTE, 'style'];
          }
          return [path, stringAttribute(name), ATTRIBUTE, name];
        }
      }
    }
  }
}

export {
  stringAttribute,
  stringStyle,
  stringToggle,
  stringEvent,
  stringDirect,
  stringData,
  stringComment,
  stringCommentArray,
  stringUnsafe,
  stringText,
  styleObjectToString,
};
