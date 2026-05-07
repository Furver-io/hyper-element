# src/layout Files

## Directory Structure

```
src/layout/
├── README.md
├── dom.js
├── element.js
├── engine.js
├── events.js
├── files.md
├── geometry.js
├── index.js
├── interactions.js
├── placeholder.js
├── positions.js
├── properties.js
├── removal.js
├── state.js
└── styles.js
```

## Files

### `README.md`

Developer-facing guide for the optional Hyper Layout subsystem. Documents the
parent-owned identity model, controlled and uncontrolled usage, edit-mode
behavior, custom overlays, removal zones, persistence format, and public
methods/events.

### `dom.js`

DOM adapter for layout item wrappers. Owns direct-child wrapping, wrapper
metadata, default and custom overlay mounting, Hyper Element shared-attribute
handoff for overlay inputs, focusability changes, and per-node style
application.

### `element.js`

`<hyper-layout>` custom element coordinator. Installs the engine, public
properties, observers, pointer interactions, public methods, event entrypoints,
and layout application flow while delegating algorithms to the smaller modules.

### `engine.js`

DOM-free layout engine. Normalizes grid nodes, enforces constraints, finds empty
slots, pushes collisions, handles same-size swaps and ordered insertion,
compacts nodes, removes nodes, saves positions, and scales layouts across
column changes.

### `events.js`

GridStack-style event adapter. Builds current position snapshots, dispatches
`added`, `removed`, `change`, drag, and resize events, and preserves Hyper
Element ergonomics by calling `onchange(event, positions)` and
`onremoved(event, ids)` handlers.

### `files.md`

Directory inventory for documentation and hook validation. Keeps every layout
source file listed in both the tree and file descriptions so new contributors
can navigate the subsystem without reading every module first.

### `geometry.js`

Grid and pixel math helpers. Resolves column counts from explicit settings,
host-width breakpoints, or target cell width, then converts between grid nodes
and host-relative pixel rectangles.

### `index.js`

Optional public subpath entrypoint. Registers `<hyper-layout>` and exports the
layout element class, engine factory, position normalization, parsing, and
reconciliation helpers.

### `interactions.js`

Pointer interaction adapter. Captures drag and resize gestures from editor
overlays, detaches the active wrapper visually, updates placeholders, computes
50-percent insertion intent, previews trash removal, and commits engine changes
on pointer release.

### `placeholder.js`

Internal drag placeholder adapter. Owns the ignored snap-preview element and
the grid-to-pixel positioning used while a dragged wrapper floats above the
layout.

### `positions.js`

Persistence and identity adapter. Parses JSON or object inputs, normalizes item
capabilities and constraints, reconciles ordered `items` with persisted
positions, detects added/orphaned IDs, and serializes canonical state.

### `properties.js`

IDL property installer for `<hyper-layout>`. Reads rich values from direct
properties, Hyper Element shared-attribute placeholders, or JSON attributes, and
queues reconciliation after parent renders settle.

### `removal.js`

Trash/removal adapter. Resolves external trash-zone selectors, detects pointer
and wrapper overlap, applies destructive preview styling, and decides whether a
drop should remove an item.

### `state.js`

Reconciliation flow. Aligns direct children with item identities, resolves
responsive columns, reloads controlled or internal positions, applies engine
state to wrappers, and emits item reconciliation changes.

### `styles.js`

Runtime CSS installer. Defines host layout rules, positioned wrappers, static
and edit-mode overlays, greyscale freeze/hover restoration, placeholders,
default drag/resize controls, and trash-active visual states.
