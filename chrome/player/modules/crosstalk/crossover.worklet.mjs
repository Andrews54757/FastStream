/* eslint-disable camelcase */
class LinkwitzRileyBandpassFilterNetwork {
  constructor(sampleRate, crossovers, mappings) {
    this.sampleRate = sampleRate;
    this.coefficients = [];
    this.states = [];
    this.mappings = mappings;

    const allpassConstants = [];
    for (let i = 0; i < crossovers.length; i++) {
      allpassConstants.push(this.calculateConstants(crossovers[i], 'allpass'));
    }

    for (let i = 0; i < crossovers.length; i++) {
      this.coefficients.push({
        low: this.calculateConstants(crossovers[i], 'lowpass'),
        high: this.calculateConstants(crossovers[i], 'highpass'),
        all: allpassConstants.slice(i+1),
      });
      this.states.push(new Float64Array(2*8 + 2 * (crossovers.length - 1)));
    }
  }

  calculateConstants(fc, type) {
    const wc = 2.0 * Math.PI * fc;
    const wc2 = wc * wc;
    const wc3 = wc2 * wc;
    const wc4 = wc2 * wc2;
    const k = wc / Math.tan(Math.PI * fc / this.sampleRate);
    const k2 = k * k;
    const k3 = k2 * k;
    const k4 = k2 * k2;
    const sqrt2 = Math.sqrt(2.0);
    const sq_tmp1 = sqrt2 * wc3 * k;
    const sq_tmp2 = sqrt2 * wc * k3;
    const a_tmp = 4.0 * wc2 * k2 + 2.0 * sq_tmp1 + k4 + 2.0 * sq_tmp2 + wc4;

    const b1 = (4.0 * (wc4 + sq_tmp1 - k4 - sq_tmp2)) / a_tmp;
    const b2 = (6.0 * wc4 - 8.0 * wc2 * k2 + 6.0 * k4) / a_tmp;
    const b3 = (4.0 * (wc4 - sq_tmp1 + sq_tmp2 - k4)) / a_tmp;
    const b4 = (k4 - 2.0 * sq_tmp1 + wc4 - 2.0 * sq_tmp2 + 4.0 * wc2 * k2) / a_tmp;

    let a0; let a1; let a2; let a3; let a4;

    if (type === 'lowpass') {
      a0 = wc4 / a_tmp;
      a1 = 4.0 * wc4 / a_tmp;
      a2 = 6.0 * wc4 / a_tmp;
      a3 = a1;
      a4 = a0;
      return new Float64Array([a0, a1, a2, a3, a4, b1, b2, b3, b4]);
    } else if (type === 'highpass') {
      a0 = k4 / a_tmp;
      a1 = -4.0 * k4 / a_tmp;
      a2 = 6.0 * k4 / a_tmp;
      a3 = a1;
      a4 = a0;
      return new Float64Array([a0, a1, a2, a3, a4, b1, b2, b3, b4]);
    } else if (type === 'allpass') {
      const theta = wc / sampleRate;
      const alpha = Math.sin(theta) / 2.0 * 1;
      const cs = Math.cos(theta);

      const b0 = 1.0 / (1.0 + alpha);
      const b1 = -2.0 * cs * b0;
      const b2 = (1.0 - alpha) * b0;
      a0 = b2;
      a1 = b1;
      a2 = (1.0 + alpha) * b0;

      return new Float64Array([a0, a1, a2, b0, b1, b2]);
    }
  }

  allpassFilter(x, c, s, i) {
    const y = c[0] * x + s[i];
    s[i] = c[1] * x - c[4] * y + s[i+1];
    s[i+1] = c[2] * x - c[5] * y;
    return y;
  }

  filter(x, c, s, i) {
    const y = c[0] * x + c[1] * s[i] + c[2] * s[i+1] + c[3] * s[i+2] + c[4] * s[i+3] - c[5] * s[i+4] - c[6] * s[i+5] - c[7] * s[i+6] - c[8] * s[i+7];
    s[i+7] = s[i+6];
    s[i+6] = s[i+5];
    s[i+5] = s[i+4];
    s[i+4] = y;
    s[i+3] = s[i+2];
    s[i+2] = s[i+1];
    s[i+1] = s[i];
    s[i] = x;
    return y;
  }

  process(input, outputs) {
    const temp = new Float64Array(input.length);
    temp.set(input);
    for (let i = 0; i < this.coefficients.length; i++) {
      const outputMapping = this.mappings[i];
      const cut = outputs[outputMapping];
      const c = this.coefficients[i];
      const s = this.states[i];
      for (let j = 0; j < temp.length; j++) {
        let y_l = this.filter(temp[j], c.low, s, 0);
        const y_h = this.filter(temp[j], c.high, s, 8);
        for (let k = 0; k < c.all.length; k++) {
          y_l = this.allpassFilter(y_l, c.all[k], s, 16 + 2 * k);
        }
        cut[j] += y_l;
        temp[j] = y_h;
      }
    }

    const lastOutput = this.mappings[this.coefficients.length];
    const cut = outputs[lastOutput];
    for (let i = 0; i < temp.length; i++) {
      cut[i] += temp[i];
    }
  }
}

registerProcessor('crossover-worklet', class CrossoverWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    this._closed = false;
    this.numberOfInputs = options.numberOfInputs;
    this.numberOfOutputs = options.numberOfOutputs;
    this.numChannels = options.numChannels;

    this.configure(options.processorOptions);

    this.port.onmessage = (event) => {
      if (event.data.type === 'close') {
        this.close();
      } else if (event.data.type === 'configure') {
        this.configure(event.data.options);
      }
    };
  }

  configure(options) {
    this.bandpassFilterNetworkL = new LinkwitzRileyBandpassFilterNetwork(sampleRate, options.cutoffs, options.mappings);
    this.bandpassFilterNetworkR = new LinkwitzRileyBandpassFilterNetwork(sampleRate, options.cutoffs, options.mappings);
  }

  process(inputs, outputs) {
    if (this._closed) {
      return false;
    }

    if (inputs.length === 0 || inputs[0].length < 2) {
      return true;
    }

    const groups = this.numberOfOutputs;
    const outputsL = new Array(groups);
    const outputsR = new Array(groups);
    const buflen = inputs[0][0].length;
    for (let i = 0; i < groups; i++) {
      outputsL[i] = outputs[i][0] || new Float32Array(buflen);
      outputsR[i] = outputs[i][1] || new Float32Array(buflen);
    }


    this.bandpassFilterNetworkL.process(inputs[0][0], outputsL);
    this.bandpassFilterNetworkR.process(inputs[0][1], outputsR);

    return true;
  }

  close() {
    console.debug('closing crossover worklet');
    this._closed = true;
  }
});
