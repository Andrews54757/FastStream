export class AudioCrosstalkControl {
  constructor(enabled, inputgain, decaygain, endgain, centergain, microdelay) {
    this.enabled = !!enabled;
    this.inputgain = parseFloat(inputgain);
    this.decaygain = parseFloat(decaygain);
    this.endgain = parseFloat(endgain);
    this.centergain = parseFloat(centergain);
    this.microdelay = parseFloat(microdelay);
  }

  static fromObj(obj) {
    return new AudioCrosstalkControl(obj.enabled, obj.inputgain, obj.decaygain, obj.endgain, obj.centergain, obj.microdelay);
  }

  toObj() {
    return {
      enabled: this.enabled,
      inputgain: this.inputgain,
      decaygain: this.decaygain,
      endgain: this.endgain,
      centergain: this.centergain,
      microdelay: this.microdelay,
    };
  }
}

