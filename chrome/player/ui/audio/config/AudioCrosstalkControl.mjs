export class AudioCrosstalkControl {
  constructor(enabled, decaygain, centergain, microdelay, highpass, lowpass) {
    this.enabled = !!enabled;
    this.decaygain = parseFloat(decaygain);
    this.centergain = parseFloat(centergain);
    this.microdelay = parseFloat(microdelay);
    this.highpass = parseFloat(highpass);
    this.lowpass = parseFloat(lowpass);
  }

  static fromObj(obj) {
    return new AudioCrosstalkControl(obj.enabled, obj.decaygain, obj.centergain, obj.microdelay, obj.highpass, obj.lowpass);
  }

  toObj() {
    return {
      enabled: this.enabled,
      decaygain: this.decaygain,
      centergain: this.centergain,
      microdelay: this.microdelay,
      highpass: this.highpass,
      lowpass: this.lowpass,
    };
  }
}

