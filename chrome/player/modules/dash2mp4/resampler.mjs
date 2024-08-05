/*
 * Copyright (c) 2019 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

/**
 * Butterworth LPF.
 */
export class ButterworthLPF {
  /**
     * @param {number} order The order of the filter.
     * @param {number} sampleRate The sample rate.
     * @param {number} cutOff The cut off frequency.
     */
  constructor(order, sampleRate, cutOff) {
    const filters = [];
    for (let i = 0; i < order; i++) {
      filters.push(this.getCoeffs_({
        Fs: sampleRate,
        Fc: cutOff,
        Q: 0.5 / (Math.sin((Math.PI / (order * 2)) * (i + 0.5))),
      }));
    }
    this.stages = [];
    for (let i = 0; i < filters.length; i++) {
      this.stages[i] = {
        b0: filters[i].b[0],
        b1: filters[i].b[1],
        b2: filters[i].b[2],
        a1: filters[i].a[0],
        a2: filters[i].a[1],
        k: filters[i].k,
        z: [0, 0],
      };
    }
  }

  /**
     * @param {number} sample A sample of a sequence.
     * @return {number}
     */
  filter(sample) {
    let out = sample;
    for (let i = 0, len = this.stages.length; i < len; i++) {
      out = this.runStage_(i, out);
    }
    return out;
  }

  getCoeffs_(params) {
    const coeffs = {};
    coeffs.z = [0, 0];
    coeffs.a = [];
    coeffs.b = [];
    const p = this.preCalc_(params, coeffs);
    coeffs.k = 1;
    coeffs.b.push((1 - p.cw) / (2 * p.a0));
    coeffs.b.push(2 * coeffs.b[0]);
    coeffs.b.push(coeffs.b[0]);
    return coeffs;
  }

  preCalc_(params, coeffs) {
    const pre = {};
    const w = 2 * Math.PI * params.Fc / params.Fs;
    pre.alpha = Math.sin(w) / (2 * params.Q);
    pre.cw = Math.cos(w);
    pre.a0 = 1 + pre.alpha;
    coeffs.a0 = pre.a0;
    coeffs.a.push((-2 * pre.cw) / pre.a0);
    coeffs.k = 1;
    coeffs.a.push((1 - pre.alpha) / pre.a0);
    return pre;
  }

  runStage_(i, input) {
    const temp =
      input * this.stages[i].k - this.stages[i].a1 * this.stages[i].z[0] -
      this.stages[i].a2 * this.stages[i].z[1];
    const out =
      this.stages[i].b0 * temp + this.stages[i].b1 * this.stages[i].z[0] +
      this.stages[i].b2 * this.stages[i].z[1];
    this.stages[i].z[1] = this.stages[i].z[0];
    this.stages[i].z[0] = temp;
    return out;
  }

  /**
     * Reset the filter.
     */
  reset() {
    for (let i = 0; i < this.stages.length; i++) {
      this.stages[i].z = [0, 0];
    }
  }
}
/**
 * A FIR low pass filter.
 */
export class FIRLPF {
  /**
     * @param {number} order The order of the filter.
     * @param {number} sampleRate The sample rate.
     * @param {number} cutOff The cut off frequency.
     */
  constructor(order, sampleRate, cutOff) {
    const omega = 2 * Math.PI * cutOff / sampleRate;
    let dc = 0;
    this.filters = [];
    for (let i = 0; i <= order; i++) {
      if (i - order / 2 === 0) {
        this.filters[i] = omega;
      } else {
        this.filters[i] = Math.sin(omega * (i - order / 2)) / (i - order / 2);
        // Hamming window
        this.filters[i] *= (0.54 - 0.46 * Math.cos(2 * Math.PI * i / order));
      }
      dc = dc + this.filters[i];
    }
    // normalize
    for (let i = 0; i <= order; i++) {
      this.filters[i] /= dc;
    }
    this.z = this.initZ_();
  }

  /**
     * @param {number} sample A sample of a sequence.
     * @return {number}
     */
  filter(sample) {
    this.z.buf[this.z.pointer] = sample;
    let out = 0;
    for (let i = 0, len = this.z.buf.length; i < len; i++) {
      out += (
        this.filters[i] * this.z.buf[(this.z.pointer + i) % this.z.buf.length]);
    }
    this.z.pointer = (this.z.pointer + 1) % (this.z.buf.length);
    return out;
  }

  /**
     * Reset the filter.
     */
  reset() {
    this.z = this.initZ_();
  }

  /**
     * Return the default value for z.
     * @private
     * @return {Object}
     */
  initZ_() {
    const r = [];
    for (let i = 0; i < this.filters.length - 1; i++) {
      r.push(0);
    }
    return {
      buf: r,
      pointer: 0,
    };
  }
}

/**
 * The default orders for the LPF types.
 * @private
 */
const DEFAULT_LPF_ORDER = {
  'IIR': 16,
  'FIR': 71,
};

/**
 * The classes to use with each LPF type.
 * @private
 */
const DEFAULT_LPF = {
  'IIR': ButterworthLPF,
  'FIR': FIRLPF,
};

export class StatefulResampler {
  constructor(oldSampleRate, newSampleRate, details = {}) {
    this.oldSampleRate = oldSampleRate;
    this.newSampleRate = newSampleRate;
    this.scaleFactor = oldSampleRate / newSampleRate;
    this.kernelSizeHalf = details.sincFilterSize || 6;
    this.kernel = this.buildKernel(this.kernelSizeHalf);

    details.LPFType = details.LPFType || 'IIR';
    const LPF = DEFAULT_LPF[details.LPFType];
    // Upsampling
    if (newSampleRate > oldSampleRate) {
      this.filter = new LPF(
          details.LPFOrder || DEFAULT_LPF_ORDER[details.LPFType],
          newSampleRate,
          (oldSampleRate / 2));
    } else {
      this.filter = new LPF(
          details.LPFOrder || DEFAULT_LPF_ORDER[details.LPFType],
          oldSampleRate,
          newSampleRate / 2);
    }

    console.log('StatefulResampler', this.oldSampleRate, this.newSampleRate, this.scaleFactor, this.kernelSizeHalf, this.kernel, this.filter);
  }

  buildKernel(kernelSizeHalf) {
    const start = -kernelSizeHalf;
    const end = kernelSizeHalf;
    const len = end - start + 1;
    const kernel = new Float64Array(len);
    for (let i = start; i <= end; i++) {
      kernel[i - start] = this.kernelAt(i);
    }
    return kernel;
  }

  kernelAt(x) {
    if (x === 0) {
      return 1;
    }
    const a = 2;
    const PI = Math.PI;
    return a * Math.sin(PI * x) * Math.cos(PI * x / a) / (PI * PI * x * x);
  }

  getClippedInput(t, samples) {
    const prev = samples[0];
    const current = samples[1];
    const next = samples[2];
    if (prev && t < 0) {
      return prev[prev.length - 1 + t] || 0;
    } else if (next && t >= current.length) {
      return next[t - current.length] || 0;
    }
    return current[t] || 0;
  }

  interpolate(outCenter, samples) {
    const oldCenter = Math.floor(this.scaleFactor * outCenter);
    const windowStart = oldCenter - this.kernelSizeHalf;
    const windowEnd = oldCenter + this.kernelSizeHalf;
    let sum = 0;
    for (let indexOld = windowStart; indexOld <= windowEnd; indexOld++) {
      sum += this.kernel[indexOld - windowStart] * this.getClippedInput(indexOld, samples);
    }
    return sum;
  }

  resample(prevBuffer, currentBuffer, nextBuffer, remainderObj) {
    if (this.oldSampleRate === this.newSampleRate) {
      return currentBuffer;
    }

    const samples = [prevBuffer, currentBuffer, nextBuffer];
    const newSampleLenFractional = currentBuffer.length / this.scaleFactor + remainderObj.remainder;
    const newSampleLen = Math.floor(newSampleLenFractional);
    remainderObj.remainder = newSampleLenFractional - newSampleLen;

    if (this.oldSampleRate < this.newSampleRate) { // Upsampling
      const tailStart = prevBuffer ? (prevBuffer.length / 2) : 0;
      const tailEnd = nextBuffer ? (nextBuffer.length / 2) : 0;
      const newBuffer = new Float64Array(newSampleLen + tailStart + tailEnd);

      for (let i = 0; i < newBuffer.length; i++) {
        newBuffer[i] = this.interpolate(i - tailStart, samples);
      }

      // // Run filter
      // this.filter.reset();
      // for (let i = 0; i < newBuffer.length; i++) {
      //   newBuffer[i] = this.filter.filter(newBuffer[i]);
      // }

      // // Reverse filter
      // this.filter.reset();
      // for (let i = newBuffer.length - 1; i >= 0; i--) {
      //   newBuffer[i] = this.filter.filter(newBuffer[i]);
      // }

      return newBuffer.slice(tailStart, newBuffer.length - tailEnd);
    } else {
      // // Run filter
      // this.filter.reset();
      // for (let i = 0; i < samples.length; i++) {
      //   if (!samples[i]) {
      //     continue;
      //   }
      //   for (let j = 0; j < samples[i].length; j++) {
      //     samples[i][j] = this.filter.filter(samples[i][j]);
      //   }
      // }

      // // Reverse filter
      // this.filter.reset();
      // for (let i = samples.length - 1; i >= 0; i--) {
      //   if (!samples[i]) {
      //     continue;
      //   }
      //   for (let j = samples[i].length - 1; j >= 0; j--) {
      //     samples[i][j] = this.filter.filter(samples[i][j]);
      //   }
      // }

      const newBuffer = new Float64Array(newSampleLen);
      for (let i = 0; i < newBuffer.length; i++) {
        newBuffer[i] = this.interpolate(i, samples);
      }
      return newBuffer;
    }
  }
}
