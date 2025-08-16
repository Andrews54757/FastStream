export class VideoLevel {
  constructor({
    id,
    width,
    height,
    bitrate,
    mimeType,
    language,
    videoCodec,
    audioCodec,
    track,
  }) {
    this.id = id;
    this.width = width;
    this.height = height;
    this.bitrate = bitrate;
    this.mimeType = mimeType;
    this.language = language;
    this.videoCodec = videoCodec;
    this.audioCodec = audioCodec;
    this.track = track;
  }
}

export class AudioLevel {
  constructor({
    id,
    bitrate,
    mimeType,
    language,
    audioCodec,
    track,
  }) {
    this.id = id;
    this.bitrate = bitrate;
    this.mimeType = mimeType;
    this.language = language;
    this.audioCodec = audioCodec;
    this.track = track;
  }
}
