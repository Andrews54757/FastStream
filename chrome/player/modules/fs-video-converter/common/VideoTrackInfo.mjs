import {TrackTypes} from '../enums/TrackTypes.mjs';

// https://developer.mozilla.org/en-US/docs/Web/API/VideoDecoder/configure
export class VideoTrackInfo {
  constructor({
    id,
    codec,
    description,
    codedWidth,
    codedHeight,
    displayAspectWidth,
    displayAspectHeight,
    colorSpace,
  }) {
    this.id = id;
    this.type = TrackTypes.VIDEO;
    this.codec = codec;
    this.description = description;
    this.codedWidth = codedWidth;
    this.codedHeight = codedHeight;
    this.displayAspectWidth = displayAspectWidth;
    this.displayAspectHeight = displayAspectHeight;
    this.colorSpace = colorSpace;
  }
}
