import {PlayerModes} from './enums/PlayerModes.mjs';

const headerBlacklist = [
  'accept',
  'accept-charset',
  'accept-encoding',
  'accept-language',
  'cache-control',
  'pragma',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform',
  'sec-fetch-dest',
  'sec-fetch-mode',
  'sec-fetch-site',
  'user-agent',
  'range',
  'host',
  'connection',
  'dnt',
  'cookie',
];


export class VideoSource {
  constructor(source, headers, mode) {
    if (source instanceof File) {
      this.fromFile(source);
    } else {
      this.url = source;
      this.identifier = this.url.split(/[?#]/)[0];
    }
    this.mode = mode || PlayerModes.DIRECT;

    if (Array.isArray(headers)) {
      this.headers = {};
      headers.forEach((header) => {
        if (header.name && header.value) {
          this.headers[header.name] = header.value;
        }
      });
    } else {
      this.headers = headers || {};
    }

    this.headers = this.filterHeaders(this.headers);
    this.defaultLevelInfo = null;
    this.loadedFromArchive = false;
  }

  /**
   * Should only be called when the source is trusted.
   */
  parseHeadersParam() {
    try {
      const url = new URL(this.url);
      const headers = url.searchParams.get('faststream-headers');
      if (headers) {
        const parsedHeaders = JSON.parse(headers);
        for (const key in parsedHeaders) {
          if (Object.hasOwn(parsedHeaders, key)) {
            this.headers[key] = parsedHeaders[key];
          }
        }
        this.headers = this.filterHeaders(this.headers);
        url.searchParams.delete('faststream-headers');
        this.url = url.toString();
      }

      const mode = url.searchParams.get('faststream-mode');
      if (mode) {
        if (Object.values(PlayerModes).includes(mode)) {
          this.mode = mode;
        }
        url.searchParams.delete('faststream-mode');
        this.url = url.toString();
      }
    } catch (e) {
    }
  }

  countHeaders() {
    return Object.keys(this.headers).length;
  }

  fromFile(file) {
    this.url = URL.createObjectURL(file);
    this.identifier = file.name;

    this.shouldRevoke = true;
  }

  destroy() {
    if (this.shouldRevoke) {
      URL.revokeObjectURL(this.url);
      this.url = null;
    }
  }

  filterHeaders(headers) {
    const filteredHeaders = {};
    for (const key in headers) {
      if (headerBlacklist.includes(key.toLowerCase())) {
        continue;
      }
      filteredHeaders[key.toLowerCase()] = headers[key];
    }
    return filteredHeaders;
  }

  equals(other) {
    if (this.url !== other.url) {
      return false;
    }

    if (this.mode !== other.mode) {
      return false;
    }

    if (Object.keys(this.headers).length !== Object.keys(other.headers).length) {
      return false;
    }

    for (const key in this.headers) {
      if (this.headers[key] !== other.headers[key]) {
        return false;
      }
    }

    return true;
  }

  copy() {
    const newsource = new VideoSource(this.url, {}, this.mode);
    newsource.identifier = this.identifier;
    newsource.defaultLevelInfo = this.defaultLevelInfo;
    newsource.loadedFromArchive = this.loadedFromArchive;
    newsource.headers = {...this.headers};
    return newsource;
  }
}
