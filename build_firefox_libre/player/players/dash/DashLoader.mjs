import {StringUtils} from '../../utils/StringUtils.mjs';
import {DashTrackUtils} from './DashTrackUtils.mjs';
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
      request(httpRequest);
    }
    function loadFragmentInternal(httpRequest) {
      // console.log(httpRequest);
      try {
        const requestObj = httpRequest.customData.request;
        const representation = requestObj.representation;
        if (!representation) {
          console.error('Representation not found', requestObj);
          request(httpRequest, true, requestObj.startTime || 0, true);
          return;
        }
        let segmentIndex = requestObj.index;
        if (requestObj.type === 'InitializationSegment') {
          segmentIndex = -1;
        }
        const level = DashTrackUtils.getLevelFromRepresentation(representation);
        const frag = player.client.getFragment(level, segmentIndex);
        if (!frag) {
          console.warn('Fragment not found', requestObj, level, player.client.getFragments(level));
          // throw new Error("Fragment not found");
          request(httpRequest, true, requestObj.startTime || 0, requestObj.type === 'InitializationSegment' || isNaN(segmentIndex));
          return;
        }
        const activeRequests = player.activeRequests;
        const loader = player.fragmentRequester.requestFragment(frag, {
          onSuccess: (entry, data) => {
            httpRequest.customData.onSuccess(data, entry.responseURL);
            const index = activeRequests.indexOf(loader);
            if (index > -1) {
              activeRequests.splice(index, 1);
            }
          },
          onProgress: (stats, context, data, xhr) => {
          },
          onFail: (entry) => {
            httpRequest.customData.onAbort(entry);
            const index = activeRequests.indexOf(loader);
            if (index > -1) {
              activeRequests.splice(index, 1);
            }
          },
          onAbort: (entry) => {
            httpRequest.customData.onAbort(entry);
            const index = activeRequests.indexOf(loader);
            if (index > -1) {
              activeRequests.splice(index, 1);
            }
          },
        }, null, 1000);
        httpRequest.customData.abort = () => {
          loader.abort();
        };
        httpRequest._loader = loader;
        if (segmentIndex !== -1) {
          activeRequests.push(loader);
        }
      } catch (e) {
        console.error(e);
      }
    }
    function request(httpRequest, isSegment = false, startTime = 0, isInit = false) {
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
      const loader = player.getClient().downloadManager.getFile({
        ...context,
        preProcessor: async (entry, request) => {
          if (isSegment && player.preProcessFragment) {
            return await player.preProcessFragment(entry, request, startTime, isInit);
          }
          return request;
        },
        postProcessor: async (entry, response) => {
          if (isSegment && player.postProcessFragment) {
            return await player.postProcessFragment(entry, response, startTime, isInit);
          }
          return response;
        },
      }, {
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
      httpRequest.customData.abort = () => {
        loader.abort();
      };
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
      reset: () => {
        // Reset any internal state if needed
      },
    };
  };
}
