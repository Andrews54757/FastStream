import {EventEmitter} from '../eventemitter.mjs';
import {MP4Merger} from './mp4merger.mjs';

export class DASH2MP4 extends EventEmitter {
  constructor(registerCancel) {
    super();
    this.converter = null;
    if (registerCancel) {
      registerCancel(() => {
        this.cancel();
      });
    }
  }

  cancel() {
    this.cancelled = true;
    if (this.converter) {
      this.converter.cancel();
    }
  }

  async convert(videoMimeType, videoDuration, videoInitSegment, audioMimeType, audioDuration, audioInitSegment, zippedFragments) {
    try {
      this.converter = new MP4Merger();
      this.converter.on('progress', (progress) => {
        this.emit('progress', progress);
      });
      return await this.converter.convert(videoDuration, videoInitSegment, audioDuration, audioInitSegment, zippedFragments);
    } catch (e) {
      const {Reencoder} = await import('../reencoder/reencoder.mjs');
      this.converter = new Reencoder();
      this.converter.on('progress', (progress) => {
        this.emit('progress', progress);
      });
      return await this.converter.convert(videoMimeType, videoDuration, videoInitSegment, audioMimeType, audioDuration, audioInitSegment, zippedFragments);
    }
  }
}
