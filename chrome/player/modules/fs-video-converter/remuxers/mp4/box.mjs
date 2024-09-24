/* eslint-disable valid-jsdoc */
import {
  GLOBAL_TIMESCALE,
} from './muxer.mjs';

import {
  ascii,
  i16,
  i32,
  intoTimescale,
  last,
  lastPresentedSample,
  u16,
  u64,
  u8,
  u32,
  fixed_16_16,
  fixed_8_8,
  u24,
  IDENTITY_MATRIX,
  matrixToBytes,
  rotationMatrix,
  isU32,
} from './misc.mjs';

// export interface Box {
// type: string,
// contents?: Uint8Array,
// children?: Box[],
// size?,
// largeSize?: boolean
// }

export const box = (type, contents, children) => ({
  type,
  contents: contents && new Uint8Array(contents.flat(10)),
  children,
});

/** A FullBox always starts with a version byte, followed by three flag bytes. */
export const fullBox = (
    type,
    version,
    flags,
    contents,
    children,
) => box(
    type,
    [u8(version), u24(flags), contents ?? []],
    children,
);

/**
 * File Type Compatibility Box: Allows the reader to determine whether this is a type of file that the
 * reader understands.
 */
export const ftyp = (details) => {
  // You can find the full logic for this at
  // https://github.com/FFmpeg/FFmpeg/blob/de2fb43e785773738c660cdafb9309b1ef1bc80d/libavformat/movenc.cL5518
  // Obviously, this lib only needs a small subset of that logic.

  const minorVersion = 0x200;

  if (details.fragmented) {
    return box('ftyp', [
      ascii('iso5'), // Major brand
      u32(minorVersion), // Minor version
      // Compatible brands
      ascii('iso5'),
      ascii('iso6'),
      ascii('mp41'),
    ]);
  }

  return box('ftyp', [
    ascii('isom'), // Major brand
    u32(minorVersion), // Minor version
    // Compatible brands
    ascii('isom'),
    details.holdsAvc ? ascii('avc1') : [],
    ascii('mp41'),
  ]);
};

/** Movie Sample Data Box. Contains the actual frames/samples of the media. */
export const mdat = (reserveLargeSize) => ({type: 'mdat', largeSize: reserveLargeSize});

/** Free Space Box: A box that designates unused space in the movie data file. */
export const free = (size) => ({type: 'free', size});

/**
 * Movie Box: Used to specify the information that defines a movie - that is, the information that allows
 * an application to interpret the sample data that is stored elsewhere.
 */
export const moov = (tracks, creationTime, fragmented = false) => box('moov', null, [
  mvhd(creationTime, tracks),
  ...tracks.map((x) => trak(x, creationTime)),
    fragmented ? mvex(tracks) : null,
]);

/** Movie Header Box: Used to specify the characteristics of the entire movie, such as timescale and duration. */
export const mvhd = (
    creationTime,
    tracks,
) => {
  const duration = intoTimescale(Math.max(
      0,
      ...tracks.
          filter((x) => x.samples.length > 0).
          map((x) => {
            const lastSample = lastPresentedSample(x.samples);
            return lastSample.presentationTimestamp + lastSample.duration;
          }),
  ), GLOBAL_TIMESCALE);
  const nextTrackId = Math.max(...tracks.map((x) => x.id)) + 1;

  // Conditionally use u64 if u32 isn't enough
  const needsU64 = !isU32(creationTime) || !isU32(duration);
  const u32OrU64 = needsU64 ? u64 : u32;

  return fullBox('mvhd', +needsU64, 0, [
    u32OrU64(creationTime), // Creation time
    u32OrU64(creationTime), // Modification time
    u32(GLOBAL_TIMESCALE), // Timescale
    u32OrU64(duration), // Duration
    fixed_16_16(1), // Preferred rate
    fixed_8_8(1), // Preferred volume
    Array(10).fill(0), // Reserved
    matrixToBytes(IDENTITY_MATRIX), // Matrix
    Array(24).fill(0), // Pre-defined
    u32(nextTrackId), // Next track ID
  ]);
};

/**
 * Track Box: Defines a single track of a movie. A movie may consist of one or more tracks. Each track is
 * independent of the other tracks in the movie and carries its own temporal and spatial information. Each Track Box
 * contains its associated Media Box.
 */
export const trak = (track, creationTime) => box('trak', null, [
  tkhd(track, creationTime),
  mdia(track, creationTime),
]);

/** Track Header Box: Specifies the characteristics of a single track within a movie. */
export const tkhd = (
    track,
    creationTime,
) => {
  const lastSample = lastPresentedSample(track.samples);
  const durationInGlobalTimescale = intoTimescale(
        lastSample ? lastSample.presentationTimestamp + lastSample.duration : 0,
        GLOBAL_TIMESCALE,
  );

  const needsU64 = !isU32(creationTime) || !isU32(durationInGlobalTimescale);
  const u32OrU64 = needsU64 ? u64 : u32;

  let matrix;
  if (track.info.type === 'video') {
    matrix = typeof track.info.rotation === 'number' ? rotationMatrix(track.info.rotation) : track.info.rotation;
  } else {
    matrix = IDENTITY_MATRIX;
  }

  const original_matrix = track.info.matrix_structure;
  if (original_matrix) {
    // If the matrix structure is provided, do matrix multiplication
    // 3x3 matrix multiplication with rotation matrix
    // M_new = M_original * M_rotation
    matrix = [
      original_matrix[0] * matrix[0] + original_matrix[1] * matrix[3] + original_matrix[2] * matrix[6],
      original_matrix[0] * matrix[1] + original_matrix[1] * matrix[4] + original_matrix[2] * matrix[7],
      original_matrix[0] * matrix[2] + original_matrix[1] * matrix[5] + original_matrix[2] * matrix[8],
      original_matrix[3] * matrix[0] + original_matrix[4] * matrix[3] + original_matrix[5] * matrix[6],
      original_matrix[3] * matrix[1] + original_matrix[4] * matrix[4] + original_matrix[5] * matrix[7],
      original_matrix[3] * matrix[2] + original_matrix[4] * matrix[5] + original_matrix[5] * matrix[8],
      original_matrix[6] * matrix[0] + original_matrix[7] * matrix[3] + original_matrix[8] * matrix[6],
      original_matrix[6] * matrix[1] + original_matrix[7] * matrix[4] + original_matrix[8] * matrix[7],
      original_matrix[6] * matrix[2] + original_matrix[7] * matrix[5] + original_matrix[8] * matrix[8],
    ];
  }

  return fullBox('tkhd', +needsU64, 3, [
    u32OrU64(creationTime), // Creation time
    u32OrU64(creationTime), // Modification time
    u32(track.id), // Track ID
    u32(0), // Reserved
    u32OrU64(durationInGlobalTimescale), // Duration
    Array(8).fill(0), // Reserved
    u16(0), // Layer
    u16(0), // Alternate group
    fixed_8_8(track.info.type === 'audio' ? 1 : 0), // Volume
    u16(0), // Reserved
    matrixToBytes(matrix), // Matrix
    fixed_16_16(track.info.type === 'video' ? track.info.width : 0), // Track width
    fixed_16_16(track.info.type === 'video' ? track.info.height : 0), // Track height
  ]);
};

/** Media Box: Describes and define a track's media type and sample data. */
export const mdia = (track, creationTime) => box('mdia', null, [
  mdhd(track, creationTime),
  hdlr(track.info.type === 'video' ? 'vide' : 'soun'),
  minf(track),
]);

/** Media Header Box: Specifies the characteristics of a media, including timescale and duration. */
export const mdhd = (
    track,
    creationTime,
) => {
  const lastSample = lastPresentedSample(track.samples);
  const localDuration = intoTimescale(
        lastSample ? lastSample.presentationTimestamp + lastSample.duration : 0,
        track.timescale,
  );

  const needsU64 = !isU32(creationTime) || !isU32(localDuration);
  const u32OrU64 = needsU64 ? u64 : u32;

  return fullBox('mdhd', +needsU64, 0, [
    u32OrU64(creationTime), // Creation time
    u32OrU64(creationTime), // Modification time
    u32(track.timescale), // Timescale
    u32OrU64(localDuration), // Duration
    u16(0b01010101_11000100), // Language ("und", undetermined)
    u16(0), // Quality
  ]);
};

/** Handler Reference Box: Specifies the media handler component that is to be used to interpret the media's data. */
export const hdlr = (componentSubtype) => fullBox('hdlr', 0, 0, [
  ascii('mhlr'), // Component type
  ascii(componentSubtype), // Component subtype
  u32(0), // Component manufacturer
  u32(0), // Component flags
  u32(0), // Component flags mask
  ascii('fs-hdlr', true), // Component name
]);

/**
 * Media Information Box: Stores handler-specific information for a track's media data. The media handler uses this
 * information to map from media time to media data and to process the media data.
 */
export const minf = (track) => box('minf', null, [
    track.info.type === 'video' ? vmhd() : smhd(),
    dinf(),
    stbl(track),
]);

/** Video Media Information Header Box: Defines specific color and graphics mode information. */
export const vmhd = () => fullBox('vmhd', 0, 1, [
  u16(0), // Graphics mode
  u16(0), // Opcolor R
  u16(0), // Opcolor G
  u16(0), // Opcolor B
]);

/** Sound Media Information Header Box: Stores the sound media's control information, such as balance. */
export const smhd = () => fullBox('smhd', 0, 0, [
  u16(0), // Balance
  u16(0), // Reserved
]);

/**
 * Data Information Box: Contains information specifying the data handler component that provides access to the
 * media data. The data handler component uses the Data Information Box to interpret the media's data.
 */
export const dinf = () => box('dinf', null, [
  dref(),
]);

/**
 * Data Reference Box: Contains tabular data that instructs the data handler component how to access the media's data.
 */
export const dref = () => fullBox('dref', 0, 0, [
  u32(1), // Entry count
], [
  url(),
]);

export const url = () => fullBox('url ', 0, 1); // Self-reference flag enabled

/**
 * Sample Table Box: Contains information for converting from media time to sample number to sample location. This box
 * also indicates how to interpret the sample (for example, whether to decompress the video data and, if so, how).
 */
export const stbl = (track) => {
  const needsCtts = track.compositionTimeOffsetTable.length > 1 ||
        track.compositionTimeOffsetTable.some((x) => x.sampleCompositionTimeOffset !== 0);

  return box('stbl', null, [
    stsd(track),
    stts(track),
    stss(track),
    stsc(track),
    stsz(track),
    stco(track),
        needsCtts ? ctts(track) : null,
  ]);
};

/**
 * Sample Description Box: Stores information that allows you to decode samples in the media. The data stored in the
 * sample description varies, depending on the media type.
 */
export const stsd = (track) => fullBox('stsd', 0, 0, [
  u32(1), // Entry count
], [
    track.info.type === 'video' ?
        videoSampleDescription(
            VIDEO_CODEC_TO_BOX_NAME[track.info.codec],
            track,
        ) :
        soundSampleDescription(
            AUDIO_CODEC_TO_BOX_NAME[track.info.codec],
            track,
        ),
]);

export const pasp = (track) => {
  if (track.info.pixelAspectRatio === undefined) {
    return null;
  }

  return fullBox('pasp', 0, 0, [
    u32(track.info.pixelAspectRatio.numerator), // Horizontal spacing
    u32(track.info.pixelAspectRatio.denominator), // Vertical spacing
  ]);
};

/** Video Sample Description Box: Contains information that defines how to interpret video media data. */
export const videoSampleDescription = (
    compressionType,
    track,
) => box(compressionType, [
  Array(6).fill(0), // Reserved
  u16(1), // Data reference index
  u16(0), // Pre-defined
  u16(0), // Reserved
  Array(12).fill(0), // Pre-defined
  u16(track.info.width), // Width
  u16(track.info.height), // Height
  u32(0x00480000), // Horizontal resolution
  u32(0x00480000), // Vertical resolution
  u32(0), // Reserved
  u16(1), // Frame count
  Array(32).fill(0), // Compressor name
  u16(0x0018), // Depth
  i16(0xffff), // Pre-defined
], [
  VIDEO_CODEC_TO_CONFIGURATION_BOX[track.info.codec](track),
  pasp(track),
]);

/** AVC Configuration Box: Provides additional information to the decoder. */
export const avcC = (track) => track.info.decoderConfig && box('avcC', [
  // For AVC, description is an AVCDecoderConfigurationRecord, so nothing else to do here
  ...new Uint8Array(track.info.decoderConfig.description),
]);

/** HEVC Configuration Box: Provides additional information to the decoder. */
export const hvcC = (track) => track.info.decoderConfig && box('hvcC', [
  // For HEVC, description is a HEVCDecoderConfigurationRecord, so nothing else to do here
  ...new Uint8Array(track.info.decoderConfig.description),
]);

/** VP9 Configuration Box: Provides additional information to the decoder. */
export const vpcC = (track) => {
  // Reference: https://www.webmproject.org/vp9/mp4/

  if (!track.info.decoderConfig) {
    return null;
  }

  const decoderConfig = track.info.decoderConfig;
  if (!decoderConfig.colorSpace) {
    throw new Error(`'colorSpace' is required in the decoder config for VP9.`);
  }

  const parts = decoderConfig.codec.split('.');
  const profile = Number(parts[1]);
  const level = Number(parts[2]);

  const bitDepth = Number(parts[3]);
  const chromaSubsampling = 0;
  const thirdByte = (bitDepth << 4) + (chromaSubsampling << 1) + Number(decoderConfig.colorSpace.fullRange);

  // Set all to undetermined. We could determine them using the codec color space info, but there's no need.
  const colourPrimaries = 2;
  const transferCharacteristics = 2;
  const matrixCoefficients = 2;

  return fullBox('vpcC', 1, 0, [
    u8(profile), // Profile
    u8(level), // Level
    u8(thirdByte), // Bit depth, chroma subsampling, full range
    u8(colourPrimaries), // Colour primaries
    u8(transferCharacteristics), // Transfer characteristics
    u8(matrixCoefficients), // Matrix coefficients
    u16(0), // Codec initialization data size
  ]);
};

/** AV1 Configuration Box: Provides additional information to the decoder. */
export const av1C = () => {
  // Reference: https://aomediacodec.github.io/av1-isobmff/

  const marker = 1;
  const version = 1;
  const firstByte = (marker << 7) + version;

  // The box contents are not correct like this, but its length is. Getting the values for the last three bytes
  // requires peeking into the bitstream of the coded chunks. Might come back later.
  return box('av1C', [
    firstByte,
    0,
    0,
    0,
  ]);
};

/** Sound Sample Description Box: Contains information that defines how to interpret sound media data. */
export const soundSampleDescription = (
    compressionType,
    track,
) => box(compressionType, [
  Array(6).fill(0), // Reserved
  u16(1), // Data reference index
  u16(0), // Version
  u16(0), // Revision level
  u32(0), // Vendor
  u16(track.info.numberOfChannels), // Number of channels
  u16(16), // Sample size (bits)
  u16(0), // Compression ID
  u16(0), // Packet size
  fixed_16_16(track.info.sampleRate), // Sample rate
], [
  AUDIO_CODEC_TO_CONFIGURATION_BOX[track.info.codec](track),
]);

/** MPEG-4 Elementary Stream Descriptor Box. */
export const esds = (track) => {
  const description = new Uint8Array(track.info.decoderConfig.description);

  return fullBox('esds', 0, 0, [
    // https://stackoverflow.com/a/54803118
    u32(0x03808080), // TAG(3) = Object Descriptor ([2])
    u8(0x20 + description.byteLength), // length of this OD (which includes the next 2 tags)
    u16(1), // ES_ID = 1
    u8(0x00), // flags etc = 0
    u32(0x04808080), // TAG(4) = ES Descriptor ([2]) embedded in above OD
    u8(0x12 + description.byteLength), // length of this ESD
    u8(0x40), // MPEG-4 Audio
    u8(0x15), // stream type(6bits)=5 audio, flags(2bits)=1
    u24(0), // 24bit buffer size
    u32(0x0001FC17), // max bitrate
    u32(0x0001FC17), // avg bitrate
    u32(0x05808080), // TAG(5) = ASC ([2],[3]) embedded in above OD
    u8(description.byteLength), // length
    ...description,
    u32(0x06808080), // TAG(6)
    u8(0x01), // length
    u8(0x02), // data
  ]);
};

/** Opus Specific Box. */
export const dOps = (track) => {
  // Default PreSkip, should be at least 80 milliseconds worth of playback, measured in 48000 Hz samples
  let preskip = 3840;
  let gain = 0;

  // Read preskip and from codec private data from the encoder
  // https://www.rfc-editor.org/rfc/rfc7845section-5
  const description = track.info.decoderConfig?.description;
  if (description) {
    if (description.byteLength < 18) {
      throw new TypeError('Invalid decoder description provided for Opus; must be at least 18 bytes long.');
    }

    const view = ArrayBuffer.isView(description) ?
            new DataView(description.buffer, description.byteOffset, description.byteLength) :
            new DataView(description);
    preskip = view.getUint16(10, true);
    gain = view.getInt16(14, true);
  }

  return box('dOps', [
    u8(0), // Version
    u8(track.info.numberOfChannels), // OutputChannelCount
    u16(preskip),
    u32(track.info.sampleRate), // InputSampleRate
    fixed_8_8(gain), // OutputGain
    u8(0), // ChannelMappingFamily
  ]);
};

/**
 * Time-To-Sample Box: Stores duration information for a media's samples, providing a mapping from a time in a media
 * to the corresponding data sample. The table is compact, meaning that consecutive samples with the same time delta
 * will be grouped.
 */
export const stts = (track) => {
  return fullBox('stts', 0, 0, [
    u32(track.timeToSampleTable.length), // Number of entries
    track.timeToSampleTable.map((x) => [ // Time-to-sample table
      u32(x.sampleCount), // Sample count
      u32(x.sampleDelta), // Sample duration
    ]),
  ]);
};

/** Sync Sample Box: Identifies the key frames in the media, marking the random access points within a stream. */
export const stss = (track) => {
  if (track.samples.every((x) => x.type === 'key')) return null; // No stss box -> every frame is a key frame

  const keySamples = [...track.samples.entries()].filter(([, sample]) => sample.type === 'key');
  return fullBox('stss', 0, 0, [
    u32(keySamples.length), // Number of entries
    keySamples.map(([index]) => u32(index + 1)), // Sync sample table
  ]);
};

/**
 * Sample-To-Chunk Box: As samples are added to a media, they are collected into chunks that allow optimized data
 * access. A chunk contains one or more samples. Chunks in a media may have different sizes, and the samples within a
 * chunk may have different sizes. The Sample-To-Chunk Box stores chunk information for the samples in a media, stored
 * in a compactly-coded fashion.
 */
export const stsc = (track) => {
  return fullBox('stsc', 0, 0, [
    u32(track.compactlyCodedChunkTable.length), // Number of entries
    track.compactlyCodedChunkTable.map((x) => [ // Sample-to-chunk table
      u32(x.firstChunk), // First chunk
      u32(x.samplesPerChunk), // Samples per chunk
      u32(1), // Sample description index
    ]),
  ]);
};

/** Sample Size Box: Specifies the byte size of each sample in the media. */
export const stsz = (track) => fullBox('stsz', 0, 0, [
  u32(0), // Sample size (0 means non-constant size)
  u32(track.samples.length), // Number of entries
  track.samples.map((x) => u32(x.size)), // Sample size table
]);

/** Chunk Offset Box: Identifies the location of each chunk of data in the media's data stream, relative to the file. */
export const stco = (track) => {
  if (track.finalizedChunks.length > 0 && last(track.finalizedChunks).offset >= 2**32) {
    // If the file is large, use the co64 box
    return fullBox('co64', 0, 0, [
      u32(track.finalizedChunks.length), // Number of entries
      track.finalizedChunks.map((x) => u64(x.offset)), // Chunk offset table
    ]);
  }

  return fullBox('stco', 0, 0, [
    u32(track.finalizedChunks.length), // Number of entries
    track.finalizedChunks.map((x) => u32(x.offset)), // Chunk offset table
  ]);
};

/** Composition Time to Sample Box: Stores composition time offset information (PTS-DTS) for a
 * media's samples. The table is compact, meaning that consecutive samples with the same time
 * composition time offset will be grouped. */
export const ctts = (track) => {
  return fullBox('ctts', 0, 0, [
    u32(track.compositionTimeOffsetTable.length), // Number of entries
    track.compositionTimeOffsetTable.map((x) => [ // Time-to-sample table
      u32(x.sampleCount), // Sample count
      u32(x.sampleCompositionTimeOffset), // Sample offset
    ]),
  ]);
};

/**
 * Movie Extends Box: This box signals to readers that the file is fragmented. Contains a single Track Extends Box
 * for each track in the movie.
 */
export const mvex = (tracks) => {
  return box('mvex', null, tracks.map(trex));
};

/** Track Extends Box: Contains the default values used by the movie fragments. */
export const trex = (track) => {
  return fullBox('trex', 0, 0, [
    u32(track.id), // Track ID
    u32(1), // Default sample description index
    u32(0), // Default sample duration
    u32(0), // Default sample size
    u32(0), // Default sample flags
  ]);
};

/**
 * Movie Fragment Box: The movie fragments extend the presentation in time. They provide the information that would
 * previously have been    in the Movie Box.
 */
export const moof = (sequenceNumber, tracks) => {
  return box('moof', null, [
    mfhd(sequenceNumber),
    ...tracks.map(traf),
  ]);
};

/** Movie Fragment Header Box: Contains a sequence number as a safety check. */
export const mfhd = (sequenceNumber) => {
  return fullBox('mfhd', 0, 0, [
    u32(sequenceNumber), // Sequence number
  ]);
};

const fragmentSampleFlags = (sample) => {
  let byte1 = 0;
  let byte2 = 0;
  const byte3 = 0;
  const byte4 = 0;

  const sampleIsDifferenceSample = sample.type === 'delta';
  byte2 |= +sampleIsDifferenceSample;

  if (sampleIsDifferenceSample) {
    byte1 |= 1; // There is redundant coding in this sample
  } else {
    byte1 |= 2; // There is no redundant coding in this sample
  }

  // Note that there are a lot of other flags to potentially set here, but most are irrelevant / non-necessary
  return byte1 << 24 | byte2 << 16 | byte3 << 8 | byte4;
};

/** Track Fragment Box */
export const traf = (track) => {
  return box('traf', null, [
    tfhd(track),
    tfdt(track),
    trun(track),
  ]);
};

/** Track Fragment Header Box: Provides a reference to the extended track, and flags. */
export const tfhd = (track) => {
  let tfFlags = 0;
  tfFlags |= 0x00008; // Default sample duration present
  tfFlags |= 0x00010; // Default sample size present
  tfFlags |= 0x00020; // Default sample flags present
  tfFlags |= 0x20000; // Default base is moof

  // Prefer the second sample over the first one, as the first one is a sync sample and therefore the "odd one out"
  const referenceSample = track.currentChunk.samples[1] ?? track.currentChunk.samples[0];
  const referenceSampleInfo = {
    duration: referenceSample.timescaleUnitsToNextSample,
    size: referenceSample.size,
    flags: fragmentSampleFlags(referenceSample),
  };

  return fullBox('tfhd', 0, tfFlags, [
    u32(track.id), // Track ID
    u32(referenceSampleInfo.duration), // Default sample duration
    u32(referenceSampleInfo.size), // Default sample size
    u32(referenceSampleInfo.flags), // Default sample flags
  ]);
};

/**
 * Track Fragment Decode Time Box: Provides the absolute decode time of the first sample of the fragment. This is
 * useful for performing random access on the media file.
 */
export const tfdt = (track) => {
  return fullBox('tfdt', 1, 0, [
    u64(intoTimescale(track.currentChunk.startTimestamp, track.timescale)), // Base Media Decode Time
  ]);
};

/** Track Run Box: Specifies a run of contiguous samples for a given track. */
export const trun = (track) => {
  const allSampleDurations = track.currentChunk.samples.map((x) => x.timescaleUnitsToNextSample);
  const allSampleSizes = track.currentChunk.samples.map((x) => x.size);
  const allSampleFlags = track.currentChunk.samples.map(fragmentSampleFlags);
  const allSampleCompositionTimeOffsets = track.currentChunk.samples.
      map((x) => intoTimescale(x.presentationTimestamp - x.decodeTimestamp, track.timescale));

  const uniqueSampleDurations = new Set(allSampleDurations);
  const uniqueSampleSizes = new Set(allSampleSizes);
  const uniqueSampleFlags = new Set(allSampleFlags);
  const uniqueSampleCompositionTimeOffsets = new Set(allSampleCompositionTimeOffsets);

  const firstSampleFlagsPresent = uniqueSampleFlags.size === 2 && allSampleFlags[0] !== allSampleFlags[1];
  const sampleDurationPresent = uniqueSampleDurations.size > 1;
  const sampleSizePresent = uniqueSampleSizes.size > 1;
  const sampleFlagsPresent = !firstSampleFlagsPresent && uniqueSampleFlags.size > 1;
  const sampleCompositionTimeOffsetsPresent =
        uniqueSampleCompositionTimeOffsets.size > 1 || [...uniqueSampleCompositionTimeOffsets].some((x) => x !== 0);

  let flags = 0;
  flags |= 0x0001; // Data offset present
  flags |= 0x0004 * +firstSampleFlagsPresent; // First sample flags present
  flags |= 0x0100 * +sampleDurationPresent; // Sample duration present
  flags |= 0x0200 * +sampleSizePresent; // Sample size present
  flags |= 0x0400 * +sampleFlagsPresent; // Sample flags present
  flags |= 0x0800 * +sampleCompositionTimeOffsetsPresent; // Sample composition time offsets present

  return fullBox('trun', 1, flags, [
    u32(track.currentChunk.samples.length), // Sample count
    u32(track.currentChunk.offset - track.currentChunk.moofOffset || 0), // Data offset
        firstSampleFlagsPresent ? u32(allSampleFlags[0]) : [],
        track.currentChunk.samples.map((_, i) => [
            sampleDurationPresent ? u32(allSampleDurations[i]) : [], // Sample duration
            sampleSizePresent ? u32(allSampleSizes[i]) : [], // Sample size
            sampleFlagsPresent ? u32(allSampleFlags[i]) : [], // Sample flags
            // Sample composition time offsets
            sampleCompositionTimeOffsetsPresent ? i32(allSampleCompositionTimeOffsets[i]) : [],
        ]),
  ]);
};

/**
 * Movie Fragment Random Access Box: For each track, provides pointers to sync samples within the file
 * for random access.
 */
export const mfra = (tracks) => {
  return box('mfra', null, [
    ...tracks.map(tfra),
    mfro(),
  ]);
};

/** Track Fragment Random Access Box: Provides pointers to sync samples within the file for random access. */
export const tfra = (track, trackIndex) => {
  const version = 1; // Using this version allows us to use 64-bit time and offset values

  return fullBox('tfra', version, 0, [
    u32(track.id), // Track ID
    u32(0b111111), // This specifies that traf number, trun number and sample number are 32-bit ints
    u32(track.finalizedChunks.length), // Number of entries
    track.finalizedChunks.map((chunk) => [
      u64(intoTimescale(chunk.startTimestamp, track.timescale)), // Time
      u64(chunk.moofOffset), // moof offset
      u32(trackIndex + 1), // traf number
      u32(1), // trun number
      u32(1), // Sample number
    ]),
  ]);
};

/**
 * Movie Fragment Random Access Offset Box: Provides the size of the enclosing mfra box. This box can be used by readers
 * to quickly locate the mfra box by searching from the end of the file.
 */
export const mfro = () => {
  return fullBox('mfro', 0, 0, [
    // This value needs to be overwritten manually from the outside, where the actual size of the enclosing mfra box
    // is known
    u32(0), // Size
  ]);
};

const VIDEO_CODEC_TO_BOX_NAME = {
  'avc': 'avc1',
  'hevc': 'hvc1',
  'vp9': 'vp09',
  'av1': 'av01',
};

const VIDEO_CODEC_TO_CONFIGURATION_BOX = {
  'avc': avcC,
  'hevc': hvcC,
  'vp9': vpcC,
  'av1': av1C,
};

const AUDIO_CODEC_TO_BOX_NAME = {
  'aac': 'mp4a',
  'opus': 'Opus',
};

const AUDIO_CODEC_TO_CONFIGURATION_BOX = {
  'aac': esds,
  'opus': dOps,
};
