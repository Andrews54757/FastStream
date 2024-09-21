export class AudioTrackInfo {
  constructor({
    codec,
    description,
    sampleRate,
    numberOfChannels,
  }) {
    this.codec = codec;
    this.description = description;
    this.sampleRate = sampleRate;
    this.numberOfChannels = numberOfChannels;
  }
}
