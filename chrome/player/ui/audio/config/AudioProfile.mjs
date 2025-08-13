import {AudioChannelControl} from './AudioChannelControl.mjs';
import {AudioCompressionControl} from './AudioCompressionControl.mjs';
import {AudioCrosstalkControl} from './AudioCrosstalkControl.mjs';
import {AudioEQNode} from './AudioEQNode.mjs';

export class AudioProfile {
  constructor(id) {
    this.id = parseInt(id);
    this.channels = Array.from({length: 6}, (_, i) => {
      return AudioChannelControl.default(i);
    });
    this.master = AudioChannelControl.default('master');
    this.crosstalk = AudioCrosstalkControl.default();
    this.label = `Profile ${id}`;
  }

  static fromObj(obj) {
    const profile = new AudioProfile(obj.id);
    profile.label = obj.label;

    if (obj.channels && obj.channels.length <= 6) {
      profile.channels = obj.channels.map((channel) => {
        return AudioChannelControl.fromObj(channel);
      });
      // fill remaining with defaults if less than 6
      for (let i = profile.channels.length; i < 6; i++) {
        profile.channels.push(AudioChannelControl.default(i));
      }
    } else if (obj.mixerChannels && obj.mixerChannels.length === 7) {
      profile.channels = obj.mixerChannels.map((channel) => {
        return AudioChannelControl.fromObj(channel);
      });
      profile.master = profile.channels.pop();
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

    // console.log('Loaded audio profile:', profile, obj);
    return profile;
  }

  copy() {
    return AudioProfile.fromObj(this.toObj());
  }

  toObj() {
    return {
      id: this.id,
      label: this.label,
      channels: this.channels.map((channel) => {
        return channel.toObj();
      }),
      master: this.master.toObj(),
      crosstalk: this.crosstalk.toObj(),
    };
  }
}
