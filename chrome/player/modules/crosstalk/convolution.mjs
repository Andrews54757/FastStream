import {FFT} from './fft.mjs';

const IMPULSE_BUFFER_SIZE = 512;
const FREQUENCY_BUFFER_SIZE = IMPULSE_BUFFER_SIZE * 4;
const SHIFT_AMOUNT = 128;

/* eslint-disable camelcase */
export class ConvolutionXTC {
  constructor(audioContext, options) {
    this.cachedOptions = {};
    this.currentConvolver = 0;
    this.audioContext = audioContext;
    this.fft = new FFT(FREQUENCY_BUFFER_SIZE);
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

  configure(options) {
    const g = options.g;
    const tc = options.tc;
    const y = options.y;

    if (this.cachedOptions.g === g && this.cachedOptions.tc === tc && this.cachedOptions.y === y) {
      return;
    }

    this.cachedOptions = {
      g, tc, y,
    };

    const gg = g * g;
    const n = FREQUENCY_BUFFER_SIZE;
    const H_CIS = new Float32Array(n * 2);
    const H_CROSS = new Float32Array(n * 2);

    const B_P = 0.0005;
    for (let k = 0; k < n; k++) {
      const omegatc = 2 * Math.PI * k / n * tc;
      const z = [Math.cos(2 * omegatc), Math.sin(2 * omegatc)];
      const cos = Math.cos(omegatc);
      const cm_I = Math.sqrt(gg - 2*g*cos + 1);
      const cm_II = Math.sqrt(gg + 2*g*cos + 1);
      const sp = Math.max(1/cm_I, 1/cm_II);

      let H;
      if (sp < y) {
        H = this.calculateH(g, z, B_P);
      } else if (cm_I < cm_II) {
        const B_I = -gg + 2*g*cos + cm_I / y - 1;
        H = this.calculateH(g, z, B_I);
      } else {
        const B_II = -gg - 2*g*cos + cm_II / y - 1;
        H = this.calculateH(g, z, B_II);
      }

      H_CIS[k * 2] = H[0];
      H_CIS[k * 2 + 1] = H[1];
      H_CROSS[k * 2] = H[2];
      H_CROSS[k * 2 + 1] = H[3];
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

  updateBuffers() {
    this.buffer_L.copyToChannel(this.h_CIS.subarray(0, IMPULSE_BUFFER_SIZE), 0);
    this.buffer_L.copyToChannel(this.h_CROSS.subarray(0, IMPULSE_BUFFER_SIZE), 1);
    this.buffer_R.copyToChannel(this.h_CROSS.subarray(0, IMPULSE_BUFFER_SIZE), 0);
    this.buffer_R.copyToChannel(this.h_CIS.subarray(0, IMPULSE_BUFFER_SIZE), 1);
    const current = this.currentConvolver;
    const other = (current + 1) % 2;
    this.convolver_L[other].buffer = this.buffer_L;
    this.convolver_R[other].buffer = this.buffer_R;

    const splitter_L = this.splitter_L;
    const splitter_R = this.splitter_R;

    if (!this.switchTimeout) {
      this.input.connect(this.convolver_L[other], 1);
      this.input.connect(this.convolver_R[other], 1);
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

  async init(input) {
    // Create splitter and merger nodes
    const ctx = this.audioContext;
    this.input = input;

    const merger = ctx.createChannelMerger(2);
    this.output = merger;

    // create convolver nodes
    this.buffer_L = ctx.createBuffer(2, IMPULSE_BUFFER_SIZE, ctx.sampleRate);
    this.buffer_R = ctx.createBuffer(2, IMPULSE_BUFFER_SIZE, ctx.sampleRate);
    const buffer_BYPASS = ctx.createBuffer(2, IMPULSE_BUFFER_SIZE, ctx.sampleRate);

    this.convolver_L = [ctx.createConvolver(), ctx.createConvolver()];
    this.convolver_R = [ctx.createConvolver(), ctx.createConvolver()];
    this.convolver_BYPASS = ctx.createConvolver();

    const convolvers = this.convolver_L.concat(this.convolver_R).concat([this.convolver_BYPASS]);
    convolvers.forEach((convolver) => {
      convolver.normalize = false;
    });

    const h_BYPASS = new Float32Array(IMPULSE_BUFFER_SIZE);
    h_BYPASS[0] = 1;
    this.rotateBuffer(h_BYPASS, SHIFT_AMOUNT);
    buffer_BYPASS.getChannelData(0).set(h_BYPASS);
    buffer_BYPASS.getChannelData(1).set(h_BYPASS);
    this.convolver_BYPASS.buffer = buffer_BYPASS;

    const splitter_L = ctx.createChannelSplitter(2);
    const splitter_R = ctx.createChannelSplitter(2);

    this.input.connect(this.convolver_BYPASS, 0);
    const bypassSplitter = ctx.createChannelSplitter(2);

    this.convolver_BYPASS.connect(bypassSplitter);

    splitter_L.connect(merger, 0, 0);
    splitter_L.connect(merger, 1, 0);
    splitter_R.connect(merger, 0, 1);
    splitter_R.connect(merger, 1, 1);
    bypassSplitter.connect(merger, 0, 0);
    bypassSplitter.connect(merger, 1, 1);

    this.splitter_L = splitter_L;
    this.splitter_R = splitter_R;

    this.updateBuffers();
  }

  getOutputNode() {
    return this.output;
  }

  destroy() {
    clearTimeout(this.switchTimeout);
    this.switchTimeout = null;
    this.input.disconnect();
    this.convolver_L.forEach((convolver) => {
      convolver.disconnect();
    });
    this.convolver_R.forEach((convolver) => {
      convolver.disconnect();
    });
    this.convolver_BYPASS.disconnect();
    this.splitter_L.disconnect();
    this.splitter_R.disconnect();
    this.output.disconnect();
  }
}
