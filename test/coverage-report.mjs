#!/usr/bin/env node
/**
 * @file Final coverage report generator.
 * Runs AFTER all coverage collection (browser + SSR) is complete.
 * Processes V8 coverage for multiple src/ files, converts to Istanbul format.
 * Exits with code 1 if coverage isn't 100%.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import v8toIstanbul from 'v8-to-istanbul';
import libCoverage from 'istanbul-lib-coverage';
import libReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const coverageDir = join(projectRoot, 'coverage');
const coverageFile = join(coverageDir, 'v8-coverage.json');
const srcDir = join(projectRoot, 'src');

/**
 * Parses source code for c8 ignore ranges.
 * @param {string} source - The source code
 * @returns {Set<number>} Set of line numbers to ignore
 */
function parseIgnoreRanges(source) {
  const lines = source.split('\n');
  const ignoredLines = new Set();
  let inIgnoreBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (line.includes('/* c8 ignore start')) {
      inIgnoreBlock = true;
    }

    if (inIgnoreBlock) {
      ignoredLines.add(lineNum);
    }

    if (line.includes('/* c8 ignore stop')) {
      inIgnoreBlock = false;
    }

    if (line.includes('/* c8 ignore next */')) {
      ignoredLines.add(lineNum);
      ignoredLines.add(lineNum + 1);
    }
  }

  return ignoredLines;
}

/**
 * Extract file path from V8 coverage URL
 */
function urlToFilePath(url) {
  // URL format: http://localhost:5555/src/hyperElement.js
  const match = url.match(/\/src\/(.+)$/);
  if (match) {
    return join(srcDir, match[1]);
  }
  return null;
}

async function generateCoverageReport() {
  if (!existsSync(coverageFile)) {
    console.log('No coverage data collected');
    process.exit(1);
  }

  const allCoverage = JSON.parse(readFileSync(coverageFile, 'utf8'));
  if (allCoverage.length === 0) {
    console.log('No coverage data collected');
    process.exit(1);
  }

  // Group coverage entries by source file
  const coverageByFile = new Map();
  for (const entry of allCoverage) {
    const filePath = urlToFilePath(entry.url);
    if (!filePath || !existsSync(filePath)) continue;

    if (!coverageByFile.has(filePath)) {
      coverageByFile.set(filePath, []);
    }
    coverageByFile.get(filePath).push(entry);
  }

  if (coverageByFile.size === 0) {
    console.log('No src/ coverage data found');
    process.exit(1);
  }

  // Create Istanbul coverage map
  const coverageMap = libCoverage.createCoverageMap({});

  // Track all ignored lines per file
  const ignoredLinesByFile = new Map();
  const sourceLinesByFile = new Map();

  // Process each source file
  for (const [filePath, entries] of coverageByFile) {
    const source = readFileSync(filePath, 'utf8');
    sourceLinesByFile.set(filePath, source.split('\n'));
    ignoredLinesByFile.set(filePath, parseIgnoreRanges(source));

    // Convert first entry
    const converter = v8toIstanbul(filePath, 0, { source });
    await converter.load();
    converter.applyCoverage(entries[0].functions);
    const istanbulData = converter.toIstanbul();
    const merged = Object.values(istanbulData)[0];

    if (!merged) continue;

    // Merge remaining entries
    for (let i = 1; i < entries.length; i++) {
      const conv = v8toIstanbul(filePath, 0, { source });
      await conv.load();
      conv.applyCoverage(entries[i].functions);
      const cov = Object.values(conv.toIstanbul())[0];

      if (!cov) continue;

      // Sum counts
      for (const [id, count] of Object.entries(cov.s)) {
        if (merged.s[id] !== undefined) merged.s[id] += count;
      }
      for (const [id, count] of Object.entries(cov.f)) {
        if (merged.f[id] !== undefined) merged.f[id] += count;
      }
      for (const [id, counts] of Object.entries(cov.b)) {
        if (merged.b[id]) {
          for (let j = 0; j < counts.length; j++) {
            if (merged.b[id][j] !== undefined) merged.b[id][j] += counts[j];
          }
        }
      }
    }

    coverageMap.addFileCoverage(merged);
  }

  // Write Istanbul format coverage
  const coverageFinal = {};
  coverageMap.files().forEach((file) => {
    coverageFinal[file] = coverageMap.fileCoverageFor(file).toJSON();
  });
  writeFileSync(
    join(coverageDir, 'coverage-final.json'),
    JSON.stringify(coverageFinal, null, 2)
  );

  // Generate HTML report
  const context = libReport.createContext({
    dir: coverageDir,
    defaultSummarizer: 'nested',
    coverageMap,
  });
  const htmlReporter = reports.create('html', {});
  htmlReporter.execute(context);
  console.log(`HTML report: ${join(coverageDir, 'index.html')}`);

  // Calculate totals across all files
  let stmtHit = 0, stmtTotal = 0;
  let fnHit = 0, fnTotal = 0;
  let branchHit = 0, branchTotal = 0;
  const uncoveredByFile = new Map();

  for (const file of coverageMap.files()) {
    const fc = coverageMap.fileCoverageFor(file);
    const data = fc.toJSON();
    const sourceLines = sourceLinesByFile.get(file) || [];
    const ignoredLines = ignoredLinesByFile.get(file) || new Set();
    const uncovered = [];

    // Statements
    for (const [id, count] of Object.entries(data.s)) {
      const loc = data.statementMap[id];
      const line = loc?.start?.line;
      if (line && sourceLines[line - 1]?.trim() === '') continue;
      if (line && ignoredLines.has(line)) continue;
      stmtTotal++;
      if (count > 0) {
        stmtHit++;
      } else {
        uncovered.push(line);
      }
    }

    // Functions
    for (const [id, count] of Object.entries(data.f)) {
      const fn = data.fnMap[id];
      if (fn?.name === '<instance_members_initializer>') continue;
      const line = fn?.decl?.start?.line;
      if (line && ignoredLines.has(line)) continue;
      fnTotal++;
      if (count > 0) fnHit++;
    }

    // Branches
    for (const [id, counts] of Object.entries(data.b)) {
      const br = data.branchMap[id];
      counts.forEach((c, idx) => {
        const loc = br?.locations?.[idx];
        const line = loc?.start?.line;
        if (line && ignoredLines.has(line)) return;
        branchTotal++;
        if (c > 0) branchHit++;
      });
    }

    if (uncovered.length > 0) {
      uncoveredByFile.set(file, [...new Set(uncovered)].sort((a, b) => a - b));
    }
  }

  const stmtPct = stmtTotal > 0 ? ((stmtHit / stmtTotal) * 100).toFixed(2) : '100.00';
  const fnPct = fnTotal > 0 ? ((fnHit / fnTotal) * 100).toFixed(2) : '100.00';
  const branchPct = branchTotal > 0 ? ((branchHit / branchTotal) * 100).toFixed(2) : '100.00';

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Code Coverage Summary (${coverageMap.files().length} src files)`);
  console.log(`${'='.repeat(50)}`);
  console.log(`Statements : ${stmtHit}/${stmtTotal} (${stmtPct}%)`);
  console.log(`Functions  : ${fnHit}/${fnTotal} (${fnPct}%)`);
  console.log(`Branches   : ${branchHit}/${branchTotal} (${branchPct}%)`);
  console.log(`${'='.repeat(50)}\n`);

  // Show uncovered per file
  if (uncoveredByFile.size > 0) {
    console.log('Uncovered lines by file:');
    for (const [file, lines] of uncoveredByFile) {
      const relPath = relative(projectRoot, file);
      console.log(`  ${relPath}: ${lines.join(', ')}`);
    }
  }

  // Write summary
  const summaryLines = [
    `Statements: ${stmtPct}% (${stmtHit}/${stmtTotal})`,
    `Functions: ${fnPct}% (${fnHit}/${fnTotal})`,
    `Branches: ${branchPct}% (${branchHit}/${branchTotal})`,
  ];
  if (uncoveredByFile.size > 0) {
    summaryLines.push('', 'Uncovered:');
    for (const [file, lines] of uncoveredByFile) {
      summaryLines.push(`  ${relative(projectRoot, file)}: ${lines.join(', ')}`);
    }
  }
  writeFileSync(join(coverageDir, 'summary.txt'), summaryLines.join('\n'));

  // Check for 100% coverage
  const failures = [];
  if (stmtPct !== '100.00') {
    failures.push(`Statements: ${stmtPct}%`);
  }
  if (fnPct !== '100.00') {
    failures.push(`Functions: ${fnPct}%`);
  }
  if (branchPct !== '100.00') {
    failures.push(`Branches: ${branchPct}%`);
  }

  if (failures.length > 0) {
    console.log(`\n❌ Coverage is not 100%!\n${failures.join('\n')}`);
    process.exit(1);
  }

  console.log('✅ Coverage is 100%!');
}

generateCoverageReport().catch((err) => {
  console.error('Error generating coverage report:', err);
  process.exit(1);
});
