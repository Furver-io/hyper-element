/**
 * @file Functional API for defining hyperElement components.
 * Provides a factory function to create custom element classes from plain objects.
 */

import { hyperElement } from './hyperElement.js';
import { registerComponent } from './json-render/index.js';
import { createBridgedRenderFn } from './json-render/bridge.js';
// Imported from registry.js (not index.js) to avoid pulling element.js
// during the bootstrap cycle. registryInterface is needed for the
// pre-registration collision check that augments registerComponent's
// built-in-only warning with one that fires on any custom-vs-custom
// jrType collision (TASK-04 AC #9 — last-write-wins must surface a
// console.warn even when neither side is a built-in component).
import { registryInterface } from './json-render/registry.js';
import { BUILT_IN_COMPONENTS } from './json-render/components.js';

/**
 * Wire a hyperElement definition's jrType/jrCatalog into the json-render
 * registry. Extracted from createFunctionalElement so the branch tracker
 * sees a clean function-level entry rather than a deeply-nested if block
 * (v8-to-istanbul mis-attributes branch hits when this code is inlined
 * inside a long function body containing other branches).
 *
 * @param {string|null} tagName - Tag name from the hyperElement(...) call
 * @param {Object} definition - The full definition with jrType/jrCatalog
 */
function registerJrType(tagName, definition) {
  if (!tagName) {
    throw new Error(
      'hyperElement: jrType "' +
        definition.jrType +
        '" requires a tag name so the bridge can instantiate the ' +
        'element via document.createElement(). Call ' +
        'hyperElement("tag-name", { jrType, ... }) instead of the ' +
        'tagless form.'
    );
  }
  // Collision warning — TASK-04 AC #9 mandates last-write-wins with a
  // console.warn on any second registration. registerComponent already
  // warns when a built-in (Card, Button, ...) is overridden, so we only
  // emit the extra warn for custom-vs-custom collisions and let the
  // built-in path use registerComponent's existing diagnostic.
  if (
    registryInterface.get(definition.jrType) &&
    !BUILT_IN_COMPONENTS.has(definition.jrType)
  ) {
    console.warn(
      'hyperElement: jrType "' +
        definition.jrType +
        '" is already registered. The previous entry will be ' +
        'replaced (last-write-wins).'
    );
  }
  registerComponent(definition.jrType, {
    render: createBridgedRenderFn(tagName),
    catalog: definition.jrCatalog || null,
  });
}

/**
 * Creates a hyperElement class from a functional definition.
 *
 * @param {string|Object|Function} tagOrDef - Tag name, definition object, or render function
 * @param {Object|Function} [definition] - Definition object or render function (if first arg is tag)
 * @returns {typeof hyperElement} Generated class extending hyperElement
 *
 * @example
 * // Full definition with tag (auto-registers)
 * hyperElement('my-counter', {
 *   setup: (ctx, onNext) => { ... },
 *   render: (Html, ctx) => Html`...`
 * });
 *
 * @example
 * // Shorthand with tag (auto-registers)
 * hyperElement('hello-world', (Html, ctx) => Html`<div>Hello</div>`);
 *
 * @example
 * // Definition without tag (returns class for manual registration)
 * const MyElement = hyperElement({
 *   render: (Html, ctx) => Html`...`
 * });
 * customElements.define('my-element', MyElement);
 *
 * @example
 * // Shorthand without tag (returns class for manual registration)
 * const Simple = hyperElement((Html, ctx) => Html`<div>Simple</div>`);
 * customElements.define('simple-elem', Simple);
 */
export function createFunctionalElement(tagOrDef, definition) {
  // Signature parsing: (definition) or (tagName, definition)
  let tagName = null;
  if (typeof tagOrDef === 'string') {
    tagName = tagOrDef;
  } else {
    definition = tagOrDef;
  }

  // Handle shorthand: just a render function
  if (typeof definition === 'function') {
    definition = { render: definition };
  }

  if (!definition || typeof definition !== 'object') {
    throw new Error(
      'hyperElement: definition must be an object or render function'
    );
  }

  const {
    setup: setupFn,
    render: renderFn,
    onBeforeHydrate: beforeHydrateFn,
    onAfterHydrate: afterHydrateFn,
    ...methods
  } = definition;

  if (!renderFn || typeof renderFn !== 'function') {
    throw new Error('hyperElement: render function is required');
  }

  // Generate class dynamically
  // Note: observedAttributes not needed - MutationObserver handles all attribute reactivity
  class FunctionalElement extends hyperElement {}

  // Add setup if provided (passes context explicitly)
  if (setupFn) {
    FunctionalElement.prototype.setup = function (onNext) {
      return setupFn(this, onNext);
    };
  }

  // Add render (required, passes context explicitly)
  FunctionalElement.prototype.render = function (Html, ...data) {
    return renderFn(Html, this, ...data);
  };

  // Add SSR hydration lifecycle hooks if provided
  if (beforeHydrateFn) {
    FunctionalElement.prototype.onBeforeHydrate = function (events) {
      return beforeHydrateFn(this, events);
    };
  }

  if (afterHydrateFn) {
    FunctionalElement.prototype.onAfterHydrate = function () {
      return afterHydrateFn(this);
    };
  }

  // Add other methods (context as first param)
  for (const [name, fn] of Object.entries(methods)) {
    if (typeof fn !== 'function') {
      continue; // Skip non-function properties
    }
    FunctionalElement.prototype[name] = function (...args) {
      return fn(this, ...args);
    };
  }

  // Attach styled config if present (for +styled template syntax)
  if (definition.styled || definition.__options) {
    FunctionalElement.__styledConfig = {
      styled: definition.styled || null,
      colors: definition.__options?.colors || null,
    };
  }

  // json-render bridge: when `jrType` is set, register the custom element
  // into the json-render registry so any spec referencing that type
  // renders this custom element instead of the built-in fallback.
  // Mirrors the styled-config hook above as a "metadata side-effect".
  // jrType requires a tag name so the bridge can instantiate via
  // document.createElement; fail loud rather than silently skipping.
  if (definition.jrType) {
    registerJrType(tagName, definition);
  }

  // Auto-register if tag name provided
  if (tagName) {
    customElements.define(tagName, FunctionalElement);
  }

  return FunctionalElement;
}
