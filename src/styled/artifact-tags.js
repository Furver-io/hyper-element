/**
 * @file Normalized tag-style lookup helpers for +styled artifacts.
 * Shared selector groups and tag-specific styles meet here so the rest of the
 * resolver can work with one effective style definition for the rendered tag.
 */

/**
 * Merges normalized tag styles while preserving declaration override order and
 * selector rule order. Shared groups intentionally apply after tag-specific
 * base declarations to match the legacy flat resolver behavior.
 *
 * @param {ReturnType<import('./normalize.js').normalizeTagStyle>|undefined} target - Existing style.
 * @param {ReturnType<import('./normalize.js').normalizeTagStyle>} incoming - Style to merge.
 * @returns {ReturnType<import('./normalize.js').normalizeTagStyle>} Merged normalized style.
 */
export function mergeTagStyle(target, incoming) {
  if (!target) return incoming;
  const variants = new Map(target.variants);
  for (const [name, declarations] of incoming.variants.entries()) {
    variants.set(name, {
      ...(variants.get(name) || {}),
      ...declarations,
    });
  }
  return {
    baseDeclarations: {
      ...target.baseDeclarations,
      ...incoming.baseDeclarations,
    },
    variants,
    selectorRules: [...target.selectorRules, ...incoming.selectorRules],
    hasSelectorCss: target.hasSelectorCss || incoming.hasSelectorCss,
  };
}

/**
 * Gets the normalized static style for a tag, including matching shared groups.
 *
 * @param {ReturnType<import('./normalize.js').normalizeStyledDefinition>} normalized
 * @param {string} tagName
 * @returns {ReturnType<import('./normalize.js').normalizeTagStyle>|undefined}
 */
export function getTagStyle(normalized, tagName) {
  let style = normalized.tags.get(tagName);
  for (const group of normalized.sharedGroups) {
    if (group.tags.includes(tagName)) {
      style = mergeTagStyle(style, group.style);
    }
  }
  return style;
}
