/**
 * hyper-element - hyperHTML + WebComponents
 * A lightweight library for creating custom elements with hyperHTML templating.
 */

/**
 * Tagged template literal function for rendering HTML content.
 * Use as a tagged template: Html`<div>${value}</div>`
 *
 * Supports auto-wire syntax for efficient list rendering:
 * ```javascript
 * Html`<ul>{+each ${users}}<li>{name}</li>{-each}</ul>`;
 * ```
 *
 * This is equivalent to:
 * ```javascript
 * Html`<ul>${users.map(u => Html.wire(u, id)`<li>${u.name}</li>`)}</ul>`;
 * ```
 *
 * Syntax:
 * - `{+each ${array}}...{-each}` - Loop with auto-wire for DOM reuse
 * - `{name}` - Access item property
 * - `{address.city}` - Nested property access
 * - `{...}` or `{ ... }` - Current item value (formatted: primitives escaped, arrays join(","), objects JSON, functions called)
 * - `{@}` - Current array index (0-based)
 * - `{+each {items}}...{-each}` - Nested loop using parent's property
 */
export interface HtmlFunction {
  /**
   * Render HTML content using tagged template literals
   */
  (strings: TemplateStringsArray, ...values: any[]): any;

  /**
   * Create a wired template bound to an object for efficient re-rendering
   * @param obj - Object to bind the template to
   * @param id - Optional template identifier
   */
  wire(
    obj: object,
    id?: string
  ): (strings: TemplateStringsArray, ...values: any[]) => any;

  /**
   * Create a lightweight template without wire binding
   */
  lite(strings: TemplateStringsArray, ...values: any[]): any;

  /**
   * Mark a string as safe HTML that should not be escaped.
   * Use with caution - only for trusted HTML content.
   * @param html - The HTML string to mark as safe
   */
  raw(html: string): { value: string };

  /**
   * Template function available when template attribute is used on the element
   */
  template?: (data: Record<string, any>) => any;
}

/**
 * Context object available as `this` in render() and setup() methods
 */
export interface ElementContext {
  /** The DOM element */
  element: HTMLElement;
  /** Parsed attributes from the element with automatic type coercion */
  attrs: Record<string, any>;
  /** Dataset proxy with automatic type coercion */
  dataset: Record<string, any>;
  /** Store value from setup */
  store?: any;
  /** Text content of element */
  wrappedContent: string;
}

/**
 * Result object returned from fragment methods (methods starting with capital letter)
 */
export interface FragmentResult {
  /** Rendered content */
  any?: any;
  /** Render only once */
  once?: boolean;
  /** Template string or promise resolving to template */
  template?:
    | string
    | Promise<
        string | { template: string; values: Record<string, any> | any[] }
      >;
  /** Template values */
  values?: Record<string, any> | any[];
  /** Text content */
  text?: string;
  /** HTML content */
  html?: string;
  /** Placeholder content */
  placeholder?: any;
}

/**
 * Callback for store updates in setup.
 * Call this with a store value or getter function to enable reactive updates.
 */
export type OnNextCallback = (
  store: any | (() => any)
) => (...data: any[]) => void;

/**
 * Render function for functional components.
 * Receives Html template function, context, and optional store data.
 */
export type RenderFunction = (
  Html: HtmlFunction,
  ctx: ElementContext,
  ...data: any[]
) => void;

/**
 * Setup function for functional components.
 * Receives context and onNext callback.
 * @returns Optional teardown function.
 */
export type SetupFunction = (
  ctx: ElementContext,
  onNext: OnNextCallback
) => void | (() => void);

/**
 * Method function for functional components.
 * Context is passed as first argument.
 */
export type MethodFunction = (ctx: ElementContext, ...args: any[]) => any;

/**
 * SSR hydration lifecycle hook for functional components.
 * Called before buffered events are replayed.
 */
export type OnBeforeHydrateFunction = (
  ctx: ElementContext,
  events: BufferedEvent[]
) => BufferedEvent[];

/**
 * SSR hydration lifecycle hook for functional components.
 * Called after event replay completes.
 */
export type OnAfterHydrateFunction = (ctx: ElementContext) => void;

/**
 * Functional component definition object.
 * Note: observedAttributes is not needed - all attributes are automatically reactive via MutationObserver.
 */
export interface FunctionalDefinition {
  /** Setup lifecycle function */
  setup?: SetupFunction;
  /** Render function (required) */
  render: RenderFunction;
  /** SSR hydration hook - filter events before replay */
  onBeforeHydrate?: OnBeforeHydrateFunction;
  /** SSR hydration hook - called after replay completes */
  onAfterHydrate?: OnAfterHydrateFunction;
  /** Additional methods */
  [key: string]:
    | SetupFunction
    | RenderFunction
    | OnBeforeHydrateFunction
    | OnAfterHydrateFunction
    | MethodFunction
    | undefined;
}

/**
 * Interface for the hyperElement function/class.
 * Can be used as a class base or called as a factory function.
 */
export interface HyperElementFactory {
  /**
   * Create and register a custom element with a definition object.
   * @param tagName - Custom element tag name (must contain a hyphen)
   * @param definition - Component definition object
   * @returns The generated class
   */
  (tagName: string, definition: FunctionalDefinition): typeof hyperElement;

  /**
   * Create and register a custom element with a render function.
   * @param tagName - Custom element tag name (must contain a hyphen)
   * @param render - Render function
   * @returns The generated class
   */
  (tagName: string, render: RenderFunction): typeof hyperElement;

  /**
   * Create a custom element class without registering.
   * @param definition - Component definition object
   * @returns The generated class (call customElements.define to register)
   */
  (definition: FunctionalDefinition): typeof hyperElement;

  /**
   * Create a custom element class without registering.
   * @param render - Render function
   * @returns The generated class (call customElements.define to register)
   */
  (render: RenderFunction): typeof hyperElement;

  /** Prototype for class inheritance */
  prototype: hyperElement;

  /** Configure SSR hydration settings */
  configureSSR(options: SSRConfig): void;
}

/**
 * Base class for creating custom elements with hyperHTML templating.
 * Extend this class and implement the render() method to create a custom element.
 *
 * Can also be called as a factory function:
 * - `hyperElement('tag-name', { render: ... })` - with auto-registration
 * - `hyperElement({ render: ... })` - returns class for manual registration
 *
 * @example
 * ```javascript
 * // Class-based usage
 * class MyElement extends hyperElement {
 *   render(Html) {
 *     Html`<div>Hello ${this.attrs.name}!</div>`;
 *   }
 * }
 * customElements.define('my-element', MyElement);
 *
 * // Functional usage with auto-registration
 * hyperElement('my-element', {
 *   render: (Html, ctx) => Html`<div>Hello ${ctx.attrs.name}!</div>`
 * });
 *
 * // Functional shorthand
 * hyperElement('simple-elem', (Html, ctx) => Html`<div>Simple</div>`);
 * ```
 */
export class hyperElement extends HTMLElement {
  /** Unique identifier for this element instance */
  identifier: symbol;

  /** Parsed attributes from the element with automatic type coercion */
  attrs: Record<string, any>;

  /** Store value from setup */
  store?: any;

  /** Dataset proxy with automatic type coercion */
  dataset: Record<string, any>;

  /** Text content of element */
  wrappedContent: string;

  /** Reference to the DOM element */
  element: HTMLElement;

  /** Get the innerHTML of the shadow/element content */
  get innerShadow(): string;

  /**
   * Optional setup lifecycle method. Called once when the element is connected.
   * Use this to set up stores, subscriptions, or other initialization logic.
   *
   * @param onNext - Call this with a store value or getter to enable reactive updates
   * @returns Optional teardown function called when element is disconnected
   *
   * @example
   * ```javascript
   * setup(onNext) {
   *   const store = createStore({ count: 0 });
   *   onNext(store.getState);
   *   return store.subscribe(() => this.render());
   * }
   * ```
   */
  setup?(onNext: OnNextCallback): void | (() => void);

  /**
   * Required render lifecycle method. Called on every render cycle.
   * Use the Html template tag to render content to the element.
   *
   * @param Html - Tagged template literal function for rendering
   * @param data - Additional data passed from store updates
   *
   * @example
   * ```javascript
   * render(Html) {
   *   Html`<div>Hello ${this.attrs.name}!</div>`;
   * }
   * ```
   */
  render(Html: HtmlFunction, ...data: any[]): void;

  /**
   * SSR hydration lifecycle hook. Called before buffered events are replayed.
   * Override to filter or modify events before replay.
   *
   * @param events - Buffered events captured during SSR
   * @returns Filtered events to replay
   *
   * @example
   * ```javascript
   * onBeforeHydrate(events) {
   *   return events.filter(e => e.type !== 'focus');
   * }
   * ```
   */
  onBeforeHydrate?(events: BufferedEvent[]): BufferedEvent[];

  /**
   * SSR hydration lifecycle hook. Called after event replay completes.
   * Override to perform post-hydration setup.
   *
   * @example
   * ```javascript
   * onAfterHydrate() {
   *   console.log('Component hydrated');
   * }
   * ```
   */
  onAfterHydrate?(): void;
}

/**
 * The exported hyperElement is typed as an intersection:
 * - HyperElementFactory: callable function signatures
 * - typeof HyperElementBase: class for extension
 */
type HyperElementType = HyperElementFactory &
  (new () => hyperElement) & { prototype: hyperElement };

declare const hyperElement: HyperElementType;

declare global {
  interface Window {
    hyperElement: HyperElementType;
    hyperHTML: any;
  }
}

export { hyperElement };
export default hyperElement;

// ============================================================================
// Signals API - Fine-grained reactivity primitives
// ============================================================================

/**
 * A reactive signal that holds a value and notifies subscribers when it changes.
 */
export interface Signal<T> {
  /** Get or set the current value. Reading tracks dependencies. */
  value: T;
  /** Read the current value without tracking dependencies. */
  peek(): T;
  /** Subscribe to value changes. Returns an unsubscribe function. */
  subscribe(fn: () => void): () => void;
}

/**
 * A computed signal that derives its value from other signals.
 */
export interface Computed<T> {
  /** Get the computed value. Automatically tracks dependencies and recomputes when they change. */
  readonly value: T;
  /** Read the computed value without tracking dependencies. */
  peek(): T;
}

/**
 * Creates a reactive signal.
 * @param initialValue - The initial value of the signal
 * @returns A signal object with value getter/setter, peek(), and subscribe()
 *
 * @example
 * ```javascript
 * const count = signal(0);
 * count.value; // 0
 * count.value = 1; // Updates and notifies subscribers
 * count.peek(); // Read without tracking
 * ```
 */
export function signal<T>(initialValue: T): Signal<T>;

/**
 * Creates a computed signal that derives from other signals.
 * The computation is lazy and cached until dependencies change.
 * @param fn - Computation function that reads other signals
 * @returns A computed signal object with value getter and peek()
 *
 * @example
 * ```javascript
 * const count = signal(0);
 * const doubled = computed(() => count.value * 2);
 * doubled.value; // 0
 * count.value = 5;
 * doubled.value; // 10
 * ```
 */
export function computed<T>(fn: () => T): Computed<T>;

/**
 * Creates an effect that runs when its dependencies change.
 * The effect runs immediately and re-runs whenever any signal it reads changes.
 * @param fn - Effect function. Can return a cleanup function.
 * @returns Cleanup function to stop the effect
 *
 * @example
 * ```javascript
 * const count = signal(0);
 * const cleanup = effect(() => {
 *   console.log('Count:', count.value);
 *   return () => console.log('Cleanup');
 * });
 * // Logs: "Count: 0"
 * count.value = 1;
 * // Logs: "Cleanup", then "Count: 1"
 * cleanup(); // Stop the effect
 * ```
 */
export function effect(fn: () => void | (() => void)): () => void;

/**
 * Batches multiple signal updates into a single notification.
 * Effects are deferred until the batch completes.
 * @param fn - Function containing signal updates
 *
 * @example
 * ```javascript
 * const a = signal(0);
 * const b = signal(0);
 * batch(() => {
 *   a.value = 1;
 *   b.value = 2;
 * }); // Effects run once after both updates
 * ```
 */
export function batch(fn: () => void): void;

/**
 * Runs a function without tracking signal dependencies.
 * Useful for reading signals without creating subscriptions.
 * @param fn - Function to run untracked
 * @returns The return value of fn
 *
 * @example
 * ```javascript
 * const count = signal(0);
 * effect(() => {
 *   const val = untracked(() => count.value);
 *   // This effect won't re-run when count changes
 * });
 * ```
 */
export function untracked<T>(fn: () => T): T;

// ============================================================================
// SSR Hydration API
// ============================================================================

/**
 * Buffered event captured during SSR hydration.
 */
export interface BufferedEvent {
  /** Event type (e.g., 'click', 'input') */
  type: string;
  /** Path from custom element to target (e.g., "DIV:0/BUTTON:1") */
  targetPath: string;
  /** Timestamp when event was captured */
  timestamp: number;
  /** Event-specific details */
  detail: Record<string, any>;
}

/**
 * SSR configuration options.
 */
export interface SSRConfig {
  /** Event types to capture during SSR hydration (default: all interactive events) */
  events?: string[];
  /** Show visual indicator in development mode (default: false) */
  devMode?: boolean;
}

/**
 * Configure SSR hydration settings.
 * Call this before any custom elements are defined to customize behavior.
 *
 * @param options - Configuration options
 *
 * @example
 * ```javascript
 * // Enable dev mode indicator
 * hyperElement.configureSSR({ devMode: true });
 *
 * // Customize captured events
 * hyperElement.configureSSR({
 *   events: ['click', 'input', 'submit'],
 *   devMode: true
 * });
 * ```
 */
export function configureSSR(options: SSRConfig): void;

// ============================================================================
// SSR String Rendering API (Node.js/Server-side)
// ============================================================================

/**
 * Options for renderElement function.
 */
export interface RenderElementOptions<T = any> {
  /** Attributes to pass to the component */
  attrs?: Record<string, unknown>;
  /** Store data for render context */
  store?: T;
  /** Wrap content in Declarative Shadow DOM template (default: false) */
  shadowDOM?: boolean;
  /** Fragment functions for the component */
  fragments?: Record<string, (data: any) => any>;
  /** Render function (Html, ctx) => void */
  render: (Html: HtmlFunction, ctx: ElementContext) => void;
}

/**
 * Renders a component definition to an HTML string.
 * Use this in Node.js/Deno/Bun for server-side rendering.
 *
 * @param tagName - Custom element tag name (e.g., 'my-component')
 * @param options - Render options
 * @returns Promise resolving to HTML string
 *
 * @example
 * ```javascript
 * const { renderElement } = require('hyper-element/ssr/server');
 *
 * const html = await renderElement('my-greeting', {
 *   attrs: { name: 'World' },
 *   render: (Html, ctx) => Html`<div>Hello ${ctx.attrs.name}!</div>`
 * });
 * // Returns: '<my-greeting name="World"><div>Hello World!</div></my-greeting>'
 *
 * // With Declarative Shadow DOM
 * const shadowHtml = await renderElement('my-greeting', {
 *   attrs: { name: 'World' },
 *   shadowDOM: true,
 *   render: (Html, ctx) => Html`<div>Hello ${ctx.attrs.name}!</div>`
 * });
 * // Returns: '<my-greeting name="World"><template shadowrootmode="open"><div>Hello World!</div></template></my-greeting>'
 * ```
 */
export function renderElement<T = any>(
  tagName: string,
  options: RenderElementOptions<T>
): Promise<string>;

/**
 * Renders multiple elements in parallel.
 * Useful for batch SSR rendering.
 *
 * @param elements - Array of elements to render
 * @returns Promise resolving to array of HTML strings
 */
export function renderElements(
  elements: Array<{ tagName: string; options: RenderElementOptions }>
): Promise<string[]>;

/**
 * Creates a reusable component renderer.
 * Useful for rendering the same component multiple times with different data.
 *
 * @param tagName - Custom element tag name
 * @param render - Render function
 * @param baseOptions - Base options merged with each render
 * @returns Renderer function
 */
export function createRenderer<T = any>(
  tagName: string,
  render: (Html: HtmlFunction, ctx: ElementContext) => void,
  baseOptions?: Partial<RenderElementOptions<T>>
): (attrs?: Record<string, unknown>, store?: T) => Promise<string>;

/**
 * Renders a tagged template literal to an HTML string.
 * Lower-level API for direct template rendering.
 *
 * @param template - Template strings array
 * @param values - Interpolated values
 * @param xml - SVG/XML mode (default: false)
 * @returns HTML string
 */
export function renderToString(
  template: TemplateStringsArray,
  values: unknown[],
  xml?: boolean
): string;

/**
 * Creates an SSR Html tagged template function.
 * Use this for custom SSR rendering scenarios.
 *
 * @param context - Render context with attrs, store, fragments
 * @returns Html function with wire, raw, lite methods
 */
export function createSSRHtml(context?: {
  attrs?: Record<string, unknown>;
  store?: any;
  fragments?: Record<string, (data: any) => any>;
}): HtmlFunction;

/**
 * SSR HTML tagged template function.
 * Renders directly to string without any component wrapper.
 */
export const ssrHtml: (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => string;

/**
 * Escapes HTML special characters to prevent XSS.
 * @param str - String to escape
 * @returns Escaped string
 */
export function escapeHtml(str: string): string;

/**
 * Marks a string as safe HTML that should not be escaped.
 * @param html - HTML string to mark as safe
 * @returns Safe HTML object
 */
export function safeHtml(html: string): { value: string };
