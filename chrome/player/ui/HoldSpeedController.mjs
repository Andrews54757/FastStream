/**
 * Normalizes the configurable hold-to-speed-up settings.
 * @param {Object} options - Player options.
 * @return {{key: string, rate: number, delay: number}} Normalized settings.
 */
export function getHoldSpeedConfig(options = {}) {
  const rate = parseFloat(options.holdSpeedRate);
  const delay = parseFloat(options.holdSpeedDelay);
  return {
    key: options.holdSpeedKey || 'None',
    rate: Number.isFinite(rate) && rate > 0 ? rate : 2,
    delay: Number.isFinite(delay) && delay >= 0 ? delay : 800,
  };
}

/**
 * Returns the non-modifier key from a key string.
 * @param {string} key - A key string such as Shift+ArrowDown.
 * @return {string} The final key component.
 */
export function getBaseKey(key) {
  return key.split('+').pop();
}

/**
 * Checks whether a keyboard event's key string matches a configured binding.
 * Mouse bindings are handled by the caller because they are not key strings.
 * @param {string} keyString - The event's key string.
 * @param {string} binding - The configured binding.
 * @param {boolean} ignoreModifiers - Whether only the base key should be compared.
 * @return {boolean} Whether the key string matches.
 */
export function matchesHoldSpeedKey(keyString, binding, ignoreModifiers = false) {
  if (!binding || binding === 'None' || binding.startsWith('Mouse')) {
    return false;
  }
  if (ignoreModifiers) {
    return getBaseKey(keyString) === getBaseKey(binding);
  }
  return keyString === binding;
}

/**
 * Installs handlers that end a hold when the page loses focus or becomes hidden.
 * @param {Window} windowObject - The player window.
 * @param {Document} documentObject - The player document.
 * @param {Function} onInterrupt - Called when focus or visibility is lost.
 * @return {Function} A function that removes the handlers.
 */
export function bindHoldSpeedInterruptions(windowObject, documentObject, onInterrupt) {
  const handleBlur = () => onInterrupt();
  const handleVisibilityChange = () => {
    if (documentObject.hidden) {
      onInterrupt();
    }
  };

  windowObject.addEventListener('blur', handleBlur);
  documentObject.addEventListener('visibilitychange', handleVisibilityChange);
  return () => {
    windowObject.removeEventListener('blur', handleBlur);
    documentObject.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}

/**
 * Manages the delayed speed-up state independently from DOM event matching.
 */
export class HoldSpeedController {
  /**
   * @param {Object} config - Dependencies and callbacks.
   * @param {Object} config.client - The player client.
   * @param {Function} config.getConfig - Returns normalized hold settings.
   * @param {Function} config.showOverlay - Shows the rate overlay.
   * @param {Function} config.hideOverlay - Hides the rate overlay.
   * @param {Function} [config.setTimer] - Timer scheduler.
   * @param {Function} [config.clearTimer] - Timer canceller.
   */
  constructor({
    client,
    getConfig,
    showOverlay,
    hideOverlay,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  }) {
    this.client = client;
    this.getConfig = getConfig;
    this.showOverlay = showOverlay;
    this.hideOverlay = hideOverlay;
    this.setTimer = (callback, delay) => setTimer(callback, delay);
    this.clearTimer = (timer) => clearTimer(timer);
    this.timer = null;
    this.lastSpeed = null;
    this.suppressClick = false;
    this.holdUsed = false;
    this.holdKeyString = null;
  }

  /**
   * Clears pointer click state before a new mouse press.
   */
  resetInputState() {
    this.suppressClick = false;
    this.holdUsed = false;
  }

  /**
   * Whether a context menu should be blocked for the current press.
   * @return {boolean} True while a hold is pending or active.
   */
  get blocksContextMenu() {
    return this.suppressClick || this.lastSpeed !== null;
  }

  /**
   * Starts the delay for a new hold.
   * @param {string|null} shortKey - The key string used for short-press replay.
   */
  begin(shortKey = null) {
    this.clearPending();
    this.holdUsed = false;
    this.holdKeyString = shortKey;
    this.suppressClick = false;

    const {rate, delay} = this.getConfig();
    this.timer = this.setTimer(() => {
      this.timer = null;
      this.activate(rate);
    }, delay);
  }

  /**
   * Applies the configured playback rate after the delay.
   * @param {number} rate - The multiplier to apply.
   */
  activate(rate) {
    if (this.lastSpeed !== null || !this.client.player) {
      return;
    }
    this.lastSpeed = this.client.playbackRate;
    this.client.playbackRate = this.lastSpeed * rate;
    this.client.play();

    // Read the rate back from the client because a player may clamp it.
    this.showOverlay(this.client.playbackRate || this.lastSpeed * rate);
    this.holdUsed = true;
    this.suppressClick = true;
  }

  /**
   * Ends a hold and optionally replays a short press.
   * @param {Event} event - The release event.
   * @param {Function} runShortPress - Runs the binding's normal action.
   */
  complete(event, runShortPress) {
    const isKeyboardPress = this.holdKeyString !== null;
    if (!this.holdUsed && this.holdKeyString !== null) {
      runShortPress(this.holdKeyString, event);
    }
    this.holdKeyString = null;
    this.stop();
    if (isKeyboardPress) {
      this.suppressClick = false;
    }
  }

  /**
   * Restores the previous rate and clears any pending timer.
   */
  stop() {
    this.clearPending();
    if (this.lastSpeed !== null) {
      this.client.playbackRate = this.lastSpeed;
      this.lastSpeed = null;
      this.hideOverlay();
    }
  }

  /**
   * Fully resets the hold after focus or visibility is lost.
   */
  interrupt() {
    this.stop();
    this.holdKeyString = null;
    this.holdUsed = false;
    this.suppressClick = false;
  }

  /**
   * Cancels a pending activation without changing a completed short press.
   */
  clearPending() {
    if (this.timer !== null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
  }

  /**
   * Consumes a click generated by the end of a long press.
   * @return {boolean} True if the click should be swallowed.
   */
  consumeSuppressedClick() {
    if (!this.blocksContextMenu) {
      return false;
    }
    this.suppressClick = false;
    this.stop();
    return true;
  }
}
