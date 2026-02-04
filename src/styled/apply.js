/**
 * @file DOM style application for +styled elements.
 * @module hyper-element/styled/apply
 */

/**
 * Apply resolved styles to a DOM node.
 * Sets individual style properties for proper merging.
 *
 * @param {HTMLElement} node - The DOM node to style
 * @param {Object} styles - Resolved style object
 */
export function applyStylesToNode(node, styles) {
  if (!styles || typeof styles !== 'object') return;

  for (const [prop, value] of Object.entries(styles)) {
    if (value == null || value === '') {
      node.style.removeProperty(prop.replace(/([A-Z])/g, '-$1').toLowerCase());
    } else {
      // Use setProperty for kebab-case support
      const kebabProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
      node.style.setProperty(kebabProp, String(value));
    }
  }
}
