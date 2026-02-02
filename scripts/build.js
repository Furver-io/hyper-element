#!/usr/bin/env node
/**
 * @file Build script for hyper-element.
 * Creates a single universal bundle that works on both server and client.
 * Auto-detects environment and exports appropriate APIs.
 */

const fs = require('fs');
const path = require('path');
const { SourceMapGenerator } = require('source-map');
const pkg = require('../package.json');

const srcDir = path.join(__dirname, '..', 'src');
const buildDir = path.join(__dirname, '..', 'build');

const sharedFiles = [
  'core/constants.js', 'core/manager.js', 'utils/makeid.js', 'utils/escape.js',
  'render/constants.js', 'render/nodes.js', 'render/keyed.js', 'render/parser.js',
  'signals/index.js', 'attributes/parseAttribute.js',
  'template/processAdvancedTemplate.js', 'html/parseEachBlocks.js',
];

const browserFiles = [
  'render/creator.js', 'render/resolve.js', 'render/diff.js',
  'render/persistent-fragment.js', 'render/update.js', 'render/hole.js', 'render/index.js',
  'template/buildTemplate.js', 'attributes/dataset.js', 'attributes/attachAttrs.js',
  'html/createHtml.js',
  'ssr/pathResolver.js', 'ssr/buffer.js', 'ssr/devIndicator.js',
  'ssr/capture.js', 'ssr/replay.js', 'ssr/index.js',
  'lifecycle/onNext.js', 'lifecycle/observer.js', 'lifecycle/connectedCallback.js',
  'hyperElement.js', 'functional.js',
];

const ssrServerFiles = [
  'ssr/string-update.js', 'ssr/string-render.js', 'ssr/ssr-html.js', 'ssr/render-element.js',
];

/**
 * Reads a file and strips ES module import/export statements.
 * @param {string} filePath - Path to the file
 * @param {boolean} [browserOnly=false] - If true, convert to browser-safe format
 * @returns {string} File content with imports/exports removed
 */
function processFile(filePath, browserOnly = false) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/^import\s+\{[\s\S]*?\}\s+from\s+['"].*?['"];?\s*$/gm, '');
  content = content.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '');
  content = content.replace(/^import\s+['"].*?['"];?\s*$/gm, '');
  content = content.replace(
    /^export\s+(?:async\s+)?(?:const|let|var|function|class)\s+/gm,
    (m) => m.replace(/^export\s+/, '')
  );
  content = content.replace(/^export\s+\{[\s\S]*?\};?\s*$/gm, '');
  content = content.replace(/^export\s+default\s+/gm, '');
  content = content.replace(/\/\*\*[\s\S]*?\*\//g, '');
  content = content.replace(/^\s*\/\/.*$/gm, '');
  if (browserOnly) content = content.replace(/^(const|let)\s+/gm, 'var ');
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
  return content.trim();
}

/**
 * Creates the universal bundle that works on server and client.
 * Also generates source map data for mapping back to original src/ files.
 * @returns {{ content: string, mappings: Array }} Bundle content and source mappings
 */
function createBundle() {
  const parts = [], mappings = [];
  let currentLine = 1;
  function addPart(content, sourceFile = null) {
    if (sourceFile) {
      mappings.push({ file: `src/${sourceFile}`, startLine: currentLine, lineCount: content.split('\n').length });
    }
    parts.push(content);
    currentLine += content.split('\n').length;
  }

  // UMD wrapper with environment detection
  // Note: c8 ignore comments exclude unreachable UMD branches from coverage
  addPart(`// hyper-element v${pkg.version} - universal bundle (server + client)
(function (root, factory) {
  var isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  var isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

  if (typeof module === 'object' && module.exports) {
    // CommonJS
    module.exports = factory(isBrowser);
  /* c8 ignore start - AMD is not tested */
  } else if (typeof define === 'function' && define.amd) {
    define(function() { return factory(isBrowser); });
  /* c8 ignore stop */
  } else {
    // Browser global (covered by browser tests)
    var exports = factory(isBrowser);
    if (isBrowser) {
      root.hyperElement = exports.default;
      root.configureSSR = exports.configureSSR;
      root.signal = exports.signal;
      root.computed = exports.computed;
      root.effect = exports.effect;
      root.batch = exports.batch;
      root.untracked = exports.untracked;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function (isBrowser) {
  'use strict';

`);

  function addFiles(files, indent, browserOnly) {
    for (const file of files) {
      const filePath = path.join(srcDir, file);
      if (!fs.existsSync(filePath)) { console.warn(`Warning: ${file} not found`); continue; }
      let content = processFile(filePath, browserOnly);
      if (browserOnly) {
        content = content.replace(/^class\s+(\w+)(\s+extends\s+\w+)?\s*\{/gm, '$1 = class$2 {');
        content = content.replace(/^function\s+(\w+)\s*\(/gm, '$1 = function(');
      }
      addPart(`\n${indent}// ${file}\n` + content.split('\n').map(l => l ? indent + l : '').join('\n'), file);
    }
  }

  addFiles(sharedFiles, '  ', false);
  addPart(`
  var hyperElement, createFunctionalElement, configureSSR;
  var createFragment, resolve, diff, diffFragment, PersistentFragment, nodes;
  var update, Hole, render, dom, createHtml, isKeyed, bind, wire;
  var buildTemplate, addDataset, getDataset, attachAttrs, processFragmentResult;
  var pathResolver, ssrBuffer, showDevIndicator, hideDevIndicator;
  var getNthOfTypeIndex, calculatePath, resolvePath, addToBuffer, getBufferedEvents, clearBuffer;
  var isUnregisteredCustomElement, findCustomElementAncestor, extractEventDetail;
  var captureScrollState, captureCheckedState, handleCapturedEvent, restoreElementState;
  var startCapture, replayEvents, initSSR, ssrState, markTagRegistered, createSyntheticEvent;
  var onNext, observer, createdCallback;
`);
  addPart(`\n  if (isBrowser) {`);
  addFiles(browserFiles, '    ', true);
  addPart(`\n  }`);
  addFiles(ssrServerFiles, '  ', false);

  addPart(`
  var isBrowserEnv = typeof window !== 'undefined' && typeof document !== 'undefined';
  if (isBrowserEnv) {
    console.info('hyper-element v${pkg.version} by ${pkg.author}');
    var hyperElementProxy = new Proxy(hyperElement, {
      get: function(target, prop, receiver) {
        if (prop === 'prototype') return target.prototype;
        return Reflect.get(target, prop, receiver);
      },
      apply: function(target, thisArg, args) {
        if (args.length === 0) throw new Error('hyperElement requires a definition object or render function');
        return createFunctionalElement.apply(null, args);
      },
      construct: function(target, args, newTarget) {
        if (newTarget !== hyperElementProxy) return Reflect.construct(target, args, newTarget);
        throw new Error('hyperElement cannot be instantiated directly. Use class extension or functional API.');
      }
    });
    hyperElementProxy.configureSSR = configureSSR;
    return { default: hyperElementProxy, hyperElement: hyperElementProxy, configureSSR: configureSSR,
      signal: signal, computed: computed, effect: effect, batch: batch, untracked: untracked };
  } else {
    return { renderElement: renderElement, renderElements: renderElements, createRenderer: createRenderer,
      renderToString: renderToString, ssrHtml: ssrHtml, createSSRHtml: createSSRHtml,
      createSSRTemplate: createSSRTemplate, escapeHtml: escapeHtml, safeHtml: safeHtml,
      signal: signal, computed: computed, effect: effect, batch: batch, untracked: untracked };
  }
});
`);

  return { content: parts.join('\n'), mappings };
}

/**
 * Generates a source map from bundle mappings.
 * @param {Array} mappings - Array of { file, startLine, lineCount }
 * @param {string} bundleFile - Output bundle filename
 * @returns {string} Source map JSON string
 */
function generateSourceMap(mappings, bundleFile) {
  const generator = new SourceMapGenerator({ file: bundleFile });

  for (const mapping of mappings) {
    // Add mapping for each line in the section
    for (let i = 0; i < mapping.lineCount; i++) {
      generator.addMapping({
        generated: { line: mapping.startLine + i, column: 0 },
        source: mapping.file,
        original: { line: i + 1, column: 0 },
      });
    }
  }

  return generator.toString();
}

/**
 * Builds the minified production bundle using esbuild.
 */
async function build() {
  try {
    const esbuild = require('esbuild');

    // Ensure build directory exists
    if (!fs.existsSync(buildDir)) {
      fs.mkdirSync(buildDir, { recursive: true });
    }

    const { content: bundleContent, mappings } = createBundle();

    // Write unminified bundle for tests (coverage collection needs it)
    const unminifiedPath = path.join(buildDir, 'hyperElement.bundle.js');
    const unminifiedMapPath = path.join(buildDir, 'hyperElement.bundle.js.map');

    // Write unminified bundle (no source map reference - so v8-to-istanbul reports on bundle)
    fs.writeFileSync(unminifiedPath, bundleContent);

    // Generate and write source map for unminified bundle (useful for debugging)
    const sourceMap = generateSourceMap(mappings, 'hyperElement.bundle.js');
    fs.writeFileSync(unminifiedMapPath, sourceMap);

    console.log(
      `Built: build/hyperElement.bundle.js (${mappings.length} source files combined)`
    );

    // Minify
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
  } catch (e) {
    console.error('Error building bundle:', e);
    process.exit(1);
  }
}

// Run build
build();
