# +styled Inline Styling System

React-outline inspired styling system for hyper-element. Provides component-scoped styling with prop flags, logic functions, color palettes, and selector-capable generated CSS when a `+styled` style object contains selector keys.

## Overview

The `+styled` suffix on template tags enables the styled system:

```javascript
hyperElement('my-component', {
  styled: [
    { div: { padding: '10px', color: 'primary' } },
    { div: (val, ctx, store) => ({ opacity: store.loading ? 0.5 : 1 }) },
  ],
  render: (Html) => Html`<div+styled>Content</div>`,
});
```

## Key Concepts

### Styled Config Array

The `styled` option is a two-element array:

- `styled[0]` - Base styles object mapping tag names to style objects
- `styled[1]` - Logic functions object mapping tag names to functions

### Base Styles

Simple syntax applies styles directly:

```javascript
{ div: { padding: '10px', margin: '5px' } }
```

When a style object contains selector keys, base declarations move into a generated scoped stylesheet so selectors such as `:hover` can override them through normal CSS cascade:

```javascript
{
  article: {
    padding: '12px',
    color: 'black',
    ':hover': { color: 'blue' },
    '@media (max-width: 600px)': { padding: '8px' },
    ' .title': { fontWeight: 'bold' }
  }
}
```

The rendered node receives generated `he-s-*` / `he-v-*` / `he-i-*` class tokens, and the renderer appends one root-owned `<style data-hyper-styled-root="...">` host after the component's user-authored children. Inline-only definitions still render as inline styles and do not create a style host.

Nested syntax enables prop flags:

```javascript
{ div: {
  base: { padding: '10px' },
  error: { borderColor: 'red' },
  large: { fontSize: '24px' }
} }
```

### Prop Flags

Static prop flags via HTML attributes:

```html
<div+styled error large>Error content</div>
```

Dynamic prop flags via style object:

```javascript
Html`<div+styled style=${{ error: hasError, large: isLarge }}>Content</div>`;
```

Dynamic attributes whose names match known variants are also consumed by `+styled` and do not become DOM attributes:

```javascript
Html`<article+styled error=${ctx.attrs.error}>Content</article>`;
```

### Logic Functions

Logic functions compute styles dynamically:

```javascript
{
  div: (styleValue, ctx, store) => ({
    color: ctx.attrs.textcolor || 'black',
    opacity: store.loading ? 0.5 : 1,
  });
}
```

Logic functions may return selector-capable style objects. If the result contains selector keys, normal declaration keys from that same result are emitted as generated CSS instead of inline styles.

### css Overrides

`css=${...}` on a `+styled` element is a selector-only instance override. It is consumed by the styled system, never emitted as a DOM attribute, and is ordered after definition selector rules:

```javascript
Html`
  <article+styled
    css=${{ ':hover': { color: ctx.attrs.hoverColor || 'green' } }}
  >
    Content
  </article>
`;
```

Changing or removing the `css` value removes stale generated classes and rules on the next render. Declaration keys such as `color` are ignored with a development warning; put dynamic declarations in `style=${...}` instead.

### defineStyled

`defineStyled()` creates a reusable styled config and direct style callables:

```javascript
import hyperElement, { defineStyled } from 'hyper-element';

const cardStyles = defineStyled({
  article: {
    base: { padding: '12px', color: 'black' },
    error: { color: 'red' },
    ':hover': { color: 'blue' },
  },
});

hyperElement('demo-card', {
  styled: cardStyles,
  render: (Html, ctx) => Html`
    <article+styled error=${ctx.attrs.error}>Content</article>
  `,
});

cardStyles.article({ error: true });
// { padding: '12px', color: 'red', ':hover': { color: 'blue' } }

cardStyles.article.inline({ error: true });
// { padding: '12px', color: 'red' }
```

The full callable output is selector-capable data intended for `+styled`. Use `.inline()` when passing a style object to a normal element's native `style=${...}` attribute.

### Color Palettes

Colors are resolved via `withOptions`:

```javascript
const themed = withOptions({ colors: { primary: '#007bff' } });
themed('my-button', {
  styled: [{ button: { color: 'primary' } }],
  render: (Html) => Html`<button+styled>Click</button>`,
});
```

## Style Resolution Order

1. **Base styles** - Tag-specific base styles
2. **Shared selectors** - Comma-separated tag lists (e.g., `'h1, h2': {...}`)
3. **Prop flags** - Variant styles in attribute order
4. **Logic function** - Dynamic computed styles
5. **Color resolution** - Palette color name replacement

Later sources override earlier ones for conflicting properties.

## SSR Support

The styled system supports server-side rendering through the same artifact path as browser rendering. Inline-only styles still output `style=""`; selector-capable styles output generated classes plus one root-owned style host at the end of the rendered component content. Generated CSS escapes `</style` before serialization.

Strict CSP deployments can pass `styleNonce` through `renderElement()` on the server and `configureSSR()` in the browser. SSR serializes the nonce onto the renderer-owned style host, and browser render cycles apply the nonce to created or reused style hosts before updating their text.
