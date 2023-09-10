import {Hls} from '../hls.mjs';
const {TSDemuxer, MP4Remuxer, MP4Demuxer, AACDemuxer, MP3Demuxer, PassThroughRemuxer} = Hls.Muxers;

const muxConfig = [{
  demux: MP4Demuxer,
  remux: PassThroughRemuxer,
}, {
  demux: TSDemuxer,
  remux: MP4Remuxer,
}, {
  demux: AACDemuxer,
  remux: MP4Remuxer,
}, {
  demux: MP3Demuxer,
  remux: MP4Remuxer,
}];
export default class Transmuxer {
  constructor(transmuxConfig) {
    this.typeSupported = {
      mp4: MediaSource.isTypeSupported('video/mp4'),
      mpeg: MediaSource.isTypeSupported('audio/mpeg'),
      mp3: MediaSource.isTypeSupported('audio/mp4; codecs="mp3"'),
    };

    this.config = new Proxy({
      stretchShortVideoTrack: false,
      maxBufferHole: 0.5,
      maxAudioFramesDrift: 1,
      enableSoftwareAES: true,
      forceKeyFrameOnDiscontinuity: true,
    }, {
      get: (obj, prop) => {
        // console.log("get", prop)
        if (prop in obj) {
          return obj[prop];
        } else {
          console.log('get', prop);
          return null;
        }
      },
    });

    this.vendor = 'AJS/FastStream';

    this.transmuxConfig = {
      audioCodec: null,
      videoCodec: null,
      initSegmentData: null,
      duration: null,
      defaultInitPts: null,
      ...transmuxConfig,
    };
  }

  get observer() {
    return {
      emit: (event, name, data) => {
        console.log(event, name, data);
      },
    };
  }

  configureTransmuxer(data) {
    const {
      config,
      observer,
      typeSupported,
      vendor,
    } = this;
    // probe for content type
    let mux;
    for (let i = 0, len = muxConfig.length; i < len; i++) {
      if (muxConfig[i].demux.probe(data)) {
        mux = muxConfig[i];
        break;
      }
    }
    if (!mux) {
      return new Error('Failed to find demuxer by probing fragment data');
    }
    // so let's check that current remuxer and demuxer are still valid
    const demuxer = this.demuxer;
    const remuxer = this.remuxer;
    const Remuxer = mux.remux;
    const Demuxer = mux.demux;
    if (!remuxer || !(remuxer instanceof Remuxer)) {
      this.remuxer = new Remuxer(observer, config, typeSupported, vendor);
    }
    if (!demuxer || !(demuxer instanceof Demuxer)) {
      this.demuxer = new Demuxer(observer, config, typeSupported);
      this.probe = Demuxer.probe;
    }
  }

  pushData(data, discontinuity) {
    const uintData = new Uint8Array(data);

    if (!this.demuxer || !this.remuxer) {
      this.configureTransmuxer(uintData);
    }

    const {transmuxConfig} = this;
    const {audioCodec, videoCodec, defaultInitPts, duration, initSegmentData} = transmuxConfig;

    if (discontinuity) {
      this.resetInitSegment(initSegmentData, audioCodec, videoCodec, duration);
      this.resetInitialTimestamp(defaultInitPts);
      this.resetContiguity();
    }
    const result = this.demux(uintData);
    const remuxed = this.remux(result.videoTrack, result.audioTrack, result.minPTS || 0);
    remuxed.videoTrack = result.videoTrack;
    remuxed.audioTrack = result.audioTrack;
    return remuxed;
  }

  resetInitialTimestamp(defaultInitPts) {
    const {demuxer, remuxer} = this;
    if (!demuxer || !remuxer) {
      return;
    }
    demuxer.resetTimeStamp(defaultInitPts);
    remuxer.resetTimeStamp(defaultInitPts);
  }
  resetContiguity() {
    const {demuxer, remuxer} = this;
    if (!demuxer || !remuxer) {
      return;
    }
    demuxer.resetContiguity();
    remuxer.resetNextTimestamp();
  }
  resetInitSegment(initSegmentData, audioCodec, videoCodec, trackDuration) {
    const {demuxer, remuxer} = this;
    if (!demuxer || !remuxer) {
      return;
    }
    demuxer.resetInitSegment(initSegmentData, audioCodec, videoCodec, trackDuration);
    remuxer.resetInitSegment(initSegmentData, audioCodec, videoCodec);
  }
  destroy() {
    if (this.demuxer) {
      this.demuxer.destroy();
      this.demuxer = undefined;
    }
    if (this.remuxer) {
      this.remuxer.destroy();
      this.remuxer = undefined;
    }
  }
  remux(videoTrack, audioTrack, timeOffset) {
    const id3Track = {
      'type': 'id3',
      'id': 3,
      'pid': -1,
      'inputTimeScale': 90000,
      'sequenceNumber': 0,
      'samples': [],
      'dropped': 0,
      'pesData': null,
    };
    const textTrack = {
      'type': 'text',
      'id': 4,
      'pid': -1,
      'inputTimeScale': 90000,
      'sequenceNumber': 0,
      'samples': [],
      'dropped': 0,
    };

    return this.remuxer.remux(audioTrack, videoTrack, id3Track, textTrack, timeOffset, true, false, 3);
  }
  getVideoStartPts(videoSamples) {
    let rolloverDetected = false;
    const startPTS = videoSamples.reduce((minPTS, sample) => {
      const delta = sample.pts - minPTS;
      if (delta < -4294967296) {
        // 2^32, see PTSNormalize for reasoning, but we're hitting a rollover here, and we don't want that to impact the timeOffset calculation
        rolloverDetected = true;
        return normalizePts(minPTS, sample.pts);
      } else if (delta > 0) {
        return minPTS;
      } else {
        return sample.pts;
      }
    }, videoSamples[0].pts);
    if (rolloverDetected) {
      console.log('PTS rollover detected');
    }
    return startPTS;
  }
  demux(data) {
    const {audioTrack, videoTrack, id3Track, textTrack} = this.demuxer.demux(data, null, false, true);


    const videoStartPTS = videoTrack.samples.length ? this.getVideoStartPts(videoTrack.samples) : 0;
    const audioStartPTS = audioTrack.samples[0]?.pts || 0;

    const minPTS = Math.min(videoStartPTS, audioStartPTS);

    return {
      audioTrack,
      videoTrack,
      videoStartPTS,
      audioStartPTS,
      minPTS: minPTS / videoTrack.inputTimeScale,
    };
  }
}
const emptyResult = (chunkMeta) => ({
  remuxResult: {},
  chunkMeta,
});
export function isPromise(p) {
  return 'then' in p && p.then instanceof Function;
}
