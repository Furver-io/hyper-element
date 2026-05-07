/**
 * @file Core initialization logic for hyper-element connectedCallback.
 * Sets up the element instance, observers, and render pipeline.
 */

import { manager } from '../core/manager.js';
import { observer } from './observer.js';
import { onNext } from './onNext.js';
import { processFragmentResult } from './processFragmentResult.js';
import { createHtml } from '../html/createHtml.js';
import { addDataset } from '../attributes/dataset.js';
import {
  ssrState,
  replayEvents,
  markTagRegistered,
  initSSR,
} from '../ssr/index.js';
import {
  beginStyleRender,
  commitStyleRender,
  registerStyled,
  setRenderingInstance,
} from '../styled/index.js';

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
        if (typeof this[name] === 'function') {
          that[name] = this[name].bind(that);
        } else {
          that[name] = this[name];
        }
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

  // Store instance reference for +styled DOM traversal
  ref.shadow.__hyperInstance = this;

  // Create the Html function and attach to ref
  ref.Html = createHtml(ref.shadow);

  // Attach fragments to Html function for fragment call processing
  ref.Html._fragments = fragmentCache;

  // Guard removed: this.attrs is set by the library, cannot be pre-defined by user
  that.attrs = this.attachAttrs(this.attributes);
  that.dataset = this.getDataset();

  // Register styled config if present (for +styled template syntax)
  const styledConfig = this.constructor.__styledConfig;
  if (styledConfig?.styled) {
    registerStyled(this, styledConfig.styled, that, null, styledConfig.colors);
  }

  const render = this.render;
  this.render = (...data) => {
    ref.observe = false;

    // Set rendering context for +styled handlers while the component stamps
    // detached nodes, then always clear it even if the render path throws. A
    // stale render instance would make later mounted-fragment updates attach
    // selector CSS to the wrong component.
    beginStyleRender(this);
    setRenderingInstance(this);
    try {
      render.call(that, ref.Html, ...data);
    } finally {
      setRenderingInstance(null);
    }
    if (Object.prototype.hasOwnProperty.call(ssrState.config, 'styleNonce')) {
      commitStyleRender(this, ssrState.config.styleNonce);
    } else {
      commitStyleRender(this);
    }

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
