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
  inputgain: 0.70,
  decaygain: 0.74989420933,
  endgain: 1.4285,
  centergain: 0.70,
  microdelay: 32,
};

class CrosstalkNode {
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
    await this.ctx.audioWorklet.addModule(assetPath('crosstalk.worklet.mjs'));
    const crosstalkNode = new AudioWorkletNode(this.ctx, 'crosstalk-worklet', {
      processorOptions: this.options,
    });
    this.entryNode = crosstalkNode;
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

  receive(node) {
    node.connect(this.entryNode);
  }
}


export const Crosstalk = {
  CrosstalkNode,
};
