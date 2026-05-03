/**
 * @file Parser tree helpers for the template parser.
 * The parser builds a lightweight node tree before the renderer turns paths
 * into DOM update handlers; these helpers keep tree mutation mechanics small.
 */

import { children, props, ELEMENT } from './constants.js';

/**
 * Appends a child node to a parser node and records the parent link.
 *
 * @param {Object} node - Parent parser node.
 * @param {Object} child - Child parser node.
 * @returns {Object} The appended child.
 */
export const append = (node, child) => {
  if (node.children === children) node.children = [];
  node.children.push(child);
  child.parent = node;
  return child;
};

/**
 * Sets a static parser prop while preserving shared empty-props instances.
 *
 * @param {Object} node - Parser element node.
 * @param {string} name - Prop/attribute name.
 * @param {unknown} value - Static prop/attribute value.
 */
export const prop = (node, name, value) => {
  if (node.props === props) node.props = {};
  node.props[name] = value;
};

/**
 * Computes the child-index path from a parser node to the fragment root.
 *
 * @param {Object} node - Parser node to locate.
 * @returns {number[]} Reverse path used by render/resolve.js.
 */
export const path = (node) => {
  const insideout = [];
  while (node.parent) {
    if (node.type === ELEMENT && node.name === 'template') {
      insideout.push(-1);
    }
    insideout.push(node.parent.children.indexOf(node));
    node = node.parent;
  }
  return insideout;
};

/**
 * Walks to the parent while skipping parser-inserted structural nodes.
 *
 * @param {Object} node - Current parser node.
 * @param {Set<Object>} ignore - Nodes inserted by parser repair rules.
 * @returns {Object} Logical parent node.
 */
export const parent = (node, ignore) => {
  do {
    node = node.parent;
  } while (ignore.has(node));
  return node;
};
