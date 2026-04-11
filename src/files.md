# src/ Files

## Directory Structure

```
src/
├── attributes/
├── core/
├── html/
├── json-render/
├── lifecycle/
├── render/
├── signals/
├── ssr/
├── template/
├── utils/
├── functional.js
├── hyperElement.js
├── index.js
├── package.json
└── withOptions.js
```

## Files

### `hyperElement.js`

Main `hyperElement` base class. Extends `HTMLElement` and provides the core API including `connectedCallback`, `attributeChangedCallback`, `disconnectedCallback`, `setup()`, and `render()` lifecycle methods.

### `functional.js`

Factory function `createFunctionalElement()` that generates hyperElement classes from plain objects or render functions. Supports four signatures: (1) full definition with tag for auto-registration, (2) shorthand render function with tag, (3) definition object without tag for manual registration, (4) shorthand render function without tag.

### `index.js`

Module entry point. Wraps `hyperElement` class in a Proxy to support dual-purpose usage: as a class base for inheritance (`class X extends hyperElement`) or as a factory function (`hyperElement('tag', {...})`) for the functional API. Also re-exports json-render public API: `renderSpec`, `registerComponent`, `validateSpec`.

### `json-render/`

Spec-driven UI rendering module. Turns flat JSON specs (`{ root, elements }`) into live DOM trees using hyper-element's tagged template rendering. Contains renderer, 12 built-in components, extensible registry, spec validator, `<json-render>` custom element (reads its body as JSON), and default CSS. See `json-render/README.md` for full documentation.

### `package.json`

ESM module configuration for the src/ directory. Enables `"type": "module"` for direct ESM imports from source files during development.

### `withOptions.js`

Factory function `withOptions()` that creates a customized hyperElement factory with shared configuration. Supports color palettes for the +styled system, enabling themed components with resolved color values across all components created by the factory.
