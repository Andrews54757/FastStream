import {JsWebm} from '../../reencoder/webm.mjs';
import {AudioSample} from '../common/AudioSample.mjs';
import {AudioTrackInfo} from '../common/AudioTrackInfo.mjs';
import {ColorSpaceConfig} from '../common/ColorSpaceConfig.mjs';
import {VideoSample} from '../common/VideoSample.mjs';
import {VideoTrackInfo} from '../common/VideoTrackInfo.mjs';
import {TrackTypes} from '../enums/TrackTypes.mjs';
import {AbstractDemuxer} from './AbstractDemuxer.mjs';

export default class WebMDemuxer extends AbstractDemuxer {
  constructor() {
    super();
    this.demuxer = new JsWebm();
    this.MAX_ITERATIONS = 10000;
  }

  // These are public methods that can be called from outside the class
  static test(buffer) {
    const demuxer = new JsWebm();
    try {
      demuxer.queueData(buffer);
      demuxer.demux();
    } catch (e) {
      return false;
    }

    return demuxer.elementEBML && demuxer.elementEBML.id === 0x1A45DFA3;
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

  getAllSamples() {
    const videoTrack = this.demuxer.videoTrack;
    const audioTrack = this.demuxer.audioTrack;

    const results = new Map();

    if (videoTrack) {
      results.set(0, {
        id: 0,
        type: TrackTypes.VIDEO,
        samples: videoTrack.fssamples,
      });
      videoTrack.fssamples = [];
    }

    if (audioTrack) {
      results.set(1, {
        id: 1,
        type: TrackTypes.AUDIO,
        samples: videoTrack.fssamples,
      });
      audioTrack.fssamples = [];
    }

    return results;
  }

  getAllTracks() {
    const videoTrack = this.demuxer.videoTrack;
    const audioTrack = this.demuxer.audioTrack;

    const results = new Map();

    if (videoTrack) {
      results.set(0, this.getVideoInfo());
    }

    if (audioTrack) {
      results.set(1, this.getAudioInfo());
    }

    return results;
  }

  // Private methods can be defined here
  getVideoInfo() {
    const videoTrack = this.demuxer.videoTrack;
    if (!videoTrack) {
      return null;
    }

    let colorSpace = null;

    const colour = videoTrack.colour;
    if (colour) {
      colorSpace = new ColorSpaceConfig({
        primaries: colour.primaries,
        transfer: colour.transferCharacteristics,
        matrix: colour.matrixCoefficients,
        fullRange: colour.range ? (colour.range === 'full') : null,
      });
    }

    return new VideoTrackInfo({
      id: 0,
      codec: this.demuxer.videoCodec,
      description: videoTrack.codecPrivate,
      codedWidth: videoTrack.width,
      codedHeight: videoTrack.height,
      displayAspectWidth: videoTrack.displayWidth,
      displayAspectHeight: videoTrack.displayHeight,
      colorSpace,
    });
  }

  getAudioInfo() {
    const audioTrack = this.demuxer.audioTrack;
    if (!audioTrack) {
      return null;
    }
    return new AudioTrackInfo({
      id: 1,
      codec: this.demuxer.audioCodec,
      description: audioTrack.codecPrivate,
      sampleRate: audioTrack.rate,
      numberOfChannels: audioTrack.channels,
    });
  }

  process() {
    const videoTrack = this.demuxer.videoTrack;
    if (videoTrack) {
      const samples = this.demuxer.videoPackets;
      samples.forEach((sample) => {
        videoTrack.fssamples.push(new VideoSample({
          isKey: sample.isKeyframe,
          pts: sample.timestamp,
          coffset: 0,
          timescale: this.demuxer.segmentInfo.timestampScale,
          data: sample.data,
        }));
      });
      samples.length = 0;
    }

    const audioTrack = this.demuxer.audioTrack;
    if (audioTrack) {
      const samples = this.demuxer.audioPackets;
      samples.forEach((sample) => {
        audioTrack.fssamples.push(new AudioSample({
          pts: sample.timestamp,
          timescale: this.demuxer.segmentInfo.timestampScale,
          data: sample.data,
        }));
      });
      samples.length = 0;
    }
  }

  initializeTracks() {
    this.initializedTracks = true;

    // Initialize tracks from demuxer
    const videoTrack = this.demuxer.videoTrack;
    const audioTrack = this.demuxer.audioTrack;

    if (videoTrack) {
      videoTrack.fssamples = [];
    }

    if (audioTrack) {
      audioTrack.fssamples = [];
    }
  }
}
