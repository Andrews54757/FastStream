import {EventEmitter} from '../eventemitter.mjs';
import {MP4Box} from '../mp4box.mjs';
import {MP4} from '../hls2mp4/MP4Generator.mjs';
import {Hls} from '../hls.mjs';

const {ExpGolomb, Mp4Sample} = Hls.Muxers;

export class DASH2MP4 extends EventEmitter {
  constructor() {
    super();
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

  async pushFragment(track, fragData) {
    const blob = await fragData.entry.getData();
    const data = await fragData.entry.getDataFromBlob();
    data.fileStart = 0;
    const mp4boxfile = MP4Box.createFile(false);
    mp4boxfile.onError = function(e) {
      console.log('mp4box error', e);
    };

    mp4boxfile.appendBuffer(data);
    mp4boxfile.flush();


    const mdats = mp4boxfile.mdats;
    if (mdats.length !== 1) throw new Error('Unsupported mdat count!');
    if (mp4boxfile.moofs.length !== 1) throw new Error('Unsupported moofs count!');

    const moof = mp4boxfile.moofs[0];

    if (moof.trafs.length !== 1) throw new Error('Unsupported trafs count!');

    const traf = moof.trafs[0];
    const headerLen = 8;
    const samplesList = mp4boxfile.getSampleList(moof, track.trexs)[0];
    const baseDecodeTime = traf.tfdt?.baseMediaDecodeTime || 0;
    const earliestPresentationTime = mp4boxfile.sidx ? mp4boxfile.sidx.earliest_presentation_time : baseDecodeTime;
    const outputSamples = samplesList.samples.map((sample)=>{
      return new Mp4Sample(sample.is_sync, sample.duration, sample.size, sample.cts - sample.dts);
    });

    if (track.chunks.length > 0) {
      const lastChunk = track.chunks[track.chunks.length - 1];
      if (lastChunk.baseDecodeTime + lastChunk.samplesDuration < baseDecodeTime) {
        console.log('Extending', lastChunk);
        lastChunk.samples[lastChunk.samples.length - 1].duration += baseDecodeTime - (lastChunk.baseDecodeTime + lastChunk.samplesDuration);
      } else if (lastChunk.baseDecodeTime + lastChunk.samplesDuration > baseDecodeTime) {
        console.log('Too long');
      }
    }

    if (samplesList.samples_duration === 0) {
      console.log(track);
      throw new Error('Sample duration is zero!');
    }

    track.chunks.push({
      id: track.nextChunkId++,
      samples: outputSamples,
      samplesDuration: samplesList.samples_duration,
      offset: this.datasOffset + headerLen,
      originalOffset: this.datasOffset + headerLen,
      startPTS: earliestPresentationTime,
      endPTS: earliestPresentationTime + samplesList.samples_duration,
      baseDecodeTime: baseDecodeTime,
    });

    mdats.forEach((mdat) => {
      this.datas.push(blob.slice(mdat.start, mdat.start + mdat.size));
      this.datasOffset += mdat.size;
    });
  }

  setup(videoProcessor, videoInitSegment, audioProcessor, audioInitSegment) {
    if (!videoProcessor && !audioProcessor) {
      throw new Error('no processor');
    }

    if (videoProcessor) {
      const file = MP4Box.createFile(false);
      videoInitSegment.fileStart = 0;
      file.appendBuffer(videoInitSegment);
      file.flush();

      const mediaInfo = videoProcessor.getMediaInfo();
      const trak = file.moov.traks[0];
      const timescale = trak.mdia.mdhd.timescale;
      this.videoTrack = {
        type: 'video',
        id: 1,
        timescale: timescale,
        duration: mediaInfo.streamInfo.duration,
        width: trak.tkhd.width >> 16,
        height: trak.tkhd.height >> 16,
        pixelRatio: [1, 1],
        sps: [],
        pps: [],
        // segmentCodec: null,
        // codec: null,
        // config: null,
        // channelCount: null,
        // sampleRate: null,
        samples: [],
        chunks: [],
        use64Offsets: false,
        nextChunkId: 1,
        elst: [],
        trexs: file.moov?.mvex?.trexs || [],
      };

      const avcC = trak.mdia.minf.stbl.stsd.entries.find((e) => e.type === 'avc1').avcC;
      avcC.PPS.forEach((pps) => {
        this.videoTrack.pps.push(pps.nalu);
      });
      avcC.SPS.forEach((sps) => {
        this.videoTrack.sps.push(sps.nalu);
      });
      const sps = this.videoTrack.sps[0];
      const expGolombDecoder = new ExpGolomb(sps);
      const config = expGolombDecoder.readSPS();

      this.videoTrack.pixelRatio = config.pixelRatio;
      this.videoTrack.width = config.width;
      this.videoTrack.height = config.height;
      const codecarray = sps.subarray(1, 4);
      let codecstring = 'avc1.';
      for (let i = 0; i < 3; i++) {
        let h = codecarray[i].toString(16);
        if (h.length < 2) {
          h = '0' + h;
        }
        codecstring += h;
      }
      this.videoTrack.codec = codecstring;
    }

    if (audioProcessor) {
      const file = MP4Box.createFile(false);
      audioInitSegment.fileStart = 0;
      file.appendBuffer(audioInitSegment);
      file.flush();
      const mediaInfo = audioProcessor.getMediaInfo();
      const trak = file.moov.traks[0];
      const timescale = trak.mdia.mdhd.timescale;
      const mp4a = trak.mdia.minf.stbl.stsd.entries.find((e) => e.type === 'mp4a');
      this.audioTrack = {
        type: 'audio',
        id: 2,
        timescale: timescale,
        duration: mediaInfo.streamInfo.duration,
        segmentCodec: null,
        codec: mp4a.getCodec(),
        esds: mp4a.esds.data,
        channelCount: mp4a.channel_count,
        sampleRate: mp4a.samplerate,
        samples: [],
        chunks: [],
        use64Offsets: false,
        nextChunkId: 1,
        elst: [],
        trexs: file.moov?.mvex?.trexs || [],
      };
    }

    this.prevFrag = null;
    this.prevFragAudio = null;
    this.datas = [];
    this.datasOffset = 0;
  }

  finalize() {
    const tracks = [];
    const videoTrack = this.videoTrack;
    const audioTrack = this.audioTrack;
    if (videoTrack && videoTrack.chunks.length) {
      tracks.push(videoTrack);
    }
    if (audioTrack && audioTrack.chunks.length) {
      tracks.push(audioTrack);
    }

    const len = tracks[0].chunks.length;
    let minPts = tracks[0].chunks[0].startPTS;

    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].chunks.length !== len) {
        console.log('WARNING: chunk length is not equal', tracks[i].chunks.length, len);
      }

      if (tracks[i].chunks[0].startPTS < minPts) {
        minPts = tracks[i].chunks[0].startPTS;
      }
    }

    const movieTimescale = tracks[0].timescale;
    tracks.forEach((track) => {
      track.elst.push({
        media_time: (track.chunks[0].startPTS - minPts) / track.timescale * movieTimescale,
        segment_duration: (track.chunks[track.chunks.length - 1].endPTS - track.chunks[0].startPTS) / track.timescale * movieTimescale,
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

    return new Blob([initSeg, ...this.datas], {
      type: 'video/mp4',
    });
  }
  async convert(videoProcessor, videoInitSegment, audioProcessor, audioInitSegment, fragDatas) {
    this.setup(videoProcessor, videoInitSegment, audioProcessor, audioInitSegment);

    for (let i = 0; i < fragDatas.length; i++) {
      if (fragDatas[i].type === 0) {
        await this.pushFragment(this.videoTrack, fragDatas[i]);
      } else {
        await this.pushFragment(this.audioTrack, fragDatas[i]);
      }
      this.emit('progress', (i + 1) / fragDatas.length);
    }

    const blob = this.finalize();
    this.destroy();

    return blob;
  }

  destroy() {
    this.videoTrack = null;
    this.audioTrack = null;
    this.prevFrag = null;
    this.datas = null;
    this.datasOffset = 0;
  }
}
