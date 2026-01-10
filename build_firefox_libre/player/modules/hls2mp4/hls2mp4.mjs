import {EventEmitter} from '../eventemitter.mjs';
import {FSBlob} from '../FSBlob.mjs';
import {MP4} from './MP4Generator.mjs';
import Transmuxer from './transmuxer.mjs';
export class HLS2MP4 extends EventEmitter {
  constructor(registerCancel) {
    super();
    this.blobManager = new FSBlob();
    if (registerCancel) {
      registerCancel(() => {
        this.cancel();
      });
    }
  }
  cancel() {
    this.cancelled = true;
  }
  arrayEquals(a, b) {
    let i;
    if (a.length !== b.length) {
      return false;
    } // compare the value of each element in the array
    for (i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }
  async pushFragment(fragData) {
    const entry = await fragData.getEntry();
    const data = await entry.getDataFromBlob();
    const fragment = fragData.fragment;
    const isDiscontinuity = !this.prevFrag || fragment.sn !== this.prevFrag.fragment.sn + 1 || fragment.cc !== this.prevFrag.fragment.cc;
    if (isDiscontinuity) {
      console.log('discontinuity');
    }
    this.prevFrag = fragData;
    const result = this.transmuxer.pushData(new Uint8Array(data), isDiscontinuity);
    const headerLen = 8;
    if (result.video) {
      if (!this.videoTrack) {
        this.videoTrack = {
          ...result.videoTrack,
          samples: [],
          chunks: [],
          use64Offsets: false,
          nextChunkId: 1,
          elst: [],
          padding: 0,
        };
      }
      result.videoTrack.pps.forEach((pps) => {
        if (!this.videoTrack.pps.find((p) => {
          return this.arrayEquals(p, pps);
        })) {
          this.videoTrack.pps.push(pps);
        }
      });
      result.videoTrack.sps.forEach((sps) => {
        if (!this.videoTrack.sps.find((s) => {
          return this.arrayEquals(s, sps);
        })) {
          this.videoTrack.sps.push(sps);
        }
      });
      this.videoTrack.chunks.push({
        id: this.videoTrack.nextChunkId++,
        samples: result.video.outputSamples,
        offset: this.datasOffset + headerLen,
        originalOffset: this.datasOffset + headerLen,
        startDTS: result.video.startDTS,
        endDTS: result.video.endDTS,
        startPTS: result.video.startPTS,
        endPTS: result.video.endPTS,
      });
      const blob = new Blob([result.video.data2], {
        type: 'video/mp4',
      });
      this.datas.push(this.blobManager.saveBlob(blob));
      this.datasOffset += result.video.data2.byteLength;
    }
    if (result.audio) {
      if (!this.audioTrack) {
        this.audioTrack = {
          ...result.audioTrack,
          samples: [],
          chunks: [],
          use64Offsets: false,
          nextChunkId: 1,
          elst: [],
          padding: 0,
        };
      }
      this.audioTrack.chunks.push({
        id: this.audioTrack.nextChunkId++,
        samples: result.audio.outputSamples,
        offset: this.datasOffset + headerLen,
        originalOffset: this.datasOffset + headerLen,
        startDTS: result.audio.startDTS,
        endDTS: result.audio.endDTS,
        startPTS: result.audio.startPTS,
        endPTS: result.audio.endPTS,
      });
      const blob = new Blob([result.audio.data2], {
        type: 'video/mp4',
      });
      this.datas.push(this.blobManager.saveBlob(blob));
      this.datasOffset += result.audio.data2.byteLength;
    }
  }
  async pushFragmentAudio(fragData) {
    const entry = await fragData.getEntry();
    const data = await entry.getDataFromBlob();
    const fragment = fragData.fragment;
    const isDiscontinuity = !this.prevFragAudio || fragment.sn !== this.prevFragAudio.fragment.sn + 1 || fragment.cc !== this.prevFragAudio.fragment.cc;
    if (isDiscontinuity) {
      console.log('discontinuity');
    }
    this.prevFragAudio = fragData;
    const result = this.transmuxerAudio.pushData(new Uint8Array(data), isDiscontinuity);
    const headerLen = 8;
    if (result.audio) {
      if (!this.audioTrack) {
        this.audioTrack = {
          ...result.audioTrack,
          samples: [],
          chunks: [],
          use64Offsets: false,
          nextChunkId: 1,
          elst: [],
          padding: 0,
        };
      }
      this.audioTrack.chunks.push({
        id: this.audioTrack.nextChunkId++,
        samples: result.audio.outputSamples,
        offset: this.datasOffset + headerLen,
        originalOffset: this.datasOffset + headerLen,
        startDTS: result.audio.startDTS,
        endDTS: result.audio.endDTS,
        startPTS: result.audio.startPTS,
        endPTS: result.audio.endPTS,
      });
      const blob = new Blob([result.audio.data2], {
        type: 'video/mp4',
      });
      this.datas.push(this.blobManager.saveBlob(blob));
      this.datasOffset += result.audio.data2.byteLength;
    }
  }
  setup(level, levelInitData, audioLevel, audioInitData) {
    if (!level.details) {
      throw new Error('level.details is null');
    }
    this.transmuxer = new Transmuxer({
      audioCodec: level.audioCodec,
      videoCodec: level.videoCodec,
      initSegmentData: levelInitData || [],
      duration: level.details.totalduration,
      defaultInitPts: 0,
    });
    if (audioLevel) {
      this.transmuxerAudio = new Transmuxer({
        videoCodec: '',
        audioCodec: audioLevel.audioCodec,
        initSegmentData: audioInitData || [],
        duration: level.details.totalduration,
        defaultInitPts: 0,
      });
    }
    this.prevFrag = null;
    this.prevFragAudio = null;
    this.datas = [];
    this.datasOffset = 0;
  }
  async finalize() {
    const tracks = [];
    const videoTrack = this.videoTrack;
    const audioTrack = this.audioTrack;
    if (videoTrack) tracks.push(videoTrack);
    if (audioTrack) {
      tracks.push(audioTrack);
    }
    const len = tracks[0].chunks.length;
    let minDts = tracks[0].chunks[0].startDTS;
    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].chunks.length !== len) {
        console.log('WARNING: chunk length is not equal', tracks[i].chunks.length, len);
      }
      if (tracks[i].chunks[0].startDTS < minDts) {
        minDts = tracks[i].chunks[0].startDTS;
      }
    }
    tracks.forEach((track) => {
      const trackDTS = track.chunks[0].startDTS;
      const diff = trackDTS - minDts;
      if (diff > 0.01) {
        const cts = track.chunks[0].startPTS - track.chunks[0].startDTS;
        track.elst.push({
          media_time: -1,
          segment_duration: Math.floor((diff + cts) * track.timescale),
        });
        track.padding = diff;
      }
    });
    const movieTimescale = tracks[0].timescale;
    tracks.forEach((track) => {
      track.movieTimescale = movieTimescale;
      track.elst.push({
        media_time: (track.chunks[0].startPTS - track.chunks[0].startDTS) * movieTimescale,
        segment_duration: (track.chunks[track.chunks.length - 1].endDTS - track.chunks[0].startDTS - track.padding) * movieTimescale,
      });
      track.samples = [];
      track.chunks.forEach((chunk) => {
        track.samples.push(...chunk.samples);
      });
    });
    let initSeg;
    try {
      const initSegCount = MP4.initSegment(tracks);
      const len = initSegCount.byteLength;
      tracks.forEach((track) => {
        track.chunks.forEach((chunk) => {
          chunk.offset = chunk.originalOffset + len;
        });
      });
      initSeg = MP4.initSegment(tracks);
    } catch (e) {
      tracks.forEach((track) => {
        track.use64Offsets = true;
      });
      const initSegCount = MP4.initSegment(tracks);
      const len = initSegCount.byteLength;
      tracks.forEach((track) => {
        track.chunks.forEach((chunk) => {
          chunk.offset = chunk.originalOffset + len;
        });
      });
      initSeg = MP4.initSegment(tracks);
    }
    const dataChunks = await Promise.all(this.datas.map((data) => {
      return this.blobManager.getBlob(data);
    }));
    return new Blob([initSeg, ...dataChunks], {
      type: 'video/mp4',
    });
  }
  async convert(level, levelInitData, audioLevel, audioInitData, zippedFragments) {
    this.setup(level, levelInitData, audioLevel, audioInitData);
    let lastProgress = 0;
    for (let i = 0; i < zippedFragments.length; i++) {
      if (this.cancelled) {
        this.destroy();
        this.blobManager.close();
        throw new Error('Cancelled');
      }
      if (zippedFragments[i].track === 0) {
        await this.pushFragment(zippedFragments[i]);
      } else {
        await this.pushFragmentAudio(zippedFragments[i]);
      }
      const newProgress = Math.floor((i + 1) / zippedFragments.length * 100);
      if (newProgress !== lastProgress) {
        lastProgress = newProgress;
        this.emit('progress', newProgress / 100);
      }
    }
    const blob = await this.finalize();
    this.destroy();
    return blob;
  }
  destroy() {
    if (this.transmuxer) this.transmuxer.destroy();
    if (this.transmuxerAudio) this.transmuxerAudio.destroy();
    this.transmuxerAudio = null;
    this.transmuxer = null;
    this.videoTrack = null;
    this.audioTrack = null;
    this.prevFrag = null;
    this.datas = null;
    this.datasOffset = 0;
    setTimeout(() => {
      this.blobManager.close();
      this.blobManager = null;
    }, 120000);
  }
}
