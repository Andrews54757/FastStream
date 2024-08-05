import {EventEmitter} from '../eventemitter.mjs';
import {MP4Merger} from './mp4merger.mjs';
import {WEBMMerger} from './webmmerger.mjs';

export class DASH2MP4 extends EventEmitter {
  constructor() {
    super();
    this.converter = null;
  }

  async convert(videoDuration, videoInitSegment, audioDuration, audioInitSegment, zippedFragments) {
    try {
      this.converter = new MP4Merger();
      this.converter.on('progress', (progress) => {
        this.emit('progress', progress);
      });
      return await this.converter.convert(videoDuration, videoInitSegment, audioDuration, audioInitSegment, zippedFragments);
    } catch (e) {
      this.converter = new WEBMMerger();
      this.converter.on('progress', (progress) => {
        this.emit('progress', progress);
      });
      return await this.converter.convert(videoDuration, videoInitSegment, audioDuration, audioInitSegment, zippedFragments);
    }
  }
}
