class RACEXTC {
  constructor(options) {
    this.configure(options);
  }

  configure({
    dg,
    cg,
    tc,
  }) {
    const delay = tc;
    this.bufflen = Math.ceil(delay) * 2;
    this.delaymod = this.bufflen / 2 - delay;
    if (!this.previousOutputBuffer || this.previousOutputBuffer.length !== this.bufflen) {
      this.previousOutputBuffer = new Float32Array(this.bufflen);
      this.previousOutputIndex = 0;
    }

    this.decaygain = dg;
    this.centergain = cg;
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

      let prevNext = prevIndex + 2;
      if (prevNext >= bufflen) {
        prevNext = 0;
      }

      const interp1 = prevOutput[prevIndex] * delaymodinv + prevOutput[prevNext] * this.delaymod;
      const interp2 = prevOutput[prevIndex + 1] * delaymodinv + prevOutput[prevNext + 1] * this.delaymod;
      const out1 = in1 - this.decaygain * interp2;
      const out2 = in2 - this.decaygain * interp1;

      prevOutput[prevIndex] = out1;
      prevOutput[prevIndex + 1] = out2;

      const center = (in1 + in2) * centerconstant;
      output1[i] = (out1 + center + diff1);
      output2[i] = (out2 + center + diff2);

      prevIndex = prevNext;
    }
    this.previousOutputIndex = prevIndex;
    return true;
  }
}

registerProcessor('racextc-worklet', class CrosstalkWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    this._closed = false;

    options.processorOptions.samplerate = sampleRate;
    this.xtc = new RACEXTC(options.processorOptions);

    this.port.onmessage = (event) => {
      if (event.data.type === 'close') {
        this.close();
      } else if (event.data.type === 'configure') {
        event.data.options.samplerate = sampleRate;
        this.xtc.configure(event.data.options);
      }
    };
  }

  process(inputs, outputs) {
    if (this._closed) {
      return false;
    }
    return this.xtc.process(inputs[0][0], inputs[0][1], outputs[0][0], outputs[0][1]);
  }

  close() {
    console.debug('closing crosstalk worklet');
    this._closed = true;
  }
});
