import {free, ftyp, mdat, mfra, moof, moov} from './box.mjs';
import {deepClone, intoTimescale, last} from './misc.mjs';
import {
  ArrayBufferTargetWriter,
  StreamTargetWriter,
  ChunkedStreamTargetWriter,
  FileSystemWritableFileStreamTargetWriter,
} from './writer.mjs';

export const GLOBAL_TIMESCALE = 1000;
export const SUPPORTED_VIDEO_CODECS = ['avc', 'hevc', 'vp9', 'av1'];
export const SUPPORTED_AUDIO_CODECS = ['aac', 'opus'];
const TIMESTAMP_OFFSET = 2_082_844_800; // Seconds between Jan 1 1904 and Jan 1 1970
const FIRST_TIMESTAMP_BEHAVIORS = ['strict', 'offset', 'cross-track-offset'];

// interface VideoOptions {
//     codec: SupportedVideoCodec,
//     width,
//     height,
//     rotation?: 0 | 90 | 180 | 270 | TransformationMatrix,
//     frameRate?
// }

// interface AudioOptions {
//     codec: SupportedAudioCodec,
//     numberOfChannels,
//     sampleRate
// }

// type Mp4MuxerOptions<T extends Target> =  {
//     target: T,
//     video?: VideoOptions,
//     audio?: AudioOptions,
//     fastStart: false | 'in-memory' | 'fragmented' | {
//         expectedVideoChunks?,
//         expectedAudioChunks?
//     },
//     firstTimestampBehavior?: FirstTimestampBehavior
// };

// export interface Track {
//     id,
//     info: {
//         type: 'video',
//         codec: VideoOptions['codec'],
//         width,
//         height,
//         rotation: 0 | 90 | 180 | 270 | TransformationMatrix,
//         decoderConfig: VideoDecoderConfig
//     } | {
//         type: 'audio',
//         codec: AudioOptions['codec'],
//         numberOfChannels,
//         sampleRate,
//         decoderConfig: AudioDecoderConfig
//     },
//     timescale,
//     samples,

//     firstDecodeTimestamp,
//     lastDecodeTimestamp,

//     timeToSampleTable: { sampleCount, sampleDelta }[];
//     compositionTimeOffsetTable: { sampleCount, sampleCompositionTimeOffset }[];
//     lastTimescaleUnits,
//     lastSample: Sample,

//     finalizedChunks: Chunk[],
//     currentChunk: Chunk,
//     compactlyCodedChunkTable: {
//         firstChunk,
//         samplesPerChunk
//     }[]
// }

// export type VideoTrack = Track & { info: { type: 'video' } };
// export type AudioTrack = Track & { info: { type: 'audio' } };

// export interface Sample {
//     presentationTimestamp,
//     decodeTimestamp,
//     duration,
//     data: Uint8Array,
//     size,
//     type: 'key' | 'delta',
//     timescaleUnitsToNextSample
// }

// interface Chunk {
//     startTimestamp,
//     samples,
//     offset?,
//     // In the case of a fragmented file, this indicates the position of the moof box pointing to the data in this chunk
//     moofOffset?
// }

export class Muxer {
  target;

  options;
  writer;
  ftypSize;
  mdat;

  videoTrack = null;
  audioTrack = null;
  creationTime = Math.floor(Date.now() / 1000) + TIMESTAMP_OFFSET;
  finalizedChunks = [];

  // Fields for fragmented MP4:
  nextFragmentNumber = 1;
  videoSampleQueue = [];
  audioSampleQueue = [];

  finalized = false;

  constructor(options) {
    this.validateOptions(options);

    // Don't want these to be modified from the outside while processing:
    options.video = deepClone(options.video);
    options.audio = deepClone(options.audio);
    options.fastStart = deepClone(options.fastStart);

    this.target = options.target;
    this.options = {
      firstTimestampBehavior: 'strict',
      ...options,
    };

    if (options.target instanceof ArrayBufferTarget) {
      this.writer = new ArrayBufferTargetWriter(options.target);
    } else if (options.target instanceof StreamTarget) {
      this.writer = options.target.options?.chunked ?
                new ChunkedStreamTargetWriter(options.target) :
                new StreamTargetWriter(options.target);
    } else if (options.target instanceof FileSystemWritableFileStreamTarget) {
      this.writer = new FileSystemWritableFileStreamTargetWriter(options.target);
    } else {
      throw new Error(`Invalid target: ${options.target}`);
    }

    this.prepareTracks();
    this.writeHeader();
  }

  validateOptions(options) {
    if (typeof options !== 'object') {
      throw new TypeError('The muxer requires an options object to be passed to its constructor.');
    }

    if (!(options.target instanceof Target)) {
      throw new TypeError('The target must be provided and an instance of Target.');
    }

    if (options.video) {
      if (!SUPPORTED_VIDEO_CODECS.includes(options.video.codec)) {
        throw new TypeError(`Unsupported video codec: ${options.video.codec}`);
      }

      if (!Number.isInteger(options.video.width) || options.video.width <= 0) {
        throw new TypeError(`Invalid video width: ${options.video.width}. Must be a positive integer.`);
      }

      if (!Number.isInteger(options.video.height) || options.video.height <= 0) {
        throw new TypeError(`Invalid video height: ${options.video.height}. Must be a positive integer.`);
      }

      const videoRotation = options.video.rotation;
      if (typeof videoRotation === 'number' && ![0, 90, 180, 270].includes(videoRotation)) {
        throw new TypeError(`Invalid video rotation: ${videoRotation}. Has to be 0, 90, 180 or 270.`);
      } else if (
        Array.isArray(videoRotation) &&
                (videoRotation.length !== 9 || videoRotation.some((value) => typeof value !== 'number'))
      ) {
        throw new TypeError(`Invalid video transformation matrix: ${videoRotation.join()}`);
      }

      if (
        options.video.frameRate !== undefined &&
                (!Number.isInteger(options.video.frameRate) || options.video.frameRate <= 0)
      ) {
        throw new TypeError(
            `Invalid video frame rate: ${options.video.frameRate}. Must be a positive integer.`,
        );
      }
    }

    if (options.audio) {
      if (!SUPPORTED_AUDIO_CODECS.includes(options.audio.codec)) {
        throw new TypeError(`Unsupported audio codec: ${options.audio.codec}`);
      }

      if (!Number.isInteger(options.audio.numberOfChannels) || options.audio.numberOfChannels <= 0) {
        throw new TypeError(
            `Invalid number of audio channels: ${options.audio.numberOfChannels}. Must be a positive integer.`,
        );
      }

      if (!Number.isInteger(options.audio.sampleRate) || options.audio.sampleRate <= 0) {
        throw new TypeError(
            `Invalid audio sample rate: ${options.audio.sampleRate}. Must be a positive integer.`,
        );
      }
    }

    if (options.firstTimestampBehavior && !FIRST_TIMESTAMP_BEHAVIORS.includes(options.firstTimestampBehavior)) {
      throw new TypeError(`Invalid first timestamp behavior: ${options.firstTimestampBehavior}`);
    }

    if (typeof options.fastStart === 'object') {
      if (options.video) {
        if (options.fastStart.expectedVideoChunks === undefined) {
          throw new TypeError(`'fastStart' is an object but is missing property 'expectedVideoChunks'.`);
        } else if (
          !Number.isInteger(options.fastStart.expectedVideoChunks) ||
                    options.fastStart.expectedVideoChunks < 0
        ) {
          throw new TypeError(`'expectedVideoChunks' must be a non-negative integer.`);
        }
      }

      if (options.audio) {
        if (options.fastStart.expectedAudioChunks === undefined) {
          throw new TypeError(`'fastStart' is an object but is missing property 'expectedAudioChunks'.`);
        } else if (
          !Number.isInteger(options.fastStart.expectedAudioChunks) ||
                    options.fastStart.expectedAudioChunks < 0
        ) {
          throw new TypeError(`'expectedAudioChunks' must be a non-negative integer.`);
        }
      }
    } else if (![false, 'in-memory', 'fragmented'].includes(options.fastStart)) {
      throw new TypeError(`'fastStart' option must be false, 'in-memory', 'fragmented' or an object.`);
    }
  }

  writeHeader() {
    this.writer.writeBox(ftyp({
      holdsAvc: this.options.video?.codec === 'avc',
      fragmented: this.options.fastStart === 'fragmented',
    }));

    this.ftypSize = this.writer.pos;

    if (this.options.fastStart === 'in-memory') {
      this.mdat = mdat(false);
    } else if (this.options.fastStart === 'fragmented') {
      // We write the moov box once we write out the first fragment to make sure we get the decoder configs
    } else {
      if (typeof this.options.fastStart === 'object') {
        const moovSizeUpperBound = this.computeMoovSizeUpperBound();
        this.writer.seek(this.writer.pos + moovSizeUpperBound);
      }

      this.mdat = mdat(true); // Reserve large size by default, can refine this when finalizing.
      this.writer.writeBox(this.mdat);
    }

    this.maybeFlushStreamingTargetWriter();
  }

  computeMoovSizeUpperBound() {
    if (typeof this.options.fastStart !== 'object') return;

    let upperBound = 0;
    const sampleCounts = [
      this.options.fastStart.expectedVideoChunks,
      this.options.fastStart.expectedAudioChunks,
    ];

    for (const n of sampleCounts) {
      if (!n) continue;

      // Given the max allowed sample count, compute the space they'll take up in the Sample Table Box, assuming
      // the worst case for each individual box:

      // stts box - since it is compactly coded, the maximum length of this table will be 2/3n
      upperBound += (4 + 4) * Math.ceil(2/3 * n);
      // stss box - 1 entry per sample
      upperBound += 4 * n;
      // stsc box - since it is compactly coded, the maximum length of this table will be 2/3n
      upperBound += (4 + 4 + 4) * Math.ceil(2/3 * n);
      // stsz box - 1 entry per sample
      upperBound += 4 * n;
      // co64 box - we assume 1 sample per chunk and 64-bit chunk offsets
      upperBound += 8 * n;
    }

    upperBound += 4096; // Assume a generous 4 kB for everything else: Track metadata, codec descriptors, etc.

    return upperBound;
  }

  prepareTracks() {
    if (this.options.video) {
      this.videoTrack = {
        id: 1,
        info: {
          type: 'video',
          codec: this.options.video.codec,
          width: this.options.video.width,
          height: this.options.video.height,
          rotation: this.options.video.rotation ?? 0,
          decoderConfig: null,
        },
        // The fallback contains many common frame rates as factors
        timescale: this.options.video.frameRate ?? 57600,
        samples: [],
        finalizedChunks: [],
        currentChunk: null,
        firstDecodeTimestamp: undefined,
        lastDecodeTimestamp: -1,
        timeToSampleTable: [],
        compositionTimeOffsetTable: [],
        lastTimescaleUnits: null,
        lastSample: null,
        compactlyCodedChunkTable: [],
      };
    }

    if (this.options.audio) {
      this.audioTrack = {
        id: this.options.video ? 2 : 1,
        info: {
          type: 'audio',
          codec: this.options.audio.codec,
          numberOfChannels: this.options.audio.numberOfChannels,
          sampleRate: this.options.audio.sampleRate,
          decoderConfig: null,
        },
        timescale: this.options.audio.sampleRate,
        samples: [],
        finalizedChunks: [],
        currentChunk: null,
        firstDecodeTimestamp: undefined,
        lastDecodeTimestamp: -1,
        timeToSampleTable: [],
        compositionTimeOffsetTable: [],
        lastTimescaleUnits: null,
        lastSample: null,
        compactlyCodedChunkTable: [],
      };

      if (this.options.audio.codec === 'aac') {
        // For the case that we don't get any further decoder details, we can still make an educated guess:
        const guessedCodecPrivate = this.generateMpeg4AudioSpecificConfig(
            2, // Object type for AAC-LC, since it's the most common
            this.options.audio.sampleRate,
            this.options.audio.numberOfChannels,
        );

        this.audioTrack.info.decoderConfig = {
          codec: this.options.audio.codec,
          description: guessedCodecPrivate,
          numberOfChannels: this.options.audio.numberOfChannels,
          sampleRate: this.options.audio.sampleRate,
        };
      }
    }
  }

  // https://wiki.multimedia.cx/index.php/MPEG-4_Audio
  generateMpeg4AudioSpecificConfig(objectType, sampleRate, numberOfChannels) {
    const frequencyIndices =
            [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
    const frequencyIndex = frequencyIndices.indexOf(sampleRate);
    const channelConfig = numberOfChannels;

    let configBits = '';
    configBits += objectType.toString(2).padStart(5, '0');

    configBits += frequencyIndex.toString(2).padStart(4, '0');
    if (frequencyIndex === 15) configBits += sampleRate.toString(2).padStart(24, '0');

    configBits += channelConfig.toString(2).padStart(4, '0');

    // Pad with 0 bits to fit into a multiple of bytes
    const paddingLength = Math.ceil(configBits.length / 8) * 8;
    configBits = configBits.padEnd(paddingLength, '0');

    const configBytes = new Uint8Array(configBits.length / 8);
    for (let i = 0; i < configBits.length; i += 8) {
      configBytes[i / 8] = parseInt(configBits.slice(i, i + 8), 2);
    }

    return configBytes;
  }

  addVideoChunk(
      sample,
      meta,
      timestamp,
      compositionTimeOffset,
  ) {
    if (!(sample instanceof EncodedVideoChunk)) {
      throw new TypeError('addVideoChunk\'s first argument (sample) must be of type EncodedVideoChunk.');
    }
    if (meta && typeof meta !== 'object') {
      throw new TypeError('addVideoChunk\'s second argument (meta), when provided, must be an object.');
    }
    if (timestamp !== undefined && (!Number.isFinite(timestamp) || timestamp < 0)) {
      throw new TypeError(
          'addVideoChunk\'s third argument (timestamp), when provided, must be a non-negative real number.',
      );
    }
    if (compositionTimeOffset !== undefined && !Number.isFinite(compositionTimeOffset)) {
      throw new TypeError(
          'addVideoChunk\'s fourth argument (compositionTimeOffset), when provided, must be a real number.',
      );
    }

    const data = new Uint8Array(sample.byteLength);
    sample.copyTo(data);

    this.addVideoChunkRaw(
        data, sample.type, timestamp ?? sample.timestamp, sample.duration, meta, compositionTimeOffset,
    );
  }

  addVideoChunkRaw(
      data,
      type,
      timestamp,
      duration,
      meta,
      compositionTimeOffset,
  ) {
    if (!(data instanceof Uint8Array)) {
      throw new TypeError('addVideoChunkRaw\'s first argument (data) must be an instance of Uint8Array.');
    }
    if (type !== 'key' && type !== 'delta') {
      throw new TypeError('addVideoChunkRaw\'s second argument (type) must be either \'key\' or \'delta\'.');
    }
    if (!Number.isFinite(timestamp) || timestamp < 0) {
      throw new TypeError('addVideoChunkRaw\'s third argument (timestamp) must be a non-negative real number.');
    }
    if (!Number.isFinite(duration) || duration < 0) {
      throw new TypeError('addVideoChunkRaw\'s fourth argument (duration) must be a non-negative real number.');
    }
    if (meta && typeof meta !== 'object') {
      throw new TypeError('addVideoChunkRaw\'s fifth argument (meta), when provided, must be an object.');
    }
    if (compositionTimeOffset !== undefined && !Number.isFinite(compositionTimeOffset)) {
      throw new TypeError(
          'addVideoChunkRaw\'s sixth argument (compositionTimeOffset), when provided, must be a real number.',
      );
    }

    this.ensureNotFinalized();
    if (!this.options.video) throw new Error('No video track declared.');

    if (
      typeof this.options.fastStart === 'object' &&
            this.videoTrack.samples.length === this.options.fastStart.expectedVideoChunks
    ) {
      throw new Error(`Cannot add more video chunks than specified in 'fastStart' (${
        this.options.fastStart.expectedVideoChunks
      }).`);
    }

    const videoSample = this.createSampleForTrack(
        this.videoTrack, data, type, timestamp, duration, meta, compositionTimeOffset,
    );

    // Check if we need to interleave the samples in the case of a fragmented file
    if (this.options.fastStart === 'fragmented' && this.audioTrack) {
      // Add all audio samples with a timestamp smaller than the incoming video sample
      while (
        this.audioSampleQueue.length > 0 &&
                this.audioSampleQueue[0].decodeTimestamp <= videoSample.decodeTimestamp
      ) {
        const audioSample = this.audioSampleQueue.shift();
        this.addSampleToTrack(this.audioTrack, audioSample);
      }

      // Depending on the last audio sample, either add the video sample to the file or enqueue it
      if (videoSample.decodeTimestamp <= this.audioTrack.lastDecodeTimestamp) {
        this.addSampleToTrack(this.videoTrack, videoSample);
      } else {
        this.videoSampleQueue.push(videoSample);
      }
    } else {
      this.addSampleToTrack(this.videoTrack, videoSample);
    }
  }

  addAudioChunk(sample, meta, timestamp) {
    if (!(sample instanceof EncodedAudioChunk)) {
      throw new TypeError('addAudioChunk\'s first argument (sample) must be of type EncodedAudioChunk.');
    }
    if (meta && typeof meta !== 'object') {
      throw new TypeError('addAudioChunk\'s second argument (meta), when provided, must be an object.');
    }
    if (timestamp !== undefined && (!Number.isFinite(timestamp) || timestamp < 0)) {
      throw new TypeError(
          'addAudioChunk\'s third argument (timestamp), when provided, must be a non-negative real number.',
      );
    }

    const data = new Uint8Array(sample.byteLength);
    sample.copyTo(data);

    this.addAudioChunkRaw(data, sample.type, timestamp ?? sample.timestamp, sample.duration, meta);
  }

  addAudioChunkRaw(
      data,
      type,
      timestamp,
      duration,
      meta,
  ) {
    if (!(data instanceof Uint8Array)) {
      throw new TypeError('addAudioChunkRaw\'s first argument (data) must be an instance of Uint8Array.');
    }
    if (type !== 'key' && type !== 'delta') {
      throw new TypeError('addAudioChunkRaw\'s second argument (type) must be either \'key\' or \'delta\'.');
    }
    if (!Number.isFinite(timestamp) || timestamp < 0) {
      throw new TypeError('addAudioChunkRaw\'s third argument (timestamp) must be a non-negative real number.');
    }
    if (!Number.isFinite(duration) || duration < 0) {
      throw new TypeError('addAudioChunkRaw\'s fourth argument (duration) must be a non-negative real number.');
    }
    if (meta && typeof meta !== 'object') {
      throw new TypeError('addAudioChunkRaw\'s fifth argument (meta), when provided, must be an object.');
    }

    this.ensureNotFinalized();
    if (!this.options.audio) throw new Error('No audio track declared.');

    if (
      typeof this.options.fastStart === 'object' &&
            this.audioTrack.samples.length === this.options.fastStart.expectedAudioChunks
    ) {
      throw new Error(`Cannot add more audio chunks than specified in 'fastStart' (${
        this.options.fastStart.expectedAudioChunks
      }).`);
    }

    const audioSample = this.createSampleForTrack(this.audioTrack, data, type, timestamp, duration, meta);

    // Check if we need to interleave the samples in the case of a fragmented file
    if (this.options.fastStart === 'fragmented' && this.videoTrack) {
      // Add all video samples with a timestamp smaller than the incoming audio sample
      while (
        this.videoSampleQueue.length > 0 &&
                this.videoSampleQueue[0].decodeTimestamp <= audioSample.decodeTimestamp
      ) {
        const videoSample = this.videoSampleQueue.shift();
        this.addSampleToTrack(this.videoTrack, videoSample);
      }

      // Depending on the last video sample, either add the audio sample to the file or enqueue it
      if (audioSample.decodeTimestamp <= this.videoTrack.lastDecodeTimestamp) {
        this.addSampleToTrack(this.audioTrack, audioSample);
      } else {
        this.audioSampleQueue.push(audioSample);
      }
    } else {
      this.addSampleToTrack(this.audioTrack, audioSample);
    }
  }

  createSampleForTrack(
      track,
      data,
      type,
      timestamp,
      duration,
      meta,
      compositionTimeOffset,
  ) {
    let presentationTimestampInSeconds = timestamp / 1e6;
    let decodeTimestampInSeconds = (timestamp - (compositionTimeOffset ?? 0)) / 1e6;
    const durationInSeconds = duration / 1e6;

    const adjusted = this.validateTimestamp(presentationTimestampInSeconds, decodeTimestampInSeconds, track);
    presentationTimestampInSeconds = adjusted.presentationTimestamp;
    decodeTimestampInSeconds = adjusted.decodeTimestamp;

    if (meta?.decoderConfig) {
      if (track.info.decoderConfig === null) {
        track.info.decoderConfig = meta.decoderConfig;
      } else {
        Object.assign(track.info.decoderConfig, meta.decoderConfig);
      }
    }

    const sample = {
      presentationTimestamp: presentationTimestampInSeconds,
      decodeTimestamp: decodeTimestampInSeconds,
      duration: durationInSeconds,
      data: data,
      size: data.byteLength,
      type: type,
      // Will be refined once the next sample comes in
      timescaleUnitsToNextSample: intoTimescale(durationInSeconds, track.timescale),
    };

    return sample;
  }

  addSampleToTrack(
      track,
      sample,
  ) {
    if (this.options.fastStart !== 'fragmented') {
      track.samples.push(sample);
    }

    const sampleCompositionTimeOffset =
            intoTimescale(sample.presentationTimestamp - sample.decodeTimestamp, track.timescale);

    if (track.lastTimescaleUnits !== null) {
      const timescaleUnits = intoTimescale(sample.decodeTimestamp, track.timescale, false);
      const delta = Math.round(timescaleUnits - track.lastTimescaleUnits);
      track.lastTimescaleUnits += delta;
      track.lastSample.timescaleUnitsToNextSample = delta;

      if (this.options.fastStart !== 'fragmented') {
        const lastTableEntry = last(track.timeToSampleTable);
        if (lastTableEntry.sampleCount === 1) {
          // If we hit this case, we're the second sample
          lastTableEntry.sampleDelta = delta;
          lastTableEntry.sampleCount++;
        } else if (lastTableEntry.sampleDelta === delta) {
          // Simply increment the count
          lastTableEntry.sampleCount++;
        } else {
          // The delta has changed, subtract one from the previous run and create a new run with the new delta
          lastTableEntry.sampleCount--;
          track.timeToSampleTable.push({
            sampleCount: 2,
            sampleDelta: delta,
          });
        }

        const lastCompositionTimeOffsetTableEntry = last(track.compositionTimeOffsetTable);
        if (lastCompositionTimeOffsetTableEntry.sampleCompositionTimeOffset === sampleCompositionTimeOffset) {
          // Simply increment the count
          lastCompositionTimeOffsetTableEntry.sampleCount++;
        } else {
          // The composition time offset has changed, so create a new entry with the new composition time
          // offset
          track.compositionTimeOffsetTable.push({
            sampleCount: 1,
            sampleCompositionTimeOffset: sampleCompositionTimeOffset,
          });
        }
      }
    } else {
      track.lastTimescaleUnits = 0;

      if (this.options.fastStart !== 'fragmented') {
        track.timeToSampleTable.push({
          sampleCount: 1,
          sampleDelta: intoTimescale(sample.duration, track.timescale),
        });
        track.compositionTimeOffsetTable.push({
          sampleCount: 1,
          sampleCompositionTimeOffset: sampleCompositionTimeOffset,
        });
      }
    }

    track.lastSample = sample;

    let beginNewChunk = false;
    if (!track.currentChunk) {
      beginNewChunk = true;
    } else {
      const currentChunkDuration = sample.presentationTimestamp - track.currentChunk.startTimestamp;

      if (this.options.fastStart === 'fragmented') {
        const mostImportantTrack = this.videoTrack ?? this.audioTrack;
        if (track === mostImportantTrack && sample.type === 'key' && currentChunkDuration >= 1.0) {
          beginNewChunk = true;
          this.finalizeFragment();
        }
      } else {
        beginNewChunk = currentChunkDuration >= 0.5; // Chunk is long enough, we need a new one
      }
    }

    if (beginNewChunk) {
      if (track.currentChunk) {
        this.finalizeCurrentChunk(track);
      }

      track.currentChunk = {
        startTimestamp: sample.presentationTimestamp,
        samples: [],
      };
    }

    track.currentChunk.samples.push(sample);
  }

  validateTimestamp(presentationTimestamp, decodeTimestamp, track) {
    // Check first timestamp behavior
    const strictTimestampBehavior = this.options.firstTimestampBehavior === 'strict';
    const noLastDecodeTimestamp = track.lastDecodeTimestamp === -1;
    const timestampNonZero = decodeTimestamp !== 0;
    if (strictTimestampBehavior && noLastDecodeTimestamp && timestampNonZero) {
      throw new Error(
          `The first chunk for your media track must have a timestamp of 0 (received DTS=${decodeTimestamp}).` +
                `Non-zero first timestamps are often caused by directly piping frames or audio data from a ` +
                `MediaStreamTrack into the encoder. Their timestamps are typically relative to the age of the` +
                `document, which is probably what you want.\n\nIf you want to offset all timestamps of a track such ` +
                `that the first one is zero, set firstTimestampBehavior: 'offset' in the options.\n`,
      );
    } else if (
      this.options.firstTimestampBehavior === 'offset' ||
            this.options.firstTimestampBehavior === 'cross-track-offset'
    ) {
      if (track.firstDecodeTimestamp === undefined) {
        track.firstDecodeTimestamp = decodeTimestamp;
      }

      let baseDecodeTimestamp;
      if (this.options.firstTimestampBehavior === 'offset') {
        baseDecodeTimestamp = track.firstDecodeTimestamp;
      } else {
        // Since each track may have its firstDecodeTimestamp set independently, but the tracks' timestamps come
        // from the same clock, we should subtract the earlier of the (up to) two tracks' first timestamps to
        // ensure A/V sync.
        baseDecodeTimestamp = Math.min(
            this.videoTrack?.firstDecodeTimestamp ?? Infinity,
            this.audioTrack?.firstDecodeTimestamp ?? Infinity,
        );
      }

      decodeTimestamp -= baseDecodeTimestamp;
      presentationTimestamp -= baseDecodeTimestamp;
    }

    if (decodeTimestamp < track.lastDecodeTimestamp) {
      throw new Error(
          `Timestamps must be monotonically increasing ` +
                `(DTS went from ${track.lastDecodeTimestamp * 1e6} to ${decodeTimestamp * 1e6}).`,
      );
    }

    track.lastDecodeTimestamp = decodeTimestamp;

    return {presentationTimestamp, decodeTimestamp};
  }

  finalizeCurrentChunk(track) {
    if (this.options.fastStart === 'fragmented') {
      throw new Error('Can\'t finalize individual chunks if \'fastStart\' is set to \'fragmented\'.');
    }

    if (!track.currentChunk) return;

    track.finalizedChunks.push(track.currentChunk);
    this.finalizedChunks.push(track.currentChunk);

    if (
      track.compactlyCodedChunkTable.length === 0 ||
            last(track.compactlyCodedChunkTable).samplesPerChunk !== track.currentChunk.samples.length
    ) {
      track.compactlyCodedChunkTable.push({
        firstChunk: track.finalizedChunks.length, // 1-indexed
        samplesPerChunk: track.currentChunk.samples.length,
      });
    }

    if (this.options.fastStart === 'in-memory') {
      track.currentChunk.offset = 0; // We'll compute the proper offset when finalizing
      return;
    }

    // Write out the data
    track.currentChunk.offset = this.writer.pos;
    for (const sample of track.currentChunk.samples) {
      this.writer.write(sample.data);
      sample.data = null; // Can be GC'd
    }

    this.maybeFlushStreamingTargetWriter();
  }

  finalizeFragment(flushStreamingWriter = true) {
    if (this.options.fastStart !== 'fragmented') {
      throw new Error('Can\'t finalize a fragment unless \'fastStart\' is set to \'fragmented\'.');
    }

    const tracks = [this.videoTrack, this.audioTrack].filter((track) => track && track.currentChunk);
    if (tracks.length === 0) return;

    const fragmentNumber = this.nextFragmentNumber++;

    if (fragmentNumber === 1) {
      // Write the moov box now that we have all decoder configs
      const movieBox = moov(tracks, this.creationTime, true);
      this.writer.writeBox(movieBox);
    }

    // Write out an initial moof box; will be overwritten later once actual chunk offsets are known
    const moofOffset = this.writer.pos;
    const moofBox = moof(fragmentNumber, tracks);
    this.writer.writeBox(moofBox);

    // Create the mdat box
    {
      const mdatBox = mdat(false); // Initially assume no fragment is larger than 4 GiB
      let totalTrackSampleSize = 0;

      // Compute the size of the mdat box
      for (const track of tracks) {
        for (const sample of track.currentChunk.samples) {
          totalTrackSampleSize += sample.size;
        }
      }

      let mdatSize = this.writer.measureBox(mdatBox) + totalTrackSampleSize;
      if (mdatSize >= 2**32) {
        // Fragment is larger than 4 GiB, we need to use the large size
        mdatBox.largeSize = true;
        mdatSize = this.writer.measureBox(mdatBox) + totalTrackSampleSize;
      }

      mdatBox.size = mdatSize;
      this.writer.writeBox(mdatBox);
    }

    // Write sample data
    for (const track of tracks) {
      track.currentChunk.offset = this.writer.pos;
      track.currentChunk.moofOffset = moofOffset;

      for (const sample of track.currentChunk.samples) {
        this.writer.write(sample.data);
        sample.data = null; // Can be GC'd
      }
    }

    // Now that we set the actual chunk offsets, fix the moof box
    const endPos = this.writer.pos;
    this.writer.seek(this.writer.offsets.get(moofBox));
    const newMoofBox = moof(fragmentNumber, tracks);
    this.writer.writeBox(newMoofBox);
    this.writer.seek(endPos);

    for (const track of tracks) {
      track.finalizedChunks.push(track.currentChunk);
      this.finalizedChunks.push(track.currentChunk);
      track.currentChunk = null;
    }

    if (flushStreamingWriter) {
      this.maybeFlushStreamingTargetWriter();
    }
  }

  maybeFlushStreamingTargetWriter() {
    if (this.writer instanceof StreamTargetWriter) {
      this.writer.flush();
    }
  }

  ensureNotFinalized() {
    if (this.finalized) {
      throw new Error('Cannot add new video or audio chunks after the file has been finalized.');
    }
  }

  /** Finalizes the file, making it ready for use. Must be called after all video and audio chunks have been added. */
  finalize() {
    if (this.finalized) {
      throw new Error('Cannot finalize a muxer more than once.');
    }

    if (this.options.fastStart === 'fragmented') {
      for (const videoSample of this.videoSampleQueue) this.addSampleToTrack(this.videoTrack, videoSample);
      for (const audioSample of this.audioSampleQueue) this.addSampleToTrack(this.audioTrack, audioSample);

      this.finalizeFragment(false); // Don't flush the last fragment as we will flush it with the mfra box soon
    } else {
      if (this.videoTrack) this.finalizeCurrentChunk(this.videoTrack);
      if (this.audioTrack) this.finalizeCurrentChunk(this.audioTrack);
    }

    const tracks = [this.videoTrack, this.audioTrack].filter(Boolean);

    if (this.options.fastStart === 'in-memory') {
      let mdatSize;

      // We know how many chunks there are, but computing the chunk positions requires an iterative approach:
      // In order to know where the first chunk should go, we first need to know the size of the moov box. But we
      // cannot write a proper moov box without first knowing all chunk positions. So, we generate a tentative
      // moov box with placeholder values (0) for the chunk offsets to be able to compute its size. If it then
      // turns out that appending all chunks exceeds 4 GiB, we need to repeat this process, now with the co64 box
      // being used in the moov box instead, which will make it larger. After that, we definitely know the final
      // size of the moov box and can compute the proper chunk positions.

      for (let i = 0; i < 2; i++) {
        const movieBox = moov(tracks, this.creationTime);
        const movieBoxSize = this.writer.measureBox(movieBox);
        mdatSize = this.writer.measureBox(this.mdat);
        let currentChunkPos = this.writer.pos + movieBoxSize + mdatSize;

        for (const chunk of this.finalizedChunks) {
          chunk.offset = currentChunkPos;
          for (const {data} of chunk.samples) {
            currentChunkPos += data.byteLength;
            mdatSize += data.byteLength;
          }
        }

        if (currentChunkPos < 2**32) break;
        if (mdatSize >= 2**32) this.mdat.largeSize = true;
      }

      const movieBox = moov(tracks, this.creationTime);
      this.writer.writeBox(movieBox);

      this.mdat.size = mdatSize;
      this.writer.writeBox(this.mdat);

      for (const chunk of this.finalizedChunks) {
        for (const sample of chunk.samples) {
          this.writer.write(sample.data);
          sample.data = null;
        }
      }
    } else if (this.options.fastStart === 'fragmented') {
      // Append the mfra box to the end of the file for better random access
      const startPos = this.writer.pos;
      const mfraBox = mfra(tracks);
      this.writer.writeBox(mfraBox);

      // Patch the 'size' field of the mfro box at the end of the mfra box now that we know its actual size
      const mfraBoxSize = this.writer.pos - startPos;
      this.writer.seek(this.writer.pos - 4);
      this.writer.writeU32(mfraBoxSize);
    } else {
      const mdatPos = this.writer.offsets.get(this.mdat);
      const mdatSize = this.writer.pos - mdatPos;
      this.mdat.size = mdatSize;
      this.mdat.largeSize = mdatSize >= 2**32; // Only use the large size if we need it
      this.writer.patchBox(this.mdat);

      const movieBox = moov(tracks, this.creationTime);

      if (typeof this.options.fastStart === 'object') {
        this.writer.seek(this.ftypSize);
        this.writer.writeBox(movieBox);

        const remainingBytes = mdatPos - this.writer.pos;
        this.writer.writeBox(free(remainingBytes));
      } else {
        this.writer.writeBox(movieBox);
      }
    }

    this.maybeFlushStreamingTargetWriter();
    this.writer.finalize();

    this.finalized = true;
  }
}
