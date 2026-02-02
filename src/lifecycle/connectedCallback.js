/**
 * @file Core initialization logic for hyper-element connectedCallback.
 * Sets up the element instance, observers, and render pipeline.
 */

import { manager } from '../core/manager.js';
import { observer } from './observer.js';
import { onNext } from './onNext.js';
import { buildTemplate } from '../template/buildTemplate.js';
import { createHtml, Hole, dom } from '../html/createHtml.js';
import { addDataset } from '../attributes/dataset.js';
import {
  ssrState,
  replayEvents,
  markTagRegistered,
  initSSR,
} from '../ssr/index.js';

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
function processFragmentResult(result, data, templatestrings, onResolve) {
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

/**
 * Core initialization callback, called when element is connected to DOM.
 * Sets up the element instance, observers, fragment definitions, and initial render.
 *
 * @this {HTMLElement} The custom element instance (must be a hyperElement subclass)
 * @returns {void}
 */
export function createdCallback() {
  // Initialize SSR capture on first element connection
  initSSR();

  // Create unique identifier for this instance
  this.identifier = Symbol(this.localName);
  const ref = (manager[this.identifier] = { attrsToIgnore: {} });
  ref.innerHTML = this.innerHTML;
  const that = (ref.this = { element: this });
  that.wrappedContent = this.textContent;

  // Fragment method cache
  const fragmentCache = {};

  // Initialize ref.observe to true so MutationObserver callbacks can run
  // The render wrapper sets it to false during render to prevent infinite loops
  ref.observe = true;
  observer.call(this, ref); // observer change to innerHTML

  Object.getOwnPropertyNames(this.__proto__)
    .filter(
      (name) =>
        !('constructor' === name || 'setup' === name || 'render' === name)
    )
    .forEach((name) => {
      if (/^[A-Z]/.test(name)) {
        const templatestrings = {};
        /**
         * Wraps a fragment method to handle template processing and caching.
         * @param {Object} data - Data passed to the fragment
         * @returns {any} Renderable content
         */
        fragmentCache[name] = (data) => {
          // Check cache for once: true results
          if (fragmentCache[name]._cached !== undefined) {
            return fragmentCache[name]._cached;
          }

          // Check if we have a pending async result
          let result;
          if (fragmentCache[name]._asyncResult) {
            result = fragmentCache[name]._asyncResult;
          } else {
            result = this[name](data);
          }

          // Check if result has async content
          const hasAsync =
            (result.text && typeof result.text.then === 'function') ||
            (result.html && typeof result.html.then === 'function') ||
            (result.any && typeof result.any.then === 'function') ||
            (result.template && typeof result.template.then === 'function');

          // Store async result for re-processing after resolve (prevents infinite loop)
          // We need to store it even without once: true to prevent calling the fragment
          // method again which would create a new Promise
          if (hasAsync) {
            fragmentCache[name]._asyncResult = result;
          }

          /**
           * Callback for when async content resolves.
           * Triggers a re-render of the element.
           */
          const onResolve = () => {
            // Re-render the element
            this.render();
          };

          // Process the fragment result
          const processed = processFragmentResult(
            result,
            data,
            templatestrings,
            onResolve
          );

          // Cache if once: true and no async content pending
          if (result.once && !hasAsync) {
            fragmentCache[name]._cached = processed;
          }
          // Clear async result after it's been processed (content resolved)
          if (!hasAsync && fragmentCache[name]._asyncResult) {
            delete fragmentCache[name]._asyncResult;
          }

          return processed;
        };
      } else {
        that[name] = this[name].bind(that);
      }
      delete this[name];
    });

  // Store fragments on ref for access
  ref.fragments = fragmentCache;

  /**
   * Custom toString for element context.
   * @returns {string} String representation
   */
  function toString() {
    return 'hyper-element: ' + this.localName;
  }
  Object.defineProperty(that, 'toString', {
    value: toString.bind(this),
    writable: false,
  });

  // Use shadow DOM, else fallback to render to element
  ref.shadow = this;

  // Create the Html function and attach to ref
  ref.Html = createHtml(ref.shadow);

  // Attach fragments to Html function for fragment call processing
  ref.Html._fragments = fragmentCache;

  // Guard removed: this.attrs is set by the library, cannot be pre-defined by user
  that.attrs = this.attachAttrs(this.attributes);
  that.dataset = this.getDataset();
  const render = this.render;
  this.render = (...data) => {
    ref.observe = false;

    render.call(that, ref.Html, ...data);

    // Clear any pending mutations caused by our render to prevent infinite loops
    // Then immediately re-enable observation for external changes
    ref.mutationObserver?.takeRecords();
    ref.observe = true;

    // After render check if dataset has changed
    Object.getOwnPropertyNames(that.dataset)
      .filter((key) => !this.dataset[key])
      .forEach((key) => {
        const value = that.dataset[key];
        addDataset.call(
          this,
          that.dataset,
          key.replace(/([A-Z])/g, (g) => `-${g[0].toLowerCase()}`)
        );
        that.dataset[key] = value;
      });
  };

  if (this.setup) {
    ref.teardown = this.setup.call(that, onNext.bind(this, that));
  }

  markTagRegistered(this.localName);

  this.render();

  queueMicrotask(() => {
    replayEvents(
      this,
      ssrState,
      this.onBeforeHydrate?.bind(that),
      this.onAfterHydrate?.bind(that)
    );
  });
}
