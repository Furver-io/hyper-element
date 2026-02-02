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

  // Detect if served from project root (/kitchensink/...) or kitchensink root (/)
  var isProjectRoot = window.location.pathname.startsWith('/kitchensink/');
  var basePath = isProjectRoot ? '../' : './';

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
        'import { hyperElement, signal, computed, effect, batch, untracked, configureSSR } from "hyper-element";' +
        // Add configureSSR as static method to match bundle behavior
        'hyperElement.configureSSR = configureSSR;' +
        'window.hyperElement = hyperElement;' +
        'window.signal = signal;' +
        'window.computed = computed;' +
        'window.effect = effect;' +
        'window.batch = batch;' +
        'window.untracked = untracked;' +
        'window.configureSSR = configureSSR;' +
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
})();
