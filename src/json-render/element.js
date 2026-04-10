/**
 * @file <jr-ui> custom element — auto-registering via hyper-element.
 *
 * This module registers the <jr-ui> Web Component that renders
 * json-render specs from its data-spec attribute. It is the primary
 * consumer-facing surface of the json-render module — import this
 * file (or the parent index.js) and <jr-ui> becomes available in HTML.
 *
 * Rendering pipeline:
 *   1. Parse data-spec JSON attribute
 *   2. Validate: root + elements must be present and root must resolve
 *   3. If empty/incomplete → show loading shimmer (streaming in progress)
 *   4. Build the component tree via renderSpecTree()
 *   5. Wrap in a jr-ui-root container div
 *
 * Error recovery: any exception during parse or render produces a
 * styled error alert rather than a blank or broken element.
 *
 * Events: interactive components inside the spec dispatch "jr-action"
 * CustomEvents that bubble up from the <jr-ui> element.
 *
 * @module hyper-element/json-render/element
 */

import { createFunctionalElement } from '../functional.js';
import { renderSpecTree } from './renderer.js';

// Import the shared registry so <jr-ui> sees custom-registered
// components — not just built-ins. The registry lives in its own
// module (registry.js) to avoid a circular import with index.js.
import { registryInterface } from './registry.js';

/**
 * The <jr-ui> custom element class.
 *
 * Created via hyper-element's functional API. Reads a `data-spec`
 * attribute containing JSON and renders the spec to the DOM.
 * Automatically re-renders when the attribute changes (via
 * hyper-element's MutationObserver-based reactivity).
 *
 * @example
 * <jr-ui data-spec='{"root":"msg","elements":{"msg":{"type":"Text","props":{"content":"Hello"}}}}'></jr-ui>
 */
export const jrElement = createFunctionalElement('jr-ui', {
  /**
   * Render the json-render spec from the data-spec attribute.
   *
   * Handles three states:
   * 1. Empty/loading — show shimmer placeholder
   * 2. Invalid spec — show diagnostic error alert
   * 3. Valid spec — render the component tree
   *
   * @param {Object} Html - hyper-element's tagged template function
   * @param {Object} ctx - Element context with attrs and element ref
   * @returns {Node} Rendered template
   */
  render: (Html, ctx) => {
    try {
      const raw = ctx.attrs['data-spec'] || '{}';
      const spec = JSON.parse(raw);

      // Loading state — spec is empty or has no content yet.
      // Show an animated shimmer placeholder while the LLM
      // streams the spec content via input_json_delta events.
      if (!spec.root || !spec.elements) {
        if (raw === '{}' || raw === '') {
          return Html`<div class="jr-ui-shimmer" data-loading="true">
            <div class="jr-card" style="opacity:0.4;animation:pulse 1.5s ease-in-out infinite">
              <div class="jr-text muted">Loading UI...</div>
            </div>
          </div>`;
        }
        return Html`<div class="jr-alert warning">⚠️ Invalid spec: missing root or elements</div>`;
      }

      // Delegate to the core renderer. The shared registryInterface
      // provides component lookup — includes both built-in and
      // custom-registered types from registerComponent().
      return renderSpecTree(Html, spec, ctx.element, registryInterface);
    } catch (e) {
      // Parse or render failure — show diagnostic instead of crashing.
      // During streaming, partial JSON is expected and will trigger this
      // until the full spec arrives.
      console.error('jr-ui render error:', e);
      return Html`<div class="jr-alert error">❌ Render error: ${e.message}</div>`;
    }
  },
});
