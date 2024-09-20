import {AbstractSample} from './AbstractSample.mjs';

export class VideoSample extends AbstractSample {
  constructor({
    isKey, pts, dts, timescale, data,
  }) {
    super();
    this.isKey = isKey;
    this.pts = pts;
    this.dts = dts;
    this.timescale = timescale;
    this.data = data;
  }
}
