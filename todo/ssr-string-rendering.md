# SSR String Rendering for hyper-element

## Request (Verbatim)

Add server-side string rendering capability to hyper-element, enabling HTML generation without DOM APIs for Node.js/Deno/Bun environments.

---

## Status: COMPLETED

---

## Implementation Summary

### Files Created

| File | Purpose |
|------|---------|
| `src/ssr/server.js` | Main SSR entry point (Node.js) |
| `src/ssr/string-render.js` | Core rendering logic |
| `src/ssr/string-update.js` | String-based update handlers |
| `src/ssr/ssr-html.js` | Html factory for SSR |
| `src/ssr/render-element.js` | Component rendering |
| `test/ssr.test.mjs` | Integration tests (23 tests) |

### Files Modified

| File | Change |
|------|--------|
| `scripts/build.js` | Added SSR build (ESM + CJS) |
| `index.d.ts` | Added SSR type definitions |

### Build Outputs

- `build/hyperElement.ssr.mjs` - ESM bundle (11.7kb)
- `build/hyperElement.ssr.cjs` - CJS bundle (12.3kb)

---

## API

### Basic Usage

```javascript
const { renderElement } = require('hyper-element/ssr/server');

const html = await renderElement('my-component', {
  attrs: { name: 'World' },
  render: (Html, ctx) => Html`<div>Hello ${ctx.attrs.name}!</div>`
});
// → '<my-component name="World"><div>Hello World!</div></my-component>'
```

### With Declarative Shadow DOM

```javascript
const html = await renderElement('my-component', {
  attrs: { name: 'World' },
  shadowDOM: true,
  render: (Html, ctx) => Html`<div>Hello ${ctx.attrs.name}!</div>`
});
// → '<my-component name="World"><template shadowrootmode="open"><div>Hello World!</div></template></my-component>'
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `attrs` | `Object` | `{}` | Attributes for component |
| `store` | `any` | `undefined` | Store data |
| `shadowDOM` | `boolean` | `false` | Declarative Shadow DOM |
| `fragments` | `Object` | `{}` | Fragment functions |
| `render` | `Function` | required | Render function |

---

## Features

### Supported

- String interpolation with XSS escaping
- `Html.raw()` for safe HTML
- `Html.lite()` for lightweight templates
- `Html.wire()` for keyed templates
- Style objects → CSS strings
- Boolean toggle attributes (`?disabled`)
- Spread attributes (`...`)
- Arrays/loops
- Store data access
- Declarative Shadow DOM (optional)
- Async render functions

### Stripped in SSR

- Event handlers (`@click`)
- Direct properties (`.prop`)
- `ref` attribute
- `key` attribute (diffing only)

---

## Testing

23 integration tests passing:
- Basic rendering
- XSS prevention
- Style handling
- Boolean attributes
- Event stripping
- Primitives
- Declarative Shadow DOM

Run tests:
```bash
npm run build && node test/ssr.test.mjs
```

---

## Architecture Notes

The SSR implementation reuses the existing parser from `render/parser.js` which outputs an abstract tree. Instead of converting to DOM, SSR:

1. Creates string-based update handlers (`string-update.js`)
2. Clones the abstract tree for each render
3. Applies values to the cloned tree
4. Calls `.toString()` for final HTML

This approach keeps the SSR code isolated from browser code while reusing the core parsing logic.
