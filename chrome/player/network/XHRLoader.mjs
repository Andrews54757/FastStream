import {MessageTypes} from '../enums/MessageTypes.mjs';
import {EnvUtils} from '../utils/EnvUtils.mjs';
import {RequestUtils} from '../utils/RequestUtils.mjs';
import {URLUtils} from '../utils/URLUtils.mjs';
export class XHRLoader {
  constructor() {
    this.callbacks = [];
    this.stats = {
      aborted: false,
      timedout: false,
      loaded: 0,
      total: 0,
      retry: 0,
      chunkCount: 0,
      bwEstimate: 0,
      loading: {
        start: 0,
        first: 0,
        end: 0,
      },
      parsing: {
        start: 0,
        end: 0,
      },
      buffering: {
        start: 0,
        first: 0,
        end: 0,
      },
    };
    this.retryDelay = 0;
  }

  addCallbacks(callbacks) {
    if (this.callbacks !== null) {
      this.callbacks.push(callbacks);
    } else {
      throw new Error('Callbacks added too late');
    }
  }

  load(request, config) {
    if (this.stats.loading.start) {
      throw new Error('Loader can only be used once.');
    }
    this.request = request;
    this.config = config;
    this.retryDelay = config.retryDelay;
    this.loadInternal();
  };

  /** Abort any loading in progress. */
  abort() {
    if (this.callbacks !== null) {
      this.callbacks = null;
      this.abortInternal();
    }
  };

  /** Destroy loading entry. */
  destroy() {
    this.callbacks = null;
    this.abortInternal();
    this.loader = null;
  }

  abortInternal() {
    const loader = this.loader;
    self.clearTimeout(this.requestTimeout);
    self.clearTimeout(this.retryTimeout);
    if (loader) {
      loader.onreadystatechange = null;
      loader.onprogress = null;
      if (loader.readyState !== 4) {
        this.stats.aborted = true;
        loader.abort();
      }
    }
  }

  async loadInternal() {
    // console.warn('Loading', this.request.url, 'with', this.config);
    this.stats.loading.start = self.performance.now();

    const {config, request} = this;
    if (!config) {
      return;
    }
    const xhr = (this.loader = new XMLHttpRequest());

    const stats = this.stats;
    stats.loading.first = 0;
    stats.loaded = 0;

    const method = request.method || 'GET';
    try {
      xhr.open(method, request.url, true);

      const headers = this.request.headers;
      if (headers) {
        const {customHeaderCommands, regularHeaders} = RequestUtils.splitSpecialHeaders(headers);
        for (const header in regularHeaders) {
          if (!Object.hasOwn(headers, header)) continue;
          xhr.setRequestHeader(header, headers[header]);
        }

        if (customHeaderCommands.length) {
          if (EnvUtils.isExtension()) {
            await chrome.runtime.sendMessage({
              type: MessageTypes.SET_HEADERS,
              url: request.url,
              commands: customHeaderCommands,
            });
          }
        }
      }
    } catch (e) {
      // IE11 throws an exception on xhr.open if attempting to access an HTTP resource over HTTPS
      this.stats.error = {code: xhr.status, text: e.message};
      this.callbacks?.forEach((callbacks) => {
        callbacks.onError(
            this.stats,
            request,
            xhr,
        );
      });
      return;
    }

    if (request.rangeEnd) {
      xhr.setRequestHeader(
          'Range',
          'bytes=' + request.rangeStart + '-' + (request.rangeEnd - 1),
      );
    }

    xhr.onreadystatechange = this.readystatechange.bind(this);
    xhr.onprogress = this.loadprogress.bind(this);
    xhr.responseType = request.responseType;
    // setup timeout before we perform request
    self.clearTimeout(this.requestTimeout);
    this.requestTimeout = self.setTimeout(
        this.loadtimeout.bind(this),
        config.timeout,
    );
    // send body if any
    if (request.body) {
      xhr.send(request.body);
    } else {
      xhr.send();
    }
  }

  readystatechange() {
    const {request, loader: xhr, stats} = this;
    if (!request || !xhr) {
      return;
    }
    const readyState = xhr.readyState;
    const config = this.config;

    // don't proceed if xhr has been aborted
    if (stats.aborted) {
      return;
    }

    // >= HEADERS_RECEIVED
    if (readyState >= 2) {
      // clear xhr timeout and rearm it if readyState less than 4
      self.clearTimeout(this.requestTimeout);
      if (stats.loading.first === 0) {
        stats.loading.first = Math.max(
            self.performance.now(),
            stats.loading.start,
        );
      }

      if (readyState === 4) {
        xhr.onreadystatechange = null;
        xhr.onprogress = null;
        const status = xhr.status;
        // http status between 200 to 299 are all successful
        const isArrayBuffer = xhr.responseType === 'arraybuffer';

        if (
          status >= 200 &&
                    status < 300 &&
                    ((isArrayBuffer && xhr.response) || xhr.responseText !== null)
        ) {
          stats.loading.end = Math.max(
              self.performance.now(),
              stats.loading.first,
          );
          let data;
          let len;
          if (isArrayBuffer) {
            data = xhr.response;
            len = data.byteLength;
          } else {
            data = xhr.responseText;
            len = data.length;
          }
          stats.loaded = stats.total = len;
          if (!this.callbacks) {
            return;
          }


          this.callbacks?.forEach((callbacks) => {
            if (callbacks.onProgress) {
              callbacks.onProgress(stats, request, data, xhr);
            }
          });

          if (!this.callbacks) {
            return;
          }
          const response = {
            url: xhr.responseURL,
            headers: URLUtils.headersStringToObj(xhr.getAllResponseHeaders()),
            data: data,
          };

          this.callbacks.forEach((callbacks) => {
            callbacks.onSuccess(response, stats, request, xhr);
          });
          this.callbacks = null;
        } else {
          // if max nb of retries reached or if http status between 400 and 499 (such error cannot be recovered, retrying is useless), return error
          if (
            stats.retry >= config.maxRetry ||
                        (status >= 400 && status < 499)
          ) {
            console.error(`${status} while loading ${request.url}`);

            this.stats.error = {code: status, text: xhr.statusText};
            this.callbacks?.forEach((callbacks) => {
              callbacks?.onError(
                  this.stats,
                  request,
                  xhr,
              );
            });
          } else {
            // retry
            console.warn(
                `${status} while loading ${request.url}, retrying in ${this.retryDelay}...`,
            );
            this.retry();
          }
        }
      } else {
        // readyState >= 2 AND readyState !==4 (readyState = HEADERS_RECEIVED || LOADING) rearm timeout as xhr not finished yet
        self.clearTimeout(this.requestTimeout);
        this.requestTimeout = self.setTimeout(
            this.loadtimeout.bind(this),
            config.timeout,
        );
      }
    }
  }

  retry() {
    const {stats} = this;
    this.abortInternal();
    this.loader = null;
    // schedule retry
    self.clearTimeout(this.retryTimeout);
    this.retryTimeout = self.setTimeout(
        this.loadInternal.bind(this),
        this.retryDelay,
    );
    // // set exponential backoff
    // this.retryDelay = Math.min(
    //     2 * this.retryDelay,
    //     config.maxRetryDelay,
    // );
    stats.retry++;
  }

  loadtimeout() {
    console.warn(`timeout while loading ${this.request.url}`);

    if (this.stats.retry < this.config.maxRetry / 2) {
      this.retry();
      return;
    }

    this.callbacks?.forEach((callbacks) => {
      callbacks.onTimeout(this.stats, this.request, this.loader);
    });
    this.abortInternal();
  }

  loadprogress(event) {
    const stats = this.stats;

    stats.loaded = event.loaded;
    if (event.lengthComputable) {
      stats.total = event.total;
    }
  }

  getCacheAge() {
    let result = null;
    if (
      this.loader &&
            AGE_HEADER_LINE_REGEX.test(this.loader.getAllResponseHeaders())
    ) {
      const ageHeader = this.loader.getResponseHeader('age');
      result = ageHeader ? parseFloat(ageHeader) : null;
    }
    return result;
  }
};
