import {DefaultPlayerEvents} from '../../enums/DefaultPlayerEvents.mjs';
import {MessageTypes} from '../../enums/MessageTypes.mjs';
import {PlayerModes} from '../../enums/PlayerModes.mjs';
import {ClientType, Innertube, UniversalCache, Log} from '../../modules/yt.mjs';
import {IndexedDBManager} from '../../network/IndexedDBManager.mjs';
import {SubtitleTrack} from '../../SubtitleTrack.mjs';
import {EnvUtils} from '../../utils/EnvUtils.mjs';
import {URLUtils} from '../../utils/URLUtils.mjs';
import {Utils} from '../../utils/Utils.mjs';
import {VideoSource} from '../../VideoSource.mjs';
import DashPlayer from '../dash/DashPlayer.mjs';

Log.setLevel(
    Log.Level.WARNING,
    Log.Level.ERROR,
    //  Log.Level.INFO,
);

const CurrentUA = `com.google.ios.youtube/18.06.35 (iPhone; CPU iPhone OS 14_4 like Mac OS X; en_US)`;
export default class YTPlayer extends DashPlayer {
  constructor(client, options) {
    super(client, options);
    if (options?.defaultClient) {
      this.defaultClient = ClientType[options.defaultClient];
    } else {
      this.defaultClient = ClientType.IOS;
    }

    this.paramCache = new Map();
  }

  async setSource(source) {
    const identifier = URLUtils.get_yt_identifier(source.url);
    // const playlistIdentifier = URLUtils.get_yt_playlist_identifier(source.url);
    if (!identifier) {
      this.emit(DefaultPlayerEvents.ERROR, new Error('Invalid YouTube URL'));
      return;
    }

    try {
      let manifest;
      try {
        const [youtube, info] = await this.getVideoInfo(identifier, this.defaultClient);
        this.videoInfo = info;
        this.ytclient = youtube;

        if (this.videoInfo.playability_status?.status === 'LOGIN_REQUIRED') {
          console.warn('Login Required, trying to fetch with TV mode');
          const [youtube2, info2] = await this.getVideoInfo(identifier, ClientType.TV_EMBEDDED);
          this.videoInfo = info2;
          this.ytclient = youtube2;
        }

        manifest = await this.videoInfo.toDash((url) => {
          return url;
        });
      } catch (e) {
        if (this.defaultClient === ClientType.WEB) {
          console.warn('Failed to fetch manifest, trying with iOS client', e);
          const [youtube3, info3] = await this.getVideoInfo(identifier, ClientType.IOS);
          this.videoInfo = info3;
          this.ytclient = youtube3;

          manifest = await this.videoInfo.toDash((url) => {
            return url;
          });
        } else {
          throw e;
        }
      }

      this.oldSource = source;
      const blob = new Blob([manifest], {
        type: 'application/dash+xml',
      });
      const uri = URL.createObjectURL(blob);
      this.source = new VideoSource(uri, source.headers, PlayerModes.ACCELERATED_DASH);
      if (this.videoInfo.client_type === ClientType.IOS) {
        this.source.headers['user-agent'] = CurrentUA;
        this.source.headers['sec-ch-ua'] = false;
        this.source.headers['sec-ch-ua-mobile'] = false;
        this.source.headers['sec-ch-ua-platform'] = false;
        this.source.headers['sec-fetch-site'] = false;
        this.source.headers['sec-fetch-mode'] = false;
        this.source.headers['sec-fetch-dest'] = false;
        this.source.headers['x-client-data'] = false;
      } else {
        this.source.headers['origin'] = 'https://www.youtube.com';
        this.source.headers['referer'] = 'https://www.youtube.com/';
      }

      this.source.identifier = 'yt-' + identifier;
    } catch (e) {
      console.error(e);
      this.emit(DefaultPlayerEvents.ERROR, e);
      return;
    }

    await super.setSource(this.source);

    if (this.videoInfo.captions?.caption_tracks) {
      this.videoInfo.captions.caption_tracks.forEach(async (track) => {
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
    // this.playlist = this.getPlaylistInfo(playlistIdentifier).then((playlist) => {
    //   if (playlist) {
    //     this.playlist = playlist;
    //     this.emit(DefaultPlayerEvents.PLAYLIST, playlist);
    //   }
    //   return playlist;
    // });
  }

  async youtubeFetchIOS(input, init) {
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

    const removeHeaders = [
      'user-agent',
      'origin',
      'referer',
      'sec-fetch-site',
      'sec-fetch-mode',
      'sec-fetch-dest',
      'sec-ch-ua',
      'sec-ch-ua-mobile',
      'sec-ch-ua-platform',
    ];
    // now serialize the headers
    let headersArr = [...headers];
    const customHeaderCommands = [];
    headersArr = headersArr.filter((header) => {
      const name = header[0];
      if (removeHeaders.includes(name.toLowerCase())) {
        return false;
      }
      return true;
    });


    const newHeaders = new Headers(headersArr);

    removeHeaders.forEach((header) => {
      if (header === 'user-agent') {
        customHeaderCommands.push({
          operation: 'set',
          header: header,
          value: CurrentUA,
        });
      } else {
        customHeaderCommands.push({
          operation: 'remove',
          header: header,
        });
      }
    });

    if (EnvUtils.isExtension()) {
      await chrome.runtime.sendMessage({
        type: MessageTypes.SET_HEADERS,
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
        type: MessageTypes.SET_HEADERS,
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


  async getVideoInfo(identifier, mode) {
    const cache = (await IndexedDBManager.isSupportedAndAvailable() && !EnvUtils.isIncognito()) ? new UniversalCache() : undefined;

    const youtube = await Innertube.create({
      cache,
      fetch: (mode === ClientType.IOS) ? this.youtubeFetchIOS.bind(this) : this.youtubeFetch.bind(this),
      client_type: mode === ClientType.IOS ? undefined : mode,
      runner_location: 'https://sandbox.faststream.online/',
    });

    const info = await youtube.getInfo(identifier, {client: mode});
    info.client_type = mode;
    return [youtube, info];
  }

  async getPlaylistInfo(identifier) {
    if (!identifier) {
      return;
    }

    return this.ytclient.getPlaylist(identifier);
  }

  markAsWatched() {
    if (!this.client.options.storeProgress) {
      return;
    }

    if (this.markedAsWatched) {
      return;
    }

    if (EnvUtils.isExtension()) {
      this.markedAsWatched = true;
      chrome.runtime.sendMessage({
        type: MessageTypes.REQUEST_YT_DATA,
      }, (datas) => {
        if (!datas) {
          return;
        }
        const initialResponse = Utils.findPropertyRecursive(datas, 'ytInitialPlayerResponse')[0]?.value;
        if (!initialResponse || initialResponse.videoDetails.videoId !== this.videoInfo.basic_info.id) {
          console.log('Video ID does not match, will not mark as watched');
          return;
        }

        const visitorData = Utils.findPropertyRecursive(datas, 'visitorData')[0]?.value;
        const endpointURL = Utils.findPropertyRecursive(initialResponse, 'videostatsPlaybackUrl')[0]?.value?.baseUrl;
        if (visitorData && endpointURL) {
          this.videoInfo.addToWatchHistory({
            visitor_data: visitorData,
            url: endpointURL,
          });
          console.log('Marked yt video as watched');
        }
      });
    }
  }

  fetchSponsorBlock(identifier) {
    if (EnvUtils.isExtension()) {
      chrome.runtime.sendMessage({
        type: MessageTypes.REQUEST_SPONSORBLOCK,
        action: 'getSkipSegments',
        videoId: identifier,
      }, (segments) => {
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
                    type: MessageTypes.REQUEST_SPONSORBLOCK,
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

  async play() {
    await super.play();
    this.markAsWatched();
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
}
