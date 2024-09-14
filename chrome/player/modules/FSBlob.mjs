import {IndexedDBManager} from '../network/IndexedDBManager.mjs';
import {EnvUtils} from '../utils/EnvUtils.mjs';

const BrowserCanAutoOffloadBlobs = EnvUtils.isChrome();
const UseXHRTrick = false && !BrowserCanAutoOffloadBlobs && EnvUtils.isFirefox();
const UseIndexedDB = !UseXHRTrick && !BrowserCanAutoOffloadBlobs && IndexedDBManager.isSupported();

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

  async saveBlobInIndexedDBAsync(identifier, blob) {
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

  async saveBlobUsingFetchTrick(identifier, blob) {
    // Does not work
    // Create url for blob
    // const url = URL.createObjectURL(blob);
    // const xhr = new XMLHttpRequest();
    // xhr.open('GET', url);
    // xhr.responseType = 'blob';

    // return new Promise((resolve, reject) => {
    //   const cleanup = () => {
    //     URL.revokeObjectURL(url);
    //     resolve();
    //   };

    //   xhr.onload = () => {
    //     if (xhr.status === 200) {
    //       this.blobStore.set(identifier, xhr.response);
    //     } else {
    //       console.error('Failed to save blob using XHR trick');
    //     }
    //     cleanup();
    //   };

    //   xhr.onerror = () => {
    //     console.error('XHR error while saving blob');
    //     cleanup();
    //   };

    //   xhr.send();
    // });

    // const response = await fetch(url);
    // if (response.ok) {
    //   const blobResponse = await response.blob();
    //   URL.revokeObjectURL(url);
    //   this.blobStore.set(identifier, blobResponse);
    // } else {
    //   URL.revokeObjectURL(url);
    //   throw new Error('Failed to save blob using fetch trick');
    // }
  }

  nextIdentifier() {
    return `blob${this.blobIndex++}`;
  }

  async saveBlobAsync(blob, identifier) {
    if (!identifier) {
      identifier = this.nextIdentifier();
    }
    this.blobStore.set(identifier, blob);
    let promise;
    if (this.indexedDBManager) {
      promise = this.saveBlobInIndexedDBAsync(identifier, blob);
    } else if (UseXHRTrick) {
      promise = this.saveBlobUsingFetchTrick(identifier, blob);
    }
    this.blobStorePromises.set(identifier, promise);

    await promise;

    return identifier;
  }

  saveBlob(blob) {
    const identifier = this.nextIdentifier();
    this.saveBlobAsync(blob, identifier);
    return identifier;
  }

  createBlob(data) {
    const blob = new Blob([data], {type: 'application/octet-stream'});
    return this.saveBlob(blob);
  }

  async deleteBlob(identifier) {
    this.blobStore.delete(identifier);

    if (this.blobStorePromises.has(identifier)) {
      await this.blobStorePromises.get(identifier);
    }

    this.blobStore.delete(identifier);
    this.blobStorePromises.delete(identifier);
    if (this.indexedDBManager) {
      await this.indexedDBManager.deleteFile(identifier);
    }

    return true;
  }

  async getBlob(identifier) {
    if (this.blobStore.has(identifier)) {
      return this.blobStore.get(identifier);
    }

    if (this.blobStorePromises.has(identifier)) {
      await this.blobStorePromises.get(identifier);
      if (this.indexedDBManager) {
        return await this.indexedDBManager.getFile(identifier);
      } else if (UseXHRTrick) {
        return this.blobStore.get(identifier);
      }
    }

    return null;
  }

  async clear() {
    this.blobStore.clear();
    this.blobStorePromises.clear();
    if (this.indexedDBManager) {
      await this.indexedDBManager.clearStorage();
    }
  }

  close() {
    return this.indexedDBManager?.close();
  }
}
