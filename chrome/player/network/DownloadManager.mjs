import {DownloadStatus} from '../enums/DownloadStatus.mjs';
import {PlayerModes} from '../enums/PlayerModes.mjs';
import {FSBlob} from '../modules/FSBlob.mjs';
import {DownloadEntry} from './DownloadEntry.mjs';
import {StandardDownloader} from './StandardDownloader.mjs';

export class DownloadManager {
  constructor(client) {
    this.client = client;
    this.queue = [];

    this.storage = new Map();

    this.downloaders = [];
    this.paused = false;
    this.speedTestBuffer = [];
    this.speedTestSeen = [];
    this.speedTestCount = 0;
    this.testing = true;
    this.lastSpeed = 0;
    this.lastFailed = 0;

    this.failed = 0;

    this.blobStore = new FSBlob();
    this.storageConfig = {
      persistBufferedVideos: false,
      persistBufferRetentionDays: 7,
      persistBufferMaxSizeMB: 0,
    };
    this.storageConfigPromise = Promise.resolve();
    this.setOptions(this.client?.options || {});
  }

  getCompletedEntries() {
    const entries = [];
    this.storage.forEach((entry) => {
      if (entry.status === DownloadStatus.DOWNLOAD_COMPLETE) {
        entries.push(entry);
      }
    });
    return entries;
  }

  setEntries(entries) {
    entries.forEach((entry) => {
      this.setEntry(entry);
    });
  }

  async archiveEntryData(entry) {
    if (entry.status !== DownloadStatus.DOWNLOAD_COMPLETE || entry.storeRaw || typeof entry.data === 'function') {
      return;
    }

    const identifier = this.getIdentifier(entry);
    await this.blobStore.saveBlobAsync(entry.data, identifier);

    entry.data = async () => {
      const blobEntry = await this.blobStore.getStoredBlobEntry(identifier);
      return blobEntry?.data || null;
    };
  }

  setOptions(options = {}) {
    const persistBufferedVideos = !!options.persistBufferedVideos;
    const persistBufferRetentionDays = Math.min(Math.max(parseInt(options.persistBufferRetentionDays ?? 7, 10), 1), 30);
    const persistBufferMaxSizeMB = Math.max(parseInt(options.persistBufferMaxSizeMB ?? 0, 10), 0);

    const changed =
      this.storageConfig.persistBufferedVideos !== persistBufferedVideos ||
      this.storageConfig.persistBufferRetentionDays !== persistBufferRetentionDays ||
      this.storageConfig.persistBufferMaxSizeMB !== persistBufferMaxSizeMB;

    if (!changed) return;

    this.storageConfig = {
      persistBufferedVideos,
      persistBufferRetentionDays,
      persistBufferMaxSizeMB,
    };

    this.storageConfigPromise = this.blobStore.configure({
      enabled: this.storageConfig.persistBufferedVideos,
      retentionDays: this.storageConfig.persistBufferRetentionDays,
      maxBytes: this.storageConfig.persistBufferMaxSizeMB * 1024 * 1024,
    }).catch((e) => {
      console.warn('Failed to configure blob storage backend', e);
    });
  }

  setEntry(entry) {
    const identifier = this.getIdentifier(entry);

    if (entry.status === DownloadStatus.DOWNLOAD_COMPLETE) {
      this.archiveEntryData(entry);
    } else {
      entry.setTransferFunction(this.archiveEntryData.bind(this));
    }

    this.storage.set(identifier, entry);
  }

  canGetFile(details) {
    const key = this.getIdentifier(details);
    const storedEntry = this.storage.get(key);

    if (storedEntry?.status === DownloadStatus.DOWNLOAD_COMPLETE) {
      return true;
    }

    if (this.queue.length > 0) {
      return false;
    }

    if (this.paused) return false;

    return !this.downloaders.every((downloader) => {
      return !downloader.canHandle(details);
    });
  }

  getEntry(details) {
    const key = this.getIdentifier(details);
    return this.storage.get(key);
  }

  removeFile(details) {
    const key = this.getIdentifier(details);
    const storedEntry = this.storage.get(key);
    if (storedEntry) {
      storedEntry.destroy();
      this.storage.delete(key);
      this.blobStore.deleteBlob(key);
    }
  }

  destroy() {
    this.downloaders.forEach((downloader) => {
      downloader.destroy();
    });
    this.downloaders = null;
    this.storage = null;
    this.blobStore.close();
    this.blobStore = null;
  }

  getFile(details, callbacks, priority) {
    priority = priority || 0;
    const key = this.getIdentifier(details);
    let storedEntry = this.storage.get(key);
    //  console.log("get file", key, storedEntry)

    if (!storedEntry || storedEntry.status === DownloadStatus.DOWNLOAD_FAILED) {
      storedEntry = new DownloadEntry(details);
      this.setEntry(storedEntry);
    }

    if (storedEntry.status === DownloadStatus.DOWNLOAD_COMPLETE) {
      callbacks.onSuccess(storedEntry);
      return {
        entry: storedEntry,
        abort: () => {
          // nothing
        },
        callbacks: callbacks,
      };
    }

    storedEntry.preProcessor = details.preProcessor;
    storedEntry.postProcessor = details.postProcessor;

    const watcher = {
      entry: storedEntry,
      abort: () => {
        watcher.entry.abortWatcher(watcher);
      },
      callbacks: callbacks,

    };

    storedEntry.addWatcher(watcher);

    if (storedEntry.status === DownloadStatus.ENQUEUED && storedEntry.priority < priority) {
      // remove from queue
      storedEntry.status = DownloadStatus.WAITING;
      const ind = this.queue.indexOf(storedEntry);
      if (ind !== -1) {
        this.queue.splice(ind, 1);
      }
    }

    if (storedEntry.status === DownloadStatus.WAITING) {
      this.resolveEntryFromStorageOrQueue(storedEntry, priority).catch((e) => {
        console.warn('Failed to resolve storage entry', e);
        if (storedEntry.status === DownloadStatus.WAITING) {
          this.enqueueEntry(storedEntry, storedEntry.pendingPriority || priority);
        }
      });
    }

    return watcher;
  }

  enqueueEntry(entry, priority) {
    if (entry.status !== DownloadStatus.WAITING) return;

    entry.priority = priority;

    // append to end of priority queue
    let ind = this.queue.length;
    while (ind > 0 && this.queue[ind - 1].priority < priority) {
      ind--;
    }
    this.queue.splice(ind, 0, entry);

    entry.status = DownloadStatus.ENQUEUED;
    this.queueNext();
  }

  async resolveEntryFromStorageOrQueue(entry, priority) {
    if (entry.status !== DownloadStatus.WAITING) return;

    if (!entry.pendingPriority || entry.pendingPriority < priority) {
      entry.pendingPriority = priority;
    }

    if (entry.cacheLookupPromise) return;

    entry.cacheLookupPromise = (async () => {
      await this.storageConfigPromise;
      const identifier = this.getIdentifier(entry);
      const record = await this.blobStore.getStoredBlobEntry(identifier);
      if (!record) return false;
      if (entry.status !== DownloadStatus.WAITING) return true;

      const now = self.performance?.now ? self.performance.now() : Date.now();
      entry.status = DownloadStatus.DOWNLOAD_COMPLETE;
      entry.dataSize = record.size || 0;
      entry.data = async () => {
        const blobEntry = await this.blobStore.getStoredBlobEntry(identifier);
        return blobEntry?.data || null;
      };
      entry.responseHeaders = {};
      entry.responseURL = entry.url;
      entry.stats = {
        aborted: false,
        timedout: false,
        loaded: entry.dataSize,
        total: entry.dataSize,
        retry: 0,
        chunkCount: 0,
        bwEstimate: 0,
        loading: {
          start: now,
          first: now,
          end: now,
        },
        parsing: {
          start: now,
          end: now,
        },
        buffering: {
          start: now,
          first: now,
          end: now,
        },
      };

      entry.watchers.forEach((watcher) => {
        watcher.callbacks.onSuccess(entry);
      });
      entry.cleanup();
      return true;
    })();

    let restored = false;
    try {
      restored = await entry.cacheLookupPromise;
    } catch (e) {
      console.warn('Persistent storage lookup failed', e);
    } finally {
      entry.cacheLookupPromise = null;
    }

    if (!restored && entry.status === DownloadStatus.WAITING) {
      this.enqueueEntry(entry, entry.pendingPriority || priority);
    }
  }

  getSpeed() {
    let totalSpeed = 0;
    this.downloaders.forEach((downloader) => {
      totalSpeed += downloader.getSpeed();
    });

    return totalSpeed;
  }

  addDownloader() {
    this.testing = false;
    this.downloaders.push(new StandardDownloader(this));
    this.client.predownloadFragments();
    this.queueNext();
  }

  removeDownloader() {
    this.testing = false;
    const downloader = this.downloaders.pop();

    downloader.abort();
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    this.downloaders.forEach((downloader) => {
      downloader.abort();
    });
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.client.predownloadFragments();
    for (let i = 0; i < this.downloaders.length; i++) {
      this.queueNext();
    }
  }

  removeAllDownloaders() {
    this.testing = false;
    this.downloaders.forEach((downloader) => {
      downloader.abort();
    });
    this.downloaders.length = 0;
  }

  onDownloaderFinished(downloader, entry) {
    if (this.paused) return;

    if (navigator.onLine && entry.status === DownloadStatus.DOWNLOAD_FAILED && !entry.aborted) {
      this.lastFailed = Date.now();

      if (this.downloaders.length > 1) {
        const ind = this.downloaders.indexOf(downloader);
        if (ind !== -1) {
          this.downloaders.splice(ind, 1);
          this.client.resetFailed();
          console.log('Downloader failed, removing downloader and trying again');
        }
      }
    }

    if (this.testing) {
      const ind = this.downloaders.indexOf(downloader);
      if (ind !== -1) {
        if (entry.status === DownloadStatus.DOWNLOAD_FAILED && !entry.aborted) {
          this.failed++;
          if (this.failed >= 4) {
            console.log('Speed test failed');
            this.testing = false;
          }
        } else {
          if (!this.speedTestSeen[ind] && downloader.getSpeed()) {
            this.speedTestCount++;
          }
          this.speedTestSeen[ind] = true;


          if (this.speedTestCount >= this.downloaders.length) {
            let speed = this.getSpeed();

            this.speedTestBuffer.push(speed);
            this.speedTestSeen = [];
            this.speedTestCount = 0;

            if (this.speedTestBuffer.length >= 3) {
              speed = this.speedTestBuffer.reduce((a, b) => a + b, 0) / this.speedTestBuffer.length;
              this.speedTestBuffer = [];

              if (speed > this.lastSpeed) {
                const maxDownloaders = (this.client?.source?.mode === PlayerModes.ACCELERATED_YT) ? 1 : (this.client?.options?.maximumDownloaders || 0);
                if (this.downloaders.length < maxDownloaders) {
                  console.log('Adding downloader, speed: ' + speed);
                  this.downloaders.push(new StandardDownloader(this));
                  this.lastSpeed = speed;
                } else {
                  this.testing = false;
                  console.log('Speed test finished (maxed out), speed: ' + this.getSpeed());
                }
              } else {
                console.log('Speed test finished, speed: ' + speed);
                this.testing = false;
              }
            }
          }
        }
      }
    }


    this.client.predownloadFragments();
    this.queueNext();
  }

  queueNext() {
    if (this.paused) return;
    if (this.queue.length === 0) return;

    if (this.queue[0].status !== DownloadStatus.ENQUEUED) {
      this.queue.shift();
      this.queueNext();
      return;
    }

    const failCooldown = 1000;
    if (this.lastFailed + failCooldown > Date.now()) {
      if (this.failCooldown) clearTimeout(this.failCooldown);
      this.failCooldown = setTimeout(() => {
        this.queueNext();
      }, failCooldown + 100);
      return;
    }

    const downloader = this.downloaders.find((downloader) => {
      return downloader.canHandle(this.queue[0].details);
    });

    if (downloader) {
      const entry = this.queue.shift();
      downloader.run(entry);
    }
  }

  getIdentifier(details) {
    const url = details.url;
    const rangeStart = details.rangeStart;
    const rangeEnd = details.rangeEnd;
    const responseType = details.responseType;

    return url + '::' + rangeStart + '-' + rangeEnd + '::' + responseType;
  }

  async reset() {
    this.abortAll();

    this.testing = true;
    this.downloaders = [];
    this.speedTestBuffer = [];
    this.speedTestSeen = [];
    this.speedTestCount = 0;
    this.lastSpeed = 0;

    this.failed = 0;

    if (!this.dontClearStorage) {
      await this.clearStorage(this.storageConfig.persistBufferedVideos);
    }

    this.downloaders?.push(new StandardDownloader(this));
  }

  async setup() {
    this.setOptions(this.client?.options || {});
    await this.storageConfigPromise;
  }

  resetOverride(value) {
    this.dontClearStorage = value;
  }

  async clearStorage(preservePersistent = false) {
    this.storage.clear();
    await this.blobStore.clear({
      clearPersistent: !preservePersistent,
    });
  }

  abortAll() {
    this.queue.forEach((entry) => {
      entry.abort();
    });
    this.queue.length = 0;

    this.downloaders.forEach((downloader) => {
      downloader.abort();
    });
  }

  getStorageByteCount() {
    let count = 0;
    this.storage.forEach((entry) => {
      count += entry.getDataSize();
    });
    return count;
  }
}
