/**
 * @file Public defineStyled helper for reusable +styled definitions.
 * The helper intentionally returns the existing styled array contract, augmented
 * with non-enumerable tag callables for direct full/inline style object usage.
 */

import { HYPER_STYLED_DATA, resolveDirectStyleObject } from './artifact.js';

/**
 * Builds a reusable styled definition. The returned value can be assigned to a
 * component `styled` option, and each tag callable can produce either a full
 * selector-capable style object for +styled or an inline-only object for native
 * `style=${...}` use.
 *
 * @param {Object} base - Base styled definition object.
 * @param {Object|null} [logic=null] - Optional logic function map.
 * @returns {Array & Record<string, Function>} Existing styled config array with tag callables.
 */
export function defineStyled(base, logic = null) {
  const styledArray = [base, logic || {}];

  for (const tagName of Object.keys(base || {})) {
    if (tagName.includes(',')) continue;

    /**
     * Resolves the named tag into a selector-capable full style object. The
     * marker property is non-enumerable so DOM serialization and object spreads
     * see only normal style keys while +styled can still detect direct output.
     *
     * @param {Object} [flags={}] - Variant flags or direct style input.
     * @param {Object|null} [ctx=null] - Optional component context for logic.
     * @param {unknown} [store=undefined] - Optional store for logic.
     * @returns {Object} Full selector-capable style object.
     */
    const full = (flags = {}, ctx = null, store = undefined) => {
      const result = resolveDirectStyleObject({
        base,
        logic,
        tagName,
        styleValue: flags,
        ctx,
        store,
        mode: 'full',
      });
      Object.defineProperty(result, HYPER_STYLED_DATA, {
        value: { tagName, mode: 'full' },
        enumerable: false,
      });
      return result;
    };

    full.inline = (flags = {}, ctx = null, store = undefined) =>
      resolveDirectStyleObject({
        base,
        logic,
        tagName,
        styleValue: flags,
        ctx,
        store,
        mode: 'inline',
      });

    Object.defineProperty(styledArray, tagName, {
      value: full,
      enumerable: false,
    });
  }

  return styledArray;
}
