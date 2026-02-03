# Render Module Files

## Directory Structure

```
src/render/
├── index.js              # Public API exports
├── constants.js          # Type flags and shared constants
├── nodes.js              # AST node classes for parsing
├── parser.js             # Template string parser
├── hole.js               # Hole class for template caching
├── update.js             # Update handlers per interpolation type
├── creator.js            # DOM fragment creation
├── resolve.js            # Path-based node traversal
├── diff.js               # Array diffing algorithm
├── keyed.js              # Key tracking for array items
├── persistent-fragment.js # Multi-node fragment handling
└── styled.js             # +styled inline styling system
```

## Files

### `index.js`

Main entry point exporting public API: `html`, `bind`, `wire`, `Hole`, `dom`.

### `constants.js`

Type flags (ATTRIBUTE, EVENT, TEXT, etc.) and shared frozen arrays for memory efficiency.

### `nodes.js`

AST node classes (Node, Comment, Text, Element, Fragment) used by the parser.

### `parser.js`

Template parser using NUL character sentinel pattern. Parses tagged template literals into abstract tree with update instructions.

### `hole.js`

Hole class representing parsed templates with values. Handles first render (`valueOf`) and selective updates (`update`).

### `update.js`

Factory functions creating specialized update handlers based on attribute names and value types.

### `creator.js`

Creates DOM fragments from HTML strings using template element innerHTML.

### `resolve.js`

Resolves DOM nodes from path arrays (child index sequences from root to target).

### `diff.js`

udomdiff algorithm for efficient array reconciliation with multiple fast paths.

### `keyed.js`

WeakMap + WeakRef based key tracking for stable DOM node identity across renders.

### `persistent-fragment.js`

Handles templates with multiple root nodes using comment markers as anchors.

### `styled.js`

+styled inline styling system for react-outline-inspired component styling. Provides base styles keyed by tag name, shared selectors, prop flags for boolean variants, logic functions for dynamic styles, and color palette resolution.
