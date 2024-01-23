import {DownloadStatus} from '../enums/DownloadStatus.mjs';
import {BlobManager} from '../utils/BlobManager.mjs';
import {Utils} from '../utils/Utils.mjs';

export class DownloadEntry {
  constructor(details) {
    this.status = DownloadStatus.WAITING;
    this.priority = 0;

    this.url = details.url;
    this.rangeStart = details.rangeStart;
    this.rangeEnd = details.rangeEnd;
    this.responseType = details.responseType;

    this.headers = details.headers;
    this.storeRaw = details.storeRaw;

    this.config = details.config || {};

    this.preProcessor = details.preProcessor;

    this.data = null;
    this.dataSize = 0;
    this.responseHeaders = null;

    this.downloader = null;
    this.watchers = [];
    this.transferFile = null;

    this.responseURL = null;
  }

  addWatcher(watcher) {
    this.watchers.push(watcher);
  }

  removeWatcher(watcher) {
    const ind = this.watchers.indexOf(watcher);
    if (ind != -1) this.watchers.splice(ind, 1);
  }

  abortWatcher(watcher) {
    this.removeWatcher(watcher);
    if (this.watchers.length === 0) {
      if (watcher.callbacks.onAbort) watcher.callbacks.onAbort(this);
      this.abort();
    }
  }

  abort() {
    this.status = DownloadStatus.DOWNLOAD_FAILED;
    this.aborted = true;
    if (this.downloader) {
      this.downloader.abort();
    } else {
      this.onAbort();
    }
    this.cleanup();
  }

  cleanup() {
    this.preProcessor = null;
    this.downloader = null;
    this.transferFile = null;
    this.watchers.length = 0;
  }

  destroy() {
    this.abort();
  }

  async onSuccess(response, stats, entry, xhr) {
    if (!this.downloader) {
      console.error('DownloadEntry.onSuccess called after abort');
    }

    this.responseHeaders = response.headers;

    try {
      if (this.preProcessor) {
        response = await this.preProcessor(this, response);
      }
    } catch (e) {
      console.error(e);
      this.status = DownloadStatus.DOWNLOAD_FAILED;
      this.watchers.forEach((watcher) => {
        watcher.callbacks.onFail(this);
      });
      this.cleanup();
      return;
    }

    if (this.status !== DownloadStatus.DOWNLOAD_INITIATED) return; // abort was called


    this.status = DownloadStatus.DOWNLOAD_COMPLETE;
    const mimeType = this.responseType === 'arraybuffer' ? 'application/octet-stream' : 'text/plain';

    const data = this.storeRaw ? response.data : BlobManager.createBlob([response.data], mimeType);
    this.dataSize = Utils.getDataByteSize(data);

    this.data = data;

    this.stats = stats;
    this.responseURL = response.url;

    this.watchers.forEach((watcher) => {
      watcher.callbacks.onSuccess(this, xhr);
    });

    if (this.transferFile) {
      this.transferFile(this);
    }
    this.cleanup();
  }

  setTransferFunction(transferFile) {
    this.transferFile = transferFile;
  }

  onFail(stats, entry, xhr) {
    this.status = DownloadStatus.DOWNLOAD_FAILED;
    this.stats = stats;

    this.watchers.forEach((watcher) => {
      watcher.callbacks.onFail(this);
    });
    this.cleanup();
  }

  onAbort(stats) {
    if (stats) this.stats = stats;
    this.status = DownloadStatus.DOWNLOAD_FAILED;

    this.watchers.forEach((watcher) => {
      if (watcher.callbacks.onAbort) watcher.callbacks.onAbort(this);
    });
    this.cleanup();
  }

  onProgress(stats, context, data, xhr) {
    this.watchers.forEach((watcher) => {
      if (watcher.callbacks.onProgress) {
        watcher.callbacks.onProgress(stats, context, data, xhr);
      }
    });
  }

  async getData() {
    return typeof this.data === 'function' ? await this.data() : this.data;
  }

  async getDataFromBlob(type) {
    type = type || this.responseType;
    return BlobManager.getDataFromBlob(await this.getData(), type);
  }

  getDataSize() {
    return this.dataSize;
  }
}
