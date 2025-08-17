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
    this.width = width || 0;
    this.height = height || 0;
    this.bitrate = bitrate || 0;
    this.mimeType = mimeType || '';
    this.language = language || '';
    this.videoCodec = videoCodec ?? null;
    this.audioCodec = audioCodec ?? null;
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
    this.bitrate = bitrate || 0;
    this.mimeType = mimeType || '';
    this.language = language || '';
    this.audioCodec = audioCodec ?? null;
    this.track = track;
  }
}
