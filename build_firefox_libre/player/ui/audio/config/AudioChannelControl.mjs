import {AudioEQNode} from './AudioEQNode.mjs';
import {AudioCompressionControl} from './AudioCompressionControl.mjs';
export class AudioChannelControl {
  constructor(channelId, gain, mutedOrMono, solo, equalizerNodes, compressor) {
    this.id = channelId === 'master' ? channelId : parseInt(channelId);
    this.gain = parseFloat(gain);
    if (this.isMaster()) {
      this.mono = mutedOrMono;
    } else {
      this.muted = mutedOrMono;
      this.solo = solo;
    }
    this.equalizerNodes = equalizerNodes;
    this.compressor = compressor;
  }
  static default(id) {
    return new AudioChannelControl(id, 1, false, false, [], AudioCompressionControl.default());
  }
  static fromObj(obj) {
    const equalizerNodes = obj.equalizerNodes?.map((nodeObj) => {
      return AudioEQNode.fromObj(nodeObj);
    }) || [];
    const compressor = obj.compressor ? AudioCompressionControl.fromObj(obj.compressor) : AudioCompressionControl.default();
    if (obj.id === 'master') {
      return new AudioChannelControl(obj.id, obj.gain, obj.mono, null, equalizerNodes, compressor);
    } else {
      return new AudioChannelControl(obj.id, obj.gain, obj.muted, obj.solo, equalizerNodes, compressor);
    }
  }
  isDefault() {
    if (this.gain !== 1) return false;
    if (this.isMaster()) {
      if (this.mono !== false) return false;
    } else {
      if (this.muted !== false) return false;
      if (this.solo !== false) return false;
    }
    if (this.equalizerNodes.length !== 0) return false;
    if (!this.compressor.isDefault()) return false;
    return true;
  }
  toObj() {
    if (this.isMaster()) {
      return {
        id: 'master',
        gain: this.gain,
        mono: this.mono,
        equalizerNodes: this.equalizerNodes.map((node) => {
          return node.toObj();
        }),
        compressor: this.compressor.toObj(),
      };
    } else {
      return {
        id: this.id,
        gain: this.gain,
        muted: this.muted,
        solo: this.solo,
        equalizerNodes: this.equalizerNodes.map((node) => {
          return node.toObj();
        }),
        compressor: this.compressor.toObj(),
      };
    }
  }
  isMaster() {
    return this.id === 'master';
  }
}
