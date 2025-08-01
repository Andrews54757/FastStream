import {DownloadStatus} from '../enums/DownloadStatus.mjs';
import {SpeedTracker} from './SpeedTracker.mjs';
import {XHRLoader} from './XHRLoader.mjs';

export class StandardDownloader {
  constructor(manager) {
    this.speedTracker = new SpeedTracker();
    this.manager = manager;
    this.loader = null;
    this.entry = null;
    this.stats = null;
  }

  canHandle(details) {
    return this.loader === null;
  }

  getSpeed() {
    return this.speedTracker.getSpeed();
  }

  run(entry) {
    if (this.loader != null) {
      throw new Error('Downloader is busy.');
    }
    let shouldContinue = true;
    this.loader = {
      abort: () => {
        shouldContinue = false;
      },
      destroy: () => {
        shouldContinue = false;
      },
    };
    this.entry = entry;

    entry.downloader = this;
    entry.status = DownloadStatus.DOWNLOAD_INITIATED;

    const defaultConfig = {
      timeout: 30000,
      maxRetry: 6,
      retryDelay: 1000,
      maxRetryDelay: 64000,
      ...entry.config,
    };

    entry.getRequest().then((request)=>{
      if (!shouldContinue) {
        return;
      }
      this.loader = new XHRLoader();
      this.loader.addCallbacks(this);
      this.loader.load(request, defaultConfig);
    }).catch((err) => {
      console.error('Failed to get request for entry:', err);
      this.entry.onFail(this.loader.stats, this.entry, null);
      this.cleanup();
    });
  }

  abort() {
    this.loader?.abort();
    if (this.entry) this.entry.onAbort(this.loader.stats, this.entry, this.loader.xhr);
    this.cleanup();
  }

  cleanup() {
    if (this.entry) {
      this.loader.destroy();
      this.entry.downloader = null;
      this.loader = null;
      const entry = this.entry;
      this.entry = null;
      this.manager.onDownloaderFinished(this, entry);
    }
  }

  destroy() {
    this.entry = null;
    this.abort();
  }

  updateSpeed(stats) {
    this.stats = stats;
    stats.lastUpdate = performance.now();
    this.speedTracker.update(stats.loaded, stats.loading.start, stats.lastUpdate);
  }

  async onSuccess(response, stats, entry, xhr) {
    this.updateSpeed(stats);
    this.entry.onSuccess(response, stats, this.entry, xhr);
    this.cleanup();
  }

  onError(stats, entry, xhr) {
    this.updateSpeed(stats);
    this.entry?.onFail(stats, this.entry, xhr);
    this.cleanup();
  }

  onProgress(stats, context, data, xhr) {
    this.updateSpeed(stats);
    this.entry?.onProgress(stats, context, data, xhr);
  }

  onTimeout(stats, entry, xhr) {
    this.updateSpeed(stats);
    this.entry?.onFail(stats, this.entry, xhr);
    this.cleanup();
  }
};
