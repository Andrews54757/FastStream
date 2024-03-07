import {EventEmitter} from '../eventemitter.mjs';
import {AudioAnalyzerNode} from './AudioAnalyzerNode.mjs';

export class AudioAnalyzer extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.outputRate = 10;
    this.vadBuffer = [];
    this.volumeBuffer = [];

    this.vadNeededBy = [];
    this.volumeNeededBy = [];

    this.analyzerNodes = new Map();
  }

  onVadFrameProcessed(time, isSpeechProb) {
    const frame = Math.floor(time * this.outputRate);
    this.vadBuffer[frame] = isSpeechProb;
    this.emit('vad', time, isSpeechProb);
  }

  onVolumeFrameProcessed(time, volume) {
    const frame = Math.floor(time * this.outputRate);
    this.volumeBuffer[frame] = volume;
    this.emit('volume', time, volume);
  }

  addVadDependent(dependent) {
    if (this.vadNeededBy.includes(dependent)) return;
    this.vadNeededBy.push(dependent);

    this.sendConfigToAnalyzerNodes();
  }

  removeVadDependent(dependent) {
    const index = this.vadNeededBy.indexOf(dependent);
    if (index !== -1) {
      this.vadNeededBy.splice(index, 1);
    }

    this.sendConfigToAnalyzerNodes();
  }

  addVolumeDependent(dependent) {
    if (this.volumeNeededBy.includes(dependent)) return;
    this.volumeNeededBy.push(dependent);

    this.sendConfigToAnalyzerNodes();
  }

  removeVolumeDependent(dependent) {
    const index = this.volumeNeededBy.indexOf(dependent);
    if (index !== -1) {
      this.volumeNeededBy.splice(index, 1);
    }

    this.sendConfigToAnalyzerNodes();
  }

  sendConfigToAnalyzerNodes() {
    const vad = this.vadNeededBy.length > 0;
    const volume = this.volumeNeededBy.length > 0;

    this.analyzerNodes.forEach((node) => {
      node.configure({vad, volume});
    });
  }

  reset() {
    try {
      this.vadBuffer = [];
      this.volumeBuffer = [];

      this.analyzerNodes.forEach((node) => {
        node.destroy();
      });
      this.analyzerNodes.clear();
    } catch (e) {
      console.error(e);
    }
  }

  getVadData() {
    return this.vadBuffer;
  }

  getVolumeData() {
    return this.volumeBuffer;
  }

  getOutputRate() {
    return this.outputRate;
  }

  setupAnalyzerNodeForMainPlayer(videoElement, audioSource, audioContext) {
    if (this.analyzerNodes.has('main')) {
      this.analyzerNodes.get('main').destroy();
    }

    const mainAnalyzerNode = new AudioAnalyzerNode();
    this.analyzerNodes.set('main', mainAnalyzerNode);
    mainAnalyzerNode.attach(videoElement, audioSource, audioContext);
    mainAnalyzerNode.on('vad', this.onVadFrameProcessed.bind(this));
    mainAnalyzerNode.on('volume', this.onVolumeFrameProcessed.bind(this));

    mainAnalyzerNode.configure({
      vad: this.vadNeededBy.length > 0,
      volume: this.volumeNeededBy.length > 0,
    });
  }
}
