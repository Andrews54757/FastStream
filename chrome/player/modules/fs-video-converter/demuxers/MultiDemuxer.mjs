import {AbstractDemuxer} from './AbstractDemuxer.mjs';

const DemuxerURLS = {
  MP4: import.meta.resolve('./MP4Demuxer.mjs'),
  AAC: import.meta.resolve('./AACDemuxer.mjs'),
  TS: import.meta.resolve('./TSDemuxer.mjs'),
  WEBM: import.meta.resolve('./WebMDemuxer.mjs'),
  MP3: import.meta.resolve('./MP3Demuxer.mjs'),
};

export class MultiDemuxer extends AbstractDemuxer {
  constructor() {
    super();
  }

  static async loadDemuxer(type) {
    if (Object.hasOwn(DemuxerURLS, type)) {
      return await import(DemuxerURLS[type]);
    }
    throw new Error(`Unsupported demuxer type: ${type}`);
  }

  async setupDemuxer(type) {
    if (this.demuxer) {
      await this.demuxer.destroy();
      this.demuxer = null;
    }
    const Demuxer = await MultiDemuxer.loadDemuxer(type);
    this.demuxer = new Demuxer();
  }

  async setupDemuxerFromData(data) {
    const demuxerTypes = Object.keys(DemuxerURLS);
    for (const type of demuxerTypes) {
      const demuxer = await MultiDemuxer.loadDemuxer(type);
      if (await demuxer.test(data)) {
        await this.setupDemuxer(type);
        return;
      }
    }

    throw new Error('Unsupported data format');
  }

  async appendBuffer(data, offset) {
    if (!this.demuxer) {
      await this.setupDemuxerFromData(data);
    }
    await this.demuxer.appendBuffer(data, offset);
  }

  async process() {
    if (!this.demuxer) {
      throw new Error('Demuxer not initialized');
    }
    await this.demuxer.process();
  }

  async destroy() {
    if (this.demuxer) {
      await this.demuxer.destroy();
      this.demuxer = null;
    }
  }
}
