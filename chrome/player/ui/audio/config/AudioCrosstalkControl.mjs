export class AudioCrosstalkControl {
  constructor(enabled, decaygain, centergain, microdelay, lowbypass, highbypass, speakerdistance, headdistance) {
    this.enabled = !!enabled;
    this.decaygain = parseFloat(decaygain);
    this.centergain = parseFloat(centergain);
    this.microdelay = parseFloat(microdelay);
    this.lowbypass = parseFloat(lowbypass);
    this.highbypass = parseFloat(highbypass);
    this.speakerdistance = parseFloat(speakerdistance);
    this.headdistance = parseFloat(headdistance);
  }

  static fromObj(obj) {
    return new AudioCrosstalkControl(obj.enabled, obj.decaygain, obj.centergain, obj.microdelay, obj.lowbypass, obj.highbypass, obj.speakerdistance, obj.headdistance);
  }

  toObj() {
    return {
      enabled: this.enabled,
      decaygain: this.decaygain,
      centergain: this.centergain,
      microdelay: this.microdelay,
      lowbypass: this.lowbypass,
      highbypass: this.highbypass,
      speakerdistance: this.speakerdistance,
      headdistance: this.headdistance,
    };
  }
}

