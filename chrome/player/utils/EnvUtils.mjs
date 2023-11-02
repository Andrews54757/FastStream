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
    return !!chrome?.extension;
  }

  static getVersion() {
    return this.isExtension() ? chrome.runtime.getManifest().version : '0.0.0';
  }

  static isIncognito() {
    return this.isExtension() ? chrome.extension.inIncognitoContext : false;
  }
}
