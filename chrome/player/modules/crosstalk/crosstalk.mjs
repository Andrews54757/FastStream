import {CrossoverNode} from './crossover.mjs';
/* eslint-disable camelcase */
export class CrosstalkNode {
  constructor(audioContext, options) {
    this.cachedOptions = {};
    this.audioContext = audioContext;
    this.configure(options);
  }

  configure(noptions) {
    const options = {
      microdelay: 90,
      decaygain: 0.985,
      colorgain: 7,
      lowbypass: 250,
      highbypass: 5000,
      ...noptions,
    };
    const fs = this.audioContext.sampleRate;
    options.tc = options.microdelay * fs * 1e-6;
    options.g = options.decaygain;
    options.y = options.colorgain;

    const changedProperties = {
      lowbypass: options.lowbypass !== this.cachedOptions.lowbypass,
      highbypass: options.highbypass !== this.cachedOptions.highbypass,
    };

    this.cachedOptions = options;

    if (changedProperties.highbypass || changedProperties.lowbypass) {
      this.configureCrossover();
    }

    this.configureXTC();
  }

  configureXTC() {
    if (this.xtc) {
      this.xtc.configure(this.cachedOptions);
    }
  }

  configureCrossover() {
    this.cutoffs = [];
    this.mappings = [];

    this.cutoffs = [this.cachedOptions.lowbypass, this.cachedOptions.highbypass];
    this.mappings = [0, 1, 0];

    if (this.cachedOptions.highbypass < this.cachedOptions.lowbypass) {
      this.cutoffs.pop();
      this.mappings.pop();
    }

    // check 20hz
    for (let i = this.cutoffs.length - 1; i >= 0; i--) {
      if (this.cutoffs[i] <= 20) {
        this.cutoffs = this.cutoffs.slice(i + 1);
        this.mappings = this.mappings.slice(i + 1);
        break;
      }
    }

    // Check nyquist and 20kHz
    const fs = this.audioContext.sampleRate;
    for (let i = 0; i < this.cutoffs.length; i++) {
      if (this.cutoffs[i] > fs / 2 || this.cutoffs[i] >= 20000) {
        this.cutoffs = this.cutoffs.slice(0, i);
        this.mappings = this.mappings.slice(0, i + 1);
        break;
      }
    }

    if (this.crossover) {
      this.crossover.configure({
        cutoffs: this.cutoffs,
        mappings: this.mappings,
      });
    }
  }

  async init() {
    // Create splitter and merger nodes
    const ctx = this.audioContext;
    this.input = ctx.createGain();
    this.input.channelInterpretation = 'speakers';
    this.input.channelCount = 2;
    this.input.channelCountMode = 'explicit';
    this.input.gain.value = 1.2;

    const merger = ctx.createChannelMerger(2);
    this.output = merger;

    this.crossover = new CrossoverNode(ctx, {
      cutoffs: this.cutoffs,
      mappings: this.mappings,
      numOutputs: 2,
    });

    const ConvolutionXTC = await import('./convolution.mjs');
    this.xtc = new ConvolutionXTC(ctx, this.cachedOptions);

    await this.crossover.init();

    this.input.connect(this.crossover.getNode());

    await this.xtc.init(this.crossover.getNode());

    this.output = this.xtc.getOutputNode();
  }

  getOutputNode() {
    return this.output;
  }

  getInputNode() {
    return this.input;
  }

  destroy() {
    this.crossover.destroy();
    this.xtc.destroy();
  }
}
