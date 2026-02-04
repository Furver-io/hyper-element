/**
 * @file Browser style handler factory for +styled elements.
 * @module hyper-element/styled/handler
 */

import { getRenderingInstance } from './registry.js';
import { resolveStyles } from './resolution.js';
import { applyStylesToNode } from './apply.js';

/**
 * Creates a styled style handler for +styled elements.
 * Uses rendering context to find the component instance.
 * @param {string} tagName - The element's tag name
 * @param {Array|null} propFlags - Static prop flags from parsing
 * @returns {Function} Style update handler
 */
export const styledStyleHandler = (tagName, propFlags) => (node, value) => {
  const instance = getRenderingInstance();

  const activeFlags = propFlags
    ? propFlags.map((f) => ({ name: f.name, active: true }))
    : null;

  const resolved = resolveStyles(instance, tagName, value, activeFlags);
  if (resolved) {
    applyStylesToNode(node, resolved);
  }
};
