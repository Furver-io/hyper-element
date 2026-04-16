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
 * Interaction lifecycle (auto-busy):
 *   When a child component dispatches `jr-action`, the element marks
 *   itself with `data-jr-busy="true"` and `data-jr-busy-action="<name>"`.
 *   CSS rules in json-render.css disable all interactive children while
 *   this attribute is present, preventing duplicate dispatches during
 *   the network round-trip to the LLM. The next spec replacement (via
 *   `element.textContent = JSON.stringify(nextSpec)`) re-enters render()
 *   and the busy attributes are cleared automatically. Consumers can
 *   opt out with `<json-render data-jr-busy-mode="off">` for cases
 *   where the host wants full control over interaction state.
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
   * Setup lifecycle — runs once when the element connects to the DOM.
   *
   * Installs the auto-busy interaction-lifecycle listener: a single
   * capture-phase `jr-action` listener on the host element that flips
   * `data-jr-busy="true"` whenever any descendant interactive component
   * dispatches an action. The listener is intentionally on the host
   * (not the rendered tree) so it survives every render replacement
   * without re-attachment, and runs in capture phase so it sets the
   * busy state before any consumer-installed `jr-action` handler runs.
   *
   * Auto-clear is handled inside render() — the next time render()
   * runs (which happens whenever element.textContent is replaced via
   * MutationObserver), the busy attributes are removed before the
   * new tree is built. This means a fresh spec from the LLM
   * automatically re-enables interaction without any consumer code.
   *
   * Opt-out: setting `data-jr-busy-mode="off"` on the host element
   * disables the auto-busy behavior so consumers that want to manage
   * interaction state externally are not double-managed.
   *
   * @param {Object} ctx - Element context with .element reference
   * @param {Function} _onNext - Reactive store hook (unused)
   * @returns {Function} Teardown function — removes the listener
   */
  setup: (ctx, _onNext) => {
    /**
     * Stamp the host element with data-jr-busy + data-jr-busy-action
     * when a descendant dispatches jr-action. Capture-phase so this
     * runs before any consumer handler — the visual lock is visible
     * before the action travels to the network.
     * @param {CustomEvent} event - The jr-action event with detail.action.
     */
    const handleAction = (event) => {
      // Skip auto-busy when the consumer has opted out via attribute.
      // Read fresh on each event so the consumer can flip the mode
      // dynamically without re-mounting the element.
      if (ctx.element.getAttribute('data-jr-busy-mode') === 'off') return;
      // Stamp the host element with the busy marker. CSS in
      // json-render.css uses [data-jr-busy] as the gating selector
      // for pointer-events: none on every interactive descendant.
      ctx.element.setAttribute('data-jr-busy', 'true');
      // Surface which action triggered the busy state — useful for
      // diagnostic logging and for CSS that wants to highlight a
      // specific in-flight action by name.
      const actionName = event?.detail?.action || '';
      if (actionName) {
        ctx.element.setAttribute('data-jr-busy-action', actionName);
      }
    };
    // Capture phase so we set busy BEFORE any consumer listener runs
    // (consumers typically dispatch the action across the network in
    // their handler — we want the visual lock in place first).
    ctx.element.addEventListener('jr-action', handleAction, true);

    // ── Programmatic API: replaceSpec() ──────────────────────
    // Convenience method so consumers don't need to manually stringify
    // and assign to textContent. Accepts either an object (stringified
    // internally) or a pre-serialized JSON string. The textContent
    // assignment triggers hyper-element's MutationObserver, which
    // updates ctx.wrappedContent and calls render() automatically.
    ctx.element.replaceSpec = (spec) => {
      ctx.element.textContent =
        typeof spec === 'string' ? spec : JSON.stringify(spec);
    };

    // ── Programmatic API: toolUseId ──────────────────────────
    // First-class property that mirrors the data-tool-use-id dataset
    // attribute. Consumers (e.g. mount-spec.js) use this to correlate
    // a <json-render> element with a specific tool_use_id from the
    // LLM response, enabling targeted spec replacement when multiple
    // tool_use blocks exist in a single message.
    Object.defineProperty(ctx.element, 'toolUseId', {
      /**
       * Read the tool_use_id from the data-tool-use-id dataset attribute.
       * @returns {string|null} The stored id, or null when unset.
       */
      get() {
        return ctx.element.dataset.toolUseId || null;
      },
      /**
       * Mirror the value onto data-tool-use-id. Passing null/empty
       * removes the attribute entirely rather than setting it to "".
       * @param {string|null} v - New id value, or null to clear.
       */
      set(v) {
        if (v) ctx.element.dataset.toolUseId = v;
        else delete ctx.element.dataset.toolUseId;
      },
      configurable: true,
    });

    // Teardown — remove the listener and API when the element is removed.
    // hyper-element's disconnectedCallback invokes the returned fn.
    return () => {
      ctx.element.removeEventListener('jr-action', handleAction, true);
      delete ctx.element.replaceSpec;
      delete ctx.element.toolUseId;
    };
  },

  /**
   * Render the json-render spec from the element's body text content.
   *
   * Handles three states:
   * 1. Empty/loading — show shimmer placeholder
   * 2. Invalid spec — show diagnostic error alert
   * 3. Valid spec — render the component tree
   *
   * Auto-clears the auto-busy marker on every render. A new render
   * means the spec was replaced (typically by a tool result resolving
   * a pending action), so any in-flight interaction is now resolved
   * and the interactive children should re-enable.
   *
   * @param {Object} Html - hyper-element's tagged template function
   * @param {Object} ctx - Element context with wrappedContent and element ref
   * @returns {Node} Rendered template
   */
  render: (Html, ctx) => {
    // Auto-clear the busy marker installed by setup()'s jr-action
    // listener. Done at the top of render() so the host attributes
    // reflect the freshly-rendered tree's state, not the previous
    // tree's pending interaction. The removeAttribute calls are
    // no-ops when the marker is absent.
    if (ctx.element.hasAttribute('data-jr-busy')) {
      ctx.element.removeAttribute('data-jr-busy');
      ctx.element.removeAttribute('data-jr-busy-action');
    }
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
