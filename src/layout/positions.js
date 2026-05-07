/**
 * @file Hyper Layout position normalization and reconciliation.
 *
 * Hyper Layout keeps application identity outside the DOM. Parents pass
 * an ordered `items` manifest whose opaque IDs map one-to-one to the
 * direct child elements they render. This module turns that manifest and
 * optional persisted positions into the canonical layout state consumed by
 * the DOM-free engine and emitted back to applications.
 */

/**
 * Convert attribute strings or direct property values into structured data.
 * Domain context: Hyper Element templates may pass rich objects directly,
 * while plain HTML users may provide JSON attributes for demos.
 *
 * @param {unknown} value - Property value or JSON attribute text.
 * @param {unknown} fallback - Value returned when parsing cannot produce data.
 * @returns {unknown} Parsed value or fallback.
 */
export function parseLayoutValue(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn('hyper-layout: ignoring invalid JSON attribute', error);
    return fallback;
  }
}

/**
 * Normalize the parent-owned identity manifest.
 * Domain context: IDs are opaque database/record keys and must not be
 * inferred from element tags. Tags are retained only for diagnostics.
 *
 * @param {Array|undefined|null} items - Parent supplied item manifest.
 * @param {number} childCount - Number of direct layout children.
 * @returns {{items: Array, ephemeral: boolean}} Normalized items.
 */
export function normalizeItems(items, childCount) {
  if (items == null) {
    return {
      ephemeral: true,
      items: Array.from({ length: childCount }, (_v, index) => ({
        id: `ephemeral-${index}`,
        tag: '',
        can: ['drag', 'resize'],
        ephemeral: true,
      })),
    };
  }
  if (!Array.isArray(items)) {
    throw new Error('hyper-layout: items must be an array');
  }
  if (items.length !== childCount) {
    throw new Error(
      `hyper-layout: items length (${items.length}) must match direct ` +
        `child count (${childCount})`
    );
  }
  const seen = new Set();
  const normalized = items.map((item, index) => {
    const raw = typeof item === 'string' ? { id: item } : item || {};
    const id = String(raw.id || '');
    if (!id) throw new Error(`hyper-layout: items[${index}].id is required`);
    if (seen.has(id))
      throw new Error(`hyper-layout: duplicate item id "${id}"`);
    seen.add(id);
    return {
      id,
      tag: raw.tag ? String(raw.tag).toLowerCase() : '',
      can: normalizeCan(raw.can),
      meta: raw.meta || {},
    };
  });
  return { items: normalized, ephemeral: false };
}

/**
 * Build a canonical positions object from direct input.
 * Technical context: serializers/deserializers are allowed to adapt external
 * formats, but the engine only sees GridStack-compatible core fields.
 *
 * @param {unknown} input - Positions object, item array, or serialized value.
 * @param {Function|null} deserialize - Optional consumer parser.
 * @param {number} columns - Active column count.
 * @returns {{version: number, columns: number, items: Array, ephemeral?: boolean}}
 */
export function normalizePositions(input, deserialize = null, columns = 12) {
  const parsed = deserialize
    ? deserialize(input)
    : parseLayoutValue(input, null);
  const source = Array.isArray(parsed) ? { items: parsed } : parsed || {};
  const list = Array.isArray(source.items) ? source.items : [];
  return {
    version: Number(source.version || 1),
    columns: Number(source.columns || columns || 12),
    ephemeral: !!source.ephemeral,
    items: list.map((item) => normalizePositionItem(item, columns)),
  };
}

/**
 * Reconcile parent identity with persisted geometry.
 * Domain context: removed IDs become orphaned, new IDs are auto-placed, and
 * the resulting state is emitted so controlled parents can persist it.
 *
 * @param {Array} items - Normalized ordered item manifest.
 * @param {unknown} positions - Optional persisted positions.
 * @param {Object} options - Reconciliation options.
 * @returns {{positions: Object, added: string[], removed: string[], orphaned: string[]}}
 */
export function reconcilePositions(items, positions, options = {}) {
  const columns = options.columns || 12;
  const normalized = normalizePositions(
    positions,
    options.deserialize,
    columns
  );
  const byId = new Map(normalized.items.map((item) => [item.id, item]));
  const ids = new Set(items.map((item) => item.id));
  const orphaned = normalized.items
    .filter((item) => !ids.has(item.id))
    .map((item) => item.id);
  const added = [];
  const liveItems = items.map((item) => {
    const existing = byId.get(item.id);
    if (existing)
      return applyCapabilities(
        {
          ...existing,
          meta: Object.assign({}, existing.meta, item.meta),
        },
        item
      );
    added.push(item.id);
    return applyCapabilities(
      normalizePositionItem({ id: item.id, meta: item.meta }, columns),
      item
    );
  });
  return {
    added,
    orphaned,
    removed: orphaned,
    positions: {
      version: 1,
      columns,
      ephemeral: !!options.ephemeral,
      items: liveItems,
    },
  };
}

/**
 * Serialize positions through the consumer callback when present.
 * @param {Object} positions - Canonical positions.
 * @param {Function|null} serialize - Optional consumer serializer.
 * @returns {unknown} Serialized positions.
 */
export function serializePositions(positions, serialize = null) {
  return serialize ? serialize(positions) : positions;
}

/**
 * Normalize one item while preserving GridStack-compatible field names.
 * @param {Object} item - Raw persisted item.
 * @param {number} columns - Active column limit.
 * @returns {Object} Canonical item.
 */
function normalizePositionItem(item = {}, columns = 12) {
  const width = clampNumber(item.w, 1, columns, 1);
  return {
    id: String(item.id || ''),
    x: clampNumber(item.x, 0, columns - 1, 0),
    y: Math.max(0, Number(item.y || 0)),
    w: width,
    h: Math.max(1, Number(item.h || 1)),
    minW: item.minW ? Number(item.minW) : undefined,
    minH: item.minH ? Number(item.minH) : undefined,
    maxW: item.maxW ? Number(item.maxW) : undefined,
    maxH: item.maxH ? Number(item.maxH) : undefined,
    locked: !!item.locked,
    noMove: !!item.noMove,
    noResize: !!item.noResize,
    meta: item.meta || {},
  };
}

/**
 * Normalize an item capability list.
 * Domain context: dashboard parents own permission decisions because they know
 * which records can be moved or resized in the current application workflow.
 * Missing `can` keeps legacy behavior by allowing both edit actions.
 *
 * @param {unknown} can - Raw capability list.
 * @returns {string[]} Normalized capabilities.
 */
function normalizeCan(can) {
  if (can == null) return ['drag', 'resize'];
  const list = Array.isArray(can) ? can : [can];
  return list.map((entry) => String(entry)).filter(Boolean);
}

/**
 * Project item capabilities onto engine constraints.
 * Technical context: the engine enforces `noMove` and `noResize`, so the DOM
 * layer and the collision engine share one source of truth for allowed action.
 *
 * @param {Object} node - Canonical position node.
 * @param {Object} item - Normalized manifest item.
 * @returns {Object} Node with capability constraints applied.
 */
function applyCapabilities(node, item) {
  if (node.locked) return { ...node, noMove: true, noResize: true };
  return {
    ...node,
    noMove: node.noMove || !item.can.includes('drag'),
    noResize: node.noResize || !item.can.includes('resize'),
  };
}

/**
 * Clamp numeric input into a bounded range with a fallback for bad values.
 * @param {unknown} value - Raw number-like value.
 * @param {number} min - Inclusive minimum.
 * @param {number} max - Inclusive maximum.
 * @param {number} fallback - Value used when input is not finite.
 * @returns {number} Clamped number.
 */
function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}
