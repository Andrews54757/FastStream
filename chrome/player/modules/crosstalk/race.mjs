const currentScript = import.meta;
let basePath = '';
if (currentScript) {
  basePath = currentScript.url
      .replace(/#.*$/, '')
      .replace(/\?.*$/, '')
      .replace(/\/[^\/]+$/, '/');
}

const assetPath = (file) => {
  return basePath + file;
};

export class RaceXTC {
  constructor(ctx, options) {
    this.ctx = ctx;
    this.options = options;
  }

  configure(options) {
    this.options = {
      ...this.options,
      ...options,
    };
    this.getNode().port.postMessage({
      type: 'configure',
      options: this.options,
    });
  }


  async init(input) {
    this.input = input;
    this.output = this.ctx.createGain();

    await this.ctx.audioWorklet.addModule(assetPath('race.worklet.mjs'));
    const crosstalkNode = new AudioWorkletNode(this.ctx, 'racextc-worklet', {
      processorOptions: this.options,
    });
    this.entryNode = crosstalkNode;

    this.input.connect(this.entryNode, 1);
    this.entryNode.connect(this.output);
    this.input.connect(this.output, 0);
    return this;
  }

  getOutputNode() {
    return this.output;
  }

  destroy() {
    if (!this.entryNode) {
      return;
    }
    this.getNode().port.postMessage({type: 'close'});
    this.entryNode.disconnect();
    this.input.disconnect();
    this.output.disconnect();
    this.entryNode = undefined;
  }
}
