/**
 * @file Event helpers for <hyper-layout>.
 *
 * Hyper Layout mirrors GridStack event names while adding ergonomic
 * `onchange(event, positions)` and `onremoved(event, id, positions, ids)`
 * properties for Hyper Element templates. Keeping this logic separate prevents
 * the host element from mixing event plumbing with child reconciliation and
 * geometry work.
 *
 * The host, interaction adapter, and reconciliation workflow all rely on this
 * module whenever layout state changes. This module relies on `properties.js`
 * only to recover function-valued handlers passed through Hyper Element's
 * shared attribute mechanism.
 */

import { readSharedLayoutAttribute } from './properties.js';

/**
 * Install the Hyper Layout onchange IDL property on a host instance.
 * Domain context: Hyper Element users expect `onchange=${fn}` to receive the
 * event and the new positions directly, while standard DOM users expect a
 * normal `change` event.
 *
 * Technical context: this accessor checks both direct property assignment and
 * shared function placeholders emitted by Hyper Element templates. It is
 * instance-scoped so tests and multiple layout hosts do not share handlers.
 *
 * @param {HTMLElement} host - Layout host.
 */
export function defineLayoutOnChange(host) {
  defineLayoutCallback(host, 'onchange', '_onchange');
  host._hasLayoutOnChange = true;
}

/**
 * Install the Hyper Layout onremoved IDL property on a host instance.
 * Domain context: trash/outside removal is controlled by the parent because
 * the parent owns the application data behind each opaque item ID. The
 * callback therefore receives the removed ID and decides how to shrink its
 * `items` manifest and child list.
 *
 * Technical context: this mirrors `onchange` so Hyper Element templates can
 * use `<hyper-layout onremoved=${fn}>` without imperative `addEventListener`
 * setup. Standard DOM listeners still receive the full `removed` event.
 *
 * @param {HTMLElement} host - Layout host.
 */
export function defineLayoutOnRemoved(host) {
  defineLayoutCallback(host, 'onremoved', '_onremoved');
}

/**
 * Define a callback property that also reads Hyper Element shared attributes.
 * Domain context: Hyper Layout callbacks are public API, not internal event
 * wiring. They need to work whether a developer assigns `layout.onremoved = fn`
 * or passes `onremoved=${fn}` from a Hyper Element render function.
 *
 * @param {HTMLElement} host - Layout host.
 * @param {string} publicName - Public callback property.
 * @param {string} privateName - Private storage slot.
 */
function defineLayoutCallback(host, publicName, privateName) {
  Object.defineProperty(host, publicName, {
    get: () =>
      host[privateName] || readSharedLayoutAttribute(host, publicName) || null,
    set: (handler) => {
      host[privateName] = typeof handler === 'function' ? handler : null;
    },
    configurable: true,
  });
}

/**
 * Emit a bubbling GridStack-like event.
 * Domain context: parents may listen with either DOM `addEventListener()` or
 * Hyper Element `onchange=${...}`. Both paths must observe the same positions.
 *
 * Technical context: `change` and `removed` invoke ergonomic handlers. Other
 * GridStack-style events bubble as ordinary CustomEvents.
 *
 * @param {HTMLElement} host - Layout host.
 * @param {string} name - Event name.
 * @param {Object} detail - Event detail.
 * @returns {CustomEvent} Dispatched event.
 */
export function emitLayoutEvent(host, name, detail = {}) {
  const event = new CustomEvent(name, { bubbles: true, detail });
  host.dispatchEvent(event);
  const onchange = host.onchange;
  if (name === 'change' && typeof onchange === 'function') {
    onchange(event, detail.positions);
  }
  const onremoved = host.onremoved;
  if (name === 'removed' && typeof onremoved === 'function') {
    const ids = detail.removed || [];
    onremoved(event, ids[0] || null, detail.positions, ids);
  }
  return event;
}

/**
 * Emit a canonical change event with current positions.
 * Domain context: every persisted state transition should have the same detail
 * shape so controlled parents can update stores without branching per action.
 *
 * Technical context: `extra` can add action-specific arrays, but defaults keep
 * `nodes`, `added`, `removed`, and `orphaned` present for stable consumers.
 *
 * @param {HTMLElement} host - Layout host.
 * @param {string} reason - Change reason.
 * @param {Object} extra - Extra event detail.
 */
export function commitLayoutChange(host, reason, extra = {}) {
  const positions = currentLayoutPositions(host);
  host._layoutPositions = positions;
  emitLayoutEvent(host, 'change', {
    nodes: [],
    added: [],
    removed: [],
    orphaned: [],
    ...extra,
    reason,
    positions,
  });
}

/**
 * Return canonical positions for current engine state.
 * The snapshot is intentionally derived from the engine, not wrapper DOM, so
 * saved output reflects the authoritative layout model even while CSS
 * transitions or pointer-floating styles are present.
 *
 * @param {HTMLElement} host - Layout host.
 * @returns {Object} Current positions.
 */
export function currentLayoutPositions(host) {
  return {
    version: 1,
    columns: host.engine.columns,
    ephemeral: !host.items,
    items: host.engine.save(),
  };
}
