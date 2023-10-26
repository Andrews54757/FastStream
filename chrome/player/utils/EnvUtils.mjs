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
}
