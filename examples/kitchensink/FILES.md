# FILES.md — examples/kitchensink/

Index of every file in this directory and its specific responsibility.

## HTML demo + test files

| File                           | Purpose                                                                                                    | Pattern(s) |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- | ---------- |
| `index.html`                   | Navigation hub linking all kitchen sink demos                                                              | n/a        |
| `basic-rendering.html`         | Simplest hyperElement render with template literal                                                         | A          |
| `setup-async.html`             | Async initialization via `setup()` + `onNext` trigger                                                      | A          |
| `lifecycle-sequence.html`      | Order of `setup()`/`render()`/`teardown()` calls                                                           | A, B       |
| `attributes.html`              | Reading element attributes via `this.attrs`                                                                | A          |
| `observed-attributes.html`     | Automatic attribute reactivity via MutationObserver                                                        | A, C       |
| `dataset.html`                 | `data-*` attributes with automatic JSON parsing                                                            | A          |
| `dataset-mutations.html`       | Mutating dataset and re-rendering                                                                          | A          |
| `type-coercion.html`           | Automatic numeric/boolean/JSON parsing of attributes                                                       | A          |
| `content-handling.html`        | Accessing wrapped content via `this.wrappedContent`                                                        | A          |
| `content-mutations.html`       | Re-rendering when wrapped content changes                                                                  | C          |
| `templates.html`               | `Html.template()` with `{variable}` substitution                                                           | A          |
| `advanced-template-variable.html` | Advanced template variable replacement                                                                    | A          |
| `advanced-template-if-truthy.html` | `{+if}` truthy branch rendering                                                                           | A          |
| `advanced-template-if-falsy.html` | `{+if}` falsy branch omission                                                                             | A          |
| `advanced-template-if-else.html` | `{+if}`/`{+else}` branch selection                                                                         | A          |
| `advanced-template-each-iteration.html` | `{+each}` array iteration                                                                            | A          |
| `advanced-template-each-objects.html` | `{+each}` object property access                                                                      | A          |
| `advanced-template-unless-falsy.html` | `{+unless}` falsy branch rendering                                                                   | A          |
| `advanced-template-unless-truthy.html` | `{+unless}` truthy branch omission                                                                   | A          |
| `block-syntax-advanced.html`   | Nested blocks, edge cases, null/undefined handling                                                         | A, C       |
| `auto-wire-each.html`          | `{+each ${array}}...{-each}` template iteration                                                            | A          |
| `keyed-templates.html`         | Template directives with keys                                                                              | B, C       |
| `partial-interpolation.html`   | Partial attribute interpolation `class="prefix-${v}"`                                                      | A, B, C    |
| `fragments-async.html`         | Fragments with promises and placeholders                                                                   | C          |
| `fragments-templates.html`     | Fragments using template strings                                                                           | A          |
| `fragment-combinations.html`   | All fragment return types: text/html/any/template                                                          | A, C       |
| `keyed-rendering.html`         | `Html.wire()` for efficient keyed list updates                                                             | A          |
| `xss-prevention.html`          | HTML escaping and `Html.raw()` for safe rendering                                                          | A, B       |
| `nodes-tostring.html`          | Coverage for `Element.toString()` and `Fragment.toString()`                                                | A, D       |
| `styled.html`                  | `+styled` system: base styles, prop flags, logic functions                                                 | A, B       |
| `styled-css.html`              | `+styled` selector CSS, css overrides, defineStyled, scoped style host cleanup                             | B, C       |
| `nested-elements.html`         | Parent-child custom element composition                                                                    | A          |
| `nested-each-deep.html`        | Deeply nested `{+each}` with property references                                                           | A, B       |
| `same-type-nesting.html`       | Same custom element nested in itself                                                                       | B          |
| `child-redraw.html`            | Parent-child attribute passing and re-renders                                                              | C          |
| `observer-isolation.html`      | Verifies descendant child renders do not cause ancestor re-renders                                         | C          |
| `child-styles.html`            | Passing style objects to children                                                                          | A, B       |
| `complex-type-attrs.html`      | Passing objects/functions to child elements                                                                | A          |
| `signal-basic.html`            | `signal()` creation plus value reads, writes, and `peek()`                                                | B          |
| `signal-subscribe.html`        | `signal().subscribe()` notifications and unsubscribe behavior                                             | B          |
| `signal-computed-basic.html`   | `computed()` values derived from multiple signals                                                         | B          |
| `signal-computed-lazy.html`    | Lazy computed evaluation and cached reads                                                                 | B          |
| `signal-effect-basic.html`     | `effect()` reruns when dependencies change                                                                | B          |
| `signal-effect-cleanup.html`   | Effect cleanup before reruns and disposal                                                                 | B          |
| `signal-untracked.html`        | `untracked()` reads that avoid dependency registration                                                    | B          |
| `signal-batch.html`            | `batch()` grouped signal updates                                                                          | B          |
| `signal-computed-nested.html`  | Computed values that depend on other computed values                                                      | B          |
| `signal-effect-computed.html`  | Effects that depend on computed values                                                                    | B          |
| `signal-component.html`        | Using signal state inside a `hyperElement` component                                                      | B          |
| `signal-batch-nested.html`     | Nested `batch()` calls                                                                                    | B          |
| `signal-batch-effects.html`    | Deferred effects after batched updates                                                                    | B          |
| `event-callback-no-store.html` | External event callbacks via `attachStore()` without a backing store                                      | C          |
| `event-callback-with-data.html` | External event callbacks that pass payloads into `render()` through the trigger                         | C          |
| `event-handler-array.html`     | Hidden render-core compatibility coverage for event handler arrays with listener options                  | C          |
| `event-handler-array-replace.html` | Hidden render-core compatibility coverage for replacing event handler arrays                         | C          |
| `functional-api.html`          | Functional component definition API                                                                        | A, B, C    |
| `functional-validation.html`   | Validation for functional API inputs                                                                       | B          |
| `corner-cases.html`            | Edge cases including `document.body` mocking                                                               | A, C       |
| `coverage-edge-render.html`    | Render lifecycle coverage edges (split from monolith)                                                      | A, B, C    |
| `coverage-edge-attrs.html`     | Attribute reflection coverage edges                                                                        | A          |
| `coverage-edge-templates.html` | Template/wire/raw coverage edges                                                                           | A          |
| `coverage-edge-fragments.html` | Fragment branch coverage edges                                                                             | A, C       |
| `coverage-edge-blocks.html`    | Block syntax parser coverage edges                                                                         | A          |
| `coverage-edge-keyed.html`     | Keyed lists and diff algorithm branches                                                                    | B, C       |
| `coverage-edge-misc.html`      | DOM content and misc coverage edges                                                                        | A          |
| `stress-large-list.html`       | Rendering a keyed 100 item list                                                                            | A, C       |
| `stress-rapid-rerender.html`   | Running 50 quick render cycles on one element                                                              | A, C       |
| `stress-many-elements.html`    | Creating 20 custom element instances on one page                                                           | A, C       |
| `stress-list-updates.html`     | Adding and removing keyed list items                                                                       | A, C       |
| `stress-many-interpolations.html` | Rendering templates with 20 interpolation points                                                        | A, C       |
| `ssr-dev-indicator-head.html`  | SSR dev-mode indicator visibility                                                                          | B, C       |
| `ssr-e2e.html`                 | Full SSR hydration flow (6 phases)                                                                         | B, D       |
| `ssr-hydration.html`           | SSR hydration edge cases                                                                                   | B, C       |
| `json-render-basic.html`       | Declarative `<json-render>` rendering from JSON spec                                                       | A          |
| `json-render-bridge.html`      | `jrType`/`jrCatalog` bridge: `hyperElement(...)` definitions auto-register as json-render components       | A, B, C    |
| `json-render-catalog.html`     | `getCatalog()` API: `.prompt()` and `.toolDefinition()` for LLM schema generation                          | A, B       |
| `json-render-coverage.html`    | JSON render coverage edges                                                                                 | A          |
| `json-render-custom.html`      | Programmatic `renderSpec` + `registerComponent`                                                            | A          |
| `json-render-hardened.html`    | Phase 1.6/1.7 hardening — `replaceSpec()`, `toolUseId`, CodeBlock copy+lines, Checklist/TextField counters | C          |
| `json-render-onaction.html`    | React-style `onaction` IDL property + declarative `@jr-action` + `event()` identity short-circuit          | A, C       |

## Test infrastructure (read-only)

| File                    | Purpose                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `test-loader.js`        | Loader script — sets up source/bundle modes; exposes `window.assertSnapshot` and `window.canonicalizeRender` |
| `kitchensink.spec.js`   | Playwright runner — auto-discovers all `.html` files; waits for all `data-test-result` to clear              |
| `ssr-e2e-component.mjs` | Shared SSR test component definition (imported by `ssr-e2e.html` snippet)                                    |
| `ssr-e2e-output.js`     | Pre-generated SSR output string (imported by `ssr-e2e.html` snippet)                                         |

## Pattern legend

- **A** = Synchronous DOM render — snapshot via `assertSnapshot`
- **B** = Sentinel-driven (snippet sets `data-test-result` directly)
- **C** = Multi-phase driver inside snippet (clicks, observers, intervals)
- **D** = Async snippet with `await import()` (SSR + nodes coverage)
