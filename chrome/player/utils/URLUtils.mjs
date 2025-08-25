import {PlayerModes} from '../enums/PlayerModes.mjs';
import {EnvUtils} from './EnvUtils.mjs';

const ModesMap = new Map();
ModesMap.set('webm', PlayerModes.DIRECT);
ModesMap.set('mp4', PlayerModes.ACCELERATED_MP4);
ModesMap.set('m3u8', PlayerModes.ACCELERATED_HLS);
ModesMap.set('m3u8v1', PlayerModes.ACCELERATED_HLS);
ModesMap.set('m3u', PlayerModes.ACCELERATED_HLS);
ModesMap.set('mpd', PlayerModes.ACCELERATED_DASH);
ModesMap.set('youtube', PlayerModes.ACCELERATED_YT);

ModesMap.set('vmpatch', PlayerModes.ACCELERATED_VM);

export class URLUtils {
  static get_yt_identifier(urlStr) {
    try {
      const url = new URL(urlStr);
      let identifier = url.searchParams.get('v');
      if (!identifier) {
        identifier = url.pathname.split('/').pop();
      }
      return identifier;
    } catch (e) {
      return '';
    }
  }

  static get_yt_playlist_identifier(urlStr) {
    try {
      const url = new URL(urlStr);
      return url.searchParams.get('list');
    } catch (e) {
      return '';
    }
  }

  static is_url_yt(urlStr) {
    if (!urlStr) return false;
    try {
      const url = new URL(urlStr);
      const hostname = url.hostname;
      if (hostname === 'www.youtube.com' || hostname === 'youtube.com' || hostname === 'm.youtube.com' || hostname === 'music.youtube.com' || hostname === 'www.youtube-nocookie.com') {
        return true;
      }
    } catch (e) {

    }
    return false;
  }

  static is_url_yt_watch(urlStr) {
    if (!urlStr) return false;
    try {
      const url = new URL(urlStr);
      const pathname = url.pathname;
      return pathname.startsWith('/watch') || pathname.startsWith('/embed');
    } catch (e) {
      return false;
    }
  }

  static is_url_yt_embed(urlStr) {
    if (!urlStr) return false;
    try {
      const url = new URL(urlStr);
      const pathname = url.pathname;
      return pathname.startsWith('/embed');
    } catch (e) {
      return false;
    }
  }

  static is_url(urlStr) {
    try {
      new URL(urlStr);
      return true;
    } catch (e) {
      return false;
    }
  }

  static get_url_params(url) {
    try {
      const urlObj = new URL(url);
      const params = new Map();
      urlObj.searchParams.forEach((value, key) =>{
        params.set(key, value);
      });
      return params;
    } catch (e) {
      return new Map();
    }
  }

  static get_param(url, name) {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get(name);
    } catch (e) {
      return null;
    }
  }
  static strip_queryhash(url) {
    return url.split(/[#?]/)[0];
  }

  static get_url_extension(url) {
    return this.strip_queryhash(url).split('.').pop().trim().toLowerCase();
  }

  static get_file_name(url) {
    return this.strip_queryhash(url).split('/').pop().trim();
  }

  static getModeFromExtension(ext) {
    return ModesMap.get(ext);
  }

  static getModeFromURL(url) {
    if (EnvUtils.isExtension() && URLUtils.is_url_yt(url) && URLUtils.is_url_yt_watch(url)) {
      return PlayerModes.ACCELERATED_YT;
    }

    const ext = URLUtils.get_url_extension(url);
    return URLUtils.getModeFromExtension(ext) || PlayerModes.DIRECT;
  }


  static validateHeadersString(str) {
    const lines = str.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const split = line.split(':');
      if (line.trim() === '') continue;

      if (split.length > 1) {
        const name = split[0].trim();
        const value = split.slice(1).join(':').trim();
        if (name.length === 0 || value.length === 0) {
          return false;
        }
      } else {
        return false;
      }
    }
    return true;
  }

  static objToHeadersString(obj) {
    let str = '';
    for (const name in obj) {
      if (Object.hasOwn(obj, name)) {
        let cased = name;
        // Pascal case
        cased = cased.replace(/\w+/g,
            (w) =>{
              return w[0].toUpperCase() + w.slice(1).toLowerCase();
            });

        str += `${cased}: ${obj[name]}\n`;
      }
    }
    return str;
  }

  static headersStringToObj(str) {
    const obj = {};
    const lines = str.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const split = line.split(':');
      if (split.length > 1) {
        obj[split[0].trim().toLowerCase()] = split.slice(1).join(':').trim();
      }
    }
    return obj;
  }
}

