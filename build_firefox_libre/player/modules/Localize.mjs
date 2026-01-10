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
    const matches = [];
    languages.forEach((lang, index) => {
      const matchLevel = Localize.getLanguageMatchLevel(chosenLanguage, lang);
      if (matchLevel > 0) {
        matches.push({index, matchLevel});
      }
    });
    if (matches.length === 0) {
      return -1;
    }
    // Sort by match level descending
    matches.sort((a, b) => b.matchLevel - a.matchLevel);
    return matches[0].index;
  }
  static getLanguageMatchLevel(lang1, lang2) {
    if (!lang1 || !lang2) {
      return 0; // no match
    }
    const langArr1 = lang1.toLowerCase().split(/[-_]/);
    const langArr2 = lang2.toLowerCase().split(/[-_]/);
    const minLength = Math.min(langArr1.length, langArr2.length);
    let matchLevel = 0; // number of matching parts
    for (let i = 0; i < minLength; i++) {
      if (langArr1[i] === langArr2[i]) {
        matchLevel++;
      } else {
        break;
      }
    }
    return matchLevel;
  }
}
