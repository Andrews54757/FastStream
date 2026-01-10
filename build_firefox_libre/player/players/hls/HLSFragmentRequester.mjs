import {DefaultPlayerEvents} from '../../enums/DefaultPlayerEvents.mjs';
import {DownloadStatus} from '../../enums/DownloadStatus.mjs';
import {HLSDecrypter} from './HLSDecrypter.mjs';
export class HLSFragmentRequester {
  constructor(player) {
    this.player = player;
    this.decrypter = new HLSDecrypter();
  }
  destroy() {
    this.decrypter.destroy();
  }
  requestFragment(fragment, callbacks, config, priority) {
    const context = fragment.getContext();
    config = config || {};
    if (fragment.status === DownloadStatus.WAITING) {
      fragment.status = DownloadStatus.DOWNLOAD_INITIATED;
      this.player.emit(DefaultPlayerEvents.FRAGMENT_UPDATE, fragment);
    }
    const frag = fragment.getFrag();
    if (frag.decryptdata) {
      throw new Error('unexpected decryptdata');
    }
    let keyPromise;
    if (frag.fs_oldcryptdata) {
      const toGet = {
        url: frag.fs_oldcryptdata.uri,
        rangeStart: 0,
        rangeEnd: 0,
        responseType: 'arraybuffer',
        storeRaw: true,
        headers: {
          ...config.headers,
          ...this.player.source.headers,
        },
      };
      keyPromise = new Promise((resolve, reject) => {
        this.player.getClient().downloadManager.getFile(toGet, {
          onSuccess: async (entry) => {
            resolve(await entry.getData());
          },
          onFail: (err) => {
            console.log('failed to get key', err);
            reject(err);
          },
          onAbort: (err) => {
            console.log('key aborted', err);
            reject(err);
          },
        });
      });
    }
    const loader = this.player.getClient().downloadManager.getFile({
      ...context,
      config,
      headers: {
        ...config.headers,
        ...this.player.source.headers,
      },
      postProcessor: async (entry, response) => {
        if (!frag.fs_oldcryptdata) {
          return response;
        }
        const key = await keyPromise;
        const decryptdata = frag.fs_oldcryptdata;
        if (!decryptdata.iv || !key) {
          console.error('missing decryptdata', decryptdata, key);
          this.player.emit(DefaultPlayerEvents.NEED_KEY);
          return response;
        }
        response.data = await this.decrypter.decryptAES(response.data, decryptdata.iv.buffer, key);
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
          this.player.emit(DefaultPlayerEvents.FRAGMENT_UPDATE, fragment);
        }
        callbacks.onSuccess({
          url: entry.url,
          data: data,
        }, entry.stats, context, null);
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
