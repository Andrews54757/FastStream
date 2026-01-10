export class AudioEQNode {
  constructor(type, frequency, gain, q) {
    this.type = type;
    this.frequency = parseFloat(frequency);
    this.gain = parseFloat(gain);
    this.q = parseFloat(q);
  }
  static fromObj(obj) {
    return new AudioEQNode(obj.type, obj.frequency, obj.gainDb === undefined ? obj.gain : obj.gainDb, obj.q ?? 1);
  }
  toObj() {
    return {
      type: this.type,
      frequency: this.frequency,
      gainDb: this.gain,
      q: this.q,
    };
  }
}
