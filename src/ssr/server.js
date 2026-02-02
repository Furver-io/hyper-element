/**
 * @file SSR Server Entry Point.
 * Server-side string rendering without browser dependencies.
 * Use this in Node.js/Deno/Bun for HTML generation.
 *
 * @example
 * // Node.js usage
 * const { renderElement, renderToString, createSSRHtml } = require('hyper-element/ssr/server');
 *
 * const html = await renderElement('my-component', {
 *   attrs: { name: 'World' },
 *   render: (Html, ctx) => Html`<div>Hello ${ctx.attrs.name}!</div>`
 * });
 */

// Core rendering
export { renderToString, ssrHtml, createSSRTemplate } from './string-render.js';

// Html factory
export { createSSRHtml } from './ssr-html.js';

// Component rendering
export {
  renderElement,
  renderElements,
  createRenderer,
} from './render-element.js';

// Utilities (re-exported for convenience)
export { escapeHtml, safeHtml } from '../utils/escape.js';
