/**
 * @file Processes fragment method results for rendering.
 */

import { buildTemplate } from '../template/buildTemplate.js';
import { Hole, dom } from '../html/createHtml.js';

/**
 * Result object returned from fragment methods (methods starting with capital letter).
 * @typedef {Object} FragmentResult
 * @property {any} [any] - Rendered content
 * @property {boolean} [once] - Render only once
 * @property {string|Promise} [template] - Template string or promise
 * @property {Object|Array} [values] - Template values
 * @property {string} [text] - Text content
 * @property {string} [html] - HTML content
 * @property {any} [placeholder] - Placeholder content
 */

/**
 * Processes a fragment result object and returns renderable content.
 * @param {FragmentResult} result - The fragment result
 * @param {Object} data - Data passed to the fragment
 * @param {Object} templatestrings - Template cache
 * @param {Function} [onResolve] - Callback when async content resolves
 * @returns {any} Renderable content
 */
export function processFragmentResult(
  result,
  data,
  templatestrings,
  onResolve
) {
  // Handle text type - can be string or Promise
  // Note: Don't escape here - the render core creates text nodes which the
  // browser automatically escapes in innerHTML
  if (result.text !== undefined) {
    if (typeof result.text === 'string') {
      return result.text;
    }
    // Handle Promise
    if (result.text && typeof result.text.then === 'function') {
      result.text.then((resolved) => {
        result.text = resolved;
        if (onResolve) onResolve();
      });
      return result.placeholder !== undefined ? result.placeholder : '';
    }
  }

  // Handle html type (raw) - can be string or Promise
  if (result.html !== undefined) {
    if (typeof result.html === 'string') {
      return { __unsafe: true, value: result.html };
    }
    // Handle Promise
    if (result.html && typeof result.html.then === 'function') {
      result.html.then((resolved) => {
        result.html = resolved;
        if (onResolve) onResolve();
      });
      return result.placeholder !== undefined ? result.placeholder : '';
    }
  }

  // Handle template
  if (result.template) {
    if ('string' === typeof result.template) {
      if (!templatestrings[result.template]) {
        templatestrings[result.template] = buildTemplate(result.template);
      }
      const values = result.values || data;
      // If values is an array, map each item through the template and combine
      if (Array.isArray(values)) {
        const mapped = values.map(templatestrings[result.template]);
        // Each result may be:
        // - {html: string} for advanced templates
        // - Hole object for simple templates
        // Combine into single HTML string for rendering
        const combined = mapped
          .map((item) => {
            if (item && item.html) {
              return item.html;
            }
            // Default: Hole from simple templates - render to DOM and extract HTML
            const node = dom(item);
            if (node.nodeType === 11) {
              // DocumentFragment - create temp container
              const div = document.createElement('div');
              div.appendChild(node.cloneNode(true));
              return div.innerHTML;
            }
            return node.outerHTML || node.textContent;
          })
          .join('');
        return { __unsafe: true, value: combined };
      }
      const templateResult = templatestrings[result.template](values);
      // Handle both DOM nodes (from wire) and {html: string} (from advanced)
      if (templateResult && templateResult.html) {
        return { __unsafe: true, value: templateResult.html };
      }
      // Handle Hole objects from simple templates
      if (templateResult instanceof Hole) {
        const node = dom(templateResult);
        if (node.nodeType === 11) {
          const div = document.createElement('div');
          div.appendChild(node.cloneNode(true));
          return { __unsafe: true, value: div.innerHTML };
        }
        return { __unsafe: true, value: node.outerHTML || node.textContent };
      }
      return templateResult;
    } else if (
      'object' === typeof result.template &&
      'function' === typeof result.template.then
    ) {
      // Handle template promise - show placeholder, update when resolved
      result.template.then((args) => {
        let { template, values } = args;
        if (!template && 'string' === typeof args) {
          template = args;
          values = {};
        }
        // Store resolved template and values on result object
        result.template = template;
        result.values = values;
        if (onResolve) onResolve();
      });
      return result.placeholder !== undefined ? result.placeholder : '';
    } else {
      throw new Error(
        'unknow template type:' +
          typeof result.template +
          ' | ' +
          JSON.stringify(result.template)
      );
    }
  }

  // Handle any type - can be any value or Promise
  if (result.any !== undefined) {
    // Handle Promise
    if (result.any && typeof result.any.then === 'function') {
      result.any.then((resolved) => {
        result.any = resolved;
        if (onResolve) onResolve();
      });
      return result.placeholder !== undefined ? result.placeholder : '';
    }
    return result.any;
  }

  return result;
}
