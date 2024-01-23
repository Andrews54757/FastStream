import {DownloadStatus} from '../enums/DownloadStatus.mjs';
import {PlayerModes} from '../enums/PlayerModes.mjs';
import {EnvUtils} from '../utils/EnvUtils.mjs';
import {DownloadEntry} from './DownloadEntry.mjs';
import {IndexedDBManager} from './IndexedDBManager.mjs';
import {StandardDownloader} from './StandardDownloader.mjs';

export class DownloadManager {
  constructor(client) {
    this.client = client;
    this.queue = [];

    this.storage = new Map();

    this.downloaders = [];

    this.speedTestBuffer = [];
    this.speedTestSeen = [];
    this.speedTestCount = 0;
    this.testing = true;
    this.lastSpeed = 0;

    this.failed = 0;

    this.indexedDBManager = null;
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
    if (!this.indexedDBManager || entry.status !== DownloadStatus.DOWNLOAD_COMPLETE || entry.storeRaw) return;

    const identifier = this.getIdentifier(entry);
    const data = entry.data;

    await this.indexedDBManager.setFile(identifier, data);

    entry.data = () => {
      return this.indexedDBManager.getFile(identifier);
    };
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
      this.indexedDBManager?.deleteFile(key);
    }
  }

  destroy() {
    this.downloaders.forEach((downloader) => {
      downloader.destroy();
    });
    this.downloaders = null;
    this.storage = null;
    this.indexedDBManager?.close();
    this.indexedDBManager = null;
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
      storedEntry.priority = priority;

      // append to end of priority queue
      let ind = this.queue.length;
      while (ind > 0 && this.queue[ind - 1].priority < priority) {
        ind--;
      }
      this.queue.splice(ind, 0, storedEntry);

      storedEntry.status = DownloadStatus.ENQUEUED;
      this.queueNext();
    }

    return watcher;
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

  removeAllDownloaders() {
    this.testing = false;
    this.downloaders.forEach((downloader) => {
      downloader.abort();
    });
    this.downloaders.length = 0;
  }

  onDownloaderFinished(downloader, entry) {
    if (navigator.onLine && entry.status === DownloadStatus.DOWNLOAD_FAILED && !entry.aborted &&
      this.downloaders.length > 1) {
      const ind = this.downloaders.indexOf(downloader);
      if (ind !== -1) {
        this.downloaders.splice(ind, 1);
        this.client.resetFailed();
        console.log('Downloader failed, removing downloader and trying again');
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
                const maxDownloaders = (this.client?.source?.mode === PlayerModes.ACCELERATED_YT) ? 2 : 6;
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
    if (this.queue.length === 0) return;

    if (this.queue[0].status !== DownloadStatus.ENQUEUED) {
      this.queue.shift();
      this.queueNext();
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
      await this.clearStorage();
    }

    this.downloaders?.push(new StandardDownloader(this));
  }

  async setup() {
    // Chrome can move blobs to file storage, so we don't need to use IndexedDB
    if (!EnvUtils.isChrome() && IndexedDBManager.isSupported()) {
      const indexedDBManager = new IndexedDBManager();
      try {
        await indexedDBManager.setup();
        this.indexedDBManager = indexedDBManager;
      } catch (e) {
        // IndexedDB is not supported
        console.warn('IndexedDB is not supported', e);
      }
    }
  }

  resetOverride(value) {
    this.dontClearStorage = value;
  }

  async clearStorage() {
    this.storage.clear();
    await this.indexedDBManager?.clearStorage();
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
