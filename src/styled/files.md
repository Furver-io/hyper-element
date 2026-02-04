# Styled Module Files

## Directory Structure

```
src/styled/
├── index.js          # Public API exports
├── apply.js          # DOM style application
├── handler.js        # Browser style handler factory
├── parser-hooks.js   # Parser integration hooks
├── registry.js       # Component instance registry
└── resolution.js     # Style resolution logic
```

## Files

### `index.js`

Public API re-exporting all styled system functionality. Serves as the single import point for other modules. SSR functions are re-exported from `src/ssr/string-update.js`.

### `apply.js`

Applies resolved style objects to DOM nodes. Handles camelCase to kebab-case conversion and direct `style` property assignment.

### `handler.js`

Creates style handlers for `+styled` elements in the browser. Uses rendering context or DOM traversal to find component instances. Called by `update.js` when processing style attributes on `+styled` elements.

### `parser-hooks.js`

Parser integration utilities:
- `STYLED_SUFFIX` - The `+styled` suffix constant
- `detectStyledSuffix()` - Checks if tag ends with `+styled`
- `isValidPropFlag()` - Validates potential prop flag attributes

### `registry.js`

WeakMap-based registry mapping component instances to their styled configuration. Stores:
- `styled` - The [base, logic] config array
- `ctx` - Component context (attrs, state)
- `store` - Component store
- `colors` - Color palette from withOptions

Also manages the rendering instance context for first-render scenarios.

### `resolution.js`

Core style resolution logic:
- `resolveColors()` - Replaces color names with hex values
- `isNestedSyntax()` - Detects prop flag mode (has `base` key)
- `resolveStylesWithEntry()` - Main resolution (base → shared → flags → logic → colors)
- `resolveStyles()` - Public API wrapping registry lookup
