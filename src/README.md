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
- `ssr/` - Server-side rendering modules:
  - `renderElement`, `renderElements`, `createRenderer` - Component rendering
  - `ssrHtml` - Tagged template literal for server (SVG auto-detected via `<svg>` tags)
  - `configureSSR`, `markTagRegistered` - Client-side hydration setup
