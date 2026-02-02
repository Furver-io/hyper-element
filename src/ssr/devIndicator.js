/**
 * @file SSR development mode indicator.
 * Shows visual feedback when SSR event capture is active.
 */

let indicatorElement = null;

/**
 * Shows a visual indicator that SSR capture is active.
 * Only used when devMode is enabled.
 */
function showDevIndicator() {
  if (indicatorElement) return;

  indicatorElement = document.createElement('div');
  indicatorElement.id = 'hyper-element-ssr-indicator';
  indicatorElement.innerHTML = 'SSR Capture Active';
  indicatorElement.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #ff9800;
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    font-family: sans-serif;
    font-size: 12px;
    font-weight: bold;
    z-index: 999999;
    pointer-events: none;
  `;

  if (document.body) {
    document.body.appendChild(indicatorElement);
  } else {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        document.body.appendChild(indicatorElement);
      },
      { once: true }
    );
  }
}

/**
 * Hides the SSR capture indicator.
 */
function hideDevIndicator() {
  if (indicatorElement) {
    indicatorElement.remove();
    indicatorElement = null;
  }
}

export { showDevIndicator, hideDevIndicator };
