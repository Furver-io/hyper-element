# src/ Files

## Directory Structure

```
src/
├── attributes/
├── core/
├── html/
├── json-render/
├── lifecycle/
├── layout/
├── render/
├── signals/
├── ssr/
├── template/
├── utils/
├── functional.js
├── hyperElement.js
├── index.js
├── package.json
└── withOptions.js
```

## Files

### `hyperElement.js`

Main `hyperElement` base class. Extends `HTMLElement` and provides the core API including `connectedCallback`, `attributeChangedCallback`, `disconnectedCallback`, `setup()`, and `render()` lifecycle methods.

### `functional.js`

Factory function `createFunctionalElement()` that generates hyperElement classes from plain objects or render functions. Supports four signatures: (1) full definition with tag for auto-registration, (2) shorthand render function with tag, (3) definition object without tag for manual registration, (4) shorthand render function without tag. Also performs the json-render bridge side-effect: when a definition carries `jrType` (optionally paired with `jrCatalog`), the factory registers the generated custom element into the shared json-render registry via `createBridgedRenderFn` so any spec referencing that type renders this custom element in place of the built-in fallback.

### `index.js`

Module entry point. Wraps `hyperElement` class in a Proxy to support dual-purpose usage: as a class base for inheritance (`class X extends hyperElement`) or as a factory function (`hyperElement('tag', {...})`) for the functional API. Also re-exports the json-render public API: `renderSpec`, `registerComponent`, `validateSpec`, `listComponentTypes`, and `getCatalog` (the catalog snapshot builder used for LLM prompt / tool-definition generation).

### `json-render/`

Spec-driven UI rendering module. Turns flat JSON specs (`{ root, elements }`) into live DOM trees using hyper-element's tagged template rendering. Contains renderer, 12 built-in components, extensible registry, catalog API for LLM schema generation, component bridge that wires `hyperElement(...)` definitions into the registry via `jrType`/`jrCatalog`, spec validator, `<json-render>` custom element (reads its body as JSON), and default CSS. See `json-render/README.md` for full documentation.

### `layout/`

Optional dashboard layout subsystem. Importing `hyper-element/layout` registers `<hyper-layout>`, which wraps direct child elements in editor-owned grid shells, maps them to an ordered parent-provided `items` manifest, and emits GridStack-style layout events with canonical `positions` state. The subsystem is split into a DOM-free engine, position reconciliation helpers, geometry math, pointer interactions, DOM wrapper helpers, runtime CSS, and the custom element entry point.

Key files:

- `layout/index.js` - Optional public subpath. Registers the custom element and exports the engine plus position helpers.
- `layout/element.js` - Host custom element. Coordinates lifecycle, observers, public methods, layout application, and event entrypoints.
- `layout/state.js` - Reconciliation flow. Aligns direct children, ordered `items`, controlled/uncontrolled positions, responsive columns, wrappers, and engine state.
- `layout/engine.js` - DOM-free placement model. Handles constraints, empty-slot search, collision push, insertion reordering, same-size swaps, compaction, and responsive column scaling.
- `layout/positions.js` - Persistence adapter. Normalizes `items`, parses positions, applies capabilities, detects added/orphaned IDs, and produces canonical `positions`.
- `layout/dom.js` - Wrapper and overlay adapter. Moves direct children into editor-owned shells and passes custom overlay input through Hyper Element `ctx.attrs`.
- `layout/removal.js` - Trash-target adapter. Detects pointer or dragged-wrapper overlap with application-owned trash zones and reflects the active destructive preview state.
- `layout/interactions.js` - Pointer adapter. Captures edit overlay drag/resize, floats the active wrapper, applies 50% coverage insertion, asks the removal adapter for trash previews, and commits changes.
- `layout/geometry.js` - Grid/pixel math. Resolves columns from explicit settings, host-width breakpoints, or target cell width.
- `layout/events.js` - GridStack-style event dispatch plus Hyper Element `onchange(event, positions)` ergonomics.
- `layout/properties.js` - IDL property descriptors and Hyper Element shared-attribute reads for object/function values.
- `layout/styles.js` - Shared runtime CSS for wrapper positioning, edit overlays, greyscale freeze, hover restore, and default controls.

### `package.json`

ESM module configuration for the src/ directory. Enables `"type": "module"` for direct ESM imports from source files during development.

### `withOptions.js`

Factory function `withOptions()` that creates a customized hyperElement factory with shared configuration. Supports color palettes for the +styled system, enabling themed components with resolved color values across all components created by the factory.
