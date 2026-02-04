/**
 * @file Parser integration hooks for +styled detection.
 * @module hyper-element/styled/parser-hooks
 */

/**
 * Suffix that marks an element as styled.
 * @constant {string}
 */
export const STYLED_SUFFIX = '+styled';

/**
 * Reserved attribute names that cannot be prop flags.
 * @constant {Set<string>}
 */
const RESERVED_ATTRS = new Set([
  'style',
  'class',
  'id',
  'role',
  'slot',
  'is',
  'part',
]);

/* Public API utilities for external consumers */
/**
 * Check if a tag name has the +styled suffix.
 * @param {string} tag - The tag name to check
 * @returns {{ isStyled: boolean, tagName: string }} Result with cleaned tag name
 */
export function detectStyledSuffix(tag) {
  const lowerTag = tag.toLowerCase();
  if (lowerTag.endsWith(STYLED_SUFFIX.toLowerCase())) {
    return {
      isStyled: true,
      tagName: tag.slice(0, -STYLED_SUFFIX.length),
    };
  }
  return { isStyled: false, tagName: tag };
}

/**
 * Check if an attribute name can be a prop flag.
 * Excludes reserved attributes and data-/aria- prefixes.
 * @param {string} attrName - The attribute name to check
 * @returns {boolean} True if valid as a prop flag
 */
export function isValidPropFlag(attrName) {
  if (RESERVED_ATTRS.has(attrName.toLowerCase())) return false;
  if (attrName.startsWith('data-')) return false;
  if (attrName.startsWith('aria-')) return false;
  if (attrName.startsWith('on')) return false;
  if (attrName.startsWith('@')) return false;
  if (attrName.startsWith('.')) return false;
  if (attrName.startsWith('?')) return false;
  return true;
}
