registerProcessor('channelcounter-worklet', class ChannelCounter extends AudioWorkletProcessor {
  constructor() {
    super();
    this.inputChannelCount = 0;
    this._closed = false;

    this.port.onmessage = (event) => {
      if (event.data.type === 'close') {
        this.close();
      } else if (event.data.type === 'configure') {
        this.configure(event.data.options);
      }
    };
  }
  process(input, output, parameters) {
    if (this._closed) {
      return false;
    }
    if (input && input[0].length != this.inputChannelCount) {
      this.inputChannelCount = input[0].length;
      this.port.postMessage(input[0].length);
    }
    return true;
  }

  close() {
    console.debug('closing counter worklet');
    this._closed = true;
  }
});
