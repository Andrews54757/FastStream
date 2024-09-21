import {EventEmitter} from '../../eventemitter.mjs';

export class AbstractDemuxer extends EventEmitter {
  constructor() {
    super();
  }

  static test(data) {
    throw new Error('Method not implemented.');
  }

  appendBuffer(data, offset) {
    throw new Error('Method not implemented.');
  }

  getAllSamples() {
    throw new Error('Method not implemented.');
  }

  getAllTracks() {
    throw new Error('Method not implemented.');
  }
}
