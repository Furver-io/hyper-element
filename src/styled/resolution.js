/**
 * @file Style resolution logic for +styled elements.
 * Resolves styles based on base styles, shared selectors, prop flags, logic functions, and colors.
 * @module hyper-element/styled/resolution
 */

import { getStyledEntry } from './registry.js';

/**
 * Resolve color palette values in a style object.
 * Replaces color names with their hex values from the palette.
 *
 * @param {Object} styles - Style object with potential color names
 * @param {Object} colors - Color palette mapping names to hex values
 * @returns {Object} Style object with resolved colors
 */
export function resolveColors(styles, colors) {
  const resolved = {};
  for (const [prop, value] of Object.entries(styles)) {
    if (typeof value === 'string') {
      // Direct color name match
      if (colors[value]) {
        resolved[prop] = colors[value];
      } else {
        // Check for color name within string (e.g., "1px solid primary")
        let newValue = value;
        for (const [name, hex] of Object.entries(colors)) {
          // Use word boundary to avoid partial matches
          newValue = newValue.replace(new RegExp(`\\b${name}\\b`, 'g'), hex);
        }
        resolved[prop] = newValue;
      }
    } else {
      resolved[prop] = value;
    }
  }
  return resolved;
}

/**
 * Check if a style object uses nested syntax (has a 'base' key).
 * Nested syntax enables prop flags mode.
 *
 * @param {Object} tagStyles - Style definition for a tag
 * @returns {boolean} True if nested syntax (prop flag mode)
 */
export function isNestedSyntax(tagStyles) {
  return tagStyles && typeof tagStyles === 'object' && 'base' in tagStyles;
}

/**
 * Core style resolution logic.
 * Extracted to allow direct calls from SSR without registry lookup.
 *
 * @param {Object} entry - Styled entry with styled, ctx, store, colors
 * @param {string} tagName - The tag name (e.g., 'div', 'h2')
 * @param {*} styleValue - Value passed to style attribute (for logic function)
 * @param {PropFlag[]} propFlags - Array of prop flags from the element
 * @returns {Object|null} Resolved style object, or null if no styles apply
 */
export function resolveStylesWithEntry(entry, tagName, styleValue, propFlags) {
  const { styled, ctx, colors } = entry;
  // Use entry.store if provided, otherwise fall back to ctx.store
  // (ctx.store is set dynamically after registerStyled is called)
  const store = entry.store ?? ctx?.store;

  // No styled config or invalid format
  if (!styled || !Array.isArray(styled) || !styled[0]) {
    if (styleValue && typeof styleValue === 'object' && !styleValue.__unsafe) {
      return styleValue;
    }
    return null;
  }

  const [base, logic] = styled;
  let result = {};
  let hasStyles = false;

  // Step 1: Base styles for this tag
  const tagStyles = base[tagName];
  if (tagStyles) {
    hasStyles = true;
    if (isNestedSyntax(tagStyles)) {
      // Nested syntax (prop flag mode) - use 'base' key
      result = { ...tagStyles.base };
    } else {
      // Simple syntax - use the object directly
      result = { ...tagStyles };
    }
  }

  // Step 2: Shared selectors (e.g., 'h2, span': {...})
  for (const key of Object.keys(base)) {
    if (key.includes(',')) {
      const tags = key.split(',').map((t) => t.trim());
      if (tags.includes(tagName)) {
        hasStyles = true;
        result = { ...result, ...base[key] };
      }
    }
  }

  // Step 3: Prop flags (in attribute order)
  if (
    propFlags &&
    propFlags.length > 0 &&
    tagStyles &&
    isNestedSyntax(tagStyles)
  ) {
    for (const flag of propFlags) {
      if (flag.active && tagStyles[flag.name]) {
        hasStyles = true;
        result = { ...result, ...tagStyles[flag.name] };
      }
    }
  }

  // Step 4: Logic function or style passthrough
  if (logic && typeof logic[tagName] === 'function') {
    // Logic function signature: (styleValue, ctx, store)
    // - styleValue: value passed to style attribute
    // - ctx: component context (attrs, state, etc.)
    // - store: component store
    const logicResult = logic[tagName](styleValue, ctx, store);
    if (logicResult && typeof logicResult === 'object') {
      hasStyles = true;
      result = { ...result, ...logicResult };
    }
  } else if (
    styleValue &&
    typeof styleValue === 'object' &&
    !styleValue.__unsafe
  ) {
    // Check for dynamic prop flags in style object (boolean values)
    // e.g., style=${{ error: true, loading: false }}
    if (tagStyles && isNestedSyntax(tagStyles)) {
      const inlineStyles = {};
      for (const [key, val] of Object.entries(styleValue)) {
        if (typeof val === 'boolean') {
          // Boolean value - treat as dynamic prop flag
          if (val && tagStyles[key]) {
            hasStyles = true;
            result = { ...result, ...tagStyles[key] };
          }
          // false values are intentionally skipped (flag not active)
        } else {
          // Non-boolean value - treat as inline style
          inlineStyles[key] = val;
        }
      }
      // Merge remaining inline styles
      if (Object.keys(inlineStyles).length > 0) {
        hasStyles = true;
        result = { ...result, ...inlineStyles };
      }
    } else {
      // No nested syntax - passthrough all styles as-is
      hasStyles = true;
      result = { ...result, ...styleValue };
    }
  }

  // Step 5: Color palette resolution
  if (colors && Object.keys(colors).length > 0) {
    result = resolveColors(result, colors);
  }

  return hasStyles ? result : null;
}

/**
 * Resolve styles for a +styled element.
 * Applies styles in order: base → shared selectors → prop flags → logic function.
 *
 * @param {HTMLElement} instance - The component instance
 * @param {string} tagName - The tag name (e.g., 'div', 'h2')
 * @param {*} styleValue - Value passed to style attribute (for logic function)
 * @param {PropFlag[]} propFlags - Array of prop flags from the element
 * @returns {Object|null} Resolved style object, or null if no styles apply
 */
export function resolveStyles(instance, tagName, styleValue, propFlags) {
  const entry = getStyledEntry(instance);
  if (!entry) {
    // No styled config registered - passthrough inline styles if object
    if (styleValue && typeof styleValue === 'object' && !styleValue.__unsafe) {
      return styleValue;
    }
    return null;
  }

  return resolveStylesWithEntry(entry, tagName, styleValue, propFlags);
}
