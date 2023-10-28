import {IndexedDBManager} from '../network/IndexedDBManager.mjs';
import {EnvUtils} from '../utils/EnvUtils.mjs';

const BrowserCanAutoOffloadBlobs = EnvUtils.isChrome();

export class FSBlob {
  constructor() {
    if (BrowserCanAutoOffloadBlobs) {
      this.blobStore = new Map();
    } else {
      this.indexedDBManager = new IndexedDBManager();
      this.setupPromise = this.indexedDBManager.setup();
      this.blobStorePromises = new Map();
    }

    this.blobIndex = 0;
  }

  async saveBlobAsync(identifier, blob) {
    await this.setupPromise;
    await this.indexedDBManager.setFile(identifier, blob);
    return true;
  }

  _saveBlob(identifier, blob) {
    if (BrowserCanAutoOffloadBlobs) {
      this.blobStore.set(identifier, blob);
    } else {
      this.blobStorePromises.set(identifier, this.saveBlobAsync(identifier, blob));
    }
  }

  saveBlob(blob) {
    const identifier = `blob${this.blobIndex++}`;
    this._saveBlob(identifier, blob);
    return identifier;
  }

  createBlob(data) {
    const identifier = `blob${this.blobIndex++}`;
    const blob = new Blob([data], {type: 'application/octet-stream'});
    this._saveBlob(identifier, blob);
    return identifier;
  }

  async getBlob(identifier) {
    if (BrowserCanAutoOffloadBlobs) {
      return this.blobStore.get(identifier);
    } else {
      await this.blobStorePromises.get(identifier);
      return await this.indexedDBManager.getFile(identifier);
    }
  }

  close() {
    return this.indexedDBManager?.close();
  }
}
