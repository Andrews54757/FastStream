import { DownloadStatus } from "../enums/DownloadStatus.mjs";
import { BlobManager } from "../utils/BlobManager.mjs";

export class DownloadEntry {

    constructor(details) {

        this.status = DownloadStatus.WAITING;


        this.url = details.url;
        this.rangeStart = details.rangeStart;
        this.rangeEnd = details.rangeEnd;
        this.responseType = details.responseType;

        this.headers = details.headers;
        this.storeRaw = details.storeRaw;

        this.config = details.config || {};

        this.preProcessor = details.preProcessor;

        this.data = null;
        this.responseHeaders = null;

        this.downloader = null;
        this.watchers = [];
    }

    addWatcher(watcher) {
        this.watchers.push(watcher);
    }

    removeWatcher(watcher) {
        let ind = this.watchers.indexOf(watcher);
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
        if (this.downloader) this.downloader.abort();
        else {
            this.onAbort();
        }
        this.cleanup();
    }

    cleanup() {
        this.preProcessor = null;
        this.downloader = null;
        this.watchers.length = 0;
    }

    destroy() {
        this.cleanup();
    }
    async onSuccess(response, stats, entry, xhr) {
        if (!this.downloader) {
            console.log("DownloadEntry.onSuccess called after abort");
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
        let mimeType = this.responseType === "arraybuffer" ? "application/octet-stream" : "text/plain";
        this.data = this.storeRaw ? response.data : BlobManager.createBlob([response.data], mimeType);
        this.stats = stats;

        this.watchers.forEach((watcher) => {
            watcher.callbacks.onSuccess(this, xhr);
        });
        this.cleanup();
    }

    onFail(stats, entry, xhr) {
        this.status = DownloadStatus.DOWNLOAD_FAILED;
        this.stats = stats;

        this.watchers.forEach((watcher) => {
            watcher.callbacks.onFail(this);
        });
        this.cleanup();
    }

    onAbort() {
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

    getData() {
        return this.data;
    }

    getDataFromBlob(type) {
        let blob = this.data;
        let reader = new FileReader();

        type = type || this.responseType;
        if (type === 'arraybuffer') {
            reader.readAsArrayBuffer(blob);
        } else {
            reader.readAsText(blob);
        }

        return new Promise((resolve, reject) => {

            reader.onload = () => {
                resolve(reader.result);
            }

            reader.onerror = () => {
                reject(reader.error);
            }
        });
    }
}