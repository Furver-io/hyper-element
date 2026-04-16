/**
 * @file Built-in component types for json-render.
 *
 * Each component is a render function that receives the hyper-element
 * Html tagged template, the element definition, key, rendered children,
 * and the host element for event dispatch. Components use Html.wire()
 * for efficient DOM reuse across re-renders.
 *
 * Component render function signature:
 *   (Html, def, key, kids, hostEl) => HtmlTemplate
 *
 * Interactive components dispatch a `jr-action` CustomEvent on the
 * host element. The event bubbles so parents can listen for actions
 * from any depth in the spec tree.
 *
 * @module hyper-element/json-render/components
 */

/**
 * Dispatch a jr-action CustomEvent from the host element.
 * All interactive components use this helper for consistent
 * event shape. The event bubbles and is composed so it crosses
 * shadow DOM boundaries.
 *
 * @param {HTMLElement} hostEl - The element to dispatch from
 * @param {string} action - Action name (e.g. "approve", "reject")
 * @param {Object} params - Action parameters payload
 */
function dispatchAction(hostEl, action, params) {
  hostEl.dispatchEvent(
    new CustomEvent('jr-action', {
      bubbles: true,
      composed: true,
      detail: { action, params: params || {} },
    })
  );
}

// ── Component render functions ────────────────────────────────
// Each function follows the same signature:
//   (Html, def, key, kids, hostEl) => HtmlTemplate
//
// - Html: hyper-element's tagged template function with .wire()
// - def: the element definition { type, props, children, on }
// - key: unique key for Html.wire() identity
// - kids: array of pre-rendered child DOM nodes
// - hostEl: host element for jr-action event dispatch

/**
 * Card — container with optional title, description, and body.
 * Props: title (string), description (string)
 * @param {Function} Html - Tagged template function with .wire()
 * @param {Object} def - Element definition { type, props, children, on }
 * @param {string} key - Unique key for Html.wire() identity
 * @param {Array} kids - Pre-rendered child DOM nodes
 * @returns {Object} Html wire template result
 */
function renderCard(Html, def, key, kids) {
  return Html.wire(def, ':' + key)`
    <div class="jr-card">
      ${def.props?.title ? Html.wire(def, ':t')`<div class="jr-card-title">${def.props.title}</div>` : ''}
      ${def.props?.description ? Html.wire(def, ':d')`<div class="jr-card-desc">${def.props.description}</div>` : ''}
      <div class="jr-card-body">${kids}</div>
    </div>`;
}

/**
 * Row — horizontal flex container with configurable gap.
 * Props: gap (number, pixels)
 * @param {Function} Html - Tagged template function with .wire()
 * @param {Object} def - Element definition { type, props, children, on }
 * @param {string} key - Unique key for Html.wire() identity
 * @param {Array} kids - Pre-rendered child DOM nodes
 * @returns {Object} Html wire template result
 */
function renderRow(Html, def, key, kids) {
  return Html.wire(def, ':' + key)`
    <div class="jr-row" style="${def.props?.gap ? `gap:${def.props.gap}px` : ''}">${kids}</div>`;
}

/**
 * Column — vertical flex container with configurable gap.
 * Props: gap (number, pixels)
 * @param {Function} Html - Tagged template function with .wire()
 * @param {Object} def - Element definition { type, props, children, on }
 * @param {string} key - Unique key for Html.wire() identity
 * @param {Array} kids - Pre-rendered child DOM nodes
 * @returns {Object} Html wire template result
 */
function renderColumn(Html, def, key, kids) {
  return Html.wire(def, ':' + key)`
    <div class="jr-column" style="${def.props?.gap ? `gap:${def.props.gap}px` : ''}">${kids}</div>`;
}

/**
 * Button — clickable action trigger with variant styling.
 * Props: label (string), variant (string), disabled (boolean), loading (boolean)
 * Events: on.press → { action, params } dispatched as jr-action
 * @param {Function} Html - Tagged template function with .wire()
 * @param {Object} def - Element definition { type, props, children, on }
 * @param {string} key - Unique key for Html.wire() identity
 * @param {Array} kids - Pre-rendered child DOM nodes
 * @param {HTMLElement} hostEl - Host element for event dispatch
 * @returns {Object} Html wire template result
 */
function renderButton(Html, def, key, kids, hostEl) {
  const variant = def.props?.variant || '';
  const label = def.props?.label || 'Button';
  const disabled = def.props?.disabled || false;
  const loading = def.props?.loading || false;
  const actionData = def.on?.press || {};

  // Build CSS class list — loading adds spinner via CSS ::after pseudo-element
  const classes = `jr-btn ${variant} ${loading ? 'loading' : ''}`.trim();

  return Html.wire(def, ':' + key)`
    <button class="${classes}"
      disabled=${disabled || loading}
      onclick=${() =>
        dispatchAction(hostEl, actionData.action || 'press', actionData.params)}
    >${label}</button>`;
}

/**
 * Text — styled text block with variant support.
 * Props: content (string), variant (string: muted, bold, heading)
 * @param {Function} Html - Tagged template function with .wire()
 * @param {Object} def - Element definition { type, props, children, on }
 * @param {string} key - Unique key for Html.wire() identity
 * @returns {Object} Html wire template result
 */
function renderText(Html, def, key) {
  return Html.wire(def, ':' + key)`
    <div class="${`jr-text ${def.props?.variant || ''}`.trim()}">${def.props?.content || ''}</div>`;
}

/**
 * Alert — notification banner with variant-specific icon and color.
 * Props: variant (string: info, success, warning, error), message (string)
 * @param {Function} Html - Tagged template function with .wire()
 * @param {Object} def - Element definition { type, props, children, on }
 * @param {string} key - Unique key for Html.wire() identity
 * @returns {Object} Html wire template result
 */
function renderAlert(Html, def, key) {
  // Icon prefix per variant for quick visual identification
  const icons = { info: 'ℹ️ ', success: '✅ ', warning: '⚠️ ', error: '❌ ' };
  const variant = def.props?.variant || 'info';
  const icon = icons[variant] || '';
  return Html.wire(def, ':' + key)`
    <div class="${`jr-alert ${variant}`}">${icon}${def.props?.message || ''}</div>`;
}

/**
 * Progress — horizontal progress bar with label and percentage.
 * Props: label (string), value (number 0-100)
 * @param {Function} Html - Tagged template function with .wire()
 * @param {Object} def - Element definition { type, props, children, on }
 * @param {string} key - Unique key for Html.wire() identity
 * @returns {Object} Html wire template result
 */
function renderProgress(Html, def, key) {
  // Clamp value to 0–100 range for visual correctness
  const val = Math.min(100, Math.max(0, parseInt(def.props?.value || '0', 10)));
  return Html.wire(def, ':' + key)`
    <div>
      ${def.props?.label ? Html.wire(def, ':pl')`<div class="jr-progress-label">${def.props.label} — ${val}%</div>` : ''}
      <div class="jr-progress-bar"><div class="jr-progress-fill" style="width:${val}%"></div></div>
    </div>`;
}

/**
 * Divider — horizontal rule separator.
 * @param {Function} Html - Tagged template function with .wire()
 * @param {Object} def - Element definition { type, props, children, on }
 * @param {string} key - Unique key for Html.wire() identity
 * @returns {Object} Html wire template result
 */
function renderDivider(Html, def, key) {
  return Html.wire(def, ':' + key)`<div class="jr-divider"></div>`;
}

/**
 * CodeBlock — syntax-highlighted code display with language label,
 * copy-to-clipboard button, and optional line numbers.
 * Props: language (string), code (string), showLineNumbers (boolean)
 * @param {Function} Html - Tagged template function with .wire()
 * @param {Object} def - Element definition { type, props, children, on }
 * @param {string} key - Unique key for Html.wire() identity
 * @returns {Object} Html wire template result
 */
function renderCodeBlock(Html, def, key) {
  const code = def.props?.code || '';
  const showLines = def.props?.showLineNumbers || false;

  // Build line number gutter when showLineNumbers is enabled.
  // Each line gets a numbered <span> for alignment with the code.
  const lines = code.split('\n');
  const lineGutter = showLines
    ? Html.wire(def, ':lg')`<div class="jr-codeblock-lines">${lines
        .map((_, i) => `${i + 1}`)
        .join('\n')}</div>`
    : '';

  return Html.wire(def, ':' + key)`
    <div class="jr-codeblock">
      <div class="jr-codeblock-header">
        <span>${def.props?.language || 'code'}</span>
        <button class="jr-codeblock-copy" onclick=${(e) => {
          // Copy code to clipboard. navigator.clipboard requires
          // secure context (localhost or HTTPS) — gracefully no-op
          // if unavailable. Brief visual feedback via button text.
          const btn = e.currentTarget;
          navigator.clipboard
            .writeText(code)
            .then(() => {
              btn.textContent = 'Copied!';
              setTimeout(() => {
                btn.textContent = 'Copy';
              }, 1500);
            })
            .catch(() => {
              btn.textContent = 'Failed';
              setTimeout(() => {
                btn.textContent = 'Copy';
              }, 1500);
            });
        }}>Copy</button>
      </div>
      <div class="${showLines ? 'jr-codeblock-body with-lines' : 'jr-codeblock-body'}">
        ${lineGutter}
        <pre><code>${code}</code></pre>
      </div>
    </div>`;
}

/**
 * Image — responsive image with optional dimension constraints.
 * Props: src (string), alt (string), width (number), height (number)
 * @param {Function} Html - Tagged template function with .wire()
 * @param {Object} def - Element definition { type, props, children, on }
 * @param {string} key - Unique key for Html.wire() identity
 * @returns {Object} Html wire template result
 */
function renderImage(Html, def, key) {
  // Support optional width/height constraints via inline style
  const style = [
    def.props?.width ? `max-width:${def.props.width}px` : '',
    def.props?.height ? `max-height:${def.props.height}px` : '',
  ]
    .filter(Boolean)
    .join(';');
  return Html.wire(def, ':' + key)`
    <img class="jr-image" src="${def.props?.src || ''}" alt="${def.props?.alt || ''}" style="${style}" />`;
}

/**
 * Checklist — vertical list of checkbox items with toggle events.
 * Props: label (string), items (Array<{ label: string, checked: boolean }>)
 * Events: checkbox change → jr-action with { index, checked, label }
 * @param {Function} Html - Tagged template function with .wire()
 * @param {Object} def - Element definition { type, props, children, on }
 * @param {string} key - Unique key for Html.wire() identity
 * @param {Array} kids - Pre-rendered child DOM nodes
 * @param {HTMLElement} hostEl - Host element for event dispatch
 * @returns {Object} Html wire template result
 */
function renderChecklist(Html, def, key, kids, hostEl) {
  const items = def.props?.items || [];
  // Compute completion count for the progress counter label
  const doneCount = items.filter((it) => it.checked).length;

  return Html.wire(def, ':' + key)`
    <div class="jr-checklist">
      ${def.props?.label ? Html.wire(def, ':cl')`<div class="jr-checklist-label">${def.props.label}</div>` : ''}
      ${items.map(
        (item, i) =>
          Html.wire(
            item,
            ':ci' + i
          )`<label class="jr-checklist-item ${item.checked ? 'checked' : ''}">
          <input type="checkbox" checked=${item.checked}
            onchange=${(e) =>
              dispatchAction(hostEl, 'checklist_toggle', {
                index: i,
                checked: e.target.checked,
                label: item.label,
              })} /><span>${item.label}</span>
        </label>`
      )}
      ${items.length > 0 ? Html.wire(def, ':cc')`<div class="jr-checklist-counter">${doneCount}/${items.length} complete</div>` : ''}
    </div>`;
}

/**
 * TextField — text input with label, placeholder, and submit event.
 * Props: label (string), placeholder (string), maxLength (number)
 * Events: on.submit → jr-action with { value } on Enter key
 * @param {Function} Html - Tagged template function with .wire()
 * @param {Object} def - Element definition { type, props, children, on }
 * @param {string} key - Unique key for Html.wire() identity
 * @param {Array} kids - Pre-rendered child DOM nodes
 * @param {HTMLElement} hostEl - Host element for event dispatch
 * @returns {Object} Html wire template result
 */
function renderTextField(Html, def, key, kids, hostEl) {
  const submitData = def.on?.submit || {};
  const maxLen = def.props?.maxLength;

  return Html.wire(def, ':' + key)`
    <div>
      ${def.props?.label ? Html.wire(def, ':tl')`<div class="jr-text muted">${def.props.label}</div>` : ''}
      <input type="text" class="jr-textfield"
        placeholder="${def.props?.placeholder || ''}"
        maxlength=${maxLen || ''}
        onkeydown=${(e) => {
          if (e.key === 'Enter') {
            dispatchAction(hostEl, submitData.action || 'submit', {
              ...submitData.params,
              value: e.target.value,
            });
            // Clear input after submit for better UX
            e.target.value = '';
            // Reset the counter after clearing the input
            const counter = e.target.parentNode.querySelector(
              '.jr-textfield-counter'
            );
            if (counter) counter.textContent = '0/' + maxLen;
          }
        }}
        oninput=${
          maxLen
            ? (e) => {
                // Live-update the character counter. We target the sibling
                // span by class rather than holding a ref, because the DOM
                // is managed by hyper-element's template diffing and expando
                // refs would be wiped on re-render.
                const counter = e.target.parentNode.querySelector(
                  '.jr-textfield-counter'
                );
                if (counter)
                  counter.textContent = e.target.value.length + '/' + maxLen;
              }
            : null
        } />
      ${maxLen ? Html.wire(def, ':tc')`<span class="jr-textfield-counter">0/${maxLen}</span>` : ''}
    </div>`;
}

/**
 * Registry of all built-in component types.
 *
 * Each entry maps a type name to an object with:
 *   - render: the component render function (defined above)
 *   - catalog: structured metadata (imported from catalog.js)
 *
 * @type {Map<string, { render: Function, catalog: Object }>}
 */
import { CATALOG } from './catalog-metadata.js';

/**
 * Pair a render function with its catalog entry from the CATALOG map.
 * @param {string} name - Component type name (must exist in CATALOG)
 * @param {Function} renderFn - Render function for this component
 * @returns {[string, { render: Function, catalog: Object }]} Map entry tuple
 */
const entry = (name, renderFn) => [
  name,
  { render: renderFn, catalog: CATALOG[name] },
];

export const BUILT_IN_COMPONENTS = new Map([
  entry('Card', renderCard),
  entry('Row', renderRow),
  entry('Column', renderColumn),
  entry('Button', renderButton),
  entry('Text', renderText),
  entry('Alert', renderAlert),
  entry('Progress', renderProgress),
  entry('Divider', renderDivider),
  entry('CodeBlock', renderCodeBlock),
  entry('Image', renderImage),
  entry('Checklist', renderChecklist),
  entry('TextField', renderTextField),
]);
