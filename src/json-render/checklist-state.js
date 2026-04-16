/**
 * @file Per-host optimistic state for the Checklist component.
 *
 * The built-in Checklist renderer projects the user's click state
 * into the DOM locally — the `<json-render>` element does not wait
 * for a spec replacement to show a flipped checkbox, an updated
 * "N/M complete" counter, or the strikethrough on a checked item.
 * That local state lives in this module so `components.js` can stay
 * under the project's 260-line per-file cap and so the storage
 * layout (host-keyed WeakMap + fingerprint) has a single named home.
 *
 * Storage layout:
 *   WeakMap<hostEl, Map<specKey, { fingerprint, checked }>>
 *
 *   - WeakMap on `hostEl` — one entry per `<json-render>` instance;
 *     the entry is garbage-collected when the host is removed from
 *     the DOM. This is mandatory: keying by the spec `def` object
 *     does not work because `<json-render>` re-parses its
 *     `textContent` on every render pass and produces a fresh `def`
 *     reference each time, so the self-triggered re-render that
 *     follows our `hostEl.render()` call would see a cache miss
 *     against the old `def`.
 *   - Map on `specKey` — the Checklist's identity inside the spec
 *     (the element key, unique within a given spec). Multiple
 *     Checklists inside the same `<json-render>` get independent
 *     state.
 *   - `fingerprint` — a deterministic string derived from the
 *     current item labels and their positions. Distinguishes
 *     self-triggered re-renders (same labels → reuse existing
 *     `checked` array) from a genuine spec replacement (different
 *     labels → seed fresh state from `props.items[i].checked`).
 *
 * @module hyper-element/json-render/checklist-state
 */

// Module-level storage. WeakMap guarantees entries are released
// when the host element is removed; the inner Map is ordinary and
// shares the host's lifetime.
const checklistStateByHost = new WeakMap();

/**
 * Build a stable fingerprint for a Checklist's items. Used to
 * detect spec replacement across renders: an identical label array
 * (with identical positional order) is treated as "the same logical
 * checklist"; any change invalidates local state.
 *
 * Positional plus label means swapping two items — a different user
 * intent than simply re-rendering the same list — correctly resets
 * state, while preserving state across the self-triggered re-render
 * that a toggle issues (same items, same order).
 *
 * @param {Array} items - Checklist items from `def.props.items`
 * @returns {string} Deterministic fingerprint
 */
function fingerprintItems(items) {
  return items.map((it, i) => i + ':' + String(it?.label ?? '')).join('|');
}

/**
 * Get (or lazily create) the optimistic checked-array for a
 * Checklist spec on a given host. Survives self-triggered
 * re-renders (toggle → `hostEl.render()`) because the fingerprint
 * matches; resets when the spec is replaced and item labels change.
 *
 * The returned array is the live stored reference — callers mutate
 * it in place (e.g. `checked[i] = true` inside an onchange handler)
 * and the next render picks up the change.
 *
 * @param {HTMLElement} hostEl - The `<json-render>` host element
 * @param {string} specKey - The Checklist's key inside the spec
 * @param {Array} items - The checklist's items from the current render
 * @returns {boolean[]} Mutable per-item checked flags
 */
export function getChecklistState(hostEl, specKey, items) {
  let byKey = checklistStateByHost.get(hostEl);
  if (!byKey) {
    byKey = new Map();
    checklistStateByHost.set(hostEl, byKey);
  }
  const fingerprint = fingerprintItems(items);
  const existing = byKey.get(specKey);
  if (existing && existing.fingerprint === fingerprint) {
    return existing.checked;
  }
  // Fresh spec (first mount or items changed) — seed from the
  // incoming checked flags. Coerce to boolean so a missing `checked`
  // field renders as unchecked and the fingerprint/reset logic
  // treats undefined and false identically.
  const fresh = items.map((it) => !!it?.checked);
  byKey.set(specKey, { fingerprint, checked: fresh });
  return fresh;
}
