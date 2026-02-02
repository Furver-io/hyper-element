/**
 * @file DOM fragment creator.
 * Creates DOM fragments from HTML strings using template element.
 */

// Lazy-initialized to support server-side environments
let _creatorTpl = null;

/**
 * Creates a DocumentFragment from an HTML string.
 * Uses template.innerHTML - SVG namespacing is handled automatically
 * by the HTML parser when it encounters <svg> tags.
 * @param {string} content - The HTML string to parse
 * @returns {DocumentFragment} The parsed fragment
 */
export function createFragment(content) {
  if (!_creatorTpl) {
    _creatorTpl = document.createElement('template');
  }
  _creatorTpl.innerHTML = content;
  const fragment = _creatorTpl.content;
  _creatorTpl = _creatorTpl.cloneNode(false);
  return fragment;
}
