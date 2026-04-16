# json-render

Spec-driven UI rendering for hyper-element. Turns flat JSON specs
(produced by LLM tool calls) into live DOM trees using hyper-element's
efficient tagged template rendering engine.

## Purpose

When an LLM calls the `render_ui` tool, it produces a JSON spec in
the format `{ root: string, elements: { [key]: ElementDef } }`. This
module renders those specs into real DOM components with:

- **12 built-in component types**: Card, Button, Text, Alert, Progress,
  Row, Column, Divider, CodeBlock, Image, Checklist, TextField
- **Extensible registry**: register custom component types via `registerComponent()`
- **Efficient re-rendering**: uses `Html.wire()` for keyed DOM reuse
- **Streaming support**: handles partial specs gracefully with loading placeholders
- **Event dispatch**: interactive components emit `jr-action` CustomEvents

## Quick Start

```html
<!-- Import the CSS -->
<link rel="stylesheet" href="hyper-element/src/json-render/json-render.css">

<!-- Import registers <json-render> automatically -->
<script type="module">
  import 'hyper-element/json-render';
</script>

<!-- Use it: place the JSON spec as body content -->
<json-render>
{"root":"msg","elements":{"msg":{"type":"Text","props":{"content":"Hello from json-render!"}}}}
</json-render>
```

The spec lives between the tags as ordinary text — no attribute, no quote
escaping. JSON structure characters (`{` `}` `[` `]` `:` `,` `"`) are all
HTML-safe, so the spec survives HTML parsing untouched. The only characters
to watch for are literal `<` or `>` inside string values: encode them as
`\u003c` / `\u003e` JSON escapes to stay HTML-safe. `&` is always safe
because `element.textContent` resolves `&amp;` back to `&`.

Updating the spec after mount is a plain text-content assignment:

```js
document.querySelector('json-render').textContent = JSON.stringify(nextSpec);
```

hyper-element's `MutationObserver` sees the childList change and re-renders
automatically.

### Programmatic API on the host element

The `<json-render>` element exposes two conveniences for consumers that
programmatically manage specs (e.g. an LLM chat client replacing the
spec after each tool-use round-trip):

```js
const jr = document.querySelector('json-render');

// replaceSpec(spec) — stringify + assign + trigger re-render in one call.
// Accepts either an object (stringified internally) or a pre-serialized
// JSON string (assigned directly, no double-encoding).
jr.replaceSpec({ root: 'msg', elements: { msg: { type: 'Text', props: { content: 'Hi' } } } });

// toolUseId — first-class property that mirrors data-tool-use-id.
// Useful for correlating a <json-render> with a specific LLM tool_use
// block when multiple interactive UI fragments exist in one response.
jr.toolUseId = 'tu_abc123';  // stamps data-tool-use-id="tu_abc123"
jr.toolUseId;                // 'tu_abc123'
jr.toolUseId = null;         // removes the attribute
```

## API

```js
import { renderSpec, registerComponent, validateSpec } from 'hyper-element/json-render';

// Render a spec programmatically inside a hyper-element component
hyperElement('my-view', (Html, ctx) => {
  const spec = JSON.parse(ctx.wrappedContent);
  return renderSpec(Html, spec, ctx.element);
});

// Register a custom component type
registerComponent('MyChart', (Html, def, key, kids, hostEl) =>
  Html.wire(def, ':' + key)`<div class="chart">${def.props?.data}</div>`
);

// Validate a spec before rendering
const { valid, errors } = validateSpec(spec);
```

## Spec Format

```json
{
  "root": "card_0",
  "elements": {
    "card_0": {
      "type": "Card",
      "props": { "title": "Approval Required" },
      "children": ["row_0"]
    },
    "row_0": {
      "type": "Row",
      "children": ["btn_ok", "btn_cancel"]
    },
    "btn_ok": {
      "type": "Button",
      "props": { "label": "Approve", "variant": "primary" },
      "on": { "press": { "action": "approve", "params": { "id": "123" } } }
    },
    "btn_cancel": {
      "type": "Button",
      "props": { "label": "Cancel", "variant": "destructive" },
      "on": { "press": { "action": "reject" } }
    }
  }
}
```

## LLM Integration

`getCatalog()` returns a snapshot of every catalog-tagged component, ready
to be fed to an LLM as a system prompt or tool definition. The snapshot is
generated from live registry state, so any new `registerComponent()` call
with `{ render, catalog }` automatically appears in the next snapshot — no
manual sync between render code and the LLM's UI vocabulary.

```js
import { getCatalog } from 'hyper-element/json-render';

const catalog = getCatalog();

// Natural-language system prompt for the LLM. Lists every cataloged
// component with its props (types/required/enum/nullable), children
// capability, and actions, then the { root, elements } output format.
const prompt = catalog.prompt({
  customRules: ['Use Card as the root element for any layout'],
});

// JSON Schema tool definition for Claude/OpenAI function calling. The
// `type.enum` lists every cataloged component name.
const tool = catalog.toolDefinition({
  name: 'render_ui',
  description: 'Render interactive UI components',
});
```

Only components registered with a `catalog` metadata object appear in the
output. Legacy function-only `registerComponent(type, fn)` registrations
render correctly via `<json-render>` and `renderSpec()` but are intentionally
invisible to the LLM — surfacing them would give the LLM types whose props
have no schema.

The returned snapshot is immutable: each catalog entry is deep-cloned and
recursively frozen, and the snapshot instance itself is `Object.freeze`d.
Mutations cannot reach the live registry.

## Component Bridge

Tag a `hyperElement(...)` definition with `jrType` and `jrCatalog` to
auto-register the custom element as a json-render component in a single
declaration. Whenever a spec references that type, json-render
instantiates your custom element instead of a built-in (or instead of
`[unknown: ...]` for entirely new types).

```js
import 'hyper-element/json-render';
import { hyperElement } from 'hyper-element';

hyperElement('product-card', {
  jrType: 'ProductCard',
  jrCatalog: {
    description: 'Product display with price and buy action',
    props: {
      name:  { type: 'string', required: true },
      price: { type: 'number', required: true },
      image: { type: 'string' },
    },
    slots: [],
    actions: {
      press: { description: 'User taps buy', params: { productId: { type: 'string' } } },
    },
  },
  render: (Html, ctx) => {
    // The bridge serialises def.props as JSON onto data-jr-props.
    // The dataset proxy auto-parses it back to a real object on read.
    const { name, price, image } = ctx.dataset.jrProps || {};
    return Html`
      <article class="product-card">
        <img src="${image}" alt="${name}" />
        <h3>${name}</h3>
        <span>$${price}</span>
      </article>`;
  },
});
```

The bridge transports spec data to your custom element via three
attributes:

| Attribute | Source | Read via |
|---|---|---|
| `data-jr-props` | `JSON.stringify(def.props)` | `ctx.dataset.jrProps` (auto-parsed object) |
| `data-jr-children` | `JSON.stringify(def.children)` (raw spec keys) | `ctx.dataset.jrChildren` (auto-parsed array) |
| `data-jr-on` | `JSON.stringify(def.on)` | `ctx.dataset.jrOn` (auto-parsed object) |

Pre-rendered child DOM (from other registered components) is also
appended as light-DOM children at construction time, available for
inspection in `setup()` before the custom element's first `render()`
fires.

Interactive bridged components dispatch `jr-action` CustomEvents
themselves — wire your `onclick`/`onchange`/`onkeydown` handlers to read
the `ctx.dataset.jrOn` payload and call
`element.dispatchEvent(new CustomEvent('jr-action', { bubbles: true,
composed: true, detail: { action, params } }))`.

### Override semantics

- **Global only.** `jrType: 'Card'` overrides the built-in `Card`
  everywhere. There is no per-instance opt-out in v1.
- **Last-write-wins** with `console.warn` on collision: registering a
  second component with the same `jrType` replaces the first and emits
  a warning. The built-in-override path additionally emits the existing
  warning from `registerComponent`.
- **Custom types welcome.** `jrType: 'MyCustomChart'` works without
  any built-in to override — it simply becomes a new known type.
- A `jrType` without a `jrCatalog` registers the render function only
  (legacy mode). The component renders correctly via `<json-render>` and
  `renderSpec()`, but is intentionally invisible to `getCatalog()` and
  the LLM schema output.

## Events

Interactive components dispatch `jr-action` CustomEvents that bubble
up from the `<json-render>` host element:

```js
document.querySelector('json-render').addEventListener('jr-action', (e) => {
  console.log(e.detail.action);  // "approve"
  console.log(e.detail.params);  // { id: "123" }
});
```

## Interaction lifecycle (auto-busy)

When any interactive descendant dispatches `jr-action`, the
`<json-render>` host automatically marks itself with
`data-jr-busy="true"` and `data-jr-busy-action="<name>"`. CSS rules
in `json-render.css` use that attribute to disable every interactive
descendant — buttons, checklist toggles, text fields — until the
host's `textContent` is replaced with a new spec (typically the
LLM's response to the action).

This means consumers do **not** need to:

- track which component was clicked
- manually disable buttons after dispatch
- re-enable controls when the next spec arrives
- wire any per-component "loading" state

The lock auto-engages on dispatch and auto-releases on the next
`element.textContent = JSON.stringify(spec)` assignment.

```js
const jr = document.querySelector('json-render');

// Forward actions to your backend / LLM
jr.addEventListener('jr-action', async (e) => {
  // <json-render> already set data-jr-busy="true" by the time this
  // listener runs (capture phase). The user CAN'T click again.
  const result = await fetch('/api/action', {
    method: 'POST',
    body: JSON.stringify({ action: e.detail.action, params: e.detail.params }),
  });
  const nextSpec = await result.json();
  // Replacing textContent triggers re-render and clears data-jr-busy
  jr.textContent = JSON.stringify(nextSpec);
});
```

### Opt-out

Set `data-jr-busy-mode="off"` on the host element to disable the
auto-busy behavior. Use this when the consumer wants exclusive
control over interaction state (e.g. selectively disabling only
the dispatching button rather than the whole tree, or surfacing a
custom overlay instead of the CSS-driven lock).

```html
<json-render data-jr-busy-mode="off">{ ...spec... }</json-render>
```

### CSS hooks

The visual lock is purely CSS — override these selectors in your
own stylesheet to customize:

```css
/* Tighten or loosen the dim while busy */
json-render[data-jr-busy] .jr-root { opacity: 0.5; }

/* Hide the spinner overlay if you prefer the dim alone */
json-render[data-jr-busy] .jr-btn:not(.loading)::after { display: none; }

/* Highlight a specific in-flight action */
json-render[data-jr-busy-action='approve'] .jr-btn { border-color: var(--jr-success); }
```

## Theming

Override CSS custom properties to customize the visual appearance:

```css
:root {
  --jr-accent: #3b82f6;      /* Primary accent color */
  --jr-bg: #1a1a2e;           /* Background */
  --jr-surface: #16213e;      /* Surface elements */
  --jr-text: #e4e4e7;         /* Primary text */
  --jr-radius: 12px;          /* Border radius */
}
```
