# src/lifecycle/ Files

## Directory Structure

```
lifecycle/
├── connectedCallback.js
├── observer.js
├── onNext.js
└── processFragmentResult.js
```

## Files

### `connectedCallback.js`

Core initialization logic. Creates element identifier, sets up manager reference, attaches observers, defines fragment methods (capital-letter methods), and triggers initial render.

### `processFragmentResult.js`

Fragment result processor. Handles text, html, template, and any types from fragment methods. Supports async content via promises with placeholder rendering and re-render on resolution.

### `observer.js`

MutationObserver setup. Watches for attribute changes and content mutations, triggering re-renders when changes are detected.

### `onNext.js`

Reactive re-render factory. Creates a render function that automatically injects store state on each render. Used in `setup()` to enable store-based updates.
