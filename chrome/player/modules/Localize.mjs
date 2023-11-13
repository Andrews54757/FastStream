export class Localize {
  static getMessage(key, substitutions) {
    return chrome.i18n.getMessage(key, substitutions);
  }
}
