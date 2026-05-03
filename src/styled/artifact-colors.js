/**
 * @file Palette resolution helpers for +styled artifacts.
 * Color aliases are resolved before declarations become either inline style or
 * generated CSS so browser rendering and SSR serialize the same values.
 */

/**
 * Resolves color names deeply inside declaration objects while preserving
 * selector keys and at-rule conditions.
 *
 * @param {Record<string, unknown>} declarations - Declaration map.
 * @param {Record<string, string>|null|undefined} colors - Palette values.
 * @returns {Record<string, unknown>} Declaration map with palette substitutions.
 */
export function resolveDeclarationColors(declarations, colors) {
  if (!colors || Object.keys(colors).length === 0) return { ...declarations };
  const resolved = {};
  for (const [prop, value] of Object.entries(declarations || {})) {
    if (typeof value !== 'string') {
      resolved[prop] = value;
      continue;
    }
    if (colors[value]) {
      resolved[prop] = colors[value];
      continue;
    }
    let next = value;
    for (const [name, color] of Object.entries(colors)) {
      next = next.replace(new RegExp(`\\b${name}\\b`, 'g'), color);
    }
    resolved[prop] = next;
  }
  return resolved;
}

/**
 * Resolves colors in selector rules while keeping selector text unchanged.
 *
 * @param {Array<{kind: string, key: string, declarations: Object}>} rules
 * @param {Record<string, string>|null|undefined} colors
 * @returns {Array<{kind: string, key: string, declarations: Object}>}
 */
export function resolveRuleColors(rules, colors) {
  return rules.map((rule) => ({
    ...rule,
    declarations: resolveDeclarationColors(rule.declarations, colors),
  }));
}
