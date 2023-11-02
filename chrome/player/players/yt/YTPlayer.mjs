import {PlayerModes} from '../../enums/PlayerModes.mjs';
import {Innertube, UniversalCache} from '../../modules/yt.mjs';
import {SubtitleTrack} from '../../SubtitleTrack.mjs';
import {EnvUtils} from '../../utils/EnvUtils.mjs';
import {VideoSource} from '../../VideoSource.mjs';
import DashPlayer from '../dash/DashPlayer.mjs';

export default class YTPlayer extends DashPlayer {
  constructor(client, options) {
    super(client, options);
  }

  async setSource(source) {
    const youtube = await Innertube.create({
      cache: new UniversalCache(),
      fetch: async (input, init) => {
        // url
        const url = typeof input === 'string' ?
                    new URL(input) :
                    input instanceof URL ?
                        input :
                        new URL(input.url);

        // transform the url for use with our proxy
        // url.searchParams.set('__host', url.host);
        // url.host = 'localhost:8080';
        // url.protocol = 'http';

        const headers = init?.headers ?
                    new Headers(init.headers) :
                    input instanceof Request ?
                        input.headers :
                        new Headers();

        const redirectHeaders = [
          'user-agent',
          'origin',
          'referer',
        ];
        // now serialize the headers
        let headersArr = [...headers];
        const customHeaderCommands = [];
        headersArr = headersArr.filter((header) => {
          const name = header[0];
          const value = header[1];
          if (redirectHeaders.includes(name.toLowerCase())) {
            customHeaderCommands.push({
              operation: 'set',
              header: name,
              value,
            });
            return false;
          }
          return true;
        });
        const newHeaders = new Headers(headersArr);
        if (!customHeaderCommands.find((c) => c.header === 'origin')) {
          customHeaderCommands.push({
            operation: 'remove',
            header: 'origin',
          });
        }

        customHeaderCommands.push({
          operation: 'remove',
          header: 'x-client-data',
        });

        if (EnvUtils.isExtension()) {
          await chrome.runtime.sendMessage({
            type: 'header_commands',
            url: url,
            commands: customHeaderCommands,
          });
        }
        // fetch the url
        return fetch(input, init ? {
          ...init,
          headers: newHeaders,
        } : {
          headers: newHeaders,
        });
      },
    });

    const url = new URL(source.url);
    let identifier = url.searchParams.get('v');
    if (!identifier) {
      identifier = url.pathname.split('/').pop();
    }
    const videoInfo = await youtube.getInfo(identifier);
    this.youtube = youtube;
    this.videoInfo = videoInfo;
    const manifest = await videoInfo.toDash((url) => {
      return url;
    });
    this.oldSource = source;
    const uri = 'data:application/dash+xml;charset=utf-8;base64,' + btoa(manifest);
    this.source = new VideoSource(uri, source.headers, PlayerModes.ACCELERATED_DASH);
    this.source.identifier = 'yt-' + identifier;
    await super.setSource(this.source);

    if (this.videoInfo.captions?.caption_tracks) {
      this.videoInfo.captions.caption_tracks.forEach(async (track)=>{
        const url = track.base_url;
        const label = track.name.text;
        const language = track.language_code;

        const subTrack = new SubtitleTrack(label, language);
        await subTrack.loadURL(url);
        this.client.loadSubtitleTrack(subTrack, true);
      });
    }
  }

  getSource() {
    return this.source;
  }

  canSave() {
    if (false) { // SPLICER:CENSORYT:REMOVE_LINE
      return {
        cantSave: true,
        canSave: false,
        isComplete: true,
      };
    } // SPLICER:CENSORYT:REMOVE_LINE

    // SPLICER:CENSORYT:REMOVE_START
    return super.canSave();
    // SPLICER:CENSORYT:REMOVE_END
  }

  // SPLICER:CENSORYT:REMOVE_START
  async saveVideo(options) {
    try {
      return await super.saveVideo(options);
    } catch (e) {
      console.warn(e);
      const stream = await this.videoInfo.download({
        type: 'video+audio',
        quality: 'best',
        format: 'mp4',
      });

      const blob = await (new Response(stream)).blob();
      return {
        extension: 'mp4',
        blob: blob,
      };
    }
  }
  // SPLICER:CENSORYT:REMOVE_END
}
