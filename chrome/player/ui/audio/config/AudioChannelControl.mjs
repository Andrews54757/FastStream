
export class AudioChannelControl {
  constructor(channelId, gain, muted, solo) {
    this.id = parseInt(channelId);
    this.gain = parseFloat(gain);
    this.muted = muted;
    this.solo = solo;
  }

  static fromObj(obj) {
    return new AudioChannelControl(obj.id === 'master' ? 6 : obj.id, obj.gain, obj.muted, obj.solo);
  }

  toObj() {
    return {
      id: this.id === 6 ? 'master' : this.id,
      gain: this.gain,
      muted: this.muted,
      solo: this.solo,
    };
  }
}
