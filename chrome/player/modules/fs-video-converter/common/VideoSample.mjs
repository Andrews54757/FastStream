import {AbstractSample} from './AbstractSample.mjs';

export class VideoSample extends AbstractSample {
  constructor({
    isKey, pts, coffset, timescale, data,
  }) {
    super();
    this.isKey = isKey;
    this.pts = pts;
    this.coffset = coffset;
    this.timescale = timescale;
    this.data = data;
  }
}
