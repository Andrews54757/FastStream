import {JsWebm} from '../../reencoder/webm.mjs';
import {AudioSample} from '../common/AudioSample.mjs';
import {AudioTrackInfo} from '../common/AudioTrackInfo.mjs';
import {ColorSpaceConfig} from '../common/ColorSpaceConfig.mjs';
import {VideoSample} from '../common/VideoSample.mjs';
import {VideoTrackInfo} from '../common/VideoTrackInfo.mjs';
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
      codec: this.demuxer.audioCodec,
      description: audioTrack.codecPrivate,
      sampleRate: audioTrack.rate,
      numberOfChannels: audioTrack.channels,
    });
  }

  // Private methods can be defined here
  process() {
    const videoTrack = this.demuxer.videoTrack;
    if (videoTrack) {
      const samples = videoTrack.samples;
      samples.forEach((sample) => {
        videoTrack.chunks.push(new VideoSample({
          isKey: sample.isKeyframe,
          pts: sample.timestamp,
          dts: sample.timestamp,
          timescale: 1,
          data: sample.data,
        }));
      });
    }

    const audioTrack = this.demuxer.audioTrack;
    if (audioTrack) {
      const samples = audioTrack.samples;
      samples.forEach((sample) => {
        audioTrack.chunks.push(new AudioSample({
          pts: sample.timestamp,
          timescale: 1,
          data: sample.data,
        }));
      });
    }
  }

  initializeTracks() {
    this.initializedTracks = true;

    // Initialize tracks from demuxer
    const videoTrack = this.demuxer.videoTrack;
    const audioTrack = this.demuxer.audioTrack;

    if (videoTrack) {
      videoTrack.chunks = [];
    }

    if (audioTrack) {
      audioTrack.chunks = [];
    }
  }
}
