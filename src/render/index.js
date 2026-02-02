/**
 * @file Public API for the render core.
 * Exports: html, bind, wire
 */

import { createFragment } from './creator.js';
import { createParser } from './parser.js';
import { update, isKeyed } from './update.js';
import { Hole, dom } from './hole.js';
import { Keyed } from './keyed.js';

// Create parser with update handler
const _parseTemplate = createParser(update);

// WeakMap for caching bound render functions
const rendered = new WeakMap();

// WeakMap for wire() caching - maps objects to Map<id, {hole, template}>
const wireCache = new WeakMap();

// Template cache for html function
const _htmlCache = new WeakMap();

/**
 * HTML tagged template function.
 * SVG namespacing is handled automatically by the HTML parser
 * when it encounters <svg> tags.
 * @example
 * html`<div class=${cls}>${content}</div>`
 * html`<svg><circle cx=${x} cy=${y} r=${r}/></svg>`
 */
export function html(template, ...values) {
  let parsed = _htmlCache.get(template);
  if (!parsed) {
    // Parse and cache template (xml=false, auto-detected inside <svg>)
    parsed = _parseTemplate(template, values, false);
    // Add keyed tracker if template uses key attribute
    parsed.push(isKeyed() ? new Keyed() : null);
    // Convert abstract tree to DOM fragment
    parsed[0] = createFragment(parsed[0].toString());
    _htmlCache.set(template, parsed);
  }
  return new Hole(parsed, values);
}

/**
 * Binds an html function to an element for rendering.
 * @param {Element} element - The element to render into
 * @returns {Function} Bound html function that renders into the element
 */
export function bind(element) {
  return (template, ...values) => {
    const hole = html(template, ...values);
    const known = rendered.get(element);

    if (!known || known.t !== hole.t) {
      // New template - full replace
      const d = dom(hole);
      element.replaceChildren(d);
      rendered.set(element, hole);
    } else {
      // Same template - update in place
      known.update(hole);
    }
    return element;
  };
}

/**
 * Creates a wired template bound to an object for keyed caching.
 * @param {object} obj - The object to bind to
 * @param {string} [id=''] - Optional ID for multiple templates per object
 * @returns {Function} Tagged template function
 */
export function wire(obj, id = '') {
  let cache = wireCache.get(obj);
  if (!cache) {
    cache = new Map();
    wireCache.set(obj, cache);
  }

  return (template, ...values) => {
    let entry = cache.get(id);
    // Compare template strings array identity (not parsed template)
    if (!entry || entry.tpl !== template) {
      // Create new hole and store both the hole and raw template
      const hole = html(template, ...values);
      entry = { hole, tpl: template };
      cache.set(id, entry);
      return hole;
    }
    // Update existing - create new hole with same parsed template
    return new Hole(entry.hole.t, values);
  };
}

// Re-export Hole for instanceof checks
export { Hole };

// Re-export dom helper
export { dom };
