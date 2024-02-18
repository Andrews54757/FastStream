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

const defaultProcessorOptions = {
  decaygain: 0.74989420933,
  centergain: 0.70,
  microdelay: 32,
};

class CrossoverNode {
  constructor(ctx, options) {
    this.ctx = ctx;
    this.options = {
      ...defaultProcessorOptions,
      ...options,
    };
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


  async init() {
    await this.ctx.audioWorklet.addModule(assetPath('crossover.worklet.mjs'));
    const crossoverNode = new AudioWorkletNode(this.ctx, 'crossover-worklet', {
      processorOptions: this.options,
      numberOfInputs: 1,
      numberOfOutputs: this.options.numOutputs,
      outputChannelCount: (new Array(this.options.numOutputs)).fill(2),
    });
    crossoverNode.channelInterpretation = 'discrete';
    crossoverNode.channelCountMode = 'explicit';
    crossoverNode.channelCount = 2;
    this.entryNode = crossoverNode;
    return this;
  }

  getNode() {
    return this.entryNode;
  }

  destroy() {
    if (!this.entryNode) {
      return;
    }
    this.getNode().port.postMessage({type: 'close'});
    this.entryNode.disconnect();
    this.entryNode = undefined;
  }
}


export const Crossover = {
  CrossoverNode,
};
