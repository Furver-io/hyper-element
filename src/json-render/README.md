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

<!-- Import registers <jr-ui> automatically -->
<script type="module">
  import 'hyper-element/json-render';
</script>

<!-- Use it -->
<jr-ui data-spec='{"root":"msg","elements":{"msg":{"type":"Text","props":{"content":"Hello from json-render!"}}}}'></jr-ui>
```

## API

```js
import { renderSpec, registerComponent, validateSpec } from 'hyper-element/json-render';

// Render a spec programmatically inside a hyper-element component
hyperElement('my-view', (Html, ctx) => {
  const spec = JSON.parse(ctx.attrs['data-spec']);
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
render correctly via `<jr-ui>` and `renderSpec()` but are intentionally
invisible to the LLM — surfacing them would give the LLM types whose props
have no schema.

The returned snapshot is immutable: each catalog entry is deep-cloned and
recursively frozen, and the snapshot instance itself is `Object.freeze`d.
Mutations cannot reach the live registry.

## Events

Interactive components dispatch `jr-action` CustomEvents that bubble
up from the `<jr-ui>` host element:

```js
document.querySelector('jr-ui').addEventListener('jr-action', (e) => {
  console.log(e.detail.action);  // "approve"
  console.log(e.detail.params);  // { id: "123" }
});
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
