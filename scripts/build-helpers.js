#!/usr/bin/env node
/**
 * @file Build output helpers for the universal bundle script.
 *
 * The main build script owns source ordering and source transformation. This
 * helper owns filesystem output, source-map generation, and minification so
 * the orchestration file stays below the project source-size limit while the
 * operational behavior remains unchanged.
 */

const fs = require('fs');
const path = require('path');
const { SourceMapGenerator } = require('source-map');

/**
 * Generate a line-based source map for the concatenated bundle.
 * Domain context: the project ships a hand-assembled browser bundle for users
 * who load Hyper Element without a bundler. Developers still need useful
 * source references when debugging that bundle.
 *
 * Technical context: `scripts/build.js` records the generated start line for
 * each concatenated source file. This helper expands those file-level ranges
 * into one mapping per generated line, which is sufficient for stack traces and
 * coverage correlation in the current build pipeline.
 *
 * @param {Array} mappings - Source file mapping metadata.
 * @param {string} bundleFile - Output bundle filename.
 * @returns {string} Source map JSON.
 */
function generateSourceMap(mappings, bundleFile) {
  const generator = new SourceMapGenerator({ file: bundleFile });
  mappings.forEach((mapping) => {
    for (let i = 0; i < mapping.lineCount; i += 1) {
      generator.addMapping({
        generated: { line: mapping.startLine + i, column: 0 },
        source: mapping.file,
        original: { line: i + 1, column: 0 },
      });
    }
  });
  return generator.toString();
}

/**
 * Write the development bundle, source map, and minified browser bundle.
 * Domain context: source and bundle kitchen sink tests both depend on this
 * output matching the same public APIs, including optional subpath modules such
 * as Hyper Layout.
 *
 * Technical context: the bundle factory remains in `build.js` because source
 * order is architectural. Filesystem writes and esbuild minification live here
 * so the orchestration file stays below the 200-NCLOC project limit.
 *
 * @param {Object} options - Build output options.
 * @param {string} options.buildDir - Directory receiving build artifacts.
 * @param {Function} options.createBundle - Bundle factory from build.js.
 * @returns {Promise<void>} Resolves after all artifacts are written.
 */
async function writeBundleOutputs({ buildDir, createBundle }) {
  const esbuild = require('esbuild');
  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });
  const { content: bundleContent, mappings } = createBundle();
  const unminifiedPath = path.join(buildDir, 'hyperElement.bundle.js');
  fs.writeFileSync(unminifiedPath, bundleContent);
  fs.writeFileSync(
    path.join(buildDir, 'hyperElement.bundle.js.map'),
    generateSourceMap(mappings, 'hyperElement.bundle.js')
  );
  console.log(
    `Built: build/hyperElement.bundle.js (${mappings.length} source files combined)`
  );
  await esbuild.build({
    entryPoints: [unminifiedPath],
    outfile: path.join(buildDir, 'hyperElement.min.js'),
    minify: true,
    sourcemap: true,
    bundle: false,
  });
  const stats = fs.statSync(path.join(buildDir, 'hyperElement.min.js'));
  console.log(
    `Built: build/hyperElement.min.js (${(stats.size / 1024).toFixed(1)}kb)`
  );
}

module.exports = { writeBundleOutputs };
