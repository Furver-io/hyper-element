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
