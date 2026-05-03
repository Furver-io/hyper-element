/**
 * @file Styled artifact resolver shared by browser rendering and SSR.
 * It translates public +styled inputs into inline declarations, generated
 * class tokens, and scoped CSS rules without exposing a public style-host API.
 */

import {
  normalizeStyledDefinition,
  splitDeclarationAndSelectorKeys,
} from './normalize.js';
import { HYPER_STYLED_DATA, createArtifact } from './artifact-ids.js';
import {
  resolveDeclarationColors,
  resolveRuleColors,
} from './artifact-colors.js';
import { getTagStyle } from './artifact-tags.js';
import {
  addBaseClass,
  addCssOverride,
  addDynamicCss,
  addStaticSelectorRules,
  addVariantClasses,
  resolveFullObject,
} from './artifact-compose.js';

export { HYPER_STYLED_DATA } from './artifact-ids.js';
export { resolveDeclarationColors } from './artifact-colors.js';
export { resolveDirectStyleObject } from './artifact-direct.js';

/**
 * Splits a dynamic `style=${...}` value into variant flags, inline
 * declarations, and selector-capable dynamic CSS data.
 *
 * @param {unknown} styleValue - Runtime style value.
 * @param {ReturnType<typeof import('./normalize.js').normalizeTagStyle>|undefined} tagStyle
 * @returns {{inline: Object, dynamicCss: Object|null, dynamicFlags: Object}}
 */
function splitDynamicStyle(styleValue, tagStyle) {
  const inline = {};
  const dynamicFlags = {};
  if (!styleValue || typeof styleValue !== 'object' || styleValue.__unsafe) {
    return { inline, dynamicCss: null, dynamicFlags };
  }

  const split = splitDeclarationAndSelectorKeys(styleValue);
  if (split.hasSelectorCss) {
    return { inline, dynamicCss: styleValue, dynamicFlags };
  }

  for (const [key, value] of Object.entries(split.declarations)) {
    if (typeof value === 'boolean' && tagStyle?.variants?.has(key)) {
      dynamicFlags[key] = value;
    } else {
      inline[key] = value;
    }
  }

  return { inline, dynamicCss: null, dynamicFlags };
}

/**
 * Resolves the public styled input into a browser/SSR artifact.
 *
 * @param {Object} entry - Styled registry or SSR entry.
 * @param {string} tagName - Styled tag name.
 * @param {Object} input - Runtime styled inputs.
 * @param {unknown} input.styleValue - Value from style=${...}.
 * @param {unknown} input.cssOverride - Value from css=${...}.
 * @param {Array<{name: string, active: boolean}>} [input.staticFlags]
 * @param {Record<string, boolean>} [input.dynamicFlags]
 * @param {string} [input.componentName] - Owning custom element name.
 * @returns {ReturnType<typeof createArtifact>|null}
 */
export function resolveStyledArtifact(entry, tagName, input = {}) {
  const artifact = createArtifact();
  const styleValue = input.styleValue;
  const componentName =
    input.componentName ||
    entry?.instance?.localName ||
    entry?.ctx?.localName ||
    'root';

  if (
    styleValue &&
    typeof styleValue === 'object' &&
    styleValue[HYPER_STYLED_DATA]?.mode === 'full'
  ) {
    return resolveFullObject(entry || {}, tagName, styleValue, componentName);
  }

  if (!entry || !Array.isArray(entry.styled) || !entry.styled[0]) {
    if (styleValue && typeof styleValue === 'object' && !styleValue.__unsafe) {
      const split = splitDeclarationAndSelectorKeys(styleValue);
      if (!split.hasSelectorCss) {
        artifact.inline = { ...split.declarations };
        artifact.managedInlineProps = Object.keys(artifact.inline);
        return artifact.managedInlineProps.length > 0 ? artifact : null;
      }
      return resolveFullObject(
        { colors: null },
        tagName,
        styleValue,
        componentName
      );
    }
    return null;
  }

  const normalized = normalizeStyledDefinition(entry.styled);
  const tagStyle = getTagStyle(normalized, tagName);
  const logic = normalized.logic;
  const store = entry.store ?? entry.ctx?.store;
  const logicResult =
    logic && typeof logic[tagName] === 'function'
      ? logic[tagName](styleValue, entry.ctx, store)
      : null;

  const runtimeStyleValue = logicResult || styleValue;
  const dynamic = splitDynamicStyle(runtimeStyleValue, tagStyle);
  const explicitDynamicFlags = input.dynamicFlags || {};
  const activeFlags = [
    ...(input.staticFlags || []),
    ...Object.entries(explicitDynamicFlags).map(([name, active]) => ({
      name,
      active,
    })),
    ...Object.entries(dynamic.dynamicFlags).map(([name, active]) => ({
      name,
      active,
    })),
  ];

  const baseDeclarations = tagStyle
    ? resolveDeclarationColors(tagStyle.baseDeclarations, entry.colors)
    : {};
  const selectorRules = tagStyle
    ? resolveRuleColors(tagStyle.selectorRules, entry.colors)
    : [];
  const variantEntries = [];

  if (tagStyle) {
    for (const flag of activeFlags) {
      if (flag.active && tagStyle.variants.has(flag.name)) {
        const declarations = resolveDeclarationColors(
          tagStyle.variants.get(flag.name),
          entry.colors
        );
        variantEntries.push({ name: flag.name, declarations });
      }
    }
  }

  const dynamicCssSplit = dynamic.dynamicCss
    ? splitDeclarationAndSelectorKeys(dynamic.dynamicCss)
    : null;
  const cssOverrideSplit =
    input.cssOverride &&
    typeof input.cssOverride === 'object' &&
    !input.cssOverride.__unsafe
      ? splitDeclarationAndSelectorKeys(input.cssOverride)
      : null;

  const hasGeneratedCss =
    selectorRules.length > 0 ||
    !!dynamicCssSplit?.hasSelectorCss ||
    !!cssOverrideSplit?.hasSelectorCss;

  if (!hasGeneratedCss) {
    artifact.inline = { ...baseDeclarations };
    for (const variant of variantEntries) {
      artifact.inline = { ...artifact.inline, ...variant.declarations };
    }
    artifact.inline = {
      ...artifact.inline,
      ...resolveDeclarationColors(dynamic.inline, entry.colors),
    };
    artifact.managedInlineProps = Object.keys(artifact.inline);
    return artifact.managedInlineProps.length > 0 ? artifact : null;
  }

  addBaseClass(
    artifact,
    componentName,
    tagName,
    baseDeclarations,
    selectorRules
  );
  addVariantClasses(artifact, componentName, tagName, variantEntries);
  addStaticSelectorRules(artifact, selectorRules);
  addDynamicCss(artifact, entry, tagName, componentName, dynamicCssSplit);
  addCssOverride(artifact, entry, tagName, componentName, cssOverrideSplit);

  artifact.inline = resolveDeclarationColors(dynamic.inline, entry.colors);
  artifact.managedInlineProps = Object.keys(artifact.inline);
  return artifact;
}
