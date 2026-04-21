# json-render/ Files

## Source Files

### `index.js`

Public API entry point. Exports `renderSpec()`, `registerComponent()`,
`validateSpec()`, `listComponentTypes()`, `getCatalog()`, and the
built-in component list. Delegates to `registry.js` for the shared
component registry and auto-registers the `<json-render>` element on import.

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

**Checklist local state:** The per-spec optimistic boolean array is
owned by `checklist-state.js` (see below). `components.js` imports
`getChecklistState(hostEl, specKey, items)` and reads/mutates the
returned array inside `renderChecklist`. Toggles mutate the array in
place, dispatch `jr-action` for gateway-authoritative flows, and call
`hostEl.render()` to re-run the `<json-render>` render pipeline
(Html.wire-keyed node identity keeps the patch surgical).

### `checklist-state.js`

Per-host optimistic state store for the Checklist component.
Module-level `WeakMap<hostEl, Map<specKey, { fingerprint, checked }>>`
with a label-based fingerprint that distinguishes self-triggered
re-renders (same labels → reuse `checked` array) from a genuine spec
replacement (different labels → seed fresh state from
`props.items[i].checked`). Keying by host (not by `def` identity) is
necessary because `<json-render>` re-parses its textContent on every
render, producing fresh `def` references each pass — a def-keyed map
would miss on the self-triggered re-render that follows a toggle. The
WeakMap auto-collects entries when the host is removed from the DOM —
no cross-spec state leakage. Extracted from `components.js` so each
file stays under the 260-NCLOC cap and so the storage layout has a
single named home.

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

### `bridge.js`

Component bridge that wraps a hyperElement custom element as a
json-render component. Exports `createBridgedRenderFn(tagName)` which
returns a render function matching the registry signature
`(Html, def, key, kids, hostEl) => Node`. The function imperatively
instantiates `<tagName>` (tag-name interpolation is impossible in
tagged template literals), serialises `def.props`, `def.children`, and
`def.on` into `data-jr-props`, `data-jr-children`, and `data-jr-on`
attributes consumed by the existing dataset proxy, and slots
pre-rendered child Holes/Nodes as light-DOM children. Used by
`createFunctionalElement` (in `src/functional.js`) when a developer
attaches `jrType`/`jrCatalog` to a hyperElement definition; can also
be invoked directly by external `registerComponent` consumers.

### `element.js`

The `<json-render>` custom element definition, created via hyper-element's
functional API (`createFunctionalElement`). Reads its body text content
(`ctx.wrappedContent`) as a JSON spec, handles loading/error states, and
delegates to `renderSpecTree()`. Re-renders automatically when the body
text changes (via hyper-element's MutationObserver). Auto-registers when
imported.

Owns the auto-busy interaction lifecycle: a `setup()` hook installs a
single capture-phase `jr-action` listener on the host element that flips
`data-jr-busy="true"` (and `data-jr-busy-action="<name>"`) whenever any
descendant interactive component dispatches an action. The marker stays
in place — and CSS in `json-render.css` keeps every interactive
descendant disabled — until the next render replaces the spec, at which
point `render()` clears the marker at the top of its body. Consumers
opt out with `data-jr-busy-mode="off"` on the host element.

Exposes a programmatic API on every `<json-render>` instance:
`element.replaceSpec(spec)` stringifies (or assigns a string directly)
and triggers the MutationObserver-driven re-render; `element.toolUseId`
is a getter/setter property that mirrors `data-tool-use-id` on the
host, used by LLM chat clients to correlate specs with tool_use blocks
when multiple interactive fragments appear in a single response;
`element.onaction` is a React-style IDL property for the `jr-action`
CustomEvent — assigning a function registers a single listener,
reassigning atomically replaces it, `null` removes it, and anything
else throws `TypeError`. The same setter is hit by the declarative
form `<json-render onaction=${fn}>…</json-render>` inside a
hyper-element template (the template engine's `directFor` path
lowercases the attribute and performs `element.onaction = fn`).
Teardown removes any active `onaction` listener before deleting the
property descriptor so reconnect cycles start clean.

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
