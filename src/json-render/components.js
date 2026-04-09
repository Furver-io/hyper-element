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
 */
function renderRow(Html, def, key, kids) {
  return Html.wire(def, ':' + key)`
    <div class="jr-row" style="${def.props?.gap ? `gap:${def.props.gap}px` : ''}">${kids}</div>`;
}

/**
 * Column — vertical flex container with configurable gap.
 * Props: gap (number, pixels)
 */
function renderColumn(Html, def, key, kids) {
  return Html.wire(def, ':' + key)`
    <div class="jr-column" style="${def.props?.gap ? `gap:${def.props.gap}px` : ''}">${kids}</div>`;
}

/**
 * Button — clickable action trigger with variant styling.
 * Props: label (string), variant (string), disabled (boolean), loading (boolean)
 * Events: on.press → { action, params } dispatched as jr-action
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
        dispatchAction(
          hostEl,
          actionData.action || 'press',
          actionData.params
        )}
    >${label}</button>`;
}

/**
 * Text — styled text block with variant support.
 * Props: content (string), variant (string: muted, bold, heading)
 */
function renderText(Html, def, key) {
  return Html.wire(def, ':' + key)`
    <div class="${`jr-text ${def.props?.variant || ''}`.trim()}">${def.props?.content || ''}</div>`;
}

/**
 * Alert — notification banner with variant-specific icon and color.
 * Props: variant (string: info, success, warning, error), message (string)
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
 */
function renderDivider(Html, def, key) {
  return Html.wire(def, ':' + key)`<div class="jr-divider"></div>`;
}

/**
 * CodeBlock — syntax-highlighted code display with language label.
 * Props: language (string), code (string)
 */
function renderCodeBlock(Html, def, key) {
  return Html.wire(def, ':' + key)`
    <div class="jr-codeblock">
      <div class="jr-codeblock-header"><span>${def.props?.language || 'code'}</span></div>
      <pre><code>${def.props?.code || ''}</code></pre>
    </div>`;
}

/**
 * Image — responsive image with optional dimension constraints.
 * Props: src (string), alt (string), width (number), height (number)
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
 */
function renderChecklist(Html, def, key, kids, hostEl) {
  return Html.wire(def, ':' + key)`
    <div class="jr-checklist">
      ${def.props?.label ? Html.wire(def, ':cl')`<div class="jr-checklist-label">${def.props.label}</div>` : ''}
      ${(def.props?.items || []).map((item, i) =>
        Html.wire(item, ':ci' + i)`<label class="jr-checklist-item ${item.checked ? 'checked' : ''}">
          <input type="checkbox" checked=${item.checked}
            onchange=${(e) =>
              dispatchAction(hostEl, 'checklist_toggle', {
                index: i,
                checked: e.target.checked,
                label: item.label,
              })} /><span>${item.label}</span>
        </label>`
      )}
    </div>`;
}

/**
 * TextField — text input with label, placeholder, and submit event.
 * Props: label (string), placeholder (string), maxLength (number)
 * Events: on.submit → jr-action with { value } on Enter key
 */
function renderTextField(Html, def, key, kids, hostEl) {
  const submitData = def.on?.submit || {};
  return Html.wire(def, ':' + key)`
    <div>
      ${def.props?.label ? Html.wire(def, ':tl')`<div class="jr-text muted">${def.props.label}</div>` : ''}
      <input type="text" class="jr-textfield"
        placeholder="${def.props?.placeholder || ''}"
        maxlength=${def.props?.maxLength || ''}
        onkeydown=${(e) => {
          if (e.key === 'Enter') {
            dispatchAction(hostEl, submitData.action || 'submit', {
              ...submitData.params,
              value: e.target.value,
            });
            // Clear input after submit for better UX
            e.target.value = '';
          }
        }} />
    </div>`;
}

/**
 * Registry of all built-in component types.
 * Maps type name (string) → render function.
 *
 * @type {Map<string, Function>}
 */
export const BUILT_IN_COMPONENTS = new Map([
  ['Card', renderCard],
  ['Row', renderRow],
  ['Column', renderColumn],
  ['Button', renderButton],
  ['Text', renderText],
  ['Alert', renderAlert],
  ['Progress', renderProgress],
  ['Divider', renderDivider],
  ['CodeBlock', renderCodeBlock],
  ['Image', renderImage],
  ['Checklist', renderChecklist],
  ['TextField', renderTextField],
]);
