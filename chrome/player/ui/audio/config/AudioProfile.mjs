import {AudioChannelControl} from './AudioChannelControl.mjs';
import {AudioCompressionControl} from './AudioCompressionControl.mjs';
import {AudioConvolverControl} from './AudioConvolverControl.mjs';
import {AudioCrosstalkControl} from './AudioCrosstalkControl.mjs';
import {AudioEQNode} from './AudioEQNode.mjs';

export const MAX_AUDIO_CHANNELS = 6; // 8; Change to 8 when 7.1 audio is fixed.
export const CHANNEL_NAMES = ['Left', 'Right', 'Center', 'Bass (LFE)', 'Left Surround', 'Right Surround', 'Side Left', 'Side Right'];

export class AudioProfile {
  constructor(id) {
    this.id = parseInt(id);
    this.channels = Array.from({length: MAX_AUDIO_CHANNELS}, (_, i) => {
      return AudioChannelControl.default(i);
    });
    this.master = AudioChannelControl.default('master');
    this.crosstalk = AudioCrosstalkControl.default();
    this.convolver = AudioConvolverControl.default();
    this.label = `Profile ${id}`;
  }

  static fromObj(obj) {
    const profile = new AudioProfile(obj.id);
    profile.label = obj.label;

    if (obj.channels && obj.channels.length <= MAX_AUDIO_CHANNELS) {
      profile.channels = obj.channels.map((channel) => {
        return AudioChannelControl.fromObj(channel);
      });
    } else if (obj.mixerChannels && obj.mixerChannels.length === 7) { // Legacy
      profile.channels = obj.mixerChannels.map((channel) => {
        return AudioChannelControl.fromObj(channel);
      });
      profile.master = profile.channels.pop();
    }

    // Sort channels by ID, increasing
    profile.channels.sort((a, b) => a.id - b.id);

    // fill remaining with defaults if less than MAX_CHANNELS
    if (profile.channels.length < MAX_AUDIO_CHANNELS) {
      const newChannels = [];
      for (let i = 0; i < MAX_AUDIO_CHANNELS; i++) {
        const existingChannel = profile.channels.find((ch) => ch.id === i);
        if (existingChannel) {
          newChannels.push(existingChannel);
        } else {
          newChannels.push(AudioChannelControl.default(i));
        }
      }
      profile.channels = newChannels;
    }

    if (obj.master) {
      const masterChannel = AudioChannelControl.fromObj(obj.master);
      profile.master = masterChannel;
    }

    if (!profile.master) {
      profile.master = AudioChannelControl.default('master');
    }

    if (obj.equalizerNodes) {
      profile.master.equalizerNodes = obj.equalizerNodes.map((node) => {
        return AudioEQNode.fromObj(node);
      }) || [];
    }

    if (obj.compressor) {
      profile.master.compressor = AudioCompressionControl.fromObj(obj.compressor);
    }

    if (obj.crosstalk) {
      profile.crosstalk = AudioCrosstalkControl.fromObj(obj.crosstalk);
    }

    if (obj.convolver) {
      profile.convolver = AudioConvolverControl.fromObj(obj.convolver);
    }

    // console.log('Loaded audio profile:', profile, obj);
    return profile;
  }

  copy() {
    return AudioProfile.fromObj(this.toObj());
  }

  toObj() {
    const obj = {
      id: this.id,
      label: this.label,
    };

    const nonDefaultChannels = this.channels.filter((channel) => !channel.isDefault());
    if (nonDefaultChannels.length > 0) {
      obj.channels = this.channels.map((channel) => {
        return channel.toObj();
      });
    }

    if (!this.master.isDefault()) {
      obj.master = this.master.toObj();
    }

    if (!this.crosstalk.isDefault()) {
      obj.crosstalk = this.crosstalk.toObj();
    }

    // if (!this.convolver.isDefault()) {
    //   obj.convolver = this.convolver.toObj();
    // }

    return obj;
  }
}
