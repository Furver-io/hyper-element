/**
 * @file Shared helpers for built-in json-render components.
 * Rendering components use these helpers to keep display coercion and action
 * event dispatch consistent across every built-in component type.
 */

/**
 * Coerce a spec prop to safe display text. Objects and arrays would otherwise
 * stringify as "[object Object]" when interpolated into the DOM.
 *
 * @param {unknown} v - Candidate display value.
 * @param {string} [fallback=''] - Used when v is not displayable.
 * @returns {string} Text safe to interpolate through the template engine.
 */
export function propText(v, fallback = '') {
  if (v == null) return fallback;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return String(v);
  return fallback;
}

/**
 * Dispatch a jr-action CustomEvent from the host element.
 *
 * @param {HTMLElement} hostEl - The element to dispatch from.
 * @param {string} action - Action name.
 * @param {Object} params - Action parameters payload.
 */
export function dispatchAction(hostEl, action, params) {
  hostEl.dispatchEvent(
    new CustomEvent('jr-action', {
      bubbles: true,
      composed: true,
      detail: { action, params: params || {} },
    })
  );
}
