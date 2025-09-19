import {MAX_AUDIO_CHANNELS} from './AudioProfile.mjs';

export class AudioConvolverChannel {
  constructor(id, enabled, normalize) {
    this.id = id;
    this.enabled = !!enabled;
    this.normalize = !!normalize;
  }

  toObj() {
    return {
      id: this.id,
      enabled: this.enabled,
      normalize: this.normalize,
    };
  }

  static fromObj(obj) {
    return new AudioConvolverChannel(obj.id, obj.enabled, obj.normalize);
  }

  static default(id) {
    return new AudioConvolverChannel(id, false, false);
  }

  isDefault() {
    const def = AudioConvolverChannel.default(0);
    return this.enabled === def.enabled &&
            this.normalize === def.normalize;
  }
}

export class AudioConvolverControl {
  constructor(enabled, downmix, bufferSize, channels) {
    this.enabled = !!enabled;
    this.downmix = !!downmix;
    this.bufferSize = bufferSize;

    this.channels = channels || [];
  }

  static fromObj(obj) {
    const channels = (obj.channels || []).map((ch) => AudioConvolverChannel.fromObj(ch));
    const newChannels = [];
    for (let i = 0; i < MAX_AUDIO_CHANNELS; i++) {
      const existingChannel = channels.find((ch) => ch.id === i);
      if (existingChannel) {
        newChannels.push(existingChannel);
      } else {
        newChannels.push(AudioConvolverChannel.default(i));
      }
    }
    return new AudioConvolverControl(obj.enabled, obj.downmix, obj.bufferSize ?? 2048, newChannels);
  }

  static default() {
    const channels = [];
    for (let i = 0; i < MAX_AUDIO_CHANNELS; i++) {
      channels.push(AudioConvolverChannel.default(i));
    }
    return new AudioConvolverControl(false, true, 2048, channels);
  }

  isDefault() {
    const def = AudioConvolverControl.default();
    if (this.enabled !== def.enabled || this.downmix !== def.downmix || this.bufferSize !== def.bufferSize) {
      return false;
    }
    if (this.channels.length !== def.channels.length) {
      return false;
    }
    for (let i = 0; i < this.channels.length; i++) {
      if (!this.channels[i].isDefault()) {
        return false;
      }
    }
    return true;
  }

  toObj() {
    return {
      enabled: this.enabled,
      downmix: this.downmix,
      bufferSize: this.bufferSize,
      channels: this.channels.filter((ch) => !ch.isDefault()).map((ch) => ch.toObj()),
    };
  }
}
