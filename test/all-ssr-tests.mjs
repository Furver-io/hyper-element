#!/usr/bin/env node
/**
 * @file Combined runner for all SSR tests.
 * Runs ssr.test.mjs and styled.test.mjs in a single process for coverage collection.
 */

// Import and run tests
async function main() {
  let totalPassed = 0;
  let totalFailed = 0;

  // Run SSR tests
  const ssrTests = await import('./ssr.test.mjs');
  const ssrResults = await ssrTests.runTests();
  totalPassed += ssrResults.passed;
  totalFailed += ssrResults.failed;

  // Run styled tests
  const styledTests = await import('./styled.test.mjs');
  const styledResults = await styledTests.runTests();
  totalPassed += styledResults.passed;
  totalFailed += styledResults.failed;

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(
    `All SSR Tests: ${totalPassed} passed, ${totalFailed} failed (total)`
  );

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Tests failed:', err);
  process.exit(1);
});
