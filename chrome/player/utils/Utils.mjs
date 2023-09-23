export class Utils {
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
}
