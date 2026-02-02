# SSR Hydration with Event Replay for hyper-element

## Request (Verbatim)

Implement progressive hydration with event replay for SSR-rendered web components. Similar to Qwik's "resumability" but for Custom Elements.

### The Problem
With SSR, HTML arrives with web component tags containing static markup. Between page render and component hydration, users can interact with elements but nothing happens - clicks are lost, input is lost.

### Proposed Solution: Three-Phase Hydration
```
Phase 1: CAPTURE (hyper-element in <head>)
    ↓
Phase 2: BUFFER (user interacts with SSR markup)
    ↓
Phase 3: REPLAY (after customElements.define + first render)
```

---

## Requirements (Confirmed by User)

### Event Capture Scope
1. **Events to capture**: All interactive events (click, input, change, submit, keydown, focus, blur, touch events)
2. **Window scroll**: NOT tracked
3. **Scope**: Automatic for any unregistered custom element tag
4. **Element scope**: Only custom elements & elements INSIDE them

### Structural Matching
4. **Priority order**: Walking the tree with `tagName` + `nth-of-type` index
5. **Unmatched elements**: Log a warning

### Timing & Replay
6. **When to replay**: Immediately after first `render()` completes
7. **Replay timing**: All instantly (no timing gaps preserved)
8. **Buffer time**: Replay ALL events (no max buffer time)

### State Preservation
9. **Input/textarea/select**: Replay input events, let component derive state
10. **Checkbox/radio**: Capture checked state
11. **Scroll position within component**: Capture and restore

### API & Developer Experience
12. **Lifecycle hooks**: YES
    - `onBeforeHydrate(bufferedEvents)` - can filter/modify events
    - `onAfterHydrate()`
13. **Hydration status API**: NO (not needed)
14. **Global config**: `events` (all captured by default, configurable) + `devMode` (false by default)

### Visual Feedback
15. **Capture mode indicator**: Opt-in for development only
16. **Captured event feedback**: Handled as normal via CSS (component author responsibility)

### Edge Cases
17. **Nested custom elements replay order**: Same as DOM bubble (inner elements first, then outer)

---

## Research Covered

- [x] Current hyper-element architecture and lifecycle
- [x] How `connectedCallback` and first render work
- [x] Current event handling patterns
- [x] MutationObserver usage for attributes
- [x] Build/bundle structure

---

## Research Findings

### Core Architecture
- **Main class:** `src/hyperElement.js` (lines 35-139)
- **Lifecycle entry:** `src/lifecycle/connectedCallback.js` (lines 168-311)
- **Manager:** `src/core/manager.js` - Global object keyed by Symbol identifiers
- **Render core:** `src/render/` - Custom uhtml-inspired implementation

### Lifecycle Flow (Critical for SSR)
1. `connectedCallback` → `createdCallback.call(this)`
2. Creates Symbol identifier, caches `innerHTML` in `ref.innerHTML`
3. Sets up MutationObserver (watches ALL attributes/content)
4. Wraps `render()` to disable observer during render (`ref.observe = false`)
5. Calls `setup()` if defined
6. **Line 310: `this.render()` - SYNCHRONOUS first render**
7. Observer re-enabled on next tick via `setTimeout(() => ref.observe = true, 0)`

### Key Insight: First Render is Synchronous
- Completes in call stack before `connectedCallback` returns
- **No "render complete" event** - must use setTimeout/microtask
- Observer disabled during render prevents feedback loops

### Event Handling
- Two syntaxes: `onclick=${handler}` (property) and `@click=${handler}` (addEventListener)
- Factory in `src/render/update.js` (lines 251-317)
- Functions passed to child custom elements stored in `sharedAttrs` map
- No event delegation - events attached to individual elements

### Build System
- Custom esbuild script: `scripts/build.js`
- Single IIFE bundle: `build/hyperElement.min.js` (~6.2KB)
- **No SSR support currently** - browser-only
- Zero runtime dependencies

---

## Errors & Failed Approaches

(None yet)

---

## Session Log

- 2026-01-26: Request logged, clarifying questions answered by user
- 2026-01-26: Explored codebase (lifecycle, events, build system)
- 2026-01-26: Designed implementation plan with Plan agent
- 2026-01-26: Verified integration points in connectedCallback.js:310 and build.js
- 2026-01-26: Final plan written, awaiting approval

---

## Architecture

(To be designed after exploration)

---

## Tasks & Sub-tasks

(To be defined after planning)
