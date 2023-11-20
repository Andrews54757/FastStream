export class EnvUtils {
  static hasComputationalResources() {
    // check cpu concurrency
    if (navigator.hardwareConcurrency < 4) {
      return false;
    }

    // check ram
    if (navigator.deviceMemory !== undefined && navigator.deviceMemory < 8) {
      return false;
    }

    return true;
  }

  static isChrome() {
    return navigator.userAgent.indexOf('Chrome') !== -1;
  }

  static isExtension() {
    return typeof chrome !== 'undefined' && !!chrome?.extension;
  }

  static getVersion() {
    // eslint-disable-next-line prefer-const
    let version = '1.0.0.web';

    // SPLICER:WEB:INSERT_VERSION

    return this.isExtension() ? chrome.runtime.getManifest().version : version;
  }

  static isIncognito() {
    return this.isExtension() ? chrome.extension.inIncognitoContext : false;
  }
}
