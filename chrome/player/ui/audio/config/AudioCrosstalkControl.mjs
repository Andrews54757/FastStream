export class AudioCrosstalkControl {
  constructor(enabled, decaygain, centergain, microdelay, lowbypass, highbypass) {
    this.enabled = !!enabled;
    this.decaygain = parseFloat(decaygain);
    this.centergain = parseFloat(centergain);
    this.microdelay = parseFloat(microdelay);
    this.lowbypass = parseFloat(lowbypass);
    this.highbypass = parseFloat(highbypass);
  }

  static fromObj(obj) {
    return new AudioCrosstalkControl(obj.enabled, obj.decaygain, obj.centergain, obj.microdelay, obj.lowbypass, obj.highbypass);
  }

  toObj() {
    return {
      enabled: this.enabled,
      decaygain: this.decaygain,
      centergain: this.centergain,
      microdelay: this.microdelay,
      lowbypass: this.lowbypass,
      highbypass: this.highbypass,
    };
  }
}

