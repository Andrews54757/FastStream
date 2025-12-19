import {LinkwitzRileyCrossoverNetwork} from './crossover.mjs';

const CROSSOVER_BYPASS = 0;
const CROSSOVER_XTC = 1;
export class CrosstalkNode {
  constructor(audioContext, options) {
    this.cachedOptions = {};
    this.audioContext = audioContext;
    this.configure(options);
  }

  configure(noptions) {
    const options = {
      microdelay: 90,
      decay: 0.985,
      colorgain: 7,
      lowbypass: 250,
      highbypass: 5000,
      ...noptions,
    };
    const fs = this.audioContext.sampleRate;
    options.tc = options.microdelay * fs * 1e-6;
    options.g = options.decay;
    options.y = options.colorgain;

    const changedProperties = {
      lowbypass: options.lowbypass !== this.cachedOptions.lowbypass,
      highbypass: options.highbypass !== this.cachedOptions.highbypass,
    };

    this.cachedOptions = options;

    if (changedProperties.highbypass || changedProperties.lowbypass) {
      clearTimeout(this.crossoverConfigureTimeout);
      this.crossoverConfigureTimeout = setTimeout(() => {
        this.configureCrossover();
      }, 50);
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
    this.mappings = [CROSSOVER_BYPASS, CROSSOVER_XTC, CROSSOVER_BYPASS];

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

    const merger = ctx.createChannelMerger(2);
    this.output = merger;

    this.crossover = new LinkwitzRileyCrossoverNetwork(ctx);
    this.configureCrossover();

    this.crossover.getInputNode().connectFrom(this.input);


    const {ConvolutionXTC} = await import('./convolution.mjs');
    this.xtc = new ConvolutionXTC(ctx, this.cachedOptions);


    await this.xtc.init();

    this.crossover.getOutputNode(CROSSOVER_BYPASS).connect(this.xtc.getBypassInputNode());
    this.crossover.getOutputNode(CROSSOVER_XTC).connect(this.xtc.getInputNode());

    this.output = this.xtc.getOutputNode();
  }

  getOutputNode() {
    return this.output;
  }

  getInputNode() {
    return this.input;
  }

  destroy() {
    this.crossover?.destroy();
    this.xtc?.destroy();
  }
}
