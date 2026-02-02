/**
 * @file Persistent fragment for multi-node templates.
 * Wraps DocumentFragment to track nodes when they're in the DOM.
 */

import { children } from './constants.js';

let checkType = false;
let range;

/** @type {symbol} */
export const nodes = Symbol('nodes');

/**
 * Drops all nodes except the first in a fragment.
 * @param {DocumentFragment} fragment
 * @returns {Node}
 */
const drop = ({ firstChild, lastChild }) => {
  const r = range || (range = document.createRange());
  r.setStartAfter(firstChild);
  r.setEndAfter(lastChild);
  r.deleteContents();
  return firstChild;
};

/**
 * Gets a fragment for diffing operations.
 * Handles PersistentFragment's valueOf/firstChild/lastChild based on operation.
 * @param {Node} node - The node (may be PersistentFragment)
 * @param {1 | 0 | -0 | -1} operation - The diff operation type
 * @returns {Node}
 */
export function diffFragment(node, operation) {
  if (checkType && node.nodeType === 11) {
    return 1 / operation < 0
      ? operation
        ? drop(node)
        : node.lastChild
      : operation
        ? node.valueOf()
        : node.firstChild;
  }
  return node;
}

/**
 * Property descriptor for parentNode getter.
 * @type {PropertyDescriptor}
 */
const parentNode = {
  /**
   * Gets the parent node of the first child.
   * @this {DocumentFragment}
   * @returns {Node|null}
   */
  get() {
    return this.firstChild.parentNode;
  },
};

/**
 * Property descriptor for replaceWith method.
 * @type {PropertyDescriptor}
 */
const replaceWith = {
  /**
   * Replaces the fragment with a new node.
   * @this {DocumentFragment}
   * @param {Node} node - Replacement node
   */
  value(node) {
    drop(this).replaceWith(node);
  },
};

/**
 * Property descriptor for valueOf method.
 * @type {PropertyDescriptor}
 */
const valueOf = {
  /**
   * Gets the fragment value, collecting nodes if needed.
   * @this {DocumentFragment}
   * @returns {DocumentFragment}
   */
  value() {
    const { parentNode } = this;
    if (parentNode === this) {
      if (this[nodes] === children) this[nodes] = [...this.childNodes];
    } else {
      if (parentNode) {
        let { firstChild, lastChild } = this;
        this[nodes] = [firstChild];
        while (firstChild !== lastChild)
          this[nodes].push((firstChild = firstChild.nextSibling));
      }
      this.replaceChildren(...this[nodes]);
    }
    return this;
  },
};

/**
 * Creates a persistent fragment with comment markers.
 * Enables tracking multiple nodes as a single unit.
 * @param {DocumentFragment} fragment
 * @returns {DocumentFragment}
 */
export function PersistentFragment(fragment) {
  const firstChild = document.createComment('<>');
  const lastChild = document.createComment('</>');
  fragment.replaceChildren(firstChild, ...fragment.childNodes, lastChild);
  checkType = true;
  return Object.defineProperties(fragment, {
    [nodes]: { writable: true, value: children },
    firstChild: { value: firstChild },
    lastChild: { value: lastChild },
    parentNode,
    valueOf,
    replaceWith,
  });
}

// Set prototype only in browser environments (DocumentFragment not available in Node.js)
if (typeof DocumentFragment !== 'undefined') {
  PersistentFragment.prototype = DocumentFragment.prototype;
}
