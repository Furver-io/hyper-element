/**
 * @file Component bridge — wraps a hyperElement custom element as a
 * json-render component so it can replace built-ins or introduce new
 * types directly from a `hyperElement('tag', { jrType, jrCatalog, ... })`
 * declaration.
 *
 * The bridge produces a render function whose signature matches the
 * json-render registry contract:
 *
 *   (Html, def, key, kids, hostEl) => Node
 *
 * It imperatively instantiates the custom element via
 * `document.createElement(tagName)` because tagged template literals
 * cannot interpolate tag names — so the wrapping markup
 * `<${tagName} data-jr-props="..."/>` is impossible. Tag-name driven
 * creation must therefore happen with the imperative DOM APIs.
 *
 * Spec data is propagated to the custom element via three attributes,
 * each consumed by the existing dataset proxy at
 * `src/attributes/dataset.js:18-53` which auto-parses JSON-shaped
 * attribute values into live JS objects:
 *
 *   - `data-jr-props`     — `JSON.stringify(def.props)`
 *   - `data-jr-children`  — `JSON.stringify(def.children)` (raw spec keys
 *                            for components that want to walk the spec
 *                            themselves; pre-rendered children also live
 *                            in the light DOM as a default slot)
 *   - `data-jr-on`        — `JSON.stringify(def.on)` (the component is
 *                            responsible for dispatching `jr-action`
 *                            CustomEvents from its own click/change/key
 *                            handlers built off this payload)
 *
 * Pre-rendered children produced by other registered components are
 * appended as light-DOM children. The renderer feeds the bridge an
 * array of `Hole` instances (every built-in renderer returns
 * `Html.wire(...)` which is a `Hole`, not a Node), so each kid must be
 * normalised to a Node before `appendChild` — done with the public
 * `dom(hole)` helper re-exported from `src/render/index.js:101`.
 *
 * @module hyper-element/json-render/bridge
 */

import { Hole, dom } from '../render/index.js';

/**
 * Build a json-render render function that instantiates `<tagName>`
 * for every spec node whose `type` matches the registered `jrType`.
 *
 * The returned function is registered into the shared json-render
 * registry by `createFunctionalElement` (see `src/functional.js`) when
 * a developer attaches `jrType` to a `hyperElement(...)` definition.
 * It can also be called directly by `registerComponent` consumers who
 * want to bridge an externally-defined custom element.
 *
 * The render function returns a `Hole` (hyper-element's parsed template
 * wrapper), not a raw Node. This is critical for sibling rendering: a
 * built-in's `kids` array is processed by hyper-element's array path
 * (`hole.js` valueOf), which only walks each element via `.valueOf()`
 * when `value[0] instanceof Hole`. If the first kid is a raw Node and
 * the rest are Holes, the Holes never materialise and disappear from
 * the DOM. Returning a Hole keeps every `kids` array uniformly
 * Hole-typed, so mixed parents (built-in Row containing built-in Button
 * + bridged ProductCard) render correctly.
 *
 * @param {string} tagName - Custom-element tag name to instantiate. Must
 *   already be (or eventually become) registered via
 *   `customElements.define`. The bridge does not register it itself —
 *   that responsibility belongs to the caller.
 * @returns {(Html: Function, def: Object, key: string, kids: Array, hostEl: HTMLElement) => Object}
 *   Render function matching the json-render registry contract. Returns
 *   a `Hole` whose materialised DOM is the imperatively-built custom
 *   element. The Hole is interpolated into the parent template by
 *   `renderSpecTree`'s `${renderNode(...)}` slot.
 *
 * @example
 * import { registerComponent } from 'hyper-element/json-render';
 * import { createBridgedRenderFn } from 'hyper-element/json-render/bridge.js';
 *
 * customElements.define('my-card', MyCardElement);
 * registerComponent('Card', {
 *   render: createBridgedRenderFn('my-card'),
 *   catalog: { description: 'Branded card', props: {...}, slots: ['default'], actions: {} },
 * });
 */
export function createBridgedRenderFn(tagName) {
  return function bridgedRender(Html, def, key, kids /* , hostEl */) {
    // Imperative instantiation — tag name interpolation is impossible
    // in tagged template literals, so the bridge must use createElement.
    const el = document.createElement(tagName);

    // Props transport — JSON-stringify into a single data-jr-props
    // attribute. The dataset proxy at src/attributes/dataset.js auto-
    // parses on read, so the consuming element sees `ctx.dataset.jrProps`
    // as a real object/array/primitive without any bridge-side reviver.
    // Set the attribute even when props is `{}` so the consumer can
    // distinguish "no props key in spec" (attr absent) from "explicit
    // empty props" (attr === '{}').
    if (def.props != null) {
      el.setAttribute('data-jr-props', JSON.stringify(def.props));
    }

    // Raw children spec keys — exposed via data-jr-children for
    // components that want to walk the flat element map themselves
    // (e.g., to look up child definitions and re-render with their
    // own logic). Pre-rendered DOM nodes are also slotted below; the
    // attribute is the "raw spec" channel and the light DOM is the
    // "rendered output" channel. Both are present per AC #5 of TASK-04.
    if (Array.isArray(def.children) && def.children.length > 0) {
      el.setAttribute('data-jr-children', JSON.stringify(def.children));
    }

    // Events transport — the spec's on:{} block is forwarded verbatim.
    // The custom element is responsible for binding interactive handlers
    // (onclick, onchange, etc.) and dispatching `jr-action` CustomEvents
    // using the payload at ctx.dataset.jrOn[<eventName>]. This mirrors
    // how the built-in Button/Checklist/TextField components dispatch
    // jr-action via the dispatchAction helper in components.js.
    if (def.on != null) {
      el.setAttribute('data-jr-on', JSON.stringify(def.on));
    }

    // Slot pre-rendered children as light-DOM. The renderer hands us an
    // array of Holes (built-ins) and/or Holes-wrapping-bridges. Holes
    // carry their final DOM in either `.n` (already materialised) or
    // via `.valueOf()` (first render); the public `dom(hole)` helper
    // unifies both paths and returns a Node. Skip nullish entries to
    // tolerate sparse children arrays.
    //
    // NOTE: hyper-element renders a custom element directly into itself
    // (no shadow DOM), so the consuming element's first render() will
    // overwrite these light-DOM children. The slot is therefore most
    // useful for components that want to inspect raw children content
    // (textContent / wrappedContent / childNodes) inside `setup()`,
    // which runs BEFORE the first render() wipes the DOM. The
    // data-jr-children attribute (above) is the stable, post-render
    // channel for spec-key access from inside render().
    for (const kid of kids) {
      if (kid == null) continue;
      const node = kid instanceof Hole ? dom(kid) : kid;
      if (node) el.appendChild(node);
    }

    // Wrap in a Hole keyed to this spec node so the renderer's array
    // path (`hole.js` valueOf, lines 117-120) sees a homogeneous Hole[]
    // for any parent's `${kids}` interpolation. Returning a raw Node
    // would break sibling rendering when this bridge sits next to a
    // built-in inside a Row/Column/Card — `diff()` would receive a
    // Node where it expects a Hole and crash with "parameter 1 is not
    // of type 'Node'" inside the array path.
    //
    // We MUST use `Html.wire(def, key)`, not plain `Html`. Plain `Html`
    // is `bind(<json-render>)` (see `createHtml.js`); calling it would
    // invoke `element.replaceChildren()` on the `<json-render>` host and
    // clobber the entire spec render. `Html.wire(def, ':bridge:' + key)` skips the
    // bind step and just produces a Hole keyed to this spec node, which
    // is exactly the pattern every built-in renderer uses (see
    // `renderCard`/`renderButton` in `components.js`).
    return Html.wire(def, ':bridge:' + key)`${el}`;
  };
}
