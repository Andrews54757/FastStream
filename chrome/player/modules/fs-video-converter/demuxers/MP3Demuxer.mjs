import {MP3Demuxer as HLSMP3Demuxer} from '../../hls.mjs';
import {AbstractDemuxer} from './AbstractDemuxer.mjs';

export default class MP3Demuxer extends AbstractDemuxer {
  constructor() {
    super();
  }

  // These are public methods that can be called from outside the class
  static test(buffer) {
    const data = new Uint8Array(buffer);
    return HLSMP3Demuxer.probe(data);
  }

  appendBuffer(buffer, offset) {
    if (!this.demuxer) {
      this.demuxer = new HLSMP3Demuxer();
      const audioCodec = null;
      const videoCodec = null;
      const trackDuration = null;
      this.demuxer.resetInitSegment(null, audioCodec, videoCodec, trackDuration);
    }

    const demuxed = this.demuxer.demux(new Uint8Array(buffer), null, false, true);
    if (!this.initializedTracks) {
      this.initializeTracks(demuxed);
    }

    this.process(demuxed);
  }

  getVideoInfo() {
    return null;
  }

  getAudioInfo() {
    const audioTrack = this.audioTrack;
    if (!audioTrack) {
      return null;
    }
    return new AudioTrackInfo({
      codec: audioTrack.parsedCodec || audioTrack.manifestCodec || audioTrack.codec,
      sampleRate: audioTrack.samplerate,
      numberOfChannels: audioTrack.channelCount,
    });
  }

  // Private methods can be defined here
  initializeTracks(demuxed) {
    this.initializedTracks = true;

    if (demuxed.audioTrack && demuxed.audioTrack.pid > -1) {
      demuxed.audioTrack.chunks = [];
      this.audioTrack = demuxed.audioTrack;
    }
  }

  process(demuxed) {
    const audioTrack = demuxed.audioTrack;
    if (audioTrack.pid > -1) {
      const samples = audioTrack.samples;
      const track = this.audioTrack;

      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        track.chunks.push(new AudioSample({
          pts: sample.pts,
          timescale: track.inputTimeScale,
          data: sample.unit,
        }));
      }

      samples.length = 0; // Clear samples after processing
    }
  }
}
