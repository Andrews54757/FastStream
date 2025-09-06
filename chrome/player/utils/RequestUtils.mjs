import {MessageTypes} from '../enums/MessageTypes.mjs';
import {LargeBuffer} from '../modules/LargeBuffer.mjs';
import {EnvUtils} from './EnvUtils.mjs';
import {URLUtils} from './URLUtils.mjs';


export const SpecialHeaders = [
  'origin',
  'referer',
  'user-agent',
  'sec-fetch-site',
  'sec-fetch-mode',
  'sec-fetch-dest',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform',
  'x-client-data',
  'cookie',
];

/**
 * Utility functions for HTTP requests and header manipulation.
 */
export class RequestUtils {
  /**
   * Splits headers into special and regular headers for custom handling.
   * @param {Object} headers - The headers object.
   * @return {Object} An object with customHeaderCommands and regularHeaders.
   */
  static splitSpecialHeaders(headers) {
    const customHeaderCommands = [];
    const regularHeaders = {};
    for (const header in headers) {
      if (!Object.hasOwn(headers, header)) continue;
      const name = header.toLowerCase();
      if (SpecialHeaders.includes(name)) {
        if (headers[header] === false) {
          customHeaderCommands.push({operation: 'remove', header});
        } else {
          customHeaderCommands.push({operation: 'set', header, value: headers[header]});
        }
      } else {
        regularHeaders[header] = headers[header];
      }
    }
    return {customHeaderCommands, regularHeaders};
  }
  /**
   * Makes an HTTP request using XMLHttpRequest with various options.
   * @param {Object} options - Request options.
   * @param {string} options.url - The request URL.
   * @param {string} [options.method] - HTTP method (GET, POST, etc.).
   * @param {Object} [options.headers] - Headers to set.
   * @param {Object} [options.query] - Query parameters.
   * @param {string} [options.responseType] - Response type.
   * @param {Object} [options.range] - Byte range for partial requests.
   * @param {Function} [options.onProgress] - Progress callback.
   * @param {boolean} [options.usePlusForSpaces] - Use plus for spaces in query.
   * @param {any} [options.data] - Data to send in the request body.
   * @param {any} [options.body] - Alias for data.
   * @param {Array} [options.header_commands] - Custom header commands for extension.
   * @return {Promise<XMLHttpRequest>} Resolves with the XMLHttpRequest object.
   */
  static request(options) {
    return new Promise(async (resolve, reject) => {
      const xmlHttp = new XMLHttpRequest();
      options.xmlHttp = xmlHttp;
      if (options.responseType !== undefined) xmlHttp.responseType = options.responseType;
      let sent = false;
      xmlHttp.addEventListener('load', function() {
        if (sent) return;
        sent = true;
        resolve(xmlHttp);
      });
      xmlHttp.addEventListener('error', () => {
        if (sent) return;
        sent = true;
        resolve(xmlHttp);
      });
      xmlHttp.addEventListener('timeout', () => {
        if (sent) return;
        sent = true;
        resolve(xmlHttp);
      });
      xmlHttp.addEventListener('abort', () => {
        if (sent) return;
        sent = true;
        resolve(xmlHttp);
      });

      xmlHttp.addEventListener('progress', (e) => {
        if (options.onProgress) options.onProgress(e);
      });

      let query = '';
      if (options.query) {
        query = '?' + Object.keys(options.query).filter((key) => {
          return options.query[key] !== undefined && options.query[key] !== null && options.query[key] !== '';
        }).map((key) => {
          if (options.usePlusForSpaces) {
            return encodeURIComponent(key) + '=' + encodeURIComponent(options.query[key]).replace(/%20/g, '+');
          }
          return encodeURIComponent(key) + '=' + encodeURIComponent(options.query[key]);
        }).join('&');
      }
      const method = options.method || options.type || 'GET';

      xmlHttp.open(method, options.url + query, true); // true for asynchronous
      if (options.range !== undefined) {
        xmlHttp.setRequestHeader('Range', 'bytes=' + options.range.start + '-' + options.range.end);
      }

      // xmlHttp.setRequestHeader('Origin', '');
      if (options.headers) {
        for (const name in options.headers) {
          if (Object.hasOwn(options.headers, name)) {
            xmlHttp.setRequestHeader(name, options.headers[name]);
          }
        }
      }

      if (options.header_commands) {
        if (EnvUtils.isExtension()) {
          await chrome.runtime.sendMessage({
            type: MessageTypes.SET_HEADERS,
            url: options.url,
            commands: options.header_commands,
          });
        }
      }


      xmlHttp.send(options.data || options.body);
    });
  }

  /**
   * Makes a simple HTTP request and returns the XMLHttpRequest object.
   * @param {Object|string} details - Request details or URL string.
   * @param {Function} [callback] - Optional callback(error, xhr, responseText).
   * @return {Promise<XMLHttpRequest>} Resolves with the XMLHttpRequest object.
   */
  static async requestSimple(details, callback) {
    if (typeof details === 'string') {
      details = {
        url: details,
      };
    }
    // use request()
    let xhr;
    try {
      xhr = await this.request(details);
    } catch (e) {
      console.warn(e);
      if (callback) callback(e, xhr, false);
      return xhr;
    }

    // check error
    if (xhr.status !== 200 && xhr.status !== 206) {
      if (callback) {
        callback(new Error(`Bad status code: ${xhr.status}`), xhr, false);
      }
      return xhr;
    }

    // success
    if (callback) callback(undefined, xhr, xhr.responseText);
    return xhr;
  }

  /**
   * Downloads a large file in fragments using range requests and returns a LargeBuffer.
   * @param {string} source - The URL of the large file.
   * @return {Promise<LargeBuffer>} Resolves with a LargeBuffer containing the file data.
   * @throws {Error} If the request fails or headers are missing.
   */
  static async httpGetLarge(source) {
    const fragSize = 1e9 / 4;

    const headersXHR = await this.request({
      url: source,
      responseType: 'arraybuffer',
      range: {
        start: 0,
        end: 1,
      },
    });

    if (headersXHR.status !== 200 && headersXHR.status !== 206) {
      throw new Error('Bad status code');
    }

    const headers = URLUtils.headersStringToObj(headersXHR.getAllResponseHeaders());
    const range = headers['content-range'];
    if (!range) {
      throw new Error('No content-range header');
    }

    const s = range.split('/');
    const contentLength = parseInt(s[1]);
    if (!contentLength) {
      throw new Error('No content length');
    }

    const fragCount = Math.ceil(contentLength / fragSize);
    const buffer = new LargeBuffer(contentLength, fragCount);
    await buffer.initialize(async (i) => {
      if (i >= fragCount) {
        throw new Error('Fragment index ' + i + ' out of range');
      }
      const start = i * fragSize;
      const end = Math.min(i * fragSize + fragSize - 1, contentLength - 1);
      const xhr = await this.request({
        url: source,
        responseType: 'arraybuffer',
        range: {
          start,
          end,
        },
      });
      if (xhr.status !== 200 && xhr.status !== 206) {
        throw new Error('Bad status code');
      }
      return new Uint8Array(xhr.response);
    });

    return buffer;
  }
}
