/**
 * @file Template parser using NUL character sentinel pattern.
 * Parses tagged template literals into an abstract tree with update instructions.
 */

import {
  ELEMENT,
  ATTRIBUTE_TYPE,
  TEXT_TYPE,
  COMMENT_TYPE,
  TEXT_ELEMENTS,
  VOID_ELEMENTS,
  children,
  props,
} from './constants.js';
import { Comment, Text, Element, Fragment } from './nodes.js';

const NUL = '\x00';
const DOUBLE_QUOTED_NUL = `"${NUL}"`;
const SINGLE_QUOTED_NUL = `'${NUL}'`;
/* eslint-disable no-control-regex */
const NEXT = /\x00|<[^><\s]+/g;
const ATTRS = /([^\s/>=]+)(?:=(\x00|(?:(['"])[\s\S]*?\3)))?/g;
/* eslint-enable no-control-regex */

/**
 * Appends a child node to a parent.
 * @param {import('./nodes.js').Node} node - Parent node
 * @param {import('./nodes.js').Node} child - Child to append
 * @returns {import('./nodes.js').Node} The appended child
 */
const append = (node, child) => {
  if (node.children === children) node.children = [];
  node.children.push(child);
  child.parent = node;
  return child;
};

/**
 * Sets a property on a node.
 * @param {import('./nodes.js').Node} node - Node to modify
 * @param {string} name - Property name
 * @param {unknown} value - Property value
 */
const prop = (node, name, value) => {
  if (node.props === props) node.props = {};
  node.props[name] = value;
};

/**
 * Computes the path from a node to the root.
 * @param {import('./nodes.js').Node} node
 * @returns {number[]}
 */
const path = (node) => {
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
 * Gets the parent node, skipping ignored auto-inserted nodes.
 * @param {import('./nodes.js').Node} node
 * @param {Set<import('./nodes.js').Node>} ignore
 * @returns {import('./nodes.js').Node}
 */
const parent = (node, ignore) => {
  do {
    node = node.parent;
  } while (ignore.has(node));
  return node;
};

/**
 * Creates a parser with custom update handler.
 * @param {Function} update - Update handler (required)
 * @returns {Function} Parser function
 */
export function createParser(update) {
  /**
   * Parses a template into an abstract tree and update instructions.
   * @param {TemplateStringsArray|string[]} template
   * @param {unknown[]} holes
   * @param {boolean} xml
   * @returns {[import('./nodes.js').Node, unknown[]]}
   */
  return (template, holes, xml) => {
    // Only trim leading whitespace, preserve trailing for proper spacing
    const content = template.join(NUL).replace(/^\s+/, '');
    const ignore = new Set();
    const values = [];
    let node = new Fragment();
    let pos = 0;
    let skip = 0;
    let hole = 0;
    let resolvedPath = children;

    for (const match of content.matchAll(NEXT)) {
      if (skip > 0) {
        skip--;
        continue;
      }

      const chunk = match[0];
      const index = match.index;

      if (pos < index) {
        append(node, new Text(content.slice(pos, index)));
      }

      if (chunk === NUL) {
        if (node.name === 'table') {
          node = append(node, new Element('tbody', xml));
          ignore.add(node);
        }
        const comment = append(node, new Comment('◦'));
        values.push(
          update(comment, COMMENT_TYPE, path(comment), '', holes[hole++])
        );
        pos = index + 1;
      } else if (chunk.startsWith('<!')) {
        const i = content.indexOf('>', index + 2);
        if (content.slice(i - 2, i + 1) === '-->') {
          const data = content.slice(index + 4, i - 2);
          if (data[0] === '!') {
            append(node, new Comment(data.slice(1).replace(/!$/, '')));
          }
        }
        pos = i + 1;
      } else if (chunk.startsWith('</')) {
        const i = content.indexOf('>', index + 2);
        if (xml && node.name === 'svg') xml = false;
        node = parent(node, ignore);
        pos = i + 1;
      } else {
        const i = index + chunk.length;
        const j = content.indexOf('>', i);
        const name = chunk.slice(1);
        let tag = name;

        if (!xml) {
          tag = tag.toLowerCase();
          if (node.name === 'table' && (tag === 'tr' || tag === 'td')) {
            node = append(node, new Element('tbody', xml));
            ignore.add(node);
          }
          if (node.name === 'tbody' && tag === 'td') {
            node = append(node, new Element('tr', xml));
            ignore.add(node);
          }
        }

        node = append(node, new Element(tag, xml ? tag !== 'svg' : false));
        resolvedPath = children;

        if (i < j) {
          let dot = false;
          for (const [, attrName, value] of content
            .slice(i, j)
            .matchAll(ATTRS)) {
            if (
              value === NUL ||
              value === DOUBLE_QUOTED_NUL ||
              value === SINGLE_QUOTED_NUL ||
              (dot = attrName.endsWith(NUL))
            ) {
              const p =
                resolvedPath === children
                  ? (resolvedPath = path(node))
                  : resolvedPath;
              values.push(
                update(
                  node,
                  ATTRIBUTE_TYPE,
                  p,
                  dot ? attrName.slice(0, -1) : attrName,
                  holes[hole++]
                )
              );
              dot = false;
              skip++;
            } else {
              prop(node, attrName, value ? value.slice(1, -1) : true);
            }
          }
          resolvedPath = children;
        }

        pos = j + 1;
        const closed = j > 0 && content[j - 1] === '/';

        if (xml) {
          if (closed) node = node.parent;
        } else if (closed || VOID_ELEMENTS.has(tag)) {
          node = closed ? parent(node, ignore) : node.parent;
        } else if (tag === 'svg') {
          xml = true;
        } else if (TEXT_ELEMENTS.has(tag)) {
          const endIndex = content.indexOf(`</${name}>`, pos);
          const value = content.slice(pos, endIndex);
          if (value.trim() === NUL) {
            skip++;
            values.push(update(node, TEXT_TYPE, path(node), '', holes[hole++]));
          } else {
            append(node, new Text(value));
          }
          node = node.parent;
          pos = endIndex + name.length + 3;
          skip++;
          continue;
        }
      }
    }

    if (pos < content.length) {
      append(node, new Text(content.slice(pos)));
    }

    return [node, values];
  };
}
