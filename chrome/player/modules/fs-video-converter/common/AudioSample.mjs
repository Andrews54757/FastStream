import {AbstractSample} from './AbstractSample.mjs';

export class AudioSample extends AbstractSample {
  constructor({
    pts, timescale, data,
  }) {
    super();
    this.pts = pts;
    this.isKey = true;
    this.timescale = timescale;
    this.data = data;
  }
}
