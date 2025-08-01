import {DefaultPlayerEvents} from '../../enums/DefaultPlayerEvents.mjs';
import {DownloadStatus} from '../../enums/DownloadStatus.mjs';

export class DashFragmentRequester {
  constructor(player) {
    this.player = player;
  }

  requestFragment(fragment, callbacks, config, priority) {
    const context = fragment.getContext();
    config = config || {};

    if (fragment.status === DownloadStatus.WAITING) {
      fragment.status = DownloadStatus.DOWNLOAD_INITIATED;
      this.player.emit(DefaultPlayerEvents.FRAGMENT_UPDATE, fragment);
    }

    const loader = this.player.getClient().downloadManager.getFile({
      ...context,
      config,
      headers: {
        ...config.headers,
        ...this.player.source.headers,
      },
      preProcessor: async (entry, request) => {
        if (this.player.preProcessFragment) {
          try {
            const startTime = fragment.start;
            const isInit = fragment.sn === -1;
            return await this.player.preProcessFragment(entry, request, startTime, isInit);
          } catch (e) {
            console.error('Error in preProcessor:', e);
            throw e;
          }
        }
        return request;
      },
      postProcessor: async (entry, response) => {
        if (this.player.postProcessFragment) {
          try {
            const startTime = fragment.start;
            const isInit = fragment.sn === -1;
            return await this.player.postProcessFragment(entry, response, startTime, isInit);
          } catch (e) {
            console.error('Error in postProcessor:', e);
            throw e;
          }
        }
        return response;
      },
    }, {
      onSuccess: async (entry, xhr) => {
        let data;
        try {
          if (!callbacks.skipProcess) {
            data = await entry.getDataFromBlob();
          }
          fragment.dataSize = entry.dataSize;
        } catch (e) {
          console.error(e);
          fragment.status = DownloadStatus.DOWNLOAD_FAILED;
          this.player.emit(DefaultPlayerEvents.FRAGMENT_UPDATE, fragment);
          callbacks.onFail(entry);
          return;
        }
        if (fragment.status !== DownloadStatus.DOWNLOAD_COMPLETE) {
          fragment.status = DownloadStatus.DOWNLOAD_COMPLETE;
          //    console.log(fragment)
          this.player.emit(DefaultPlayerEvents.FRAGMENT_UPDATE, fragment);
        }
        callbacks.onSuccess(entry, data);
      },
      onProgress: (stats, context2, data, xhr) => {
        if (callbacks.onProgress) callbacks.onProgress(stats, context, data, xhr);
      },
      onFail: (entry) => {
        fragment.status = DownloadStatus.DOWNLOAD_FAILED;
        this.player.emit(DefaultPlayerEvents.FRAGMENT_UPDATE, fragment);
        callbacks.onFail(entry);
      },
      onAbort: (entry) => {
        fragment.status = DownloadStatus.WAITING;
        this.player.emit(DefaultPlayerEvents.FRAGMENT_UPDATE, fragment);
        if (callbacks.onAbort) callbacks.onAbort(entry);
      },
    }, priority);

    return loader;
  }
}
