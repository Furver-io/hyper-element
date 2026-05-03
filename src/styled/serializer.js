/**
 * @file CSS serialization helpers for selector-capable +styled artifacts.
 * The styled renderer uses this module whenever style data leaves the inline
 * CSSOM path and becomes scoped stylesheet text owned by a hyper-element root.
 */

/**
 * Converts JavaScript style property names to CSS property names while keeping
 * custom properties intact. Browser CSSOM and SSR output both need the same
 * conversion so inline and generated declarations stay visually equivalent.
 *
 * @param {string} prop - CSS property in camelCase, kebab-case, or custom form.
 * @returns {string} Kebab-case property name suitable for CSS text/CSSOM.
 */
export function toKebab(prop) {
  if (prop.startsWith('--')) return prop;
  return prop.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

/**
 * Serializes declaration objects into stable CSS declaration lines. Nullish and
 * empty-string values are omitted because they mean "remove this managed style"
 * in the browser diff path and should not produce invalid generated CSS.
 *
 * @param {Record<string, string|number|null|undefined>} declarations
 * @returns {string[]} CSS declaration lines without surrounding braces.
 */
export function serializeDeclarationLines(declarations) {
  if (!declarations || typeof declarations !== 'object') return [];
  const lines = [];
  for (const [prop, value] of Object.entries(declarations)) {
    if (value == null || value === '') continue;
    lines.push(`  ${toKebab(prop)}: ${String(value)};`);
  }
  return lines;
}

/**
 * Serializes declaration objects for inline style attributes. SSR still needs
 * this legacy format for selector-free +styled data and for ordinary native
 * style attributes.
 *
 * @param {Record<string, string|number|null|undefined>} declarations
 * @returns {string} Inline CSS declaration string.
 */
export function serializeInlineDeclarations(declarations) {
  return serializeDeclarationLines(declarations)
    .map((line) => line.trim().slice(0, -1))
    .join('; ');
}

/**
 * Splits selector lists without splitting commas inside brackets, parentheses,
 * or quoted strings. This protects selectors such as `:not(.a, .b)` and
 * `[data-label="a,b"]` while keeping the implementation intentionally small.
 *
 * @param {string} selector - Raw selector or selector list.
 * @returns {string[]} Individual selector items.
 */
export function splitSelectorList(selector) {
  const selectors = [];
  let current = '';
  let depthParen = 0;
  let depthBracket = 0;
  let quote = '';

  for (let i = 0; i < selector.length; i++) {
    const char = selector[i];
    const prev = selector[i - 1];

    if (quote) {
      current += char;
      if (char === quote && prev !== '\\') quote = '';
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if (char === '(') depthParen++;
    else if (char === ')' && depthParen > 0) depthParen--;
    else if (char === '[') depthBracket++;
    else if (char === ']' && depthBracket > 0) depthBracket--;

    if (char === ',' && depthParen === 0 && depthBracket === 0) {
      selectors.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  selectors.push(current);
  return selectors;
}

/**
 * Scopes a selector or selector list to a generated class token. Each selector
 * in a list is independently prefixed, preventing accidental global leakage
 * from input such as ` .title, body`.
 *
 * @param {string} className - Generated class token without a leading dot.
 * @param {string} selector - Selector key from a style object.
 * @returns {string} Scoped selector list.
 */
export function scopeSelector(className, selector) {
  const root = `.${className}`;
  return splitSelectorList(selector)
    .map((part) => {
      const raw = part;
      const trimmed = raw.trim();
      if (!trimmed) return root;
      if (trimmed.startsWith('&')) return `${root}${trimmed.slice(1)}`;
      if (trimmed.startsWith(':')) return `${root}${trimmed}`;
      if (
        trimmed.startsWith('>') ||
        trimmed.startsWith('+') ||
        trimmed.startsWith('~')
      ) {
        return `${root} ${trimmed}`;
      }
      return `${root} ${trimmed}`;
    })
    .join(',\n');
}

/**
 * Serializes a normal selector rule for a generated class token.
 *
 * @param {string} className - Generated class token without a leading dot.
 * @param {{key: string, declarations: Record<string, string|number|null|undefined>}} rule
 * @returns {string} Complete CSS rule or an empty string when no declarations remain.
 */
export function serializeSelectorRule(className, rule) {
  const lines = serializeDeclarationLines(rule.declarations);
  if (lines.length === 0) return '';
  return `${scopeSelector(className, rule.key)} {\n${lines.join('\n')}\n}`;
}

/**
 * Serializes a base class rule for declarations that moved out of inline style
 * because the style object also contains selector CSS.
 *
 * @param {string} className - Generated class token without a leading dot.
 * @param {Record<string, string|number|null|undefined>} declarations
 * @returns {string} Complete CSS rule or an empty string when no declarations remain.
 */
export function serializeClassRule(className, declarations) {
  const lines = serializeDeclarationLines(declarations);
  if (lines.length === 0) return '';
  return `.${className} {\n${lines.join('\n')}\n}`;
}

/**
 * Serializes a supported CSS at-rule by nesting a scoped class rule inside the
 * at-rule block. Unsupported at-rules are filtered out during normalization.
 *
 * @param {string} className - Generated class token without a leading dot.
 * @param {{key: string, declarations: Record<string, string|number|null|undefined>}} rule
 * @returns {string} Complete CSS at-rule block or an empty string.
 */
export function serializeAtRule(className, rule) {
  const classRule = serializeClassRule(className, rule.declarations);
  if (!classRule) return '';
  return `${rule.key} {\n${classRule
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n')}\n}`;
}

/**
 * Escapes generated CSS for safe placement inside an SSR `<style>` tag. The
 * replacement prevents style-data values from prematurely closing the tag.
 *
 * @param {string} cssText - Raw generated CSS text.
 * @returns {string} CSS text safe for style-tag HTML serialization.
 */
export function escapeCssForStyleTag(cssText) {
  return String(cssText).replace(/<\/style/gi, '<\\/style');
}
