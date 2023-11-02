import {DefaultOptions} from '../../options/defaults/DefaultOptions.mjs';
import {EnvUtils} from './EnvUtils.mjs';

export class Utils {
  static async getOptionsFromStorage() {
    const optionsStr = await (new Promise((resolve, reject) => {
      if (EnvUtils.isExtension()) {
        chrome.storage.local.get({
          options: '{}',
        }, (results) => {
          resolve(results.options);
        });
      } else {
        resolve(localStorage.getItem('options') || '{}');
      }
    }));
    const options = JSON.parse(optionsStr);
    return this.mergeOptions(DefaultOptions, options);
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
    const indexes = tracks.map(() => 0);
    const len = tracks.reduce((acc, fragments) => acc + fragments.length, 0);

    for (let i = 0; i < len; i++) {
      let min = Infinity;
      let minIndex = -1;

      for (let j = 0; j < tracks.length; j++) {
        const index = indexes[j];
        if (index >= tracks[j].length) continue;

        const fragment = tracks[j][index];

        if (fragment && fragment.start < min) {
          min = fragment.start;
          minIndex = j;
        }
      }

      if (minIndex === -1) break;

      const fragment = tracks[minIndex][indexes[minIndex]];
      indexes[minIndex]++;
      zippedFragments.push({
        track: minIndex,
        fragment,
      });
    }

    return zippedFragments;
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
}
