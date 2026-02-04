/**
 * @file Public API for the +styled system.
 * @module hyper-element/styled
 */

// Registry
export {
  registerStyled,
  unregisterStyled,
  getStyledEntry,
  setRenderingInstance,
  getRenderingInstance,
} from './registry.js';

// Resolution
export {
  resolveStyles,
  resolveStylesWithEntry,
  resolveColors,
  isNestedSyntax,
} from './resolution.js';

// DOM application
export { applyStylesToNode } from './apply.js';

// Browser handler
export { styledStyleHandler } from './handler.js';

// SSR (re-export from string-update which has the implementation)
export {
  setSSRContext,
  getSSRContext,
  styleObjectToString,
} from '../ssr/string-update.js';

// Parser hooks
export { STYLED_SUFFIX } from './parser-hooks.js';
