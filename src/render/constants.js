/**
 * @file Type flags for update operations.
 * Each flag represents a different type of DOM update.
 */

// Update type bitflags
export const ARRAY = 1 << 0; // Array of values
export const ATTRIBUTE = 1 << 1; // Standard attribute
export const COMMENT = 1 << 2; // Node interpolation (comment placeholder)
export const DATA = 1 << 3; // data-* attributes
export const DIRECT = 1 << 4; // Direct property assignment
export const EVENT = 1 << 5; // Internal render-core event listener
export const KEY = 1 << 6; // Key attribute for keying
export const PROP = 1 << 7; // Internal render-core direct property
export const TEXT = 1 << 8; // Text content (textContent)
export const TOGGLE = 1 << 9; // Internal render-core boolean toggle
export const UNSAFE = 1 << 10; // Raw HTML (innerHTML)
export const ATTRIBUTE_TEMPLATE = 1 << 11; // Partial interpolation ("prefix-${x}")

// Parser node types (from ish.js pattern)
export const ELEMENT = 1;
export const ATTRIBUTE_TYPE = 2;
export const TEXT_TYPE = 3;
export const COMMENT_TYPE = 8;
export const FRAGMENT = 11;
export const ATTRIBUTE_TEMPLATE_TYPE = 12; // Partial interpolation type

// Combined flags for common patterns
export const COMMENT_ARRAY = COMMENT | ARRAY;
export const EVENT_ARRAY = EVENT | ARRAY;

// Element sets for special handling
export const TEXT_ELEMENTS = new Set([
  'plaintext',
  'script',
  'style',
  'textarea',
  'title',
  'xmp',
]);

export const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'keygen',
  'link',
  'menuitem',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

// Frozen empty arrays/objects for memory efficiency
export const children = Object.freeze([]);
export const props = Object.freeze({});
