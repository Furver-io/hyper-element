# json-render/ Files

## Source Files

### `index.js`

Public API entry point. Exports `renderSpec()`, `registerComponent()`,
`validateSpec()`, `listComponentTypes()`, `getCatalog()`, and the
built-in component list. Delegates to `registry.js` for the shared
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

### `registry.js`

Shared component registry. Houses the mutable `registry` Map (initialized
from `BUILT_IN_COMPONENTS`) and the read-only `registryInterface` facade
(`{ get, all }`). Extracted from `index.js` so that both `index.js` and
`element.js` can import the registry without creating a circular dependency.

### `catalog-metadata.js`

Internal metadata data — the `CATALOG` constant containing structured
props/slots/actions descriptors for every built-in component type. Consumed
only by `components.js` via the `BUILT_IN_COMPONENTS` map builder. Split
out from `catalog.js` so the public catalog API file can stay under the
200 NCLOC limit.

### `catalog.js`

Public catalog API. Exports `getCatalog()` which walks the shared
`registryInterface`, filters to entries with catalog metadata (legacy
function-only registrations are excluded), and returns a frozen
`CatalogSnapshot` with `.types` (Map of cataloged metadata),
`.prompt(options?)` (natural-language LLM system prompt with optional
`customRules`), and `.toolDefinition(options?)` (Claude/OpenAI JSON
Schema tool definition with a `type.enum` listing every cataloged type).
Aligned with the json-render.dev catalog/schema patterns.

### `element.js`

The `<jr-ui>` custom element definition, created via hyper-element's
functional API (`createFunctionalElement`). Reads `data-spec` JSON,
handles loading/error states, and delegates to `renderSpecTree()`.
Auto-registers when imported.

### `validator.js`

Spec validation. `validateSpec(spec, customTypes?)` checks 7 rules:
root exists, children resolve, no circular references, known types,
Button has action, Progress value 0-100, Checklist items shape.
Returns all violations, not just the first. Reads known types from
the shared registry (`registry.js`), so custom-registered components
are automatically recognized without passing `customTypes`.

### `json-render.css`

Self-contained CSS for all component types. Defines its own `--jr-*`
custom properties for colors, spacing, and typography — not dependent
on the host application's CSS variables. Dark-mode compatible, themeable.

### `FILES.md`

This file. Index of every source file in the json-render module with
its specific responsibility.
