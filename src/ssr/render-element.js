/**
 * @file SSR renderElement function.
 * Renders a component definition to an HTML string.
 */

import { createSSRHtml } from './ssr-html.js';
import { escapeHtml } from '../utils/escape.js';
import { createSSRStyleHost } from '../styled/style-host.js';

/**
 * Serializes attributes to an HTML attribute string.
 * @param {Object} attrs - Attributes object
 * @returns {string} Attribute string like ' name="value" other="val"'
 */
function serializeAttributes(attrs) {
  if (!attrs || typeof attrs !== 'object') return '';
  return Object.entries(attrs)
    .filter(([, value]) => value != null && typeof value !== 'function')
    .map(([name, value]) => {
      if (typeof value === 'boolean') {
        return value ? ` ${name}` : '';
      }
      if (typeof value === 'object') {
        // Skip objects (can't serialize to attribute)
        return '';
      }
      return ` ${name}="${escapeHtml(String(value))}"`;
    })
    .join('');
}

/**
 * Renders a component definition to an HTML string.
 *
 * @param {string} tagName - Custom element tag name (e.g., 'my-component')
 * @param {Object} options - Render options
 * @param {Object} [options.attrs={}] - Attributes to pass to the component
 * @param {any} [options.store] - Store data for render context
 * @param {boolean} [options.shadowDOM=false] - Wrap in Declarative Shadow DOM template
 * @param {Object} [options.fragments] - Fragment functions for the component
 * @param {Function} options.render - Render function (Html, ctx) => void
 * @returns {Promise<string>} HTML string
 *
 * @example
 * const html = await renderElement('my-greeting', {
 *   attrs: { name: 'World' },
 *   render: (Html, ctx) => Html`<div>Hello ${ctx.attrs.name}!</div>`
 * });
 * // Returns: '<my-greeting name="World"><div>Hello World!</div></my-greeting>'
 */
export async function renderElement(tagName, options = {}) {
  const {
    attrs = {},
    store,
    shadowDOM = false,
    fragments = {},
    render,
    styled,
    colors,
  } = options;

  if (typeof render !== 'function') {
    throw new Error('renderElement requires a render function');
  }

  // Build context object (mirrors browser context)
  const context = {
    attrs,
    store,
    fragments,
    // Styled system support
    styled,
    colors,
    // Element-like properties for compatibility
    tagName: tagName.toUpperCase(),
    localName: tagName.toLowerCase(),
    __styledRules: new Map(),
  };

  // Create SSR Html function with context
  const Html = createSSRHtml(context);

  // Collect rendered content
  let content = '';

  /**
   * Capturing Html wrapper that stores render result.
   * @param {...any} args - Tagged template arguments
   * @returns {string|Promise<string>} HTML result
   */
  const capturingHtml = (...args) => {
    const result = Html(...args);
    content = result;
    return result;
  };

  // Copy methods from Html
  capturingHtml.wire = Html.wire;
  capturingHtml.raw = Html.raw;
  capturingHtml.lite = Html.lite;
  capturingHtml._context = Html._context;

  // Call the render function
  const renderResult = render(capturingHtml, context);

  // Handle async render functions
  if (renderResult && typeof renderResult.then === 'function') {
    await renderResult;
  }

  // Handle async Html result (from async fragments)
  if (content && typeof content.then === 'function') {
    content = await content;
  }

  // Serialize component tag attributes
  const attrString = serializeAttributes(attrs);

  // Build final HTML
  const styleHost = createSSRStyleHost(
    tagName,
    Array.from(context.__styledRules.values())
  );
  if (shadowDOM) {
    // Declarative Shadow DOM format
    return `<${tagName}${attrString}><template shadowrootmode="open">${content}${styleHost}</template></${tagName}>`;
  }

  return `<${tagName}${attrString}>${content}${styleHost}</${tagName}>`;
}

/**
 * Renders multiple elements in parallel.
 * Useful for batch SSR rendering.
 *
 * @param {Array<{tagName: string, options: Object}>} elements - Elements to render
 * @returns {Promise<string[]>} Array of HTML strings
 */
export async function renderElements(elements) {
  return Promise.all(
    elements.map(({ tagName, options }) => renderElement(tagName, options))
  );
}

/**
 * Creates a reusable component renderer.
 * Useful for rendering the same component multiple times with different data.
 *
 * @param {string} tagName - Custom element tag name
 * @param {Function} render - Render function
 * @param {Object} [baseOptions={}] - Base options merged with each render
 * @returns {Function} Renderer function (attrs, store?) => Promise<string>
 */
export function createRenderer(tagName, render, baseOptions = {}) {
  return async (attrs = {}, store) => {
    return renderElement(tagName, {
      ...baseOptions,
      attrs: { ...baseOptions.attrs, ...attrs },
      store: store ?? baseOptions.store,
      render,
    });
  };
}
