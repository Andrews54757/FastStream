import {EnvUtils} from '../utils/EnvUtils.mjs';

const TranslationMap = {
  // SPLICER:WEB:INSERT_LOCALE
};

const translationMapCache = new Map();

export class Localize {
  static getMessage(key, substitutions) {
    if (EnvUtils.isExtension()) {
      return chrome.i18n.getMessage(key, substitutions) || key;
    }

    if (!Object.hasOwn(TranslationMap, key)) {
      return key;
    }

    const index = Localize.getTranslationMapIndexCached(Localize.getLanguage());
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

  static getTranslationMapIndexCached(chosenLanguage) {
    const cached = translationMapCache.get(chosenLanguage);
    if (cached !== undefined) {
      return cached;
    }
    const index = Localize.getTranslationMapIndex(chosenLanguage);
    translationMapCache.set(chosenLanguage, index);
    return index;
  }

  static getTranslationMapIndex(chosenLanguage) {
    const languages = TranslationMap['LANGUAGES'];
    if (!languages) {
      return -1;
    }

    const languageCodes = chosenLanguage.toLowerCase().split(/[-_]/);
    if (languageCodes.length === 0) {
      return 0;
    }

    const languagesMapped = languages.map((lang, i) => {
      const langParts = lang.toLowerCase().split(/[-_]/);
      return {
        parts: langParts,
        index: i,
      };
    });

    const matchedFirstPart = languagesMapped.filter((lang) => lang.parts[0] === languageCodes[0]);
    if (matchedFirstPart.length === 0) {
      return 0;
    }

    if (languageCodes.length === 1) {
      return matchedFirstPart[0].index;
    }

    const matchedFull = matchedFirstPart.filter((lang) => {
      if (lang.parts.length !== languageCodes.length) {
        return false;
      }
      for (let i = 1; i < lang.parts.length; i++) {
        if (lang.parts[i] !== languageCodes[i]) {
          return false;
        }
      }
      return true;
    });

    if (matchedFull.length > 0) {
      return matchedFull[0].index;
    }

    return matchedFirstPart[0].index;
  }
}
