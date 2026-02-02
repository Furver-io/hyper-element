/**
 * @file DOM path resolution for SSR event replay.
 * Calculates and resolves paths to elements within custom element boundaries.
 */

/**
 * Calculates the nth-of-type index for an element.
 * @param {Element} element - Target element
 * @returns {number} Zero-based index among siblings of same type
 */
function getNthOfTypeIndex(element) {
  const tagName = element.tagName;
  let index = 0;
  let sibling = element.previousElementSibling;

  while (sibling) {
    if (sibling.tagName === tagName) {
      index++;
    }
    sibling = sibling.previousElementSibling;
  }

  return index;
}

/**
 * Calculates a path from root to target element.
 * Path format: "DIV:0/SPAN:1/BUTTON:0"
 *
 * @param {Element} target - Target element
 * @param {Element} root - Root element (exclusive)
 * @returns {string} Path string
 */
function calculatePath(target, root) {
  if (target === root) return '';

  const parts = [];
  let current = target;

  while (current && current !== root && current.parentElement) {
    const tagName = current.tagName;
    const index = getNthOfTypeIndex(current);
    parts.unshift(`${tagName}:${index}`);
    current = current.parentElement;
  }

  return parts.join('/');
}

/**
 * Resolves a path to an element within a root.
 *
 * @param {string} path - Path string (e.g., "DIV:0/BUTTON:1")
 * @param {Element} root - Root element to search within
 * @returns {Element|null} Matched element or null
 */
function resolvePath(path, root) {
  if (!path) return root;

  const parts = path.split('/');
  let current = root;

  for (const part of parts) {
    const [tagName, indexStr] = part.split(':');
    const targetIndex = parseInt(indexStr, 10);

    const children = Array.from(current.children).filter(
      (child) => child.tagName === tagName
    );

    if (targetIndex >= children.length) {
      console.warn(
        `[hyper-element SSR] Could not match path segment "${part}" - ` +
          `found ${children.length} ${tagName} elements, needed index ${targetIndex}`
      );
      return null;
    }

    current = children[targetIndex];
  }

  return current;
}

export { calculatePath, resolvePath };
