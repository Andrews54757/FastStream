import {EnvUtils} from '../utils/EnvUtils.mjs';
import {Utils} from '../utils/Utils.mjs';
import {DefaultOptions} from './defaults/DefaultOptions.mjs';
import {MessageTypes} from '../enums/MessageTypes.mjs';

/**
 * Centralized options store with load/save, merge and change subscriptions.
 */
export class OptionsStore {
  static #options = null;
  static #listeners = new Set();
  static #lastSendTime = null;
  static #initialized = false;

  /**
   * Initialize the store by loading options and wiring external updates.
   */
 static async init() {
    // 1. If we have options, return them immediately
    if (this.#initialized && this.#options) return this.#options;

    // 2. Load the options first
    const options = await Utils.getOptionsFromStorage();
    this.#options = options;
    this.#wireExternalUpdates();

    // 3. ONLY NOW mark as initialized
    this.#initialized = true; 
    
    return this.#options;
  }

  /**
   * Get current options (ensure init() has been awaited somewhere first).
   */
  static get() {
    return this.#options ?? DefaultOptions;
  }

  /**
   * Replace entire options object and persist/broadcast.
   */
  static async replace(newOptions) {
    this.#options = Utils.mergeOptions(DefaultOptions, newOptions || {});
    await this.#persistAndNotify();
  }

  /**
   * Merge a partial set of options, persist and broadcast.
   */
  static async set(partial) {
    const merged = {...(this.#options ?? DefaultOptions), ...(partial || {})};
    this.#options = Utils.mergeOptions(DefaultOptions, merged);
    await this.#persistAndNotify();
  }

  /**
   * Subscribe to changes. Returns unsubscribe function.
   * @param {(opts: Object)=>void} fn
   */
  static subscribe(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  static async #persistAndNotify() {
    // Persist
    await Utils.setConfig('options', JSON.stringify(this.#options));

    // Broadcast to other contexts
    if (EnvUtils.isExtension()) {
      this.#lastSendTime = Date.now();
      chrome.runtime?.sendMessage?.({
        type: MessageTypes.LOAD_OPTIONS,
        time: this.#lastSendTime,
      });
    } else {
      const postWindow = window.opener || window.parent || window;
      postWindow.postMessage({type: 'options'}, '/');
    }

    // Local listeners
    this.#listeners.forEach((fn) => {
      try {
        fn(this.#options);
      } catch (e) {
        console.error(e);
      }
    });
  }

  static #wireExternalUpdates() {
    if (EnvUtils.isExtension()) {
      chrome.runtime?.onMessage?.addListener?.((request) => {
        if (request?.type === MessageTypes.UPDATE_OPTIONS) {
          // Ignore our own echo
          if (request.time && request.time === this.#lastSendTime) return;
          this.#reloadFromStorage();
        }
      });
    } else {
      window.addEventListener('message', (e) => {
        if (e.origin !== window.location.origin) return;
        if (e.data?.type === 'options') {
          this.#reloadFromStorage();
        }
      });
    }
  }

  static async #reloadFromStorage() {
    try {
      this.#options = await Utils.getOptionsFromStorage();
      this.#listeners.forEach((fn) => {
        try {
          fn(this.#options);
        } catch (e) {
          console.error(e);
        }
      });
    } catch (e) {
      console.error('Failed to reload options', e);
    }
  }
}

