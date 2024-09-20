import {TSDemuxer as HLSTSDemuxer} from '../../hls.mjs';
import {AudioSample} from '../common/AudioSample.mjs';
import {VideoSample} from '../common/VideoSample.mjs';
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

  // Private methods can be defined here
  initializeTracks(demuxed) {
    this.initializedTracks = true;

    if (demuxed.audioTrack && demuxed.audioTrack.pid > -1) {
      demuxed.audioTrack.chunks = [];
      this.audioTrack = demuxed.audioTrack;
    }

    if (demuxed.videoTrack && demuxed.videoTrack.pid > -1) {
      demuxed.videoTrack.chunks = [];
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

        track.chunks.push(new VideoSample({
          isKey: sample.key,
          pts: sample.pts,
          dts: sample.dts,
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
