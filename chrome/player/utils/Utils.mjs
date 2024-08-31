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

  static selectQuality(levels, defaultQuality) {
    let max = -1;
    let maxLevel = undefined;
    let min = Number.MAX_SAFE_INTEGER;
    let minLevel = undefined;

    if (defaultQuality === 'Auto') {
      const qualityMultiplier = 1.1;

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
    } else {
      const desiredHeight = parseInt(defaultQuality.replace('p', ''));
      const list = [];
      levels.forEach((level, key) => {
        list.push({
          key,
          level,
          diff: Math.abs(level.height - desiredHeight),
        });
      });

      // Sort by height difference and then by bitrate. Choose highest bitrate if multiple have the same height difference
      list.sort((a, b) => {
        if (a.diff === b.diff) {
          return a.level.bitrate - b.level.bitrate;
        }
        return a.diff - b.diff;
      });

      return list[0].key;
    }
  }

  static printWelcome(version) {
    console.log('\n %c %c FastStream -%c ' + version + ' %c By Andrews54757 \n',
        'background: url("data:image/png;base64,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") no-repeat; background-size: 20px 20px; padding: 4px 8px; margin-right: 4px',
        'color: rgb(200,200,200); background: rgb(50,50,50); padding:5px 0;',
        'color: #afbc2a; background: rgb(50,50,50); padding:5px 0;',
        'color: black; background: #e9e9e9; padding:5px 0;',
    );
    console.log('Please report all issues to the GitHub repository: https://github.com/Andrews54757/FastStream/issues');
  }

  static timeoutableEvent(context, event, timeout) {
    let callback; let timeoutId;
    const cleanup = () => {
      clearTimeout(timeoutId);
      context.off(event, callback);
    };

    return new Promise((resolve, reject) => {
      callback = () => {
        cleanup();
        resolve(true);
      };

      timeoutId = setTimeout(() => {
        cleanup();
        resolve(false);
      }, timeout);

      context.on(event, callback);
    });
  }

  static asyncTimeout(timeout) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve();
      }, timeout);
    });
  }
}
