/**
 * @file Parse and transform block syntax in Html tagged templates.
 * Transforms {+each}, {+if}, {+unless} into efficient DOM operations.
 */

/**
 * Detects if template strings contain block syntax.
 * @param {TemplateStringsArray} strings - Template literal static strings
 * @returns {boolean} True if block pattern is found
 */
export function hasEachBlocks(strings) {
  return strings.some(
    (s) =>
      s.includes('{+each ') ||
      s.includes('{+each{') ||
      s.includes('{+if ') ||
      s.includes('{+unless ')
  );
}

/**
 * Resolves dot-path on object.
 * @param {Object} obj - Target object
 * @param {string} path - Dot-separated path
 * @returns {any} Resolved value
 */
function resolvePropertyPath(obj, path) {
  return path.split('.').reduce((o, key) => o?.[key], obj);
}

/**
 * Parses property references from string.
 * @param {string} str - String with {property} patterns
 * @returns {{ parts: string[], props: string[] }} Split parts and props
 */
function parsePropertyReferences(str) {
  const regex = /\{(@|\s*\.\.\.\s*|\w+(?:\.\w+)*)\}/g;
  const parts = [],
    props = [];
  let lastIndex = 0,
    match;
  while ((match = regex.exec(str)) !== null) {
    parts.push(str.substring(lastIndex, match.index));
    props.push(match[1]);
    lastIndex = regex.lastIndex;
  }
  parts.push(str.substring(lastIndex));
  return { parts, props };
}

/**
 * Finds matching closing tag tracking nesting depth.
 * @param {string[]} strings - Template strings
 * @param {number} startIdx - Start index
 * @param {number} startPos - Start position
 * @param {string} openTag - Opening tag
 * @param {string} closeTag - Closing tag
 * @returns {{ endIdx: number, endPos: number }} End position
 */
function findMatchingClose(strings, startIdx, startPos, openTag, closeTag) {
  let depth = 1;
  for (let i = startIdx; i < strings.length; i++) {
    const str = strings[i];
    let searchStart = i === startIdx ? startPos : 0;
    while (searchStart < str.length) {
      const openPos = str.indexOf(openTag, searchStart);
      const closePos = str.indexOf(closeTag, searchStart);
      if (closePos !== -1 && (openPos === -1 || closePos < openPos)) {
        if (--depth === 0) return { endIdx: i, endPos: closePos };
        searchStart = closePos + closeTag.length;
      } else if (openPos !== -1) {
        depth++;
        searchStart = openPos + openTag.length;
      } else break;
    }
  }
  throw new Error(`Unclosed ${openTag} block. Missing ${closeTag}.`);
}

/**
 * Builds tagged template array with raw property.
 * @param {string[]} parts - String parts
 * @returns {TemplateStringsArray} Array with raw
 */
function buildTemplateStrings(parts) {
  const arr = [...parts];
  arr.raw = [...parts];
  return arr;
}

/** Cache for wrapping primitives so wire can use them as keys */
const primitiveWrappers = new WeakMap();

/**
 * Gets/creates wrapper for item to use as wire key.
 * @param {any} item - Array item
 * @param {number} index - Item index
 * @param {any[]} array - Parent array
 * @returns {Object} Wire key object
 */
function getWireKey(item, index, array) {
  if (item !== null && typeof item === 'object') return item;
  let cache = primitiveWrappers.get(array);
  if (!cache) {
    cache = {};
    primitiveWrappers.set(array, cache);
  }
  if (!cache[index]) cache[index] = { _value: item, _index: index };
  cache[index]._value = item;
  return cache[index];
}

/**
 * Resolves a property reference.
 * @param {string} prop - Property path
 * @param {any} item - Current item
 * @param {number} index - Current index
 * @returns {any} Resolved value
 */
function resolveProp(prop, item, index) {
  if (prop === '@') return index;
  if (prop.trim() === '...') return item;
  return resolvePropertyPath(item, prop);
}

/**
 * Processes inner content of an each block.
 * @param {string} content - Inner template content
 * @param {any} item - Current item
 * @param {number} index - Current index
 * @param {any[]} array - Parent array
 * @param {Function} wireFunction - Html.wire function
 * @returns {any} Wire result
 */
function processInnerContent(content, item, index, array, wireFunction) {
  const nestedRegex = /\{\+each\s*\{(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{-each\}/g;
  const hasNested = nestedRegex.test(content);
  nestedRegex.lastIndex = 0;

  if (hasNested) {
    const nestedMatches = [];
    let processedContent = content,
      match;
    while ((match = nestedRegex.exec(content)) !== null) {
      const [fullMatch, propPath, innerContent] = match;
      const nestedArray = resolvePropertyPath(item, propPath);
      if (!Array.isArray(nestedArray)) {
        processedContent = processedContent.replace(fullMatch, '');
        continue;
      }
      const nestedResults = nestedArray.map((nestedItem, nestedIndex) =>
        processInnerContent(
          innerContent.trim(),
          nestedItem,
          nestedIndex,
          nestedArray,
          wireFunction
        )
      );
      processedContent = processedContent.replace(
        fullMatch,
        `__NESTED_${nestedMatches.length}__`
      );
      nestedMatches.push(nestedResults);
    }
    const { parts, props } = parsePropertyReferences(processedContent);
    const finalParts = [],
      finalValues = [];
    let propIndex = 0;
    for (let i = 0; i < parts.length; i++) {
      let part = parts[i],
        placeholderMatch;
      while ((placeholderMatch = part.match(/__NESTED_(\d+)__/))) {
        const [before, after] = part.split(placeholderMatch[0]);
        finalParts.push(before);
        finalValues.push(nestedMatches[parseInt(placeholderMatch[1], 10)]);
        part = after || '';
      }
      finalParts.push(part);
      if (i < props.length)
        finalValues.push(resolveProp(props[propIndex++], item, index));
    }
    return wireFunction(
      getWireKey(item, index, array),
      JSON.stringify(finalParts)
    )(buildTemplateStrings(finalParts), ...finalValues);
  }

  const { parts, props } = parsePropertyReferences(content);
  if (props.length === 0)
    return wireFunction(
      getWireKey(item, index, array),
      JSON.stringify([content])
    )(buildTemplateStrings([content]));
  const values = props.map((prop) => resolveProp(prop, item, index));
  return wireFunction(getWireKey(item, index, array), JSON.stringify(parts))(
    buildTemplateStrings(parts),
    ...values
  );
}

/**
 * Finds first block opening in string.
 * @param {string} str - String to search
 * @returns {{ type: string, pos: number, pattern: string } | null} Block info
 */
function findFirstBlock(str) {
  const blocks = [
    { type: 'each', pattern: '{+each ' },
    { type: 'if', pattern: '{+if ' },
    { type: 'unless', pattern: '{+unless ' },
  ];
  let first = null;
  for (const block of blocks) {
    const pos = str.indexOf(block.pattern);
    if (pos !== -1 && (first === null || pos < first.pos))
      first = { type: block.type, pos, pattern: block.pattern };
  }
  return first;
}

/**
 * Transforms Html tagged template with block syntax into Html.wire() calls.
 * @param {TemplateStringsArray} strings - Template literal static strings
 * @param {any[]} values - Template literal interpolated values
 * @param {Function} wireFunction - Html.wire function reference
 * @returns {{ strings: TemplateStringsArray, values: any[] }} Transformed parts
 */
export function transformEachBlocks(strings, values, wireFunction) {
  const resultStrings = [],
    resultValues = [];
  let i = 0;
  while (i < strings.length) {
    const str = strings[i],
      firstBlock = findFirstBlock(str);
    if (!firstBlock) {
      resultStrings.push(str);
      if (i < values.length) resultValues.push(values[i]);
      i++;
      continue;
    }
    const { type, pos: blockStartPos, pattern } = firstBlock;
    const closeTag = `{-${type}}`;
    resultStrings.push(str.substring(0, blockStartPos));
    const blockValue = values[i],
      nextStr = strings[i + 1];
    if (!nextStr || !nextStr.startsWith('}'))
      throw new Error(`{+${type}} syntax error: expected "}" after value`);
    const afterClose = nextStr.substring(1);
    const { endIdx, endPos } = findMatchingClose(
      strings,
      i + 1,
      1,
      pattern.slice(0, -1),
      closeTag
    );
    let innerContent,
      elseContent = '';
    if (endIdx === i + 1) innerContent = afterClose.substring(0, endPos - 1);
    else {
      innerContent = afterClose;
      for (let j = i + 2; j <= endIdx; j++) {
        innerContent +=
          String(values[j - 1] ?? '') +
          (j < endIdx ? strings[j] : strings[j].substring(0, endPos));
      }
    }
    if (type === 'if' || type === 'unless') {
      const elsePos = innerContent.indexOf('{else}');
      if (elsePos !== -1) {
        elseContent = innerContent.substring(elsePos + 6);
        innerContent = innerContent.substring(0, elsePos);
      }
    }
    let blockResult;
    /**
     * Trims leading whitespace only, preserving trailing for spacing.
     * @param {string} s - String to trim
     * @returns {string} String with leading whitespace removed
     */
    const trimLeading = (s) => s.replace(/^\s+/, '');
    if (type === 'each') {
      if (!Array.isArray(blockValue) && blockValue != null)
        throw new Error(`{+each} expects an array, got ${typeof blockValue}`);
      blockResult = (blockValue || []).map((item, idx) =>
        processInnerContent(
          trimLeading(innerContent),
          item,
          idx,
          blockValue || [],
          wireFunction
        )
      );
    } else if (type === 'if')
      blockResult = blockValue
        ? { html: trimLeading(innerContent) }
        : { html: trimLeading(elseContent) };
    else if (type === 'unless')
      blockResult = blockValue
        ? { html: trimLeading(elseContent) }
        : { html: trimLeading(innerContent) };
    resultValues.push(blockResult);
    const afterBlock = strings[endIdx].substring(endPos + closeTag.length);
    i = endIdx;
    if (findFirstBlock(afterBlock)) {
      strings = [
        ...strings.slice(0, endIdx),
        afterBlock,
        ...strings.slice(endIdx + 1),
      ];
      values = [...values.slice(0, endIdx), ...values.slice(endIdx)];
    } else {
      resultStrings.push(afterBlock);
      if (endIdx < values.length) resultValues.push(values[endIdx]);
      i = endIdx + 1;
    }
  }
  while (resultStrings.length <= resultValues.length) resultStrings.push('');
  return { strings: buildTemplateStrings(resultStrings), values: resultValues };
}
