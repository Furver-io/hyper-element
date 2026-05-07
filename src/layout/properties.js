/**
 * @file IDL property installation for <hyper-layout>.
 *
 * Hyper Layout accepts rich object properties from Hyper Element templates and
 * JSON attributes from plain HTML. These accessors keep that parsing behavior
 * consistent without bloating the custom element lifecycle file.
 *
 * The element constructor installs these descriptors on each host instance.
 * Reconciliation, event dispatch, and overlay configuration rely on these
 * getters to return direct property values first, then Hyper Element shared
 * attribute values, then JSON attribute fallbacks.
 */

import { parseLayoutValue } from './positions.js';
import { sharedAttrs } from '../core/manager.js';

/**
 * Read a Hyper Element shared attribute placeholder from a layout host.
 * Domain context: developers write `<hyper-layout items=${items}>` with rich
 * arrays and functions. Hyper Element serializes those values into placeholder
 * attributes and stores the real value in `sharedAttrs`.
 *
 * Technical context: the placeholder is accepted only when both attribute name
 * and receiving localName match. This prevents one custom element from reading
 * another element's object/function placeholder by accident.
 *
 * @param {HTMLElement} host - Layout host.
 * @param {string} name - Attribute/property name.
 * @returns {unknown} Shared value or undefined.
 */
export function readSharedLayoutAttribute(host, name) {
  const value = host.getAttribute(name);
  const prefix = value && value.slice(0, 3);
  if (prefix !== 'ob-' && prefix !== 'fn-') return undefined;
  const shared = sharedAttrs[value.slice(3)];
  return shared?.localName === host.localName && shared.attrName === name
    ? shared.val
    : undefined;
}

/**
 * Read either a Hyper Element object placeholder or a JSON attribute value.
 * This is the common read path for object-valued layout configuration. Plain
 * HTML examples can use JSON attributes, but Hyper Element render functions get
 * the original object/function references back through `sharedAttrs`.
 *
 * @param {HTMLElement} host - Layout host.
 * @param {string} name - Attribute/property name.
 * @param {unknown} fallback - Fallback value.
 * @returns {unknown} Parsed or shared value.
 */
function readLayoutAttribute(host, name, fallback) {
  const shared = readSharedLayoutAttribute(host, name);
  return shared === undefined
    ? parseLayoutValue(host.getAttribute(name), fallback)
    : shared;
}

/**
 * Define public IDL properties on a host instance.
 * Domain context: the public API should feel like a normal custom element:
 * assigning `layout.positions = next` or setting `<hyper-layout edit>` both
 * update the same layout.
 *
 * Technical context: object-valued setters store direct values on private
 * slots so they do not need to serialize into attributes. Connected setters
 * schedule reconciliation for the next microtask because Hyper Element updates
 * custom-element properties before it finishes reconciling that element's
 * children. Deferring lets `items` and direct children change together in one
 * parent render without a transient length-mismatch exception.
 *
 * @param {HTMLElement} host - Layout host.
 */
export function defineLayoutProperties(host) {
  Object.defineProperties(host, {
    edit: {
      /**
       * Read the edit-mode flag from the standard boolean host attribute.
       * The editor treats `edit="false"` as disabled so plain HTML examples
       * can turn the mode off without removing the attribute manually.
       *
       * @returns {boolean} Whether edit mode is currently active.
       */
      get() {
        return (
          this.hasAttribute('edit') && this.getAttribute('edit') !== 'false'
        );
      },
      /**
       * Mirror property assignment to the host attribute used by CSS,
       * mutation observation, and public HTML usage.
       *
       * @param {unknown} value - Truthy values enable editing.
       * @returns {void}
       */
      set(value) {
        value
          ? this.setAttribute('edit', 'true')
          : this.removeAttribute('edit');
      },
    },
    items: {
      /**
       * Read the ordered identity manifest from direct assignment or from a
       * Hyper Element shared-attribute placeholder.
       *
       * @returns {unknown} Parent-provided items or null.
       */
      get() {
        return this._items || readLayoutAttribute(this, 'items', null);
      },
      /**
       * Store a new ordered identity manifest and queue reconciliation after
       * the parent render has also updated direct children.
       *
       * @param {unknown} value - Ordered item manifest.
       * @returns {void}
       */
      set(value) {
        this._items = value;
        requestLayoutReconcile(this, 'items-reconciled');
      },
    },
    positions: {
      /**
       * Read controlled positions when present, otherwise fall back to JSON or
       * shared-attribute input.
       *
       * @returns {unknown} Canonical positions input or null.
       */
      get() {
        return this._positions || readLayoutAttribute(this, 'positions', null);
      },
      /**
       * Store controlled positions and queue a layout reload.
       *
       * @param {unknown} value - Canonical or deserializable positions.
       * @returns {void}
       */
      set(value) {
        this._positions = value;
        requestLayoutReconcile(this, 'positions');
      },
    },
    breakpoints: {
      /**
       * Read responsive breakpoint rules from a direct property or parsed
       * attribute input.
       *
       * @returns {unknown} Breakpoint rules or null.
       */
      get() {
        return (
          this._breakpoints || readLayoutAttribute(this, 'breakpoints', null)
        );
      },
      /**
       * Store responsive breakpoint rules and queue column recalculation.
       *
       * @param {unknown} value - Breakpoint rule array.
       * @returns {void}
       */
      set(value) {
        this._breakpoints = value;
        requestLayoutReconcile(this, 'attribute');
      },
    },
    overlay: {
      /**
       * Read the custom overlay tag name, preferring explicit property
       * assignment over the attribute fallback.
       *
       * @returns {string} Custom overlay element tag or an empty string.
       */
      get() {
        return this._overlay !== undefined
          ? this._overlay
          : this.getAttribute('overlay') || '';
      },
      /**
       * Store the custom overlay tag name and clear stale attributes when the
       * property is reset.
       *
       * @param {unknown} value - Custom overlay tag name.
       * @returns {void}
       */
      set(value) {
        this._overlay = value ? String(value) : '';
        if (!value && this.hasAttribute('overlay'))
          this.removeAttribute('overlay');
        requestLayoutReconcile(this, 'attribute');
      },
    },
  });
}

/**
 * Queue one reconciliation after the current Hyper Element render turn.
 * Domain context: parent components often update `items`, `positions`, and the
 * slotted child list in the same JSX-style template. Hyper Layout should
 * validate the settled render result, not the halfway point where a property is
 * already new but the DOM children are still old.
 *
 * Technical context: the latest requested reason wins. A direct public
 * `reconcile()` call clears `_layoutReconcileTicket`, which cancels the queued
 * pass so explicit validation tests and imperative callers still get immediate
 * behavior.
 *
 * @param {HTMLElement} host - Layout host.
 * @param {string} reason - Reconcile reason.
 */
function requestLayoutReconcile(host, reason) {
  if (!host.isConnected) return;
  const ticket = (host._layoutReconcileTicket || 0) + 1;
  host._layoutReconcileTicket = ticket;
  host._layoutReconcileReason = reason;
  queueMicrotask(() => {
    if (!host.isConnected || host._layoutReconcileTicket !== ticket) return;
    host._layoutReconcileTicket = 0;
    host.reconcile(host._layoutReconcileReason);
  });
}
