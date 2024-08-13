
export class AudioChannelControl {
  constructor(channelId, gain, mutedOrMono, solo) {
    this.id = parseInt(channelId);
    this.gain = parseFloat(gain);

    if (this.id === 6) {
      this.mono = mutedOrMono;
    } else {
      this.muted = mutedOrMono;
      this.solo = solo;
    }
  }

  static fromObj(obj) {
    if (obj.id === 'master') {
      return new AudioChannelControl(6, obj.gain, obj.mono, null);
    } else {
      return new AudioChannelControl(obj.id, obj.gain, obj.muted, obj.solo);
    }
  }

  toObj() {
    if (this.id === 6) {
      return {
        id: 'master',
        gain: this.gain,
        mono: this.mono,
      };
    } else {
      return {
        id: this.id,
        gain: this.gain,
        muted: this.muted,
        solo: this.solo,
      };
    }
  }
}
