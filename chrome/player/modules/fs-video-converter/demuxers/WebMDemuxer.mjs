import {JsWebm} from '../../reencoder/webm.mjs';
import {TrackTypes} from '../enums/TrackTypes.mjs';
import {AbstractDemuxer} from './AbstractDemuxer.mjs';

export default class WebMDemuxer extends AbstractDemuxer {
  constructor() {
    super();
    this.demuxer = new JsWebm();
    this.MAX_ITERATIONS = 10000;

    this.tracksByType = new Map();
  }

  // These are public methods that can be called from outside the class
  static test(buffer) {

  }

  appendBuffer(buffer, offset) {
    this.demuxer.queueData(buffer);

    let count = 0;
    while (this.demuxer.demux()) {
      count++;
      if (count > this.MAX_ITERATIONS) {
        throw new Error('too many iterations');
      }
    }

    if (!this.initializedTracks) {
      this.demuxer.validateMetadata();
      this.initializeTracks();
    }

    this.process();
  }

  getTracks() {
    return this.tracksByType;
  }

  // Private methods can be defined here
  process() {
    this.tracksByType.forEach((type, tracks) => {
      tracks.forEach((track) => {
        let samples;
        if (type === TrackTypes.VIDEO) {
          samples = this.demuxer.videoPackets;
        } else if (type === TrackTypes.AUDIO) {
          samples = this.demuxer.audioPackets;
        }

        for (let i = 0; i < samples.length; i++) {
          const sample = samples[i];
          const currentTimestamp = Math.floor(sample.timestamp * 1000000);

          const chunk = {
            type: sample.isKeyframe ? 'key' : 'delta',
            timestamp: currentTimestamp,
            duration: -1,
            data: sample.data,
            compositionTimeOffset: 0,
          };
          track.chunks.push(chunk);
        }

        samples.length = 0; // Clear samples after processing

        // Check monotonicity
        for (let i = 0; i < track.chunks.length - 1; i++) {
          const currentChunk = track.chunks[i];
          const nextChunk = track.chunks[i + 1];
          if (nextChunk.timestamp < currentChunk.timestamp) {
            console.warn('Timestamp is not monotonically increasing');
          }

          if (currentChunk.duration === -1) {
            currentChunk.duration = nextChunk.timestamp - currentChunk.timestamp;
          }
        }
      });
    });
  }

  initializeTracks() {
    // Initialize tracks from demuxer
    const videoTrack = this.demuxer.videoTrack;
    const audioTrack = this.demuxer.audioTrack;

    if (videoTrack) {
      this.tracksByType.set(TrackTypes.VIDEO, new Map([[0, videoTrack]]));
      videoTrack.chunks = [];
    }

    if (audioTrack) {
      this.tracksByType.set(TrackTypes.AUDIO, new Map([[1, audioTrack]]));
      audioTrack.chunks = [];
    }
  }
}
