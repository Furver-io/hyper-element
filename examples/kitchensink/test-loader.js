/**
 * @file Test loader for hyper-element kitchensink tests.
 * Supports two modes:
 * - Source mode (?mode=src): Loads from src/ via ES modules for coverage
 * - Bundle mode (?mode=bundle or ?bundle=min): Loads built bundle
 */

(function () {
  // Parse mode from hash (e.g., #mode=src) or query string
  var hash = window.location.hash.slice(1); // Remove #
  var search = window.location.search;
  var hashParams = new URLSearchParams(hash);
  var searchParams = new URLSearchParams(search);

  // Check hash first, then query string, then choose the browser-safe bundle.
  // Domain context: developers often open a single kitchen sink HTML file
  // directly from the filesystem while reviewing an example in the desktop
  // app or browser. Chromium blocks ES module imports from file:// pages, so
  // direct file opens cannot default to src/ modules even though source mode
  // is useful for served Playwright coverage.
  // Technical context: source coverage requests ?mode=src over HTTP, where
  // import maps and module imports are allowed. Plain file:// and served
  // browser review use the classic bundle script by default because script
  // tags can load local files without the module CORS restriction. Explicit
  // #mode=... or ?mode=... still wins in every protocol.
  var requestedMode = hashParams.get('mode') || searchParams.get('mode');
  var mode = requestedMode || 'bundle';
  var isMinified =
    hashParams.get('bundle') === 'min' || searchParams.get('bundle') === 'min';

  // Detect if served from project root (/examples/kitchensink/...) or kitchensink root (/)
  var isProjectRoot = window.location.pathname.includes(
    '/examples/kitchensink/'
  );
  var basePath = isProjectRoot ? '../../' : './';

  var loaderScript = document.currentScript;

  function appendScript(script) {
    if (loaderScript?.parentNode) {
      loaderScript.parentNode.insertBefore(script, loaderScript.nextSibling);
    } else {
      (document.head || document.documentElement).appendChild(script);
    }
  }

  function dispatchLoaded() {
    window.dispatchEvent(new Event('hyper-element-loaded'));
  }

  window.hyperElementReady = new Promise(function (resolve, reject) {
    window.addEventListener('hyper-element-loaded', resolve, { once: true });
    window.addEventListener('hyper-element-load-error', reject, { once: true });
  });

  if (mode === 'src' && !isMinified) {
    // Source mode: Load from src/ via ES modules.
    // Domain context: source coverage needs import maps and ESM imports, but
    // Chromium reports `document.write(<script>)` as a parser-blocking
    // violation when users review kitchen sink pages in the browser.
    // Technical context: dynamic script nodes preserve the same public
    // `hyper-element-loaded` event while avoiding document.write entirely.
    var importMap = document.createElement('script');
    importMap.type = 'importmap';
    importMap.textContent = JSON.stringify({
      imports: {
        'hyper-element': basePath + 'src/index.js',
        'hyper-element/': basePath + 'src/',
      },
    });
    appendScript(importMap);

    var sourceScript = document.createElement('script');
    sourceScript.type = 'module';
    sourceScript.textContent =
      'import { hyperElement, withOptions, signal, computed, effect, batch, untracked, configureSSR, defineStyled, renderSpec, registerComponent, validateSpec, listComponentTypes, getCatalog } from "hyper-element";' +
      'import { html, bind, dom } from "hyper-element/render/index.js";' +
      'import { hyperLayoutElement, createLayoutEngine, normalizePositions } from "hyper-element/layout/index.js";' +
      'import { BUILT_IN_COMPONENTS } from "hyper-element/json-render/index.js";' +
      'hyperElement.configureSSR = configureSSR;' +
      'Object.assign(window, { hyperElement, withOptions, signal, computed, effect, batch, untracked, configureSSR, defineStyled, renderSpec, registerComponent, validateSpec, listComponentTypes, getCatalog, hyperLayoutElement, createLayoutEngine, normalizePositions, html, bind, dom, BUILT_IN_COMPONENTS });' +
      "window.dispatchEvent(new Event('hyper-element-loaded'));";
    sourceScript.onerror = function () {
      window.dispatchEvent(new Event('hyper-element-load-error'));
    };
    appendScript(sourceScript);
  } else {
    // Bundle mode: Load built bundle via a classic script tag.
    // Domain context: kitchen sink pages use one readiness event before
    // running their inline examples, regardless of whether the API came from
    // source modules or from the browser bundle. Keeping the same event in
    // both branches prevents direct file:// review from racing the bundle.
    // Technical context: classic scripts do not participate in the ES module
    // graph, so the script onload handler becomes the explicit dependency
    // edge that wakes inline module harnesses waiting for Hyper Element.
    var bundle = isMinified ? 'hyperElement.min.js' : 'hyperElement.bundle.js';
    var cacheBust =
      window.location.protocol === 'file:' ? '?v=' + Date.now() : '';
    var bundleScript = document.createElement('script');
    bundleScript.src = basePath + 'build/' + bundle + cacheBust;
    bundleScript.async = false;
    bundleScript.onload = dispatchLoaded;
    bundleScript.onerror = function () {
      window.dispatchEvent(new Event('hyper-element-load-error'));
    };
    appendScript(bundleScript);
  }

  // Inject global test result indicator styles for all tests.
  var resultStyle = document.createElement('style');
  resultStyle.textContent =
    'section[data-test-result="pass"] h2::after { content: "✅"; filter: grayscale(100%); display: inline-block; margin-left: 0.5em; }' +
    'section[data-test-result="fail"] h2::after { content: "❎"; filter: grayscale(100%); display: inline-block; margin-left: 0.5em; }';
  appendScript(resultStyle);

  // ===== Phase-aware snapshot helpers =====
  //
  // canonicalizeRender(html) — normalizes the render output so snapshots stay
  // stable across runs. hyper-element generates random ids of the form
  //   fn-<random>  — for function attribute placeholders
  //   ob-<random>  — for complex-object attribute placeholders
  // Each random segment is collapsed to a constant token "RND" so the
  // snapshot string remains deterministic. This canonicalization is reversible
  // for inspection: real run output can always be re-canonicalized identically
  // before comparing against an expected static snapshot.
  function canonicalizeRender(html) {
    if (typeof html !== 'string') return '';
    return html.replace(/(["'>])(fn|ob)-[a-z0-9]+/gi, '$1$2-RND');
  }
  window.canonicalizeRender = canonicalizeRender;

  // assertSnapshot(sectionName, target, expected[, normalize])
  //   sectionName — the data-test name; sets data-test-result accordingly.
  //   target      — element OR a function returning the rendered string.
  //   expected    — the static expected snapshot string (already canonicalized).
  //   normalize   — optional extra normalizer function applied to actual.
  // Returns true on pass, false on fail. Logs a clear diff on failure.
  function assertSnapshot(sectionName, target, expected, normalize) {
    var section = document.querySelector('[data-test="' + sectionName + '"]');
    var actualRaw =
      typeof target === 'function' ? target() : target && target.outerHTML;
    var actual = canonicalizeRender(actualRaw || '');
    if (typeof normalize === 'function') actual = normalize(actual);
    if (actual === expected) {
      if (section) section.dataset.testResult = 'pass';
      return true;
    }
    console.error(
      'Snapshot mismatch for "' +
        sectionName +
        '"\n' +
        'Expected: ' +
        expected +
        '\n' +
        'Actual:   ' +
        actual
    );
    if (section) section.dataset.testResult = 'fail';
    return false;
  }
  window.assertSnapshot = assertSnapshot;
})();
