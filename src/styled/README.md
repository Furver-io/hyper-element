# +styled Inline Styling System

React-outline inspired inline styling system for hyper-element. Provides component-scoped styling with prop flags, logic functions, and color palettes.

## Overview

The `+styled` suffix on template tags enables the styled system:

```javascript
hyperElement('my-component', {
  styled: [
    { div: { padding: '10px', color: 'primary' } },
    { div: (val, ctx, store) => ({ opacity: store.loading ? 0.5 : 1 }) }
  ],
  render: (Html) => Html`<div+styled>Content</div>`
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
Html`<div+styled style=${{ error: hasError, large: isLarge }}>Content</div>`
```

### Logic Functions

Logic functions compute styles dynamically:
```javascript
{ div: (styleValue, ctx, store) => ({
  color: ctx.attrs.textcolor || 'black',
  opacity: store.loading ? 0.5 : 1
}) }
```

### Color Palettes

Colors are resolved via `withOptions`:
```javascript
const themed = withOptions({ colors: { primary: '#007bff' } });
themed('my-button', {
  styled: [{ button: { color: 'primary' } }],
  render: (Html) => Html`<button+styled>Click</button>`
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

The styled system supports server-side rendering, outputting inline `style` attributes in the rendered HTML. Hydration preserves the styles.
