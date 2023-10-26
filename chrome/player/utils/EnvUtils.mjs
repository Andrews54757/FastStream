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
    return navigator.hardwareConcurrency >= 4;
  }
}
