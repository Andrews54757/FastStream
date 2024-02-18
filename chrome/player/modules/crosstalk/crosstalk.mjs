import {Crossover} from './crossover.mjs';
import {FFT} from './fft.mjs';

const BUFFER_SIZE = 512;
const SHIFT_AMOUNT = 128;
/* eslint-disable camelcase */
export class CrosstalkNode {
  constructor(audioContext, options) {
    this.cachedOptions = {};
    this.currentConvolver = 0;
    this.audioContext = audioContext;
    this.fft = new FFT(BUFFER_SIZE * 2);
    this.configure(options);
  }

  idft(X) {
    const x = new Float32Array(X.length);
    this.fft.inverseTransform(x, X);
    return this.fft.fromComplexArray(x, new Float32Array(x.length / 2));
  }

  complexMultiply([a, b], [c, d]) {
    return [a * c - b * d, a * d + b * c];
  }

  complexDivide([a, b], [c, d]) {
    const den = c * c + d * d;
    return [(a * c + b * d) / den, (b * c - a * d) / den];
  }

  complexPower([a, b], n) {
    const r = Math.sqrt(a * a + b * b);
    const theta = Math.atan2(b, a);
    const rN = Math.pow(r, n);
    const thetaN = n * theta;
    return [rN * Math.cos(thetaN), rN * Math.sin(thetaN)];
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

    const changedProperties = {
      microdelay: options.microdelay !== this.cachedOptions.microdelay,
      decaygain: options.decaygain !== this.cachedOptions.decaygain,
      colorgain: options.colorgain !== this.cachedOptions.colorgain,
      lowbypass: options.lowbypass !== this.cachedOptions.lowbypass,
      highbypass: options.highbypass !== this.cachedOptions.highbypass,
    };

    this.cachedOptions = options;

    if (changedProperties.highbypass || changedProperties.lowbypass) {
      this.configureCrossover();
    }

    if (changedProperties.microdelay || changedProperties.decaygain || changedProperties.colorgain) {
      const fs = this.audioContext.sampleRate;
      const n = BUFFER_SIZE * 2;

      const g = options.decaygain;
      const tc = options.microdelay * fs * 1e-6;
      const y = options.colorgain;
      const gg = g * g;

      const H_CIS = new Float32Array(n * 2);
      const H_CROSS = new Float32Array(n * 2);

      const B = 0.0005;
      for (let k = 0; k < n; k++) {
        const omegatc = 2 * Math.PI * k / n * tc;
        const z = [Math.cos(2 * omegatc), Math.sin(2 * omegatc)];
        const cos = Math.cos(omegatc);
        const cm_I = Math.sqrt(gg - 2*g*cos + 1);
        const cm_II = Math.sqrt(gg + 2*g*cos + 1);
        const sp = Math.max(1/cm_I, 1/cm_II);

        if (sp < y) {
          const [a, b, c, d] = this.calculateH(g, z, B);
          H_CIS[k * 2] = a;
          H_CIS[k * 2 + 1] = b;
          H_CROSS[k * 2] = c;
          H_CROSS[k * 2 + 1] = d;
        } else if (cm_I < cm_II) {
          const B_I = -gg + 2*g*cos + cm_I / y - 1;
          const [a_I, b_I, c_I, d_I] = this.calculateH(g, z, B_I);

          H_CIS[k * 2] = a_I;
          H_CIS[k * 2 + 1] = b_I;
          H_CROSS[k * 2] = c_I;
          H_CROSS[k * 2 + 1] = d_I;
        } else {
          const B_II = -gg - 2*g*cos + cm_II / y - 1;
          const [a_II, b_II, c_II, d_II] = this.calculateH(g, z, B_II);

          H_CIS[k * 2] = a_II;
          H_CIS[k * 2 + 1] = b_II;
          H_CROSS[k * 2] = c_II;
          H_CROSS[k * 2 + 1] = d_II;
        }
      }

      this.H_CIS = H_CIS;
      this.H_CROSS = H_CROSS;

      this.h_CIS = this.idft(H_CIS);
      this.h_CROSS = this.idft(H_CROSS);
      this.rotateBuffer(this.h_CIS, SHIFT_AMOUNT);
      this.rotateBuffer(this.h_CROSS, SHIFT_AMOUNT);

      if (this.buffer_L) {
        this.updateBuffers();
      }
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

  calculateH(g, z, B) {
    const gg = g * g;
    const [z_r, z_i] = z;
    const [zz_r, zz_i] = this.complexMultiply(z, z);
    const gbb1 = Math.pow(gg + B, 2) + 2*B + 1;
    const num1 = [zz_r*gg - z_r*(B + 1), zz_i*gg - z_i*(B + 1)];
    const den = [zz_r*gg + gg - z_r*gbb1, zz_i*gg - z_i*gbb1];
    const [a, b] = this.complexDivide(num1, den);
    const [z12_r, z12_i] = this.complexPower(z, 1/2);
    const [z12n_r, z12n_i] = this.complexPower(z, -1/2);
    const num2 = this.complexMultiply(
        z,
        [g*z12n_r - g*(gg + B)*z12_r, g*z12n_i - g*(gg + B)*z12_i],
    );
    const [c, d] = this.complexDivide(num2, den);

    return [a, b, c, d];
  }

  rotateBuffer(buffer, amount) {
    if (amount === 0) {
      return;
    }
    // rotate right
    const temp = buffer.slice(-amount);
    buffer.copyWithin(amount, 0, buffer.length - amount);
    buffer.set(temp, 0);
  }

  updateBuffers() {
    this.buffer_L.getChannelData(0).set(this.h_CIS.subarray(0, BUFFER_SIZE));
    this.buffer_L.getChannelData(1).set(this.h_CROSS.subarray(0, BUFFER_SIZE));
    this.buffer_R.getChannelData(0).set(this.h_CROSS.subarray(0, BUFFER_SIZE));
    this.buffer_R.getChannelData(1).set(this.h_CIS.subarray(0, BUFFER_SIZE));
    const current = this.currentConvolver;
    const other = (current + 1) % 2;
    this.convolver_L[other].buffer = this.buffer_L;
    this.convolver_R[other].buffer = this.buffer_R;

    const crossover = this.crossover.getNode();
    const splitter_L = this.splitter_L;
    const splitter_R = this.splitter_R;

    if (!this.switchTimeout) {
      crossover.connect(this.convolver_L[other], 1);
      crossover.connect(this.convolver_R[other], 1);
    }

    clearTimeout(this.switchTimeout);
    this.switchTimeout = setTimeout(() => {
      this.convolver_L[other].connect(splitter_L);
      this.convolver_R[other].connect(splitter_R);

      this.convolver_L[current].disconnect();
      this.convolver_R[current].disconnect();

      this.currentConvolver = other;
      this.switchTimeout = null;
    }, 100);
  }

  async init() {
    // Create splitter and merger nodes
    const ctx = this.audioContext;
    this.input = ctx.createGain();

    this.input.gain.value = 1.2;

    const merger = ctx.createChannelMerger(6);
    this.output = merger;

    this.crossover = new Crossover.CrossoverNode(ctx, {
      cutoffs: this.cutoffs,
      mappings: this.mappings,
      numOutputs: 2,
    });

    await this.crossover.init();

    this.input.connect(this.crossover.getNode());

    // create convolver nodes
    this.buffer_L = ctx.createBuffer(2, BUFFER_SIZE, ctx.sampleRate);
    this.buffer_R = ctx.createBuffer(2, BUFFER_SIZE, ctx.sampleRate);
    const buffer_BYPASS = ctx.createBuffer(2, BUFFER_SIZE, ctx.sampleRate);

    this.convolver_L = [ctx.createConvolver(), ctx.createConvolver()];
    this.convolver_R = [ctx.createConvolver(), ctx.createConvolver()];
    this.convolver_BYPASS = ctx.createConvolver();

    const convolvers = this.convolver_L.concat(this.convolver_R).concat([this.convolver_BYPASS]);
    convolvers.forEach((convolver) => {
      convolver.normalize = false;
      convolver.channelInterpretation = 'discrete';
    });

    const h_BYPASS = new Float32Array(BUFFER_SIZE);
    h_BYPASS[0] = 1;
    this.rotateBuffer(h_BYPASS, SHIFT_AMOUNT);
    buffer_BYPASS.getChannelData(0).set(h_BYPASS);
    buffer_BYPASS.getChannelData(1).set(h_BYPASS);
    this.convolver_BYPASS.buffer = buffer_BYPASS;

    const splitter_L = ctx.createChannelSplitter(2);
    const splitter_R = ctx.createChannelSplitter(2);

    this.crossover.getNode().connect(this.convolver_BYPASS, 0, 0);

    const bypassSplitter = ctx.createChannelSplitter(6);
    const bypassSplitter2 = ctx.createChannelSplitter(2);

    this.convolver_BYPASS.connect(bypassSplitter2);
    this.input.connect(bypassSplitter);

    splitter_L.connect(merger, 0, 0);
    splitter_L.connect(merger, 1, 0);
    splitter_R.connect(merger, 0, 1);
    splitter_R.connect(merger, 1, 1);
    bypassSplitter2.connect(merger, 0, 0);
    bypassSplitter2.connect(merger, 1, 1);

    for (let i = 2; i < 6; i++) {
      bypassSplitter.connect(merger, i, i);
    }

    this.splitter_L = splitter_L;
    this.splitter_R = splitter_R;

    this.updateBuffers();
  }

  destroy() {
    this.crossover.destroy();
    this.convolver_L.forEach((convolver) => {
      convolver.disconnect();
    });
    this.convolver_R.forEach((convolver) => {
      convolver.disconnect();
    });
    this.convolver_BYPASS.disconnect();
    this.input.disconnect();
    this.output.disconnect();
  }
}
