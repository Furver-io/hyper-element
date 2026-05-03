/**
 * @file Identifier helpers for selector-capable +styled artifacts.
 * Generated classes and rule IDs must be deterministic so browser rendering,
 * SSR output, and hydration all agree on the same scoped CSS surface.
 */

/**
 * Marker placed on selector-capable objects returned from defineStyled()
 * callables so +styled can avoid re-applying registered base definitions.
 *
 * @type {symbol}
 */
export const HYPER_STYLED_DATA = Symbol.for('hyper-element.styled-data');

/**
 * Creates a deterministic small hash for generated class/rule identifiers.
 * This is not a security primitive; it only keeps class names compact and
 * stable across browser and SSR for the same canonical style inputs.
 *
 * @param {string} input - Canonical input string.
 * @returns {string} Base-36 hash segment.
 */
export function hash(input) {
  let value = 2166136261;
  for (let i = 0; i < input.length; i++) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(36);
}

/**
 * Converts values into a canonical JSON-compatible structure with sorted object
 * keys. Rule arrays keep their order because selector cascade order is
 * semantically meaningful.
 *
 * @param {unknown} value - Value to canonicalize.
 * @returns {unknown} Canonicalized value.
 */
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = canonicalize(value[key]);
        return acc;
      }, {});
  }
  return value;
}

/**
 * Creates a compact class token from component/tag/mode/style information.
 *
 * @param {string} prefix - Class prefix such as `he-s` or `he-i`.
 * @param {string} componentName - Owning custom element name when available.
 * @param {string} tagName - Styled tag name.
 * @param {string} mode - Base, variant, dynamic, or css mode.
 * @param {unknown} payload - Canonical payload used for hash stability.
 * @returns {string} Generated class token.
 */
export function classToken(prefix, componentName, tagName, mode, payload) {
  const readable = `${componentName || 'root'}-${tagName}-${mode}`
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const id = hash(JSON.stringify(canonicalize(payload)));
  return `${prefix}-${readable}-${id}`;
}

/**
 * Creates a rule record when CSS text is not empty.
 *
 * @param {string} idSeed - Stable rule seed.
 * @param {string} cssText - Generated CSS text.
 * @returns {{id: string, cssText: string}|null} Rule record or null.
 */
export function ruleRecord(idSeed, cssText) {
  if (!cssText) return null;
  return { id: `he-r-${hash(idSeed + cssText)}`, cssText };
}

/**
 * Builds an empty artifact used by all resolver paths.
 *
 * @returns {{inline: Object, classTokens: string[], rules: Array, managedInlineProps: string[]}}
 */
export function createArtifact() {
  return { inline: {}, classTokens: [], rules: [], managedInlineProps: [] };
}
