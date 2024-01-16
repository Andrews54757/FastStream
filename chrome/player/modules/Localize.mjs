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

    const index = Localize.getTranslationMapIndex();
    if (index === -1) {
      return key;
    }

    // Replace $1, $2, etc. with substitutions
    let result = TranslationMap[key][index];
    substitutions = substitutions || [];
    for (let i = 0; i < substitutions.length; i++) {
      result = result.replace(`$${i + 1}`, substitutions[i]);
    }

    return result;
  }

  static getLanguage() {
    if (EnvUtils.isExtension()) {
      return chrome.i18n.getUILanguage();
    }

    return navigator.language;
  }

  static getTranslationMapIndex() {
    const languages = TranslationMap['LANGUAGES'];
    if (!languages) {
      return -1;
    }

    const languageCode = this.getLanguage().split('-')[0];
    for (let i = 0; i < languages.length; i++) {
      if (languages[i] === languageCode) {
        return i;
      }
    }

    return 0;
  }
}
