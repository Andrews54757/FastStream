import {TSDemuxer as HLSTSDemuxer} from '../../hls.mjs';
import {AudioSample} from '../common/AudioSample.mjs';
import {AudioTrackInfo} from '../common/AudioTrackInfo.mjs';
import {VideoConverterUtils} from '../common/VideoConverterUtils.mjs';
import {VideoSample} from '../common/VideoSample.mjs';
import {VideoTrackInfo} from '../common/VideoTrackInfo.mjs';
import {AbstractDemuxer} from './AbstractDemuxer.mjs';

export default class TSDemuxer extends AbstractDemuxer {
  constructor() {
    super();
  }

  // These are public methods that can be called from outside the class
  static test(buffer) {
    const data = new Uint8Array(buffer);
    return HLSTSDemuxer.probe(data);
  }


  appendBuffer(buffer, offset) {
    if (!this.demuxer) {
      this.demuxer = new HLSTSDemuxer(this.observer, {}, {
        mp3: true,
        mpeg: true,
      });
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


  getAllSamples() {
    const videoTrack = this.videoTrack;
    const audioTrack = this.audioTrack;

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
    const videoTrack = this.videoTrack;
    const audioTrack = this.audioTrack;
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
    const videoTrack = this.videoTrack;
    if (!videoTrack) {
      return null;
    }

    return new VideoTrackInfo({
      id: 0,
      codec: videoTrack.parsedCodec || videoTrack.manifestCodec || videoTrack.codec,
      description: VideoConverterUtils.spsppsToDescription(videoTrack.sps, videoTrack.pps),
      codedWidth: videoTrack.width,
      codedHeight: videoTrack.height,
      displayAspectWidth: videoTrack.pixelRatio[0],
      displayAspectHeight: videoTrack.pixelRatio[1],
    });
  }

  getAudioInfo() {
    const audioTrack = this.audioTrack;
    if (!audioTrack) {
      return null;
    }
    return new AudioTrackInfo({
      id: 1,
      codec: audioTrack.parsedCodec || audioTrack.manifestCodec || audioTrack.codec,
      sampleRate: audioTrack.samplerate,
      numberOfChannels: audioTrack.channelCount,
      description: audioTrack.config,
    });
  }

  initializeTracks(demuxed) {
    this.initializedTracks = true;

    if (demuxed.audioTrack && demuxed.audioTrack.pid > -1) {
      demuxed.audioTrack.fssamples = [];
      this.audioTrack = demuxed.audioTrack;
    }

    if (demuxed.videoTrack && demuxed.videoTrack.pid > -1) {
      demuxed.videoTrack.fssamples = [];
      this.videoTrack = demuxed.videoTrack;
    }
  }

  get observer() {
    return {
      emit: (event, name, data) => {
        console.log(event, name, data);
      },
    };
  }

  process(demuxed) {
    const videoTrack = demuxed.videoTrack;
    if (videoTrack.pid > -1) {
      const samples = videoTrack.samples;
      const track = this.videoTrack;

      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];

        // Convert NALU to data
        const numUnits = sample.units.length;
        const sampleLen = sample.units.reduce((acc, unit) => acc + unit.data.byteLength, 0);
        const data = new Uint8Array(numUnits * 4 + sampleLen);
        const dataView = new DataView(data.buffer);
        let offset = 0;

        for (let j = 0; j < numUnits; j++) {
          const unit = sample.units[j];
          dataView.setUint32(offset, unit.data.byteLength);
          offset += 4;
          data.set(unit.data, offset);
          offset += unit.data.byteLength;
        }

        track.fssamples.push(new VideoSample({
          isKey: sample.key,
          pts: sample.pts,
          coffset: sample.pts - sample.dts,
          timescale: track.inputTimeScale,
          data: data,
        }));
      }

      samples.length = 0; // Clear samples after processing
    }

    const audioTrack = demuxed.audioTrack;
    if (audioTrack.pid > -1) {
      const samples = audioTrack.samples;
      const track = this.audioTrack;

      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        track.fssamples.push(new AudioSample({
          pts: sample.pts,
          timescale: track.inputTimeScale,
          data: sample.unit,
        }));
      }

      samples.length = 0; // Clear samples after processing
    }
  }
}
