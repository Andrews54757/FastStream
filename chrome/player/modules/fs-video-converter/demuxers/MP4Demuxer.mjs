import {MP4Box} from '../../mp4box.mjs';
import {TrackTypes} from '../enums/TrackTypes.mjs';
import {AbstractDemuxer} from './AbstractDemuxer.mjs';

export default class MP4Demuxer extends AbstractDemuxer {
  constructor() {
    super();
    this.tracksByType = new Map();
    this.nextPos = 0;
  }

  // These are public methods that can be called from outside the class
  static test(buffer) {

  }

  appendBuffer(buffer, offset) {
    if (!this.file) {
      this.file = this.createFile();
    }

    if (offset === undefined) {
      offset = this.nextPos;
    }

    buffer.fileStart = offset;
    this.nextPos += buffer.byteLength;

    this.file.appendBuffer(buffer);
    this.file.flush();

    if (!this.initializedTracks && this.file.moov) {
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
        const trak = this.file.getTrackById(track.id);
        const samples = trak.samples_stored;

        for (let i = 0; i < samples.length; i++) {
          const sample = samples[i];

          const timescale = sample.timescale;
          const currentTimestamp = Math.floor(sample.cts * 1000000 / timescale);
          const compositionTimeOffset = Math.floor((sample.cts - nextSample.dts) * 1000000 / timescale);

          const chunk = {
            type: sample.is_sync ? 'key' : 'delta',
            timestamp: currentTimestamp,
            duration: -1,
            data: sample.data,
            compositionTimeOffset: compositionTimeOffset,
          };
          track.chunks.push(chunk);
        }

        samples.forEach((sample) => {
          this.file.releaseSample(trak, sample.number);
        });
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

  createFile() {
    const file = MP4Box.createFile(false);
    file.onError = (e) => {
      console.log('mp4box error', e);
    };
    return file;
  }

  initializeTracks() {
    if (this.initializedTracks) {
      throw new Error('Tracks already initialized');
    }

    this.initializedTracks = true;

    this.info = this.file.getInfo();

    const videoTracks = new Map();
    this.info.videoTracks.forEach((track) => {
      track.chunks = [];
      videoTracks.set(track.id, track);
    });
    if (videoTracks.size > 0) {
      this.tracksByType.set(TrackTypes.VIDEO, videoTracks);
    }

    const audioTracks = new Map();
    this.info.audioTracks.forEach((track) => {
      track.chunks = [];
      audioTracks.set(track.id, track);
    });
    if (audioTracks.size > 0) {
      this.tracksByType.set(TrackTypes.AUDIO, audioTracks);
    }

    videoTracks.forEach((track) => {
      this.file.setExtractionOptions(track.id, track, {nbSamples: 1});
    });

    audioTracks.forEach((track) => {
      this.file.setExtractionOptions(track.id, track, {nbSamples: 1});
    });

    this.file.onSamples = (id, user, samples) => {

    };

    this.file.start();
  }

  getVideoDecoderConfig() {
    const videoTrack = this.videoTrack;
    if (!videoTrack) {
      return null;
    }
    return {
      codec: videoTrack.codec,
      codedWidth: videoTrack.video.width,
      codedHeight: videoTrack.video.height,
      displayAspectWidth: videoTrack.track_width,
      displayAspectHeight: videoTrack.track_height,
    };
  }

  getAudioDecoderConfig() {
    const audioTrack = this.audioTrack;
    if (!audioTrack) {
      return null;
    }
    return {
      codec: audioTrack.codec,
      description: undefined,
      sampleRate: audioTrack.audio.sample_rate,
      numberOfChannels: audioTrack.audio.channel_count,
    };
  }
}
