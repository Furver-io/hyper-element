/**
 * @file <json-render> custom element — auto-registering via hyper-element.
 *
 * This module registers the <json-render> Web Component that renders
 * json-render specs from its body content. It is the primary
 * consumer-facing surface of the json-render module — import this
 * file (or the parent index.js) and <json-render> becomes available
 * in HTML.
 *
 * Rendering pipeline:
 *   1. Read body text content as JSON (ctx.wrappedContent)
 *   2. Parse JSON; on parse failure, surface an inline error alert
 *   3. Validate: root + elements must both be present and resolve
 *   4. If empty/incomplete → show loading shimmer (streaming in progress)
 *   5. Build the component tree via renderSpecTree()
 *   6. Wrap in a jr-root container div
 *
 * Why body content instead of an attribute: JSON in an attribute
 * requires quote escaping, bloats outerHTML, and is hard to read.
 * Custom elements let us place the JSON directly between the tags,
 * the same way <script type="application/json"> does. The text is
 * HTML-safe for all JSON structural characters ({ } [ ] : , "); the
 * only risk is literal `<` or `>` inside string values, which must
 * be encoded as `\u003c` / `\u003e` JSON escapes if present.
 *
 * Reactivity: hyper-element's MutationObserver rewrites
 * ctx.wrappedContent on every childList mutation, so assigning to
 * element.textContent re-renders the spec automatically. No
 * observedAttributes, no data-spec fallback.
 *
 * Error recovery: any exception during parse or render produces a
 * styled error alert rather than a blank or broken element.
 *
 * Events: interactive components inside the spec dispatch "jr-action"
 * CustomEvents that bubble up from the <json-render> host element.
 *
 * @module hyper-element/json-render/element
 */

import { createFunctionalElement } from '../functional.js';
import { renderSpecTree } from './renderer.js';

// Import the shared registry so <json-render> sees custom-registered
// components — not just built-ins. The registry lives in its own
// module (registry.js) to avoid a circular import with index.js.
import { registryInterface } from './registry.js';

/**
 * The <json-render> custom element class.
 *
 * Created via hyper-element's functional API. Reads its body text
 * content as a JSON spec and renders that spec to the DOM.
 * Automatically re-renders when the body content changes (via
 * hyper-element's MutationObserver-based reactivity).
 *
 * @example
 * <json-render>
 * {"root":"msg","elements":{"msg":{"type":"Text","props":{"content":"Hello"}}}}
 * </json-render>
 */
export const jsonRenderElement = createFunctionalElement('json-render', {
  /**
   * Render the json-render spec from the element's body text content.
   *
   * Handles three states:
   * 1. Empty/loading — show shimmer placeholder
   * 2. Invalid spec — show diagnostic error alert
   * 3. Valid spec — render the component tree
   *
   * @param {Object} Html - hyper-element's tagged template function
   * @param {Object} ctx - Element context with wrappedContent and element ref
   * @returns {Node} Rendered template
   */
  render: (Html, ctx) => {
    try {
      // Read the JSON spec from the element's body text content.
      // ctx.wrappedContent is populated by connectedCallback() on
      // mount and kept in sync by observer() on childList mutations,
      // so `element.textContent = JSON.stringify(spec)` triggers a
      // re-render automatically. Fall back to '{}' so an empty or
      // whitespace-only body parses successfully into an empty
      // object and lands in the shimmer branch below rather than
      // throwing a JSON.parse error.
      const raw = (ctx.wrappedContent || '').trim() || '{}';
      const spec = JSON.parse(raw);

      // Incomplete spec — split into two visible states:
      //   - Literal "{}" means "no spec written yet" or "streaming
      //     in progress"; show the animated shimmer placeholder.
      //   - Anything else that parsed but still lacks root/elements
      //     (e.g. `{"roo":"typo"}`) is a real authoring mistake;
      //     surface the warning alert so it is visible instead of
      //     masquerading as a loading state.
      if (!spec.root || !spec.elements) {
        if (raw === '{}') {
          return Html`<div class="jr-shimmer" data-loading="true">
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
      console.error('json-render error:', e);
      return Html`<div class="jr-alert error">❌ Render error: ${e.message}</div>`;
    }
  },
});
