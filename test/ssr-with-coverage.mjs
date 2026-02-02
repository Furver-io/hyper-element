#!/usr/bin/env node
/**
 * @file Runs SSR tests with V8 coverage collection.
 * Outputs coverage in a format compatible with the browser test coverage.
 */

import { spawn } from 'child_process';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  unlinkSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const coverageDir = join(projectRoot, 'coverage');
const ssrCoverageDir = join(coverageDir, 'ssr-temp');

async function runSSRTestsWithCoverage() {
  // Ensure coverage directory exists
  if (!existsSync(coverageDir)) {
    mkdirSync(coverageDir, { recursive: true });
  }

  // Clean up old SSR coverage
  if (existsSync(ssrCoverageDir)) {
    for (const file of readdirSync(ssrCoverageDir)) {
      unlinkSync(join(ssrCoverageDir, file));
    }
  }

  // Run SSR tests with c8 coverage against source files
  const c8Args = [
    'c8',
    '--reporter=none',
    '--temp-directory=' + ssrCoverageDir,
    '--include=src/**/*.js',
    'node',
    join(__dirname, 'ssr.test.mjs'),
  ];

  await new Promise((resolve, reject) => {
    const proc = spawn('npx', c8Args, {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env, SSR_COVERAGE: '1' },
    });
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`SSR tests failed with code ${code}`));
      else resolve();
    });
    proc.on('error', reject);
  });

  // Read c8 coverage files and convert to V8 format compatible with browser coverage
  const coverageFiles = readdirSync(ssrCoverageDir).filter((f) =>
    f.endsWith('.json')
  );
  const ssrCoverageEntries = [];

  for (const file of coverageFiles) {
    const data = JSON.parse(readFileSync(join(ssrCoverageDir, file), 'utf8'));
    // c8 produces V8 coverage format with result array
    if (data.result) {
      for (const entry of data.result) {
        // Only include src/ files
        if (entry.url && entry.url.includes('/src/')) {
          // Extract relative path from file:// URL
          // e.g., file:///path/to/project/src/ssr/server.js -> /src/ssr/server.js
          const srcMatch = entry.url.match(/\/src\/(.+)$/);
          if (srcMatch) {
            const relativePath = `/src/${srcMatch[1]}`;
            const filePath = join(projectRoot, 'src', srcMatch[1]);

            // Read source for consistent v8-to-istanbul processing
            const source = existsSync(filePath)
              ? readFileSync(filePath, 'utf8')
              : undefined;

            // Convert file:// URL to http:// URL format matching browser coverage
            ssrCoverageEntries.push({
              ...entry,
              url: `http://localhost:5555${relativePath}`,
              source,
            });
          }
        }
      }
    }
  }

  // Append SSR coverage to the main coverage file
  const mainCoverageFile = join(coverageDir, 'v8-coverage.json');
  let allCoverage = [];

  if (existsSync(mainCoverageFile)) {
    try {
      allCoverage = JSON.parse(readFileSync(mainCoverageFile, 'utf8'));
    } catch (e) {
      allCoverage = [];
    }
  }

  // Add SSR coverage entries
  allCoverage.push(...ssrCoverageEntries);

  // Save merged coverage
  writeFileSync(mainCoverageFile, JSON.stringify(allCoverage, null, 2));

  console.log(
    `\nSSR coverage: Added ${ssrCoverageEntries.length} coverage entries`
  );
}

runSSRTestsWithCoverage().catch((err) => {
  console.error('Error running SSR tests with coverage:', err);
  process.exit(1);
});
