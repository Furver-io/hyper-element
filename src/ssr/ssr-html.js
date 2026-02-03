/**
 * @file SSR Html factory.
 * Creates the Html tagged template function for server-side rendering.
 */

import { renderToString } from './string-render.js';
import { safeHtml, isSafeHtml, escapeHtml } from '../utils/escape.js';
import { hasEachBlocks, transformEachBlocks } from '../html/parseEachBlocks.js';
import { setSSRContext } from './string-update.js';

/**
 * Creates an SSR wire function for keyed templates.
 * SSR always renders fresh since there's no DOM to diff against.
 * @param {object} obj - Object to bind to (unused in SSR, for API compatibility)
 * @param {string} [_id=''] - Optional ID (unused in SSR, for API compatibility)
 * @returns {Function} Tagged template function that returns HTML string
 */
function ssrWire(obj, _id = '') {
  return (template, ...values) => renderToString(template, values, false);
}

/**
 * Processes a fragment result object into a value for rendering.
 * Fragments return { text: string } or { html: string } or { any: value }.
 * @param {Object} result - Fragment result object
 * @returns {Object} Processed value with __unsafe marker if needed
 */
function processFragmentResult(result) {
  if (!result || typeof result !== 'object') {
    return result;
  }
  // { text: 'escaped string' } - escape the content
  if (result.text !== undefined) {
    return escapeHtml(String(result.text));
  }
  // { html: 'raw html' } - pass through unescaped
  if (result.html !== undefined) {
    return { __unsafe: true, value: result.html };
  }
  // { any: value } - use as-is (will be escaped by render)
  if (result.any !== undefined) {
    return result.any;
  }
  // { template: 'template string' } - pass through unescaped
  if (result.template !== undefined) {
    return { __unsafe: true, value: result.template };
  }
  // safeHtml objects pass through
  if (isSafeHtml(result)) {
    return { __unsafe: true, value: result.value };
  }
  return result;
}

/**
 * Creates the SSR Html tagged template function.
 * This mirrors the browser createHtml but outputs strings.
 *
 * @param {Object} [context={}] - Render context with attrs, store, fragments
 * @returns {Object} Html function with wire, raw, lite methods
 */
export function createSSRHtml(context = {}) {
  // Set SSR context for styled handlers
  // This makes styled, colors, attrs, store available during style resolution
  setSSRContext(context);

  // Track async fragments for resolution
  const asyncFragments = [];

  /**
   * Process a value for SSR output.
   * @param {any} val - Value to process
   * @returns {any} Processed value
   */
  function processValue(val) {
    if (isSafeHtml(val)) {
      // Safe HTML (Html.raw()) - mark as unsafe for render core
      return { __unsafe: true, value: val.value };
    }
    if (val && typeof val === 'object' && val.__unsafe) {
      // Already marked as unsafe
      return val;
    }
    if (val && typeof val === 'object' && val.html !== undefined) {
      // Handle { html: string } from {+if}/{+else} blocks
      return { __unsafe: true, value: val.html };
    }
    if (Array.isArray(val)) {
      // Arrays - process each item
      return val.map((item) => {
        if (isSafeHtml(item)) {
          return { __unsafe: true, value: item.value };
        }
        // String results from wire() calls - keep as-is
        if (typeof item === 'string') {
          // Wire results should be treated as raw HTML
          return { __unsafe: true, value: item };
        }
        return item;
      });
    }
    return val;
  }

  /**
   * SSR Html tagged template function.
   * Returns a string for sync content, or a Promise for async fragments.
   * @param {...any} args - Tagged template arguments
   * @returns {string|Promise<string>} HTML string or Promise
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

    // Process values - handle fragments, safeHtml markers
    const processedArgs = [args[0]];
    // Track placeholders for this render
    const placeholders = [];

    for (let i = 1; i < args.length; i++) {
      let val = args[i];

      // Check for fragment call: { FragmentName: data }
      if (
        val &&
        typeof val === 'object' &&
        !Array.isArray(val) &&
        !isSafeHtml(val) &&
        !val.__unsafe
      ) {
        const keys = Object.keys(val);
        if (keys.length === 1 && /^[A-Z]/.test(keys[0])) {
          const fragmentName = keys[0];
          const fragmentData = val[fragmentName];
          // Look up fragment in context.fragments
          if (context.fragments && context.fragments[fragmentName]) {
            val = context.fragments[fragmentName](fragmentData);
            // Handle async fragments
            if (val && typeof val.then === 'function') {
              // Create unique placeholder for this async fragment
              const placeholderId = `__SSR_FRAG_${asyncFragments.length}__`;
              asyncFragments.push({
                id: placeholderId,
                promise: val.then(processFragmentResult),
              });
              placeholders.push(placeholderId);
              // Use placeholder as the value (will be replaced after await)
              val = placeholderId;
            } else {
              // Sync fragment - process the result
              val = processFragmentResult(val);
            }
          }
        }
      }

      processedArgs.push(processValue(val));
    }

    // Render to string
    const html = renderToString(
      processedArgs[0],
      processedArgs.slice(1),
      false
    );

    // If there are async fragments, return a Promise
    if (asyncFragments.length > 0) {
      return Promise.all(asyncFragments.map((f) => f.promise)).then(
        (results) => {
          let finalHtml = html;
          for (let i = 0; i < asyncFragments.length; i++) {
            const placeholder = asyncFragments[i].id;
            let replacement = results[i];
            // Convert __unsafe objects to their value
            if (
              replacement &&
              typeof replacement === 'object' &&
              replacement.__unsafe
            ) {
              replacement = replacement.value;
            }
            finalHtml = finalHtml.replace(placeholder, replacement || '');
          }
          // Clear for next render
          asyncFragments.length = 0;
          return finalHtml;
        }
      );
    }

    return html;
  }

  // Store context reference
  Html._context = context;

  /**
   * Creates a wired template bound to an object.
   * @param {object} obj - Object to bind to
   * @param {string} [id=''] - Optional ID for multiple templates
   * @returns {Function} Tagged template function
   */
  Html.wire = function wireTemplate(obj, id = '') {
    return ssrWire(obj, id);
  };

  /**
   * Marks a string as safe HTML that should not be escaped.
   * @param {string} htmlStr - The HTML string to mark as safe
   * @returns {Object} Safe HTML object
   */
  Html.raw = function raw(htmlStr) {
    return safeHtml(htmlStr);
  };

  /**
   * Lightweight template function for SSR.
   * @param {TemplateStringsArray} strings - Template strings
   * @param {...any} values - Template values
   * @returns {string} HTML string
   */
  Html.lite = function lite(strings, ...values) {
    return renderToString(strings, values, false);
  };

  return Html;
}
