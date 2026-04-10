/**
 * @file Public catalog API for json-render.
 *
 * Walks the shared component registry and exposes a frozen
 * `CatalogSnapshot` for LLM integration. The snapshot offers three
 * surfaces:
 *
 *   - `.types` — Map of every cataloged component's metadata
 *   - `.prompt(options?)` — natural-language system prompt listing
 *     each component, its props (with types/constraints), children
 *     capability, and actions, plus the `{ root, elements }`
 *     output-format block
 *   - `.toolDefinition(options?)` — Claude/OpenAI JSON Schema tool
 *     definition with an `enum` of every registered type name
 *
 * Aligned with the json-render.dev catalog/schema patterns. The
 * raw component metadata data lives in `catalog-metadata.js`; this
 * file is the public API surface only.
 *
 * @module hyper-element/json-render/catalog
 */

import { registryInterface } from './registry.js';

// Em-dash (U+2014) used in both component and action formatters.
// Declared as a constant so the formatter and the test assertions
// reference the exact same character — preventing accidental drift
// to a hyphen "-" or en-dash "–" which would break substring tests.
const EM_DASH = '—';

/**
 * Recursively freeze an object/array and all its nested members.
 * Used by getCatalog() to ensure cloned catalog entries cannot be
 * mutated by snapshot consumers. Primitives are returned unchanged.
 *
 * @param {*} value - Any value; objects/arrays are frozen in place.
 * @returns {*} The same value, deeply frozen if it's an object/array.
 */
function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

/**
 * Deep-clone a catalog entry via JSON round-trip. Catalog entries are
 * pure JSON data (strings, numbers, booleans, arrays, plain objects)
 * so JSON.parse(JSON.stringify(...)) is semantically equivalent to
 * structuredClone() and avoids any modern-runtime assumptions.
 *
 * @param {Object} catalog - The catalog entry to clone.
 * @returns {Object} A fully independent clone — mutations to the
 *   returned object cannot reach the original.
 */
function cloneCatalog(catalog) {
  return JSON.parse(JSON.stringify(catalog));
}

/**
 * Format a single prop definition into the prompt-friendly form
 * `name (descriptor)`. The descriptor uses the catalog's enum values
 * in place of the type when present, then appends `, required` and
 * `, nullable` flags. Default values are intentionally NOT included
 * to match the PICKUPB.md prompt example which shows `disabled
 * (boolean)` without the `default: false` from the catalog data.
 *
 * @param {string} name - Prop name.
 * @param {Object} def - Prop definition from the catalog metadata.
 * @returns {string} The formatted prop string, e.g. `label (string, required)`.
 */
function formatProp(name, def) {
  const parts = [];
  if (Array.isArray(def.enum) && def.enum.length > 0) {
    parts.push('enum: ' + def.enum.join('|'));
  } else {
    parts.push(def.type);
  }
  if (def.required) parts.push('required');
  if (def.nullable) parts.push('nullable');
  return name + ' (' + parts.join(', ') + ')';
}

/**
 * Format the params object on an action into the prompt-friendly form
 * `name (type), name (type)`. Used by formatAction() for the
 * `Params: ...` suffix on action lines.
 *
 * @param {Object} params - Map of param name → { type } definitions.
 * @returns {string} Comma-separated `name (type)` pairs.
 */
function formatActionParams(params) {
  return Object.entries(params)
    .map(([name, def]) => name + ' (' + def.type + ')')
    .join(', ');
}

/**
 * Format a single action definition into a prompt line:
 *   "actionName — description. Params: param1 (type), ..."
 * The Params clause is omitted when the action has no params.
 *
 * @param {string} name - Action name.
 * @param {Object} def - Action definition with description and optional params.
 * @returns {string} The formatted action line.
 */
function formatAction(name, def) {
  let line = name + ' ' + EM_DASH + ' ' + def.description;
  if (def.params && Object.keys(def.params).length > 0) {
    line += '. Params: ' + formatActionParams(def.params);
  }
  return line;
}

/**
 * Build the per-component block for the prompt output:
 *   "Name — description"
 *   "  Props: prop1 (...), prop2 (...)"     (omitted when no props)
 *   "  Children: yes (default slot) | no"
 *   "  Actions: action1 — ..."              (omitted when no actions)
 *   "           action2 — ..."
 *
 * @param {string} name - Component type name.
 * @param {Object} catalog - Catalog entry { description, props, slots, actions }.
 * @returns {string} The multi-line component block.
 */
function formatComponent(name, catalog) {
  const lines = [name + ' ' + EM_DASH + ' ' + catalog.description];
  const propNames = Object.keys(catalog.props || {});
  if (propNames.length > 0) {
    const props = propNames.map((p) => formatProp(p, catalog.props[p]));
    lines.push('  Props: ' + props.join(', '));
  }
  const hasDefaultSlot =
    Array.isArray(catalog.slots) && catalog.slots.includes('default');
  lines.push('  Children: ' + (hasDefaultSlot ? 'yes (default slot)' : 'no'));
  const actionNames = Object.keys(catalog.actions || {});
  if (actionNames.length > 0) {
    const first = formatAction(actionNames[0], catalog.actions[actionNames[0]]);
    lines.push('  Actions: ' + first);
    for (let i = 1; i < actionNames.length; i++) {
      lines.push(
        '           ' +
          formatAction(actionNames[i], catalog.actions[actionNames[i]])
      );
    }
  }
  return lines.join('\n');
}

// Literal output-format block emitted at the end of every prompt.
// Pinned as a constant so the test file can substring-match it
// without any indentation or whitespace surprises.
const OUTPUT_FORMAT_BLOCK =
  'Output format:\n' +
  '{\n' +
  '  "root": "<key of root element>",\n' +
  '  "elements": {\n' +
  '    "<key>": { "type": "<ComponentName>", "props": {...}, "children": ["<child_key>", ...], "on": { "<action>": { "action": "<name>", "params": {...} } } }\n' +
  '  }\n' +
  '}';

/**
 * Assemble the complete LLM system prompt by joining the four sections
 * with blank-line separators: header → component blocks → output format
 * → optional Rules block. The Rules block is appended only when
 * `options.customRules` is a non-empty array.
 *
 * @param {Map<string, Object>} types - Cataloged types map.
 * @param {Object} [options] - Optional config; `customRules` is appended at end.
 * @returns {string} The complete prompt string.
 */
function buildPrompt(types, options) {
  const sections = [
    'You can render interactive UI using the render_ui tool.\n\nAvailable components:',
  ];
  for (const [name, catalog] of types) {
    sections.push(formatComponent(name, catalog));
  }
  sections.push(OUTPUT_FORMAT_BLOCK);
  if (Array.isArray(options.customRules) && options.customRules.length > 0) {
    sections.push(
      'Rules:\n' + options.customRules.map((r) => '- ' + r).join('\n')
    );
  }
  return sections.join('\n\n');
}

/**
 * Build a Claude/OpenAI-compatible JSON Schema tool definition. The
 * `enum` on `input_schema.properties.elements.additionalProperties
 * .properties.type` lists every cataloged type name in registration
 * order — legacy function-only registrations are absent because
 * getCatalog() already filtered them out.
 *
 * @param {Map<string, Object>} types - Cataloged types map.
 * @param {Object} [options] - Optional config: `name`, `description`.
 * @returns {Object} JSON Schema tool definition object.
 */
function buildToolDefinition(types, options) {
  return {
    name: options.name || 'render_ui',
    description: options.description || 'Render interactive UI components',
    input_schema: {
      type: 'object',
      required: ['root', 'elements'],
      properties: {
        root: { type: 'string', description: 'Key of the root element' },
        elements: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            required: ['type'],
            properties: {
              type: { type: 'string', enum: [...types.keys()] },
              props: { type: 'object' },
              children: { type: 'array', items: { type: 'string' } },
              on: { type: 'object' },
            },
          },
        },
      },
    },
  };
}

/**
 * Immutable snapshot of all cataloged component metadata at the moment
 * getCatalog() was called. The snapshot exposes the raw types Map plus
 * two convenience formatters for LLM integration.
 *
 * The instance itself is frozen — `snapshot.types = ...` is a no-op
 * (or throws in strict mode). Each entry in `.types` is also recursively
 * frozen, so nested mutations like `entry.props.label.required = false`
 * throw a TypeError in strict mode. The Map object itself cannot be
 * natively frozen, so `.types.set('X', {})` is technically possible on
 * the local snapshot — but a subsequent getCatalog() call rebuilds from
 * the untouched live registry, so the registry is never affected.
 */
class CatalogSnapshot {
  /**
   * Build a frozen catalog snapshot wrapping a pre-cloned, pre-frozen
   * Map of cataloged component metadata. Called only by getCatalog();
   * the constructor is not part of the public API.
   *
   * @param {Map<string, Object>} types - Cataloged metadata map. Each
   *   value must already be deep-cloned and recursively frozen by
   *   getCatalog() so the snapshot is safely shareable.
   */
  constructor(types) {
    /**
     * Map<string, CatalogEntry> — every cataloged type at snapshot time.
     * Each entry is a deep-cloned, recursively frozen copy of the
     * registry's catalog metadata. Mutations to the returned entries
     * throw in strict mode and never reach the live registry.
     */
    this.types = types;
    Object.freeze(this);
  }

  /**
   * Build the LLM system prompt for this catalog snapshot.
   * @param {Object} [options] - Optional config.
   * @param {string[]} [options.customRules] - Extra rules appended at end.
   * @returns {string} The complete prompt string.
   */
  prompt(options = {}) {
    return buildPrompt(this.types, options);
  }

  /**
   * Build the JSON Schema tool definition for this catalog snapshot.
   * @param {Object} [options] - Optional config.
   * @param {string} [options.name='render_ui'] - Tool name for the LLM.
   * @param {string} [options.description] - Tool description for the LLM.
   * @returns {Object} JSON Schema tool definition.
   */
  toolDefinition(options = {}) {
    return buildToolDefinition(this.types, options);
  }
}

/**
 * Walk the shared json-render registry and return an immutable
 * `CatalogSnapshot` containing every type that has catalog metadata.
 *
 * Filters out:
 *   - Legacy function-only registrations (registerComponent(type, fn))
 *   - Entries normalized to { render, catalog: null } by index.js
 *
 * Both render correctly via renderSpec() but are intentionally invisible
 * to the LLM — surfacing them in .prompt() / .toolDefinition() would
 * give the LLM types it could emit but whose props have no schema.
 *
 * @returns {CatalogSnapshot} Frozen snapshot with .types, .prompt(), .toolDefinition().
 */
export function getCatalog() {
  const types = new Map();
  for (const typeName of registryInterface.all()) {
    const entry = registryInterface.get(typeName);
    if (!entry || typeof entry === 'function') continue;
    if (!entry.catalog) continue;
    types.set(typeName, deepFreeze(cloneCatalog(entry.catalog)));
  }
  return new CatalogSnapshot(types);
}
