/**
 * @file SSR event buffer management for captured events.
 * Stores events per-element until components are hydrated and can replay them.
 */

/**
 * Adds an event to the buffer for a custom element.
 *
 * @param {Object} ssrState - Global SSR state
 * @param {Element} customElement - The custom element
 * @param {Object} bufferedEvent - The event to buffer
 */
function addToBuffer(ssrState, customElement, bufferedEvent) {
  let elementBuffer = ssrState.buffer.get(customElement);

  if (!elementBuffer) {
    elementBuffer = [];
    ssrState.buffer.set(customElement, elementBuffer);
  }

  elementBuffer.push(bufferedEvent);
}

/**
 * Gets all buffered events for an element.
 *
 * @param {Object} ssrState - Global SSR state
 * @param {Element} customElement - The custom element
 * @returns {Array} Buffered events
 */
function getBufferedEvents(ssrState, customElement) {
  return ssrState.buffer.get(customElement) || [];
}

/**
 * Clears the buffer for an element.
 *
 * @param {Object} ssrState - Global SSR state
 * @param {Element} customElement - The custom element
 */
function clearBuffer(ssrState, customElement) {
  ssrState.buffer.delete(customElement);
}

export { addToBuffer, getBufferedEvents, clearBuffer };
