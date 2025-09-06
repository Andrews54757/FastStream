export class AudioCrosstalkControl {
  constructor(enabled, decay, colorgain, microdelay, lowbypass, highbypass) {
    this.enabled = !!enabled;
    this.decay = parseFloat(decay);
    this.colorgain = parseFloat(colorgain);
    this.microdelay = parseFloat(microdelay);
    this.lowbypass = parseFloat(lowbypass);
    this.highbypass = parseFloat(highbypass);
  }

  static fromObj(obj) {
    return new AudioCrosstalkControl(obj.enabled, obj.decay || obj.decaygain / 1000, obj.colorgain, obj.microdelay, obj.lowbypass, obj.highbypass);
  }

  static default() {
    return new AudioCrosstalkControl(false, NaN, 5, NaN, 250, 5000);
  }

  toObj() {
    return {
      enabled: this.enabled,
      decay: this.decay,
      colorgain: this.colorgain,
      microdelay: this.microdelay,
      lowbypass: this.lowbypass,
      highbypass: this.highbypass,
    };
  }
}

