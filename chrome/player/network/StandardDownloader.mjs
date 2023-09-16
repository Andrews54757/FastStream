import {DownloadStatus} from '../enums/DownloadStatus.mjs';
import {XHRLoader} from './XHRLoader.mjs';

export class StandardDownloader {
  constructor(manager) {
    this.manager = manager;
    this.loader = null;
    this.entry = null;
    this.stats = null;
  }

  canHandle(details) {
    return this.loader == null;
  }

  getSpeed() {
    if (!this.stats) return 0;
    const dt = (this.stats.loading.end - this.stats.loading.start) / 1000;
    return this.stats.loaded / dt;
  }

  run(entry) {
    if (this.loader != null) {
      throw new Error('Downloader is busy.');
    }
    this.loader = new XHRLoader();
    this.entry = entry;

    entry.downloader = this;
    entry.status = DownloadStatus.DOWNLOAD_INITIATED;


    const defaultConfig = {
      timeout: 20000,
      maxRetry: 6,
      retryDelay: 1000,
      maxRetryDelay: 64000,
      ...entry.config,
    };
    this.loader.addCallbacks(this);
    this.loader.load(entry, defaultConfig);
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
  }

  async onSuccess(response, stats, entry, xhr) {
    this.updateSpeed(stats);
    this.entry.onSuccess(response, stats, entry, xhr);
    this.cleanup();
  }

  onError(stats, entry, xhr) {
    this.updateSpeed(stats);
    this.entry?.onFail(stats, entry, xhr);
    this.cleanup();
  }

  onProgress(stats, context, data, xhr) {
    this.updateSpeed(stats);
    this.entry?.onProgress(stats, context, data, xhr);
  }

  onTimeout(stats, entry, xhr) {
    this.updateSpeed(stats);
    this.entry?.onFail(stats, entry, xhr);
    this.cleanup();
  }
};
