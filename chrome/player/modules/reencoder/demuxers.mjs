import {MP4Box} from '../mp4box.mjs';
import {JsWebm} from './webm.mjs';

class AbstractDemuxer {
  constructor() {

  }
  initialize(initSegment) {
    throw new Error('Not implemented');
  }
  appendBuffer(buffer) {
    throw new Error('Not implemented');
  }
  getVideoDecoderConfig() {
    throw new Error('Not implemented');
  }
  getAudioDecoderConfig() {
    throw new Error('Not implemented');
  }
  getVideoChunks(duration) {
    throw new Error('Not implemented');
  }
  getAudioChunks(duration) {
    throw new Error('Not implemented');
  }
  clearChunks() {
    throw new Error('Not implemented');
  }
}

export class WebMDemuxer extends AbstractDemuxer {
  constructor() {
    super();
    this.demuxer = new JsWebm();
    this.MAX_ITERATIONS = 10000;
  }

  process() {
    let count = 0;
    while (this.demuxer.demux()) {
      count++;
      if (count > this.MAX_ITERATIONS) {
        throw new Error('too many iterations');
      }
    }
  }

  initialize(initSegment) {
    this.appendBuffer(initSegment);
    this.demuxer.validateMetadata();
  }

  appendBuffer(buffer) {
    this.demuxer.queueData(buffer);
    this.process();
  }

  getVideoDecoderConfig() {
    const videoTrack = this.demuxer.videoTrack;
    if (!videoTrack) {
      return null;
    }

    const config = {
      codec: this.demuxer.videoCodec,
      codedWidth: videoTrack.width,
      codedHeight: videoTrack.height,
      displayAspectWidth: videoTrack.displayWidth,
      displayAspectHeight: videoTrack.displayHeight,
    };

    const colour = videoTrack.colour;
    if (colour) {
      config.colorSpace = {
        primaries: colour.webReadyPrimaries || null,
        transfer: colour.webReadyTransferCharacteristics || null,
        matrix: colour.webReadyMatrixCoefficients || null,
        fullRange: colour.range ? (colour.range === 'full') : null,
      };
    }

    return config;
  }

  getAudioDecoderConfig() {
    const audioTrack = this.demuxer.audioTrack;
    if (!audioTrack) {
      return null;
    }
    return {
      codec: this.demuxer.audioCodec,
      description: audioTrack.codecPrivate,
      sampleRate: audioTrack.rate,
      numberOfChannels: audioTrack.channels,
    };
  }

  getVideoChunks(duration) {
    const packets = this.demuxer.videoPackets;
    const chunks = [];
    for (let i = 0; i < packets.length - 1; i++) {
      const packet = packets[i];
      const nextPacket = packets[i + 1];
      const currentTimestamp = Math.floor(packet.timestamp * 1000000);
      const nextTimestamp = Math.floor(nextPacket.timestamp * 1000000);
      const chunk = new EncodedVideoChunk({
        type: packet.isKeyframe ? 'key' : 'delta',
        timestamp: currentTimestamp,
        duration: nextTimestamp - currentTimestamp,
        data: packet.data,
      });
      chunks.push(chunk);
    }

    if (duration) {
      const lastPacket = packets[packets.length - 1];
      const lastTimestamp = Math.floor(lastPacket.timestamp * 1000000);
      const lastDuration = Math.floor(duration * 1000000) - lastTimestamp;
      const lastChunk = new EncodedVideoChunk({
        type: lastPacket.isKeyframe ? 'key' : 'delta',
        timestamp: lastTimestamp,
        duration: lastDuration,
        data: lastPacket.data,
      });
      chunks.push(lastChunk);
    }
    return chunks;
  }

  getAudioChunks(duration) {
    const packets = this.demuxer.audioPackets;
    const chunks = [];
    for (let i = 0; i < packets.length - 1; i++) {
      const packet = packets[i];
      const nextPacket = packets[i + 1];
      const currentTimestamp = Math.floor(packet.timestamp * 1000000);
      const nextTimestamp = Math.floor(nextPacket.timestamp * 1000000);
      const chunk = new EncodedAudioChunk({
        type: packet.isKeyframe ? 'key' : 'delta',
        timestamp: currentTimestamp,
        duration: nextTimestamp - currentTimestamp,
        data: packet.data,
      });
      chunks.push(chunk);
    }

    if (duration) {
      const lastPacket = packets[packets.length - 1];
      const lastTimestamp = Math.floor(lastPacket.timestamp * 1000000);
      const lastDuration = Math.floor(duration * 1000000) - lastTimestamp;
      const lastChunk = new EncodedAudioChunk({
        type: lastPacket.isKeyframe ? 'key' : 'delta',
        timestamp: lastTimestamp,
        duration: lastDuration,
        data: lastPacket.data,
      });
      chunks.push(lastChunk);
    }
    return chunks;
  }

  clearChunks() {
    // clear all but the last packet
    this.demuxer.audioPackets.splice(0, this.demuxer.audioPackets.length - 1);
    this.demuxer.videoPackets.splice(0, this.demuxer.videoPackets.length - 1);
  }
}


export class MP4Demuxer extends AbstractDemuxer {
  constructor() {
    super();
  }

  createFile(buffer) {
    const file = MP4Box.createFile(false);
    file.onError = (e) => {
      console.log('mp4box error', e);
    };
    return file;
  }

  initialize(initSegment) {
    this.file = this.createFile();
    initSegment.fileStart = 0;
    this.file.appendBuffer(initSegment);
    this.nextPos = initSegment.byteLength;
    this.file.flush();

    if (!this.file.moov) {
      throw new Error('moov not found');
    }

    this.info = this.file.getInfo();

    this.videoTrack = this.info.videoTracks[0];
    this.audioTrack = this.info.audioTracks[0];

    this.videoSamples = [];
    this.audeoSamples = [];

    if (this.videoTrack) {
      this.file.setExtractionOptions(this.videoTrack.id, this.videoTrack, {nbSamples: 1});
    }

    if (this.audioTrack) {
      this.file.setExtractionOptions(this.audioTrack.id, this.audioTrack, {nbSamples: 1});
    }

    this.file.onSamples = (id, user, samples) => {

    };

    this.file.start();
  }

  appendBuffer(buffer) {
    buffer.fileStart = this.nextPos;
    this.file.appendBuffer(buffer);
    this.nextPos += buffer.byteLength;
    this.file.flush();
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

  getVideoChunks(duration) {
    if (!this.videoTrack) {
      return [];
    }
    const trak = this.file.getTrackById(this.videoTrack.id);

    const samples = trak.samples_stored;

    const chunks = [];
    for (let i = 0; i < samples.length - 1; i++) {
      const sample = samples[i];
      const nextSample = samples[i + 1];

      const timescale = sample.timescale;
      const currentTimestamp = Math.floor(sample.cts * 1000000 / timescale);
      const nextTimestamp = Math.floor(nextSample.cts * 1000000 / timescale);
      const chunk = new EncodedVideoChunk({
        type: sample.is_sync ? 'key' : 'delta',
        timestamp: currentTimestamp,
        duration: nextTimestamp - currentTimestamp,
        data: sample.data,
      });
      chunks.push(chunk);
    }

    if (duration) {
      const lastSample = samples[samples.length - 1];
      const timescale = lastSample.timescale;
      const lastTimestamp = Math.floor(lastSample.cts * 1000000 / timescale);
      const lastDuration = Math.floor(lastSample.duration * 1000000 / timescale);
      const lastChunk = new EncodedVideoChunk({
        type: lastSample.is_sync ? 'key' : 'delta',
        timestamp: lastTimestamp,
        duration: lastDuration,
        data: lastSample.data,
      });
      chunks.push(lastChunk);
    }

    return chunks;
  }

  getAudioChunks(duration) {
    if (!this.audioTrack) {
      return [];
    }
    const trak = this.file.getTrackById(this.audioTrack.id);

    const samples = trak.samples_stored;

    const chunks = [];
    for (let i = 0; i < samples.length - 1; i++) {
      const sample = samples[i];
      const nextSample = samples[i + 1];

      const timescale = sample.timescale;
      const currentTimestamp = Math.floor(sample.cts * 1000000 / timescale);
      const nextTimestamp = Math.floor(nextSample.cts * 1000000 / timescale);
      const chunk = new EncodedAudioChunk({
        type: sample.is_sync ? 'key' : 'delta',
        timestamp: currentTimestamp,
        duration: nextTimestamp - currentTimestamp,
        data: sample.data,
      });
      chunks.push(chunk);
    }

    if (duration) {
      const lastSample = samples[samples.length - 1];
      const timescale = lastSample.timescale;
      const lastTimestamp = Math.floor(lastSample.cts * 1000000 / timescale);
      const lastDuration = Math.floor(lastSample.duration * 1000000 / timescale);
      const lastChunk = new EncodedAudioChunk({
        type: lastSample.is_sync ? 'key' : 'delta',
        timestamp: lastTimestamp,
        duration: lastDuration,
        data: lastSample.data,
      });
      chunks.push(lastChunk);
    }
  }

  clearChunks() {
    // clear all but the last packet
    if (this.videoTrack) {
      const videoTrak = this.file.getTrackById(this.videoTrack.id);
      const samples = videoTrak.samples_stored;
      for (let i = 0; i < samples.length - 1; i++) {
        this.file.releaseSample(videoTrak, samples[i].number);
      }
      samples.splice(0, samples.length - 1);
    }

    if (this.audioTrack) {
      const audioTrak = this.file.getTrackById(this.audioTrack.id);
      const samples = audioTrak.samples_stored;
      for (let i = 0; i < samples.length - 1; i++) {
        this.file.releaseSample(audioTrak, samples[i].number);
      }
      samples.splice(0, samples.length - 1);
    }
  }
}
