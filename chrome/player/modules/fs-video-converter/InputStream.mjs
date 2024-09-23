import {TimeStampFixer} from './common/TimeStampFixer.mjs';
import {MultiDemuxer} from './demuxers/MultiDemuxer.mjs';

export class InputStream {
  constructor(id) {
    this.id = id;
  }

  setupDemuxer() {
    this.demuxer = new MultiDemuxer();
  }

  async appendBuffer(data, offset) {
    await this.demuxer.appendBuffer(data, offset);

    const samples = this.demuxer.getAllSamples();

    if (!this.tracksInitialized) {
      const tracks = this.demuxer.getAllTracks();
      if (tracks.size === 0) {
        return;
      }

      this.tracksInitialized = true;
      this.tracks = tracks;
      this.tracks.forEach((track) => {
        track.samples = [];
        track.timeFixer = new TimeStampFixer();
      });
    }

    // Fix timestamps
    this.tracks.forEach((track) => {
      const trackSamples = samples.get(track.id).samples;
      track.timeFixer.fix(trackSamples);
      track.samples.push(...trackSamples);
    });
  }

  hasInitializedTracks() {
    return this.tracksInitialized;
  }

  getTracks() {
    return this.tracks;
  }
}
