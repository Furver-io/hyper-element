# src/ssr

## Directory Structure

```
src/ssr/
├── server.js          # Main SSR entry point
├── render-element.js  # Component rendering
├── ssr-html.js        # Html template factory
├── string-render.js   # Core string rendering
├── string-update.js   # SSR update handlers
├── styled-render.js   # Final +styled artifact application
├── styled-update.js   # +styled SSR update handlers
├── index.js           # Client hydration init
├── buffer.js          # Event buffer
├── capture.js         # Event capture
├── replay.js          # Event replay
├── pathResolver.js    # DOM path utils
└── devIndicator.js    # Dev mode indicator
```

## Files

### `server.js`

Main entry point for server-side rendering. Exports `renderElement`, `renderElements`, `createRenderer`, and SSR Html utilities. Use this in Node.js, Deno, or Bun.

### `render-element.js`

Renders a component definition to an HTML string. Handles attrs serialization, Declarative Shadow DOM, and async render functions.

### `ssr-html.js`

Creates the SSR Html tagged template function. Mirrors the browser createHtml but outputs strings. Handles fragments, wire(), and raw().

### `string-render.js`

Core string-based rendering logic. Parses templates, creates virtual nodes, and serializes to HTML strings.

### `string-update.js`

SSR-compatible update handlers that mirror render/update.js. Returns values/strings instead of mutating DOM nodes.

### `styled-render.js`

Applies selector-capable +styled artifacts to SSR parser nodes just before serialization. Merges generated classes, consumes css/variant attributes, and registers root style-host rules.

### `styled-update.js`

Records SSR `style`, `css`, and dynamic variant inputs for +styled nodes so `styled-render.js` can resolve one shared browser/SSR artifact at serialization time.

### `index.js`

Client-side hydration initialization. Auto-starts event capture when the library loads. Configures SSR options, stores the optional browser `styleNonce` for generated `+styled` style hosts, and manages capture state.

### `buffer.js`

Event buffer management. Stores captured events per-element until hydration completes and they can be replayed.

### `capture.js`

Event capture module. Listens for user interactions on SSR-rendered components and stores them for replay.

### `replay.js`

Event replay after hydration. Creates synthetic events from buffered data and dispatches them on hydrated elements.

### `pathResolver.js`

DOM path calculation and resolution. Uses nth-of-type indexing to create stable paths between elements.

### `devIndicator.js`

Visual development mode indicator. Shows a badge when SSR capture is active (useful for debugging).
