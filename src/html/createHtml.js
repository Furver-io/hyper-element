/**
 * @file Html function factory for render core binding.
 * Creates the Html tagged template function with shared attribute handling.
 */

import { makeid } from '../utils/makeid.js';
import { sharedAttrs } from '../core/manager.js';
import { isCustomTag } from '../core/constants.js';
import { safeHtml, isSafeHtml } from '../utils/escape.js';
import { hasEachBlocks, transformEachBlocks } from './parseEachBlocks.js';
import { bind, wire, html, Hole, dom } from '../render/index.js';

/**
 * Tagged template literal function for rendering HTML content.
 * @typedef {Object} HtmlFunction
 * @property {Function} wire - Create wired template bound to an object
 * @property {Function} [template] - Template function when template attribute is used
 */

/**
 * Creates the Html tagged template function for an element.
 * Handles passing non-string values to child custom elements via shared attributes.
 *
 * @param {HTMLElement} shadow - The element's shadow/content root
 * @returns {HtmlFunction} The Html template function
 */
export function createHtml(shadow) {
  const boundRender = bind(shadow);

  /**
   * Html tagged template function for rendering content.
   * Intercepts non-string values passed to custom elements and stores them for retrieval.
   *
   * @param {...any} args - Tagged template arguments (strings array + values)
   * @returns {any} Result of render
   */
  function Html(...args) {
    // Transform {+each}...{-each} blocks to Html.wire() calls
    if (hasEachBlocks(args[0])) {
      const transformed = transformEachBlocks(
        args[0],
        args.slice(1),
        Html.wire
      );
      args = [transformed.strings, ...transformed.values];
    }

    const hasNonString = args
      .slice(1)
      .some((item) => item != null && typeof item !== 'string');
    const hasCustomTag = args[0].some((t) => isCustomTag.test(t));

    if (hasNonString && hasCustomTag) {
      let inCustomTag = false;
      let localName = '';
      args[0].forEach((item, index, _items) => {
        if (isCustomTag.test(item)) {
          inCustomTag =
            -1 === item.substring(item.match(isCustomTag).index).indexOf('>');
          localName =
            inCustomTag &&
            item
              .substring(item.indexOf(item.match(isCustomTag)))
              .split(/\s/)[0]
              .substr(1);
        } else if (0 <= item.indexOf('>')) {
          inCustomTag = false;
          localName = '';
        }

        if (!inCustomTag) {
          return;
        }
        const val = args[index + 1];

        // Child custom elements need sharedAttrs for every non-string value so
        // attachAttrs can recover booleans, numbers, objects, and callbacks with
        // their original types. Boolean `?attr=${...}` toggles are the exception:
        // those belong to the render core and must receive the primitive value
        // directly so `false` removes the boolean attribute instead of becoming a
        // truthy placeholder string.
        if (val != null && typeof val !== 'string') {
          const attrName = item.split(/\s/).pop().slice(0, -1);
          if (attrName[0] === '?') {
            return;
          }
          if (
            localName === 'hyper-layout' &&
            (attrName === 'onchange' || attrName === 'onremoved')
          ) {
            return;
          }
          if ('on' === attrName.substring(0, 2)) {
            throw new Error(
              `'on' is reserve for native elements. Change: "${attrName}" for "${localName}" to something else`
            );
          }
          // Don't intercept style - let render core handle it natively
          if ('style' === attrName) {
            return;
          }
          const id = makeid();
          sharedAttrs[id] = { attrName, val, localName };
          args[index + 1] = ('function' === typeof val ? 'fn-' : 'ob-') + id;
        }
      });
    }

    // Process values - handle fragments, safeHtml markers, and escape array strings
    const processedArgs = [args[0]];
    for (let i = 1; i < args.length; i++) {
      let val = args[i];

      // Check for fragment call: { FragmentName: data }
      if (
        val &&
        typeof val === 'object' &&
        !Array.isArray(val) &&
        !isSafeHtml(val)
      ) {
        const keys = Object.keys(val);
        if (keys.length === 1 && /^[A-Z]/.test(keys[0])) {
          const fragmentName = keys[0];
          const fragmentData = val[fragmentName];
          // Look up fragment in Html._fragments
          if (Html._fragments && Html._fragments[fragmentName]) {
            val = Html._fragments[fragmentName](fragmentData);
          }
        }
      }

      if (isSafeHtml(val)) {
        // Safe HTML (Html.raw()) - mark as unsafe for render core
        processedArgs.push({ __unsafe: true, value: val.value });
      } else if (val && typeof val === 'object' && val.__unsafe) {
        // Already marked as unsafe
        processedArgs.push(val);
      } else if (val && typeof val === 'object' && val.html !== undefined) {
        // Handle { html: string } from {+if}/{+else} blocks
        processedArgs.push({ __unsafe: true, value: val.html });
      } else if (Array.isArray(val)) {
        // Arrays - process each item
        // Note: String items don't need manual escaping - the render core creates
        // text nodes which the browser automatically escapes in innerHTML
        processedArgs.push(
          val.map((item) => {
            if (isSafeHtml(item)) {
              return { __unsafe: true, value: item.value };
            }
            return item;
          })
        );
      } else {
        // Other values pass through unchanged
        processedArgs.push(val);
      }
    }

    return boundRender(...processedArgs);
  }

  // Placeholder for fragments - will be set by connectedCallback
  Html._fragments = null;

  /**
   * Creates a wired template bound to an object.
   * @param {object} obj - Object to bind to
   * @param {string} [id=''] - Optional ID for multiple templates
   * @returns {Function} Tagged template function
   */
  Html.wire = function wireTemplate(obj, id = '') {
    return wire(obj, id);
  };

  /**
   * Marks a string as safe HTML that should not be escaped.
   * Use with caution - only for trusted HTML content.
   * @param {string} html - The HTML string to mark as safe
   * @returns {Object} An object with the safe HTML and marker symbol
   */
  Html.raw = function raw(htmlStr) {
    return safeHtml(htmlStr);
  };

  /**
   * Lightweight template function.
   * Can be used two ways:
   * 1. Html.lite(element)`template` - bind to an element (like bind())
   * 2. Html.lite`template` - create standalone template (like html())
   * @param {HTMLElement|TemplateStringsArray} elementOrStrings - Element to bind or template strings
   * @param {...any} values - Template values (when used as tagged template)
   * @returns {Function|Hole} Bound function or hole instance
   */
  Html.lite = function lite(elementOrStrings, ...values) {
    // Check if called as tagged template (first arg has 'raw' property)
    if (elementOrStrings && elementOrStrings.raw) {
      // Used as Html.lite`template` - create standalone hole
      return html(elementOrStrings, ...values);
    }
    // Used as Html.lite(element) - return bound function
    return bind(elementOrStrings);
  };

  return Html;
}

// Export Hole for instanceof checks
export { Hole, dom };
