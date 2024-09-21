import {DataStream, MP4Box} from '../../mp4box.mjs';
import {AudioSample} from '../common/AudioSample.mjs';
import {AudioTrackInfo} from '../common/AudioTrackInfo.mjs';
import {ColorSpaceConfig} from '../common/ColorSpaceConfig.mjs';
import {VideoSample} from '../common/VideoSample.mjs';
import {VideoTrackInfo} from '../common/VideoTrackInfo.mjs';
import {AbstractDemuxer} from './AbstractDemuxer.mjs';

const VideoCodecs = ['avc1', 'avc2', 'avc3', 'avc4', 'av01', 'dav1', 'hvc1', 'hev1', 'hvt1', 'lhe1', 'dvh1', 'dvhe', 'vvc1', 'vvi1', 'vvs1', 'vvcN', 'vp08', 'vp09', 'avs3', 'j2ki', 'mjp2', 'mjpg', 'uncv'];
const AudioCodecs = ['mp4a', 'ac-3', 'ac-4', 'ec-3', 'Opus', 'mha1', 'mha2', 'mhm1', 'mhm2'];

export default class MP4Demuxer extends AbstractDemuxer {
  constructor() {
    super();
    this.nextPos = 0;
  }

  // These are public methods that can be called from outside the class
  static test(buffer) {
    // Check if moof or moov box exists in the buffer
    const data = new Uint8Array(buffer);
    const end = data.byteLength;
    for (let i = 0; i < end;) {
      // const size = readUint32(data, i);
      let size = (data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3];
      if (size < 0) size += 4294967296;
      if (size > 8 && (
        (data[i + 4] === 0x6d && data[i + 5] === 0x6f && data[i + 6] === 0x6f && data[i + 7] === 0x66) || // moof
        (data[i + 4] === 0x6d && data[i + 5] === 0x6f && data[i + 6] === 0x6f && data[i + 7] === 0x76) // moov
      )) {
        return true;
      }
      i = size > 1 ? i + size : end;
    }
    return false;
  }

  appendBuffer(buffer, offset) {
    if (!this.file) {
      this.file = this.createFile();
    }

    if (offset === undefined) {
      offset = this.nextPos;
    }

    buffer.fileStart = offset;
    this.nextPos += buffer.byteLength;

    this.file.appendBuffer(buffer);
    this.file.flush();

    if (!this.initializedTracks && this.file.moov) {
      this.initializeTracks();
    }

    this.process();
  }


  getAllSamples() {
    const videoTracks = this.videoTracks;
    const audioTracks = this.audioTracks;

    const results = new Map();

    videoTracks.forEach((track) => {
      results.set(track.id, {
        id: track.id,
        type: TrackTypes.VIDEO,
        samples: track.fssamples,
      });
      track.fssamples = [];
    });

    audioTracks.forEach((track) => {
      results.set(track.id, {
        id: track.id,
        type: TrackTypes.AUDIO,
        samples: track.fssamples,
      });
      track.fssamples = [];
    });

    return results;
  }

  getAllTracks() {
    const videoTracks = this.videoTracks;
    const audioTracks = this.audioTracks;

    const results = new Map();
    videoTracks.forEach((track) => {
      results.set(track.id, this.getVideoInfo(track.id));
    });

    audioTracks.forEach((track) => {
      results.set(track.id, this.getAudioInfo(track.id));
    });

    return results;
  }

  // Private methods can be defined here
  getVideoInfo(trackId) {
    const videoTrack = this.videoTracks?.get(trackId);
    if (!videoTrack) {
      return null;
    }

    const trak = this.file.getTrackById(audioTrack.id);
    const codecBox = trak.mdia.minf.stbl.stsd.entries.find((e) => {
      return VideoCodecs.includes(e.type);
    });

    // Av01: no description
    // AVC: AVCDecoderConfigurationRecord
    // HEVC: HEVCDecoderConfigurationRecord
    // VP8: no description
    // VP9: no description

    const withDescription = {
      'avc1': 'avcC',
      'avc2': 'avcC',
      'avc3': 'avcC',
      'avc4': 'avcC',
      'hvc1': 'hvcC',
      'hev1': 'hvcC',
    };

    let description = null;
    let colorSpace = null;

    if (Object.hasOwn(withDescription, codecBox.type)) {
      const descriptionBox = codecBox[withDescription[codecBox.type]];
      const stream = new DataStream();
      stream.endianness = DataStream.BIG_ENDIAN;
      descriptionBox.write(stream);
      const codecBuffer = stream.buffer.slice(8);
      // Skip the first 8 bytes
      description = codecBuffer.slice(8);
    } else if (codecBox.type === 'vp09' || codecBox.type === 'vp08') {
      let chromaticity = null;
      const smdm = codecBox.SmDm;
      if (smdm) {
        chromaticity = {
          x: [smdm.primaryRChromaticity_x, smdm.primaryGChromaticity_x, smdm.primaryBChromaticity_x, smdm.whitePointChromaticity_x],
          y: [smdm.primaryRChromaticity_y, smdm.primaryGChromaticity_y, smdm.primaryBChromaticity_y, smdm.whitePointChromaticity_y],
          luminanceMax: smdm.luminanceMax,
          luminanceMin: smdm.luminanceMin,
        };
      }

      const vpcc = codecBox.vpcC;
      colorSpace = new ColorSpaceConfig({
        primaries: vpcc.colourPrimaries,
        transfer: vpcc.transferCharacteristics,
        matrix: vpcc.matrixCoefficients,
        fullRange: vpcc.videoFullRangeFlag === 1,
        chromaticity,
      });
    }

    return new VideoTrackInfo({
      id: videoTrack.id,
      codec: videoTrack.codec,
      description,
      codedWidth: videoTrack.video.width,
      codedHeight: videoTrack.video.height,
      displayAspectWidth: videoTrack.track_width,
      displayAspectHeight: videoTrack.track_height,
      colorSpace,
    });
  }

  getAudioInfo(trackId) {
    const audioTrack = this.audioTracks?.get(trackId);
    if (!audioTrack) {
      return null;
    }
    const trak = this.file.getTrackById(audioTrack.id);
    const codecBox = trak.mdia.minf.stbl.stsd.entries.find((e) => {
      return AudioCodecs.includes(e.type);
    });

    let description = null;
    if (codecBox.type.toLowerCase() === 'flac') {
      audioTrack.codec = 'flac';
      const dfla = codecBox.dfLa;
      description = new ArrayBuffer(dfla.data.byteLength + 4);
      const view = new Uint8Array(description);
      // First four bytes are fLaC
      view.set([0x66, 0x4c, 0x61, 0x43], 0);
      // The rest of the bytes are the data
      view.set(new Uint8Array(dfla.data), 4);
    } else if (codecBox.type === 'mp4a') {
      description = codecBox.esds?.esd?.findDescriptor(4)?.findDescriptor(5)?.data || null;
    } else if (codecBox.type === 'Opus') {
      const dops = codecBox.dOps;
      const data = dops.data;

      description = new Uint8Array(data.byteLength + 8);
      // Set magic signature OpusHead
      description[0] = 0x4f;
      description[1] = 0x70;
      description[2] = 0x75;
      description[3] = 0x73;
      description[4] = 0x48;
      description[5] = 0x65;
      description[6] = 0x61;
      description[7] = 0x64;

      // Copy the rest of the data
      description.set(new Uint8Array(data), 8);
    }

    return new AudioTrackInfo({
      id: audioTrack.id,
      codec: audioTrack.codec,
      sampleRate: audioTrack.audio.sample_rate,
      numberOfChannels: audioTrack.audio.channel_count,
      description,
    });
  }

  process() {
    const videoTracks = this.videoTracks;
    videoTracks.forEach((track) => {
      const trak = this.file.getTrackById(track.id);
      const samples = trak.samples_stored;

      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        track.fssamples.push(new VideoSample({
          isKey: sample.is_sync,
          pts: sample.cts,
          coffset: sample.cts - sample.dts,
          timescale: sample.timescale,
          data: sample.data,
        }));
      }

      samples.forEach((sample) => {
        this.file.releaseSample(trak, sample.number);
      });
      samples.length = 0; // Clear samples after processing
    });

    const audioTracks = this.audioTracks;
    audioTracks.forEach((track) => {
      const trak = this.file.getTrackById(track.id);
      const samples = trak.samples_stored;

      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        track.fssamples.push(new AudioSample({
          pts: sample.cts,
          timescale: sample.timescale,
          data: sample.data,
        }));
      }

      samples.forEach((sample) => {
        this.file.releaseSample(trak, sample.number);
      });
      samples.length = 0; // Clear samples after processing
    });
  }

  createFile() {
    const file = MP4Box.createFile(false);
    file.onError = (e) => {
      console.log('mp4box error', e);
    };
    return file;
  }

  initializeTracks() {
    this.initializedTracks = true;

    this.info = this.file.getInfo();

    const videoTracks = new Map();
    this.info.videoTracks.forEach((track) => {
      track.fssamples = [];
      videoTracks.set(track.id, track);
    });
    this.videoTracks = videoTracks;


    const audioTracks = new Map();
    this.info.audioTracks.forEach((track) => {
      track.fssamples = [];
      audioTracks.set(track.id, track);
    });
    this.audioTracks = audioTracks;


    videoTracks.forEach((track) => {
      this.file.setExtractionOptions(track.id, track, {nbSamples: 1});
    });

    audioTracks.forEach((track) => {
      this.file.setExtractionOptions(track.id, track, {nbSamples: 1});
    });

    this.file.onSamples = (id, user, samples) => {

    };

    this.file.start();
  }
}
