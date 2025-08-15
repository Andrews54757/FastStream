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

export class RequestUtils {
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
