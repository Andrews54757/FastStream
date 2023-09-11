

export function DASHLoaderFactory(player) {
  return (cfg) => {
    cfg = cfg || {};

    function load(httpRequest) {
      if (httpRequest.request.type === 'InitializationSegment' ||
                httpRequest.request.type === 'MediaSegment') {
        loadFragmentInternal(httpRequest);
        return;
      }

      // console.log(httpRequest.request)
      request(httpRequest);
    }

    function loadFragmentInternal(httpRequest) {
      try {
        if (!httpRequest.request.mediaInfo) {
          //   console.error("No mediainfo", httpRequest.request);
          request(httpRequest);
          return;
        }
        const streamLevel = httpRequest.request.mediaInfo.streamInfo.index;
        const trackIndex = httpRequest.request.mediaInfo.index;
        const qualityIndex = httpRequest.request.quality;
        let segmentIndex = httpRequest.request.index;

        if (httpRequest.request.type === 'InitializationSegment') {
          segmentIndex = -1;
        }


        const identifier = player.getLevelIdentifier(streamLevel, trackIndex, qualityIndex);
        const frag = player.client.getFragment(identifier, segmentIndex);
        if (!frag) {
          console.warn('Fragment not found', httpRequest.request, identifier, player.client.getFragments(identifier));
          // throw new Error("Fragment not found");
          request(httpRequest);
          return;
        }

        // console.log("frag found", frag, httpRequest.request)
        httpRequest._loader = player.fragmentRequester.requestFragment(frag, {
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
          },

        });
      } catch (e) {
        console.error(e);
      }
    }

    function request(httpRequest) {
      // Variables will be used in the callback functions
      const request = httpRequest.request;

      let rangeStart = undefined;
      let rangeEnd = undefined;

      if (request.range && request.range.indexOf('-') > -1) {
        const range = request.range.split('-');
        rangeStart = parseInt(range[0], 10);
        rangeEnd = parseInt(range[1], 10) + 1;
      }

      //  console.log("request",request, httpRequest.request.range, rangeStart, rangeEnd, httpRequest.request.mediaInfo.representations)
      const context = {
        url: httpRequest.url,
        method: httpRequest.method || 'GET',
        responseType: request.responseType,
        rangeStart: rangeStart,
        rangeEnd: rangeEnd,
        config: {
          maxRetry: 0,
          timeout: 10000,
          retryDelay: 1000,
          maxRetryDelay: 64000,
        },
        headers: {
          ...httpRequest.headers,
          ...player.source.headers,
        },
      };

      const loader = player.getClient().downloadManager.getFile(context, {
        onSuccess: async (entry, xhr) => {
          const data = await entry.getDataFromBlob();
          httpRequest.onSuccess(data, entry.responseURL);
        },
        onProgress: (stats, context, data, xhr)=> {

        },
        onFail: (entry)=> {
          httpRequest.onFail(entry);
        },
        onAbort: (entry) => {
          httpRequest.onAbort(entry);
        },
      });

      httpRequest._loader = loader;
    }

    function abort(request) {
      if (request._loader) {
        request._loader.abort();
        request._loader = null;
      }
    }

    return {
      load: load,
      abort: abort,
    };
  };
}
