/**
 * @file DOM application helpers for +styled elements.
 * Inline-only styles keep the historical CSSOM path, while selector-capable
 * artifacts add/remove only the generated class tokens and inline properties
 * owned by the styled renderer.
 * @module hyper-element/styled/apply
 */

import { toKebab } from './serializer.js';

const nodeStates = new WeakMap();

/**
 * Gets state for a styled DOM node. The state is scoped to a node so repeated
 * renders can remove stale generated classes/rules without touching user-owned
 * classes or unrelated inline styles.
 *
 * @param {HTMLElement} node - Styled DOM node.
 * @returns {{latestStyleValue: unknown, latestCssOverride: unknown, latestDynamicFlags: Object, previousInlineProps: Set<string>, previousClassTokens: Set<string>, previousRuleIds: Set<string>}}
 */
export function getStyledNodeState(node) {
  let state = nodeStates.get(node);
  if (!state) {
    state = {
      latestStyleValue: undefined,
      latestCssOverride: undefined,
      latestDynamicFlags: {},
      previousInlineProps: new Set(),
      previousClassTokens: new Set(),
      previousRuleIds: new Set(),
    };
    nodeStates.set(node, state);
  }
  return state;
}

/**
 * Diffs inline styles owned by +styled. Removed managed properties are cleared,
 * but any user-authored properties outside the previous managed set survive.
 *
 * @param {HTMLElement} node - Styled DOM node.
 * @param {Record<string, string|number|null|undefined>} nextInline - Next inline styles.
 * @param {ReturnType<typeof getStyledNodeState>} state - Node state.
 */
function applyInlineDiff(node, nextInline, state) {
  const nextProps = new Set(Object.keys(nextInline || {}));

  for (const oldProp of state.previousInlineProps) {
    if (!nextProps.has(oldProp)) {
      node.style.removeProperty(toKebab(oldProp));
    }
  }

  for (const [prop, value] of Object.entries(nextInline || {})) {
    const cssProp = toKebab(prop);
    if (value == null || value === '') {
      node.style.removeProperty(cssProp);
      nextProps.delete(prop);
      continue;
    }
    const nextValue = String(value);
    if (node.style.getPropertyValue(cssProp) !== nextValue) {
      node.style.setProperty(cssProp, nextValue);
    }
  }

  state.previousInlineProps = nextProps;
}

/**
 * Diffs generated class tokens while preserving user classes. The renderer only
 * removes tokens it added during an earlier +styled application.
 *
 * @param {HTMLElement} node - Styled DOM node.
 * @param {string[]} nextTokens - Generated class tokens.
 * @param {ReturnType<typeof getStyledNodeState>} state - Node state.
 */
function applyClassDiff(node, nextTokens, state) {
  const next = new Set(nextTokens || []);
  for (const oldToken of state.previousClassTokens) {
    if (!next.has(oldToken)) node.classList.remove(oldToken);
  }
  for (const token of next) {
    if (!node.classList.contains(token)) node.classList.add(token);
  }
  state.previousClassTokens = next;
}

/**
 * Applies a complete styled artifact to a DOM node.
 *
 * @param {HTMLElement} node - Styled DOM node.
 * @param {{inline?: Object, classTokens?: string[], rules?: Array<{id: string, cssText: string}>}|null} artifact
 */
export function applyStyledArtifactToNode(node, artifact) {
  const state = getStyledNodeState(node);
  applyInlineDiff(node, artifact?.inline || {}, state);
  applyClassDiff(node, artifact?.classTokens || [], state);
  state.previousRuleIds = new Set(
    (artifact?.rules || []).map((rule) => rule.id)
  );
}
