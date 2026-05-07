/**
 * @file Runtime CSS for <hyper-layout>.
 *
 * The layout subsystem injects one shared style tag so users do not need to
 * remember a second stylesheet for the default editor experience. The rules
 * target data attributes owned by Hyper Layout wrappers, never child custom
 * elements, preserving child component styling and behavior.
 *
 * The DOM wrapper module relies on these data attributes when creating shells,
 * and the interaction adapter toggles active/floating attributes during
 * pointer sessions. The stylesheet relies only on those internal attributes and
 * CSS custom properties, so application components can keep their own styles
 * isolated.
 */

const STYLE_ID = 'hyper-layout-styles';

/**
 * Ensure the shared stylesheet exists.
 * Domain context: importing `hyper-element/layout` should be enough to get a
 * usable editor overlay; users should not need to remember a companion CSS file
 * for the default experience.
 *
 * Technical context: a single global style tag is idempotently injected because
 * multiple `<hyper-layout>` instances share the same wrapper contract. The
 * rules are intentionally scoped under `hyper-layout` to avoid affecting other
 * custom elements.
 *
 * @returns {void}
 */
export function ensureLayoutStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
hyper-layout {
  display: block;
  min-height: 1px;
  position: relative;
}
hyper-layout [data-hl-item] {
  box-sizing: border-box;
  position: absolute;
  transition: filter 160ms ease, opacity 160ms ease, transform 160ms ease, left 120ms ease, top 120ms ease, width 120ms ease, height 120ms ease;
}
hyper-layout [data-hl-content] {
  height: 100%;
  overflow: hidden;
  width: 100%;
}
hyper-layout [data-hl-content] > * {
  box-sizing: border-box;
  display: block;
  height: 100%;
  max-height: 100%;
  max-width: 100%;
  min-height: 0;
  min-width: 0;
  width: 100%;
}
hyper-layout [data-hl-overlay] {
  align-items: stretch;
  backdrop-filter: blur(3px);
  background: transparent;
  color: var(--hl-overlay-color, #5147f0);
  display: flex;
  inset: 0;
  justify-content: stretch;
  opacity: 0;
  pointer-events: none;
  position: absolute;
  transition: opacity 160ms ease;
  visibility: hidden;
  /* Filtered child content can create a stacking context, so the editor layer must explicitly sit above rendered widgets. */
  z-index: 2;
}
hyper-layout[data-edit='true'] [data-hl-content] {
  filter: grayscale(1);
  opacity: 0.45;
  pointer-events: none;
}
hyper-layout[data-edit='true'] [data-hl-item]:hover [data-hl-content],
hyper-layout [data-hl-item][data-hl-active='true'] [data-hl-content] {
  filter: grayscale(0);
  opacity: 1;
}
hyper-layout[data-edit='true'] [data-hl-item]:hover [data-hl-overlay],
hyper-layout [data-hl-item][data-hl-active='true'] [data-hl-overlay] {
  opacity: 1;
  pointer-events: auto;
  visibility: visible;
}
hyper-layout [data-hl-item][data-hl-floating='true'][data-hl-dragging='true'] {
  box-shadow: 0 20px 38px rgba(15, 23, 42, 0.32), 0 4px 10px rgba(15, 23, 42, 0.18);
  pointer-events: none;
  transition: none;
  z-index: 5;
}
hyper-layout [data-hl-item][data-hl-removing='true'] {
  opacity: 0.5;
  transform: scale(0.8);
  transform-origin: center;
}
hyper-layout [data-hl-item][data-hl-removing='true'] [data-hl-overlay] {
  color: var(--hl-overlay-remove-color, #dc2626);
}
hyper-layout > [data-hl-placeholder='true'] {
  background: transparent;
  border: 2px dashed var(--hl-placeholder-border, #0891b2);
  border-radius: var(--hl-placeholder-radius, 12px);
  box-shadow: inset 0 8px 18px rgba(15, 23, 42, 0.16), inset 0 0 0 1px rgba(8, 145, 178, 0.18);
  box-sizing: border-box;
  opacity: 0;
  pointer-events: none;
  position: absolute;
  transition: opacity 120ms ease, left 120ms ease, top 120ms ease, width 120ms ease, height 120ms ease;
  z-index: 4;
}
hyper-layout > [data-hl-placeholder='true'][data-hl-placeholder-active='true'] {
  opacity: 1;
}
hyper-layout-default-overlay {
  align-items: center;
  display: flex;
  height: 100%;
  justify-content: center;
  position: relative;
  width: 100%;
}
/* Custom overlay elements are arbitrary web components, so Hyper Layout stretches the supplied host before the component's own internal percentages resolve. */
hyper-layout [data-hl-overlay] > * {
  display: block;
  height: 100%;
  width: 100%;
}
hyper-layout-default-overlay [data-hl-drag] {
  align-items: center;
  background: transparent;
  border: 0;
  color: currentColor;
  cursor: grab;
  display: flex;
  font: 700 18px/1.1 sans-serif;
  gap: 8px;
  padding: 12px;
}
hyper-layout-default-overlay [data-hl-trash-icon],
hyper-layout [data-hl-item][data-hl-removing='true'] hyper-layout-default-overlay [data-hl-move-icon] {
  display: none;
}
hyper-layout [data-hl-item][data-hl-removing='true'] hyper-layout-default-overlay [data-hl-trash-icon] {
  display: block;
}
hyper-layout-default-overlay [data-hl-resize] {
  align-items: center;
  background: transparent;
  border: 0;
  bottom: 8px;
  color: color-mix(in srgb, currentColor 70%, #6f6f6f);
  cursor: nwse-resize;
  display: flex;
  font: 700 24px/1 sans-serif;
  height: 28px;
  justify-content: center;
  padding: 2px;
  position: absolute;
  right: 8px;
  width: 28px;
}
hyper-layout-default-overlay:not([can-drag]) [data-hl-drag],
hyper-layout-default-overlay:not([can-resize]) [data-hl-resize] {
  display: none;
}
hyper-layout [data-hl-item][data-hl-locked='true'] [data-hl-overlay] {
  color: var(--hl-overlay-locked-color, #64748b);
}
`;
  document.head.appendChild(style);
}
