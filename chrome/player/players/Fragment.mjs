import {DownloadStatus} from '../enums/DownloadStatus.mjs';

export class Fragment {
  constructor(level, sn) {
    this.sn = sn;
    this.level = level;
    this.status = DownloadStatus.WAITING;
    this.start = -1;
    this.end = -1;
    this.duration = 0;
    this.references = 0;
  }

  addReference() {
    this.references++;
  }

  removeReference() {
    this.references--;
  }

  canFree() {
    return this.references <= 0;
  }

  getContext() {
    throw new Error('Not implemented');
  }
}
