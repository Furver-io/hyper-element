/**
 * @file Reactive signals for hyper-element.
 * Provides signal(), computed(), effect() for fine-grained reactivity.
 */

// Tracking for dependency collection
let currentEffect = null;
const effectStack = [];

// Batching state
let batchDepth = 0;
let batchedEffects = new Set();

/**
 * Creates a reactive signal.
 * @template T
 * @param {T} initialValue - Initial value
 * @returns {{ value: T, peek: () => T, subscribe: (fn: Function) => () => void }}
 */
export function signal(initialValue) {
  let value = initialValue;
  const subscribers = new Set();

  return {
    get value() {
      // Track dependency
      if (currentEffect) {
        subscribers.add(currentEffect);
      }
      return value;
    },
    set value(newValue) {
      if (value !== newValue) {
        value = newValue;
        // Notify subscribers (defer if batching)
        for (const fn of subscribers) {
          if (batchDepth > 0) {
            batchedEffects.add(fn);
          } else {
            fn();
          }
        }
      }
    },
    /**
     * Read value without tracking.
     * @returns {T} Current value
     */
    peek() {
      return value;
    },
    /**
     * Subscribe to changes.
     * @param {Function} fn - Callback
     * @returns {Function} Unsubscribe function
     */
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}

/**
 * Creates a computed signal that derives from other signals.
 * @template T
 * @param {() => T} fn - Computation function
 * @returns {{ value: T, peek: () => T }}
 */
export function computed(fn) {
  let value;
  let dirty = true;
  const subscribers = new Set();

  /**
   * Marks as dirty and notifies subscribers.
   */
  const recompute = () => {
    dirty = true;
    for (const sub of subscribers) {
      sub();
    }
  };

  return {
    get value() {
      // Track dependency
      if (currentEffect) {
        subscribers.add(currentEffect);
      }
      if (dirty) {
        // Run computation with tracking
        const prevEffect = currentEffect;
        currentEffect = recompute;
        effectStack.push(recompute);
        try {
          value = fn();
        } finally {
          effectStack.pop();
          currentEffect = prevEffect;
        }
        dirty = false;
      }
      return value;
    },
    /**
     * Read computed value without tracking.
     * @returns {T} Current computed value
     */
    peek() {
      if (dirty) {
        // Compute without tracking
        const prevEffect = currentEffect;
        currentEffect = null;
        try {
          value = fn();
        } finally {
          currentEffect = prevEffect;
        }
        dirty = false;
      }
      return value;
    },
  };
}

/**
 * Creates an effect that runs when dependencies change.
 * @param {Function} fn - Effect function
 * @returns {Function} Cleanup function
 */
export function effect(fn) {
  let cleanup = null;

  /**
   * Runs the effect function with dependency tracking.
   */
  const run = () => {
    // Run cleanup from previous execution
    if (typeof cleanup === 'function') {
      cleanup();
    }

    const prevEffect = currentEffect;
    currentEffect = run;
    effectStack.push(run);
    try {
      cleanup = fn();
    } finally {
      effectStack.pop();
      currentEffect = prevEffect;
    }
  };

  // Run immediately
  run();

  // Return cleanup function
  return () => {
    if (typeof cleanup === 'function') {
      cleanup();
    }
  };
}

/**
 * Runs a function without tracking dependencies.
 * @template T
 * @param {() => T} fn - Function to run
 * @returns {T}
 */
export function untracked(fn) {
  const prevEffect = currentEffect;
  currentEffect = null;
  try {
    return fn();
  } finally {
    currentEffect = prevEffect;
  }
}

/**
 * Batches multiple signal updates.
 * @param {Function} fn - Function containing updates
 */
export function batch(fn) {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      const effects = batchedEffects;
      batchedEffects = new Set();
      for (const effect of effects) {
        effect();
      }
    }
  }
}
