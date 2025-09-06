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

  isDefault() {
    const def = AudioCrosstalkControl.default();
    return this.enabled === def.enabled &&
      (this.decay === def.decay || (isNaN(this.decay) && isNaN(def.decay))) &&
      this.colorgain === def.colorgain &&
      (this.microdelay === def.microdelay || (isNaN(this.microdelay) && isNaN(def.microdelay))) &&
      this.lowbypass === def.lowbypass &&
      this.highbypass === def.highbypass;
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

