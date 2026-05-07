# Kitchen Sink

Interactive demos and E2E test suite for hyper-element.

## Purpose

This directory serves two purposes:

1. **Interactive Documentation** - Each HTML file demonstrates a specific feature with working code examples
2. **Automated Test Suite** - All demos double as Playwright E2E tests ensuring 100% code coverage

## Demos by Category

### Core Features

- [basic-rendering.html](basic-rendering.html) - Static content rendering with the `Html` template literal
- [setup-async.html](setup-async.html) - Async initialization using `setup()` with `onNext` trigger
- [lifecycle-sequence.html](lifecycle-sequence.html) - Order of `setup()`, `render()`, `teardown()` calls

### Attributes & Data

- [attributes.html](attributes.html) - Accessing element attributes via `this.attrs`
- [observed-attributes.html](observed-attributes.html) - Automatic attribute reactivity via MutationObserver
- [dataset.html](dataset.html) - Using `data-*` attributes with automatic JSON parsing
- [dataset-mutations.html](dataset-mutations.html) - Re-rendering when dataset values change
- [type-coercion.html](type-coercion.html) - Automatic numeric/boolean/JSON parsing of attributes

### Content Handling

- [content-handling.html](content-handling.html) - Accessing content between tags via `this.wrappedContent`
- [content-mutations.html](content-mutations.html) - Re-rendering when wrapped content changes

### Templates & Blocks

- [templates.html](templates.html) - `Html.template()` with `{variable}` substitution
- [advanced-templates.html](advanced-templates.html) - `{+if}`, `{+each}`, `{+unless}` block syntax
- [block-syntax-advanced.html](block-syntax-advanced.html) - Nested blocks, edge cases, null/undefined handling
- [auto-wire-each.html](auto-wire-each.html) - `{+each ${array}}...{-each}` template iteration
- [keyed-templates.html](keyed-templates.html) - Template directives with keys
- [partial-interpolation.html](partial-interpolation.html) - Partial attribute interpolation `class="prefix-${v}"`

### Fragments

- [fragments-async.html](fragments-async.html) - Fragments with promises and placeholders
- [fragments-templates.html](fragments-templates.html) - Fragments using template strings
- [fragment-combinations.html](fragment-combinations.html) - All fragment return types: text/html/any/template

### Rendering

- [keyed-rendering.html](keyed-rendering.html) - `Html.wire()` for efficient keyed list updates
- [xss-prevention.html](xss-prevention.html) - HTML escaping and `Html.raw()` for safe rendering
- [nodes-tostring.html](nodes-tostring.html) - Coverage for `Element.toString()` and `Fragment.toString()`

### Styling

- [styled.html](styled.html) - `+styled` system: base styles, prop flags, logic functions
- [styled-css.html](styled-css.html) - `+styled` selector CSS: generated scoped rules, `css=${...}` overrides, `defineStyled()`, selector-list scoping, and root-owned style hosts

### Composition

- [nested-elements.html](nested-elements.html) - Parent-child custom element composition
- [hyper-layout.html](hyper-layout.html) - `<hyper-layout>` controlled/uncontrolled dashboard editing, capability-driven drag/resize, custom overlays, positions reconciliation, and removal
- [nested-each-deep.html](nested-each-deep.html) - Deeply nested `{+each}` with property references
- [same-type-nesting.html](same-type-nesting.html) - Same custom element nested in itself
- [child-redraw.html](child-redraw.html) - Parent-child attribute passing and re-renders
- [observer-isolation.html](observer-isolation.html) - Descendant re-renders stay local and do not fan out to ancestors
- [child-styles.html](child-styles.html) - Passing style objects to children
- [complex-type-attrs.html](complex-type-attrs.html) - Passing objects/functions to child elements

The Hyper Layout page renders its live demos from the displayed source blocks.
When changing those examples, update the displayed source first so the rendered
demo, documentation, and E2E scenario coverage all describe the same behavior.

### Signals & Reactivity

- [signals.html](signals.html) - `signal()`, `computed()`, `effect()`, `batch()`, `untracked()`

### Events

- [event-callbacks.html](event-callbacks.html) - External event callbacks using `attachStore()`

### Functional API

- [functional-api.html](functional-api.html) - Functional component definition API
- [functional-validation.html](functional-validation.html) - Validation for functional API inputs

### SSR (Server-Side Rendering)

- [ssr-dev-indicator-head.html](ssr-dev-indicator-head.html) - SSR dev-mode indicator visibility
- [ssr-e2e.html](ssr-e2e.html) - Full SSR hydration flow (6 phases)
- [ssr-hydration.html](ssr-hydration.html) - SSR hydration edge cases

### JSON Render

- [json-render-basic.html](json-render-basic.html) - Declarative `<json-render>` rendering from JSON spec
- [json-render-custom.html](json-render-custom.html) - Programmatic `renderSpec` + `registerComponent`
- [json-render-coverage.html](json-render-coverage.html) - JSON render coverage edges
- [json-render-bridge.html](json-render-bridge.html) - `jrType` / `jrCatalog` bridge: custom elements as spec components
- [json-render-catalog.html](json-render-catalog.html) - `getCatalog()` API: `.prompt()` and `.toolDefinition()` for LLM integration

### Edge Cases

- [corner-cases.html](corner-cases.html) - Edge cases including `document.body` mocking
- [coverage-edge-render.html](coverage-edge-render.html) - Render lifecycle coverage edges
- [coverage-edge-attrs.html](coverage-edge-attrs.html) - Attribute reflection coverage edges
- [coverage-edge-templates.html](coverage-edge-templates.html) - Template/wire/raw coverage edges
- [coverage-edge-fragments.html](coverage-edge-fragments.html) - Fragment branch coverage edges
- [coverage-edge-blocks.html](coverage-edge-blocks.html) - Block syntax parser coverage edges
- [coverage-edge-keyed.html](coverage-edge-keyed.html) - Keyed lists and diff algorithm branches
- [coverage-edge-misc.html](coverage-edge-misc.html) - DOM content and misc coverage edges

### Performance

- [stress-test.html](stress-test.html) - Large lists, rapid updates, deep nesting

## Running Demos

Open any HTML file directly in a browser, or start a local server:

```bash
npx serve .
```

Then visit [http://localhost:3000/examples/kitchensink/](http://localhost:3000/examples/kitchensink/)

## Running Tests

### Basic Test Run

```bash
npm test
```

This runs all tests and generates a coverage report.

### Interactive UI Mode

For debugging and development:

```bash
npm run test:ui
```

This opens the Playwright UI where you can:

- See tests running in real-time
- Step through tests
- View screenshots and traces
- Re-run individual tests

### Headed Browser Mode

To watch tests run in a visible browser:

```bash
npm run test:headed
```

## How Tests Work

Each HTML file in `examples/kitchensink/` is a self-contained test scenario that:

1. Includes the hyper-element library
2. Defines custom elements to test specific features
3. Contains assertions using `data-test-result` attributes

The `kitchensink.spec.js` file:

- Auto-discovers all HTML test files
- Runs tests against the minified build (`build/hyperElement.min.js`)
- Collects V8 coverage data mapped to `src/` files
- Validates test assertions
- Reports console errors on failure

## Coverage Requirements

**100% code coverage is required** for all contributions:

- Statements: 100%
- Branches: 100%
- Functions: 100%
- Lines: 100%

Coverage is checked automatically by the pre-commit hook. If coverage drops below 100%, the commit will be blocked.

### Viewing Coverage Reports

After running tests, coverage reports are generated in:

- `coverage/coverage-final.json` - Machine-readable coverage data
- `coverage/v8-coverage.json` - V8 format coverage

## Writing New Tests

Each test follows the **single source of truth** convention: the displayed
`<pre><code>` snippet IS the entire executable program. The surrounding
script only reads the snippet, evals it, and asserts.

1. Create a new HTML file in `examples/kitchensink/`:

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="test-loader.js"></script>
  </head>
  <body>
    <section data-test="my-test" data-test-result="pending">
      <h2>My Test</h2>
      <p>What this demonstrates.</p>
      <pre><code>customElements.define(
  'my-elem',
  class extends hyperElement {
    render(Html) {
      Html`&lt;div&gt;Hello!&lt;/div&gt;`;
    }
  }
);
document.getElementById('my-test-output').innerHTML = '&lt;my-elem&gt;&lt;/my-elem&gt;';</code></pre>
      <div id="my-test-output"></div>
      <script type="module">
        await window.hyperElementReady;
        const code = document.querySelector(
          '[data-test="my-test"] pre code'
        ).textContent;
        eval(code);
        const expected =
          '<div id="my-test-output"><my-elem><div>Hello!</div></my-elem></div>';
        requestAnimationFrame(() => {
          window.assertSnapshot(
            'my-test',
            document.getElementById('my-test-output'),
            expected
          );
        });
      </script>
    </section>
  </body>
</html>
```

2. The test runner automatically picks up new HTML files.
3. The snippet's `textContent` is the entire program — `customElements.define`,
   element creation, mounting, and any test driver. The script only reads,
   executes, and asserts.
4. Use `window.assertSnapshot(name, target, expected[, normalize])` for HTML
   snapshot assertions. The helper auto-canonicalizes random `fn-RND`/`ob-RND`
   placeholders so snapshots stay deterministic.

## Canonical Patterns

Four patterns cover every test case. Choose the simplest one that fits.

### Pattern A — synchronous DOM render

Use when the demo renders once and the assertion is `outerHTML === expected`.
The script waits one `requestAnimationFrame` and calls `assertSnapshot`.
See `templates.html`, `dataset.html`, `nodes-tostring.html` for reference.

### Pattern B — sentinel-driven snippet

Use when the assertion is on internal state (e.g. signal values, counter
increments) rather than DOM HTML. The snippet sets `section.dataset.testResult`
directly. The script just `eval`s the snippet. See `signals.html`.

### Pattern C — multi-phase driver inside snippet

Use when the demo needs clicks, observers, intervals, or multi-tick verification.
The driver code (clicks, setTimeouts, observers) goes INSIDE the snippet. The
snippet sets the section result when verification completes. See
`event-callbacks.html`, `child-redraw.html`.

### Pattern D — async snippet with `await import()`

Use when the snippet needs ES module imports (e.g. SSR component definitions
from a separate `.mjs` file). The script wraps with
`new Function('return (async () => { ' + code + ' })();')` so top-level `await`
works inside the snippet. The snippet itself uses dynamic `await import('./...')`.
In bundle mode where imports may fail, the snippet falls back to a `'skip'`
sentinel. See `nodes-tostring.html` (`direct-tostring` section), `ssr-e2e.html`.

## The `assertSnapshot` API

```javascript
window.assertSnapshot(sectionName, target, expected[, normalize])
```

- `sectionName` — the section's `data-test` attribute. Sets `data-test-result`.
- `target` — DOM element OR a function returning an HTML string.
- `expected` — the static expected snapshot string (already canonicalized for
  random IDs).
- `normalize` — optional extra normalizer applied to `actual` before compare.

Internally calls `canonicalizeRender(actual)` which collapses random IDs of the
form `fn-<random>` and `ob-<random>` to constant tokens `fn-RND`/`ob-RND` so
snapshots stay deterministic across runs.

On mismatch, logs `Expected: ... Actual: ...` to console and sets
`data-test-result="fail"`.

## Test Configuration

Tests run against the minified production build (`build/hyperElement.min.js`) to ensure the shipped code works correctly. Coverage is collected and mapped back to the source files in `src/` using source maps.

## Debugging Failed Tests

1. Run in UI mode: `npm run test:ui`
2. Check browser console output in the test report
3. Use headed mode to watch the test: `npm run test:headed`
4. Check `playwright-report/index.html` for detailed failure info

## Continuous Integration

Tests run automatically on GitHub Actions for:

- Every pull request
- Every push to main branch
- Release workflows

The CI must pass before merging any changes.
