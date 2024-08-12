import {AbstractAudioModule} from './AbstractAudioModule.mjs';

export class AudioGain extends AbstractAudioModule {
  constructor() {
    super('AudioGain');
    this.gainNode = null;
    this.gain = 1;
  }

  setupNodes(audioContext) {
    super.setupNodes(audioContext);
    this.gainNode = null;
    this.getInputNode().connect(this.getOutputNode());
    this.updateNodes();
  }

  setGain(gain) {
    this.gain = gain;
    this.updateNodes();

    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      this.updateNodes(true);
    }, 200);
  }

  updateNodes(yeet = false) {
    if (!this.audioContext) {
      return;
    }

    if (this.gain !== 1) {
      if (!this.gainNode) {
        this.gainNode = this.audioContext.createGain();
        this.getInputNode().disconnect(this.getOutputNode());
        this.getInputNode().connect(this.gainNode);
        this.getOutputNode().connectFrom(this.gainNode);
      }
      this.gainNode.gain.value = this.gain;
    } else {
      if (this.gainNode && yeet) {
        this.getInputNode().disconnect(this.gainNode);
        this.getOutputNode().disconnectFrom(this.gainNode);
        this.getInputNode().connect(this.getOutputNode());
        this.gainNode = null;
      }
    }
  }
}
