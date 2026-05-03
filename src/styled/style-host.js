/**
 * @file Renderer-owned style host registry for generated +styled CSS.
 * A render root gets one managed `<style>` element that is marked, swept, and
 * updated once per render cycle so removed styled nodes cannot leave stale CSS.
 */

import { escapeCssForStyleTag } from './serializer.js';

const roots = new WeakMap();

/**
 * Gets or creates the style registry associated with a component instance.
 *
 * @param {HTMLElement} instance - Owning hyper-element instance.
 * @returns {{styleElement: HTMLStyleElement|null, activeRules: Map<string,string>, pendingRules: Map<string,string>}}
 */
export function getStyleRootRegistry(instance) {
  let registry = roots.get(instance);
  if (!registry) {
    registry = {
      styleElement: null,
      activeRules: new Map(),
      pendingRules: new Map(),
    };
    roots.set(instance, registry);
  }
  return registry;
}

/**
 * Starts a render-cycle mark phase for generated CSS. Handlers register only
 * the rules seen during this render; commit then sweeps anything absent.
 *
 * @param {HTMLElement} instance - Owning hyper-element instance.
 */
export function beginStyleRender(instance) {
  getStyleRootRegistry(instance).pendingRules.clear();
}

/**
 * Registers generated CSS rules produced by a styled artifact.
 *
 * @param {HTMLElement} instance - Owning hyper-element instance.
 * @param {Array<{id: string, cssText: string}>} rules - Generated rules.
 */
export function registerStyleRules(instance, rules) {
  if (!instance || !rules || rules.length === 0) return;
  const registry = getStyleRootRegistry(instance);
  for (const rule of rules) {
    registry.pendingRules.set(rule.id, rule.cssText);
  }
}

/**
 * Finds the renderer-owned style element in a root. SSR hydration may already
 * have produced the host, so browser render reuses it rather than appending a
 * duplicate.
 *
 * @param {HTMLElement} instance - Owning hyper-element instance/root.
 * @returns {HTMLStyleElement|null} Existing host or null.
 */
function findExistingStyleElement(instance) {
  return instance.querySelector(
    `:scope > style[data-hyper-styled-root="${instance.localName}"]`
  );
}

/**
 * Commits the render-cycle sweep. The style host is appended after user-authored
 * render output so it does not split adjacent siblings or land inside a styled
 * element.
 *
 * @param {HTMLElement} instance - Owning hyper-element instance/root.
 */
export function commitStyleRender(instance) {
  if (!instance) return;
  const registry = getStyleRootRegistry(instance);
  registry.activeRules = new Map(registry.pendingRules);

  if (registry.activeRules.size === 0) {
    registry.styleElement?.remove();
    registry.styleElement = null;
    return;
  }

  if (!registry.styleElement || !registry.styleElement.isConnected) {
    registry.styleElement = findExistingStyleElement(instance);
  }
  if (!registry.styleElement) {
    registry.styleElement = document.createElement('style');
    registry.styleElement.setAttribute(
      'data-hyper-styled-root',
      instance.localName
    );
  }

  const cssText = Array.from(registry.activeRules.values()).join('\n\n');
  if (registry.styleElement.textContent !== cssText) {
    registry.styleElement.textContent = cssText;
  }
  if (registry.styleElement.parentNode !== instance) {
    instance.appendChild(registry.styleElement);
  } else if (instance.lastChild !== registry.styleElement) {
    instance.appendChild(registry.styleElement);
  }
}

/**
 * Removes the style host and registry when a component disconnects.
 *
 * @param {HTMLElement} instance - Owning hyper-element instance/root.
 */
export function cleanupStyleRoot(instance) {
  const registry = roots.get(instance);
  registry?.styleElement?.remove();
  roots.delete(instance);
}

/**
 * Creates an SSR style host string for the current root rules. SSR owns only a
 * single string append point, but uses the same escaped rule text as the browser
 * host textContent.
 *
 * @param {string} rootName - Custom element tag name.
 * @param {Array<{id: string, cssText: string}>} rules - Generated rules.
 * @param {string|null} [nonce=null] - Optional CSP nonce.
 * @returns {string} Style host HTML or empty string.
 */
export function createSSRStyleHost(rootName, rules, nonce = null) {
  if (!rules || rules.length === 0) return '';
  const attr = nonce ? ` nonce="${String(nonce)}"` : '';
  const cssText = rules.map((rule) => rule.cssText).join('\n\n');
  return `<style data-hyper-styled-root="${rootName}"${attr}>${escapeCssForStyleTag(cssText)}</style>`;
}
