# Test Directory

Testing infrastructure for hyper-element.

## Test Types

### Browser Integration Tests (Playwright)

Located in `kitchensink/`. Run via Playwright:

```bash
npm run test:src      # Source coverage mode
npm run test:bundle   # Bundle verification mode
```

### SSR Integration Tests (Node.js)

Located here in `test/`. Run via Node.js:

```bash
npm run test:ssr-coverage   # SSR tests with coverage
```

## Running All Tests

```bash
npm test              # Full test suite (source + bundle + SSR)
```

## Coverage

Coverage is collected across both browser and SSR tests:

1. Browser coverage via V8 instrumentation in Playwright
2. SSR coverage via c8 in Node.js
3. Both are merged by `coverage-report.mjs`

Target: 100% coverage on statements, branches, lines, and functions.

## Files

- **ssr.test.mjs** - SSR integration tests (158 tests)
- **ssr-e2e.mjs** - SSR end-to-end test runner
- **ssr-with-coverage.mjs** - SSR tests with coverage collection
- **coverage-report.mjs** - Coverage merging and reporting
