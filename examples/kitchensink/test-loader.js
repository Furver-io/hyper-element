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

  // Check hash first, then query string
  var mode = hashParams.get('mode') || searchParams.get('mode') || 'bundle';
  var isMinified = hashParams.get('bundle') === 'min' || searchParams.get('bundle') === 'min';

  // Detect if served from project root (/examples/kitchensink/...) or kitchensink root (/)
  var isProjectRoot = window.location.pathname.includes('/examples/kitchensink/');
  var basePath = isProjectRoot ? '../../' : './';

  if (mode === 'src' && !isMinified) {
    // Source mode: Load from src/ via ES modules
    // Write import map for module resolution
    document.write(
      '<script type="importmap">' +
        JSON.stringify({
          imports: {
            'hyper-element': basePath + 'src/index.js',
            'hyper-element/': basePath + 'src/',
          },
        }) +
        '</' +
        'script>'
    );

    // Write module script that imports and exposes globals
    // This ensures hyperElement is available before inline scripts run
    document.write(
      '<script type="module">' +
        'import { hyperElement, withOptions, signal, computed, effect, batch, untracked, configureSSR, renderSpec, registerComponent, validateSpec, listComponentTypes } from "hyper-element";' +
        'import { html, dom } from "hyper-element/render/index.js";' +
        'import { BUILT_IN_COMPONENTS } from "hyper-element/json-render/index.js";' +
        // Add configureSSR as static method to match bundle behavior
        'hyperElement.configureSSR = configureSSR;' +
        'window.hyperElement = hyperElement;' +
        'window.withOptions = withOptions;' +
        'window.signal = signal;' +
        'window.computed = computed;' +
        'window.effect = effect;' +
        'window.batch = batch;' +
        'window.untracked = untracked;' +
        'window.configureSSR = configureSSR;' +
        'window.renderSpec = renderSpec;' +
        'window.registerComponent = registerComponent;' +
        'window.validateSpec = validateSpec;' +
        'window.listComponentTypes = listComponentTypes;' +
        'window.html = html;' +
        'window.dom = dom;' +
        'window.BUILT_IN_COMPONENTS = BUILT_IN_COMPONENTS;' +
        // Dispatch event when ready so tests can wait
        "window.dispatchEvent(new Event('hyper-element-loaded'));" +
        '</' +
        'script>'
    );
  } else {
    // Bundle mode: Load built bundle via script tag
    var bundle = isMinified ? 'hyperElement.min.js' : 'hyperElement.bundle.js';
    document.write(
      '<script src="' + basePath + 'build/' + bundle + '"></' + 'script>'
    );
  }

  // Inject global test result indicator styles for all tests
  document.write(
    '<style>' +
      'section[data-test-result="pass"] h2::after { content: "✅"; filter: grayscale(100%); display: inline-block; margin-left: 0.5em; }' +
      'section[data-test-result="fail"] h2::after { content: "❎"; filter: grayscale(100%); display: inline-block; margin-left: 0.5em; }' +
    '</style>'
  );

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
    return html
      .replace(/(["'>])(fn|ob)-[a-z0-9]+/gi, '$1$2-RND');
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
      typeof target === 'function'
        ? target()
        : target && target.outerHTML;
    var actual = canonicalizeRender(actualRaw || '');
    if (typeof normalize === 'function') actual = normalize(actual);
    if (actual === expected) {
      if (section) section.dataset.testResult = 'pass';
      return true;
    }
    console.error(
      'Snapshot mismatch for "' + sectionName + '"\n' +
        'Expected: ' + expected + '\n' +
        'Actual:   ' + actual
    );
    if (section) section.dataset.testResult = 'fail';
    return false;
  }
  window.assertSnapshot = assertSnapshot;
})();
