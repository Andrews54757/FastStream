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

  static isFirefox() {
    return navigator.userAgent.indexOf('Firefox') !== -1;
  }

  static isSafari() {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
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

  static isMacOS() {
    return navigator.userAgent.indexOf('Mac OS') !== -1;
  }

  static isWebAudioSupported() {
    return !!window.AudioContext;
  }

  static async getAvailableStorage() {
    if (!window.navigator || !window.navigator.storage || !window.navigator.storage.estimate) {
      // 2GB
      return 2 * 1024 * 1024 * 1024;
    }
    const estimate = await window.navigator.storage.estimate().catch(() => ({quota: 2 * 1024 * 1024 * 1024, usage: 0}));
    return estimate.quota - estimate.usage;
  }
}
