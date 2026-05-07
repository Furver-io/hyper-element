# src/

Source code for hyper-element, a base class for creating custom elements with hyperHTML templating.

## Overview

This module provides the `hyperElement` base class that extends `HTMLElement` to enable:

- Reactive rendering with hyperHTML
- Automatic attribute parsing with type coercion
- Dataset proxy with JSON serialization
- Handlebars-like template syntax (`{#each}`, `{#if}`, `{#unless}`)
- Shared attribute passing between parent/child custom elements
- Server-side rendering with progressive hydration

## Usage

```javascript
import { hyperElement } from 'hyper-element';

class MyElement extends hyperElement {
  render(Html) {
    Html`<div>Hello ${this.attrs.name}</div>`;
  }
}
customElements.define('my-element', MyElement);
```

## Exports

- `hyperElement` - Base class for custom elements
- `layout/` - Optional `<hyper-layout>` dashboard layout editor:
  - `hyperLayoutElement` - Auto-registered custom element
  - `createLayoutEngine` - DOM-free grid placement engine
  - `normalizePositions` - Canonical positions helper
  - `items` - Ordered parent-owned identity manifest mapped to direct children by index
  - `positions` - Controlled or uncontrolled GridStack-compatible layout state
  - `items[].can` and `overlay` - Capability-driven edit controls and custom edit overlays using `ctx.attrs.drag(event)` / `ctx.attrs.resize(event)`
  - `removable` and `trash` - Parent-owned removal with active drag previews and `onremoved(event, id, positions, ids)`
- `ssr/` - Server-side rendering modules:
  - `renderElement`, `renderElements`, `createRenderer` - Component rendering
  - `ssrHtml` - Tagged template literal for server (SVG auto-detected via `<svg>` tags)
  - `configureSSR`, `markTagRegistered` - Client-side hydration setup
