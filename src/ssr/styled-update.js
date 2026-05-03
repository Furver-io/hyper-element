/**
 * @file SSR update handlers for +styled attributes.
 * These handlers record style, css, and variant inputs on parsed SSR nodes so
 * final serialization can resolve one shared browser/SSR styled artifact.
 */

import { serializeInlineDeclarations } from '../styled/serializer.js';
import { isReservedStyledAttr } from '../styled/reserved.js';

/**
 * Converts a style object to an inline CSS string for selector-free SSR paths.
 *
 * @param {Object} styleObj - Style object to serialize.
 * @returns {string} Inline CSS declaration text.
 */
export function styleObjectToString(styleObj) {
  if (!styleObj || typeof styleObj !== 'object') return '';
  return serializeInlineDeclarations(styleObj);
}

/**
 * Creates an SSR style=${...} handler for +styled nodes.
 *
 * @param {string} tagName - Styled tag name.
 * @param {Array|null} propFlags - Static prop flags from parsing.
 * @param {Function} _stringStyle - Native style fallback serializer.
 * @returns {Function} Handler that records styled state.
 */
export const stringStyledStyle =
  (tagName, propFlags, _stringStyle) => (value, node) => {
    node._styledState = node._styledState || {};
    node._styledState.styleValue = value;
    node._styledState.tagName = tagName;
    node._styledState.propFlags = propFlags || [];
    node._styledState.dynamicFlags = node._styledState.dynamicFlags || {};
    return null;
  };

/**
 * SSR css=${...} handler for +styled nodes.
 *
 * @param {string} tagName - Styled tag name.
 * @param {Array|null} propFlags - Static prop flags from parsing.
 * @returns {Function} Handler that suppresses the css attribute.
 */
export const stringStyledCss = (tagName, propFlags) => (value, node) => {
  if (node) {
    node._styledState = node._styledState || {};
    node._styledState.cssOverride = value;
    node._styledState.tagName = tagName;
    node._styledState.propFlags = propFlags || [];
    node._styledState.dynamicFlags = node._styledState.dynamicFlags || {};
  }
  return null;
};

/**
 * Detects whether a dynamic SSR attribute is a known variant for the current
 * styled tag. Known variants are consumed and kept out of the HTML output.
 *
 * @param {Object|null} context - Current SSR context.
 * @param {string} tagName - Styled tag name.
 * @param {string} attrName - Attribute name.
 * @returns {boolean} True when the attribute is a style variant.
 */
function isKnownVariant(context, tagName, attrName) {
  if (isReservedStyledAttr(attrName, tagName)) return false;
  const base = Array.isArray(context?.styled) ? context.styled[0] : null;
  const tagStyles = base?.[tagName];
  return !!(
    tagStyles &&
    typeof tagStyles === 'object' &&
    tagStyles.base &&
    tagStyles[attrName] &&
    typeof tagStyles[attrName] === 'object'
  );
}

/**
 * Styled-aware SSR attribute handler. Dynamic attributes matching variants are
 * recorded for final artifact resolution; everything else uses normal escaping.
 *
 * @param {string} attrName - Attribute name.
 * @param {string} tagName - Styled tag name.
 * @param {Object|null} context - Current SSR context.
 * @param {Function} normalHandler - Normal attribute serializer.
 * @returns {Function} SSR attribute handler.
 */
export const stringStyledAttribute =
  (attrName, tagName, context, normalHandler) => (value, node) => {
    if (isKnownVariant(context, tagName, attrName)) {
      if (node) {
        node._styledState = node._styledState || {};
        node._styledState.dynamicFlags = node._styledState.dynamicFlags || {};
        node._styledState.dynamicFlags[attrName] = !!value;
        node._styledState.tagName = tagName;
      }
      return null;
    }
    return normalHandler(value);
  };
