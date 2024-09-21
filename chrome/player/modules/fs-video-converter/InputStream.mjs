import {TimeStampFixer} from './common/TimeStampFixer.mjs';
import {MultiDemuxer} from './demuxers/MultiDemuxer.mjs';
import {TrackTypes} from './enums/TrackTypes.mjs';

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

    if (!this.tracksChosen) {
      this.tracksChosen = true;
      this.tracks = this.demuxer.getAllTracks();
      this.tracks.forEach((track) => {
        if (!this.videoTrack && track.type === TrackTypes.VIDEO) {
          this.videoTrack = track;
        }

        if (!this.audioTrack && track.type === TrackTypes.AUDIO) {
          this.audioTrack = track;
        }
      });

      if (this.videoTrack) {
        this.videoTrack.timeFixer = new TimeStampFixer();
      }

      if (this.audioTrack) {
        this.audioTrack.timeFixer = new TimeStampFixer();
      }
    }

    // Fix timestamps
    let videoSamples;
    let audioSamples;
    if (this.videoTrack) {
      videoSamples = samples.get(this.videoTrack.id).samples;
      this.videoTrack.timeFixer.fix(videoSamples);
    }

    if (this.audioTrack) {
      audioSamples = samples.get(this.audioTrack.id).samples;
      this.audioTrack.timeFixer.fix(audioSamples);
    }
  }
}
