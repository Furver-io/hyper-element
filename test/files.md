# test/

## Directory Structure

```
test/
├── all-ssr-tests.mjs    # Combined SSR test runner
├── coverage-report.mjs   # Coverage merging
├── ssr-e2e.mjs          # SSR e2e test runner
├── ssr-with-coverage.mjs # SSR test runner with coverage
├── ssr.test.mjs         # SSR integration tests
└── styled.test.mjs      # +styled system integration tests
```

## Files

### `ssr.test.mjs`

SSR integration tests. Contains 158+ tests covering all SSR rendering scenarios including template rendering, XSS prevention, fragment handling, and hydration replay.

### `ssr-e2e.mjs`

End-to-end SSR test runner. Demonstrates the server phase of SSR by rendering a component and writing output for client consumption by Playwright.

### `ssr-with-coverage.mjs`

SSR test runner with coverage collection. Imports tests from ssr.test.mjs and runs them with c8 coverage instrumentation.

### `all-ssr-tests.mjs`

Combined SSR test runner. Imports and executes both ssr.test.mjs and styled.test.mjs in a single process for unified coverage collection.

### `coverage-report.mjs`

Coverage merging and reporting. Combines V8 coverage from Playwright browser tests with c8 coverage from SSR tests into a unified report.

### `styled.test.mjs`

+styled system integration tests. Contains 40+ tests covering base styles, shared selectors, prop flags, logic functions, color palettes, selector-capable generated CSS, `css=${...}` overrides, `defineStyled()`, SSR style hosts, and edge cases for the styling system.
