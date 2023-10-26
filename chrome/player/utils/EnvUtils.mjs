export class EnvUtils {
  static isChrome() {
    const ua = navigator.userAgent;
    return /Chrome/.test(ua);
  }

  static isMac() {
    const ua = navigator.userAgent;
    return /Macintosh/.test(ua);
  }

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
}
