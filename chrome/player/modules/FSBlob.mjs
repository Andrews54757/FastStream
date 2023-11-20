import {IndexedDBManager} from '../network/IndexedDBManager.mjs';
import {EnvUtils} from '../utils/EnvUtils.mjs';

const BrowserCanAutoOffloadBlobs = EnvUtils.isChrome();
const UseIndexedDB = !BrowserCanAutoOffloadBlobs && IndexedDBManager.isSupported();

export class FSBlob {
  constructor() {
    if (UseIndexedDB) {
      this.indexedDBManager = new IndexedDBManager();
      this.setupPromise = this.indexedDBManager.setup();
      this.blobStorePromises = new Map();
    } else {
      this.blobStore = new Map();
    }

    this.blobIndex = 0;
  }

  async saveBlobAsync(identifier, blob) {
    await this.setupPromise;
    await this.indexedDBManager.setFile(identifier, blob);
    return true;
  }

  _saveBlob(identifier, blob) {
    if (UseIndexedDB ) {
      this.blobStorePromises.set(identifier, this.saveBlobAsync(identifier, blob));
    } else {
      this.blobStore.set(identifier, blob);
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
    if (UseIndexedDB) {
      await this.blobStorePromises.get(identifier);
      return await this.indexedDBManager.getFile(identifier);
    } else {
      return this.blobStore.get(identifier);
    }
  }

  close() {
    return this.indexedDBManager?.close();
  }
}
