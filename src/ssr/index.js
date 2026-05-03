/**
 * @file SSR hydration main module.
 * Configures and initializes event capture for SSR-rendered components.
 */

import { startCapture } from './capture.js';
import { replayEvents } from './replay.js';
import { showDevIndicator, hideDevIndicator } from './devIndicator.js';

const DEFAULT_EVENTS = [
  'click',
  'dblclick',
  'input',
  'change',
  'submit',
  'keydown',
  'keyup',
  'keypress',
  'focus',
  'blur',
  'focusin',
  'focusout',
  'touchstart',
  'touchend',
  'touchmove',
  'touchcancel',
];

const ssrState = {
  config: {
    events: [...DEFAULT_EVENTS],
    devMode: false,
  },
  buffer: new Map(),
  elementStates: new WeakMap(),
  captureActive: false,
  registeredTags: new Set(),
};

/**
 * Configure SSR hydration settings.
 * @param {Object} options - Configuration options
 * @param {string[]} [options.events] - Event types to capture
 * @param {boolean} [options.devMode] - Show visual indicator
 * @param {string|Function|null} [options.styleNonce] - CSP nonce for generated style hosts
 */
function configureSSR(options = {}) {
  if (Array.isArray(options.events)) {
    ssrState.config.events = options.events;
  }
  if (options.devMode !== undefined) {
    ssrState.config.devMode = options.devMode;
    if (options.devMode) {
      showDevIndicator();
    } else {
      hideDevIndicator();
    }
  }
  if ('styleNonce' in options) {
    ssrState.config.styleNonce = options.styleNonce;
  }
}

/**
 * Initialize SSR event capture.
 * Called automatically when hyper-element loads.
 */
function initSSR() {
  if (ssrState.captureActive) return;
  ssrState.captureActive = true;
  startCapture(ssrState);
}

/**
 * Marks a tag as registered to stop capturing events for it.
 * @param {string} tagName - The custom element tag name
 */
function markTagRegistered(tagName) {
  ssrState.registeredTags.add(tagName.toLowerCase());
}

// Auto-initialize SSR capture when the library loads in browser
// This ensures events are captured before any custom elements are defined
if (typeof document !== 'undefined') {
  initSSR();
}

export { configureSSR, initSSR, ssrState, replayEvents, markTagRegistered };
