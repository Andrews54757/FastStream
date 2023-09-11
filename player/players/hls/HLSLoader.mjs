/* eslint-disable valid-jsdoc */

/**
     * Calling load() will start retrieving content located at given URL (HTTP GET).
     *
     * @param {object} context - loader context
     * @param {string} context.url - target URL
     * @param {string} context.responseType - loader response type (arraybuffer or default response type for playlist)
     * @param {number} [context.rangeStart] - start byte range offset
     * @param {number} [context.rangeEnd] - end byte range offset
     * @param {Boolean} [context.progressData] - true if onProgress should report partial chunk of loaded content
     * @param {object} config - loader config params
     * @param {number} config.maxRetry - Max number of load retries
     * @param {number} config.timeout - Timeout after which `onTimeOut` callback will be triggered (if loading is still not finished after that delay)
     * @param {number} config.retryDelay - Delay between an I/O error and following connection retry (ms). This to avoid spamming the server
     * @param {number} config.maxRetryDelay - max connection retry delay (ms)
     * @param {object} callbacks - loader callbacks
     * @param {onSuccessCallback} callbacks.onSuccess - Callback triggered upon successful loading of URL.
     * @param {onProgressCallback} callbacks.onProgress - Callback triggered while loading is in progress.
     * @param {onErrorCallback} callbacks.onError - Callback triggered if any I/O error is met while loading fragment.
     * @param {onTimeoutCallback} callbacks.onTimeout - Callback triggered if loading is still not finished after a certain duration.

      @callback onSuccessCallback
      @param response {object} - response data
      @param response.url {string} - response URL (which might have been redirected)
      @param response.data {string/arraybuffer/sharedarraybuffer} - response data (reponse type should be as per context.responseType)
      @param stats {LoadStats} - loading stats
      @param stats.aborted {boolean} - must be set to true once the request has been aborted
      @param stats.loaded {number} - nb of loaded bytes
      @param stats.total {number} - total nb of bytes
      @param stats.retry {number} - number of retries performed
      @param stats.chunkCount {number} - number of chunk progress events
      @param stats.bwEstimate {number} - download bandwidth in bits/s
      @param stats.loading { start: 0, first: 0, end: 0 }
      @param stats.parsing { start: 0, end: 0 }
      @param stats.buffering { start: 0, first: 0, end: 0 }
      @param context {object} - loader context
      @param networkDetails {object} - loader network details (the xhr for default loaders)

      @callback onProgressCallback
      @param stats {LoadStats} - loading stats
      @param context {object} - loader context
      @param data {string/arraybuffer/sharedarraybuffer} - onProgress data (should be defined only if context.progressData === true)
      @param networkDetails {object} - loader network details (the xhr for default loaders)

      @callback onErrorCallback
      @param error {object} - error data
      @param error.code {number} - error status code
      @param error.text {string} - error description
      @param context {object} - loader context
      @param networkDetails {object} - loader network details (the xhr for default loaders)

      @callback onTimeoutCallback
      @param stats {LoadStats} - loading stats
      @param context {object} - loader context

   */
export function HLSLoaderFactory(player) {
  return class HLSLoader {
    constructor() {
      this.stats = {};
    }

    copyStats(stats) {
      for (const key in stats) {
        if (Object.hasOwn(stats, key)) {
          this.stats[key] = stats[key];
        }
      }
    }

    load(context, config, callbacks) {
      const isFragment = context.frag !== undefined && context.keyInfo === undefined;

      this.callbacks = callbacks;
      this.config = config;
      this.context = context;

      if (isFragment) {
        this.loadFragmentInternal();
      } else {
        this.loadNonFragmentInternal();
      }
    }

    loadFragmentInternal() {
      try {
        const identifier = player.getIdentifier(this.context.frag.trackID, this.context.frag.level);
        const frag = player.client.getFragment(identifier, this.context.frag.sn);
        if (!frag) {
          console.error('Fragment not found', identifier, this.context.frag);
          throw new Error('Fragment not found');
        }
        this.loader = player.fragmentRequester.requestFragment(frag, {
          onSuccess: (response, stats, context, xhr) => {
            this.copyStats(stats);
            if (this.callbacks) {
              this.callbacks.onSuccess(response, this.stats, this.context, xhr);
            }
          },
          onProgress: (stats, context, data, xhr) => {
            this.copyStats(stats);
            if (this.callbacks?.onProgress) this.callbacks.onProgress(stats, this.context, data, xhr);
          },
          onFail: (entry) => {
            this.copyStats(entry.stats);
            if (this.stats.timeout) {
              if (this.callbacks) {
                this.callbacks.onTimeout(this.stats, this.context);
              }
            } else {
              if (this.callbacks) {
                this.callbacks.onError(this.stats.error, this.context, null);
              }
            }
          },

        }, this.config);
      } catch (e) {
        console.error(e);
      }
    }

    loadNonFragmentInternal() {
      this.loader = player.getClient().downloadManager.getFile({
        ...this.context,
        config: this.config,
        headers: {
          ...this.context.headers,
          ...player.source.headers,
        },
      }, {
        onSuccess: async (entry, xhr) => {
          this.copyStats(entry.stats);
          const data = await entry.getDataFromBlob();

          if (this.callbacks) {
            this.callbacks.onSuccess({
              url: entry.url,
              data: data,
            }, this.stats, this.context, null);
          }
        },
        onProgress: (stats, context2, data, xhr) => {
          this.copyStats(stats);
          if (this.callbacks?.onProgress) this.callbacks.onProgress(stats, this.context, data, xhr);
        },
        onFail: (entry) => {
          this.copyStats(entry.stats);
          if (this.callbacks) {
            if (this.stats.timeout) {
              this.callbacks.onTimeout(this.stats, this.context);
            } else {
              this.callbacks.onError(this.stats.error, this.context, null);
            }
          }
        },
      });
    }

    /** Abort any loading in progress. */
    abort() {
      if (this.loader) {
        this.loader.abort();
      }
    };

    /** Destroy loading context. */
    destroy() {
      this.callbacks = null;
      this.config = null;
      this.context = null;
      this.loader = null;
    }
  };
}
