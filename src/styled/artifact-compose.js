/**
 * @file Artifact composition helpers for generated +styled CSS.
 * The main resolver owns scenario branching; this module owns the repeated
 * class/rule assembly steps so each cascade phase remains small and explicit.
 */

import { splitDeclarationAndSelectorKeys } from './normalize.js';
import { classToken, createArtifact } from './artifact-ids.js';
import {
  resolveDeclarationColors,
  resolveRuleColors,
} from './artifact-colors.js';
import {
  addClassDeclarations,
  addGeneratedRules,
  addSelectorRules,
} from './artifact-rules.js';

/**
 * Resolves direct full style objects into generated CSS without registered base
 * duplication.
 *
 * @param {Object} entry - Styled entry/context.
 * @param {string} tagName - Styled tag name.
 * @param {Record<string, unknown>} styleObject - Full selector-capable object.
 * @param {string} componentName - Owner custom element name.
 * @returns {ReturnType<typeof createArtifact>}
 */
export function resolveFullObject(entry, tagName, styleObject, componentName) {
  const artifact = createArtifact();
  const split = splitDeclarationAndSelectorKeys(styleObject);
  const declarations = resolveDeclarationColors(
    split.declarations,
    entry.colors
  );
  const selectorRules = resolveRuleColors(split.selectorRules, entry.colors);
  const className = classToken('he-i', componentName, tagName, 'full', {
    declarations,
    selectorRules,
  });
  artifact.classTokens.push(className);
  addGeneratedRules(
    artifact,
    className,
    declarations,
    selectorRules,
    className
  );
  return artifact;
}

/**
 * Adds the base generated class when static declarations or selectors exist.
 *
 * @param {Object} artifact - Mutable artifact.
 * @param {string} componentName - Owner custom element name.
 * @param {string} tagName - Styled tag name.
 * @param {Object} baseDeclarations - Static base declarations.
 * @param {Array} selectorRules - Static selector rules.
 */
export function addBaseClass(
  artifact,
  componentName,
  tagName,
  baseDeclarations,
  selectorRules
) {
  if (Object.keys(baseDeclarations).length === 0 && selectorRules.length === 0)
    return;
  const baseClass = classToken('he-s', componentName, tagName, 'base', {
    baseDeclarations,
    selectorRules,
  });
  artifact.classTokens.push(baseClass);
  addClassDeclarations(
    artifact,
    baseClass,
    baseDeclarations,
    `${baseClass}-base`
  );
}

/**
 * Adds active variant classes after base declarations and before selector CSS.
 *
 * @param {Object} artifact - Mutable artifact.
 * @param {string} componentName - Owner custom element name.
 * @param {string} tagName - Styled tag name.
 * @param {Array<{name: string, declarations: Object}>} variantEntries
 */
export function addVariantClasses(
  artifact,
  componentName,
  tagName,
  variantEntries
) {
  for (const variant of variantEntries) {
    const variantClass = classToken(
      'he-v',
      componentName,
      tagName,
      variant.name,
      {
        declarations: variant.declarations,
      }
    );
    artifact.classTokens.push(variantClass);
    addGeneratedRules(
      artifact,
      variantClass,
      variant.declarations,
      [],
      variantClass
    );
  }
}

/**
 * Adds static selector rules after active variants.
 *
 * @param {Object} artifact - Mutable artifact.
 * @param {Array} selectorRules - Static selector rules.
 */
export function addStaticSelectorRules(artifact, selectorRules) {
  if (selectorRules.length === 0) return;
  addSelectorRules(
    artifact,
    artifact.classTokens[0],
    selectorRules,
    `${artifact.classTokens[0]}-selectors`
  );
}

/**
 * Adds dynamic `style=${...}` selector CSS after definition selector rules.
 *
 * @param {Object} artifact - Mutable artifact.
 * @param {Object} entry - Styled entry/context.
 * @param {string} tagName - Styled tag name.
 * @param {string} componentName - Owner custom element name.
 * @param {ReturnType<typeof splitDeclarationAndSelectorKeys>|null} dynamicCssSplit
 */
export function addDynamicCss(
  artifact,
  entry,
  tagName,
  componentName,
  dynamicCssSplit
) {
  if (!dynamicCssSplit?.hasSelectorCss) return;
  const declarations = resolveDeclarationColors(
    dynamicCssSplit.declarations,
    entry.colors
  );
  const rules = resolveRuleColors(dynamicCssSplit.selectorRules, entry.colors);
  const dynamicClass = classToken('he-i', componentName, tagName, 'style', {
    declarations,
    rules,
  });
  artifact.classTokens.push(dynamicClass);
  addGeneratedRules(artifact, dynamicClass, declarations, rules, dynamicClass);
}

/**
 * Adds generated override CSS after base, variants, and selector rules.
 *
 * @param {Object} artifact - Mutable artifact.
 * @param {Object} entry - Styled entry/context.
 * @param {string} tagName - Styled tag name.
 * @param {string} componentName - Owner custom element name.
 * @param {ReturnType<typeof splitDeclarationAndSelectorKeys>|null} cssOverrideSplit
 */
export function addCssOverride(
  artifact,
  entry,
  tagName,
  componentName,
  cssOverrideSplit
) {
  if (!cssOverrideSplit?.hasSelectorCss) return;
  const declarations = resolveDeclarationColors(
    cssOverrideSplit.declarations,
    entry.colors
  );
  const rules = resolveRuleColors(cssOverrideSplit.selectorRules, entry.colors);
  const cssClass = classToken('he-i', componentName, tagName, 'css', {
    declarations,
    rules,
  });
  artifact.classTokens.push(cssClass);
  const cssRules = rules.map((rule) =>
    rule.kind === 'selector'
      ? {
          ...rule,
          key: `&.${cssClass}${rule.key.startsWith('&') ? rule.key.slice(1) : rule.key}`,
        }
      : rule
  );
  addGeneratedRules(
    artifact,
    artifact.classTokens[0] || cssClass,
    declarations,
    cssRules,
    cssClass
  );
}
