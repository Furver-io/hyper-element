/**
 * @file Shared component registry for json-render.
 *
 * Extracted into its own module to break the circular dependency
 * between index.js and element.js. Both modules need access to
 * the registry: index.js writes to it (via registerComponent()),
 * and element.js reads from it (via registryInterface in render()).
 *
 * By housing the registry here, the dependency graph stays acyclic:
 *   index.js   --> registry.js --> components.js
 *   element.js --> registry.js --> components.js
 *
 * Historical note: before this split, the <json-render> element
 * (then <jr-ui>) constructed its own local registry populated only
 * from BUILT_IN_COMPONENTS. That made custom components registered
 * via registerComponent() invisible to the declarative element path
 * — they worked with programmatic renderSpec() but not inside
 * <json-render> in HTML. Moving the single mutable registry here
 * and routing both call sites through `registryInterface` fixed
 * that split and made the declarative and programmatic paths
 * observe the same catalog at all times.
 *
 * @module hyper-element/json-render/registry
 */

import { BUILT_IN_COMPONENTS } from './components.js';

/**
 * Component registry -- maps type names to component entries.
 *
 * Each entry is either:
 *   - { render: Function, catalog: Object } -- built-in or catalog-registered
 *   - Function -- legacy registerComponent(type, fn) for backward compat
 *
 * Initialized with all built-in types (Card, Button, Text, etc.).
 * Custom types are added via registerComponent() in index.js and
 * become available to all specs rendered after registration.
 *
 * @type {Map<string, { render: Function, catalog?: Object } | Function>}
 */
export const registry = new Map(BUILT_IN_COMPONENTS);

/**
 * Registry interface exposed to the renderer and element.js.
 *
 * Provides a read-only facade over the mutable registry Map.
 * The .get() method returns the raw registry entry (either a
 * { render, catalog } object or a legacy function). The renderer
 * resolves the render function from either shape.
 *
 * The .all() method returns a snapshot array of registered type
 * names -- useful for introspection and validation.
 */
export const registryInterface = {
  /** Look up a registry entry by component type name */
  get: (type) => registry.get(type),
  /** List all registered type names */
  all: () => [...registry.keys()],
};
