/**
 * @file Normalization for selector-capable +styled definitions.
 * The rest of the styled system consumes this canonical shape so existing
 * inline definitions, nested variants, shared tag groups, and selector keys can
 * share one browser/SSR artifact path.
 */

const warnedMessages = new Set();

/**
 * Emits development warnings once per message. Selector support intentionally
 * ignores unsupported CSS rather than throwing so production render paths remain
 * resilient to bad optional style keys.
 *
 * @param {string} message - Warning text.
 */
function warnOnce(message) {
  const isProduction =
    typeof globalThis.process !== 'undefined' &&
    globalThis.process.env?.NODE_ENV === 'production';
  if (isProduction || warnedMessages.has(message)) return;
  warnedMessages.add(message);
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(message);
  }
}

/**
 * Detects whether an object can be treated as a declaration/selector map.
 *
 * @param {unknown} value - Candidate value from a styled definition.
 * @returns {value is Record<string, unknown>} True for plain style maps.
 */
function isStyleObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Identifies selector keys supported by this first selector backend. CSS custom
 * properties are explicitly declarations even though they start with dashes.
 *
 * @param {string} key - Style object key.
 * @returns {boolean} Whether the key is selector-like.
 */
export function isSelectorKey(key) {
  if (!key || key.startsWith('--') || key.startsWith('@')) return false;
  return (
    key.startsWith(':') ||
    key.startsWith('&') ||
    key.startsWith('.') ||
    key.startsWith('#') ||
    key.startsWith('[') ||
    key.startsWith('>') ||
    key.startsWith('+') ||
    key.startsWith('~') ||
    key.includes(' ') ||
    key.includes(',')
  );
}

/**
 * Identifies the intentionally small set of at-rules that can safely wrap
 * scoped class rules without needing a full CSS parser.
 *
 * @param {string} key - Style object key.
 * @returns {boolean} Whether the at-rule is supported.
 */
export function isSupportedAtRule(key) {
  return /^@(media|supports|container)\b/.test(key);
}

/**
 * Splits a style object into declarations and selector/at-rule records. Nested
 * selector keys inside variants are ignored in this build to keep variant
 * cascade predictable.
 *
 * @param {Record<string, unknown>} styleObject - Raw style map.
 * @param {{insideVariant?: boolean}} [options] - Normalization mode.
 * @returns {{declarations: Object, selectorRules: Array, hasSelectorCss: boolean}}
 */
export function splitDeclarationAndSelectorKeys(styleObject, options = {}) {
  const declarations = {};
  const selectorRules = [];

  if (!isStyleObject(styleObject)) {
    return { declarations, selectorRules, hasSelectorCss: false };
  }

  for (const [key, value] of Object.entries(styleObject)) {
    if (key.startsWith('@')) {
      if (!isSupportedAtRule(key)) {
        warnOnce(`Unsupported +styled at-rule "${key}" was ignored.`);
        continue;
      }
      if (options.insideVariant) {
        warnOnce(
          `Nested +styled selector key "${key}" inside a variant was ignored.`
        );
        continue;
      }
      if (isStyleObject(value)) {
        selectorRules.push({
          kind: 'at-rule',
          key,
          declarations: { ...value },
        });
      }
      continue;
    }

    if (isSelectorKey(key)) {
      if (options.insideVariant) {
        warnOnce(
          `Nested +styled selector key "${key}" inside a variant was ignored.`
        );
        continue;
      }
      if (isStyleObject(value)) {
        selectorRules.push({
          kind: 'selector',
          key,
          declarations: { ...value },
        });
      }
      continue;
    }

    declarations[key] = value;
  }

  return {
    declarations,
    selectorRules,
    hasSelectorCss: selectorRules.length > 0,
  };
}

/**
 * Normalizes a single tag or shared-group style definition. Nested syntax is
 * detected by the historical `base` key; otherwise declarations live directly
 * alongside selector keys.
 *
 * @param {Record<string, unknown>} tagStyles - Raw style definition for a tag.
 * @returns {{baseDeclarations: Object, variants: Map<string, Object>, selectorRules: Array, hasSelectorCss: boolean}}
 */
export function normalizeTagStyle(tagStyles) {
  const variants = new Map();
  const selectorRules = [];
  let baseDeclarations = {};

  if (!isStyleObject(tagStyles)) {
    return { baseDeclarations, variants, selectorRules, hasSelectorCss: false };
  }

  if ('base' in tagStyles && isStyleObject(tagStyles.base)) {
    const baseSplit = splitDeclarationAndSelectorKeys(tagStyles.base);
    baseDeclarations = baseSplit.declarations;
    selectorRules.push(...baseSplit.selectorRules);

    for (const [key, value] of Object.entries(tagStyles)) {
      if (key === 'base') continue;
      if (key.startsWith('@') || isSelectorKey(key)) {
        const split = splitDeclarationAndSelectorKeys({ [key]: value });
        selectorRules.push(...split.selectorRules);
        continue;
      }
      if (isStyleObject(value)) {
        const split = splitDeclarationAndSelectorKeys(value, {
          insideVariant: true,
        });
        variants.set(key, split.declarations);
      }
    }
  } else {
    const split = splitDeclarationAndSelectorKeys(tagStyles);
    baseDeclarations = split.declarations;
    selectorRules.push(...split.selectorRules);
  }

  return {
    baseDeclarations,
    variants,
    selectorRules,
    hasSelectorCss: selectorRules.length > 0,
  };
}

/**
 * Normalizes the public styled definition shape. Existing arrays remain the
 * public contract, while `defineStyled()` returns an augmented array that still
 * passes through this same path.
 *
 * @param {unknown} styled - Public styled definition.
 * @returns {{tags: Map<string, ReturnType<typeof normalizeTagStyle>>, sharedGroups: Array<{tags: string[], style: ReturnType<typeof normalizeTagStyle>}>, logic: Object|null}}
 */
export function normalizeStyledDefinition(styled) {
  const tags = new Map();
  const sharedGroups = [];
  const empty = { tags, sharedGroups, logic: null };

  if (!Array.isArray(styled) || !styled[0] || typeof styled[0] !== 'object') {
    return empty;
  }

  const [base, logic] = styled;
  for (const [key, value] of Object.entries(base)) {
    if (!isStyleObject(value)) continue;
    if (key.includes(',')) {
      sharedGroups.push({
        tags: key
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        style: normalizeTagStyle(value),
      });
    } else {
      tags.set(key, normalizeTagStyle(value));
    }
  }

  return {
    tags,
    sharedGroups,
    logic: logic && typeof logic === 'object' ? logic : null,
  };
}
