#!/usr/bin/env node
/**
 * @file Build script for hyper-element.
 * Creates a single universal bundle that works on both server and client.
 * Auto-detects environment and exports appropriate APIs.
 */

const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');
const { writeBundleOutputs } = require('./build-helpers.js');

const srcDir = path.join(__dirname, '..', 'src');
const buildDir = path.join(__dirname, '..', 'build');

// prettier-ignore
const sharedFiles = ['core/constants.js', 'core/manager.js', 'utils/makeid.js', 'utils/escape.js', 'render/constants.js', 'render/nodes.js', 'render/keyed.js', 'render/parser-helpers.js', 'styled/reserved.js', 'render/parser.js', 'signals/index.js', 'attributes/parseAttribute.js', 'styled/serializer.js', 'styled/normalize.js', 'styled/artifact-ids.js', 'styled/artifact-colors.js', 'styled/artifact-tags.js', 'styled/artifact-rules.js', 'styled/artifact-direct.js', 'styled/artifact-compose.js', 'styled/artifact.js', 'styled/style-host.js', 'styled/define-styled.js', 'template/processAdvancedTemplate.js', 'html/parseEachBlocks.js'];

// prettier-ignore
const browserFiles = ['render/creator.js', 'render/resolve.js', 'render/diff.js', 'render/persistent-fragment.js', 'render/comment.js', 'render/update.js', 'render/hole.js', 'render/index.js', 'styled/parser-hooks.js', 'styled/registry.js', 'styled/resolution.js', 'styled/apply.js', 'styled/handler.js', 'template/buildTemplate.js', 'attributes/dataset.js', 'attributes/attachAttrs.js', 'html/createHtml.js', 'ssr/pathResolver.js', 'ssr/buffer.js', 'ssr/devIndicator.js', 'ssr/capture.js', 'ssr/replay.js', 'ssr/index.js', 'lifecycle/onNext.js', 'lifecycle/observer.js', 'lifecycle/processFragmentResult.js', 'lifecycle/connectedCallback.js', 'hyperElement.js', 'functional.js', 'withOptions.js', 'layout/positions.js', 'layout/engine.js', 'layout/geometry.js', 'layout/dom.js', 'layout/styles.js', 'layout/removal.js', 'layout/interactions.js', 'layout/properties.js', 'layout/events.js', 'layout/state.js', 'layout/element.js', 'layout/index.js', 'json-render/validator.js', 'json-render/catalog-metadata.js', 'json-render/checklist-state.js', 'json-render/component-helpers.js', 'json-render/components.js', 'json-render/registry.js', 'json-render/catalog.js', 'json-render/renderer.js', 'json-render/bridge.js', 'json-render/index.js', 'json-render/element.js'];

// prettier-ignore
const ssrServerFiles = ['ssr/styled-update.js', 'ssr/string-update.js', 'ssr/styled-render.js', 'ssr/string-render.js', 'ssr/ssr-html.js', 'ssr/render-element.js'];

/**
 * Reads a file and strips ES module import/export statements.
 * @param {string} filePath - Path to the file
 * @param {boolean} [browserOnly=false] - If true, convert to browser-safe format
 * @returns {string} File content with imports/exports removed
 */
function processFile(filePath, browserOnly = false) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(
    /^import\s+\{[\s\S]*?\}\s+from\s+['"].*?['"];?\s*$/gm,
    ''
  );
  content = content.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '');
  content = content.replace(/^import\s+['"].*?['"];?\s*$/gm, '');
  content = content.replace(
    /^export\s+(?:async\s+)?(?:const|let|var|function|class)\s+/gm,
    (m) => m.replace(/^export\s+/, '')
  );
  content = content.replace(
    /^export\s+\{[\s\S]*?\}(?:\s+from\s+['"].*?['"])?;?\s*$/gm,
    ''
  );
  content = content.replace(/^export\s+default\s+/gm, '');
  content = content.replace(/\/\*\*[\s\S]*?\*\//g, '');
  content = content.replace(/^\s*\/\/.*$/gm, '');
  if (browserOnly) content = content.replace(/^(const|let)\s+/gm, 'var ');
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
  return content.trim();
}

/**
 * Creates the universal bundle that works on server and client.
 * Also generates source map data for mapping back to original src/ files.
 * @returns {{ content: string, mappings: Array }} Bundle content and source mappings
 */
function createBundle() {
  const parts = [],
    mappings = [];
  let currentLine = 1;
  function addPart(content, sourceFile = null) {
    if (sourceFile) {
      mappings.push({
        file: `src/${sourceFile}`,
        startLine: currentLine,
        lineCount: content.split('\n').length,
      });
    }
    parts.push(content);
    currentLine += content.split('\n').length;
  }

  /*
   * UMD wrapper with environment detection. The AMD branch is retained for
   * package compatibility even though browser E2E covers the global path.
   */
  addPart(`// hyper-element v${pkg.version} - universal bundle (server + client)
(function (root, factory) {
  var isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  var isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

  if (typeof module === 'object' && module.exports) {
    module.exports = factory(isBrowser);
  /* AMD is not tested */
  } else if (typeof define === 'function' && define.amd) {
    define(function() { return factory(isBrowser); });
  } else {
    var exports = factory(isBrowser);
    if (isBrowser) {
      root.hyperElement = exports.default;
      root.configureSSR = exports.configureSSR;
      root.signal = exports.signal;
      root.computed = exports.computed;
      root.effect = exports.effect;
      root.batch = exports.batch;
      root.untracked = exports.untracked;
      root.withOptions = exports.withOptions;
      root.defineStyled = exports.defineStyled;
      root.html = exports.html;
      root.bind = exports.bind;
      root.dom = exports.dom;
      root.renderSpec = exports.renderSpec;
      root.registerComponent = exports.registerComponent;
      root.validateSpec = exports.validateSpec;
      root.listComponentTypes = exports.listComponentTypes;
      root.BUILT_IN_COMPONENTS = exports.BUILT_IN_COMPONENTS;
      root.getCatalog = exports.getCatalog;
      root.hyperLayoutElement = exports.hyperLayoutElement;
      root.createLayoutEngine = exports.createLayoutEngine;
      root.normalizePositions = exports.normalizePositions;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function (isBrowser) {
  'use strict';

`);

  function addFiles(files, indent, browserOnly) {
    for (const file of files) {
      const filePath = path.join(srcDir, file);
      if (!fs.existsSync(filePath)) {
        console.warn(`Warning: ${file} not found`);
        continue;
      }
      let content = processFile(filePath, browserOnly);
      if (browserOnly) {
        content = content.replace(
          /^class\s+(\w+)(\s+extends\s+\w+)?\s*\{/gm,
          '$1 = class$2 {'
        );
        content = content.replace(/^function\s+(\w+)\s*\(/gm, '$1 = function(');
      }
      addPart(
        `\n${indent}// ${file}\n` +
          content
            .split('\n')
            .map((l) => (l ? indent + l : ''))
            .join('\n'),
        file
      );
    }
  }

  addFiles(sharedFiles, '  ', false);
  addPart(`
  var hyperElement, createFunctionalElement, configureSSR, withOptions;
  var createFragment, resolve, diff, diffFragment, PersistentFragment, nodes;
  var update, Hole, render, dom, createHtml, isKeyed, isTemplateHole, html, bind, wire;
  var setRenderingInstance, getRenderingInstance, registerStyled, unregisterStyled, getStyledEntry;
  var resolveStylesWithEntry, resolveStyles, applyStylesToNode, resolveColors, isNestedSyntax, styledStyleHandler;
  var getStyledNodeState, applyInlineDiff, applyClassDiff, applyStyledArtifactToNode;
  var isReservedStyledAttr;
  var getInstanceForNode, applyStyledNode, styledCssHandler, isKnownVariant, styledAttributeHandler;
  var STYLED_SUFFIX;
  var buildTemplate, addDataset, getDataset, attachAttrs, processFragmentResult;
  var pathResolver, ssrBuffer, showDevIndicator, hideDevIndicator;
  var getNthOfTypeIndex, calculatePath, resolvePath, addToBuffer, getBufferedEvents, clearBuffer;
  var isUnregisteredCustomElement, findCustomElementAncestor, extractEventDetail;
  var captureScrollState, captureCheckedState, handleCapturedEvent, restoreElementState;
  var startCapture, replayEvents, initSSR, ssrState, markTagRegistered, createSyntheticEvent;
  var onNext, observer, createdCallback;
  var renderSpec, registerComponent, validateSpec, listComponentTypes, BUILT_IN_COMPONENTS, renderNode, renderSpecTree, registry, registryInterface, getCatalog, createBridgedRenderFn, registerJrType;
  var CatalogSnapshot, EM_DASH, OUTPUT_FORMAT_BLOCK, deepFreeze, cloneCatalog, formatProp, formatActionParams, formatAction, formatComponent, buildPrompt, buildToolDefinition, propToSchema, componentBranch;
  var getKnownTypes;
  var CATALOG, entry;
  var fingerprintItems, getChecklistState;
  var propText, dispatchAction, renderCard, renderRow, renderColumn, renderButton, renderText, renderAlert, renderProgress, renderDivider, renderCodeBlock, renderImage, renderChecklist, renderTextField;
  var HyperLayoutEngine, createLayoutEngine, hyperLayoutElement;
  var parseLayoutValue, normalizeItems, normalizePositions, reconcilePositions, serializePositions, normalizePositionItem, normalizeCan, applyCapabilities, clampNumber;
  var resolveColumns, measureGrid, nodeToPixels, deltaToMove, deltaToSize, isOutsideHost;
  var intersects, overlapRatio, touches;
  var layoutChildren, wrapLayoutChildren, createLayoutOverlay, syncLayoutOverlay, createDefaultOverlay, configureOverlayElement, setSharedOverlayAttr, startOverlayAction, toggleCapability, ensureLayoutStyles, REMOVAL_PREVIEW_SCALE, isOverTrash, isCoveringTrash, updateRemovalPreview, clearRemovalPreview, trashTargets, pointInRect, scaledRemovalRect, removalLayoutRect, rectsOverlap, setRemovalPreview, createLayoutInteractions, actionFromPointer, isBlocked, isResizeCorner, floatWrapper, previewDragNode, updateDragPlaceholder, hideDragPlaceholder, coveredTarget, dragTargetKey, layoutRect, rectCoverage, reconcileLayout, applyResponsiveColumns, emitReconcileEvents, pruneRemovedWrappers;
  var defineLayoutOnChange, defineLayoutOnRemoved, defineLayoutCallback, emitLayoutEvent, commitLayoutChange, currentLayoutPositions, ensureLayoutPlaceholder;
  var defineLayoutProperties, readSharedLayoutAttribute, readLayoutAttribute, requestLayoutReconcile;
`);
  addPart(`\n  if (isBrowser) {`);
  addFiles(browserFiles, '    ', true);
  addPart(`\n  }`);
  addFiles(ssrServerFiles, '  ', false);

  addPart(`
  var isBrowserEnv = typeof window !== 'undefined' && typeof document !== 'undefined';
  if (isBrowserEnv) {
    console.info('hyper-element v${pkg.version} by ${pkg.author}');
    var hyperElementProxy = new Proxy(hyperElement, {
      get: function(target, prop, receiver) {
        if (prop === 'prototype') return target.prototype;
        return Reflect.get(target, prop, receiver);
      },
      apply: function(target, thisArg, args) {
        if (args.length === 0) throw new Error('hyperElement requires a definition object or render function');
        return createFunctionalElement.apply(null, args);
      },
      construct: function(target, args, newTarget) {
        if (newTarget !== hyperElementProxy) return Reflect.construct(target, args, newTarget);
        throw new Error('hyperElement cannot be instantiated directly. Use class extension or functional API.');
      }
    });
    hyperElementProxy.configureSSR = configureSSR;
    return { default: hyperElementProxy, hyperElement: hyperElementProxy, configureSSR: configureSSR,
      signal: signal, computed: computed, effect: effect, batch: batch, untracked: untracked, withOptions: withOptions,
      defineStyled: defineStyled,
      renderSpec: renderSpec, registerComponent: registerComponent, validateSpec: validateSpec,
      listComponentTypes: listComponentTypes, BUILT_IN_COMPONENTS: BUILT_IN_COMPONENTS,
      getCatalog: getCatalog,
      hyperLayoutElement: hyperLayoutElement,
      createLayoutEngine: createLayoutEngine,
      normalizePositions: normalizePositions,
      html: html, bind: bind, dom: dom };
  } else {
    return { renderElement: renderElement, renderElements: renderElements, createRenderer: createRenderer,
      renderToString: renderToString, ssrHtml: ssrHtml, createSSRHtml: createSSRHtml,
      createSSRTemplate: createSSRTemplate, escapeHtml: escapeHtml, safeHtml: safeHtml,
      signal: signal, computed: computed, effect: effect, batch: batch, untracked: untracked,
      stringCommentArray: stringCommentArray, stringUnsafe: stringUnsafe,
      processAdvancedTemplate: processAdvancedTemplate, replayEvents: replayEvents };
  }
});
`);

  return { content: parts.join('\n'), mappings };
}

/**
 * Builds the minified production bundle using esbuild.
 */
async function build() {
  try {
    await writeBundleOutputs({ buildDir, createBundle });
  } catch (e) {
    console.error('Error building bundle:', e);
    process.exit(1);
  }
}

build();
