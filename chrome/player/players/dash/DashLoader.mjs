import {StringUtils} from '../../utils/StringUtils.mjs';


export function DASHLoaderFactory(player) {
  return (cfg) => {
    cfg = cfg || {};

    function load(httpRequest) {
      const requestObj = httpRequest.customData.request;
      if (requestObj.type === 'InitializationSegment' ||
                requestObj.type === 'MediaSegment') {
        loadFragmentInternal(httpRequest);
        return;
      }

      // console.log(httpRequest.request)
      request(httpRequest);
    }

    function loadFragmentInternal(httpRequest) {
      try {
        const requestObj = httpRequest.customData.request;
        const representation = requestObj.representation;
        if (!representation) {
          request(httpRequest);
          return;
        }
        let segmentIndex = requestObj.index;

        if (requestObj.type === 'InitializationSegment') {
          segmentIndex = -1;
        }

        const identifier = representation.id;
        const frag = player.client.getFragment(identifier, segmentIndex);
        if (!frag) {
          console.warn('Fragment not found', requestObj, identifier, player.client.getFragments(identifier));
          // throw new Error("Fragment not found");
          request(httpRequest);
          return;
        }

        // if (representation !== frag.request.representation) {
        //   console.log(representation, frag.request.representation);
        //   // throw new Error("URL mismatch");
        //   request(httpRequest);
        //   return;
        // }

        // console.log("frag found", frag, requestObj)
        httpRequest._loader = player.fragmentRequester.requestFragment(frag, {
          onSuccess: (entry, data) => {
            httpRequest.customData.onSuccess(data, entry.responseURL);
          },
          onProgress: (stats, context, data, xhr) => {

          },
          onFail: (entry) => {
            httpRequest.customData.onFail(entry);
          },
          onAbort: (entry) => {
            httpRequest.customData.onAbort(entry);
          },
        }, null, 1000);
      } catch (e) {
        console.error(e);
      }
    }

    function request(httpRequest) {
      // Variables will be used in the callback functions
      const request = httpRequest.customData.request;

      let rangeStart = undefined;
      let rangeEnd = undefined;

      if (request.range) {
        const [start, end] = StringUtils.parseHTTPRange(request.range);
        if (start === undefined) {
          console.warn('Failed to parse range', request.range);
        } else {
          rangeStart = start;
          rangeEnd = end + 1;
        }
        delete httpRequest.headers.Range;
      }
      const context = {
        url: decodeURI(httpRequest.url),
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

      //   console.log('context', context, httpRequest.customData.request);
      const loader = player.getClient().downloadManager.getFile(context, {
        onSuccess: async (entry, xhr) => {
          const data = await entry.getDataFromBlob();
          httpRequest.customData.onSuccess(data, entry.responseURL);
        },
        onProgress: (stats, context, data, xhr)=> {

        },
        onFail: (entry)=> {
          httpRequest.customData.onFail(entry);
        },
        onAbort: (entry) => {
          httpRequest.customData.onAbort(entry);
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
