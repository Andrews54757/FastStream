import {IndexedDBManager} from '../network/IndexedDBManager.mjs';
import {EnvUtils} from '../utils/EnvUtils.mjs';

const BrowserCanAutoOffloadBlobs = EnvUtils.isChrome();
const UseCache = !BrowserCanAutoOffloadBlobs && window.caches;
const UseIndexedDB = !BrowserCanAutoOffloadBlobs && !UseCache && IndexedDBManager.isSupported();

export class FSBlob {
  constructor() {
    this.blobStore = new Map();
    this.blobStorePromises = new Map();

    try {
      if (UseCache) {
        this.cache = true;
        this.setupPromise = this.setupOrphanedCache();
      } else if (UseIndexedDB) {
        this.indexedDBManager = new IndexedDBManager();
        this.setupPromise = this.indexedDBManager.setup();
      }
    } catch (e) {
      console.warn('FSBlob setup failed, falling back to memory storage', e);
      this.cache = null;
      this.indexedDBManager = null;
      this.setupPromise = null;
      this.blobStorePromises.clear();
    }

    this.blobIndex = 0;
  }

  async setupOrphanedCache() {
    const cacheName = 'blob-cache-' + Date.now() + '-' + Math.random();
    const cache = await window.caches.open(cacheName);
    // Orphan it!
    await window.caches.delete(cacheName);
    // Store the cache reference for later use
    this.cache = cache;
  }

  async saveBlobInIndexedDBAsync(identifier, blob) {
    try {
      await this.setupPromise;
    } catch (e) {
      // IndexedDB is not supported
      console.warn('IndexedDB is not supported, falling back to memory storage');
      this.indexedDBManager = null;
      this.setupPromise = false;
      this.blobStorePromises.clear();
      return false;
    }
    // Store file
    await this.indexedDBManager.setFile(identifier, blob);
    // Get file
    const file = await this.indexedDBManager.getFile(identifier);

    if (EnvUtils.isFirefox()) {
      // Delete file to orphan it
      await this.indexedDBManager.deleteFile(identifier);
    }

    this.blobStore.set(identifier, file);
    return true;
  }

  async saveBlobUsingCache(identifier, blob) {
    try {
      await this.setupPromise;
    } catch (e) {
      console.warn('Cache API is not supported, falling back to memory storage');
      this.cache = null;
      this.setupPromise = false;
      this.blobStorePromises.clear();
      return false;
    }

    const response = new Response(blob);
    const identifierURL = this.getIdentifierURL(identifier);

    await this.cache.put(identifierURL, response);

    const match = await this.cache.match(identifierURL);

    const blobResponse = await match?.blob();

    this.blobStore.set(identifier, blobResponse);
  }

  getIdentifierURL(identifier) {
    return 'https://faststream.online/blob-cache?identifier=' + encodeURIComponent(identifier);
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
    if (this.cache) {
      promise = this.saveBlobUsingCache(identifier, blob);
    } else if (this.indexedDBManager) {
      promise = this.saveBlobInIndexedDBAsync(identifier, blob);
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
    if (this.cache) {
      const identifierURL = this.getIdentifierURL(identifier);
      await this.cache.delete(identifierURL);
    } else if (this.indexedDBManager) {
      await this.indexedDBManager.deleteFile(identifier);
    }

    return true;
  }

  getBlob(identifier) {
    return this.blobStore.get(identifier);
  }

  async clear() {
    this.blobStore.clear();
    this.blobStorePromises.clear();
    if (this.cache) {
      // Setup a new cache entirely
      this.cache = true;
      this.setupPromise = this.setupOrphanedCache();
      await this.setupPromise;
    } else if (this.indexedDBManager) {
      await this.indexedDBManager.clearStorage();
    }
  }

  close() {
    return this.indexedDBManager?.close();
  }
}
