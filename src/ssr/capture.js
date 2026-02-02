/**
 * @file SSR event capture module.
 * Captures user interactions on SSR-rendered components before hydration.
 */

import { calculatePath } from './pathResolver.js';
import { addToBuffer } from './buffer.js';

/**
 * Checks if an element is an unregistered custom element.
 * @param {Element} element - DOM element to check
 * @returns {boolean} True if unregistered custom element
 */
function isUnregisteredCustomElement(element) {
  const tagName = element.tagName.toLowerCase();
  if (!tagName.includes('-')) return false;
  return !customElements.get(tagName);
}

/**
 * Finds the nearest custom element ancestor (including self).
 * @param {Element} element - Starting element
 * @returns {Element|null} Custom element or null
 */
function findCustomElementAncestor(element) {
  let current = element;
  while (current && current !== document.body) {
    if (isUnregisteredCustomElement(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

/**
 * Creates event detail object based on event type.
 * @param {Event} event - The captured event
 * @returns {Object} Event detail for replay
 */
function extractEventDetail(event) {
  const detail = {
    type: event.type,
    bubbles: event.bubbles,
    cancelable: event.cancelable,
  };

  if (event instanceof MouseEvent) {
    detail.clientX = event.clientX;
    detail.clientY = event.clientY;
    detail.button = event.button;
    detail.buttons = event.buttons;
  }

  if (event instanceof KeyboardEvent) {
    detail.key = event.key;
    detail.code = event.code;
    detail.ctrlKey = event.ctrlKey;
    detail.shiftKey = event.shiftKey;
    detail.altKey = event.altKey;
    detail.metaKey = event.metaKey;
  }

  if (event.type === 'input' || event.type === 'change') {
    const target = event.target;
    if (target.type === 'checkbox' || target.type === 'radio') {
      detail.checked = target.checked;
    } else {
      detail.value = target.value;
    }
  }

  if (event instanceof TouchEvent && event.touches) {
    detail.touches = Array.from(event.touches).map((t) => ({
      clientX: t.clientX,
      clientY: t.clientY,
      identifier: t.identifier,
    }));
  }

  return detail;
}

/**
 * Captures scroll position for elements within a custom element.
 * @param {Element} customElement - The custom element
 * @param {Object} ssrState - Global SSR state
 */
function captureScrollState(customElement, ssrState) {
  const state = ssrState.elementStates.get(customElement) || {
    scrollPositions: new Map(),
    checkedStates: new Map(),
  };

  const scrollables = customElement.querySelectorAll('*');
  scrollables.forEach((el) => {
    if (el.scrollTop > 0 || el.scrollLeft > 0) {
      const path = calculatePath(el, customElement);
      state.scrollPositions.set(path, {
        scrollTop: el.scrollTop,
        scrollLeft: el.scrollLeft,
      });
    }
  });

  ssrState.elementStates.set(customElement, state);
}

/**
 * Captures checked state for checkbox/radio inputs.
 * @param {Element} target - The input element
 * @param {Element} customElement - Parent custom element
 * @param {Object} ssrState - Global SSR state
 */
function captureCheckedState(target, customElement, ssrState) {
  if (target.type === 'checkbox' || target.type === 'radio') {
    const state = ssrState.elementStates.get(customElement) || {
      scrollPositions: new Map(),
      checkedStates: new Map(),
    };
    const path = calculatePath(target, customElement);
    state.checkedStates.set(path, target.checked);
    ssrState.elementStates.set(customElement, state);
  }
}

/**
 * Main event handler for capture phase.
 * @param {Event} event - Captured event
 * @param {Object} ssrState - Global SSR state
 */
function handleCapturedEvent(event, ssrState) {
  if (!ssrState.captureActive) return;
  if (event._hyperElementReplayed) return;

  const target = event.target;
  if (!target || !target.tagName) return;

  const customElement = findCustomElementAncestor(target);
  if (!customElement) return;

  const tagName = customElement.tagName.toLowerCase();
  if (ssrState.registeredTags.has(tagName)) return;

  const targetPath = calculatePath(target, customElement);

  const bufferedEvent = {
    type: event.type,
    targetPath,
    timestamp: Date.now(),
    detail: extractEventDetail(event),
  };

  addToBuffer(ssrState, customElement, bufferedEvent);

  if (['scroll', 'focus', 'blur'].includes(event.type)) {
    captureScrollState(customElement, ssrState);
  }

  if (event.type === 'change' || event.type === 'click') {
    captureCheckedState(target, customElement, ssrState);
  }
}

/**
 * Starts event capture on document.
 * @param {Object} ssrState - Global SSR state
 */
function startCapture(ssrState) {
  /** @param {Event} event - Captured event to handle */
  const handler = (event) => handleCapturedEvent(event, ssrState);

  ssrState.config.events.forEach((eventType) => {
    document.addEventListener(eventType, handler, {
      capture: true,
      passive: true,
    });
  });

  ssrState._captureHandler = handler;
}

export { startCapture };
