import {EventEmitter} from '../eventemitter.mjs';
import {MultiChannelSampleAdjuster} from './common/MultiChannelSampleAdjuster.mjs';
import {TrackTypes} from './enums/TrackTypes.mjs';
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
      inputStream.setupDemuxer();
      this.inputs.set(stream.id, inputStream);
    });
  }

  async appendBuffer(streamId, data, offset) {
    const inputStream = this.inputs.get(streamId);
    if (!inputStream) {
      throw new Error(`Input stream not found: ${streamId}`);
    }

    await inputStream.appendBuffer(data, offset);

    this.processSamples();
  }

  chooseTracks() {
    // Check if all input streams have initialized tracks
    for (const inputStream of this.inputs.values()) {
      if (!inputStream.hasInitializedTracks()) {
        return;
      }
    }

    this.hasChosenTracks = true;
    this.audio = null;
    this.video = null;

    for (const inputStream of this.inputs.values()) {
      const tracks = inputStream.getChosenTracks();
      tracks.forEach((track) => {
        if (!this.audio && track.type === TrackTypes.AUDIO) {
          this.audio = {
            inputStream,
            track,
          };
        } else if (!this.video && track.type === TrackTypes.VIDEO) {
          this.video = {
            inputStream,
            track,
          };
        }
      });
    }

    const tracks = [];
    if (this.audio) {
      tracks.push(this.audio.track);
    }
    if (this.video) {
      tracks.push(this.video.track);
    }

    this.sampleAdjuster = new MultiChannelSampleAdjuster(tracks);
  }

  processSamples() {
    if (!this.hasChosenTracks) {
      this.chooseTracks();
      return;
    }


    if (this.audio) {
      this.sampleAdjuster.pushSamples(this.audio.track.id, this.audio.track.samples);
    }

    if (this.video) {
      this.sampleAdjuster.pushSamples(this.video.track.id, this.video.track.samples);
    }

    // Delete samples from tracks
    for (const inputStream of this.inputs.values()) {
      const tracks = inputStream.getTracks();
      tracks.forEach((track) => {
        track.samples = [];
      });
    }

    this.sampleAdjuster.process();

    const samples = this.sampleAdjuster.getAllSamples();
  }
}
