# Render Core

Custom uhtml-inspired rendering system for hyper-element. Provides efficient tagged template literal rendering with selective DOM updates.

## Overview

This module implements the core rendering engine that replaces hyperHTML. It uses:

- **NUL placeholder parsing** - Template strings joined with `\x00` to identify interpolation points
- **Template caching** - Parsed templates cached by TemplateStringsArray identity
- **Path-based traversal** - Fast DOM node location via child index arrays
- **Selective updates** - Only changed values trigger DOM mutations
- **Efficient diffing** - udomdiff algorithm for array reconciliation

## Key Concepts

### Hole Class

The `Hole` class represents a parsed template with values:

```javascript
const hole = html`<div>${value}</div>`;
// hole.t = [fragment, updates, keyed?]
// hole.v = [value]
// hole.n = rendered DOM node
```

### Template Caching

Templates are cached by TemplateStringsArray identity. All calls to `html` with the same template literal share the cache:

```javascript
// These share the same cached template
items.map((item) => html`<li>${item.name}</li>`);
```

### Update Types

Interpolations are classified by type flags for specialized handling:

- `ATTRIBUTE` - Standard HTML attributes
- `EVENT` - Internal render-core event listener path
- `TEXT` - textContent interpolation
- `COMMENT` - Node interpolation (between tags)
- `ARRAY` - Array of values/nodes
- `TOGGLE` - Internal render-core boolean toggle path
- `KEY` - Keyed array item tracking

## Usage

```javascript
import { html, bind, wire } from './render/index.js';

// Create a hole
const greeting = html`<h1>Hello ${name}</h1>`;

// Bind to an element
const render = bind(element);
render`<div>${content}</div>`;

// Keyed templates
const item = wire(obj, ':id')`<li>${obj.name}</li>`;
```
