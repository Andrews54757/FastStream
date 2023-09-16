import {Fragment} from '../Fragment.mjs';

export class MP4Fragment extends Fragment {
  constructor(level, sn, source, rangeStart, rangeEnd) {
    super(level, sn);
    this.source = source;
    this.rangeStart = rangeStart;
    this.rangeEnd = rangeEnd;
  }

  getContext() {
    return {
      url: this.source.url,
      rangeStart: this.rangeStart,
      rangeEnd: this.rangeEnd,
      responseType: 'arraybuffer',
    };
  }
}
