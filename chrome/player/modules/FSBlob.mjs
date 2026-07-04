import {IndexedDBManager} from '../network/IndexedDBManager.mjs';
import {AlertPolyfill} from '../utils/AlertPolyfill.mjs';
import {EnvUtils} from '../utils/EnvUtils.mjs';
import {Utils} from '../utils/Utils.mjs';
import {Localize} from './Localize.mjs';

const BrowserCanAutoOffloadBlobs = EnvUtils.isChrome();
const UseCacheByDefault = !BrowserCanAutoOffloadBlobs && window.caches;
const UseIndexedDBByDefault = !BrowserCanAutoOffloadBlobs && !UseCacheByDefault && IndexedDBManager.isSupported();

const PersistentCacheDBName = 'faststream-buffer-cache-v1';
const PersistentCacheVersion = 1;
const DefaultPersistenceConfig = {
  enabled: false,
  retentionDays: 7,
  maxBytes: 0,
};

export class FSBlob {
  constructor(config) {
    this.blobStore = new Map();
    this.blobStorePromises = new Map();

    this.cache = null;
    this.indexedDBManager = null;
    this.setupPromise = Promise.resolve();
    this.backendType = 'memory';
    this.cleanupTimer = null;
    this.cleanupPromise = null;
    this.configurePromise = Promise.resolve();
    this.persistenceConfig = {...DefaultPersistenceConfig};
    this.initialized = false;
    this.blobIndex = 0;

    this.configure(config || {}).catch((e) => {
      console.warn('FSBlob configure failed, using memory storage', e);
    });
  }

  normalizePersistenceConfig(config) {
    const normalized = {
      ...DefaultPersistenceConfig,
      ...(config || {}),
    };

    normalized.enabled = !!normalized.enabled;

    let retentionDays = parseInt(normalized.retentionDays, 10);
    if (isNaN(retentionDays)) retentionDays = DefaultPersistenceConfig.retentionDays;
    normalized.retentionDays = Math.min(Math.max(retentionDays, 1), 30);

    let maxBytes = parseInt(normalized.maxBytes, 10);
    if (isNaN(maxBytes) || maxBytes < 0) maxBytes = 0;
    normalized.maxBytes = maxBytes;

    return normalized;
  }

  shouldUsePersistentBackend(config) {
    return !!config.enabled && !EnvUtils.isIncognito() && IndexedDBManager.isSupported();
  }

  configure(config) {
    const normalized = this.normalizePersistenceConfig(config);
    const changed = !this.initialized ||
      this.persistenceConfig.enabled !== normalized.enabled ||
      this.persistenceConfig.retentionDays !== normalized.retentionDays ||
      this.persistenceConfig.maxBytes !== normalized.maxBytes;

    if (!changed) {
      return this.configurePromise;
    }

    const currentPersistentBackend = this.backendType === 'persistent-indexeddb';
    const nextPersistentBackend = this.shouldUsePersistentBackend(normalized);

    if (this.initialized && currentPersistentBackend === nextPersistentBackend &&
      this.persistenceConfig.enabled === normalized.enabled) {
      this.persistenceConfig = normalized;
      if (nextPersistentBackend) {
        this.configurePromise = this.configurePromise.then(async () => {
          await this.prunePersistentStorage(true);
        }).catch((e) => {
          console.warn('FSBlob persistent cleanup failed', e);
        });
      }
      return this.configurePromise;
    }

    this.configurePromise = this.configurePromise.then(async () => {
      await this.reinitializeBackend(normalized);
    }).catch((e) => {
      console.warn('FSBlob reconfigure failed, using memory storage', e);
      this.resetToMemoryBackend();
    });

    return this.configurePromise;
  }

  async reinitializeBackend(config) {
    const previousConfig = this.persistenceConfig;
    const previousBackend = this.backendType;

    this.persistenceConfig = config;
    this.initialized = true;

    clearTimeout(this.cleanupTimer);
    this.cleanupTimer = null;

    await this.closeBackend();
    this.blobStore.clear();
    this.blobStorePromises.clear();

    if (previousBackend === 'persistent-indexeddb' && !config.enabled && previousConfig.enabled) {
      await IndexedDBManager.deleteDB(PersistentCacheDBName);
    }

    if (this.shouldUsePersistentBackend(config)) {
      this.backendType = 'persistent-indexeddb';
      this.indexedDBManager = new IndexedDBManager(PersistentCacheDBName);
      this.setupPromise = this.indexedDBManager.setup();
      await this.setupPromise;
      await this.prunePersistentStorage(true);
      return;
    }

    if (UseCacheByDefault) {
      this.backendType = 'cache';
      this.cache = true;
      this.setupPromise = this.setupOrphanedCache();
      await this.setupPromise;
      return;
    }

    if (UseIndexedDBByDefault) {
      this.backendType = 'temp-indexeddb';
      this.indexedDBManager = new IndexedDBManager();
      this.setupPromise = this.indexedDBManager.setup();
      await this.setupPromise;
      return;
    }

    this.setupPromise = Promise.resolve();
    this.backendType = 'memory';
  }

  resetToMemoryBackend() {
    clearTimeout(this.cleanupTimer);
    this.cleanupTimer = null;
    this.cache = null;
    this.indexedDBManager = null;
    this.setupPromise = Promise.resolve();
    this.backendType = 'memory';
    this.blobStore.clear();
    this.blobStorePromises.clear();
    AlertPolyfill.alert(Localize.getMessage('player_outofstorage'));
  }

  async closeBackend() {
    this.cache = null;
    if (this.indexedDBManager) {
      try {
        await this.indexedDBManager.close();
      } catch (e) {
        console.warn(e);
      }
      this.indexedDBManager = null;
    }
    this.setupPromise = Promise.resolve();
  }

  async setupOrphanedCache() {
    const cacheName = 'blob-cache-' + Date.now() + '-' + Math.random();
    const cache = await window.caches.open(cacheName);
    // Orphan it so browser can reclaim when tab closes.
    await window.caches.delete(cacheName);
    this.cache = cache;
  }

  getIdentifierURL(identifier) {
    return 'https://faststream.online/blob-cache?identifier=' + encodeURIComponent(identifier);
  }

  nextIdentifier() {
    return `blob${this.blobIndex++}`;
  }

  setBlobEntry(identifier, data, size) {
    this.blobStore.set(identifier, {
      data,
      size: size === undefined ? Utils.getDataByteSize(data) : size,
    });
  }

  getBlobEntry(identifier) {
    return this.blobStore.get(identifier) || null;
  }

  getRetentionCutoff() {
    return Date.now() - this.persistenceConfig.retentionDays * 24 * 60 * 60 * 1000;
  }

  isExpiredMetadata(metadata) {
    const lastAccessed = metadata?.lastAccessed || metadata?.createdAt || 0;
    return lastAccessed < this.getRetentionCutoff();
  }

  schedulePersistentCleanup() {
    if (this.backendType !== 'persistent-indexeddb' || this.cleanupTimer) return;
    this.cleanupTimer = setTimeout(() => {
      this.cleanupTimer = null;
      this.prunePersistentStorage().catch((e) => {
        console.warn('Persistent cache cleanup failed', e);
      });
    }, 1000);
  }

  async prunePersistentStorage(force = false) {
    if (this.backendType !== 'persistent-indexeddb' || !this.indexedDBManager) return;
    if (this.cleanupPromise && !force) return this.cleanupPromise;

    const run = async () => {
      await this.setupPromise;

      const now = Date.now();
      const allMetadata = await this.indexedDBManager.getAllFileMetadata();
      const staleIdentifiers = [];
      const candidates = [];

      allMetadata.forEach((meta) => {
        const identifier = meta?.identifier;
        if (!identifier) {
          return;
        }

        if (meta.cacheVersion !== PersistentCacheVersion || this.isExpiredMetadata(meta)) {
          staleIdentifiers.push(identifier);
          return;
        }

        const size = parseInt(meta.size, 10) || 0;
        const lastAccessed = parseInt(meta.lastAccessed, 10) || parseInt(meta.createdAt, 10) || now;
        candidates.push({
          identifier,
          size,
          lastAccessed,
        });
      });

      await Promise.all(staleIdentifiers.map((identifier) => this.deletePersistentEntry(identifier)));

      if (this.persistenceConfig.maxBytes <= 0) {
        return;
      }

      let totalSize = candidates.reduce((sum, item) => sum + item.size, 0);
      if (totalSize <= this.persistenceConfig.maxBytes) {
        return;
      }

      candidates.sort((a, b) => a.lastAccessed - b.lastAccessed);
      const evicted = [];
      while (candidates.length > 0 && totalSize > this.persistenceConfig.maxBytes) {
        const item = candidates.shift();
        evicted.push(item.identifier);
        totalSize -= item.size;
      }

      await Promise.all(evicted.map((identifier) => this.deletePersistentEntry(identifier)));
    };

    this.cleanupPromise = run().finally(() => {
      this.cleanupPromise = null;
    });

    return this.cleanupPromise;
  }

  async deletePersistentEntry(identifier) {
    this.blobStore.delete(identifier);
    this.blobStorePromises.delete(identifier);
    if (!this.indexedDBManager) return;

    await Promise.all([
      this.indexedDBManager.deleteFile(identifier),
      this.indexedDBManager.deleteFileMetadata(identifier),
    ]);
  }

  async saveBlobUsingCache(identifier, blob) {
    await this.setupPromise;

    const response = new Response(blob);
    const identifierURL = this.getIdentifierURL(identifier);
    await this.cache.put(identifierURL, response);
    const match = await this.cache.match(identifierURL);
    const cachedBlob = await match?.blob();

    this.setBlobEntry(identifier, cachedBlob || blob);
    return true;
  }

  async saveBlobInIndexedDBAsync(identifier, blob) {
    await this.setupPromise;

    await this.indexedDBManager.setFile(identifier, blob);

    if (this.backendType === 'persistent-indexeddb') {
      const now = Date.now();
      const existingMeta = await this.indexedDBManager.getFileMetadata(identifier);
      const metadata = {
        identifier,
        size: Utils.getDataByteSize(blob),
        createdAt: existingMeta?.createdAt || now,
        lastAccessed: now,
        cacheVersion: PersistentCacheVersion,
      };
      await this.indexedDBManager.setFileMetadata(identifier, metadata);
      this.setBlobEntry(identifier, blob, metadata.size);
      this.schedulePersistentCleanup();
      return true;
    }

    const file = await this.indexedDBManager.getFile(identifier);
    if (EnvUtils.isFirefox()) {
      await this.indexedDBManager.deleteFile(identifier);
    }
    this.setBlobEntry(identifier, file || blob);
    return true;
  }

  async saveBlobAsync(blob, identifier) {
    await this.configurePromise;

    if (!identifier) {
      identifier = this.nextIdentifier();
    }

    this.setBlobEntry(identifier, blob);

    let promise = Promise.resolve(true);
    try {
      if (this.backendType === 'cache') {
        promise = this.saveBlobUsingCache(identifier, blob);
      } else if (this.backendType === 'temp-indexeddb' || this.backendType === 'persistent-indexeddb') {
        promise = this.saveBlobInIndexedDBAsync(identifier, blob);
      }
    } catch (e) {
      console.warn('Blob backend write failed, using memory fallback', e);
      this.resetToMemoryBackend();
      promise = Promise.resolve(false);
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

  async getStoredBlobEntry(identifier) {
    await this.configurePromise;

    if (this.blobStorePromises.has(identifier)) {
      await this.blobStorePromises.get(identifier).catch(() => {});
    }

    const inMemory = this.getBlobEntry(identifier);
    if (inMemory) {
      return inMemory;
    }

    if (this.backendType === 'cache' && this.cache) {
      await this.setupPromise;
      const identifierURL = this.getIdentifierURL(identifier);
      const response = await this.cache.match(identifierURL);
      if (!response) return null;
      const blob = await response.blob();
      this.setBlobEntry(identifier, blob);
      return this.getBlobEntry(identifier);
    }

    if (this.backendType === 'persistent-indexeddb' && this.indexedDBManager) {
      await this.setupPromise;

      const metadata = await this.indexedDBManager.getFileMetadata(identifier);
      if (!metadata) return null;

      if (metadata.cacheVersion !== PersistentCacheVersion || this.isExpiredMetadata(metadata)) {
        await this.deletePersistentEntry(identifier);
        return null;
      }

      const file = await this.indexedDBManager.getFile(identifier);
      if (!file) {
        await this.indexedDBManager.deleteFileMetadata(identifier);
        return null;
      }

      const now = Date.now();
      metadata.lastAccessed = now;
      if (!metadata.size) {
        metadata.size = Utils.getDataByteSize(file);
      }
      await this.indexedDBManager.setFileMetadata(identifier, metadata);

      this.setBlobEntry(identifier, file, metadata.size);
      return this.getBlobEntry(identifier);
    }

    return null;
  }

  async getBlob(identifier) {
    const record = await this.getStoredBlobEntry(identifier);
    return record?.data || null;
  }

  async deleteBlob(identifier) {
    this.blobStore.delete(identifier);

    if (this.blobStorePromises.has(identifier)) {
      await this.blobStorePromises.get(identifier).catch(() => {});
    }

    this.blobStore.delete(identifier);
    this.blobStorePromises.delete(identifier);

    if (this.backendType === 'cache' && this.cache) {
      await this.setupPromise;
      const identifierURL = this.getIdentifierURL(identifier);
      await this.cache.delete(identifierURL);
    } else if ((this.backendType === 'temp-indexeddb' || this.backendType === 'persistent-indexeddb') && this.indexedDBManager) {
      await this.setupPromise;
      await this.indexedDBManager.deleteFile(identifier);
      if (this.backendType === 'persistent-indexeddb') {
        await this.indexedDBManager.deleteFileMetadata(identifier);
      }
    }

    return true;
  }

  async clear(options = {}) {
    const clearPersistent = options.clearPersistent !== false;

    this.blobStore.clear();
    this.blobStorePromises.clear();

    if (this.backendType === 'cache' && this.cache) {
      this.cache = true;
      this.setupPromise = this.setupOrphanedCache();
      await this.setupPromise;
      return;
    }

    if ((this.backendType === 'temp-indexeddb' || this.backendType === 'persistent-indexeddb') && this.indexedDBManager) {
      await this.setupPromise;

      if (this.backendType === 'persistent-indexeddb' && !clearPersistent) {
        return;
      }

      await this.indexedDBManager.clearStorage();
      if (this.backendType === 'persistent-indexeddb') {
        await this.indexedDBManager.clearFileMetadataStorage();
      }
    }
  }

  close() {
    clearTimeout(this.cleanupTimer);
    this.cleanupTimer = null;
    this.blobStore.clear();
    this.blobStorePromises.clear();
    return this.closeBackend();
  }
}
