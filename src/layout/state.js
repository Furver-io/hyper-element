/**
 * @file Reconciliation workflow for <hyper-layout>.
 *
 * The host element owns the browser lifecycle, but reconciliation is the
 * product rule that maps parent identity, controlled or internal positions,
 * responsive columns, engine state, and wrapper DOM into one coherent layout.
 * Keeping that flow here prevents the custom element class from becoming a
 * catch-all while keeping every branch reachable from browser scenarios.
 */

import { layoutChildren, wrapLayoutChildren } from './dom.js';
import { normalizeItems, reconcilePositions } from './positions.js';

/**
 * Reconcile item identity, wrappers, and engine state for a host.
 * Domain context: this is the main convergence point after connection,
 * attribute/property updates, child mutations, load calls, and responsive
 * column changes. It ensures the parent-owned `items` manifest, live direct
 * children, persisted positions, and engine all agree.
 *
 * Technical context: controlled positions win when present; otherwise the
 * host's internal `_layoutPositions` preserves uncontrolled user edits across
 * future reconciliations. Responsive column-only changes use the current engine
 * state rather than reloading original positions so user edits are preserved.
 *
 * @param {HTMLElement} host - Hyper Layout host.
 * @param {string} reason - Reason for reconciliation.
 */
export function reconcileLayout(host, reason = 'items-reconciled') {
  const itemInput = host.items;
  const children = pruneRemovedWrappers(layoutChildren(host), itemInput);
  const itemState = normalizeItems(itemInput, children.length);
  const columns = host.resolveColumnCount();
  const positionInput = host.positions;
  if (
    reason === 'attribute' &&
    host.engine.nodes.length &&
    columns !== host.engine.columns
  ) {
    applyResponsiveColumns(host, children, itemState.items, columns);
    return;
  }
  const state = reconcilePositions(
    itemState.items,
    positionInput == null ? host._layoutPositions : positionInput,
    {
      columns,
      deserialize: host.deserialize || null,
      ephemeral: itemState.ephemeral,
    }
  );
  host.engine.columns = columns;
  host.engine.maxRow = Number(host.getAttribute('max-row') || 0);
  host.engine.float = host.hasAttribute('float');
  host.engine.load(state.positions.items);
  wrapLayoutChildren(
    host,
    children,
    itemState.items,
    host.engine,
    host.overlay
  );
  host.applyLayout();
  host._layoutPositions = host.currentPositions();
  emitReconcileEvents(host, reason, state);
}

/**
 * Remove wrapper elements whose IDs are no longer present in parent items.
 * Domain context: Hyper Element updates custom-element properties before it
 * has necessarily removed DOM nodes that Hyper Layout moved into internal
 * wrappers. During parent-owned removal, the new `items` manifest can already
 * omit an ID while the old wrapper is still a direct child. That wrapper is no
 * longer application data and should be discarded rather than causing a false
 * `items.length !== children.length` error.
 *
 * Technical context: only existing Hyper Layout wrappers are pruned, and only
 * when a valid-looking array manifest is present. Raw direct children are never
 * hidden because a true raw child mismatch should still fail loudly.
 *
 * @param {Array} children - Logical child entries from `layoutChildren()`.
 * @param {unknown} items - Parent-provided item manifest.
 * @returns {Array} Entries still represented by the manifest.
 */
function pruneRemovedWrappers(children, items) {
  if (!Array.isArray(items)) return children;
  if (children.length <= items.length) return children;
  const ids = new Set(
    items
      .map((item) => (typeof item === 'string' ? item : item?.id))
      .filter(Boolean)
  );
  return children.filter((entry) => {
    const id = entry.wrapper?.dataset.layoutId;
    if (!id || ids.has(id)) return true;
    entry.wrapper.remove();
    return false;
  });
}

/**
 * Scale current engine positions when only the column count changed.
 * Domain context: resizing a container should adapt the current dashboard, not
 * reset it to the first loaded layout.
 *
 * Technical context: this path bypasses `reconcilePositions()` because item
 * identity did not change. It calls `engine.setColumns()` to scale existing
 * nodes, then refreshes wrappers and internal uncontrolled state.
 *
 * @param {HTMLElement} host - Hyper Layout host.
 * @param {Array} children - Logical child entries.
 * @param {Array} items - Normalized item manifest.
 * @param {number} columns - New column count.
 */
function applyResponsiveColumns(host, children, items, columns) {
  host.engine.maxRow = Number(host.getAttribute('max-row') || 0);
  host.engine.float = host.hasAttribute('float');
  host.engine.setColumns(columns);
  wrapLayoutChildren(host, children, items, host.engine, host.overlay);
  host.applyLayout();
  host._layoutPositions = host.currentPositions();
}

/**
 * Emit added, removed, and load changes after reconciliation.
 * Domain context: controlled parents need to hear when logical layout state
 * changed because items were added, removed, orphaned, or loaded.
 *
 * Technical context: initial connection is silent to avoid firing persistence
 * callbacks before the parent has finished mounting. Later reconciliations emit
 * GridStack-style granular events followed by one canonical `change` event when
 * persisted positions should converge.
 *
 * @param {HTMLElement} host - Hyper Layout host.
 * @param {string} reason - Reconciliation reason.
 * @param {Object} state - Reconciled position state.
 */
function emitReconcileEvents(host, reason, state) {
  if (reason !== 'connect' && state.added.length)
    host.emit('added', {
      added: state.added,
      positions: host.currentPositions(),
    });
  if (reason !== 'connect' && state.removed.length)
    host.emit('removed', {
      removed: state.removed,
      orphaned: state.orphaned,
      positions: host.currentPositions(),
    });
  if (
    reason !== 'connect' &&
    (state.added.length || state.removed.length || reason === 'load')
  ) {
    host.commitChange(reason, state);
  }
}
