import {AbstractAudioModule} from './AbstractAudioModule.mjs';

export class MonoUpscaler extends AbstractAudioModule {
  constructor() {
    super('MonoUpscaler');
    this.enabled = false;
  }

  setupNodes(audioContext) {
    super.setupNodes(audioContext);
    this.getInputNode().connect(this.getOutputNode());
    this.stereoPanner = null;
    this.enabled = false;
  }

  enable() {
    if (this.enabled || !this.audioContext) {
      return;
    }

    this.stereoPanner = this.audioContext.createStereoPanner();
    this.stereoPanner.channelInterpretation = 'discrete';

    this.getInputNode().disconnect(this.getOutputNode());
    this.getInputNode().connect(this.stereoPanner);
    this.getOutputNode().connectFrom(this.stereoPanner);

    this.enabled = true;
  }

  disable() {
    if (!this.enabled) {
      return;
    }

    this.getInputNode().disconnect(this.splitter);
    this.getInputNode().disconnect(this.stereoPanner);
    this.getOutputNode().disconnectFrom(this.merger);
    this.getOutputNode().disconnectFrom(this.stereoPanner);

    this.getInputNode().connect(this.getOutputNode());

    this.splitter.disconnect();
    this.merger.disconnect();
    this.stereoPanner.disconnect();

    this.splitter = null;
    this.merger = null;
    this.stereoPanner = null;

    this.enabled = false;
  }
}
