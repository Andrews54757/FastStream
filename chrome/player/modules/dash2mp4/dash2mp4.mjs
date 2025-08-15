import {EventEmitter} from '../eventemitter.mjs';
import {MP4Merger} from './mp4merger.mjs';

export class DASH2MP4 extends EventEmitter {
  constructor(registerCancel) {
    super();
    this.converter = null;
    this.registerCancel = registerCancel;
  }


  async convert(videoMimeType, videoDuration, videoInitSegment, audioMimeType, audioDuration, audioInitSegment, zippedFragments) {
    try {
      this.converter = new MP4Merger(this.registerCancel);
      this.converter.on('progress', (progress) => {
        this.emit('progress', progress);
      });
      return await this.converter.convert(videoDuration, videoInitSegment, audioDuration, audioInitSegment, zippedFragments);
    } catch (e) {
      const mergerErrors = [
        'Video codec not supported!',
        'Audio codec not supported!',
        'Video is not an mp4!',
        'Audio is not an mp4!',
      ];
      if (!mergerErrors.includes(e.message)) {
        throw e;
      }

      if (!window.VideoDecoder || !window.VideoEncoder || !window.AudioDecoder || !window.AudioEncoder) {
        throw e;
      }

      const {Reencoder} = await import('../reencoder/reencoder.mjs');
      this.converter = new Reencoder(this.registerCancel);
      this.converter.on('progress', (progress) => {
        this.emit('progress', progress);
      });
      return await this.converter.convert(videoMimeType, videoDuration, videoInitSegment, audioMimeType, audioDuration, audioInitSegment, zippedFragments);
    }
  }
}
