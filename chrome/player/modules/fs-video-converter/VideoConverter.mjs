import {EventEmitter} from '../eventemitter.mjs';
import {InputStream} from './InputStream.mjs';

export class VideoConverter extends EventEmitter {
  constructor() {
    super();
  }

  configure(inputConfig, outputConfig) {
    this.inputConfig = inputConfig;
    this.outputConfig = outputConfig;
    this.inputs = new Map();
    this.tracks = new Map();

    this.inputConfig.inputStreams.forEach((stream) => {
      const inputStream = new InputStream(stream.id);
      this.inputs.set(stream.id, inputStream);
    });
  }

  appendBuffer(streamId, data, offset) {
    const inputStream = this.inputs.get(streamId);
    if (!inputStream) {
      throw new Error(`Input stream not found: ${streamId}`);
    }

    inputStream.appendBuffer(data, offset);
  }
}
