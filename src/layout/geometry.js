/**
 * @file Geometry helpers for Hyper Layout.
 *
 * These helpers translate between grid coordinates and pixels. Keeping the
 * math outside the custom element makes responsive behavior and pointer
 * interactions deterministic and easy to exercise from browser scenarios.
 *
 * The host element relies on this module when applying engine state to wrapper
 * styles. The pointer interaction module relies on the same conversions when
 * converting mouse movement into grid movement. Because both paths share this
 * code, a dragged item and a saved item resolve against the same cell geometry.
 */

/**
 * Resolve the active column count from explicit columns, breakpoints, or a
 * target cell width.
 * Domain context: dashboards often need host-width responsiveness rather than
 * viewport responsiveness because the layout may live inside a resizable panel.
 *
 * Technical context: explicit columns win, then breakpoint rules sorted by
 * width, then automatic columns from target cell width, and finally the
 * GridStack-compatible default of 12 columns.
 *
 * @param {HTMLElement} host - Layout host element.
 * @param {Object} options - Column resolution options.
 * @returns {number} Active columns.
 */
export function resolveColumns(host, options = {}) {
  if (options.columns) return Math.max(1, Number(options.columns));
  const width = Math.max(
    1,
    host.getBoundingClientRect().width,
    host.clientWidth
  );
  const breakpoints = Array.isArray(options.breakpoints)
    ? [...options.breakpoints]
    : [];
  const match = breakpoints
    .sort((a, b) => a.width - b.width)
    .find((point) => width <= point.width);
  if (match) return Math.max(1, Number(match.columns));
  if (options.columnWidth)
    return Math.max(1, Math.round(width / Number(options.columnWidth)));
  return 12;
}

/**
 * Measure cell dimensions for the current host.
 * Domain context: child widgets are placed in a grid, but browsers render
 * absolute pixel styles, so every render pass needs a stable cell measurement.
 *
 * Technical context: `cell-height="auto"` makes square cells by reusing
 * computed cell width. Margins are subtracted from item dimensions in
 * `nodeToPixels()` so adjacent cells keep visual breathing room.
 *
 * @param {HTMLElement} host - Layout host element.
 * @param {number} columns - Active columns.
 * @param {number|string} cellHeight - Height setting.
 * @param {number} margin - Item margin.
 * @returns {{cellWidth: number, cellHeight: number, margin: number}}
 */
export function measureGrid(host, columns, cellHeight = 'auto', margin = 10) {
  const width = Math.max(
    1,
    host.getBoundingClientRect().width,
    host.clientWidth,
    Number(columns)
  );
  const cellWidth = width / columns;
  const resolvedHeight = cellHeight === 'auto' ? cellWidth : Number(cellHeight);
  return { cellWidth, cellHeight: resolvedHeight, margin: Number(margin) };
}

/**
 * Convert a grid node into absolute pixel styles.
 * The result is consumed directly by `element.applyLayout()`, making this the
 * only place where grid x/y/w/h become CSS left/top/width/height values.
 *
 * @param {Object} node - Grid node.
 * @param {Object} grid - Measured grid values.
 * @returns {Object} Pixel style values.
 */
export function nodeToPixels(node, grid) {
  return {
    left: node.x * grid.cellWidth + grid.margin,
    top: node.y * grid.cellHeight + grid.margin,
    width: node.w * grid.cellWidth - grid.margin * 2,
    height: node.h * grid.cellHeight - grid.margin * 2,
  };
}

/**
 * Convert pointer delta into grid coordinates.
 * Domain context: dropping into empty space should land on the nearest grid
 * cell, not at an arbitrary pixel offset.
 *
 * Technical context: the interaction adapter captures the node's starting grid
 * position and pointer start coordinates; this helper rounds deltas to the
 * nearest cell count.
 *
 * @param {Object} start - Original node.
 * @param {number} dx - Horizontal pointer delta.
 * @param {number} dy - Vertical pointer delta.
 * @param {Object} grid - Measured grid values.
 * @returns {{x: number, y: number}} Grid target.
 */
export function deltaToMove(start, dx, dy, grid) {
  return {
    x: Math.round(start.x + dx / grid.cellWidth),
    y: Math.round(start.y + dy / grid.cellHeight),
  };
}

/**
 * Convert pointer delta into grid dimensions.
 * Domain context: resize handles stretch by whole grid cells so persistence
 * remains compact and predictable.
 *
 * Technical context: this helper does not apply min/max item constraints. The
 * engine applies those constraints in `resize()` so every resize source shares
 * one enforcement path.
 *
 * @param {Object} start - Original node.
 * @param {number} dx - Horizontal pointer delta.
 * @param {number} dy - Vertical pointer delta.
 * @param {Object} grid - Measured grid values.
 * @returns {{w: number, h: number}} Grid size target.
 */
export function deltaToSize(start, dx, dy, grid) {
  return {
    w: Math.max(1, Math.round(start.w + dx / grid.cellWidth)),
    h: Math.max(1, Math.round(start.h + dy / grid.cellHeight)),
  };
}

/**
 * Check whether a pointer is outside the layout host.
 * This is used only for opt-in removal modes. The trash-zone check lives in
 * the interaction module because it depends on `document.elementFromPoint()`,
 * while host bounds are pure geometry.
 *
 * @param {HTMLElement} host - Layout host element.
 * @param {number} clientX - Pointer x.
 * @param {number} clientY - Pointer y.
 * @returns {boolean} True when outside.
 */
export function isOutsideHost(host, clientX, clientY) {
  const rect = host.getBoundingClientRect();
  return (
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  );
}
