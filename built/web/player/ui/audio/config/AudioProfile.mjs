import {AudioChannelControl} from './AudioChannelControl.mjs';
import {AudioCompressionControl} from './AudioCompressionControl.mjs';
import {AudioEQNode} from './AudioEQNode.mjs';
export class AudioProfile {
  constructor(id) {
    this.id = parseInt(id);
    this.equalizerNodes = [];
    this.mixerChannels = [];
    this.compressor = new AudioCompressionControl(false, 0.003, 30, 12, 0.25, -24, 1);
    this.label = `Profile ${id}`;
  }
  static fromObj(obj) {
    const profile = new AudioProfile(obj.id);
    profile.label = obj.label;
    profile.equalizerNodes = obj.equalizerNodes?.map((nodeObj) => {
      return AudioEQNode.fromObj(nodeObj);
    }) || [];
    profile.mixerChannels = obj.mixerChannels?.map((channelObj) => {
      return AudioChannelControl.fromObj(channelObj);
    }) || [];
    if (obj.compressor) {
      profile.compressor = AudioCompressionControl.fromObj(obj.compressor || {});
    }
    return profile;
  }
  copy() {
    return AudioProfile.fromObj(this.toObj());
  }
  toObj() {
    return {
      id: this.id,
      label: this.label,
      equalizerNodes: this.equalizerNodes.map((node) => {
        return node.toObj();
      }),
      mixerChannels: this.mixerChannels.map((channel) => {
        return channel.toObj();
      }),
      compressor: this.compressor.toObj(),
    };
  }
}
