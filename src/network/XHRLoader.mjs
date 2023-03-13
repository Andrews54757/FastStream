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
                end: 0
            },
            parsing: {
                start: 0,
                end: 0
            },
            buffering: {
                start: 0,
                first: 0,
                end: 0
            }
        }
        this.retryDelay = 0;
    }

    addCallbacks(callbacks) {
        if (this.callbacks !== null) {
            this.callbacks.push(callbacks);
        } else {
            throw new Error('Callbacks added too late');
        }
    }

    load(entry, config) {
        if (this.stats.loading.start) {
            throw new Error('Loader can only be used once.');
        }
        this.stats.loading.start = self.performance.now();
        this.entry = entry;
        this.config = config;
        this.retryDelay = config.retryDelay;
        this.loadInternal();
    };

    /** Abort any loading in progress. */
    abort() {
        if (this.callbacks !== null) {
            this.abortInternal();
        }
    };

    /** Destroy loading entry. */
    destroy() {
        this.callbacks = null;
        this.abortInternal();
        this.loader = null;
        this.config = null;
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
        this.stats.loading.start = self.performance.now();

        const { config, entry } = this;
        if (!config) {
            return;
        }
        const xhr = (this.loader = new XMLHttpRequest());

        const stats = this.stats;
        stats.loading.first = 0;
        stats.loaded = 0;

        try {
            xhr.open('GET', entry.url, true);

            const headers = this.entry.headers;
            if (headers) {

                let customHeaderCommands = [];
                for (const header in headers) {
                    let name = header;
                    if (name.substring(0, 13) === 'x-faststream-') {
                        let command = name.substring(13);
                        let ind = command.indexOf('-');
                        let key = command.substring(0, ind);
                        let headerName = command.substring(ind + 1);
                        if (key === 'setheader') {
                            customHeaderCommands.push({ operation: 'set', header: headerName, value: headers[header] });
                        } else if (key === 'removeheader') {
                            customHeaderCommands.push({ operation: 'remove', header: headerName });
                        }
                    } else {
                        xhr.setRequestHeader(header, headers[header]);
                    }
                }

                if (customHeaderCommands.length) {
                    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
                        await chrome.runtime.sendMessage({
                            type: "header_commands",
                            url: entry.url,
                            commands: customHeaderCommands
                        });
                    }
                }
            }

        } catch (e) {

            // IE11 throws an exception on xhr.open if attempting to access an HTTP resource over HTTPS
            this.stats.error = { code: xhr.status, text: e.message };
            this.callbacks?.forEach((callbacks) => {
                callbacks.onError(
                    this.stats,
                    entry,
                    xhr
                );
            });
            return;
        }

        if (entry.rangeEnd) {
            xhr.setRequestHeader(
                'Range',
                'bytes=' + entry.rangeStart + '-' + (entry.rangeEnd - 1)
            );
        }

        xhr.onreadystatechange = this.readystatechange.bind(this);
        xhr.onprogress = this.loadprogress.bind(this);
        xhr.responseType = entry.responseType;
        // setup timeout before we perform request
        self.clearTimeout(this.requestTimeout);
        this.requestTimeout = self.setTimeout(
            this.loadtimeout.bind(this),
            config.timeout
        );
        xhr.send();
    }

    parseHeaders(headerStr) {
        var headers = {};
        if (!headerStr) {
            return headers;
        }
        var headerPairs = headerStr.split('\u000d\u000a');
        for (var i = 0; i < headerPairs.length; i++) {
            var headerPair = headerPairs[i];
            // Can't use split() here because it does the wrong thing
            // if the header value has the string ": " in it.
            var index = headerPair.indexOf('\u003a\u0020');
            if (index > 0) {
                var key = headerPair.substring(0, index);
                var val = headerPair.substring(index + 2);
                headers[key.toLowerCase()] = val;
            }
        }
        return headers;
    }
    readystatechange() {

        const { entry, loader: xhr, stats } = this;
        if (!entry || !xhr) {
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
                    stats.loading.start
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
                        stats.loading.first
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
                            callbacks.onProgress(stats, entry, data, xhr);
                        }
                    });

                    if (!this.callbacks) {
                        return;
                    }
                    const response = {
                        url: xhr.responseURL,
                        headers: this.parseHeaders(xhr.getAllResponseHeaders()),
                        data: data
                    };

                    this.callbacks.forEach((callbacks) => {

                        callbacks.onSuccess(response, stats, entry, xhr);
                    });
                    this.callbacks = null;

                } else {
                    // if max nb of retries reached or if http status between 400 and 499 (such error cannot be recovered, retrying is useless), return error
                    if (
                        stats.retry >= config.maxRetry ||
                        (status >= 400 && status < 499)
                    ) {
                        console.error(`${status} while loading ${entry.url}`);

                        this.stats.error = { code: status, text: xhr.statusText };
                        this.callbacks?.forEach((callbacks) => {
                            callbacks?.onError(
                                this.stats,
                                entry,
                                xhr
                            );
                        });

                    } else {
                        // retry
                        console.warn(
                            `${status} while loading ${entry.url}, retrying in ${this.retryDelay}...`
                        );
                        // abort and reset internal state
                        this.abortInternal();
                        this.loader = null;
                        // schedule retry
                        self.clearTimeout(this.retryTimeout);
                        this.retryTimeout = self.setTimeout(
                            this.loadInternal.bind(this),
                            this.retryDelay
                        );
                        // set exponential backoff
                        this.retryDelay = Math.min(
                            2 * this.retryDelay,
                            config.maxRetryDelay
                        );
                        stats.retry++;
                    }
                }
            } else {
                // readyState >= 2 AND readyState !==4 (readyState = HEADERS_RECEIVED || LOADING) rearm timeout as xhr not finished yet
                self.clearTimeout(this.requestTimeout);
                this.requestTimeout = self.setTimeout(
                    this.loadtimeout.bind(this),
                    config.timeout
                );
            }
        }
    }

    loadtimeout() {
        console.warn(`timeout while loading ${this.entry.url}`);
        this.abortInternal();
        this.callbacks?.forEach((callbacks) => {
            callbacks.onTimeout(this.stats, this.entry, this.loader);
        });
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
