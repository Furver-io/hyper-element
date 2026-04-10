# json-render/ Files

## Source Files

### `index.js`

Public API entry point. Exports `renderSpec()`, `registerComponent()`,
`validateSpec()`, and the built-in component list. Manages the extensible
component registry and auto-registers the `<jr-ui>` element on import.

### `renderer.js`

Core recursive tree builder. `renderNode()` walks a flat elements map
and dispatches each node to its registered component render function.
`renderSpecTree()` is the top-level entry that validates the root and
wraps the result. Uses `Html.wire()` for efficient keyed DOM reuse.

### `components.js`

All 12 built-in component render functions: Card, Row, Column, Button,
Text, Alert, Progress, Divider, CodeBlock, Image, Checklist, TextField.
Each follows the signature `(Html, def, key, kids, hostEl) => template`.
Interactive components dispatch `jr-action` CustomEvents via `dispatchAction()`.
Exports `BUILT_IN_COMPONENTS` map pairing render functions with catalog metadata.

### `catalog.js`

Structured metadata for all built-in component types. Each entry describes
the component's purpose, props (with types, constraints, defaults), slots,
and actions — used by `getCatalog()` to generate LLM-consumable schemas
and prompts. Separated from `components.js` to keep both files under the
project line-count limit.

### `element.js`

The `<jr-ui>` custom element definition, created via hyper-element's
functional API (`createFunctionalElement`). Reads `data-spec` JSON,
handles loading/error states, and delegates to `renderSpecTree()`.
Auto-registers when imported.

### `validator.js`

Spec validation. `validateSpec(spec, customTypes?)` checks 7 rules:
root exists, children resolve, no circular references, known types,
Button has action, Progress value 0-100, Checklist items shape.
Returns all violations, not just the first.

### `json-render.css`

Self-contained CSS for all component types. Defines its own `--jr-*`
custom properties for colors, spacing, and typography — not dependent
on the host application's CSS variables. Dark-mode compatible, themeable.

### `FILES.md`

This file. Index of every source file in the json-render module with
its specific responsibility.
