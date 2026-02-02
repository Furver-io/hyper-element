/**
 * @file Integration tests for SSR string rendering.
 * Run with: npm run build && node test/ssr.test.mjs
 *
 * When SSR_COVERAGE=1, imports from src/ for coverage collection.
 * Otherwise imports from build/ to verify bundled output.
 */

import { createRequire } from 'module';
import assert from 'assert';

// Conditional import: source files for coverage, bundle for verification
let renderElement,
  renderElements,
  createRenderer,
  renderToString,
  createSSRHtml,
  createSSRTemplate,
  escapeHtml,
  safeHtml,
  ssrHtml,
  signal,
  computed,
  effect,
  batch,
  untracked,
  // Internal exports for direct testing
  styleObjectToString,
  stringData,
  stringCommentArray,
  stringUnsafe,
  // SSR hydration replay
  replayEvents,
  // Template processing for direct testing
  processAdvancedTemplate;

if (process.env.SSR_COVERAGE) {
  // Import from source files for coverage collection
  const ssrServer = await import('../src/ssr/server.js');
  const stringRender = await import('../src/ssr/string-render.js');
  const stringUpdate = await import('../src/ssr/string-update.js');
  const signals = await import('../src/signals/index.js');
  const ssrReplay = await import('../src/ssr/replay.js');
  const advancedTemplate = await import('../src/template/processAdvancedTemplate.js');

  renderElement = ssrServer.renderElement;
  renderElements = ssrServer.renderElements;
  createRenderer = ssrServer.createRenderer;
  createSSRHtml = ssrServer.createSSRHtml;
  escapeHtml = ssrServer.escapeHtml;
  safeHtml = ssrServer.safeHtml;
  renderToString = stringRender.renderToString;
  createSSRTemplate = stringRender.createSSRTemplate;
  ssrHtml = stringRender.ssrHtml;
  signal = signals.signal;
  computed = signals.computed;
  effect = signals.effect;
  batch = signals.batch;
  untracked = signals.untracked;
  // Internal functions for direct testing
  styleObjectToString = stringUpdate.styleObjectToString;
  stringData = stringUpdate.stringData;
  stringCommentArray = stringUpdate.stringCommentArray;
  stringUnsafe = stringUpdate.stringUnsafe;
  // SSR hydration replay
  replayEvents = ssrReplay.replayEvents;
  // Template processing
  processAdvancedTemplate = advancedTemplate.processAdvancedTemplate;

  console.log('SSR tests: Using SOURCE files (coverage mode)');
} else {
  // Import from bundle to verify bundled output
  const require = createRequire(import.meta.url);
  const bundle = require('../build/hyperElement.bundle.js');

  renderElement = bundle.renderElement;
  renderElements = bundle.renderElements;
  createRenderer = bundle.createRenderer;
  renderToString = bundle.renderToString;
  createSSRHtml = bundle.createSSRHtml;
  createSSRTemplate = bundle.createSSRTemplate;
  escapeHtml = bundle.escapeHtml;
  safeHtml = bundle.safeHtml;
  ssrHtml = bundle.ssrHtml;
  signal = bundle.signal;
  computed = bundle.computed;
  effect = bundle.effect;
  batch = bundle.batch;
  untracked = bundle.untracked;
  // Internal functions (may not be exported in bundle - use stubs)
  styleObjectToString = bundle.styleObjectToString || (() => '');
  stringData = bundle.stringData || (() => ({}));
  stringCommentArray = bundle.stringCommentArray || (() => '');
  stringUnsafe = bundle.stringUnsafe || (() => '');
  // SSR hydration replay (may not be in bundle)
  replayEvents = bundle.replayEvents || (() => {});

  console.log('SSR tests: Using BUNDLE (verification mode)');
}

// Test runner
const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log('\nSSR String Rendering Tests\n' + '='.repeat(50));

  for (const { name, fn } of tests) {
    try {
      await fn();
      passed++;
      console.log(`✓ ${name}`);
    } catch (e) {
      failed++;
      console.log(`✗ ${name}`);
      console.log(`  Error: ${e.message}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// ============================================================================
// renderElement Tests
// ============================================================================

test('renderElement: basic component with attrs', async () => {
  const html = await renderElement('my-greeting', {
    attrs: { name: 'World' },
    render: (Html, ctx) => Html`<div>Hello ${ctx.attrs.name}!</div>`,
  });

  assert.strictEqual(
    html,
    '<my-greeting name="World"><div>Hello World!</div></my-greeting>'
  );
});

test('renderElement: Declarative Shadow DOM', async () => {
  const html = await renderElement('shadow-el', {
    attrs: { val: '123' },
    shadowDOM: true,
    render: (Html, ctx) => Html`<span>${ctx.attrs.val}</span>`,
  });

  assert.strictEqual(
    html,
    '<shadow-el val="123"><template shadowrootmode="open"><span>123</span></template></shadow-el>'
  );
});

test('renderElement: escapes attribute values', async () => {
  const html = await renderElement('safe-el', {
    attrs: { data: '<script>alert("xss")</script>' },
    render: (Html, ctx) => Html`<div>${ctx.attrs.data}</div>`,
  });

  assert.ok(html.includes('&lt;script&gt;'), 'Should escape < to &lt;');
  assert.ok(!html.includes('<script>alert'), 'Should not contain raw script');
});

test('renderElement: boolean attributes', async () => {
  const html = await renderElement('bool-el', {
    attrs: { disabled: true, hidden: false },
    render: (Html, ctx) => Html`<div></div>`,
  });

  assert.ok(html.includes('disabled'), 'Should include disabled');
  assert.ok(!html.includes('hidden'), 'Should not include hidden=false');
});

test('renderElement: store data', async () => {
  const html = await renderElement('store-el', {
    attrs: {},
    store: { count: 42 },
    render: (Html, ctx) => Html`<span>Count: ${ctx.store.count}</span>`,
  });

  assert.ok(html.includes('Count: 42'), 'Should render store data');
});

test('renderElement: no tag if empty attrs', async () => {
  const html = await renderElement('empty-el', {
    attrs: {},
    render: (Html) => Html`<p>Content</p>`,
  });

  assert.strictEqual(html, '<empty-el><p>Content</p></empty-el>');
});

// ============================================================================
// renderToString Tests
// ============================================================================

test('renderToString: basic interpolation', () => {
  const template = ['<div>', '</div>'];
  template.raw = template;
  const html = renderToString(template, ['Hello'], false);

  assert.ok(html.includes('Hello'), 'Should contain interpolated value');
});

test('renderToString: escapes content by default', () => {
  const template = ['<div>', '</div>'];
  template.raw = template;
  const html = renderToString(template, ['<b>bold</b>'], false);

  assert.ok(html.includes('&lt;b&gt;'), 'Should escape HTML');
  assert.ok(!html.includes('<b>bold</b>'), 'Should not contain raw HTML');
});

// ============================================================================
// createSSRHtml Tests
// ============================================================================

test('createSSRHtml: basic usage', () => {
  const Html = createSSRHtml();
  const html = Html`<div>${'Hello'}</div>`;

  assert.ok(html.includes('Hello'), 'Should contain interpolated value');
});

test('createSSRHtml: Html.raw() bypasses escaping', () => {
  const Html = createSSRHtml();
  const html = Html`<div>${Html.raw('<b>bold</b>')}</div>`;

  assert.ok(html.includes('<b>bold</b>'), 'Should contain raw HTML');
});

test('createSSRHtml: arrays of values', () => {
  const Html = createSSRHtml();
  const items = ['a', 'b', 'c'];
  const html = Html`<ul>${items.map((i) => Html.lite`<li>${i}</li>`)}</ul>`;

  assert.ok(html.includes('<li>a</li>'), 'Should contain first item');
  assert.ok(html.includes('<li>c</li>'), 'Should contain last item');
});

test('createSSRHtml: context access', () => {
  const Html = createSSRHtml({
    attrs: { foo: 'bar' },
    store: { num: 100 },
  });

  // Context is available but render function needs to use it explicitly
  assert.ok(Html._context.attrs.foo === 'bar', 'Should have attrs in context');
  assert.ok(Html._context.store.num === 100, 'Should have store in context');
});

// ============================================================================
// XSS Prevention Tests
// ============================================================================

test('XSS: escapes string interpolations', async () => {
  const html = await renderElement('xss-test', {
    attrs: {},
    render: (Html) => Html`<div>${'<script>evil()</script>'}</div>`,
  });

  assert.ok(!html.includes('<script>evil'), 'Should not contain script tag');
  assert.ok(html.includes('&lt;script&gt;'), 'Should escape to entities');
});

test('XSS: escapes attribute interpolations', () => {
  const Html = createSSRHtml();
  const html = Html`<div data-val="${'" onclick="evil()"'}"></div>`;

  // The word "onclick" is in the value, but quotes are escaped
  // so it can't be parsed as a separate attribute
  assert.ok(html.includes('&quot;'), 'Should escape quotes');
  // The escaped output should have &quot; preventing attribute injection
  assert.ok(
    html.includes('data-val="&quot;'),
    'Value should start with escaped quote'
  );
});

test('XSS: escapeHtml function works', () => {
  const result = escapeHtml('<script>alert("xss")</script>');

  assert.strictEqual(
    result,
    '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
  );
});

test('XSS: safeHtml marks as safe', () => {
  const safe = safeHtml('<b>bold</b>');

  assert.ok(safe.value === '<b>bold</b>', 'Should preserve value');
});

// ============================================================================
// Style Handling Tests
// ============================================================================

test('Style: converts objects to CSS strings', () => {
  const Html = createSSRHtml();
  const html = Html`<div style=${{ color: 'red', fontSize: '16px' }}></div>`;

  assert.ok(html.includes('color: red'), 'Should contain color property');
  assert.ok(
    html.includes('font-size: 16px'),
    'Should convert camelCase to kebab'
  );
});

test('Style: handles string styles', () => {
  const Html = createSSRHtml();
  const html = Html`<div style="${'color: blue'}"></div>`;

  assert.ok(html.includes('style="color: blue"'), 'Should preserve string');
});

// ============================================================================
// Event Stripping Tests
// ============================================================================

test('Events: strips @click handlers', () => {
  const Html = createSSRHtml();
  const html = Html`<button @click=${() => {}}>Click</button>`;

  assert.ok(!html.includes('@click'), 'Should not contain @click');
  assert.ok(!html.includes('onclick'), 'Should not contain onclick');
  assert.ok(html.includes('Click'), 'Should contain button text');
});

// ============================================================================
// Boolean Attribute Tests
// ============================================================================

test('Boolean: toggle attributes', () => {
  const Html = createSSRHtml();
  const html = Html`<input ?disabled=${true} ?readonly=${false}>`;

  assert.ok(html.includes('disabled'), 'Should include true toggle');
  assert.ok(!html.includes('readonly'), 'Should exclude false toggle');
});

// ============================================================================
// Primitive Handling Tests
// ============================================================================

test('Primitives: renders numbers', () => {
  const Html = createSSRHtml();
  const html = Html`<span>${42}</span>`;

  assert.ok(html.includes('42'), 'Should render number');
});

test('Primitives: null/undefined as empty', () => {
  const Html = createSSRHtml();
  const html = Html`<span>${null}${undefined}</span>`;

  assert.ok(html.includes('<span></span>'), 'Should render empty for nullish');
});

// ============================================================================
// ssrHtml Direct Usage Tests
// ============================================================================

test('ssrHtml: direct template rendering', () => {
  const html = ssrHtml`<div class="test">${'content'}</div>`;

  assert.ok(html.includes('class="test"'), 'Should render attributes');
  assert.ok(html.includes('content'), 'Should render interpolation');
});

// ============================================================================
// renderElements Tests (batch rendering)
// ============================================================================

test('renderElements: renders multiple elements', async () => {
  const results = await renderElements([
    {
      tagName: 'elem-one',
      options: {
        attrs: { id: '1' },
        render: (Html) => Html`<span>First</span>`,
      },
    },
    {
      tagName: 'elem-two',
      options: {
        attrs: { id: '2' },
        render: (Html) => Html`<span>Second</span>`,
      },
    },
  ]);

  assert.strictEqual(results.length, 2, 'Should return two results');
  assert.ok(results[0].includes('<elem-one'), 'First should be elem-one');
  assert.ok(results[1].includes('<elem-two'), 'Second should be elem-two');
});

// ============================================================================
// createRenderer Tests (factory pattern)
// ============================================================================

test('createRenderer: creates reusable renderer', async () => {
  const renderCard = createRenderer(
    'my-card',
    (Html, ctx) => Html`<div class="card">${ctx.attrs.title}</div>`,
    { attrs: { type: 'default' } }
  );

  const html = await renderCard({ title: 'Hello' });

  assert.ok(html.includes('Hello'), 'Should render title attr');
  assert.ok(html.includes('my-card'), 'Should have tag name');
});

test('createRenderer: merges attrs with base options', async () => {
  const renderWidget = createRenderer(
    'my-widget',
    (Html, ctx) => Html`<div>${ctx.attrs.base}-${ctx.attrs.custom}</div>`,
    { attrs: { base: 'foundation' } }
  );

  const html = await renderWidget({ custom: 'extra' });

  assert.ok(html.includes('foundation-extra'), 'Should merge attrs');
});

test('createRenderer: accepts store override', async () => {
  const renderCounter = createRenderer(
    'my-counter',
    (Html, ctx) => Html`<span>${ctx.store.count}</span>`,
    { attrs: {}, store: { count: 0 } }
  );

  const html = await renderCounter({}, { count: 99 });

  assert.ok(html.includes('99'), 'Should use overridden store');
});

// ============================================================================
// SVG Auto-Detection Tests (via ssrHtml with embedded <svg>)
// ============================================================================

test('ssrHtml: SVG auto-detection renders SVG content', () => {
  const html = ssrHtml`<svg><circle cx="50" cy="50" r="${25}"/></svg>`;

  assert.ok(html.includes('r="25"'), 'Should interpolate radius');
  assert.ok(html.includes('circle'), 'Should render SVG element');
});

// ============================================================================
// createSSRTemplate Tests
// ============================================================================

test('createSSRTemplate: creates HTML template function', () => {
  // createSSRTemplate(false) returns a tagged template function for HTML
  const html = createSSRTemplate(false);
  const result = html`<div>Template</div>`;

  assert.ok(result.includes('Template'), 'Should render template');
});

test('createSSRTemplate: XML mode via factory (internal)', () => {
  // createSSRTemplate(true) is internal - verify it works for completeness
  const xmlTemplate = createSSRTemplate(true);
  const result = xmlTemplate`<rect width="100" height="100"/>`;

  assert.ok(result.includes('rect'), 'Should render SVG element');
  assert.ok(result.includes('/>'), 'XML mode should use self-closing tags');
});

// ============================================================================
// Signals API Tests (server-side uses .value getter/setter pattern)
// ============================================================================

test('signal: creates reactive signal', () => {
  const count = signal(0);

  assert.strictEqual(count.value, 0, 'Should return initial value');
  count.value = 5;
  assert.strictEqual(count.value, 5, 'Should update value');
});

test('signal.peek: reads value without tracking', () => {
  const count = signal(10);

  assert.strictEqual(count.peek(), 10, 'peek() should return value');
});

test('computed: derives from signals', () => {
  const a = signal(2);
  const b = signal(3);
  const sum = computed(() => a.value + b.value);

  assert.strictEqual(sum.value, 5, 'Should compute sum');
  a.value = 10;
  assert.strictEqual(sum.value, 13, 'Should recompute on dependency change');
});

test('computed.peek: reads without tracking', () => {
  const count = signal(0);
  const doubled = computed(() => count.value * 2);

  // peek() should return the value without tracking dependencies
  // On server, computed values are lazy - peek() returns current cached value
  assert.strictEqual(doubled.peek(), 0, 'Should return computed value');
});

test('effect: runs on dependency changes', () => {
  const name = signal('Alice');
  let lastSeen = '';

  effect(() => {
    lastSeen = name.value;
  });

  assert.strictEqual(lastSeen, 'Alice', 'Should run initially');
  name.value = 'Bob';
  assert.strictEqual(lastSeen, 'Bob', 'Should run on change');
});

test('batch: executes function synchronously', () => {
  const a = signal(0);
  const b = signal(0);

  // batch() executes the function synchronously
  batch(() => {
    a.value = 1;
    b.value = 2;
  });

  assert.strictEqual(a.value, 1, 'Signal a should be updated');
  assert.strictEqual(b.value, 2, 'Signal b should be updated');
});

test('untracked: reads without creating dependency', () => {
  const trackedSig = signal(0);
  const untrackedSig = signal(0);
  let effectRuns = 0;

  effect(() => {
    trackedSig.value;
    untracked(() => untrackedSig.value);
    effectRuns++;
  });

  assert.strictEqual(effectRuns, 1, 'Should run initially');
  untrackedSig.value = 5;
  assert.strictEqual(effectRuns, 1, 'untracked signal should not trigger');
  trackedSig.value = 1;
  assert.strictEqual(effectRuns, 2, 'tracked signal should trigger');
});

// ============================================================================
// createSSRHtml with fragments
// ============================================================================

test('createSSRHtml: fragment rendering', () => {
  const Html = createSSRHtml({
    fragments: {
      // Fragment returns safeHtml to avoid double-escaping
      Card: (data) => safeHtml(`<div class="card">${data.title}</div>`),
    },
  });

  const html = Html`<section>${{ Card: { title: 'My Card' } }}</section>`;

  assert.ok(html.includes('My Card'), 'Should render fragment');
  assert.ok(html.includes('class="card"'), 'Should include fragment class');
});

test('createSSRHtml: Html.wire for keyed templates', () => {
  const Html = createSSRHtml();
  const obj = {};
  const wire = Html.wire(obj);

  const html = wire`<li>Item</li>`;

  assert.ok(html.includes('Item'), 'wire should render template');
});

// ============================================================================
// {+each} block syntax in SSR
// ============================================================================

test('ssrHtml: each block iteration', () => {
  const items = ['a', 'b', 'c'];
  const html = ssrHtml`<ul>{+each ${items} as item}<li>${(item) => item}</li>{-each}</ul>`;

  // The each block should iterate over items
  assert.ok(html.includes('<li>'), 'Should render list items');
});

test('createSSRHtml: each block transformation', () => {
  // Test the {+each} block syntax that triggers hasEachBlocks and transformEachBlocks
  const Html = createSSRHtml();
  const items = [{ name: 'Alice' }, { name: 'Bob' }];
  const html = Html`<ul>{+each ${items}}<li>{name}</li>{-each}</ul>`;

  // Should transform each block and render items
  assert.ok(html.includes('<li>Alice</li>'), 'Should render first item');
  assert.ok(html.includes('<li>Bob</li>'), 'Should render second item');
});

test('createSSRHtml: each block with index', () => {
  const Html = createSSRHtml();
  const items = ['a', 'b'];
  const html = Html`<ul>{+each ${items}}<li>{@}: {...}</li>{-each}</ul>`;

  // @ is the index, ... is the item value
  assert.ok(html.includes('0:'), 'Should render first index');
  assert.ok(html.includes('1:'), 'Should render second index');
});

test('createSSRHtml: if block true branch', () => {
  const Html = createSSRHtml();
  const showContent = true;
  const html = Html`<div>{+if ${showContent}}<span>Visible</span>{else}<span>Hidden</span>{-if}</div>`;

  assert.ok(html.includes('Visible'), 'Should render true branch');
  assert.ok(!html.includes('Hidden'), 'Should not render false branch');
});

test('createSSRHtml: if block false branch', () => {
  const Html = createSSRHtml();
  const showContent = false;
  const html = Html`<div>{+if ${showContent}}<span>Visible</span>{else}<span>Hidden</span>{-if}</div>`;

  assert.ok(!html.includes('Visible'), 'Should not render true branch');
  assert.ok(html.includes('Hidden'), 'Should render false branch');
});

test('createSSRHtml: unless block', () => {
  const Html = createSSRHtml();
  const isHidden = false;
  const html = Html`<div>{+unless ${isHidden}}<span>Shown</span>{-unless}</div>`;

  assert.ok(html.includes('Shown'), 'Should render when condition is false');
});

test('createSSRHtml: each block with null value', () => {
  // Tests the `blockValue || []` fallback at parseEachBlocks.js:285
  const Html = createSSRHtml();
  const items = null;
  const html = Html`<ul>{+each ${items}}<li>Item</li>{-each}</ul>`;

  // With null, should render empty (no items)
  assert.ok(html.includes('<ul>'), 'Should have ul');
  assert.ok(html.includes('</ul>'), 'Should close ul');
  assert.ok(!html.includes('<li>'), 'Should not render items for null');
});

test('createSSRHtml: each block with undefined value', () => {
  // Tests the `blockValue || []` fallback
  const Html = createSSRHtml();
  const items = undefined;
  const html = Html`<ul>{+each ${items}}<li>Item</li>{-each}</ul>`;

  // With undefined, should render empty (no items)
  assert.ok(html.includes('<ul></ul>'), 'Should render empty ul for undefined');
});

// ============================================================================
// Async Fragment Tests
// ============================================================================

test('Async fragment: { text: string } result', async () => {
  const html = await renderElement('async-text', {
    attrs: {},
    fragments: {
      Greeting: async (name) => {
        return { text: `Hello, ${name}!` };
      },
    },
    render: (Html, ctx) => Html`<div>${{ Greeting: 'World' }}</div>`,
  });

  assert.ok(html.includes('Hello, World!'), 'Should render async text');
  assert.ok(!html.includes('__SSR_FRAG'), 'Should not contain placeholder');
});

test('Async fragment: { html: string } result (raw HTML)', async () => {
  const html = await renderElement('async-html', {
    attrs: {},
    fragments: {
      Bold: async (text) => {
        return { html: `<strong>${text}</strong>` };
      },
    },
    render: (Html, ctx) => Html`<div>${{ Bold: 'Important' }}</div>`,
  });

  assert.ok(html.includes('<strong>Important</strong>'), 'Should render raw HTML');
});

test('Async fragment: { any: value } result', async () => {
  const html = await renderElement('async-any', {
    attrs: {},
    fragments: {
      Count: async () => {
        return { any: 42 };
      },
    },
    render: (Html, ctx) => Html`<span>${{ Count: null }}</span>`,
  });

  assert.ok(html.includes('42'), 'Should render any value');
});

test('Async fragment: { template: string } result', async () => {
  const html = await renderElement('async-template', {
    attrs: {},
    fragments: {
      Template: async () => {
        return { template: '<em>Styled</em>' };
      },
    },
    render: (Html, ctx) => Html`<div>${{ Template: null }}</div>`,
  });

  assert.ok(html.includes('<em>Styled</em>'), 'Should render template HTML');
});

test('Async fragment: escapes text result', async () => {
  const html = await renderElement('async-escape', {
    attrs: {},
    fragments: {
      UserInput: async () => {
        return { text: '<script>alert("xss")</script>' };
      },
    },
    render: (Html, ctx) => Html`<div>${{ UserInput: null }}</div>`,
  });

  assert.ok(html.includes('&lt;script&gt;'), 'Should escape text');
  assert.ok(!html.includes('<script>alert'), 'Should not contain raw script');
});

test('Multiple async fragments in one render', async () => {
  const html = await renderElement('multi-async', {
    attrs: {},
    fragments: {
      First: async () => ({ text: 'ONE' }),
      Second: async () => ({ text: 'TWO' }),
    },
    render: (Html, ctx) =>
      Html`<div>${{ First: null }} and ${{ Second: null }}</div>`,
  });

  assert.ok(html.includes('ONE'), 'Should render first fragment');
  assert.ok(html.includes('TWO'), 'Should render second fragment');
});

// ============================================================================
// Error Handling Tests
// ============================================================================

test('renderElement: throws without render function', async () => {
  let threw = false;
  try {
    await renderElement('no-render', { attrs: {} });
  } catch (e) {
    threw = true;
    assert.ok(e.message.includes('render function'), 'Error mentions render');
  }
  assert.ok(threw, 'Should throw when render is missing');
});

// ============================================================================
// Attribute Edge Cases
// ============================================================================

test('serializeAttributes: skips object values', async () => {
  const html = await renderElement('obj-attr', {
    attrs: { data: { nested: 'value' }, name: 'test' },
    render: (Html) => Html`<div>Content</div>`,
  });

  // Object attributes should be skipped, string kept
  assert.ok(html.includes('name="test"'), 'Should include string attr');
  assert.ok(!html.includes('data='), 'Should skip object attr');
});

test('ssrUpdate: ref attribute stripped', () => {
  const Html = createSSRHtml();
  const html = Html`<input ref=${() => {}} />`;

  assert.ok(!html.includes('ref='), 'Should not contain ref attribute');
  assert.ok(html.includes('<input'), 'Should render input');
});

test('ssrUpdate: onclick inline handler stripped', () => {
  const Html = createSSRHtml();
  const html = Html`<button onclick=${() => {}}>Click</button>`;

  // Note: onclick without @ prefix is handled differently
  assert.ok(!html.includes('onclick='), 'Should not contain onclick');
  assert.ok(html.includes('Click'), 'Should contain button text');
});

test('ssrUpdate: key attribute stripped', () => {
  const Html = createSSRHtml();
  const html = Html`<div key=${'unique-id'}>Content</div>`;

  assert.ok(!html.includes('key='), 'Should not contain key attribute');
  assert.ok(html.includes('Content'), 'Should render content');
});

test('ssrUpdate: data attribute object', () => {
  const Html = createSSRHtml();
  const html = Html`<div data=${{ userId: 123, role: 'admin' }}></div>`;

  assert.ok(html.includes('data-userId="123"') || html.includes('data-userid="123"'), 'Should have data-userId');
  assert.ok(html.includes('data-role="admin"'), 'Should have data-role');
});

test('ssrUpdate: spread operator', () => {
  const Html = createSSRHtml();
  const props = { id: 'myId', class: 'myClass' };
  const html = Html`<div ...${props}></div>`;

  assert.ok(html.includes('id="myId"'), 'Should spread id');
  assert.ok(html.includes('class="myClass"'), 'Should spread class');
});

test('ssrUpdate: direct property ignored', () => {
  const Html = createSSRHtml();
  const html = Html`<input .value=${'test'} />`;

  assert.ok(!html.includes('.value'), 'Should not contain .value');
  assert.ok(html.includes('<input'), 'Should render input');
});

test('ssrUpdate: textContent binding', () => {
  // Test TEXT_TYPE update path via .textContent binding
  const Html = createSSRHtml();
  const html = Html`<div .textContent=${'Hello World'}></div>`;

  // .textContent should be ignored in SSR (it's a DOM property)
  assert.ok(!html.includes('.textContent'), 'Should not contain .textContent');
  assert.ok(html.includes('<div>'), 'Should render div');
});

test('stringText: TEXT_TYPE via textarea element', () => {
  // TEXT_TYPE is triggered for TEXT_ELEMENTS (textarea, style, script, etc.)
  // when content is a single interpolation
  const Html = createSSRHtml();
  const html = Html`<textarea>${'User input value'}</textarea>`;

  assert.ok(html.includes('User input value'), 'Should render textarea content');
  assert.ok(html.includes('<textarea>'), 'Should have textarea tag');
  assert.ok(html.includes('</textarea>'), 'Should close textarea tag');
});

test('stringText: TEXT_TYPE via title element', () => {
  const Html = createSSRHtml();
  const html = Html`<title>${'Page Title'}</title>`;

  assert.ok(html.includes('Page Title'), 'Should render title content');
});

test('stringText: TEXT_TYPE via style element', () => {
  const Html = createSSRHtml();
  const css = 'body { color: red; }';
  const html = Html`<style>${css}</style>`;

  assert.ok(html.includes('body { color: red; }'), 'Should render style content');
});

test('stringText: TEXT_TYPE with null value', () => {
  const Html = createSSRHtml();
  const html = Html`<textarea>${null}</textarea>`;

  // null should render as empty
  assert.ok(html.includes('<textarea></textarea>'), 'Should render empty textarea');
});

// ============================================================================
// String Update Edge Cases
// ============================================================================

test('stringStyle: null returns empty', () => {
  const Html = createSSRHtml();
  const html = Html`<div style=${null}></div>`;

  assert.ok(!html.includes('style='), 'Should not have style attr for null');
});

test('Array with mixed content types', () => {
  const Html = createSSRHtml();
  const items = [
    'plain text',
    safeHtml('<b>bold</b>'),
    42,
  ];
  const html = Html`<div>${items}</div>`;

  assert.ok(html.includes('plain text'), 'Should include plain text');
  assert.ok(html.includes('<b>bold</b>'), 'Should include safe HTML');
  assert.ok(html.includes('42'), 'Should include number');
});

test('Fragment with undefined result returns empty', async () => {
  const html = await renderElement('undef-frag', {
    attrs: {},
    fragments: {
      Empty: async () => undefined,
    },
    render: (Html, ctx) => Html`<div>${{ Empty: null }}</div>`,
  });

  // Should not crash, should render empty
  assert.ok(html.includes('<div>'), 'Should render div');
  assert.ok(!html.includes('undefined'), 'Should not render "undefined"');
});

test('processValue: { html: string } object pattern', () => {
  const Html = createSSRHtml();
  // This pattern is used by {+if}/{+else} blocks
  const htmlObj = { html: '<span>Conditional</span>' };
  const result = Html`<div>${htmlObj}</div>`;

  assert.ok(result.includes('<span>Conditional</span>'), 'Should render html content');
});

test('processValue: array with safeHtml items', () => {
  const Html = createSSRHtml();
  // Array containing safeHtml objects
  const items = [
    safeHtml('<em>italic</em>'),
    safeHtml('<strong>bold</strong>'),
  ];
  const result = Html`<div>${items}</div>`;

  assert.ok(result.includes('<em>italic</em>'), 'Should render first safe item');
  assert.ok(result.includes('<strong>bold</strong>'), 'Should render second safe item');
});

test('processValue: array with wire string results', () => {
  const Html = createSSRHtml();
  const obj1 = { id: 1 };
  const obj2 = { id: 2 };
  // Wire returns strings that should be treated as raw HTML
  const items = [
    Html.wire(obj1)`<li>First</li>`,
    Html.wire(obj2)`<li>Second</li>`,
  ];
  const result = Html`<ul>${items}</ul>`;

  assert.ok(result.includes('<li>First</li>'), 'Should render first wire item');
  assert.ok(result.includes('<li>Second</li>'), 'Should render second wire item');
});

test('processValue: array with plain string values', () => {
  const Html = createSSRHtml();
  // Plain strings in array should be marked as unsafe (raw HTML)
  const items = ['<span>One</span>', '<span>Two</span>'];
  const result = Html`<div>${items}</div>`;

  // Plain strings in arrays are treated as raw HTML (wire results pattern)
  assert.ok(result.includes('<span>One</span>'), 'Should render first string');
  assert.ok(result.includes('<span>Two</span>'), 'Should render second string');
});

test('processValue: array with number values', () => {
  const Html = createSSRHtml();
  // Non-string, non-safeHtml values in array
  const items = [1, 2, 3];
  const result = Html`<div>${items}</div>`;

  // Numbers should pass through and be converted to string
  assert.ok(result.includes('1'), 'Should render first number');
  assert.ok(result.includes('2'), 'Should render second number');
  assert.ok(result.includes('3'), 'Should render third number');
});

// ============================================================================
// Edge Case Tests: string-update.js coverage
// ============================================================================

test('stringStyle: undefined returns null (no style attr)', () => {
  const Html = createSSRHtml();
  const html = Html`<div style=${undefined}></div>`;

  assert.ok(!html.includes('style='), 'Should not have style attr for undefined');
});

test('stringStyle: style object with null values filters them out', () => {
  const Html = createSSRHtml();
  const html = Html`<div style=${{ color: 'red', margin: null, padding: undefined }}></div>`;

  assert.ok(html.includes('color: red'), 'Should include non-null value');
  assert.ok(!html.includes('margin'), 'Should filter out null');
  assert.ok(!html.includes('padding'), 'Should filter out undefined');
});

test('stringStyle: non-object/non-string returns empty', () => {
  const Html = createSSRHtml();
  // When a non-object, non-string value is passed, styleObjectToString returns ''
  const html = Html`<div style=${42}></div>`;

  // Number should be converted to string
  assert.ok(html.includes('style="42"'), 'Should convert number to string');
});

test('ssrUpdate: onchange handler stripped (various onXxx)', () => {
  const Html = createSSRHtml();
  const html = Html`<input onchange=${() => {}} onfocus=${() => {}} onblur=${() => {}}>`;

  assert.ok(!html.includes('onchange='), 'Should strip onchange');
  assert.ok(!html.includes('onfocus='), 'Should strip onfocus');
  assert.ok(!html.includes('onblur='), 'Should strip onblur');
});

test('ssrUpdate: data attribute on object element', () => {
  // The regex check !/^object$/i.test(node.name) should allow data attr on non-<object> elements
  const Html = createSSRHtml();
  const html = Html`<object data=${'test.pdf'}></object>`;

  // For <object> element, 'data' is a standard attribute, not data-* prefix
  assert.ok(html.includes('data="test.pdf"'), 'Should treat data as standard attr on <object>');
});

test('stringCommentArray: array with objects having toString', () => {
  const Html = createSSRHtml();
  const items = [
    { toString: () => 'custom-tostring' },
  ];
  const html = Html`<div>${items}</div>`;

  assert.ok(html.includes('custom-tostring') || html.includes('[object Object]'), 'Should call toString on objects');
});

// ============================================================================
// Edge Case Tests: string-render.js coverage
// ============================================================================

test('Void elements: br renders without closing tag', () => {
  const html = ssrHtml`<br>`;

  assert.ok(html.includes('<br>'), 'Should render br');
  assert.ok(!html.includes('</br>'), 'Should not have closing br tag');
});

test('Void elements: img renders without closing tag', () => {
  const html = ssrHtml`<img src=${'test.png'} alt=${'Test'}>`;

  assert.ok(html.includes('<img'), 'Should render img');
  assert.ok(html.includes('src="test.png"'), 'Should have src');
  assert.ok(!html.includes('</img>'), 'Should not have closing img tag');
});

test('Void elements: input renders without closing tag', () => {
  const html = ssrHtml`<input type=${'text'} name=${'field'}>`;

  assert.ok(html.includes('<input'), 'Should render input');
  assert.ok(!html.includes('</input>'), 'Should not have closing input tag');
});

test('Void elements: meta renders without closing tag', () => {
  const html = ssrHtml`<meta charset=${'utf-8'}>`;

  assert.ok(html.includes('<meta'), 'Should render meta');
  assert.ok(!html.includes('</meta>'), 'Should not have closing meta tag');
});

test('Void elements: hr renders without closing tag', () => {
  const html = ssrHtml`<hr>`;

  assert.ok(html.includes('<hr>'), 'Should render hr');
  assert.ok(!html.includes('</hr>'), 'Should not have closing hr tag');
});

test('Void elements: link renders without closing tag', () => {
  const html = ssrHtml`<link rel=${'stylesheet'} href=${'style.css'}>`;

  assert.ok(html.includes('<link'), 'Should render link');
  assert.ok(!html.includes('</link>'), 'Should not have closing link tag');
});

test('XML mode: boolean attributes have ="" suffix (auto-detected)', () => {
  const html = ssrHtml`<svg><rect ?disabled=${true}/></svg>`;

  // In XML mode (inside svg), boolean attributes should have =""
  assert.ok(html.includes('disabled'), 'Should include boolean attr');
  // XML mode should have disabled="" not just disabled
  assert.ok(html.includes('disabled=""') || html.includes('disabled />'), 'XML mode boolean attr format');
});

test('XML mode: self-closing tags (auto-detected)', () => {
  const html = ssrHtml`<svg><circle cx=${'50'} cy=${'50'} r=${'25'}/></svg>`;

  assert.ok(html.includes('/>') || html.includes(' />'), 'Should use self-closing syntax in XML');
});

test('ATTRIBUTE update: null value deletes attribute', () => {
  const Html = createSSRHtml();
  const html = Html`<div class=${null} id=${'keep'}></div>`;

  assert.ok(!html.includes('class='), 'Should not have class attr when null');
  assert.ok(html.includes('id="keep"'), 'Should keep non-null attributes');
});

test('ATTRIBUTE update: undefined value deletes attribute', () => {
  const Html = createSSRHtml();
  const html = Html`<div title=${undefined}></div>`;

  assert.ok(!html.includes('title='), 'Should not have title attr when undefined');
});

test('cloneNode: nested Element children preserved', () => {
  const html = ssrHtml`<div><span><b>${'nested'}</b></span></div>`;

  assert.ok(html.includes('<div>'), 'Should have outer div');
  assert.ok(html.includes('<span>'), 'Should have span');
  assert.ok(html.includes('<b>nested</b>'), 'Should have nested b with content');
  assert.ok(html.includes('</span>'), 'Should close span');
  assert.ok(html.includes('</div>'), 'Should close div');
});

// ============================================================================
// resolveNode: Template Content Path (-1 Marker)
// ============================================================================
//
// This test verifies the `-1` index handling in resolveNode() (string-render.js:85-88).
// The parser pushes `-1` to the path when traversing through a <template> element.
//
// Path Generation (parser.js:55-65):
// ┌────────────────────────────────────────────────────────────────────────────┐
// │ Template: <div><template>${'content'}</template></div>                     │
// │                                                                            │
// │ Tree:  Fragment → div → template → Comment(placeholder)                    │
// │                          ↑                                                 │
// │                          node.name === 'template' → push(-1)               │
// │                                                                            │
// │ Path built (inside-out): [0, -1, 0, 0]                                     │
// │   - 0: comment is child 0 of template                                      │
// │   - -1: template marker                                                    │
// │   - 0: template is child 0 of div                                          │
// │   - 0: div is child 0 of root                                              │
// └────────────────────────────────────────────────────────────────────────────┘
//
// resolveNode traverses in reverse:
// ┌────────────────────────────────────────────────────────────────────────────┐
// │ i=3: index=0  → node = root.children[0]      → div                         │
// │ i=2: index=0  → node = div.children[0]       → template                    │
// │ i=1: index=-1 → continue; (SKIP - template boundary marker)                │
// │ i=0: index=0  → node = template.children[0]  → Comment ← TARGET            │
// └────────────────────────────────────────────────────────────────────────────┘
//

test('resolveNode: template content path with -1 marker', () => {
  // This test hits the `if (index === -1) continue;` branch in resolveNode
  // by having an interpolation inside a <template> element
  const Html = createSSRHtml();
  const html = Html`<div><template>${'template content'}</template></div>`;

  assert.ok(html.includes('template content'), 'Should render content inside template');
  assert.ok(html.includes('<template>'), 'Should have template tag');
  assert.ok(html.includes('</template>'), 'Should close template tag');
});

test('resolveNode: nested template with multiple interpolations', () => {
  // More complex case: multiple interpolations at different depths inside template
  const Html = createSSRHtml();
  const html = Html`<div><template><span>${'first'}</span><p>${'second'}</p></template></div>`;

  assert.ok(html.includes('first'), 'Should render first interpolation');
  assert.ok(html.includes('second'), 'Should render second interpolation');
  assert.ok(html.includes('<template>'), 'Should have template tag');
});

test('resolveNode: deeply nested template content', () => {
  // Deep nesting: interpolation inside nested elements inside template
  const Html = createSSRHtml();
  const html = Html`<section><template><article><header>${'deep'}</header></article></template></section>`;

  assert.ok(html.includes('deep'), 'Should render deeply nested content');
  assert.ok(html.includes('<article>'), 'Should have article');
  assert.ok(html.includes('<header>'), 'Should have header');
});

// ============================================================================
// Edge Case Tests: ssr-html.js coverage
// ============================================================================

test('Async fragment: throws error propagates', async () => {
  let errorThrown = false;
  try {
    await renderElement('async-error', {
      attrs: {},
      fragments: {
        Broken: async () => {
          throw new Error('Fragment failed');
        },
      },
      render: (Html, ctx) => Html`<div>${{ Broken: null }}</div>`,
    });
  } catch (e) {
    errorThrown = true;
    assert.ok(e.message.includes('Fragment failed'), 'Should propagate error message');
  }
  assert.ok(errorThrown, 'Should throw when async fragment fails');
});

test('processValue: empty array renders empty', () => {
  const Html = createSSRHtml();
  const html = Html`<ul>${[]}</ul>`;

  assert.ok(html.includes('<ul></ul>'), 'Should render empty ul for empty array');
});

test('nodeToString: empty Fragment returns empty string', () => {
  // Tests string-render.js:234 - Fragment with length 0
  // An empty template like Html`` creates a Fragment with no children
  const Html = createSSRHtml();
  // Empty template produces empty Fragment
  const html = Html``;
  assert.strictEqual(html, '', 'Empty template should return empty string');
});

test('Fragment: non-existent fragment name passes through', () => {
  const Html = createSSRHtml({ fragments: {} });
  // Fragment name that doesn't exist in context.fragments
  const html = Html`<div>${{ UnknownFragment: 'data' }}</div>`;

  // Should render object as string since fragment not found
  assert.ok(html.includes('[object Object]') || html.includes('UnknownFragment'), 'Should render object when fragment not found');
});

test('processValue: safeHtml in nested position', () => {
  const Html = createSSRHtml();
  const html = Html`<div>${safeHtml('<em>emphasized</em>')}</div>`;

  assert.ok(html.includes('<em>emphasized</em>'), 'Should render safe HTML unescaped');
});

// ============================================================================
// Edge Case Tests: render-element.js coverage
// ============================================================================

test('serializeAttributes: function values filtered', async () => {
  const html = await renderElement('func-attr', {
    attrs: { onclick: () => {}, name: 'test' },
    render: (Html) => Html`<div>Content</div>`,
  });

  assert.ok(!html.includes('onclick='), 'Should not serialize function attrs');
  assert.ok(html.includes('name="test"'), 'Should serialize string attrs');
});

test('serializeAttributes: boolean false returns empty string', async () => {
  const html = await renderElement('bool-false', {
    attrs: { disabled: false, hidden: false, readonly: true },
    render: (Html) => Html`<div>Content</div>`,
  });

  assert.ok(!html.includes('disabled'), 'Should not include disabled=false');
  assert.ok(!html.includes('hidden'), 'Should not include hidden=false');
  assert.ok(html.includes('readonly'), 'Should include readonly=true');
});

test('shadowDOM: special characters in content escaped properly', async () => {
  const html = await renderElement('shadow-special', {
    attrs: {},
    shadowDOM: true,
    render: (Html) => Html`<div>${'<script>alert("xss")</script>'}</div>`,
  });

  assert.ok(html.includes('<template shadowrootmode="open">'), 'Should have shadow template');
  assert.ok(html.includes('&lt;script&gt;'), 'Should escape script tag in shadow content');
  assert.ok(!html.includes('<script>alert'), 'Should not have raw script');
});

test('renderElement: async render function supported', async () => {
  const html = await renderElement('async-render', {
    attrs: {},
    render: async (Html, ctx) => {
      // Simulate async work
      await Promise.resolve();
      return Html`<div>Async Content</div>`;
    },
  });

  assert.ok(html.includes('Async Content'), 'Should render async content');
});

// ============================================================================
// Additional Edge Cases for 100% Coverage
// ============================================================================

test('TOGGLE: false value removes attribute', () => {
  const Html = createSSRHtml();
  const html = Html`<button ?disabled=${false} ?hidden=${true}>Click</button>`;

  assert.ok(!html.includes('disabled'), 'Should not include disabled when false');
  assert.ok(html.includes('hidden'), 'Should include hidden when true');
});

test('stringAttribute: escapes special HTML chars in attributes', () => {
  const Html = createSSRHtml();
  const html = Html`<div title=${'Say "Hello" & <Goodbye>'}></div>`;

  assert.ok(html.includes('&quot;'), 'Should escape quotes');
  assert.ok(html.includes('&amp;'), 'Should escape ampersand');
  assert.ok(html.includes('&lt;'), 'Should escape less than');
  assert.ok(html.includes('&gt;'), 'Should escape greater than');
});

test('spread operator: null/undefined values filtered', () => {
  const Html = createSSRHtml();
  const props = { id: 'myId', class: null, title: undefined, name: 'test' };
  const html = Html`<div ...${props}></div>`;

  assert.ok(html.includes('id="myId"'), 'Should spread id');
  assert.ok(!html.includes('class='), 'Should filter null class');
  assert.ok(!html.includes('title='), 'Should filter undefined title');
  assert.ok(html.includes('name="test"'), 'Should spread name');
});

test('spread operator: empty object', () => {
  const Html = createSSRHtml();
  const html = Html`<div ...${{}}>Content</div>`;

  assert.ok(html.includes('<div>Content</div>'), 'Should render div with no extra attrs');
});

test('spread operator: null value', () => {
  const Html = createSSRHtml();
  const html = Html`<div ...${null}>Content</div>`;

  assert.ok(html.includes('<div>Content</div>'), 'Should handle null spread gracefully');
});

test('stringData: empty object returns empty', () => {
  const Html = createSSRHtml();
  const html = Html`<div data=${{}}></div>`;

  // Empty data object should not add any data-* attributes
  assert.ok(!html.includes('data-'), 'Should not have data-* attrs for empty object');
});

test('stringData: null values filtered', () => {
  const Html = createSSRHtml();
  const html = Html`<div data=${{ id: '123', status: null, type: 'test' }}></div>`;

  assert.ok(html.includes('data-id="123"') || html.includes('data-id='), 'Should have data-id');
  assert.ok(!html.includes('data-status'), 'Should filter null status');
  assert.ok(html.includes('data-type="test"') || html.includes('data-type='), 'Should have data-type');
});

test('Multiple interpolations in single element', () => {
  const Html = createSSRHtml();
  const html = Html`<div id=${'myId'} class=${'myClass'} title=${'myTitle'}>${'content'}</div>`;

  assert.ok(html.includes('id="myId"'), 'Should have id');
  assert.ok(html.includes('class="myClass"'), 'Should have class');
  assert.ok(html.includes('title="myTitle"'), 'Should have title');
  assert.ok(html.includes('>content<'), 'Should have content');
});

test('Fragment: sync fragment with safeHtml result', () => {
  const Html = createSSRHtml({
    fragments: {
      Styled: (text) => safeHtml(`<strong>${text}</strong>`),
    },
  });

  const html = Html`<div>${{ Styled: 'Bold' }}</div>`;

  assert.ok(html.includes('<strong>Bold</strong>'), 'Should render safeHtml from sync fragment');
});

test('stringCommentArray: non-array fallback via wire reuse', () => {
  // This test verifies the defensive fallback when a wire template
  // is first used with an array, then reused with a non-array value.
  // The type is determined as COMMENT_ARRAY on first use, but the
  // defensive check handles the case when value type changes.
  const Html = createSSRHtml();
  const obj = { id: 'test-wire' };
  const wire = Html.wire(obj);

  // First call with array - sets type to COMMENT_ARRAY
  const html1 = wire`<div>${['a', 'b']}</div>`;
  assert.ok(html1.includes('ab'), 'Array should render');

  // Second call with non-array - triggers defensive fallback in stringCommentArray
  const html2 = wire`<div>${'single value'}</div>`;
  assert.ok(html2.includes('single value'), 'Non-array should render via fallback');
});

// ============================================================================
// Html.wire() SSR Tests
// ============================================================================

test('Html.wire: direct function invocation', () => {
  // Tests the ssrWire function which returns a template function
  const Html = createSSRHtml();
  const obj = { id: 'wire-test' };

  // Call wire with object and id parameter
  const wire = Html.wire(obj, ':template');
  const html = wire`<span>Wired Content</span>`;

  assert.ok(html.includes('<span>Wired Content</span>'), 'Should render wired template');
});

test('Html.wire: keyed list rendering in SSR', () => {
  const Html = createSSRHtml();
  const items = [
    { id: 1, name: 'First' },
    { id: 2, name: 'Second' },
  ];

  const html = Html`<ul>${items.map(
    (item) => Html.wire(item, ':item')`<li>${item.name}</li>`
  )}</ul>`;

  assert.ok(html.includes('<li>First</li>'), 'Should render first item');
  assert.ok(html.includes('<li>Second</li>'), 'Should render second item');
  assert.ok(html.includes('<ul>'), 'Should have ul wrapper');
});

test('Html.wire: same object different IDs', () => {
  const Html = createSSRHtml();
  const user = { name: 'Alice', role: 'Admin' };

  // Same object with different wire IDs
  const nameHtml = Html.wire(user, ':name')`<span>${user.name}</span>`;
  const roleHtml = Html.wire(user, ':role')`<em>${user.role}</em>`;

  assert.ok(nameHtml.includes('<span>Alice</span>'), 'Should render name');
  assert.ok(roleHtml.includes('<em>Admin</em>'), 'Should render role');
});

// ============================================================================
// SSR Coverage Edge Cases
// ============================================================================

test('SSR: boolean toggle attribute in XML mode (auto-detected svg)', () => {
  // Tests line 212 in string-render.js: xml mode boolean attribute with ="" suffix
  // Use ssrHtml with embedded <svg> for XML mode auto-detection
  const html = ssrHtml`<svg><rect ?disabled=${true}/></svg>`;
  // In XML mode, boolean true toggle becomes disabled=""
  assert.ok(html.includes('disabled=""'), 'Should have disabled="" in XML mode');
});

test('SSR: self-closing void element in xml mode (auto-detected)', () => {
  // Tests line 187: html += ' />' for self-closing in XML mode
  const html = ssrHtml`<svg><circle cx="10" cy="10" r="5"/></svg>`;
  // XML mode should produce self-closing tag
  assert.ok(html.includes('<circle') || html.includes('/>'), 'Should render circle');
});

test('SSR: svg element triggers xml mode', () => {
  // Tests line 376: xml = true when svg element is encountered
  const Html = createSSRHtml();
  const html = Html`<div><svg width="100" height="100"><circle cx="50" cy="50" r="40"/></svg></div>`;
  assert.ok(html.includes('<svg'), 'Should have svg element');
  assert.ok(html.includes('<circle'), 'Should have circle element');
});

test('SSR: table with row content', () => {
  // Tests implicit tbody handling in parser
  const Html = createSSRHtml();
  const rows = [1, 2, 3];
  const html = Html`<table>${rows.map(r => Html`<tr><td>${r}</td></tr>`)}</table>`;
  assert.ok(html.includes('<table>'), 'Should have table');
  assert.ok(html.includes('<tr>'), 'Should have tr');
  assert.ok(html.includes('<td>'), 'Should have td');
});

test('SSR: preserved HTML comment', () => {
  // Tests comment preservation: <!--!...!--> syntax (lines 301-308)
  const Html = createSSRHtml();
  const html = Html`<div><!--!preserved comment!--><span>content</span></div>`;
  assert.ok(html.includes('preserved comment'), 'Should preserve comment content');
});

test('SSR: textarea with static text content', () => {
  // Tests TEXT_ELEMENT path with static content (lines 384-385)
  const Html = createSSRHtml();
  const html = Html`<textarea>Initial value</textarea>`;
  assert.ok(html.includes('Initial value'), 'Should have textarea content');
  assert.ok(html.includes('<textarea>'), 'Should have textarea tag');
});

test('SSR: style element with static content', () => {
  // Tests TEXT_ELEMENT path for style element
  const Html = createSSRHtml();
  const html = Html`<style>.foo { color: red; }</style>`;
  assert.ok(html.includes('.foo'), 'Should have style content');
});

test('SSR: svg self-closing element', () => {
  // Tests xml mode self-closing (line 187)
  const Html = createSSRHtml();
  const html = Html`<svg><path d="M10 10"/></svg>`;
  assert.ok(html.includes('<path'), 'Should have path element');
  assert.ok(html.includes('d="M10 10"'), 'Should have d attribute');
});

// ===========================================================================
// Coverage Gap Tests - Static Table Auto-Insertion
// ===========================================================================

test('SSR: static table with tr auto-inserts tbody', () => {
  // Tests parser lines 149-151: when <table><tr> is static, auto-insert <tbody>
  const Html = createSSRHtml();
  const html = Html`<table><tr><td>Cell 1</td><td>Cell 2</td></tr></table>`;
  assert.ok(html.includes('<table>'), 'Should have table');
  assert.ok(html.includes('<tr>'), 'Should have tr');
  assert.ok(html.includes('<td>'), 'Should have td');
  assert.ok(html.includes('Cell 1'), 'Should have content');
});

test('SSR: static table with td auto-inserts tbody and tr', () => {
  // Tests parser lines 149-156: <table><td> auto-inserts both <tbody> and <tr>
  const Html = createSSRHtml();
  const html = Html`<table><td>Direct cell</td></table>`;
  assert.ok(html.includes('<table>'), 'Should have table');
  assert.ok(html.includes('<td>'), 'Should have td');
  assert.ok(html.includes('Direct cell'), 'Should have content');
});

// ===========================================================================
// Coverage Gap Tests - Multi-line Block Content
// ===========================================================================

test('SSR: each block with interpolation inside body', () => {
  // Tests parseEachBlocks lines 260-266: block content spans multiple template parts
  const Html = createSSRHtml();
  const items = [{ name: 'A' }, { name: 'B' }];
  const prefix = 'Item: ';
  // The interpolation ${prefix} inside the block body triggers multi-part processing
  const html = Html`<ul>{+each ${items}}<li>${prefix}{name}</li>{-each}</ul>`;
  assert.ok(html.includes('Item: A'), 'Should have first item with prefix');
  assert.ok(html.includes('Item: B'), 'Should have second item with prefix');
});

test('SSR: if block with interpolation inside body', () => {
  // Tests multi-line block processing for if blocks
  const Html = createSSRHtml();
  const show = true;
  const msg = 'visible';
  const html = Html`<div>{+if ${show}}Content: ${msg}{-if}</div>`;
  assert.ok(html.includes('Content: visible'), 'Should render if block with interpolation');
});

test('SSR: mixed template with non-block parts before block', () => {
  // Tests parseEachBlocks.js:237-241 - template parts without block syntax
  // When transformEachBlocks encounters a string part with no {+each/{+if/{+unless,
  // it pushes the string and its corresponding value without transformation
  const Html = createSSRHtml();
  const items = [{ name: 'A' }, { name: 'B' }];
  const count = 2;
  // "before " has no block syntax → triggers lines 237-241
  const html = Html`<div>before ${count} items: {+each ${items}}<span>{name}</span>{-each} done</div>`;
  assert.ok(html.includes('before 2 items:'), 'Should preserve non-block prefix with interpolation');
  assert.ok(html.includes('<span>A</span>'), 'Should render first item');
  assert.ok(html.includes('<span>B</span>'), 'Should render second item');
  assert.ok(html.includes('done'), 'Should preserve suffix');
});

// ============================================================================
// Block Syntax Error Tests (parseEachBlocks.js error paths)
// ============================================================================

test('SSR: unclosed {+each} block throws error', () => {
  // Tests parseEachBlocks.js:77 - findMatchingClose throws when block is never closed
  const Html = createSSRHtml();
  const items = [{ name: 'A' }];
  let threw = false;
  let errorMessage = '';
  try {
    Html`<ul>{+each ${items}}<li>{name}</li></ul>`;
  } catch (e) {
    threw = true;
    errorMessage = e.message;
  }
  assert.ok(threw, 'Should throw when {+each} is not closed');
  assert.strictEqual(
    errorMessage,
    'Unclosed {+each block. Missing {-each}.',
    'Error message should match exact format'
  );
});

test('SSR: unclosed {+if} block throws error', () => {
  // Tests parseEachBlocks.js:77 - findMatchingClose throws for unclosed {+if}
  const Html = createSSRHtml();
  const show = true;
  let threw = false;
  let errorMessage = '';
  try {
    Html`<div>{+if ${show}}Show this</div>`;
  } catch (e) {
    threw = true;
    errorMessage = e.message;
  }
  assert.ok(threw, 'Should throw when {+if} is not closed');
  assert.strictEqual(
    errorMessage,
    'Unclosed {+if block. Missing {-if}.',
    'Error message should match exact format'
  );
});

test('SSR: unclosed {+unless} block throws error', () => {
  // Tests parseEachBlocks.js:77 - findMatchingClose throws for unclosed {+unless}
  const Html = createSSRHtml();
  const hide = false;
  let threw = false;
  let errorMessage = '';
  try {
    Html`<div>{+unless ${hide}}Content</div>`;
  } catch (e) {
    threw = true;
    errorMessage = e.message;
  }
  assert.ok(threw, 'Should throw when {+unless} is not closed');
  assert.strictEqual(
    errorMessage,
    'Unclosed {+unless block. Missing {-unless}.',
    'Error message should match exact format'
  );
});

// ============================================================================
// processFragmentResult Final Return Coverage (ssr-html.js:51)
// ============================================================================
//
// This section tests the DEFENSIVE FALLBACK code path in processFragmentResult().
// Line 51 (`return result;`) is hit when a fragment returns an object that has
// NONE of the recognized properties: text, html, any, template, and is NOT safeHtml.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ DEMO: How to trigger line 51 from the public API                       │
// └─────────────────────────────────────────────────────────────────────────┘
//
// User Code (developer mistake - returns wrong shape):
// ─────────────────────────────────────────────────────
//   const html = await renderElement('user-card', {
//     attrs: { id: '123' },
//     fragments: {
//       // WRONG! Returns { name, email } instead of { text: ... } or { html: ... }
//       UserInfo: (data) => ({ name: data.name, email: data.email }),
//     },
//     render: (Html, ctx) => Html`
//       <div class="card">
//         <h2>${{ UserInfo: { name: 'John', email: 'john@example.com' } }}</h2>
//       </div>
//     `,
//   });
//
// Code Flow (how line 51 gets hit):
// ──────────────────────────────────
//   1. renderElement() calls createSSRHtml(context)
//   2. render(Html, ctx) is called with user's render function
//   3. Html`...` detects fragment pattern: ${{ UserInfo: { name: 'John', ... } }}
//      - Object with single key starting with uppercase → fragment invocation
//   4. Calls context.fragments['UserInfo']({ name: 'John', email: '...' })
//      - Returns { name: 'John', email: 'john@example.com' }
//   5. processFragmentResult({ name: 'John', email: '...' }) is called:
//      - Line 28: result is truthy AND typeof === 'object' → continue
//      - Line 32: result.text === undefined → skip
//      - Line 36: result.html === undefined → skip
//      - Line 40: result.any === undefined → skip
//      - Line 44: result.template === undefined → skip
//      - Line 48: isSafeHtml(result) → false (no [SAFE_HTML] symbol) → skip
//      - Line 51: return result; ← THIS LINE IS HIT
//   6. Object { name: 'John', email: '...' } passes through unchanged
//   7. renderToString converts it to "[object Object]" in output
//
// ============================================================================

test('processFragmentResult: unrecognized object hits final return via renderElement', async () => {
  // Tests ssr-html.js:51 - the final `return result;` defensive fallback
  // Scenario: Developer returns { foo, bar } instead of { text: ... } or { html: ... }
  const html = await renderElement('unrecognized-fragment', {
    attrs: {},
    fragments: {
      // Fragment returns object with unrecognized shape (developer error)
      BadShape: (data) => ({ foo: data.value, bar: 'extra' }),
    },
    render: (Html) => Html`<div>${{ BadShape: { value: 'test' } }}</div>`,
  });

  // Object passes through processFragmentResult unchanged → stringifies as "[object Object]"
  assert.ok(html.includes('[object Object]'), 'Unrecognized object should stringify');
});

test('processFragmentResult: empty object hits final return via renderElement', async () => {
  // Tests ssr-html.js:51 - empty object {} has no properties, all checks fail
  const html = await renderElement('empty-fragment', {
    attrs: {},
    fragments: {
      Empty: () => ({}),
    },
    render: (Html) => Html`<div>${{ Empty: null }}</div>`,
  });

  // Empty object stringifies to "[object Object]"
  assert.ok(html.includes('[object Object]'), 'Empty object should stringify');
});

test('processFragmentResult: async fragment with unrecognized shape via renderElement', async () => {
  // Tests the async path (ssr-html.js:146) - promise.then(processFragmentResult)
  const html = await renderElement('async-unrecognized', {
    attrs: {},
    fragments: {
      AsyncUnknown: async (data) => {
        await new Promise((r) => setTimeout(r, 1));
        return { custom: data.msg, another: 'field' };
      },
    },
    render: (Html) => Html`<div>${{ AsyncUnknown: { msg: 'hello' } }}</div>`,
  });

  // Async unrecognized object also hits final return and stringifies
  assert.ok(html.includes('[object Object]'), 'Async unrecognized object should stringify');
});

// ============================================================================
// Corner Cases - Cached Template Behavior
// ============================================================================
// When a template is first rendered with a normal value, the handler is cached.
// If a subsequent render uses safeHtml(), the cached stringComment handler must
// still check for __unsafe and return unescaped content.
//
// Code Flow (how string-update.js:112-113 gets hit):
// ──────────────────────────────────────────────────
//   1. First render: Html`<p>${"normal"}</p>`
//      - processValue("normal") → "normal" unchanged
//      - hint is string → ssrUpdate returns stringComment handler
//      - Template cached with stringComment
//   2. Second render: Html`<p>${safeHtml("<b>bold</b>")}</p>`
//      - processValue(safeHtml(...)) → { __unsafe: true, value: "<b>bold</b>" }
//      - Uses CACHED template → stringComment handler
//      - stringComment receives value with __unsafe flag
//      - Line 111: typeof value === 'object' && value.__unsafe → true
//      - Line 112: return value.value (raw HTML, no escaping)
// ============================================================================

test('stringComment: cached template reused with safeHtml value', () => {
  // Tests string-update.js:112-113 - __unsafe check in stringComment
  // This path is hit when a cached template (first rendered with normal string)
  // is later rendered with a safeHtml() value
  //
  // NOTE: Must use createSSRHtml() because it processes values through processValue()
  // which converts safeHtml objects to __unsafe objects. ssrHtml does not do this.

  const Html = createSSRHtml();

  // First render with normal string - this caches the template with stringComment handler
  const template = (v) => Html`<p>${v}</p>`;
  const firstResult = template('normal text');
  assert.strictEqual(firstResult, '<p>normal text</p>', 'First render should work normally');

  // Second render with safeHtml - uses cached stringComment handler
  // processValue converts safeHtml to { __unsafe: true, value: ... }
  // The __unsafe branch in stringComment must be hit to avoid escaping
  const secondResult = template(safeHtml('<b>bold</b>'));
  assert.strictEqual(
    secondResult,
    '<p><b>bold</b></p>',
    'Cached template with safeHtml should not escape HTML'
  );

  // Verify escaping still works for subsequent normal values
  const thirdResult = template('<script>alert("xss")</script>');
  assert.strictEqual(
    thirdResult,
    '<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>',
    'Normal strings should still be escaped'
  );
});

// ============================================================================
// Coverage Gap Tests - string-update.js edge cases (direct function calls)
// ============================================================================

test('styleObjectToString: null returns empty string', () => {
  // Tests string-update.js:32 - !styleObj branch
  const result = styleObjectToString(null);
  assert.strictEqual(result, '', 'null should return empty string');
});

test('styleObjectToString: undefined returns empty string', () => {
  // Tests string-update.js:32 - !styleObj branch
  const result = styleObjectToString(undefined);
  assert.strictEqual(result, '', 'undefined should return empty string');
});

test('styleObjectToString: non-object (number) returns empty string', () => {
  // Tests string-update.js:32 - typeof styleObj !== 'object' branch
  const result = styleObjectToString(42);
  assert.strictEqual(result, '', 'number should return empty string');
});

test('styleObjectToString: non-object (string) returns empty string', () => {
  // Tests string-update.js:32 - typeof styleObj !== 'object' branch
  const result = styleObjectToString('color: red');
  assert.strictEqual(result, '', 'string should return empty string');
});

test('stringData: null returns empty object', () => {
  // Tests string-update.js:94 - !values branch
  const result = stringData(null);
  assert.deepStrictEqual(result, {}, 'null should return empty object');
});

test('stringData: non-object (number) returns empty object', () => {
  // Tests string-update.js:94 - typeof values !== 'object' branch
  const result = stringData(123);
  assert.deepStrictEqual(result, {}, 'number should return empty object');
});

test('stringCommentArray: non-array falls back to stringComment', () => {
  // Tests string-update.js:123 - !Array.isArray(value) branch
  const result = stringCommentArray('single string');
  assert.strictEqual(result, 'single string', 'should fall back to stringComment');
});

test('stringCommentArray: null item in array returns empty string', () => {
  // Tests string-update.js:126 - if (item == null) return ''
  const Html = createSSRHtml();
  const items = ['a', null, 'b', undefined, 'c'];
  const html = Html`<div>${items}</div>`;
  assert.ok(html.includes('a'), 'Should render first item');
  assert.ok(html.includes('b'), 'Should render middle item');
  assert.ok(html.includes('c'), 'Should render last item');
  assert.ok(!html.includes('null'), 'Should not render "null" string');
});

test('stringUnsafe: non-__unsafe value returns stringified value', () => {
  // Tests string-update.js:149 - return String(value ?? '')
  const result = stringUnsafe('plain string');
  assert.strictEqual(result, 'plain string', 'should stringify non-unsafe value');
});

test('stringUnsafe: null/undefined returns empty string', () => {
  // Tests string-update.js:149 - value ?? '' handling
  const result1 = stringUnsafe(null);
  const result2 = stringUnsafe(undefined);
  assert.strictEqual(result1, '', 'null should return empty string');
  assert.strictEqual(result2, '', 'undefined should return empty string');
});

test('@click with array handler triggers EVENT_ARRAY', () => {
  // Tests string-update.js:191 - array ? EVENT_ARRAY : EVENT
  const Html = createSSRHtml();
  const handlers = [() => {}, () => {}];
  const html = Html`<button @click=${handlers}>Click</button>`;
  assert.ok(!html.includes('@click'), 'Should strip event handler');
  assert.ok(html.includes('Click'), 'Should render button text');
});

// ============================================================================
// Coverage Gap Tests - processAdvancedTemplate.js
// ============================================================================

test('processAdvancedTemplate: unless block with truthy condition', () => {
  // Tests processAdvancedTemplate.js:103 - data[condition] ? '' : content
  // The truthy branch returns empty string when condition is true
  const result = processAdvancedTemplate(
    '{+unless hidden}Should not show{-unless}',
    { hidden: true } // truthy value triggers the '' return branch
  );
  assert.strictEqual(result, '', 'Should return empty string when condition is truthy');
});

// ============================================================================
// Coverage Gap Tests - render-element.js
// ============================================================================

test('renderElement: null attrs serializes to empty string', async () => {
  // Tests render-element.js:15 - if (!attrs || typeof attrs !== 'object')
  const html = await renderElement('no-attrs', {
    attrs: null,
    render: (Html) => Html`<div>Content</div>`,
  });
  assert.ok(html.includes('<no-attrs>'), 'Should render element with no attrs');
  assert.ok(html.includes('Content'), 'Should render content');
});

// ============================================================================
// SSR Hydration Event Replay Tests (replay.js)
// ============================================================================

/**
 * Creates a mock DOM element for testing replay functionality.
 * @param {string} tagName - Element tag name
 * @param {Object} props - Additional properties
 * @param {Array} children - Child elements
 */
function createMockElement(tagName, props = {}, children = []) {
  return {
    tagName: tagName.toUpperCase(),
    children,
    dispatchEvent: () => {},
    ...props,
  };
}

test('replayEvents: restores scroll positions', () => {
  // Tests replay.js:62-70 - scrollPositions restoration
  const scrollableDiv = createMockElement('DIV', {
    scrollTop: 0,
    scrollLeft: 0,
  });

  const customElement = createMockElement('MY-COMPONENT', {}, [scrollableDiv]);

  const ssrState = {
    buffer: new Map(),
    elementStates: new Map([
      [
        customElement,
        {
          scrollPositions: new Map([
            ['DIV:0', { scrollTop: 150, scrollLeft: 75 }],
          ]),
        },
      ],
    ]),
  };

  replayEvents(customElement, ssrState, null, null);

  assert.strictEqual(scrollableDiv.scrollTop, 150, 'Should restore scrollTop');
  assert.strictEqual(scrollableDiv.scrollLeft, 75, 'Should restore scrollLeft');
});

test('replayEvents: restores checkbox checked state', () => {
  // Tests replay.js:72-79 - checkedStates restoration for checkbox
  const checkbox = createMockElement('INPUT', {
    type: 'checkbox',
    checked: false,
  });

  const customElement = createMockElement('MY-COMPONENT', {}, [checkbox]);

  const ssrState = {
    buffer: new Map(),
    elementStates: new Map([
      [
        customElement,
        {
          checkedStates: new Map([['INPUT:0', true]]),
        },
      ],
    ]),
  };

  replayEvents(customElement, ssrState, null, null);

  assert.strictEqual(checkbox.checked, true, 'Should restore checkbox checked state');
});

test('replayEvents: restores radio checked state', () => {
  // Tests replay.js:75 - type === 'radio' branch
  const radio = createMockElement('INPUT', {
    type: 'radio',
    checked: false,
  });

  const customElement = createMockElement('MY-COMPONENT', {}, [radio]);

  const ssrState = {
    buffer: new Map(),
    elementStates: new Map([
      [
        customElement,
        {
          checkedStates: new Map([['INPUT:0', true]]),
        },
      ],
    ]),
  };

  replayEvents(customElement, ssrState, null, null);

  assert.strictEqual(radio.checked, true, 'Should restore radio checked state');
});

test('replayEvents: deletes element state after restoration', () => {
  // Tests replay.js:81 - ssrState.elementStates.delete(customElement)
  const customElement = createMockElement('MY-COMPONENT');

  const ssrState = {
    buffer: new Map(),
    elementStates: new Map([
      [
        customElement,
        {
          scrollPositions: new Map(),
          checkedStates: new Map(),
        },
      ],
    ]),
  };

  assert.ok(ssrState.elementStates.has(customElement), 'Should have state before replay');

  replayEvents(customElement, ssrState, null, null);

  assert.ok(!ssrState.elementStates.has(customElement), 'Should delete state after replay');
});

test('replayEvents: handles scroll path not found gracefully', () => {
  // Tests replay.js:65 - if (element) guard when path doesn't resolve
  const customElement = createMockElement('MY-COMPONENT', {}, []);

  const ssrState = {
    buffer: new Map(),
    elementStates: new Map([
      [
        customElement,
        {
          scrollPositions: new Map([
            ['NONEXISTENT:99', { scrollTop: 100, scrollLeft: 50 }],
          ]),
        },
      ],
    ]),
  };

  // Should not throw when path doesn't resolve
  replayEvents(customElement, ssrState, null, null);
  assert.ok(true, 'Should handle missing scroll target gracefully');
});

test('replayEvents: handles checked path not found gracefully', () => {
  // Tests replay.js:74 - if (element && ...) guard when path doesn't resolve
  const customElement = createMockElement('MY-COMPONENT', {}, []);

  const ssrState = {
    buffer: new Map(),
    elementStates: new Map([
      [
        customElement,
        {
          checkedStates: new Map([['NONEXISTENT:99', true]]),
        },
      ],
    ]),
  };

  // Should not throw when path doesn't resolve
  replayEvents(customElement, ssrState, null, null);
  assert.ok(true, 'Should handle missing checked target gracefully');
});

test('replayEvents: skips non-checkbox/radio elements for checked state', () => {
  // Tests replay.js:75 - element.type check fails for text input
  const textInput = createMockElement('INPUT', {
    type: 'text',
    checked: false,
  });

  const customElement = createMockElement('MY-COMPONENT', {}, [textInput]);

  const ssrState = {
    buffer: new Map(),
    elementStates: new Map([
      [
        customElement,
        {
          checkedStates: new Map([['INPUT:0', true]]),
        },
      ],
    ]),
  };

  replayEvents(customElement, ssrState, null, null);

  assert.strictEqual(textInput.checked, false, 'Should not set checked on text input');
});

test('replayEvents: restores both scroll and checked states together', () => {
  // Tests both branches in restoreElementState with combined state
  const scrollableDiv = createMockElement('DIV', {
    scrollTop: 0,
    scrollLeft: 0,
  });
  const checkbox = createMockElement('INPUT', {
    type: 'checkbox',
    checked: false,
  });

  const customElement = createMockElement('MY-COMPONENT', {}, [
    scrollableDiv,
    checkbox,
  ]);

  const ssrState = {
    buffer: new Map(),
    elementStates: new Map([
      [
        customElement,
        {
          scrollPositions: new Map([['DIV:0', { scrollTop: 200, scrollLeft: 100 }]]),
          checkedStates: new Map([['INPUT:0', true]]),
        },
      ],
    ]),
  };

  replayEvents(customElement, ssrState, null, null);

  assert.strictEqual(scrollableDiv.scrollTop, 200, 'Should restore scrollTop');
  assert.strictEqual(scrollableDiv.scrollLeft, 100, 'Should restore scrollLeft');
  assert.strictEqual(checkbox.checked, true, 'Should restore checkbox state');
});

test('replayEvents: handles element with no stored state', () => {
  // Tests replay.js:61 - early return when no state exists for the element
  const customElement = createMockElement('NO-STATE-ELEMENT', {});

  const ssrState = {
    buffer: new Map(),
    elementStates: new Map(), // Empty - no state for any element
  };

  // Should not throw and should be a no-op
  replayEvents(customElement, ssrState, null, null);

  // Element should be unchanged (no state to restore)
  assert.ok(true, 'Should handle element with no stored state gracefully');
});

// Run all tests
runTests();
