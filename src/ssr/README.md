# SSR Module

Server-side rendering and hydration support for hyper-element.

## Overview

This module provides two distinct phases:

1. **Server-Side Rendering** - String-based HTML generation without DOM APIs
2. **Client Hydration** - Event capture and replay for SSR-rendered components

## Usage

### Server (Node.js/Deno/Bun)

```javascript
import { renderElement, createSSRHtml } from 'hyper-element/ssr';

const html = await renderElement('my-component', {
  attrs: { name: 'World' },
  render: (Html) => Html`<div>Hello ${ctx.attrs.name}!</div>`
});
```

### Client (Browser)

```javascript
import { configureSSR } from 'hyper-element';

// Enable dev mode to see hydration indicator
hyperElement.configureSSR({ devMode: true });
```

## Architecture

```
Server Phase                    Client Phase
─────────────                   ──────────────
renderElement()        →        HTML arrives
     ↓                               ↓
createSSRHtml()                 Event capture starts
     ↓                               ↓
string-render.js                buffer.js stores events
     ↓                               ↓
HTML string output              Component hydrates
                                     ↓
                                replay.js replays events
```

## Files

- **server.js** - Main entry point for SSR (Node.js)
- **render-element.js** - Component rendering to string
- **ssr-html.js** - Html template factory for SSR
- **string-render.js** - Core string rendering logic
- **string-update.js** - SSR-compatible update handlers
- **index.js** - Client-side hydration initialization
- **buffer.js** - Event buffering per-element
- **capture.js** - Event capture module
- **replay.js** - Event replay after hydration
- **pathResolver.js** - DOM path calculation/resolution
- **devIndicator.js** - Visual dev mode indicator
