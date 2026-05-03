/**
 * @file Direct callable resolution for defineStyled().
 * Direct callables let applications reuse a styled definition either as a full
 * selector-capable object for +styled or as inline-only declarations for native
 * `style=${...}` paths.
 */

import {
  normalizeStyledDefinition,
  splitDeclarationAndSelectorKeys,
} from './normalize.js';
import { getTagStyle } from './artifact-tags.js';

/**
 * Resolves a defined-style tag object for direct callable full or inline usage.
 *
 * @param {Object} options - Direct resolution inputs.
 * @param {Object} options.base - Base styled definition object.
 * @param {Object|null} options.logic - Optional logic map.
 * @param {string} options.tagName - Tag callable name.
 * @param {unknown} options.styleValue - Flags/style input.
 * @param {Object|null} [options.ctx] - Optional context for logic.
 * @param {unknown} [options.store] - Optional store.
 * @param {'full'|'inline'} options.mode - Direct output mode.
 * @returns {Object} Direct style object.
 */
export function resolveDirectStyleObject({
  base,
  logic = null,
  tagName,
  styleValue,
  ctx = null,
  store = undefined,
  mode,
}) {
  const normalized = normalizeStyledDefinition([base, logic || {}]);
  const tagStyle = getTagStyle(normalized, tagName);
  const result = {};
  if (tagStyle) {
    Object.assign(result, tagStyle.baseDeclarations);
    if (styleValue && typeof styleValue === 'object') {
      for (const [name, active] of Object.entries(styleValue)) {
        if (active === true && tagStyle.variants.has(name)) {
          Object.assign(result, tagStyle.variants.get(name));
        }
      }
    }
    if (mode === 'full') {
      for (const rule of tagStyle.selectorRules) {
        result[rule.key] = { ...rule.declarations };
      }
    }
  }
  if (logic && typeof logic[tagName] === 'function') {
    const logicResult = logic[tagName](styleValue, ctx, store);
    if (logicResult && typeof logicResult === 'object') {
      const split = splitDeclarationAndSelectorKeys(logicResult);
      Object.assign(result, split.declarations);
      if (mode === 'full') {
        for (const rule of split.selectorRules) {
          result[rule.key] = { ...rule.declarations };
        }
      }
    }
  }
  return result;
}
