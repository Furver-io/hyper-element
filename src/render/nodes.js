/**
 * @file Abstract DOM Node classes for template parsing.
 * Used to build an AST representation of templates.
 */

import {
  ELEMENT,
  TEXT_TYPE,
  COMMENT_TYPE,
  FRAGMENT,
  TEXT_ELEMENTS,
  VOID_ELEMENTS,
  children,
  props,
} from './constants.js';

/**
 * Abstract base class for parser nodes.
 */
export class Node {
  /**
   * @param {number} type - Node type constant
   */
  constructor(type) {
    this.type = type;
    this.parent = null;
  }
}

/**
 * Represents an HTML comment node.
 */
export class Comment extends Node {
  /**
   * @param {string} data - Comment content
   */
  constructor(data) {
    super(COMMENT_TYPE);
    this.data = data;
  }
  /**
   * @returns {string} HTML comment string
   */
  toString() {
    return `<!--${this.data}-->`;
  }
}

/**
 * Represents a text node.
 */
export class Text extends Node {
  /**
   * @param {string} data - Text content
   */
  constructor(data) {
    super(TEXT_TYPE);
    this.data = data;
  }
  /**
   * @returns {string} Text content
   */
  toString() {
    return this.data;
  }
}

/**
 * Represents an HTML element node.
 */
export class Element extends Node {
  /**
   * @param {string} name - Element tag name
   * @param {boolean} [xml=false] - Whether in XML mode
   */
  constructor(name, xml = false) {
    super(ELEMENT);
    this.name = name;
    this.xml = xml;
    this.isStyled = false; // True if +styled suffix was detected
    this.propFlags = null; // Array of {name, static} for prop flag attributes
    this.props = props;
    this.children = children;
  }
  /**
   * @returns {string} HTML element string
   */
  toString() {
    const { xml, name, props: p, children: c } = this;
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
      for (let text = !xml && TEXT_ELEMENTS.has(name), i = 0; i < length; i++)
        html += text ? c[i].data : c[i];
      html += `</${name}>`;
    } else if (xml) {
      html += ' />';
    } else {
      html += VOID_ELEMENTS.has(name) ? '>' : `></${name}>`;
    }
    return html;
  }
}

/**
 * Represents a document fragment node.
 */
export class Fragment extends Node {
  /**
   * Creates a new fragment.
   */
  constructor() {
    super(FRAGMENT);
    this.name = '#fragment';
    this.children = children;
  }
  /**
   * @returns {string} Concatenated children as string
   */
  toString() {
    return this.children.join('');
  }
}
