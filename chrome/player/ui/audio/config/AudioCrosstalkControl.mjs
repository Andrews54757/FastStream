export class AudioCrosstalkControl {
  constructor(enabled, decay, colorgain, microdelay, lowbypass, highbypass, speakerdistance, headdistance) {
    this.enabled = !!enabled;
    this.decay = parseFloat(decay);
    this.colorgain = parseFloat(colorgain);
    this.microdelay = parseFloat(microdelay);
    this.lowbypass = parseFloat(lowbypass);
    this.highbypass = parseFloat(highbypass);
    this.speakerdistance = parseFloat(speakerdistance);
    this.headdistance = parseFloat(headdistance);
  }

  static fromObj(obj) {
    return new AudioCrosstalkControl(obj.enabled, obj.decay || obj.decaygain / 1000 ||-0.37, obj.colorgain, obj.microdelay, obj.lowbypass, obj.highbypass, obj.speakerdistance, obj.headdistance);
  }

  static default() {
    return new AudioCrosstalkControl(false, -0.37, 5, 89, 250, 5000, 25, 70);
  }

  toObj() {
    return {
      enabled: this.enabled,
      decay: this.decay,
      colorgain: this.colorgain,
      microdelay: this.microdelay,
      lowbypass: this.lowbypass,
      highbypass: this.highbypass,
      speakerdistance: this.speakerdistance,
      headdistance: this.headdistance,
    };
  }
}

