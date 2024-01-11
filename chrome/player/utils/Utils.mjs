import {DefaultOptions} from '../options/defaults/DefaultOptions.mjs';
import {DefaultSubtitlesSettings} from '../options/defaults/DefaultSubtitlesSettings.mjs';
import {EnvUtils} from './EnvUtils.mjs';

export class Utils {
  static getOptionsFromStorage() {
    return Utils.loadAndParseOptions('options', DefaultOptions);
  }

  static getSubtitlesSettingsFromStorage() {
    return Utils.loadAndParseOptions('subtitlesSettings', DefaultSubtitlesSettings);
  }

  static mergeOptions(defaultOptions, newOptions) {
    const options = {};
    for (const prop in defaultOptions) {
      if (Object.hasOwn(defaultOptions, prop)) {
        const opt = defaultOptions[prop];
        if (typeof opt === 'object' && !Array.isArray(opt)) {
          options[prop] = this.mergeOptions(opt, newOptions[prop] || {});
        } else {
          options[prop] = (Object.hasOwn(newOptions, prop) && typeof newOptions[prop] === typeof opt) ? newOptions[prop] : opt;
        }
      }
    }
    return options;
  }

  /**
     * Binary search utility.
     * @param {array} array
     * @param {*} el
     * @param {function} compareFn
     * @return {*}
     */
  static binarySearch(array, el, compareFn) {
    let lower = 0;
    let upper = array.length - 1;
    while (lower <= upper) {
      const middle = (upper + lower) >> 1;
      const cmp = compareFn(el, array[middle]);
      if (cmp > 0) {
        lower = middle + 1;
      } else if (cmp < 0) {
        upper = middle - 1;
      } else {
        return middle;
      }
    }
    return -lower - 1;
  }

  static clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  static getDataByteSize(data) {
    if (typeof data === 'string') return data.length * 2;
    if (data instanceof ArrayBuffer) return data.byteLength;
    if (data instanceof Blob) return data.size;
    return 0;
  }

  static zipTimedFragments(tracks) {
    const zippedFragments = [];
    tracks.forEach((fragments, track) => {
      fragments.forEach((fragment) => {
        zippedFragments.push({
          track,
          fragment,
        });
      });
    });

    zippedFragments.sort((a, b) => {
      return a.fragment.start - b.fragment.start;
    });

    return zippedFragments;
  }

  static async loadAndParseOptions(key, defaultOptions) {
    const settingsStr = await Utils.getConfig(key);
    if (settingsStr) {
      try {
        const settings = JSON.parse(settingsStr);
        return Utils.mergeOptions(defaultOptions, settings);
      } catch (e) {
        console.error(e);
      }
    }
    return Utils.mergeOptions(defaultOptions, {});
  }

  static getConfig(key) {
    return new Promise((resolve, reject)=> {
      if (EnvUtils.isExtension()) {
        chrome.storage.local.get(key, (result) => {
          resolve(result[key]);
        });
      } else {
        resolve(localStorage.getItem(key));
      }
    });
  }

  static setConfig(key, value) {
    return new Promise((resolve, reject)=> {
      if (EnvUtils.isExtension()) {
        chrome.storage.local.set({[key]: value}, () => {
          resolve();
        });
      } else {
        localStorage.setItem(key, value);
        resolve();
      }
    });
  }

  static selectQuality(levels, qualityMultiplier) {
    let max = -1;
    let maxLevel = undefined;
    let min = Number.MAX_SAFE_INTEGER;
    let minLevel = undefined;
    // Get best quality but within screen resolution
    levels.forEach((level, key) => {
      if (level.bitrate > max) {
        if (level.width > window.innerWidth * window.devicePixelRatio * qualityMultiplier && level.height > window.innerHeight * window.devicePixelRatio * qualityMultiplier) {

        } else {
          max = level.bitrate;
          maxLevel = key;
        }
      }

      if (level.bitrate < min) {
        min = level.bitrate;
        minLevel = key;
      }
    });

    if (maxLevel === undefined) {
      maxLevel = minLevel;
    }

    return maxLevel;
  }
}
