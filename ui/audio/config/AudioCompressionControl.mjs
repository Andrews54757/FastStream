export class AudioCompressionControl {
  constructor(enabled, attack, knee, ratio, release, threshold, gain) {
    this.enabled = !!enabled;
    this.attack = parseFloat(attack);
    this.knee = parseFloat(knee);
    this.ratio = parseFloat(ratio);
    this.release = parseFloat(release);
    this.threshold = parseFloat(threshold);
    this.gain = parseFloat(gain);
  }
  static fromObj(obj) {
    return new AudioCompressionControl(obj.enabled, obj.attack, obj.knee, obj.ratio, obj.release, obj.threshold, obj.gain);
  }
  toObj() {
    return {
      enabled: this.enabled,
      attack: this.attack,
      knee: this.knee,
      ratio: this.ratio,
      release: this.release,
      threshold: this.threshold,
      gain: this.gain,
    };
  }
}
