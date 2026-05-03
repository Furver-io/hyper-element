# Styled Module Files

## Directory Structure

```
src/styled/
├── index.js          # Public API exports
├── apply.js          # DOM style application
├── artifact.js       # Shared browser/SSR artifact orchestration
├── artifact-colors.js # Palette resolution helpers
├── artifact-compose.js # Generated artifact phase assembly
├── artifact-direct.js # defineStyled() direct callable resolver
├── artifact-ids.js   # Deterministic class/rule identifiers
├── artifact-rules.js # Generated CSS rule assembly
├── artifact-tags.js  # Normalized tag/shared-group lookup helpers
├── define-styled.js  # Public defineStyled() helper
├── handler.js        # Browser style handler factory
├── normalize.js      # Styled definition normalizer
├── parser-hooks.js   # Parser integration hooks
├── reserved.js       # Reserved native/pass-through attribute classifier
├── registry.js       # Component instance registry
├── resolution.js     # Legacy inline style resolution helper (not imported by runtime)
├── serializer.js     # Scoped CSS serialization and selector scoping
└── style-host.js     # Root-owned style host registry
```

## Files

### `index.js`

Public API re-exporting all styled system functionality. Serves as the single import point for other modules. SSR functions are re-exported from `src/ssr/string-update.js`.

### `apply.js`

Applies resolved style objects and styled artifacts to DOM nodes. Handles camelCase to kebab-case conversion, managed inline style diffs, and generated class-token diffs that preserve user classes.

### `artifact.js`

Orchestrates the canonical styled artifact consumed by both browser rendering and SSR. Splits inline declarations from generated CSS, applies cascade ordering, and handles `style=${...}` / `css=${...}` inputs while delegating focused work to the artifact helper modules.

### `artifact-colors.js`

Resolves palette aliases in declaration maps and selector rule declaration maps before they become inline CSS or generated stylesheet text.

### `artifact-compose.js`

Assembles generated base, variant, selector, dynamic CSS, and instance override classes/rules for the main artifact resolver. This keeps each cascade phase explicit without putting every helper in `artifact.js`.

### `artifact-direct.js`

Resolves `defineStyled().tag()` direct callable output. Full mode preserves selector keys for `+styled`; inline mode returns declaration-only objects for native `style=${...}` usage.

### `artifact-ids.js`

Owns deterministic class-token and rule-ID generation. Browser rendering and SSR use these helpers so generated CSS scopes match across runtime modes.

### `artifact-rules.js`

Builds generated class, selector, and at-rule CSS records in the cascade order required by the selector backend.

### `artifact-tags.js`

Combines tag-specific styles with matching shared tag groups so the artifact resolver receives one effective normalized style per rendered tag.

### `define-styled.js`

Exposes `defineStyled()` as the public helper for reusable styled definitions. The returned value remains compatible with the existing styled tuple and adds non-enumerable tag callables for full selector-capable objects and inline-only objects.

### `handler.js`

Creates style, css, and styled-aware attribute handlers for `+styled` elements in the browser. Uses rendering context or DOM traversal to find component instances. Called by `update.js` when processing `style`, `css`, and dynamic variant attributes on `+styled` elements.

### `normalize.js`

Converts public styled definitions into a canonical shape with tag styles, shared groups, base declarations, variants, selector rules, and supported at-rules. Unsupported at-rules are ignored with a development warning.

### `reserved.js`

Centralizes the attribute names that must keep native DOM/SSR behavior on `+styled` nodes. Browser parsing, browser updates, and SSR updates all use the same classifier so reserved names such as `disabled`, `href`, `data-*`, and `aria-*` are not consumed as style variants.

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

Legacy inline resolution helper retained for source compatibility while the runtime uses `artifact.js` for browser and SSR rendering. New selector-capable behavior should not add dependencies here.

### `serializer.js`

Serializes generated CSS declarations, scoped selectors, supported at-rules, selector lists, and SSR-safe style tag text. It also exports `toKebab()` for consistent inline and generated property names.

### `style-host.js`

Owns the renderer-managed style host lifecycle. Browser rendering uses mark/sweep registration per render root and can apply a CSP nonce from `configureSSR({ styleNonce })`; SSR uses the same rule text to append one style host string per rendered component root and can serialize `renderElement({ styleNonce })`.
