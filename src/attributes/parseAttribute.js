/**
 * @file Attribute parser with automatic type coercion.
 * Converts string attribute values to appropriate JavaScript types.
 */

/**
 * Parses an attribute value and coerces it to the appropriate type.
 * Handles numbers, booleans, JSON arrays/objects, and the special 'template' attribute.
 *
 * @param {string} key - The attribute name
 * @param {string} value - The attribute value as a string
 * @returns {string|number|boolean|Object|Array} The parsed/coerced value
 * @example
 * parseAttribute('count', '42');        // Returns 42 (number)
 * parseAttribute('enabled', 'true');    // Returns true (boolean)
 * parseAttribute('data', '[1,2,3]');    // Returns [1, 2, 3] (array)
 * parseAttribute('template', '');       // Returns true (special case)
 */
export function parseAttribute(key, value) {
  // Handle null/undefined values
  /* IS DEAD CODE ??
  if (value == null) {
    return value;
  }*/

  if ('template' === key && '' === value) {
    return true;
  }

  if (+value + '' === value.trim()) {
    return +value; // to number
  }

  const lowerCaseValue = value.toLowerCase().trim();

  if ('true' === lowerCaseValue) {
    return true;
  } else if ('false' === lowerCaseValue) {
    return false;
  }

  if (
    (lowerCaseValue[0] === '[' && lowerCaseValue.slice(-1) === ']') ||
    (lowerCaseValue[0] === '{' && lowerCaseValue.slice(-1) === '}')
  ) {
    return JSON.parse(value);
  }

  return value;
}
