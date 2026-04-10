/**
 * @file Spec validation for json-render.
 *
 * Validates a json-render spec (the { root, elements } wire format)
 * against structural and semantic rules. Returns all violations found,
 * not just the first — giving the developer a complete diagnostic
 * picture in one call.
 *
 * Validation rules:
 *   1. root must be a key in elements
 *   2. Every children[] entry must reference a key in elements
 *   3. No circular references in the element tree
 *   4. type must be a known component type (or custom-registered)
 *   5. Button must have on.press.action (non-empty string)
 *   6. Progress.value must be 0-100
 *   7. Checklist.items must be array of { label, checked }
 *
 * @module hyper-element/json-render/validator
 */

/**
 * Build the set of known component types from the shared registry.
 *
 * Reads from the live registry (built-ins + custom-registered types)
 * so the validator automatically recognizes types added via
 * registerComponent() without requiring callers to pass customTypes.
 *
 * Returns a fresh Set on every call — no caching — because the
 * registry is mutable (registerComponent can be called at any time).
 * The cost is trivial for the typical 12-20 registered types.
 *
 * Called lazily inside validateSpec(), never at module scope, so the
 * registry is guaranteed to be initialized regardless of bundled
 * file concatenation order.
 */
import { registry } from './registry.js';
/**
 * Build a fresh set of known types from the shared registry.
 * @returns {Set<string>} Set of all registered component type names
 */
function getKnownTypes() {
  return new Set(registry.keys());
}

/**
 * Validate a json-render spec for structural and semantic correctness.
 *
 * @param {Object} spec - The spec to validate: { root: string, elements: Object }
 * @param {Set<string>} [customTypes] - Optional set of custom type names to accept
 * @returns {{ valid: boolean, errors: string[] }} Validation result with all violations
 */
export function validateSpec(spec, customTypes) {
  const errors = [];

  // Rule 0: spec must be an object with root and elements
  if (!spec || typeof spec !== 'object') {
    return { valid: false, errors: ['spec must be an object'] };
  }
  if (!spec.root) {
    errors.push('spec.root is required');
  }
  if (!spec.elements || typeof spec.elements !== 'object') {
    errors.push('spec.elements must be an object');
  }
  // Bail early if the spec is fundamentally broken — the remaining
  // rules depend on root and elements being present.
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Rule 1: root must reference a key in elements
  if (!spec.elements[spec.root]) {
    errors.push(
      `root "${spec.root}" is not a key in elements. ` +
        `Available keys: ${Object.keys(spec.elements).join(', ')}`
    );
  }

  // Build the set of valid types (built-in + custom)
  const validTypes = new Set(getKnownTypes());
  if (customTypes) {
    for (const t of customTypes) validTypes.add(t);
  }

  // Walk all elements checking constraints
  for (const [key, def] of Object.entries(spec.elements)) {
    // Rule 4: type must be known
    if (!validTypes.has(def.type)) {
      errors.push(
        `elements["${key}"].type "${def.type}" is not a known component type. ` +
          `Known types: ${[...validTypes].join(', ')}`
      );
    }

    // Rule 2: all children must reference valid keys
    if (def.children && Array.isArray(def.children)) {
      for (const childKey of def.children) {
        if (!spec.elements[childKey]) {
          errors.push(
            `elements["${key}"].children contains "${childKey}" ` +
              `which is not a key in elements`
          );
        }
      }
    }

    // Rule 5: Button must have on.press.action
    if (def.type === 'Button') {
      if (!def.on?.press?.action || typeof def.on.press.action !== 'string') {
        errors.push(
          `elements["${key}"] is a Button but missing on.press.action (non-empty string)`
        );
      }
    }

    // Rule 6: Progress.value must be 0-100
    if (def.type === 'Progress' && def.props?.value !== undefined) {
      const val = parseInt(def.props.value, 10);
      if (isNaN(val) || val < 0 || val > 100) {
        errors.push(
          `elements["${key}"] is a Progress with value ${def.props.value} ` +
            `— must be a number between 0 and 100`
        );
      }
    }

    // Rule 7: Checklist.items must be array of { label, checked }
    if (def.type === 'Checklist') {
      const items = def.props?.items;
      if (!Array.isArray(items)) {
        errors.push(
          `elements["${key}"] is a Checklist but props.items is not an array`
        );
      } else {
        items.forEach((item, i) => {
          if (typeof item.label !== 'string') {
            errors.push(
              `elements["${key}"].props.items[${i}].label must be a string`
            );
          }
          if (typeof item.checked !== 'boolean') {
            errors.push(
              `elements["${key}"].props.items[${i}].checked must be a boolean`
            );
          }
        });
      }
    }
  }

  // Rule 3: no circular references
  // Walk the tree from root, tracking visited nodes. If we visit
  // a node twice, there's a cycle.
  const visited = new Set();
  /**
   * Recursively walk the element tree checking for circular references.
   * @param {string} key - Current element key to visit
   * @param {string[]} path - Breadcrumb trail of visited keys
   */
  function walkForCycles(key, path) {
    if (visited.has(key)) {
      errors.push(`circular reference detected: ${[...path, key].join(' → ')}`);
      return;
    }
    visited.add(key);
    const def = spec.elements[key];
    if (def?.children) {
      for (const childKey of def.children) {
        if (spec.elements[childKey]) {
          walkForCycles(childKey, [...path, key]);
        }
      }
    }
  }

  // Start cycle detection from root if it exists in elements
  if (spec.elements[spec.root]) {
    walkForCycles(spec.root, []);
  }

  return { valid: errors.length === 0, errors };
}
