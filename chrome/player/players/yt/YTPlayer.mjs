import {DefaultPlayerEvents} from '../../enums/DefaultPlayerEvents.mjs';
import {PlayerModes} from '../../enums/PlayerModes.mjs';
import {ClientType, Innertube, UniversalCache, Log} from '../../modules/yt.mjs';
import {IndexedDBManager} from '../../network/IndexedDBManager.mjs';
import {SubtitleTrack} from '../../SubtitleTrack.mjs';
import {EnvUtils} from '../../utils/EnvUtils.mjs';
import {URLUtils} from '../../utils/URLUtils.mjs';
import {VideoSource} from '../../VideoSource.mjs';
import DashPlayer from '../dash/DashPlayer.mjs';

Log.setLevel(
    Log.Level.WARNING,
    Log.Level.ERROR,
);

export default class YTPlayer extends DashPlayer {
  constructor(client, options) {
    super(client, options);
  }

  async setSource(source) {
    const identifier = URLUtils.get_yt_identifier(source.url);
    if (!identifier) {
      this.emit(DefaultPlayerEvents.ERROR, new Error('Invalid YouTube URL'));
      return;
    }

    try {
      this.videoInfo = await this.getVideoInfo(identifier);

      if (this.videoInfo.playability_status?.status === 'LOGIN_REQUIRED') {
        this.videoInfo = await this.getVideoInfo(identifier, true);
      }

      const manifest = await this.videoInfo.toDash((url) => {
        return url;
      });
      this.oldSource = source;
      const blob = new Blob([manifest], {
        type: 'application/dash+xml',
      });
      const uri = URL.createObjectURL(blob);
      this.source = new VideoSource(uri, source.headers, PlayerModes.ACCELERATED_DASH);
      this.source.headers['origin'] = 'https://www.youtube.com';
      this.source.headers['referer'] = 'https://www.youtube.com/';
      this.source.identifier = 'yt-' + identifier;
    } catch (e) {
      console.error(e);
      this.emit(DefaultPlayerEvents.ERROR, e);
      return;
    }

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

    this.extractChapters();
    this.fetchSponsorBlock(identifier);
  }

  async youtubeFetch(input, init) {
    // url
    const url = typeof input === 'string' ?
                  new URL(input) :
                  input instanceof URL ?
                      input :
                      new URL(input.url);

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
        url: url.toString(),
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
  }

  async getVideoInfo(identifier, tvMode = false) {
    const cache = (await IndexedDBManager.isSupportedAndAvailable() && !EnvUtils.isIncognito()) ? new UniversalCache() : undefined;
    const mode = tvMode ? ClientType.TV_EMBEDDED : ClientType.IOS;
    const youtube = await Innertube.create({
      cache,
      fetch: this.youtubeFetch.bind(this),
      clientType: mode,
    });

    return youtube.getInfo(identifier, mode);
  }

  fetchSponsorBlock(identifier) {
    if (EnvUtils.isExtension()) {
      chrome.runtime.sendMessage({
        type: 'sponsor_block',
        action: 'getSkipSegments',
        videoId: identifier,
      }, (segments)=>{
        if (segments) {
          console.log('Recieved Skip Segments', segments);
          this._skipSegments = segments.map((segment) => {
            return {
              startTime: segment.segment[0],
              endTime: segment.segment[1],
              class: 'sponsor_block_' + segment.category,
              category: segment.category,
              name: segment.category.charAt(0)?.toUpperCase() + segment.category.substring(1),
              color: segment.color,
              skipText: 'Skip ' + segment.category,
              autoSkip: !!segment.autoSkip,
              onSkip: () => {
                if (segment.UUID) {
                  chrome.runtime.sendMessage({
                    type: 'sponsor_block',
                    action: 'segmentSkipped',
                    UUID: segment.UUID,
                  });
                }
              },
            };
          });

          this.emit(DefaultPlayerEvents.SKIP_SEGMENTS);
        }
      });
    }
  }

  extractChapters() {
    const info = this.videoInfo;
    const markersMap = info.player_overlays?.decorated_player_bar?.player_bar?.markers_map;

    const chapters = (
      markersMap?.get({marker_key: 'AUTO_CHAPTERS'}) ||
      markersMap?.get({marker_key: 'DESCRIPTION_CHAPTERS'})
    )?.value.chapters;

    if (chapters) {
      this._chapters = [];
      for (const chapter of chapters) {
        this._chapters.push({
          name: chapter?.title?.text || 'Chapter',
          startTime: chapter.time_range_start_millis / 1000,
        });
      }

      for (let i = 0; i < this._chapters.length; i++) {
        const chapter = this._chapters[i];
        const nextChapter = this._chapters[i + 1];
        if (nextChapter) {
          chapter.endTime = nextChapter.startTime;
        } else {
          chapter.endTime = info.basic_info.duration;
        }
      }
    }
  }

  destroy() {
    if (this.source) {
      URL.revokeObjectURL(this.source.url);
    }
    super.destroy();
  }

  get skipSegments() {
    return this._skipSegments;
  }

  get chapters() {
    return this._chapters;
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
