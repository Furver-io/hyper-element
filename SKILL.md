---
name: hyper-element
description: A lightweight Custom Elements library with fast built-in render core. Use this skill when helping developers create reactive web components with signals, templates, and SSR support.
---

# hyper-element

A zero-dependency library for creating reactive Custom Elements. Components automatically re-render when attributes or store data changes with efficient DOM updates.

## Installation

```bash
npm install hyper-element
```

```js
import hyperElement from 'hyper-element';
```

## Examples

### Functional API (Recommended)

```js
// Simple component
hyperElement('my-greeting', (Html, ctx) => Html`
  <div>Hello ${ctx.attrs.name}!</div>
`);

// Component with state
hyperElement('my-counter', {
  setup: (ctx, onNext) => {
    const store = { count: 0 };
    const render = onNext(() => store);
    ctx.increment = () => { store.count++; render(); };
  },
  handleClick: (ctx) => ctx.increment(),
  render: (Html, ctx, store) => Html`
    <button onclick=${ctx.handleClick}>
      Count: ${store?.count ?? 0}
    </button>
  `
});
```

### Class-based API

```js
import { hyperElement } from 'hyper-element';

class MyElement extends hyperElement {
  render(Html) {
    Html`<div>Hello ${this.attrs.name}!</div>`;
  }
}
customElements.define('my-element', MyElement);
```

### Template Syntax

```js
// Iteration
Html`<ul>{+each ${items}}<li>{name}</li>{-each}</ul>`;

// Conditionals
Html`{+if ${isLoggedIn}}<p>Welcome!</p>{else}<p>Please login</p>{-if}`;

// Negation
Html`{+unless ${hasErrors}}<p>Valid</p>{-unless}`;

// Index access
Html`<ol>{+each ${items}}<li>{@}: {title}</li>{-each}</ol>`;
```

### Signals (Reactive State)

```js
import { signal, computed, effect, batch } from 'hyper-element';

const count = signal(0);
const doubled = computed(() => count.value * 2);

effect(() => console.log('Count:', count.value));

count.value = 5; // Triggers effect, doubled.value = 10

// Batch multiple updates
batch(() => {
  firstName.value = 'Jane';
  lastName.value = 'Smith';
}); // Effects run once after batch
```

### SSR (Server-Side Rendering)

```js
import { renderElement } from 'hyper-element/ssr/server';

const html = await renderElement('my-card', {
  attrs: { name: 'Alice' },
  store: { role: 'Admin' },
  render: (Html, ctx) => Html`
    <div class="card">
      <h2>${ctx.attrs.name}</h2>
      <span>${ctx.store.role}</span>
    </div>
  `
});
```

### Passing Functions to Child Elements

```js
hyperElement('parent-elem', {
  handleAction: (ctx, value) => console.log('Action:', value),
  render: (Html, ctx) => Html`
    <child-elem onaction=${ctx.handleAction} />
  `
});
```

### External Store Integration (Redux/MobX/Backbone)

```js
setup(attachStore) {
  store.subscribe(attachStore(store.getState));
}
```

### Rendering Trusted HTML (Html.raw)

```js
// Render HTML from a trusted source (e.g., sanitized markdown)
render(Html) {
  const trustedHtml = marked.parse(sanitizedMarkdown);
  Html`<article>${Html.raw(trustedHtml)}</article>`;
}
// WARNING: Never use Html.raw() with unsanitized user input - XSS risk!
```

### Custom Events (Component Communication)

```js
// Child dispatches custom event
hyperElement('child-input', {
  setup: (ctx, onNext) => {
    ctx.handleChange = (e) => {
      ctx.element.dispatchEvent(new CustomEvent('validated', {
        bubbles: true,
        detail: { value: e.target.value, valid: e.target.value.length > 0 }
      }));
    };
  },
  render: (Html, ctx) => Html`<input oninput=${ctx.handleChange} />`
});

// Parent listens for custom event
hyperElement('parent-form', {
  setup: (ctx) => {
    ctx.onValidated = (e) => console.log('Validated:', e.detail);
  },
  render: (Html, ctx) => Html`<child-input onvalidated=${ctx.onValidated} />`
});
```

### Data Fetching

```js
hyperElement('user-profile', {
  setup: (ctx, onNext) => {
    const state = { user: null, loading: true, error: null };
    const render = onNext(() => state);

    fetch(`/api/users/${ctx.attrs.userId}`)
      .then(res => res.json())
      .then(user => { state.user = user; state.loading = false; render(); })
      .catch(err => { state.error = err.message; state.loading = false; render(); });
  },
  render: (Html, ctx, state) => Html`
    {+if ${state.loading}}<div>Loading...</div>{-if}
    {+if ${state.error}}<div>Error: ${state.error}</div>{-if}
    {+if ${state.user}}<h2>${state.user.name}</h2>{-if}
  `
});
```

## Context Properties

| Property | Description |
|----------|-------------|
| `ctx.attrs` | Parsed attributes with automatic type coercion |
| `ctx.dataset` | Dataset proxy with automatic JSON parsing |
| `ctx.store` | Store value from setup |
| `ctx.element` | DOM element reference |
| `ctx.wrappedContent` | Text content between tags |

## Guidelines

- Use `Html.wire(obj, ':id')` for rendering arrays - ensures efficient DOM reuse
- Prefer functional API over class-based for simpler components
- Use signals (signal, computed, effect) for reactive state outside components
- Return cleanup function from `setup()` for resources that need disposal
- Use `batch()` when updating multiple signals to trigger effects once

## Anti-Patterns

- **NEVER** inline HTML strings in maps - creates XSS vulnerability and poor performance:
  ```js
  // BAD - XSS risk!
  Html`<ul>${users.map(u => `<li>${u.name}</li>`)}</ul>`;

  // GOOD - Safe and efficient
  Html`<ul>${users.map(u => Html.wire(u, ':item')`<li>${u.name}</li>`)}</ul>`;
  ```

- **NEVER** mutate dataset objects directly - use assignment:
  ```js
  // BAD - mutation doesn't trigger update
  this.dataset.user.name = 'Alice';

  // GOOD - assignment triggers update
  this.dataset.user = { name: 'Alice' };
  ```

## json-render (Spec-Driven UI)

Render flat JSON specs into live DOM trees. Designed for LLM tool calls
that produce structured UI via the `render_ui` tool.

### Quick Start

```js
// Auto-registers <jr-ui> custom element
import 'hyper-element/json-render';
```

```html
<link rel="stylesheet" href="hyper-element/src/json-render/json-render.css">
<jr-ui data-spec='{"root":"msg","elements":{"msg":{"type":"Text","props":{"content":"Hello!"}}}}'></jr-ui>
```

### API

```js
import { renderSpec, registerComponent, validateSpec } from 'hyper-element';

// Render a spec inside a hyper-element component
hyperElement('my-view', (Html, ctx) => {
  const spec = JSON.parse(ctx.attrs['data-spec']);
  return renderSpec(Html, spec, ctx.element);
});

// Register a custom component type
registerComponent('MyChart', (Html, def, key, kids, hostEl) =>
  Html.wire(def, ':' + key)`<div class="chart">${def.props?.data}</div>`
);

// Validate a spec
const { valid, errors } = validateSpec(spec);
```

### Built-in Components

| Type | Props | Events |
|------|-------|--------|
| Card | title, description | — |
| Row | gap | — |
| Column | gap | — |
| Button | label, variant, disabled, loading | on.press → jr-action |
| Text | content, variant | — |
| Alert | variant, message | — |
| Progress | label, value (0-100) | — |
| Divider | — | — |
| CodeBlock | language, code | — |
| Image | src, alt, width, height | — |
| Checklist | label, items | checkbox → jr-action |
| TextField | label, placeholder, maxLength | on.submit → jr-action |

### Events

Interactive components dispatch `jr-action` CustomEvent:

```js
document.querySelector('jr-ui').addEventListener('jr-action', (e) => {
  console.log(e.detail.action);  // "approve"
  console.log(e.detail.params);  // { id: "123" }
});
```

### Theming

Override `--jr-*` CSS custom properties:

```css
:root {
  --jr-accent: #3b82f6;
  --jr-text: #e4e4e7;
  --jr-border: rgba(255,255,255,0.08);
}
```

