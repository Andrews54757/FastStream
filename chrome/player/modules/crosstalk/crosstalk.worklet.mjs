class FloatRingBuffer {
  constructor(size) {
    this.size = size;
    this.buffer = new Float32Array(size);
    this.index = 0;
  }

  resize(newSize) {
    if (newSize === this.size) {
      return;
    }
    this.buffer = this.getBuffer(-Math.min(this.size, newSize), newSize);
    this.size = newSize;
    this.index = 0;
  }

  getIndex(offset) {
    return (this.index + offset) % this.size;
  }

  getBuffer(offset, size) {
    let outputSize = size;
    if (size > this.size) {
      outputSize = size;
      size = this.size;
    }
    const start = this.getIndex(offset);
    const out = new Float32Array(outputSize);
    // copy the first part of the buffer
    const firstPart = Math.min(size, this.size - start);
    out.set(this.buffer.subarray(start, start + firstPart));
    // copy the rest from the beginning of the buffer
    if (firstPart < size) {
      out.set(this.buffer.subarray(0, size - firstPart), firstPart);
    }
    return out;
  }

  pushBuffer(offset, buffer) {
    if (buffer.length > this.size) {
      throw new Error('Buffer is larger than the ring buffer');
    }
    const start = this.getIndex(offset);
    const firstPart = Math.min(buffer.length, this.size - start);
    this.buffer.set(buffer.subarray(0, firstPart), start);
    if (firstPart < buffer.length) {
      this.buffer.set(buffer.subarray(firstPart), 0);
    }
    this.index = (start + buffer.length) % this.size;
  }
}


class LCC {
  constructor(options) {
    this.previousOutput = new FloatRingBuffer(0);
    this.configure(options);
  }

  configure({
    inputgain,
    decaygain,
    endgain,
    centergain,
    microdelay,
    samplerate,
  }) {
    const delay = microdelay * 1e-6 * samplerate;
    this.bufflen = Math.ceil(delay) * 2;
    this.delaymod = this.bufflen / 2 - delay;
    this.previousOutput.resize(this.bufflen);

    this.inputgain = inputgain;
    this.decaygain = decaygain;
    this.endgain = endgain;
    this.centergain = centergain;
  }

  lcc(input1, input2, output1, output2) {
    const len = input1.length;
    const bufflen = this.bufflen;
    const prevOutput = this.previousOutput.buffer;
    const index = this.previousOutput.index;
    const centerconstant = this.centergain * this.inputgain / 2.0;
    for (let i = 0; i < len; i++) {
      const in1 = input1[i] * this.inputgain;
      const in2 = input2[i] * this.inputgain;

      const prevIndex = (index + i * 2) % bufflen;

      const out1 = in1 - this.decaygain * prevOutput[prevIndex];
      const out2 = in2 - this.decaygain * prevOutput[prevIndex + 1];

      prevOutput[prevIndex] = out1;
      prevOutput[prevIndex + 1] = out2;

      const center = (in1 + in2) * centerconstant;
      output1[i] = this.endgain * (out1 + center);
      output2[i] = this.endgain * (out2 + center);
    }
    this.previousOutput.index = (index + len * 2) % bufflen;
    return true;
  }
}

registerProcessor('crosstalk-worklet', class CrosstalkWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    this._closed = false;

    options.processorOptions.samplerate = sampleRate;
    this.lcc = new LCC(options.processorOptions);

    this.port.onmessage = (event) => {
      if (event.data.type === 'close') {
        this.close();
      } else if (event.data.type === 'configure') {
        event.data.options.samplerate = sampleRate;
        this.lcc.configure(event.data.options);
      }
    };
  }

  process(inputs, outputs) {
    if (this._closed) {
      return false;
    }
    return this.lcc.lcc(inputs[0][0], inputs[0][1], outputs[0][0], outputs[0][1]);
  }

  close() {
    console.debug('closing crosstalk worklet');
    this._closed = true;
  }
});
