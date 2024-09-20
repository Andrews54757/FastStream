import {MP4Box} from '../../mp4box.mjs';
import {AudioSample} from '../common/AudioSample.mjs';
import {VideoSample} from '../common/VideoSample.mjs';
import {AbstractDemuxer} from './AbstractDemuxer.mjs';

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

  getVideoDecoderConfig(trackId) {
    const videoTrack = this.videoTracks?.get(track.id);
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

  getAudioDecoderConfig(trackId) {
    const audioTrack = this.audioTracks?.get(trackId);
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
  process() {
    const videoTracks = this.videoTracks;
    videoTracks.forEach((track) => {
      const trak = this.file.getTrackById(track.id);
      const samples = trak.samples_stored;

      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        track.chunks.push(new VideoSample({
          isKey: sample.is_sync,
          pts: sample.cts,
          dts: sample.dts,
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
        track.chunks.push(new AudioSample({
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
      track.chunks = [];
      videoTracks.set(track.id, track);
    });
    if (videoTracks.size > 0) {
      this.videoTracks = videoTracks;
    }

    const audioTracks = new Map();
    this.info.audioTracks.forEach((track) => {
      track.chunks = [];
      audioTracks.set(track.id, track);
    });
    if (audioTracks.size > 0) {
      this.audioTracks = audioTracks;
    }

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
