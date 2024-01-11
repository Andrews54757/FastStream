import {EnvUtils} from '../utils/EnvUtils.mjs';

const TranslationMap = {
  // SPLICER:WEB:INSERT_LOCALE
};


export class Localize {
  static getMessage(key, substitutions) {
    if (EnvUtils.isExtension()) {
      return chrome.i18n.getMessage(key, substitutions) || key;
    }

    if (!Object.hasOwn(TranslationMap, key)) {
      return key;
    }

    // Replace $1, $2, etc. with substitutions
    let result = TranslationMap[key];
    substitutions = substitutions || [];
    for (let i = 0; i < substitutions.length; i++) {
      result = result.replace(`$${i + 1}`, substitutions[i]);
    }

    return result;
  }
}
