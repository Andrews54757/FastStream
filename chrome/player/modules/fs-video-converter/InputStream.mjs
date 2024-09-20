import {MultiDemuxer} from './demuxers/MultiDemuxer.mjs';

export class InputStream {
  constructor(id) {
    this.id = id;
  }

  setupDemuxer() {
    this.demuxer = new MultiDemuxer();
  }

  appendBuffer(data, offset) {
    this.demuxer.appendBuffer(data, offset);
  }
}
