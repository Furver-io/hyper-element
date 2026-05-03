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

export {
  HYPER_STYLED_DATA,
  resolveStyledArtifact,
  resolveDirectStyleObject,
  resolveDeclarationColors,
} from './artifact.js';

export {
  normalizeStyledDefinition,
  normalizeTagStyle,
  splitDeclarationAndSelectorKeys,
  isSelectorKey,
  isSupportedAtRule,
} from './normalize.js';

export {
  toKebab,
  serializeInlineDeclarations,
  serializeSelectorRule,
  serializeAtRule,
  scopeSelector,
  escapeCssForStyleTag,
} from './serializer.js';

export {
  beginStyleRender,
  commitStyleRender,
  cleanupStyleRoot,
  registerStyleRules,
  createSSRStyleHost,
} from './style-host.js';

// DOM application
export { applyStyledArtifactToNode, getStyledNodeState } from './apply.js';

// Browser handler
export {
  styledStyleHandler,
  styledCssHandler,
  styledAttributeHandler,
} from './handler.js';

export { defineStyled } from './define-styled.js';

// SSR (re-export from string-update which has the implementation)
export {
  setSSRContext,
  getSSRContext,
  styleObjectToString,
} from '../ssr/string-update.js';

// Parser hooks
export { STYLED_SUFFIX } from './parser-hooks.js';
