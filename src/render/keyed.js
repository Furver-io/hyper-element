/**
 * @file Key tracking for efficient array reconciliation.
 * Uses WeakMap and WeakRef for memory-safe keying.
 */

/** @type {WeakMap<Node, import('./hole.js').Hole>} */
export const keyedHoles = new WeakMap();

/**
 * Tracks keyedHoles holes for efficient array updates.
 * Keys are stored as WeakRefs to allow garbage collection.
 * Note: Map entries persist until keys are overwritten.
 */
export class Keyed extends Map {
  /**
   * Gets a hole by its key value.
   * @param {any} key - The key value
   * @returns {import('./hole.js').Hole|undefined}
   */
  get(key) {
    const node = super.get(key)?.deref();
    return node && keyedHoles.get(node);
  }

  /**
   * Associates a key with a node and hole.
   * @param {any} key - The key value
   * @param {Node} node - The DOM node
   * @param {import('./hole.js').Hole} hole - The hole instance
   */
  set(key, node, hole) {
    keyedHoles.set(node, hole);
    super.set(key, new WeakRef(node));
  }
}
