# Hyper Layout

`hyper-element/layout` registers `<hyper-layout>`, an optional dashboard
layout editor for direct child custom elements.

```js
import 'hyper-element/layout';
```

The subpath also exports the core helpers used by the element:

```js
import {
  hyperLayoutElement,
  createLayoutEngine,
  normalizePositions,
  parseLayoutValue,
  reconcilePositions,
} from 'hyper-element/layout';
```

`hyperLayoutElement`, `createLayoutEngine`, and `normalizePositions` are the
primary public entry points. `parseLayoutValue` and `reconcilePositions` are
advanced helpers for applications that need to adapt or inspect persisted
state before assigning it to a host.

## Rationale

Hyper Layout treats placement as a parent-owned concern. The parent knows
which application record each rendered widget represents; the child custom
element is only the visual projection of that record. For that reason,
Hyper Layout does not infer persistent identity from DOM IDs, tag names,
text content, or generated runtime references.

The stable mapping is:

```txt
items[index] -> direct child element at the same index
```

`items[].id` is intentionally opaque. In real applications it is normally a
database ID, UUID, hash, or another record key that has no readable
relationship to the element tag.

`items[].can` is optional edit capability metadata. When omitted, both `drag`
and `resize` are allowed. A value of `['drag']` disables resizing,
`['resize']` disables movement, and `[]` disables both actions. These
capabilities are projected onto engine constraints so the visual overlay and
layout engine enforce the same rule.

## Usage

### Minimal Static Layout

Importing the layout subpath registers the element. With no properties,
`<hyper-layout>` is static and manages ephemeral runtime IDs for its direct
children. This is useful for demos, prototypes, and visual experiments, but
generated IDs are not reload-stable.

```js
import 'hyper-element/layout';

hyperElement('dashboard-shell', {
  render: (Html) => Html`
    <hyper-layout>
      <sales-card></sales-card>
      <risk-chart></risk-chart>
    </hyper-layout>
  `,
});
```

### Editable Uncontrolled Layout

Set `edit` to let the wrapper-owned editor UI capture drag and resize. In
uncontrolled mode the element keeps its own live positions internally until the
parent calls `save()` or removes the element.

```js
hyperElement('editable-dashboard', {
  render: (Html, ctx) => Html`
    <button onclick=${() => (ctx.element.querySelector('hyper-layout').edit = true)}>
      Edit
    </button>
    <hyper-layout edit>
      <sales-card></sales-card>
      <risk-chart></risk-chart>
    </hyper-layout>
  `,
});
```

### Controlled Persistent Layout

Use `<hyper-layout>` inside a Hyper Element render function and pass rich
objects as properties. This is the recommended production pattern because the
parent owns the application data and persistence store:

```js
const items = [
  { id: '9d092e2b-opaque-a', tag: 'sales-card', can: ['drag'] },
  { id: '9d092e2b-opaque-b', tag: 'risk-chart', can: ['drag', 'resize'] },
];

hyperElement('dashboard-view', {
  setup: (ctx) => {
    ctx.handleLayoutChange = (_event, positions) => {
      ctx.element.dispatchEvent(
        new CustomEvent('dashboard-layout-change', {
          bubbles: true,
          detail: { positions },
        })
      );
    };
  },
  render: (Html, ctx) => Html`
    <hyper-layout
      edit=${ctx.attrs.edit}
      items=${items}
      positions=${ctx.attrs.positions}
      onchange=${ctx.handleLayoutChange}
    >
      <sales-card></sales-card>
      <risk-chart></risk-chart>
    </hyper-layout>
  `,
});
```

In this pattern the parent persists `positions` from `onchange` and passes the
latest value back on the next render. Hyper Layout does not mutate the child
widgets or assign layout props to them; it only repositions the internal
wrappers around those direct children.

## Identity Model

If `items` is present, its length must exactly match the number of direct
children. This is a hard failure because Hyper Layout cannot safely apply
persisted positions when it cannot prove which record maps to which child.

Dynamic additions and removals are allowed when the parent updates both the
`items` array and rendered direct children together in the same render. When
that happens, Hyper Layout reconciles positions and emits `change` with
`reason: 'items-reconciled'` so controlled parents can persist the converged
layout state.

## Positions

Canonical positions keep GridStack-compatible core fields and reserve `meta`
for application-specific data:

```js
{
  version: 1,
  columns: 12,
  items: [
    {
      id: '9d092e2b-opaque-a',
      x: 0,
      y: 0,
      w: 4,
      h: 2,
      minW: 1,
      minH: 1,
      maxW: 12,
      maxH: 6,
      locked: false,
      noMove: false,
      noResize: false,
      meta: {}
    }
  ]
}
```

`positions` is optional. When absent, Hyper Layout manages internal state.
When present, it is treated as controlled input and later changes reload the
layout.

## Properties And Methods

Host properties and matching attributes:

- `edit`: boolean, defaults to false.
- `items`: ordered identity manifest. When supplied, its length must match the
  number of direct children.
- `positions`: controlled layout state. When omitted, the host is
  uncontrolled and `save()` marks positions as `ephemeral`.
- `columns`: explicit column count.
- `breakpoints`: host-width rules such as `{ width, columns }`.
- `column-width`: target cell width used for automatic column calculation.
- `max-row`: optional maximum row count.
- `float`: disables automatic compacting when present.
- `compact`: compaction mode metadata for consumers.
- `removable`: `trash`, `outside`, or `both`.
- `trash`: CSS selector for the external trash target.
- `overlay`: optional custom overlay custom-element tag name.
- `serialize`: optional callback used by `save()`.
- `deserialize`: optional callback used by `load()` and controlled
  reconciliation.
- `onremoved`: optional Hyper Element callback for parent-owned removals.
  When a user drops a dragged item onto a configured removal target, Hyper
  Layout calls `handler(event, id, positions, ids)`. The parent should remove
  the matching application record, render one fewer child, and pass the updated
  `items` manifest and `positions` back in.

Host methods:

- `save()`: returns canonical positions or the result of `serialize`.
- `load(positions)`: deserializes and applies positions.
- `compact(mode)`: compacts current engine state and emits `change`.
- `enable()`: sets `edit = true`.
- `disable()`: sets `edit = false`.

## Editing

`edit` defaults to false. In edit mode, Hyper Layout wraps direct children
with drag/stretch controls and a muted overlay. Descendants inside each child
remain owned by that child; nested editable areas require nested
`<hyper-layout>` elements.

Non-hovered items are greyscale and non-interactive while editing. Hovered or
actively edited items restore normal color and display the overlay above the
child. The default overlay uses a transparent backdrop blur rather than a
solid background so it works on light and dark child components.

## Custom Overlays

Pass a custom overlay element tag with `overlay`:

```html
<hyper-layout
  edit=${true}
  items=${items}
  positions=${positions}
  overlay="sample-overlay"
>
  <sales-card></sales-card>
  <risk-chart></risk-chart>
</hyper-layout>
```

Hyper Layout creates one overlay element per wrapped item and passes typed
context through normal Hyper Element `ctx.attrs`:

- `layout-id` attribute
- `can-drag` and `can-resize` attributes
- `ctx.attrs.can` containing the normalized capability array
- `ctx.attrs.item` containing the matching manifest item
- `ctx.attrs.node` containing the current engine node
- `ctx.attrs.drag(event)` callback
- `ctx.attrs.resize(event)` callback

The overlay does not need to add Hyper Layout marker attributes. If an item can
only drag, the entire overlay starts drag. If it can only resize, the entire
overlay starts resize. If it can do both, the lower-right region is treated as
resize and the remaining area is treated as drag. Custom overlays that want
precise regions can call `ctx.attrs.drag(event)` and
`ctx.attrs.resize(event)` directly from their own pointer handlers.

When `removable="trash"` or `removable="both"` is active, a dragged item shows
a destructive preview as soon as either the pointer enters the configured
`trash` target or the floating item rectangle overlaps that target. The default
preview reduces the dragged item to 50% opacity, scales it to 80%, changes the
overlay color to red, and swaps the move icon for a trash icon. Hyper Layout
also sets `data-hl-removing="true"` on the overlay element while this state is
active so custom overlays can style the same drop intent without receiving a
framework-private DOM reference.

The overlap test is based on the unscaled layout footprint inset by the same
20% shrink used by the visual preview. That avoids edge flicker where the card
would barely touch trash at full size, shrink away from it, and then toggle the
preview repeatedly. Once the trash preview is active, releasing the pointer is
treated as a removal request; the visual state and final behavior intentionally
share the same contract.

Example custom overlay:

```js
hyperElement('sample-overlay', {
  render: (Html, ctx) => Html`
    <div
      style=${{
        display: 'grid',
        height: '100%',
        placeItems: 'center',
        width: '100%',
        color: '#5147f0',
        backdropFilter: 'blur(3px)',
      }}
      onpointerdown=${(event) => {
        if (ctx.attrs.can.includes('drag')) ctx.attrs.drag(event);
      }}
    >
      <button
        type="button"
        disabled=${!ctx.attrs.can.includes('drag')}
        onpointerdown=${ctx.attrs.drag}
      >
        Move
      </button>
      <button
        type="button"
        disabled=${!ctx.attrs.can.includes('resize')}
        onpointerdown=${ctx.attrs.resize}
      >
        Resize
      </button>
    </div>
  `,
});
```

## Events

The element mirrors GridStack-style event names:

- `added`
- `removed`
- `change`
- `dragstart`
- `dragstop`
- `resizestart`
- `resizestop`

`change` detail includes:

```js
{
  reason: 'items-reconciled',
  positions,
  nodes: [],
  added: ['new-id'],
  removed: [],
  orphaned: []
}
```

For Hyper Element ergonomics, assigning `onchange=${handler}` calls
`handler(event, positions)`. Standard DOM listeners still receive a normal
single-argument `CustomEvent`.

Assigning `onremoved=${handler}` calls
`handler(event, id, positions, ids)` where `id` is the opaque ID from the
parent-provided `items` manifest. Hyper Layout removes the engine node and
emits the event; the parent remains responsible for removing its application
data and rendering the updated child list.

## Kitchen Sink Coverage

`examples/kitchensink/hyper-layout.html` is the scenario coverage page for
this subsystem. It includes separate controlled, uncontrolled, and custom
overlay examples. It also exercises static mode, edit mode, direct-child
wrapping, opaque ordered IDs, validation failures, capability constraints,
custom serialization, drag, resize, collision push, swap, locked/no-move/
no-resize constraints, responsive columns, trash/outside removal, `load()`,
`compact()`, `enable()`, and `disable()` through browser entry points.

The kitchen sink examples are intentionally source-driven: the displayed code
block is executed to render the live example below it. When updating examples,
change the displayed source first so the rendered demo, browser behavior, and
documentation stay in lockstep.

## Common Mistakes

- Do not rely on DOM IDs or tag names for persistence. Use `items[].id`.
- Do not pass `items` without rendering the same number of direct children.
- Do not expect descendants to become draggable. Wrap each editable level in
  its own `<hyper-layout>`.
- Do not read custom overlay inputs from `ctx.element`. Hyper Element overlay
  inputs are passed through `ctx.attrs`.
- Do not persist uncontrolled `save()` output unless you accept that generated
  IDs are ephemeral.
