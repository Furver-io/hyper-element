/**
 * @file Reserved attribute classification for +styled variant parsing.
 * Browser and SSR handlers use this shared guard so native/pass-through
 * attributes keep HTML semantics instead of being consumed as style variants.
 */

const ALWAYS_RESERVED = new Set([
  'class',
  'id',
  'role',
  'slot',
  'part',
  'title',
  'style',
  'css',
  'href',
  'src',
  'alt',
  'type',
  'value',
  'name',
  'disabled',
  'checked',
  'open',
  'hidden',
  'tabindex',
  'key',
  'ref',
]);

const SELECTED_NATIVE_TAGS = new Set(['option']);

/**
 * Determines whether an attribute must bypass +styled variant consumption.
 * Most names are reserved globally because the task requires pass-through
 * behavior for common HTML attributes. `selected` is reserved only where it is
 * native because the same task also uses `selected` as an `article+styled`
 * variant, so tag-aware handling satisfies both documented cases.
 *
 * @param {string} attrName - Attribute name from the parser or update handler.
 * @param {string} [tagName=''] - Styled element tag name.
 * @returns {boolean} True when normal DOM/SSR handling should own the attr.
 */
export function isReservedStyledAttr(attrName, tagName = '') {
  const name = String(attrName || '').toLowerCase();
  const tag = String(tagName || '').toLowerCase();
  if (!name) return false;
  if (name.startsWith('data-') || name.startsWith('aria-')) return true;
  if (name.startsWith('on') || name.startsWith('@')) return true;
  if (name === 'selected') return SELECTED_NATIVE_TAGS.has(tag);
  return ALWAYS_RESERVED.has(name);
}
