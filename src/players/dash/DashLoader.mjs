

export function DASHLoaderFactory(player) {
    return (cfg) => {

        cfg = cfg || {};
        let instance;


        function load(httpRequest) {
            
            if (httpRequest.request.type === "InitializationSegment" || 
                httpRequest.request.type === "MediaSegment") {
                loadFragmentInternal(httpRequest);
                return;
            }

            //console.log(httpRequest.request)
            request(httpRequest);

        }

        function loadFragmentInternal(httpRequest) {
            try {
                const trackIndex = httpRequest.request.mediaInfo.index;
                const qualityIndex = httpRequest.request.quality;
                let segmentIndex = httpRequest.request.index;

                if (httpRequest.request.type === "InitializationSegment") {
                    segmentIndex = -1;
                }

                httpRequest._loader = player.fragmentRequester.requestFragment(player.client.getFragment(trackIndex + ":" + qualityIndex, segmentIndex), {
                    onSuccess: (entry, data) => {
                        httpRequest.onSuccess(data, entry.responseURL);
                    },
                    onProgress: (stats, context, data, xhr) => {

                    },
                    onFail: (entry) => {
                       httpRequest.onFail(entry);
                    },
                    onAbort: (entry) => {
                        httpRequest.onAbort(entry);
                    }

                });
            } catch (e) {
                console.error(e);
            }
        }

        function request(httpRequest) {
            // Variables will be used in the callback functions
            const request = httpRequest.request;

            const rangeStart = undefined;
            const rangeEnd = undefined;

            if (request.range && request.range.indexOf('-') > -1) {
                const range = request.range.split('-');
                rangeStart = parseInt(range[0], 10);
                rangeEnd = parseInt(range[1], 10);
            }

            const context = {
                url: httpRequest.url,
                method: httpRequest.method || "GET",
                responseType: request.responseType,
                rangeStart: rangeStart,
                rangeEnd: rangeEnd,
                config: {
                    maxRetry: 0,
                    timeout: 10000,
                    retryDelay: 1000,
                    maxRetryDelay: 64000
                },
                headers: {
                    ...httpRequest.headers,
                    ...player.source.headers
                }
            }

            const loader = player.getClient().downloadManager.getFile(context, {
                onSuccess: async (entry, xhr) => {
                    let data = await entry.getDataFromBlob();
                    httpRequest.onSuccess(data, entry.responseURL);
                },
                onProgress: (stats, context, data, xhr)=> {

                },
                onFail: (entry)=> {
                    httpRequest.onFail(entry);
                },
                onAbort: (entry) => {
                    httpRequest.onAbort(entry);
                }
            });

            httpRequest._loader = loader;




            // let xhr = new XMLHttpRequest();
            // xhr.open(httpRequest.method, httpRequest.url, true);

            // if (request.responseType) {
            //     xhr.responseType = request.responseType;
            // }

            // if (request.range) {
            //     xhr.setRequestHeader('Range', 'bytes=' + request.range);
            // }

            // if (!request.requestStartDate) {
            //     request.requestStartDate = requestStartTime;
            // }

            // if (httpRequest.headers) {
            //     for (let header in httpRequest.headers) {
            //         let value = httpRequest.headers[header];
            //         if (value) {
            //             xhr.setRequestHeader(header, value);
            //         }
            //     }
            // }

            // xhr.withCredentials = httpRequest.withCredentials;

            // xhr.onload = httpRequest.onload;
            // xhr.onloadend = httpRequest.onend;
            // xhr.onerror = httpRequest.onerror;
            // xhr.onprogress = httpRequest.progress;
            // xhr.onabort = httpRequest.onabort;
            // xhr.ontimeout = httpRequest.ontimeout;
            // xhr.timeout = httpRequest.timeout;

            // xhr.send();

            // httpRequest.response = xhr;
        }

        function abort(request) {
            if (request._loader) {
                request._loader.abort();
                request._loader = null;
            }
        }

        instance = {
            load: load,
            abort: abort
        };

        return instance;
    }
}