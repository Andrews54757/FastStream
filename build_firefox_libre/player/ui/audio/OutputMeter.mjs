import {AudioUtils} from '../../utils/AudioUtils.mjs';
import {AbstractAudioModule} from './AbstractAudioModule.mjs';
export class OutputMeter extends AbstractAudioModule {
  constructor() {
    super('OutputMeter');
    this.channelAnalysers = [];
    this.mixerGain = null;
    this.splitterNode = null;
  }
  setupNodes(audioContext) {
    super.setupNodes(audioContext);
    this.splitterNode = null;
    this.mixerGain = null;
    this.channelAnalysers = [];
  }
  getMeterData() {
    if (!this.audioContext || !this.splitterNode) {
      return [];
    }
    const data = [];
    for (let i = 0; i < this.channelAnalysers.length; i++) {
      const analyser = this.channelAnalysers[i];
      const volume = AudioUtils.getVolume(analyser);
      const isClipping = AudioUtils.isClipping(analyser);
      data.push({volume, isClipping});
    }
    return data;
  }
  updateChannelCount(channelCount) {
    // check if we need to change anything
    if (!this.splitterNode) {
      return; // no analysers, so nothing to do
    }
    if (this.channelAnalysers.length === channelCount) {
      return; // same channel count, nothing to do
    }
    this.destroyAnalysers();
    this.createAnalysers(channelCount);
  }
  createAnalysers(channelCount) {
    if (!this.audioContext) {
      return;
    }
    if (this.splitterNode) {
      return;
    }
    this.mixerGain = this.audioContext.createGain();
    this.mixerGain.gain.value = 1;
    this.mixerGain.channelCountMode = 'explicit';
    try {
      this.mixerGain.channelCount = channelCount;
    } catch (e) {
      console.warn('Failed to set channelCount on mixer gain', e);
    }
    this.splitterNode = this.audioContext.createChannelSplitter(channelCount);
    for (let i = 0; i < channelCount; i++) {
      const analyser = AudioUtils.createVolumeAnalyserNode(this.audioContext);
      this.channelAnalysers[i] = analyser;
      this.splitterNode.connect(analyser, i);
    }
    this.getInputNode().connect(this.mixerGain);
    this.mixerGain.connect(this.splitterNode);
  }
  destroyAnalysers() {
    if (!this.splitterNode) {
      return;
    }
    this.getInputNode().disconnect(this.mixerGain);
    this.mixerGain.disconnect(this.splitterNode);
    for (let i = 0; i < this.channelAnalysers.length; i++) {
      this.splitterNode.disconnect(this.channelAnalysers[i]);
      this.channelAnalysers[i].disconnect();
    }
    this.splitterNode.disconnect();
    this.splitterNode = null;
    this.mixerGain = null;
    this.channelAnalysers = [];
  }
  get minDecibels() {
    if (this.channelAnalysers[0]) {
      return this.channelAnalysers[0].minDecibels;
    }
    return -100;
  }
  get maxDecibels() {
    if (this.channelAnalysers[0]) {
      return this.channelAnalysers[0].maxDecibels;
    }
    return -30;
  }
}
