/**
 * @file CSS rule assembly helpers for selector-capable +styled artifacts.
 * These helpers keep cascade phase ordering explicit while sharing the same
 * serializer path between browser rendering and SSR.
 */

import {
  serializeAtRule,
  serializeClassRule,
  serializeSelectorRule,
} from './serializer.js';
import { ruleRecord } from './artifact-ids.js';

/**
 * Adds a generated class rule plus selector/at-rule records to the artifact.
 *
 * @param {Object} artifact - Mutable artifact.
 * @param {string} className - Class token.
 * @param {Object} declarations - Base declarations for the class.
 * @param {Array<{kind: string, key: string, declarations: Object}>} selectorRules
 * @param {string} ruleSeed - Stable seed for rule IDs.
 */
export function addGeneratedRules(
  artifact,
  className,
  declarations,
  selectorRules,
  ruleSeed
) {
  const texts = [];
  const baseRule = serializeClassRule(className, declarations);
  if (baseRule) texts.push(baseRule);
  for (const selectorRule of selectorRules) {
    const cssText =
      selectorRule.kind === 'at-rule'
        ? serializeAtRule(className, selectorRule)
        : serializeSelectorRule(className, selectorRule);
    if (cssText) texts.push(cssText);
  }
  if (texts.length === 0) return;
  const cssText = texts.join('\n\n');
  const rule = ruleRecord(ruleSeed, cssText);
  if (rule) artifact.rules.push(rule);
}

/**
 * Adds only a generated class declaration rule. Selector rules are emitted in a
 * later cascade phase so variants can sit between base declarations and
 * selectors as required by +styled cascade ordering.
 *
 * @param {Object} artifact - Mutable artifact.
 * @param {string} className - Class token.
 * @param {Object} declarations - Declarations for the class.
 * @param {string} ruleSeed - Stable seed for rule IDs.
 */
export function addClassDeclarations(
  artifact,
  className,
  declarations,
  ruleSeed
) {
  const cssText = serializeClassRule(className, declarations);
  const rule = ruleRecord(ruleSeed, cssText);
  if (rule) artifact.rules.push(rule);
}

/**
 * Adds only selector and at-rule records for a class token.
 *
 * @param {Object} artifact - Mutable artifact.
 * @param {string} className - Class token.
 * @param {Array<{kind: string, key: string, declarations: Object}>} selectorRules
 * @param {string} ruleSeed - Stable seed for rule IDs.
 */
export function addSelectorRules(artifact, className, selectorRules, ruleSeed) {
  const texts = [];
  for (const selectorRule of selectorRules) {
    const cssText =
      selectorRule.kind === 'at-rule'
        ? serializeAtRule(className, selectorRule)
        : serializeSelectorRule(className, selectorRule);
    if (cssText) texts.push(cssText);
  }
  const rule = ruleRecord(ruleSeed, texts.join('\n\n'));
  if (rule) artifact.rules.push(rule);
}
