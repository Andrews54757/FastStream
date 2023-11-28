const Message = {
  AudioFrame: 1,
};
class Resampler {
  constructor(options) {
    this.options = options;
    this.process = (audioFrame) => {
      const outputFrames = [];
      for (const sample of audioFrame) {
        this.inputBuffer.push(sample);
      }
      while ((this.inputBuffer.length * this.options.targetSampleRate) /
                this.options.nativeSampleRate >
                this.options.targetFrameSize) {
        const outputFrame = new Float32Array(this.options.targetFrameSize);
        let outputIndex = 0;
        let inputIndex = 0;
        while (outputIndex < this.options.targetFrameSize) {
          let sum = 0;
          let num = 0;
          while (inputIndex <
                        Math.min(this.inputBuffer.length, ((outputIndex + 1) * this.options.nativeSampleRate) /
                            this.options.targetSampleRate)) {
            sum += this.inputBuffer[inputIndex];
            num++;
            inputIndex++;
          }
          outputFrame[outputIndex] = sum / num;
          outputIndex++;
        }
        this.inputBuffer = this.inputBuffer.slice(inputIndex);
        outputFrames.push(outputFrame);
      }
      return outputFrames;
    };
    if (options.nativeSampleRate < 16000) {
      console.error('nativeSampleRate is too low. Should have 16000 = targetSampleRate <= nativeSampleRate');
    }
    this.inputBuffer = [];
  }
}
class Processor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this._initialized = false;
    this._closed = false;
    this.init = async () => {
      console.debug('initializing worklet');
      this.resampler = new Resampler({
        nativeSampleRate: sampleRate,
        targetSampleRate: 16000,
        targetFrameSize: this.options.frameSamples,
      });
      this._initialized = true;
      console.debug('initialized worklet');
    };
    this.port.onmessage = (event) => {
      if (event.data === 'close') {
        this.close();
      }
    };
    this.options = options.processorOptions;
    this.init();
  }
  process(inputs, outputs, parameters) {
    if (this._closed) {
      return false;
    }
    // @ts-ignore
    const arr = inputs[0][0];
    if (this._initialized && arr instanceof Float32Array) {
      const frames = this.resampler.process(arr);
      for (const frame of frames) {
        this.port.postMessage({message: Message.AudioFrame, data: frame.buffer}, [frame.buffer]);
      }
    }
    return true;
  }
  close() {
    console.debug('closing worklet');
    this._closed = true;
  }
}
registerProcessor('vad-helper-worklet', Processor);
