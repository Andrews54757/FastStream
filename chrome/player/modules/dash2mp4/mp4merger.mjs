import {EventEmitter} from '../eventemitter.mjs';
import {MP4Box, DataStream} from '../mp4box.mjs';
import {MP4} from '../hls2mp4/MP4Generator.mjs';
import {FSBlob} from '../FSBlob.mjs';
import {BlobManager} from '../../utils/BlobManager.mjs';

const VideoCodecs = ['avc1', 'avc2', 'avc3', 'avc4', 'av01', 'dav1', 'hvc1', 'hev1', 'hvt1', 'lhe1', 'dvh1', 'dvhe', 'vvc1', 'vvi1', 'vvs1', 'vvcN', 'vp08', 'vp09', 'avs3', 'j2ki', 'mjp2', 'mjpg', 'uncv'];
const AudioCodecs = ['mp4a', 'ac-3', 'ac-4', 'ec-3', 'Opus', 'mha1', 'mha2', 'mhm1', 'mhm2'];

export class MP4Merger extends EventEmitter {
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

  /**
   * Picks the track a set of samples belongs to.
   *
   * Track IDs only mean anything within the initialization segment that declared them,
   * so two separately-delivered tracks may well share one. They are therefore only
   * trusted to tell tracks apart when a single fragment carries more than one.
   *
   * @param {number} trackId - The track ID the fragment names.
   * @param {number} trackCount - How many tracks the fragment carries.
   * @param {Object} defaultTrack - The track the fragment was queued against.
   * @return {Object|null} The track to append to, or null if it is not one of ours.
   */
  trackForSamples(trackId, trackCount, defaultTrack) {
    if (trackCount < 2) {
      return defaultTrack;
    }

    return [this.videoTrack, this.audioTrack].find((track) => {
      return track && track.sourceTrackId === trackId;
    }) || null;
  }

  async pushFragment(defaultTrack, fragData) {
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
    const mdat = mdats[0];
    // A muxed fragment describes one track per traf and indexes each of them
    // separately, both keyed by the track ID.
    const sidxs = mp4boxfile.boxes.filter((box) => box.type === 'sidx');
    const sampleLists = mp4boxfile.getSampleList(moof, defaultTrack.trexs);

    sampleLists.forEach((samplesList) => {
      const track = this.trackForSamples(samplesList.track_id, sampleLists.length, defaultTrack);
      if (!track || samplesList.samples.length === 0) {
        return;
      }

      const traf = moof.trafs.find((candidate) => candidate.tfhd.track_id === samplesList.track_id);
      const baseDecodeTime = traf?.tfdt?.baseMediaDecodeTime || 0;
      const sidx = sidxs.length > 1 ? sidxs.find((box) => box.reference_ID === samplesList.track_id) : sidxs[0];
      const earliestPresentationTime = sidx ? sidx.earliest_presentation_time : baseDecodeTime;
      const outputSamples = samplesList.samples.map((sample) => {
        return createMp4Sample(sample.is_sync, sample.duration, sample.size, sample.cts - sample.dts);
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

      // The mdat is copied whole, so each track's samples keep their distance into it.
      // In a muxed fragment one track's samples follow the other's rather than starting
      // right after the box header, which is why this is measured and not assumed.
      const offset = this.datasOffset + (samplesList.samples[0].offset - mdat.start);

      track.chunks.push({
        id: track.nextChunkId++,
        samples: outputSamples,
        samplesDuration: samplesList.samples_duration,
        offset,
        originalOffset: offset,
        startPTS: earliestPresentationTime,
        endPTS: earliestPresentationTime + samplesList.samples_duration,
        baseDecodeTime: baseDecodeTime,
      });
    });

    this.datas.push(this.blobManager.saveBlob(blob.slice(mdat.start, mdat.start + mdat.size)));
    this.datasOffset += mdat.size;
  }

  /**
   * Builds the video track an initialization segment describes.
   * @param {Object} file - The parsed initialization segment.
   * @param {number} duration - The track's duration, in seconds.
   * @return {Object|null} The track, or null if the segment has no usable video.
   */
  makeVideoTrack(file, duration) {
    const found = findTrack(file, VideoCodecs);
    if (!found) {
      return null;
    }

    const {trak, entry} = found;
    return {
      type: 'video',
      id: 1,
      sourceTrackId: trak.tkhd.track_id,
      timescale: trak.mdia.mdhd.timescale,
      duration: duration,
      width: trak.tkhd.width >> 16,
      height: trak.tkhd.height >> 16,
      pixelRatio: [1, 1],
      sps: [],
      pps: [],
      samples: [],
      chunks: [],
      use64Offsets: false,
      nextChunkId: 1,
      elst: [],
      trexs: file.moov?.mvex?.trexs || [],
      codecBuffer: writeSampleEntry(entry),
    };
  }

  /**
   * Builds the audio track an initialization segment describes.
   * @param {Object} file - The parsed initialization segment.
   * @param {number} duration - The track's duration, in seconds.
   * @return {Object|null} The track, or null if the segment has no usable audio.
   */
  makeAudioTrack(file, duration) {
    const found = findTrack(file, AudioCodecs);
    if (!found) {
      return null;
    }

    const {trak, entry} = found;
    return {
      type: 'audio',
      id: 2,
      sourceTrackId: trak.tkhd.track_id,
      timescale: trak.mdia.mdhd.timescale,
      duration: duration,
      segmentCodec: null,
      samples: [],
      chunks: [],
      use64Offsets: false,
      nextChunkId: 1,
      elst: [],
      trexs: file.moov?.mvex?.trexs || [],
      codecBuffer: writeSampleEntry(entry),
    };
  }

  setup(videoDuration, videoInitSegment, audioDuration, audioInitSegment) {
    if (!videoDuration && !audioDuration) {
      throw new Error('no video or audio');
    }

    if (videoDuration) {
      const file = parseInitSegment(videoInitSegment, 'Video');
      this.videoTrack = this.makeVideoTrack(file, videoDuration);

      if (!this.videoTrack) {
        throw new Error('Video codec not supported!');
      }

      // With no separate audio rendition the video may be muxed, in which case the one
      // initialization segment describes both tracks and every fragment carries both.
      if (!audioDuration) {
        this.audioTrack = this.makeAudioTrack(file, videoDuration);
      }
    }

    if (audioDuration) {
      const file = parseInitSegment(audioInitSegment, 'Audio');
      this.audioTrack = this.makeAudioTrack(file, audioDuration);

      if (!this.audioTrack) {
        throw new Error('Audio codec not supported!');
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

    // Tracks need not start together, and each keeps its own timescale, so the shared
    // starting point has to be found in seconds rather than in raw timestamps.
    let minStart = Infinity;

    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].chunks.length !== len) {
        console.log('WARNING: chunk length is not equal', tracks[i].chunks.length, len);
      }

      minStart = Math.min(minStart, tracks[i].chunks[0].startPTS / tracks[i].timescale);
    }

    const movieTimescale = tracks[0].timescale;
    tracks.forEach((track) => {
      track.movieTimescale = movieTimescale;

      const start = track.chunks[0].startPTS / track.timescale;
      const end = track.chunks[track.chunks.length - 1].endPTS / track.timescale;
      // Rounded before it is tested, so that tracks which start together but count in
      // different timescales are not given an edit that lasts no time at all.
      const delay = Math.round((start - minStart) * movieTimescale);

      // Samples are written starting at media time zero, so a track that begins later
      // than the others is held back by an empty edit. Expressing the delay as a
      // media_time instead would skip into the media rather than postpone it.
      if (delay > 0) {
        track.elst.push({
          media_time: -1,
          segment_duration: delay,
        });
      }

      // Samples are written from decode time zero, so a track that composes out of
      // decode order presents its first frame a little after that. Starting the edit
      // any earlier points it at a frame that is not there and the first one is lost.
      // Media times are counted in the track's own timescale.
      track.elst.push({
        media_time: firstPresentedTime(track.chunks[0]),
        segment_duration: Math.round((end - start) * movieTimescale),
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
      if (this.cancelled) {
        this.destroy();
        this.blobManager.close();
        throw new Error('Cancelled');
      }
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

/**
 * Parses an initialization segment.
 * @param {ArrayBuffer} buffer - The segment.
 * @param {string} what - 'Video' or 'Audio', for the error a caller may recover from.
 * @return {Object} The parsed file.
 */
/**
 * The earliest time a chunk presents anything, counted from its own first decode time.
 * @param {Object} chunk - A chunk of samples.
 * @return {number} The composition time of its first presented sample.
 */
function firstPresentedTime(chunk) {
  let decodeTime = 0;
  let earliest = 0;

  chunk.samples.forEach((sample, index) => {
    const presentedAt = decodeTime + sample.cts;
    if (index === 0 || presentedAt < earliest) {
      earliest = presentedAt;
    }
    decodeTime += sample.duration;
  });

  return Math.max(0, earliest);
}

function parseInitSegment(buffer, what) {
  const file = MP4Box.createFile(false);
  buffer.fileStart = 0;
  file.appendBuffer(buffer);
  file.flush();

  if (!file.moov) {
    throw new Error(`${what} is not an mp4!`);
  }

  return file;
}

/**
 * Finds the track whose sample description names one of the given codecs.
 *
 * Which track an initialization segment lists first is up to whatever muxed it, so a
 * segment describing both audio and video has to be searched rather than indexed.
 *
 * @param {Object} file - A parsed initialization segment.
 * @param {string[]} codecs - Sample entry types to accept.
 * @return {{trak: Object, entry: Object}|null} The track and its sample entry.
 */
function findTrack(file, codecs) {
  for (const trak of file.moov.traks) {
    const entry = trak.mdia?.minf?.stbl?.stsd?.entries?.find((candidate) => {
      return codecs.includes(candidate.type);
    });

    if (entry) {
      return {trak, entry};
    }
  }

  return null;
}

/**
 * Serializes a sample description entry, so the output carries the same codec setup.
 * @param {Object} entry - The sample description entry.
 * @return {ArrayBuffer} The written box.
 */
function writeSampleEntry(entry) {
  const stream = new DataStream();
  stream.endianness = DataStream.BIG_ENDIAN;
  entry.write(stream);
  return stream.buffer;
}

function createMp4Sample(isKeyframe, duration, size, cts) {
  return {
    duration,
    size,
    cts,
    flags: {
      isLeading: 0,
      isDependedOn: 0,
      hasRedundancy: 0,
      degradPrio: 0,
      dependsOn: isKeyframe ? 2 : 1,
      isNonSync: isKeyframe ? 0 : 1,
    },
  };
}
