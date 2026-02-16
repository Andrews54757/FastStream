import { DefaultPlayerEvents } from '../../enums/DefaultPlayerEvents.mjs';
import { PlayerModes } from '../../enums/PlayerModes.mjs';
import { RequestUtils } from '../../utils/RequestUtils.mjs';
import HLSPlayer from "../hls/HLSPlayer.mjs";

export default class VMPlayer extends HLSPlayer {
  constructor(client, options) {
    super(client, options);
  }

  async setSource(source) {
    try {
      const isEmbed = !source.url.includes('config?');
      const hc = [];
      if (Array.isArray(source.headers)) {
        source.headers.forEach((h) => {
          hc.push({
            operation: 'set',
            header: h.name,
            value: h.value,
          });
        });
      } else {
        for (const key in source.headers) {
          if (Object.hasOwn(source.headers, key)) {
            hc.push({
              operation: 'set',
              header: key,
              value: source.headers[key],
            });
          }
        }
      }

      const xhr = await RequestUtils.request({
        url: source.url,
        header_commands: hc,
        responseType: isEmbed ? 'text' : 'json',
      });

      const config = xhr.response;
      const hls = !isEmbed ? config?.request?.files?.hls : this.extractVimeoHlsUrlFromIframePlayer(config);
      if (!hls || !hls.cdns) {
        throw new Error('Vimeo HLS data not found');
      }
      const defaultCdn =
          hls.default_cdn && hls.cdns[hls.default_cdn]
              ? hls.default_cdn
              : Object.keys(hls.cdns)[0];

      let hlsUrl = hls.cdns[defaultCdn].url;

      if (!hlsUrl) {
        throw new Error('Vimeo HLS URL missing');
      }

      hlsUrl = hlsUrl.replace(/\\u0026/g, '&');

      this.source = source.copy();
      this.source.url = hlsUrl;
      this.source.mode = PlayerModes.ACCELERATED_HLS;

    } catch (e) {
      console.error(e);
      this.emit(DefaultPlayerEvents.ERROR, e);
      return;
    }

    await super.setSource(this.source);
  }

  destroy() {
    if (this.source) {
      URL.revokeObjectURL(this.source.url);
    }
    super.destroy();
  }

  getSource() {
    return this.source;
  }

  extractVimeoHlsUrlFromIframePlayer(html) {

    const config = this.extractJsonConfig(html, 'window.playerConfig =');

    if (!config) {
      throw new Error('Vimeo iframe: playerConfig not found');
    }

    return config?.request?.files?.hls;
  }

  extractJsonConfig(html, prefix) {
    const startIndex = html.indexOf(prefix);
    if (startIndex === -1) return null;

    // Move past the prefix
    let i = startIndex + prefix.length;

    // Find the first '{'
    while (i < html.length && html[i] !== '{') {
      i++;
    }

    if (i >= html.length) return null;

    const jsonStart = i;
    let braceCount = 0;
    let foundStart = false;

    // Iterate to find the matching closing brace
    for (; i < html.length; i++) {
      if (html[i] === '{') {
        braceCount++;
        foundStart = true;
      } else if (html[i] === '}') {
        braceCount--;
      }

      if (foundStart && braceCount === 0) {
        // We found the end of the object
        const jsonString = html.substring(jsonStart, i + 1);
        try {
          return JSON.parse(jsonString);
        } catch (e) {
          return null;
        }
      }
    }

    return null;
  }

}
