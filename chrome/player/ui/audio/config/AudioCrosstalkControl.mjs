export class AudioCrosstalkControl {
  constructor(enabled, inputgain, decaygain, endgain, centergain, microdelay, highpass, lowpass) {
    this.enabled = !!enabled;
    this.inputgain = parseFloat(inputgain);
    this.decaygain = parseFloat(decaygain);
    this.endgain = parseFloat(endgain);
    this.centergain = parseFloat(centergain);
    this.microdelay = parseFloat(microdelay);
    this.highpass = parseFloat(highpass);
    this.lowpass = parseFloat(lowpass);
  }

  static fromObj(obj) {
    return new AudioCrosstalkControl(obj.enabled, obj.inputgain, obj.decaygain, obj.endgain, obj.centergain, obj.microdelay, obj.highpass, obj.lowpass);
  }

  toObj() {
    return {
      enabled: this.enabled,
      inputgain: this.inputgain,
      decaygain: this.decaygain,
      endgain: this.endgain,
      centergain: this.centergain,
      microdelay: this.microdelay,
      highpass: this.highpass,
      lowpass: this.lowpass,
    };
  }
}

