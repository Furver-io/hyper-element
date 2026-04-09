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

### Attributes & Data

- [attributes.html](attributes.html) - Accessing element attributes via `this.attrs`
- [dataset.html](dataset.html) - Using `data-*` attributes with automatic JSON parsing
- [dataset-mutations.html](dataset-mutations.html) - Re-rendering when dataset values change

### Content Handling

- [content-handling.html](content-handling.html) - Accessing content between tags via `this.wrappedContent`
- [content-mutations.html](content-mutations.html) - Re-rendering when wrapped content changes

### Templates & Fragments

- [templates.html](templates.html) - `Html.template()` with `{variable}` substitution
- [fragments-async.html](fragments-async.html) - Fragments with promises and placeholders
- [fragments-templates.html](fragments-templates.html) - Fragments using template strings

### Advanced Templates

- [advanced-templates.html](advanced-templates.html) - Conditionals (`{#if}`, `{#unless}`), iteration (`{#each}`), and branching

### Composition

- [nested-elements.html](nested-elements.html) - Parent-child custom element composition

### Event Handling

- [event-callbacks.html](event-callbacks.html) - External event callbacks using `attachStore()`

### Edge Cases

- [corner-cases.html](corner-cases.html) - Unusual scenarios and edge cases
- [coverage-edge-cases.html](coverage-edge-cases.html) - Coverage testing for uncovered branches

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

1. Create a new HTML file in `examples/kitchensink/`:

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="test-loader.js"></script>
  </head>
  <body>
    <my-test-elem></my-test-elem>

    <script>
      customElements.define(
        'my-test-elem',
        class extends hyperElement {
          render(Html) {
            Html`<div data-test-result="pass">Test passed!</div>`;
          }
        }
      );
    </script>
  </body>
</html>
```

2. The test runner automatically picks up new HTML files
3. Use `data-test-result="pass"` to indicate successful assertions
4. Use `data-test-result="fail"` to indicate failures

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
