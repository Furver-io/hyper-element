/**
 * @file Comment interpolation handlers for the DOM renderer.
 * Comment holes are the public template surface for child nodes, raw fragments,
 * and nested template holes; keeping them here keeps update dispatch focused.
 */

import { children } from './constants.js';
import { createFragment } from './creator.js';
import { diff } from './diff.js';
import {
  diffFragment,
  nodes,
  PersistentFragment,
} from './persistent-fragment.js';

const commentRef = Symbol('comment');
const textCache = new WeakMap();

/**
 * Gets or creates a text node for a reference.
 *
 * @param {object} ref - Reference object for caching.
 * @param {string} value - Text value.
 * @returns {Text} Text node.
 */
const getText = (ref, value) => {
  let node = textCache.get(ref);
  if (node) {
    node.data = value;
  } else {
    textCache.set(ref, (node = document.createTextNode(value)));
  }
  return node;
};

/**
 * Converts array items to DOM nodes for diffing.
 *
 * @param {Array} arr - Array of values.
 * @param {boolean} xml - Whether in SVG/XML context.
 * @returns {Array} Array of DOM nodes.
 */
const toNodes = (arr, xml) =>
  arr.map((item) =>
    typeof item === 'string' || typeof item === 'number'
      ? document.createTextNode(String(item))
      : item && typeof item === 'object' && item.__unsafe
        ? PersistentFragment(createFragment(item.value, xml))
        : item
  );

/**
 * Creates an array update handler.
 *
 * @param {boolean} xml - Whether in SVG/XML context.
 * @returns {Function} Array update function.
 */
export const commentArrayFactory = (xml) => (node, value) => {
  const nodeValue = toNodes(value, xml);
  node[nodes] = diff(node[nodes] || children, nodeValue, diffFragment, node);
};

/**
 * Replaces a comment placeholder with the next rendered value.
 *
 * @param {Node} node - Comment node placeholder.
 * @param {unknown} value - Value to render.
 */
const replaceComment = (node, value) => {
  const current =
    typeof value === 'object' ? (value ?? node) : getText(node, value);
  const prev = node[nodes] ?? node;
  if (current !== prev) {
    prev.replaceWith(diffFragment((node[nodes] = current), 1));
  }
};

/**
 * Creates a single node interpolation handler.
 *
 * @param {boolean} xml - Whether this is SVG context.
 * @returns {Function} Comment-hole update function.
 */
export const commentHoleFactory = (xml) => (node, value) => {
  if (value && typeof value === 'object' && value.__unsafe) {
    const html = value.value;
    const prev = node[commentRef] ?? (node[commentRef] = {});
    if (prev.v !== html) {
      prev.f = PersistentFragment(createFragment(html, xml));
      prev.v = html;
    }
    value = prev.f;
  }
  replaceComment(node, value);
};

/**
 * Updates unsafe/raw HTML content.
 *
 * @param {boolean} xml - Whether in XML mode.
 * @returns {Function} Unsafe content update function.
 */
export const commentUnsafe = (xml) => (node, value) => {
  const html =
    value && typeof value === 'object' && value.__unsafe ? value.value : value;
  const prev = node[commentRef] ?? (node[commentRef] = {});
  if (prev.v !== html) {
    prev.f = PersistentFragment(createFragment(html, xml));
    prev.v = html;
  }
  replaceComment(node, prev.f);
};
