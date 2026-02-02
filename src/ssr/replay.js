/**
 * @file SSR event replay module.
 * Replays captured events after component hydration.
 */

import { resolvePath } from './pathResolver.js';
import { getBufferedEvents, clearBuffer } from './buffer.js';

/**
 * Creates a synthetic event from buffered event data.
 *
 * @param {Object} bufferedEvent - The buffered event data
 * @returns {Event} Synthetic event
 */
function createSyntheticEvent(bufferedEvent) {
  const { type, detail } = bufferedEvent;
  let EventConstructor = Event;
  let initOptions = {
    bubbles: detail.bubbles ?? true,
    cancelable: detail.cancelable ?? true,
  };

  if (
    ['click', 'dblclick', 'mousedown', 'mouseup', 'mousemove'].includes(type)
  ) {
    EventConstructor = MouseEvent;
    Object.assign(initOptions, {
      clientX: detail.clientX,
      clientY: detail.clientY,
      button: detail.button,
      buttons: detail.buttons,
    });
  } else if (['keydown', 'keyup', 'keypress'].includes(type)) {
    EventConstructor = KeyboardEvent;
    Object.assign(initOptions, {
      key: detail.key,
      code: detail.code,
      ctrlKey: detail.ctrlKey,
      shiftKey: detail.shiftKey,
      altKey: detail.altKey,
      metaKey: detail.metaKey,
    });
  } else if (type === 'input') {
    EventConstructor = InputEvent;
    Object.assign(initOptions, {
      inputType: 'insertText',
      data: detail.value,
    });
  }

  const event = new EventConstructor(type, initOptions);
  event._hyperElementReplayed = true;

  return event;
}

/**
 * Restores element state (scroll positions, checked states).
 *
 * @param {Element} customElement - The hydrated custom element
 * @param {Object} ssrState - Global SSR state
 */
function restoreElementState(customElement, ssrState) {
  const state = ssrState.elementStates.get(customElement);
  if (!state) return;

  if (state.scrollPositions) {
    state.scrollPositions.forEach((scroll, path) => {
      const element = resolvePath(path, customElement);
      if (element) {
        element.scrollTop = scroll.scrollTop;
        element.scrollLeft = scroll.scrollLeft;
      }
    });
  }

  if (state.checkedStates) {
    state.checkedStates.forEach((checked, path) => {
      const element = resolvePath(path, customElement);
      if (
        element &&
        (element.type === 'checkbox' || element.type === 'radio')
      ) {
        element.checked = checked;
      }
    });
  }

  ssrState.elementStates.delete(customElement);
}

/**
 * Replays all buffered events for a hydrated element.
 * Called after first render completes.
 *
 * @param {Element} customElement - The hydrated custom element
 * @param {Object} ssrState - Global SSR state
 * @param {Function} [onBeforeHydrate] - Optional filter callback
 * @param {Function} [onAfterHydrate] - Optional completion callback
 */
function replayEvents(
  customElement,
  ssrState,
  onBeforeHydrate,
  onAfterHydrate
) {
  let events = getBufferedEvents(ssrState, customElement);

  if (onBeforeHydrate) {
    const filtered = onBeforeHydrate(events);
    if (Array.isArray(filtered)) {
      events = filtered;
    } else if (filtered !== undefined) {
      console.warn('[hyper-element SSR] onBeforeHydrate must return an array');
    }
  }

  events.sort((a, b) => a.timestamp - b.timestamp);

  events.forEach((bufferedEvent) => {
    const target = resolvePath(bufferedEvent.targetPath, customElement);

    if (!target) {
      console.warn(
        `[hyper-element SSR] Could not replay event "${bufferedEvent.type}" - ` +
          `target path "${bufferedEvent.targetPath}" not found after hydration`
      );
      return;
    }

    if (bufferedEvent.detail.value !== undefined) {
      target.value = bufferedEvent.detail.value;
    }

    if (bufferedEvent.detail.checked !== undefined) {
      target.checked = bufferedEvent.detail.checked;
    }

    const syntheticEvent = createSyntheticEvent(bufferedEvent);
    target.dispatchEvent(syntheticEvent);
  });

  restoreElementState(customElement, ssrState);
  clearBuffer(ssrState, customElement);

  if (onAfterHydrate) {
    onAfterHydrate();
  }
}

export { replayEvents };
