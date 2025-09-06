
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

  static default() {
    return new AudioCompressionControl(false, 0.003, 30, 12, 0.25, -24, 1);
  }

  isDefault() {
    const def = AudioCompressionControl.default();
    return this.enabled === def.enabled &&
      this.attack === def.attack &&
      this.knee === def.knee &&
      this.ratio === def.ratio &&
      this.release === def.release &&
      this.threshold === def.threshold &&
      this.gain === def.gain;
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

