import {EventEmitter} from '../eventemitter.mjs';
import {MP4Box, DataStream} from '../mp4box.mjs';
import {MP4} from '../hls2mp4/MP4Generator.mjs';
import {AvcVideoParser, Mp4Sample} from '../hls.mjs';
import {FSBlob} from '../FSBlob.mjs';
import {BlobManager} from '../../utils/BlobManager.mjs';

const VideoCodecs = ['avc1', 'avc2', 'avc3', 'avc4', 'av01', 'dav1', 'hvc1', 'hev1', 'hvt1', 'lhe1', 'dvh1', 'dvhe', 'vvc1', 'vvi1', 'vvs1', 'vvcN', 'vp08', 'vp09', 'avs3', 'j2ki', 'mjp2', 'mjpg', 'uncv'];
const AudioCodecs = ['mp4a', 'ac-3', 'ac-4', 'ec-3', 'Opus', 'mha1', 'mha2', 'mhm1', 'mhm2'];

export class DASH2MP4 extends EventEmitter {
  constructor() {
    super();
    this.blobManager = new FSBlob();
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
    const entry = await fragData.getEntry();
    const blob = await entry.getData();
    const data = await BlobManager.getDataFromBlob(blob, 'arraybuffer');
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
    const outputSamples = samplesList.samples.map((sample) => {
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
      this.datas.push(this.blobManager.saveBlob(blob.slice(mdat.start, mdat.start + mdat.size)));
      this.datasOffset += mdat.size;
    });
  }

  setup(videoDuration, videoInitSegment, audioDuration, audioInitSegment) {
    if (!videoDuration && !audioDuration) {
      throw new Error('no video or audio');
    }

    if (videoDuration) {
      const file = MP4Box.createFile(false);
      videoInitSegment.fileStart = 0;
      file.appendBuffer(videoInitSegment);
      file.flush();
      if (file.moov) {
        const trak = file.moov.traks[0];
        const timescale = trak.mdia.mdhd.timescale;
        this.videoTrack = {
          type: 'video',
          id: 1,
          timescale: timescale,
          duration: videoDuration,
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

        const toCopy = trak.mdia.minf.stbl.stsd.entries.find((e) => {
          return VideoCodecs.includes(e.type);
        });

        if (!toCopy) {
          throw new Error('Video codec not supported!');
        }

        const stream = new DataStream();
        stream.endianness = DataStream.BIG_ENDIAN;
        toCopy.write(stream);
        this.videoTrack.codecBuffer = stream.buffer;
      } else {
        throw new Error('Video is not an mp4!');
      }
    }

    if (audioDuration) {
      const file = MP4Box.createFile(false);
      audioInitSegment.fileStart = 0;
      file.appendBuffer(audioInitSegment);
      file.flush();
      if (file.moov) {
        const trak = file.moov.traks[0];
        const timescale = trak.mdia.mdhd.timescale;
        const toCopy = trak.mdia.minf.stbl.stsd.entries.find((e) => {
          return AudioCodecs.includes(e.type);
        });

        this.audioTrack = {
          type: 'audio',
          id: 2,
          timescale: timescale,
          duration: audioDuration,
          segmentCodec: null,
          // codec: mp4a.getCodec(),
          // esds: mp4a.esds.data,
          // channelCount: mp4a.channel_count,
          // sampleRate: mp4a.samplerate,
          samples: [],
          chunks: [],
          use64Offsets: false,
          nextChunkId: 1,
          elst: [],
          trexs: file.moov?.mvex?.trexs || [],
        };

        if (!toCopy) {
          throw new Error('Audio codec not supported!');
        }

        const stream = new DataStream();
        stream.endianness = DataStream.BIG_ENDIAN;
        toCopy.write(stream);
        this.audioTrack.codecBuffer = stream.buffer;
      } else {
        throw new Error('Audio is not an mp4!');
      }
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
      track.movieTimescale = movieTimescale;

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

    const dataChunks = await Promise.all(this.datas.map((data) => {
      return this.blobManager.getBlob(data);
    }));

    return new Blob([initSeg, ...dataChunks], {
      type: 'video/mp4',
    });
  }
  async convert(videoDuration, videoInitSegment, audioDuration, audioInitSegment, zippedFragments) {
    this.setup(videoDuration, videoInitSegment, audioDuration, audioInitSegment);

    let lastProgress = 0;
    for (let i = 0; i < zippedFragments.length; i++) {
      if (zippedFragments[i].track === 0) {
        await this.pushFragment(this.videoTrack, zippedFragments[i]);
      } else {
        await this.pushFragment(this.audioTrack, zippedFragments[i]);
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
