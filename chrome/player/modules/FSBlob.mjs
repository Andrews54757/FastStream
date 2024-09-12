import {IndexedDBManager} from '../network/IndexedDBManager.mjs';
import {EnvUtils} from '../utils/EnvUtils.mjs';

const BrowserCanAutoOffloadBlobs = EnvUtils.isChrome();
const UseIndexedDB = !BrowserCanAutoOffloadBlobs && IndexedDBManager.isSupported();

export class FSBlob {
  constructor() {
    this.blobStore = new Map();
    this.blobStorePromises = new Map();

    if (UseIndexedDB) {
      this.indexedDBManager = new IndexedDBManager();
      this.setupPromise = this.indexedDBManager.setup();
    }

    this.blobIndex = 0;
  }

  async saveBlobAsync(identifier, blob) {
    try {
      await this.setupPromise;
    } catch (e) {
      // IndexedDB is not supported
      console.warn('IndexedDB is not supported, falling back to memory storage');
      this.indexedDBManager = null;
      this.blobStorePromises.clear();
      return false;
    }

    await this.indexedDBManager.setFile(identifier, blob);
    this.blobStore.delete(identifier);
    return true;
  }

  _saveBlob(identifier, blob) {
    this.blobStore.set(identifier, blob);
    if (this.indexedDBManager) {
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
    if (this.blobStore.has(identifier)) {
      return this.blobStore.get(identifier);
    }

    if (this.blobStorePromises.has(identifier)) {
      await this.blobStorePromises.get(identifier);
      return await this.indexedDBManager.getFile(identifier);
    }

    return null;
  }

  close() {
    return this.indexedDBManager?.close();
  }
}
