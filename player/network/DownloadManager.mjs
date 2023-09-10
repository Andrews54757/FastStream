import {DownloadStatus} from '../enums/DownloadStatus.mjs';
import {DownloadEntry} from './DownloadEntry.mjs';
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
    }
  }

  destroy() {
    this.downloaders.forEach((downloader) => {
      downloader.destroy();
    });
    this.downloaders = null;
    this.storage = null;
  }

  getFile(details, callbacks) {
    const key = this.getIdentifier(details);
    let storedEntry = this.storage.get(key);
    //  console.log("get file", key, storedEntry)

    if (!storedEntry) {
      storedEntry = new DownloadEntry(details);
      this.storage.set(key, storedEntry);
    }

    if (storedEntry.status === DownloadStatus.DOWNLOAD_FAILED) {
      storedEntry = new DownloadEntry(details);
      this.storage.set(key, storedEntry);
    }

    if (storedEntry.status === DownloadStatus.DOWNLOAD_COMPLETE) {
      callbacks.onSuccess(storedEntry);
      this.client.predownloadFragments();
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

    if (storedEntry.status === DownloadStatus.WAITING) {
      this.queue.push(storedEntry);
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
    if (this.testing) {
      const ind = this.downloaders.indexOf(downloader);
      if (ind !== -1) {
        if (entry.status === DownloadStatus.DOWNLOAD_FAILED && !entry.aborted) {
          this.downloaders.splice(ind, 1);
          this.client.resetFailed();
          console.log('Downloader failed, removing downloader and trying again');
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
                if (this.downloaders.length < 6) {
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

  reset() {
    this.abortAll();
    this.clearStorage();
    this.testing = true;
    this.downloaders = [];
    this.speedTestBuffer = [];
    this.speedTestSeen = [];
    this.speedTestCount = 0;
    this.lastSpeed = 0;

    this.failed = 0;

    this.downloaders.push(new StandardDownloader(this));
  }

  clearStorage() {
    this.storage.clear();
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
}
