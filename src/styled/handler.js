/**
 * @file Browser style handler factory for +styled elements.
 * The factories coordinate style=${...}, css=${...}, and variant attributes
 * through one per-node state object so stale classes/rules/inline properties
 * are removed deterministically on each render.
 * @module hyper-element/styled/handler
 */

import { getRenderingInstance, getStyledEntry } from './registry.js';
import { applyStyledArtifactToNode, getStyledNodeState } from './apply.js';
import { resolveStyledArtifact } from './artifact.js';
import { registerStyleRules } from './style-host.js';

/**
 * Finds the owning component instance for a styled node. Rendering always
 * installs an explicit render context before +styled handlers run, including
 * update renders triggered by attribute changes.
 *
 * @param {HTMLElement} _node - Styled DOM node.
 * @returns {HTMLElement|null} Owning component instance.
 */
function getInstanceForNode(_node) {
  return getRenderingInstance() || null;
}

/**
 * Applies the current styled-node state through the shared artifact resolver.
 *
 * @param {HTMLElement} node - Styled DOM node.
 * @param {string} tagName - Styled tag name.
 * @param {Array} staticFlags - Static flags.
 */
function applyStyledNode(node, tagName, staticFlags) {
  const instance = getInstanceForNode(node);
  const entry = instance ? getStyledEntry(instance) : null;
  const state = getStyledNodeState(node);
  const artifact = resolveStyledArtifact(entry, tagName, {
    styleValue: state.latestStyleValue,
    cssOverride: state.latestCssOverride,
    staticFlags,
    dynamicFlags: state.latestDynamicFlags,
    componentName: instance?.localName || tagName,
  });

  applyStyledArtifactToNode(node, artifact);
  if (instance && artifact?.rules?.length) {
    registerStyleRules(instance, artifact.rules);
  }
  for (const flag of staticFlags || []) {
    if (flag.active && isKnownVariant(entry, tagName, flag.name)) {
      node.removeAttribute(flag.name);
    }
  }
}

/**
 * Creates a styled style handler for +styled elements.
 * Uses rendering context to find the component instance.
 * @param {string} tagName - The element's tag name
 * @param {Array|null} propFlags - Static prop flags from parsing
 * @returns {Function} Style update handler
 */
export const styledStyleHandler = (tagName, propFlags) => (node, value) => {
  const activeFlags = propFlags
    ? propFlags.map((f) => ({ name: f.name, active: true }))
    : [];

  const state = getStyledNodeState(node);
  state.latestStyleValue = value;
  applyStyledNode(node, tagName, activeFlags);
};

/**
 * Creates a handler for css=${...} on +styled elements. The css value is a
 * selector-only instance override and never becomes a DOM attribute.
 *
 * @param {string} tagName - Styled tag name.
 * @param {Array|null} propFlags - Static parser flags.
 * @returns {(node: HTMLElement, value: unknown) => void}
 */
export const styledCssHandler = (tagName, propFlags) => (node, value) => {
  const activeFlags = propFlags
    ? propFlags.map((f) => ({ name: f.name, active: true }))
    : [];
  const state = getStyledNodeState(node);
  state.latestCssOverride = value;
  applyStyledNode(node, tagName, activeFlags);
  node.removeAttribute('css');
};

/**
 * Detects whether a dynamic attribute name is a known style variant for the
 * current styled tag. Known variants are consumed by the styled system; other
 * attributes keep normal DOM behavior.
 *
 * @param {Object|null} entry - Styled registry entry.
 * @param {string} tagName - Styled tag name.
 * @param {string} attrName - Attribute name.
 * @returns {boolean} True when the name is a registered variant.
 */
function isKnownVariant(entry, tagName, attrName) {
  const base = Array.isArray(entry?.styled) ? entry.styled[0] : null;
  const tagStyles = base?.[tagName];
  return !!(
    tagStyles &&
    typeof tagStyles === 'object' &&
    tagStyles.base &&
    tagStyles[attrName] &&
    typeof tagStyles[attrName] === 'object'
  );
}

/**
 * Filters attributes that must keep native DOM semantics even on +styled nodes.
 *
 * @param {string} attrName - Attribute name.
 * @returns {boolean} True when normal DOM handling must be preserved.
 */
function isReservedAttr(attrName) {
  return (
    attrName === 'class' ||
    attrName === 'id' ||
    attrName === 'role' ||
    attrName === 'slot' ||
    attrName === 'part' ||
    attrName === 'title' ||
    attrName === 'style' ||
    attrName === 'css' ||
    attrName.startsWith('data-') ||
    attrName.startsWith('aria-') ||
    attrName.startsWith('on')
  );
}

/**
 * Wraps a normal attribute handler so dynamic variant attributes can be
 * consumed by +styled without leaking boolean flags into the DOM.
 *
 * @param {string} attrName - Attribute name.
 * @param {string} tagName - Styled tag name.
 * @param {(node: HTMLElement, value: unknown) => void} normalHandler
 * @returns {(node: HTMLElement, value: unknown) => void}
 */
export function styledAttributeHandler(attrName, tagName, normalHandler) {
  return (node, value) => {
    const instance = getInstanceForNode(node);
    const entry = instance ? getStyledEntry(instance) : null;
    if (!isReservedAttr(attrName) && isKnownVariant(entry, tagName, attrName)) {
      const state = getStyledNodeState(node);
      state.latestDynamicFlags[attrName] = !!value;
      applyStyledNode(node, tagName, []);
      node.removeAttribute(attrName);
      return;
    }
    normalHandler(node, value);
  };
}
