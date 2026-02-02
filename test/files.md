# test/

## Directory Structure

```
test/
├── coverage-report.mjs   # Coverage merging
├── ssr-e2e.mjs          # SSR e2e test runner
├── ssr-with-coverage.mjs # SSR test runner with coverage
└── ssr.test.mjs         # SSR integration tests
```

## Files

### `ssr.test.mjs`

SSR integration tests. Contains 158+ tests covering all SSR rendering scenarios including template rendering, XSS prevention, fragment handling, and hydration replay.

### `ssr-e2e.mjs`

End-to-end SSR test runner. Demonstrates the server phase of SSR by rendering a component and writing output for client consumption by Playwright.

### `ssr-with-coverage.mjs`

SSR test runner with coverage collection. Imports tests from ssr.test.mjs and runs them with c8 coverage instrumentation.

### `coverage-report.mjs`

Coverage merging and reporting. Combines V8 coverage from Playwright browser tests with c8 coverage from SSR tests into a unified report.
