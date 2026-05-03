/**
 * @file Hole class - represents a parsed template with values.
 * Handles first render (valueOf) and subsequent updates (update).
 */

import { resolve } from './resolve.js';
import { ARRAY, COMMENT, EVENT, KEY, children } from './constants.js';
import { PersistentFragment, diffFragment } from './persistent-fragment.js';

/**
 * Detects a template Hole in a way that still works if two copies of
 * hyper-element are bundled (e.g. `value instanceof Hole` is false) or
 * if the value is a duck-typed hole-like object. Used whenever we must
 * special-case comment-slot nested templates so we call {@link dom}
 * instead of stringifying a plain object to `"[object Object]"`.
 * @param {unknown} v
 * @returns {boolean}
 */
export function isTemplateHole(v) {
  return (
    v != null &&
    typeof v === 'object' &&
    Array.isArray(/** @type {Hole} */ (v).t) &&
    Array.isArray(/** @type {Hole} */ (v).v) &&
    typeof (/** @type {Hole} */ (v).valueOf) === 'function'
  );
}

/**
 * Converts a Hole to a DOM node.
 * @param {Hole} hole
 * @returns {Node}
 */
export const dom = (hole) => diffFragment(hole.n || hole.valueOf(), 1);

/**
 * Reconciles arrays of Holes efficiently.
 * @param {Hole[]} prev - Previous holes
 * @param {Hole[]} current - Current holes
 * @returns {Node[]}
 */
const holed = (prev, current) => {
  const changes = [];
  const h = prev.length;
  const l = current.length;
  for (let c, p, j = 0, i = 0; i < l; i++) {
    c = current[i];
    changes[i] =
      j < h && (p = prev[j++]).t === c.t
        ? (current[i] = p).update(c)
        : c.valueOf();
  }
  return changes;
};

/**
 * Gets a keyed hole for a value.
 * @param {Hole} hole
 * @param {unknown} value
 * @returns {Node}
 */
const getKeyedHole = (hole, value) => {
  const cached = hole.t[2]?.get(value);
  return cached?.update(hole) ?? hole.valueOf();
};

/**
 * Gets or updates a hole when the template matches.
 * @param {Hole} hole - Previous hole
 * @param {Hole} value - New hole
 * @returns {Hole}
 */
const getHole = (hole, value) => {
  if (hole.t === value.t) {
    hole.update(value);
  } else {
    hole.n.replaceWith(dom(value));
    hole = value;
  }
  return hole;
};

/**
 * Represents a parsed template with interpolation values.
 * Caches DOM nodes and enables efficient updates.
 */
export class Hole {
  /**
   * @param {[DocumentFragment, unknown[], import('./keyed.js').Keyed?]} template - Parsed template
   * @param {unknown[]} values - Interpolated values
   */
  constructor(template, values) {
    /** @type {[DocumentFragment, unknown[], import('./keyed.js').Keyed?]} */
    this.t = template;
    /** @type {unknown[]} */
    this.v = values;
    /** @type {Node|null} */
    this.n = null;
    /** @type {number} */
    this.k = -1;
  }

  /**
   * First render - creates DOM nodes from template.
   * @returns {Node}
   */
  valueOf() {
    const [fragment, updates, keys] = this.t;
    const root = document.importNode(fragment, true);
    const values = this.v;
    // Use updates.length to ensure auto-created handlers (e.g., +styled) are called
    let length = updates.length;
    let changes = children;
    let node;
    let prev;

    if (length > 0) {
      changes = updates.slice(0);
      while (length--) {
        const [path, update, type] = updates[length];
        // Values may have fewer entries than updates (auto-created handlers)
        const value = length < values.length ? values[length] : undefined;

        // Resolve node from path (cache if same path)
        if (prev !== path) {
          node = resolve(root, path);
          prev = path;
        }

        let commit = true;

        // Handle arrays
        if (type & ARRAY) {
          if (type & COMMENT) {
            commit = false;
            if (value.length) {
              update(
                node,
                isTemplateHole(value[0]) ? holed(children, value) : value
              );
            }
          }
        }
        // Handle nested Holes
        else if (type & COMMENT && isTemplateHole(value)) {
          commit = false;
          update(node, dom(/** @type {Hole} */ (value)));
        }

        if (commit) {
          if (type === KEY) {
            this.k = length;
          } else {
            update(node, value);
          }
        }

        changes[length] = [type, update, value, node];
      }
    }

    const { childNodes } = root;
    const size = childNodes.length;
    const n =
      size === 1 ? childNodes[0] : size ? PersistentFragment(root) : root;

    this.v = changes;
    this.n = n;

    // Register with keyed cache if key present
    if (this.k >= 0 && keys) {
      keys.set(changes[this.k][2], n, this);
    }

    return n;
  }

  /**
   * Update render - efficiently updates existing DOM.
   * @param {Hole} hole - New hole with updated values
   * @returns {Node}
   */
  update(hole) {
    const key = this.k;
    const changes = this.v;
    const values = hole.v;

    // If key changed, delegate to keyed cache
    if (key >= 0 && changes[key][2] !== values[key]) {
      return getKeyedHole(hole, values[key]);
    }

    let { length } = changes;
    while (length--) {
      const entry = changes[length];
      const [type, update, prev] = entry;

      if (type === KEY) continue;

      // Handle auto-created handlers (e.g., +styled) with no corresponding value
      const autoCreated = length >= values.length;
      let value = autoCreated ? undefined : values[length];
      let change = value;

      // Handle arrays
      if (type & ARRAY) {
        if (type & COMMENT) {
          if (value.length) {
            if (isTemplateHole(value[0])) {
              change = holed(prev, value);
            }
          }
        } else if (type & EVENT && value[0] === prev[0]) {
          continue;
        }
      }
      // Handle nested Holes
      else if (type & COMMENT) {
        if (isTemplateHole(value) && isTemplateHole(prev)) {
          value = getHole(
            /** @type {Hole} */ (prev),
            /** @type {Hole} */ (value)
          );
          change = value.n;
        } else if (isTemplateHole(value) && !isTemplateHole(prev)) {
          // e.g. `''` → nested Hole when a conditional (edit bar) mounts.
          // Without this, the raw Hole object reaches replaceComment and
          // the browser stringifies to "[object Object]".
          change = dom(/** @type {Hole} */ (value));
        }
      }

      if (autoCreated || value !== prev) {
        entry[2] = value;
        update(entry[3], change);
      }
    }

    return this.n;
  }
}
