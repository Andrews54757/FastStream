class BandpassFilter {
  constructor(highpassCF, lowpassCF, samplerate) {
    const DT = 1.0 / samplerate;
    const RCH = 1.0 / (2 * Math.PI * highpassCF);
    const RCL = 1.0 / (2 * Math.PI * lowpassCF);
    this.lastXH = 0;
    this.lastYH = 0;
    this.lastYL = 0;
    this.tch = RCH / (RCH + DT);
    this.tcl = RCL / (RCL + DT);
  }
  process(nextX) {
    this.lastYH = this.tch * (this.lastYH + nextX - this.lastXH);
    this.lastXH = nextX;
    this.lastYL = this.tcl * this.lastYH + (1 - this.tcl) * this.lastYL;
    return this.lastYL;
  }
}

class XCC {
  constructor(options) {
    this.configure(options);
  }

  configure({
    decaygain,
    centergain,
    microdelay,
    samplerate,
    highpass,
    lowpass,
  }) {
    const delay = microdelay * 1e-6 * samplerate;
    this.bufflen = Math.ceil(delay) * 2;
    this.delaymod = this.bufflen / 2 - delay;
    if (!this.previousOutputBuffer || this.previousOutputBuffer.length !== this.bufflen) {
      this.previousOutputBuffer = new Float32Array(this.bufflen);
      this.previousOutputIndex = 0;
    }

    this.decaygain = decaygain;
    this.centergain = centergain;

    this.bandpass1 = new BandpassFilter(highpass, lowpass, samplerate);
    this.bandpass2 = new BandpassFilter(highpass, lowpass, samplerate);
  }

  process(input1, input2, output1, output2) {
    const len = input1.length;
    const bufflen = this.bufflen;
    const prevOutput = this.previousOutputBuffer;
    let prevIndex = this.previousOutputIndex;
    const centerconstant = this.centergain / 2.0;
    const delaymodinv = 1.0 - this.delaymod;
    for (let i = 0; i < len; i++) {
      const in1 = input1[i];
      const in2 = input2[i];

      const in1filtered = this.bandpass1.process(in1);
      const in2filtered = this.bandpass2.process(in2);

      const diff1 = in1 - in1filtered;
      const diff2 = in2 - in2filtered;

      let prevNext = prevIndex + 2;
      if (prevNext >= bufflen) {
        prevNext = 0;
      }

      const interp1 = prevOutput[prevIndex] * delaymodinv + prevOutput[prevNext] * this.delaymod;
      const interp2 = prevOutput[prevIndex + 1] * delaymodinv + prevOutput[prevNext + 1] * this.delaymod;
      const out1 = in1filtered - this.decaygain * interp2;
      const out2 = in2filtered - this.decaygain * interp1;

      prevOutput[prevIndex] = out1;
      prevOutput[prevIndex + 1] = out2;

      const center = (in1filtered + in2filtered) * centerconstant;
      output1[i] = (out1 + center + diff1);
      output2[i] = (out2 + center + diff2);

      prevIndex = prevNext;
    }
    this.previousOutputIndex = prevIndex;
    return true;
  }
}

registerProcessor('crosstalk-worklet', class CrosstalkWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    this._closed = false;

    options.processorOptions.samplerate = sampleRate;
    this.xcc = new XCC(options.processorOptions);

    this.port.onmessage = (event) => {
      if (event.data.type === 'close') {
        this.close();
      } else if (event.data.type === 'configure') {
        event.data.options.samplerate = sampleRate;
        this.xcc.configure(event.data.options);
      }
    };
  }

  process(inputs, outputs) {
    if (this._closed) {
      return false;
    }
    return this.xcc.process(inputs[0][0], inputs[0][1], outputs[0][0], outputs[0][1]);
  }

  close() {
    console.debug('closing crosstalk worklet');
    this._closed = true;
  }
});
