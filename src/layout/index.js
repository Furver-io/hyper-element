/**
 * @file Public entry point for Hyper Layout.
 *
 * Importing this module registers <hyper-layout> as a side effect and
 * exposes the DOM-free engine plus position helpers for applications that
 * need to inspect or adapt layout state.
 *
 * This subpath is intentionally optional. Core Hyper Element users pay no
 * runtime cost unless they import `hyper-element/layout`, while dashboard
 * applications get one stable entry point for the custom element, engine, and
 * persistence normalization helpers.
 */

export { createLayoutEngine, HyperLayoutEngine } from './engine.js';
export {
  normalizePositions,
  parseLayoutValue,
  reconcilePositions,
} from './positions.js';
export { hyperLayoutElement } from './element.js';
