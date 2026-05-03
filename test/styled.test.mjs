/**
 * @file Integration tests for +styled inline styling system.
 * Run with: npm run build && node test/styled.test.mjs
 *
 * Tests the styled system via the public SSR API (renderElement).
 * No unit tests - only integration tests via the library interface.
 */

import { createRequire } from 'module';
import assert from 'assert';

// Import SSR modules directly (no browser dependencies)
// For source mode, import directly; for bundle mode, use require
let renderElement;
let defineStyled;
let normalizeStyledDefinition;
let normalizeTagStyle;
let splitDeclarationAndSelectorKeys;

if (process.env.SSR_COVERAGE) {
  // Import from source files for coverage collection
  const renderElementModule = await import('../src/ssr/render-element.js');
  const styledModule = await import('../src/styled/index.js');
  renderElement = renderElementModule.renderElement;
  defineStyled = styledModule.defineStyled;
  normalizeStyledDefinition = styledModule.normalizeStyledDefinition;
  normalizeTagStyle = styledModule.normalizeTagStyle;
  splitDeclarationAndSelectorKeys =
    styledModule.splitDeclarationAndSelectorKeys;
  console.log('Styled tests: Using SOURCE files (coverage mode)');
} else {
  // Import from bundle to verify bundled output
  const require = createRequire(import.meta.url);
  const bundle = require('../build/hyperElement.bundle.js');
  renderElement = bundle.renderElement;
  defineStyled = bundle.defineStyled;
  normalizeStyledDefinition = null;
  normalizeTagStyle = null;
  splitDeclarationAndSelectorKeys = null;
  console.log('Styled tests: Using BUNDLE (verification mode)');
}

// Test runner
const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log('\n+styled System Integration Tests\n' + '='.repeat(50));

  for (const { name, fn } of tests) {
    try {
      await fn();
      passed++;
      console.log(`✓ ${name}`);
    } catch (e) {
      failed++;
      console.log(`✗ ${name}`);
      console.log(`  Error: ${e.message}`);
      if (e.stack) {
        console.log(`  Stack: ${e.stack.split('\n').slice(1, 3).join('\n  ')}`);
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// Export for combined runner
export { runTests };

// ============================================================================
// US1: Base Styles Tests (TC1.1-1.3)
// ============================================================================

test('TC1.1: Simple base styles apply to +styled elements', async () => {
  const html = await renderElement('base-test', {
    attrs: {},
    styled: [{ h2: { color: 'red', fontSize: '24px' } }],
    render: (Html) => Html`<h2+styled>Title</h2>`,
  });

  assert.ok(html.includes('style="'), 'Should have style attribute');
  assert.ok(html.includes('color: red'), 'Should have color style');
  assert.ok(
    html.includes('font-size: 24px'),
    'Should convert camelCase to kebab'
  );
  assert.ok(!html.includes('+styled'), 'Should strip +styled suffix');
});

test('TC1.2: Multiple elements share styles by tag name', async () => {
  const html = await renderElement('multi-test', {
    attrs: {},
    styled: [{ p: { margin: '0', lineHeight: '1.6' } }],
    render: (Html) => Html`
      <p+styled>First paragraph</p>
      <p+styled>Second paragraph</p>
    `,
  });

  // Count occurrences of margin: 0
  const matches = html.match(/margin: 0/g);
  assert.strictEqual(
    matches?.length,
    2,
    'Both paragraphs should have margin: 0'
  );
});

test('TC1.3: Nested base syntax with base key', async () => {
  const html = await renderElement('nested-test', {
    attrs: {},
    styled: [
      {
        div: {
          base: { padding: '10px', border: '1px solid gray' },
          // Other keys would be prop flags
        },
      },
    ],
    render: (Html) => Html`<div+styled>Content</div>`,
  });

  assert.ok(html.includes('padding: 10px'), 'Should apply base padding');
  assert.ok(
    html.includes('border: 1px solid gray'),
    'Should apply base border'
  );
});

// ============================================================================
// US2: Shared Selectors Tests (TC2.1-2.3)
// ============================================================================

test('TC2.1: Comma-separated keys apply to multiple tags', async () => {
  const html = await renderElement('shared-test', {
    attrs: {},
    styled: [{ 'h2, span': { fontFamily: 'Arial' } }],
    render: (Html) => Html`
      <h2+styled>Heading</h2>
      <span+styled>Text</span>
    `,
  });

  const matches = html.match(/font-family: Arial/g);
  assert.strictEqual(
    matches?.length,
    2,
    'Both elements should have font-family'
  );
});

test('TC2.2: Shared styles merge with and override tag-specific', async () => {
  const html = await renderElement('merge-test', {
    attrs: {},
    styled: [
      {
        div: { padding: '10px', color: 'blue' },
        'div, span': { padding: '20px', margin: '5px' },
      },
    ],
    render: (Html) => Html`<div+styled>Content</div>`,
  });

  // Shared selector wins on conflict (padding)
  assert.ok(
    html.includes('padding: 20px'),
    'Shared should override tag-specific padding'
  );
  assert.ok(html.includes('color: blue'), 'Should keep tag-specific color');
  assert.ok(html.includes('margin: 5px'), 'Should add shared margin');
});

test('TC2.3: Whitespace in selectors is trimmed', async () => {
  const html = await renderElement('whitespace-test', {
    attrs: {},
    styled: [{ ' h2 , span ': { color: 'navy' } }],
    render: (Html) => Html`<h2+styled>Test</h2>`,
  });

  assert.ok(
    html.includes('color: navy'),
    'Should handle whitespace in selector'
  );
});

// ============================================================================
// US3: Logic Functions Tests (TC3.1-3.4)
// ============================================================================

test('TC3.1: Logic function receives styleValue', async () => {
  const html = await renderElement('logic-value-test', {
    attrs: {},
    styled: [
      { div: { padding: '5px' } },
      { div: (val) => ({ width: `${val}px` }) },
    ],
    render: (Html) => Html`<div+styled style=${100}>Content</div>`,
  });

  assert.ok(
    html.includes('width: 100px'),
    'Should use styleValue in logic function'
  );
  assert.ok(html.includes('padding: 5px'), 'Should merge with base styles');
});

test('TC3.2: Logic function receives ctx (attrs)', async () => {
  const html = await renderElement('logic-ctx-test', {
    attrs: { theme: 'dark' },
    styled: [
      { span: {} },
      {
        span: (val, ctx) => ({
          color: ctx.attrs.theme === 'dark' ? 'white' : 'black',
        }),
      },
    ],
    render: (Html) => Html`<span+styled>Text</span>`,
  });

  assert.ok(
    html.includes('color: white'),
    'Should access ctx.attrs in logic function'
  );
});

test('TC3.3: Logic function receives store', async () => {
  const html = await renderElement('logic-store-test', {
    attrs: {},
    store: { isLoading: true },
    styled: [
      { button: {} },
      {
        button: (val, ctx, store) => ({
          opacity: store.isLoading ? '0.5' : '1',
        }),
      },
    ],
    render: (Html) => Html`<button+styled>Submit</button>`,
  });

  assert.ok(
    html.includes('opacity: 0.5'),
    'Should access store in logic function'
  );
});

test('TC3.4: Style passthrough when no logic function', async () => {
  const html = await renderElement('passthrough-test', {
    attrs: {},
    styled: [{ div: { padding: '10px' } }],
    // No logic function defined for div
    render: (Html) =>
      Html`<div+styled style=${{ margin: '5px', color: 'red' }}>Content</div>`,
  });

  assert.ok(html.includes('padding: 10px'), 'Should have base padding');
  assert.ok(html.includes('margin: 5px'), 'Should have inline margin');
  assert.ok(html.includes('color: red'), 'Should have inline color');
});

// ============================================================================
// US8: Prop Flags Tests (TC8.1-8.6)
// ============================================================================

test('TC8.1: Single boolean prop flag', async () => {
  const html = await renderElement('flag-single-test', {
    attrs: {},
    styled: [
      {
        div: {
          base: { color: 'black' },
          error: { color: 'red', borderColor: 'red' },
        },
      },
    ],
    render: (Html) => Html`<div+styled error>Error message</div>`,
  });

  assert.ok(html.includes('color: red'), 'Should apply error color');
  assert.ok(html.includes('border-color: red'), 'Should apply error border');
});

test('TC8.2: Multiple prop flags combine', async () => {
  const html = await renderElement('flag-multi-test', {
    attrs: {},
    styled: [
      {
        div: {
          base: { padding: '5px' },
          error: { color: 'red' },
          large: { fontSize: '20px' },
        },
      },
    ],
    render: (Html) => Html`<div+styled error large>Message</div>`,
  });

  assert.ok(html.includes('color: red'), 'Should apply error styles');
  assert.ok(html.includes('font-size: 20px'), 'Should apply large styles');
  assert.ok(html.includes('padding: 5px'), 'Should keep base styles');
});

test('TC8.3: Conditional styles via logic function (true)', async () => {
  // For conditional styling, use logic functions with ctx.attrs instead of dynamic prop flags
  const html = await renderElement('flag-cond-true-test', {
    attrs: { isActive: 'true' },
    styled: [
      { div: { base: { color: 'black' } } },
      {
        div: (val, ctx) =>
          ctx.attrs.isActive === 'true' ? { color: 'green' } : null,
      },
    ],
    render: (Html) => Html`<div+styled>Item</div>`,
  });

  assert.ok(
    html.includes('color: green'),
    'Should apply active styles when condition is true'
  );
});

test('TC8.4: Conditional styles via logic function (false)', async () => {
  // For conditional styling, use logic functions with ctx.attrs instead of dynamic prop flags
  const html = await renderElement('flag-cond-false-test', {
    attrs: { isActive: 'false' },
    styled: [
      { div: { base: { color: 'black' } } },
      {
        div: (val, ctx) =>
          ctx.attrs.isActive === 'true' ? { color: 'green' } : null,
      },
    ],
    render: (Html) => Html`<div+styled>Item</div>`,
  });

  assert.ok(
    html.includes('color: black'),
    'Should apply base styles when condition is false'
  );
  assert.ok(!html.includes('color: green'), 'Should not have green color');
});

test('TC8.5: Prop flag merge order (later wins)', async () => {
  const html = await renderElement('flag-order-test', {
    attrs: {},
    styled: [
      {
        div: {
          base: { padding: '5px' },
          a: { padding: '10px' },
          b: { padding: '20px' },
        },
      },
    ],
    render: (Html) => Html`<div+styled a b>Content</div>`,
  });

  assert.ok(html.includes('padding: 20px'), 'Later flag (b) should win');
});

test('TC8.6: Regular attributes are not prop flags', async () => {
  const html = await renderElement('flag-regular-test', {
    attrs: {},
    styled: [
      {
        div: {
          base: { color: 'blue' },
        },
      },
    ],
    render: (Html) => Html`<div+styled class="foo" id="bar">Content</div>`,
  });

  assert.ok(html.includes('class="foo"'), 'Should keep class attribute');
  assert.ok(html.includes('id="bar"'), 'Should keep id attribute');
  assert.ok(html.includes('color: blue'), 'Should apply base styles');
});

// ============================================================================
// US6: Color Palettes Tests (TC6.1-TC6.4)
// ============================================================================

test('TC6.1: Basic color resolution via colors option', async () => {
  const html = await renderElement('themed-test', {
    attrs: {},
    styled: [{ button: { backgroundColor: 'primary', color: 'white' } }],
    colors: { primary: '#007bff', danger: '#dc3545' },
    render: (Html) => Html`<button+styled>Click</button>`,
  });

  assert.ok(
    html.includes('background-color: #007bff'),
    'Should resolve primary color'
  );
});

test('TC6.2: Unknown colors pass through', async () => {
  const html = await renderElement('color-passthrough-test', {
    attrs: {},
    styled: [{ div: { color: 'rebeccapurple' } }],
    colors: { primary: '#007bff' },
    render: (Html) => Html`<div+styled>Content</div>`,
  });

  assert.ok(
    html.includes('color: rebeccapurple'),
    'Unknown color should pass through'
  );
});

test('TC6.3: Colors within string values are resolved', async () => {
  const html = await renderElement('color-string-test', {
    attrs: {},
    styled: [{ div: { border: '1px solid primary' } }],
    colors: { primary: '#007bff' },
    render: (Html) => Html`<div+styled>Content</div>`,
  });

  assert.ok(
    html.includes('border: 1px solid #007bff'),
    'Should resolve color in string'
  );
});

test('TC6.4: Colors in logic function results', async () => {
  const html = await renderElement('color-logic-test', {
    attrs: {},
    styled: [{ span: {} }, { span: () => ({ color: 'danger' }) }],
    colors: { danger: '#dc3545' },
    render: (Html) => Html`<span+styled>Warning</span>`,
  });

  assert.ok(
    html.includes('color: #dc3545'),
    'Should resolve color from logic result'
  );
});

// ============================================================================
// US7: SSR Output Tests (TC7.1-TC7.3)
// ============================================================================

test('TC7.1: SSR strips +styled suffix from output', async () => {
  const html = await renderElement('ssr-suffix-test', {
    attrs: {},
    styled: [{ h2: { color: 'red' } }],
    render: (Html) => Html`<h2+styled>Title</h2>`,
  });

  assert.ok(!html.includes('+styled'), 'Should not contain +styled suffix');
  assert.ok(html.includes('<h2'), 'Should have h2 tag');
  assert.ok(html.includes('</h2>'), 'Should close h2 tag');
});

test('TC7.2: SSR renders inline style attribute', async () => {
  const html = await renderElement('ssr-inline-test', {
    attrs: {},
    styled: [{ div: { padding: '10px', margin: '5px' } }],
    render: (Html) => Html`<div+styled>Content</div>`,
  });

  assert.ok(html.includes('style="'), 'Should have inline style attribute');
  assert.ok(html.includes('padding: 10px'), 'Should have padding');
  assert.ok(html.includes('margin: 5px'), 'Should have margin');
});

test('TC7.3: Logic functions execute in SSR', async () => {
  const html = await renderElement('ssr-logic-test', {
    attrs: { size: 'large' },
    styled: [
      { span: { fontSize: '14px' } },
      {
        span: (val, ctx) => ({
          fontSize: ctx.attrs.size === 'large' ? '24px' : '14px',
        }),
      },
    ],
    render: (Html) => Html`<span+styled>Text</span>`,
  });

  assert.ok(
    html.includes('font-size: 24px'),
    'Logic function should execute and override'
  );
});

test('TC7.4: SSR selector styles emit class and root style host', async () => {
  const html = await renderElement('ssr-selector-test', {
    attrs: {},
    styled: [
      {
        article: {
          base: { padding: '12px', color: 'black' },
          ':hover': { color: 'blue' },
        },
      },
    ],
    render: (Html) => Html`<article+styled>Content</article>`,
  });

  assert.ok(html.includes('class="he-s-'), 'Should add generated class');
  assert.ok(
    !html.includes('<article style='),
    'Should move base declarations out of inline style'
  );
  assert.ok(
    html.includes('<style data-hyper-styled-root="ssr-selector-test">'),
    'Should emit style host'
  );
  assert.ok(html.includes(':hover'), 'Should serialize selector rule');
});

test('TC7.5: SSR variants are classes and consumed attributes', async () => {
  const html = await renderElement('ssr-variant-selector-test', {
    attrs: {},
    styled: [
      {
        article: {
          base: { color: 'black' },
          error: { color: 'red' },
          ':focus': { color: 'blue' },
        },
      },
    ],
    render: (Html) => Html`<article+styled error=${true}>Content</article>`,
  });

  assert.ok(html.includes('he-v-'), 'Should add generated variant class');
  assert.ok(
    !html.includes('<article error'),
    'Should consume dynamic variant attr'
  );
  assert.ok(html.includes('color: red'), 'Should emit variant CSS rule');
});

test('TC7.6: SSR css override is consumed and wins by later scoped rule', async () => {
  const html = await renderElement('ssr-css-override-test', {
    attrs: { hoverColor: 'green' },
    styled: [
      {
        article: {
          base: { color: 'black' },
          ':hover': { color: 'blue' },
        },
      },
    ],
    render: (Html, ctx) => Html`
      <article+styled css=${{ ':hover': { color: ctx.attrs.hoverColor } }}>
        Content
      </article>
    `,
  });

  assert.ok(!html.includes(' css='), 'Should not emit css attribute');
  assert.ok(html.includes('he-i-'), 'Should add instance override class');
  assert.ok(html.includes('color: green'), 'Should emit override rule');
  assert.ok(
    /\.he-s-[^{]+\.he-i-[^{]+:hover/.test(html),
    'Override selector should combine base and instance classes'
  );
});

test('TC7.7: SSR selector lists are scoped per selector', async () => {
  const html = await renderElement('ssr-selector-list-test', {
    attrs: {},
    styled: [
      {
        article: {
          base: { padding: '12px' },
          ' .title, .subtitle, body': { color: 'red' },
        },
      },
    ],
    render: (Html) => Html`
      <article+styled>
        <h2 class="title">Title</h2>
        <p class="subtitle">Subtitle</p>
      </article>
    `,
  });

  assert.ok(
    !html.includes(', .subtitle'),
    'Should not leak unscoped selector list member'
  );
  assert.ok(!html.includes(', body'), 'Should not leak body selector globally');
  assert.ok(
    /\.he-s-[^{]+ \.title,\n\.he-s-[^{]+ \.subtitle,\n\.he-s-[^{]+ body/.test(
      html
    ),
    'Should prefix each selector list member'
  );
});

test('TC7.8: SSR unsupported at-rules are ignored and leave inline-only output', async () => {
  const html = await renderElement('ssr-unsupported-rule-test', {
    attrs: {},
    styled: [
      {
        article: {
          base: { color: 'black' },
          '@keyframes pulse': {
            from: { opacity: 0 },
            to: { opacity: 1 },
          },
        },
      },
    ],
    render: (Html) => Html`<article+styled>Content</article>`,
  });

  assert.ok(
    html.includes('style="color: black"'),
    'Should keep remaining declarations inline'
  );
  assert.ok(!html.includes('keyframes'), 'Should not emit unsupported at-rule');
  assert.ok(
    !html.includes('data-hyper-styled-root'),
    'Should not emit host for ignored selector CSS'
  );
});

test('TC7.9: SSR custom properties and style tag escaping work', async () => {
  const html = await renderElement('ssr-custom-props-test', {
    attrs: {},
    styled: [
      {
        article: {
          base: {
            '--accent-color': 'red',
            color: 'var(--accent-color)',
          },
          ':hover': {
            '--accent-color': 'blue </style><script>',
          },
        },
      },
    ],
    render: (Html) => Html`<article+styled>Content</article>`,
  });

  assert.ok(
    html.includes('--accent-color: red'),
    'Should serialize custom property'
  );
  assert.ok(
    html.includes('<\\/style><script>'),
    'Should escape style close sequence'
  );
});

test('TC7.10: defineStyled exposes full and inline callables', async () => {
  const cardStyles = defineStyled({
    article: {
      base: { padding: '12px', color: 'black' },
      error: { color: 'red' },
      ':hover': { color: 'blue' },
    },
  });
  const full = cardStyles.article({ error: true });
  const inline = cardStyles.article.inline({ error: true });
  const html = await renderElement('ssr-define-styled-test', {
    attrs: {},
    styled: cardStyles,
    render: (Html) => Html`
      <article+styled style=${full}>Full</article>
      <p style=${inline}>Inline</p>
    `,
  });

  assert.deepStrictEqual(full, {
    padding: '12px',
    color: 'red',
    ':hover': { color: 'blue' },
  });
  assert.deepStrictEqual(inline, { padding: '12px', color: 'red' });
  assert.ok(
    html.includes('he-i-'),
    'Full callable should generate instance CSS on +styled'
  );
  assert.ok(
    html.includes('<p style="padding: 12px; color: red">Inline</p>'),
    'Inline callable should remain native style-safe'
  );
});

test('TC7.11: SSR dynamic style object with selectors generates instance CSS', async () => {
  const html = await renderElement('ssr-dynamic-selector-style', {
    attrs: { error: true },
    styled: [{ article: { base: { padding: '12px' } } }],
    render: (Html, ctx) => Html`
      <article+styled
        style=${{
          color: ctx.attrs.error ? 'red' : 'black',
          ':hover': { color: 'blue' },
        }}
      >Content</article>
    `,
  });

  assert.ok(html.includes('he-i-'), 'Should add dynamic instance class');
  assert.ok(
    html.includes('color: red'),
    'Should emit dynamic declaration in CSS'
  );
  assert.ok(
    !html.includes('style="color: red"'),
    'Should not inline dynamic selector declarations'
  );
});

test('TC7.12: SSR shared selector groups merge with tag styles', async () => {
  const html = await renderElement('ssr-shared-selector-merge', {
    attrs: {},
    styled: [
      {
        article: {
          base: { color: 'black' },
          error: { color: 'red' },
        },
        'article, aside': {
          base: { padding: '12px' },
          error: { borderColor: 'orange' },
          ':hover': { color: 'blue' },
        },
      },
    ],
    render: (Html) => Html`<article+styled error>Content</article>`,
  });

  assert.ok(html.includes('color: black'), 'Should keep tag-specific base');
  assert.ok(html.includes('padding: 12px'), 'Should merge shared base');
  assert.ok(html.includes('color: red'), 'Should keep tag-specific variant');
  assert.ok(
    html.includes('border-color: orange'),
    'Should merge shared variant'
  );
  assert.ok(html.includes(':hover'), 'Should include shared selector');
});

test('TC7.13: SSR direct callable logic supports full and inline modes', async () => {
  const styles = defineStyled(
    {
      article: {
        base: { padding: '12px' },
        ':hover': { color: 'blue' },
      },
    },
    {
      article: (flags) => ({
        color: flags?.error ? 'red' : 'black',
        ':focus': { outline: '2px solid blue' },
      }),
    }
  );

  const full = styles.article({ error: true });
  const inline = styles.article.inline({ error: true });

  assert.ok(full[':hover'], 'Full output should include definition selector');
  assert.ok(full[':focus'], 'Full output should include logic selector');
  assert.strictEqual(
    inline.color,
    'red',
    'Inline output should include logic declaration'
  );
  assert.ok(!inline[':hover'], 'Inline output should omit selectors');
});

test('TC7.14: SSR malformed and nested selector inputs are ignored safely', async () => {
  const html = await renderElement('ssr-nested-selector-ignore', {
    attrs: {},
    styled: [
      {
        article: null,
        section: {
          base: { color: 'black' },
          error: {
            color: 'red',
            ':hover': { color: 'darkred' },
            '@media (min-width: 1px)': { color: 'purple' },
          },
        },
      },
    ],
    render: (Html) => Html`
      <article+styled>No style</article>
      <section+styled error>Content</section>
    `,
  });

  assert.ok(
    html.includes('<article>No style</article>'),
    'Invalid tag style should render without styles'
  );
  assert.ok(html.includes('color: red'), 'Variant declarations should remain');
  assert.ok(
    !html.includes('darkred'),
    'Nested selector inside variant should be ignored'
  );
  assert.ok(
    !html.includes('purple'),
    'Nested at-rule inside variant should be ignored'
  );
});

test('TC7.15: SSR no-config +styled selector object uses generated CSS', async () => {
  const html = await renderElement('ssr-no-config-selector', {
    attrs: {},
    render: (Html) => Html`
      <article+styled style=${{ color: 'black', ':hover': { color: 'blue' } }}>
        Content
      </article>
    `,
  });

  assert.ok(
    html.includes('he-i-'),
    'No-config selector object should get instance class'
  );
  assert.ok(
    html.includes(':hover'),
    'No-config selector object should emit selector CSS'
  );
  assert.ok(
    !html.includes('style="color: black"'),
    'No-config selector declarations should not be inline'
  );
});

test('TC7.16: SSR styled pass-through attributes remain attributes', async () => {
  const html = await renderElement('ssr-styled-pass-through', {
    attrs: { label: 'Card' },
    styled: [
      {
        article: {
          base: { color: 'black' },
          ':hover': { color: 'blue' },
        },
      },
    ],
    render: (Html, ctx) => Html`
      <article+styled title=${ctx.attrs.label}>Content</article>
    `,
  });

  assert.ok(
    html.includes('title="Card"'),
    'Unknown styled attribute should pass through normally'
  );
});

test('TC7.17: SSR selector splitter respects commas in functions and attributes', async () => {
  const html = await renderElement('ssr-selector-splitter', {
    attrs: {},
    styled: [
      {
        article: {
          base: { color: 'black' },
          ':not(.a, .b), [data-label="a,b"], > .child, &:focus': {
            color: 'blue',
          },
        },
      },
    ],
    render: (Html) =>
      Html`<article+styled><span class="child">Child</span></article>`,
  });

  assert.ok(html.includes(':not(.a, .b)'), 'Should not split inside :not()');
  assert.ok(
    html.includes('[data-label="a,b"]'),
    'Should not split inside attributes'
  );
  assert.ok(
    html.includes(' > .child'),
    'Should scope child combinator selector'
  );
  assert.ok(html.includes(':focus'), 'Should scope ampersand selector');
});

test('TC7.18: SSR generated classes preserve user classes', async () => {
  const html = await renderElement('ssr-user-class-selector', {
    attrs: {},
    styled: [
      {
        article: {
          base: { color: 'black' },
          ':hover': { color: 'blue' },
        },
      },
    ],
    render: (Html) => Html`<article+styled class="user-card">Content</article>`,
  });

  assert.ok(
    html.includes('class="user-card he-s-'),
    'Should append generated class after user class'
  );
});

// ============================================================================
// Edge Cases Tests (10 documented cases)
// ============================================================================

test('Edge 1: No styles defined for tag - renders without style attr', async () => {
  const html = await renderElement('edge-no-styles', {
    attrs: {},
    styled: [{ h2: { color: 'red' } }],
    render: (Html) => Html`<span+styled>No span styles defined</span>`,
  });

  // Element should render but without style attribute (or empty style)
  assert.ok(html.includes('<span'), 'Should render span');
  // May or may not have style="" depending on implementation
});

test('Edge 2: Empty styled config', async () => {
  const html = await renderElement('edge-empty-config', {
    attrs: {},
    styled: [{}],
    render: (Html) => Html`<div+styled>Content</div>`,
  });

  assert.ok(html.includes('<div'), 'Should render div even with empty config');
});

test('Edge 3: Conflicting styles - shared wins', async () => {
  const html = await renderElement('edge-conflict', {
    attrs: {},
    styled: [
      {
        div: { padding: '10px', color: 'blue' },
        'div, span': { padding: '20px', margin: '5px' },
      },
    ],
    render: (Html) => Html`<div+styled>Content</div>`,
  });

  assert.ok(
    html.includes('padding: 20px'),
    'Shared should override tag-specific'
  );
});

test('Edge 4: Prop flag with same name as CSS property', async () => {
  const html = await renderElement('edge-prop-name', {
    attrs: {},
    styled: [
      {
        div: {
          base: { display: 'block' },
          flex: { display: 'flex' }, // 'flex' as prop flag name
        },
      },
    ],
    render: (Html) => Html`<div+styled flex>Content</div>`,
  });

  assert.ok(html.includes('display: flex'), 'Prop flag named flex should work');
});

test('Edge 5: Boolean vs value prop flags', async () => {
  const html = await renderElement('edge-bool-value', {
    attrs: {},
    styled: [
      {
        div: {
          base: { color: 'black' },
          highlight: { backgroundColor: 'yellow' },
        },
      },
    ],
    // Boolean attribute (no value) should be truthy
    render: (Html) => Html`<div+styled highlight>Content</div>`,
  });

  assert.ok(
    html.includes('background-color: yellow'),
    'Boolean attr should be truthy'
  );
});

test('Edge 6: Logic function returns null', async () => {
  const html = await renderElement('edge-logic-null', {
    attrs: {},
    styled: [
      { div: { color: 'blue' } },
      { div: (val) => (val ? { color: 'red' } : null) },
    ],
    render: (Html) => Html`<div+styled style=${false}>Content</div>`,
  });

  assert.ok(
    html.includes('color: blue'),
    'Base styles should apply when logic returns null'
  );
});

test('Edge 7: Style value is a number (passed to logic)', async () => {
  const html = await renderElement('edge-number-value', {
    attrs: {},
    styled: [
      { span: { fontSize: '14px' } },
      { span: (val) => ({ fontWeight: val > 50 ? 'bold' : 'normal' }) },
    ],
    render: (Html) => Html`<span+styled style=${75}>Score</span>`,
  });

  assert.ok(
    html.includes('font-weight: bold'),
    'Should handle number value in logic'
  );
});

test('Edge 8: Multiple shared selectors match', async () => {
  const html = await renderElement('edge-multi-shared', {
    attrs: {},
    styled: [
      {
        h2: { fontSize: '24px' },
        'h1, h2': { fontWeight: 'bold' },
        'h2, h3': { color: 'navy' },
        'h1, h2, h3': { margin: '0' },
      },
    ],
    render: (Html) => Html`<h2+styled>Heading</h2>`,
  });

  assert.ok(html.includes('font-size: 24px'), 'Should have tag-specific');
  assert.ok(html.includes('font-weight: bold'), 'Should have first shared');
  assert.ok(html.includes('color: navy'), 'Should have second shared');
  assert.ok(html.includes('margin: 0'), 'Should have third shared');
});

test('Edge 9: Styled works without colors option', async () => {
  const html = await renderElement('no-colors-test', {
    attrs: {},
    styled: [{ div: { color: 'blue' } }],
    // No colors option
    render: (Html) => Html`<div+styled>Content</div>`,
  });

  assert.ok(html.includes('color: blue'), 'Should work without colors option');
});

test('Edge 10: +styled element without explicit style attr gets base styles', async () => {
  const html = await renderElement('edge-auto-style', {
    attrs: {},
    styled: [{ div: { padding: '10px', margin: '5px' } }],
    // No style attribute on the element, but should still get styled
    render: (Html) => Html`<div+styled>Content</div>`,
  });

  assert.ok(
    html.includes('padding: 10px'),
    'Should apply base styles without explicit style attr'
  );
  assert.ok(html.includes('margin: 5px'), 'Should apply all base styles');
});

// ============================================================================
// Coverage: SSR Fallback Paths
// ============================================================================

test('SSR Coverage: +styled without styled config (stringStyledStyle fallback)', async () => {
  // Tests stringStyledStyle fallback when no styled config is provided
  // Covers string-update.js:103-105
  const html = await renderElement('no-styled-ssr', {
    attrs: {},
    // Note: no styled config provided
    render: (Html) =>
      Html`<div+styled style=${{ color: 'blue' }}>Content</div>`,
  });

  // Should fall back to regular style handling
  assert.ok(
    html.includes('style='),
    'Should still render with style attribute'
  );
  assert.ok(html.includes('color: blue'), 'Should pass through inline style');
});

test('SSR Coverage: resolveStylesWithEntry with null styled', async () => {
  // Tests resolveStylesWithEntry fallback when styled is null
  // Covers styled.js:140-141
  const html = await renderElement('null-styled-ssr', {
    attrs: {},
    styled: null, // Explicitly null
    render: (Html) => Html`<div+styled>Content</div>`,
  });

  // Should render without error
  assert.ok(html.includes('<div'), 'Should render the element');
});

test('SSR Coverage: resolveStylesWithEntry with empty styled array', async () => {
  // Tests resolveStylesWithEntry fallback when styled[0] is falsy
  // Covers styled.js:136 branch
  const html = await renderElement('empty-styled-ssr', {
    attrs: {},
    styled: [null], // Array with falsy first element
    render: (Html) =>
      Html`<div+styled style=${{ margin: '10px' }}>Content</div>`,
  });

  // Should passthrough inline styles
  assert.ok(
    html.includes('margin: 10px'),
    'Should passthrough style when styled is invalid'
  );
});

test('SSR Coverage: styled is truthy but not array (return null)', async () => {
  // Tests styled.js:140-141 - return null when styled is not array and no styleValue
  // styled: {} is truthy (passes context check) but not Array (fails validation)
  const html = await renderElement('styled-not-array', {
    attrs: {},
    styled: {}, // Truthy but not an array
    render: (Html) => Html`<div+styled>No style</div>`,
  });

  // Should render without error
  assert.ok(html.includes('<div'), 'Should render element');
  assert.ok(html.includes('No style'), 'Should have content');
});

test('SSR Coverage: static flag with invalid styled config remains attribute', async () => {
  const html = await renderElement('styled-invalid-static-flag', {
    attrs: {},
    styled: {},
    render: (Html) => Html`<div+styled weird>No style</div>`,
  });

  assert.ok(
    html.includes('weird'),
    'Unknown static flag should remain when styled config is invalid'
  );
});

test('SSR Coverage: styled array with falsy first element and no style', async () => {
  // Tests styled.js:140-141 - return null when styled[0] is falsy and no styleValue
  const html = await renderElement('styled-falsy-first', {
    attrs: {},
    styled: [undefined], // Array with falsy first element
    render: (Html) => Html`<span+styled>No styles</span>`,
  });

  // Should render without error
  assert.ok(html.includes('<span'), 'Should render element');
  assert.ok(html.includes('No styles'), 'Should have content');
});

test('SSR Coverage: public styled normalizers handle invalid input', async () => {
  if (!normalizeStyledDefinition) return;

  const split = splitDeclarationAndSelectorKeys(null);
  assert.deepStrictEqual(split.declarations, {});
  assert.deepStrictEqual(split.selectorRules, []);
  assert.strictEqual(split.hasSelectorCss, false);

  const tag = normalizeTagStyle(null);
  assert.deepStrictEqual(tag.baseDeclarations, {});
  assert.strictEqual(tag.variants.size, 0);
  assert.deepStrictEqual(tag.selectorRules, []);
  assert.strictEqual(tag.hasSelectorCss, false);

  const definition = normalizeStyledDefinition(null);
  assert.strictEqual(definition.tags.size, 0);
  assert.deepStrictEqual(definition.sharedGroups, []);
  assert.strictEqual(definition.logic, null);
});

// Run tests if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().then(({ failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  });
}
