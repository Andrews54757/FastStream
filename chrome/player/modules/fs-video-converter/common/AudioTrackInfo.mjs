import {TrackTypes} from '../enums/TrackTypes.mjs';

export class AudioTrackInfo {
  constructor({
    id,
    codec,
    description,
    sampleRate,
    numberOfChannels,
  }) {
    this.id = id;
    this.type = TrackTypes.AUDIO;
    this.codec = codec;
    this.description = description;
    this.sampleRate = sampleRate;
    this.numberOfChannels = numberOfChannels;
  }
}
