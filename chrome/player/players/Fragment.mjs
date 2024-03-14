import {DownloadStatus} from '../enums/DownloadStatus.mjs';

export class Fragment {
  constructor(level, sn) {
    this.sn = sn;
    this.level = level;
    this.status = DownloadStatus.WAITING;
    this.start = -1;
    this.end = -1;
    this.duration = 0;
    this.references = [];
    this.dataSize = null;
  }

  addReference(id, duplicate = false) {
    if (duplicate || !this.references.includes(id)) {
      this.references.push(id);
    }
  }

  removeReference(id) {
    const index = this.references.indexOf(id);
    if (index !== -1) {
      this.references.splice(index, 1);
    }
  }

  canFree() {
    return this.references.length <= 0;
  }

  getContext() {
    throw new Error('Not implemented');
  }
}
