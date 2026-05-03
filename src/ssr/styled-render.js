/**
 * @file SSR element finalization for selector-capable +styled output.
 * The string renderer builds a parsed node tree first; this module applies the
 * final styled artifact at serialization time when style/css/variant inputs are
 * all known.
 */

import { getSSRContext } from './string-update.js';
import { resolveStyledArtifact } from '../styled/artifact.js';
import { serializeInlineDeclarations } from '../styled/serializer.js';

/**
 * Adds a CSS rule to the current SSR root registry while preserving first-seen
 * order and de-duplicating repeated styled nodes that resolve to the same rule.
 *
 * @param {Object} context - Current SSR context.
 * @param {Object} rule - Generated rule.
 */
function registerSSRRule(context, rule) {
  context.__styledRules.set(rule.id, rule);
}

/**
 * Checks whether a static +styled attribute is a registered variant. Unknown
 * attributes remain normal HTML so public/native attributes are not lost.
 *
 * @param {Object} context - Current SSR context.
 * @param {string} tagName - Styled tag name.
 * @param {string} attrName - Attribute name.
 * @returns {boolean} True when the attr should be consumed as a variant.
 */
function isKnownSSRVariant(context, tagName, attrName) {
  const base = Array.isArray(context.styled) ? context.styled[0] : null;
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
 * Applies selector-capable +styled output to an SSR element node just before it
 * is serialized. This mirrors browser application: classes merge with user
 * classes, css/variant attributes are consumed, and inline declarations remain
 * as `style=""` when no generated CSS is needed.
 *
 * @param {Object} node - SSR parser element node.
 */
export function applySSRStyledNode(node) {
  if (!node.isStyled) return;
  const context = getSSRContext();
  const state = node._styledState;
  const entry = {
    styled: context.styled,
    ctx: {
      attrs: context.attrs,
      store: context.store,
      localName: context.localName,
    },
    store: context.store,
    colors: context.colors || null,
  };
  const artifact = resolveStyledArtifact(entry, node.name, {
    styleValue: state.styleValue,
    cssOverride: state.cssOverride,
    staticFlags: state.propFlags.map((flag) => ({
      name: flag.name,
      active: true,
    })),
    dynamicFlags: state.dynamicFlags,
    componentName: context.localName,
  });

  delete node.props.css;
  for (const flag of node.propFlags || []) {
    if (isKnownSSRVariant(context, node.name, flag.name)) {
      delete node.props[flag.name];
    }
  }

  if (!artifact) {
    delete node.props.style;
    return;
  }

  if (artifact.classTokens.length > 0) {
    const existing = node.props.class ? String(node.props.class).trim() : '';
    node.props.class = [existing, ...artifact.classTokens]
      .filter(Boolean)
      .join(' ');
  }

  const inlineText = serializeInlineDeclarations(artifact.inline);
  if (inlineText) {
    node.props.style = inlineText;
  } else {
    delete node.props.style;
  }

  for (const rule of artifact.rules) {
    registerSSRRule(context, rule);
  }
}
