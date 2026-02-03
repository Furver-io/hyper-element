/**
 * @file SSR string rendering core.
 * Renders templates to HTML strings without DOM dependencies.
 */

import { createParser } from '../render/parser.js';
import { Comment, Text, Element, Fragment } from '../render/nodes.js';
import { ssrUpdate } from './string-update.js';
import {
  ATTRIBUTE,
  ATTRIBUTE_TEMPLATE,
  COMMENT,
  COMMENT_ARRAY,
  DATA,
  DIRECT,
  EVENT,
  EVENT_ARRAY,
  KEY,
  PROP,
  TEXT,
  TOGGLE,
  UNSAFE,
  VOID_ELEMENTS,
} from '../render/constants.js';

// Create parser with SSR update handlers
const ssrParser = createParser(ssrUpdate);

// WeakMap for template caching
const templateCache = new WeakMap();

/**
 * Clones an abstract tree node for modification.
 * @param {Object} node - Node to clone
 * @returns {Object} Cloned node
 */
function cloneNode(node) {
  if (node instanceof Comment) {
    const clone = new Comment(node.data);
    clone.parent = null;
    return clone;
  }
  if (node instanceof Text) {
    const clone = new Text(node.data);
    clone.parent = null;
    return clone;
  }
  if (node instanceof Element) {
    const clone = new Element(node.name, node.xml);
    // Always create new props object (original may be frozen)
    clone.props = { ...node.props };
    // Copy +styled properties for SSR styled support
    clone.isStyled = node.isStyled;
    clone.propFlags = node.propFlags;
    // Clone children recursively
    if (node.children && node.children.length > 0) {
      clone.children = node.children.map((child) => {
        const clonedChild = cloneNode(child);
        clonedChild.parent = clone;
        return clonedChild;
      });
    }
    return clone;
  }
  if (node instanceof Fragment) {
    const clone = new Fragment();
    if (node.children && node.children.length > 0) {
      clone.children = node.children.map((child) => {
        const clonedChild = cloneNode(child);
        clonedChild.parent = clone;
        return clonedChild;
      });
    }
    return clone;
  }
}

/**
 * Resolves a path to a node in the tree.
 * @param {Object} root - Root node (Fragment)
 * @param {number[]} path - Path array (reversed, from parser)
 * @returns {Object} Target node
 */
function resolveNode(root, path) {
  let node = root;
  // Path is inside-out (from node to root), so traverse in reverse
  for (let i = path.length - 1; i >= 0; i--) {
    const index = path[i];
    if (index === -1) {
      // Template content - skip for SSR
      continue;
    }
    if (node.children && node.children[index] !== undefined) {
      node = node.children[index];
    }
  }
  return node;
}

/**
 * Applies update values to the cloned tree.
 * @param {Object} tree - Cloned tree root
 * @param {Array} updates - Array of [path, handler, type, attrName] tuples
 * @param {Array} values - Interpolated values
 * @returns {Object} Modified tree
 */
function applyUpdates(tree, updates, values) {
  for (let i = 0; i < updates.length; i++) {
    const [path, handler, type, attrName] = updates[i];
    const value = values[i];
    const node = resolveNode(tree, path);

    // Apply based on update type
    switch (type) {
      case COMMENT:
      case COMMENT_ARRAY:
      case UNSAFE: {
        // Replace comment node content with the rendered value
        const rendered = handler(value);
        if (node instanceof Comment) {
          // Store rendered content - nodeToString will use this
          node._ssrContent = rendered;
        }
        break;
      }
      case TEXT: {
        // Update text content of element
        if (node instanceof Element) {
          const rendered = handler(value);
          // Replace all children with text
          node.children = [new Text(rendered)];
        }
        break;
      }
      case ATTRIBUTE: {
        // Set attribute value
        if (node instanceof Element && attrName) {
          const rendered = handler(value);
          if (rendered == null) {
            delete node.props[attrName];
          } else {
            node.props[attrName] = rendered;
          }
        }
        break;
      }
      case TOGGLE: {
        // Boolean attribute
        if (node instanceof Element && attrName) {
          const present = handler(value);
          if (present) {
            node.props[attrName] = true;
          } else {
            delete node.props[attrName];
          }
        }
        break;
      }
      case DATA: {
        // data-* attributes
        if (node instanceof Element) {
          const dataAttrs = handler(value);
          Object.assign(node.props, dataAttrs);
        }
        break;
      }
      case PROP: {
        // Spread operator - add as attributes
        if (node instanceof Element && typeof handler === 'function') {
          const attrs = handler(value);
          if (attrs && typeof attrs === 'object') {
            Object.assign(node.props, attrs);
          }
        }
        break;
      }
      case ATTRIBUTE_TEMPLATE: {
        // Partial interpolation - accumulate values and concatenate when complete
        if (node instanceof Element && attrName) {
          const result = handler(value);
          const key = `_template_${attrName}`;

          // Initialize accumulator for this attribute
          if (!node[key]) {
            node[key] = {
              values: new Array(result.holeCount),
              parts: result.parts,
              remaining: result.holeCount,
            };
          }

          // Store value at this hole's index
          node[key].values[result.holeIndex] = result.value;
          node[key].remaining--;

          // When all holes collected, concatenate and set attribute
          if (node[key].remaining === 0) {
            const { parts, values: vals } = node[key];
            let final = parts[0];
            for (let j = 0; j < vals.length; j++) {
              // vals[j] is always a string (escaped by stringAttributeTemplate)
              final += vals[j] + parts[j + 1];
            }
            node.props[attrName] = final;
          }
        }
        break;
      }
      case EVENT:
      case EVENT_ARRAY:
      case DIRECT:
      case KEY: {
        // Ignored in SSR - events, direct props, refs, keys
        break;
      }
    }
  }

  return tree;
}

/**
 * Custom toString that handles SSR content markers.
 * @param {Object} node - Tree node
 * @returns {string} HTML string
 */
function nodeToString(node) {
  if (node instanceof Comment) {
    // If we have SSR content, return that instead of the comment
    if (node._ssrContent !== undefined) {
      return node._ssrContent;
    }
    return node.toString();
  }
  if (node instanceof Text) {
    return node.toString();
  }
  if (node instanceof Element) {
    const { xml, name, props: p, children: c } = node;
    // children is always an array (initialized in constructor)
    const length = c.length;
    let html = `<${name}`;

    for (const key in p) {
      const value = p[key];
      if (value != null) {
        if (typeof value === 'boolean') {
          if (value) html += xml ? ` ${key}=""` : ` ${key}`;
        } else {
          html += ` ${key}="${value}"`;
        }
      }
    }

    if (length) {
      html += '>';
      for (let i = 0; i < length; i++) {
        html += nodeToString(c[i]);
      }
      html += `</${name}>`;
    } else if (xml) {
      html += ' />';
    } else {
      html += VOID_ELEMENTS.has(name) ? '>' : `></${name}>`;
    }
    return html;
  }
  if (node instanceof Fragment) {
    // children is always an array (initialized in constructor)
    if (node.children.length === 0) return '';
    return node.children.map((child) => nodeToString(child)).join('');
  }
}

/**
 * Renders a tagged template literal to an HTML string.
 * @param {TemplateStringsArray} template - Template strings
 * @param {Array} values - Interpolated values
 * @param {boolean} [xml=false] - SVG/XML mode
 * @returns {string} Rendered HTML string
 */
export function renderToString(template, values, xml = false) {
  // Parse template (with caching)
  let parsed = templateCache.get(template);
  if (!parsed) {
    parsed = ssrParser(template, values, xml);
    templateCache.set(template, parsed);
  }

  const [treeTemplate, updates] = parsed;

  // Clone the tree for this render (templates are reused)
  const tree = cloneNode(treeTemplate);

  // Apply values to cloned tree
  applyUpdates(tree, updates, values);

  // Convert to string
  return nodeToString(tree);
}

/**
 * Creates a tagged template function for SSR.
 * @param {boolean} xml - Whether this is SVG context
 * @returns {Function} Tagged template function
 */
export function createSSRTemplate(xml = false) {
  return (template, ...values) => renderToString(template, values, xml);
}

/**
 * SSR HTML tagged template function.
 */
export const ssrHtml = createSSRTemplate(false);
