/**
 * @file Playwright configuration for hyper-element tests.
 * Supports two test modes:
 * - source-coverage: Tests against src/ via ESM for coverage collection
 * - bundle-verify: Tests against built bundle to verify build integrity
 */

const { defineConfig, devices } = require('@playwright/test');

// Determine test mode from environment
const testMode = process.env.TEST_MODE || 'source';

module.exports = defineConfig({
  testDir: './examples/kitchensink',
  testMatch: '*.spec.js',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to ensure coverage merges correctly
  reporter: [['html'], ['list']],

  use: {
    baseURL: 'http://localhost:5555',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'source-coverage',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
      metadata: { testMode: 'src' },
    },
    {
      name: 'bundle-verify',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
      metadata: { testMode: 'bundle' },
    },
  ],

  webServer: {
    // http-server doesn't respect .gitignore, so build/ is accessible
    command: 'npx http-server . -p 5555 -c-1',
    url: 'http://localhost:5555',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
