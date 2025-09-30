import {DefaultPlayerEvents} from '../../enums/DefaultPlayerEvents.mjs';
import {MessageTypes} from '../../enums/MessageTypes.mjs';
import {PlayerModes} from '../../enums/PlayerModes.mjs';
import {SabrStreamingAdapter, SabrUmpProcessor} from '../../modules/googlevideo.mjs';
import {Localize} from '../../modules/Localize.mjs';
import {ClientType, Innertube, UniversalCache, Constants} from '../../modules/yt.mjs';
import {IndexedDBManager} from '../../network/IndexedDBManager.mjs';
import {SubtitleTrack} from '../../SubtitleTrack.mjs';
import {AlertPolyfill} from '../../utils/AlertPolyfill.mjs';
import {EnvUtils} from '../../utils/EnvUtils.mjs';
import {RequestUtils} from '../../utils/RequestUtils.mjs';
import {URLUtils} from '../../utils/URLUtils.mjs';
import {Utils} from '../../utils/Utils.mjs';
import {VideoSource} from '../../VideoSource.mjs';
import DashPlayer from '../dash/DashPlayer.mjs';
// Log.setLevel(
//     Log.Level.WARNING,
//     Log.Level.ERROR,
//     Log.Level.INFO,
// );

const CurrentUA = `com.google.ios.youtube/18.06.35 (iPhone; CPU iPhone OS 14_4 like Mac OS X; en_US)`;
export default class YTPlayer extends DashPlayer {
  constructor(client, options) {
    super(client, options);
    if (options?.defaultClient) {
      this.defaultClient = ClientType[options.defaultClient];
    } else {
      this.defaultClient = ClientType.IOS;
    }
    this.forcedPlayerID = options?.forcedPlayerID || undefined;
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
          if (false && this.defaultClient === ClientType.WEB && this.videoInfo.playability_status.reason === 'Sign in to confirm your age') {
            console.warn('Login Required, trying to fetch with WEB_EMBEDDED mode', ClientType);
            const cache = (await IndexedDBManager.isSupportedAndAvailable() && !EnvUtils.isIncognito()) ? new UniversalCache() : undefined;
            const embeddedClient = await Innertube.create({
              cache,
              fetch: this.youtubeFetch.bind(this),
              client_type: ClientType.WEB_EMBEDDED,
              runner_location: 'https://sandbox.faststream.online/',
            });
            embeddedClient.session.context.client.visitorData = this.ytclient.session.context.client.visitorData;
            embeddedClient.session.content_token = this.ytclient.session.content_token;
            embeddedClient.session.po_token = this.ytclient.session.po_token;
            embeddedClient.session.player = this.ytclient.session.player;

            const info = await embeddedClient.getInfo(identifier, {
              client: 'WEB_EMBEDDED',
              po_token: embeddedClient.session.content_token,
            });

            if (info.playability_status.status === 'OK' && info.streaming_data) {
              this.videoInfo.playability_status = info.playability_status;
              this.videoInfo.streaming_data = info.streaming_data;
              this.videoInfo.basic_info.start_timestamp = info.basic_info.start_timestamp;
              this.videoInfo.basic_info.duration = info.basic_info.duration;
              this.videoInfo.captions = info.captions;
            } else {
              console.warn('Login Required after embedded client fetch', info);
              this.emit(DefaultPlayerEvents.ERROR, new Error('Login Required! FastStream does not support login yet.'));
              return;
            }
          } else {
            console.warn('Login Required!');
            this.emit(DefaultPlayerEvents.ERROR, new Error('Login Required! FastStream does not support login yet.'));
            AlertPolyfill.alert(Localize.getMessage('yt_error_login_required'), 'error');
            return;
          }
        }

        if (this.defaultClient === ClientType.WEB) {
          manifest = await this.videoInfo.toDash({
            manifest_options: {
              is_sabr: true,
            },
          });
          const serverAbrStreamingUrl = await this.ytclient.session.player?.decipher(this.videoInfo.streaming_data?.server_abr_streaming_url);
          const videoPlaybackUstreamerConfig = this.videoInfo.player_config?.media_common_config.media_ustreamer_request_config?.video_playback_ustreamer_config;
          const sabrFormats = this.videoInfo.streaming_data?.adaptive_formats.map(buildSabrFormat) || [];

          this.sabrFormats = sabrFormats;

          const adapter = new SabrStreamingAdapter({
            playerAdapter: this,
            formats: sabrFormats,
            serverAbrStreamingUrl,
            videoPlaybackUstreamerConfig,
            sabrFormats,
            clientInfo: {
              clientName: parseInt(Constants.CLIENT_NAME_IDS[this.ytclient.session.context.client.clientName]),
              clientVersion: this.ytclient.session.context.client.clientVersion,
            },
          });
          adapter.setStreamingURL(serverAbrStreamingUrl);
          adapter.setServerAbrFormats(sabrFormats);
          adapter.setUstreamerConfig(videoPlaybackUstreamerConfig);
          adapter.onMintPoToken(async () => {
            return (await getPoTokens(this.ytclient.session, identifier)).contentToken;
          });

          adapter.onSnackbarMessage((message) => {
            console.warn('Sabr Snackbar Message:', message);
          });

          adapter.onReloadPlayerResponse(async (reloadPlaybackContext) => {
            const newInfo = await this.ytclient.getInfo(identifier, {
              client: this.defaultClient,
              po_token: this.ytclient.session.content_token,
            }, reloadPlaybackContext);
            this.videoInfo = newInfo;

            const serverAbrStreamingUrl = await this.ytclient.session.player?.decipher(this.videoInfo.streaming_data?.server_abr_streaming_url);
            const videoPlaybackUstreamerConfig = this.videoInfo.player_config?.media_common_config.media_ustreamer_request_config?.video_playback_ustreamer_config;
            const sabrFormats = this.videoInfo.streaming_data?.adaptive_formats.map(buildSabrFormat) || [];
            this.newSabrFormats = sabrFormats;
            if (!serverAbrStreamingUrl || !videoPlaybackUstreamerConfig) {
              console.error('Failed to reload player, missing serverAbrStreamingUrl or videoPlaybackUstreamerConfig');
              return;
            }
            adapter.setStreamingURL(serverAbrStreamingUrl);
            adapter.setUstreamerConfig(videoPlaybackUstreamerConfig);
            // adapter.setServerAbrFormats(sabrFormats);
            // console.warn('Sabr Reload Player:', reloadPlaybackContext);

            // const manifest = await this.videoInfo.toDash({
            //   manifest_options: {
            //     is_sabr: true,
            //   },
            // });
            // const blob = new Blob([manifest], {
            //   type: 'application/dash+xml',
            // });
            // const uri = URL.createObjectURL(blob);
            // this.source = new VideoSource(uri, source.headers, PlayerModes.ACCELERATED_DASH);
            // this.source.identifier = 'yt-' + identifier;
            // this.source.headers['origin'] = 'https://www.youtube.com';
            // this.source.headers['referer'] = 'https://www.youtube.com/';
            // try {
            //   this.dash.attachSource(this.source.url);
            // } catch (e) {
            //   console.error('Failed to attach source', e);
            // }
          });


          adapter.attach();

          this.sabrAdapter = adapter;
        } else {
          manifest = await this.videoInfo.toDash();
        }
      } catch (e) {
        if (this.defaultClient === ClientType.WEB) {
          console.warn('Failed to fetch manifest, trying with iOS client', e);
          const [youtube3, info3] = await this.getVideoInfo(identifier, ClientType.IOS);
          this.videoInfo = info3;
          this.ytclient = youtube3;
          manifest = await this.videoInfo.toDash();
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
      // Sort this.videoInfo.captions.caption_tracks so that the default language is first
      let defLang = 'en';
      const subtitlesSettings = await Utils.getSubtitlesSettingsFromStorage();
      if (subtitlesSettings.defaultLanguage) {
        defLang = subtitlesSettings.defaultLanguage;
      }
      const tracks = this.videoInfo.captions.caption_tracks.slice();
      tracks.sort((a, b) => {
        const aMatchLevel = Localize.getLanguageMatchLevel(a.language_code, defLang);
        const bMatchLevel = Localize.getLanguageMatchLevel(b.language_code, defLang);
        const aIsAuto = a.kind === 'asr';
        const bIsAuto = b.kind === 'asr';

        if (aMatchLevel === 0 && bMatchLevel === 0) {
          return 0;
        }

        // if one is auto (a.kind === 'asr') and the other is not, prefer the non-auto
        if (aIsAuto && !bIsAuto) return 1;
        if (!aIsAuto && bIsAuto) return -1;

        if (aMatchLevel !== bMatchLevel) {
          return bMatchLevel - aMatchLevel; // higher match level first
        }

        return 0;
      });

      const promises = tracks.map(async (track) => {
        let url = track.base_url;
        // if po token exists, add it to the url
        if (this.ytclient.session.content_token) {
          const urlObj = new URL(url);
          urlObj.searchParams.set('potc', 1);
          urlObj.searchParams.set('pot', this.ytclient.session.content_token);
          urlObj.searchParams.set('c', this.ytclient.session.client_name);
          url = urlObj.toString();
        }
        const label = track.name.text;
        const language = track.language_code;

        const subTrack = new SubtitleTrack(label, language);
        await subTrack.loadURL(url);
        return subTrack;
      });

      await Promise.allSettled(promises).then((results) => {
        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            this.client.loadSubtitleTrack(result.value, true);
          }
        });
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
      player_id: this.forcedPlayerID || '0004de42',
    });

    const tokens = await getPoTokens(youtube.session, identifier);
    youtube.session.player.po_token = tokens.sessionToken;
    youtube.session.po_token = tokens.contentToken;
    youtube.session.content_token = tokens.contentToken;


    const info = await youtube.getInfo(identifier, {
      client: mode,
      po_token: tokens.contentToken,
    });
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

  // For sabr adapter
  initialize(player, requestMetadataManager, cache) {
    this.requestMetadataManager = requestMetadataManager;
    this.sabrCache = cache;
  }

  getPlayerTime() {
    return this.currentTime;
  }

  getPlaybackRate() {
    return this.playbackRate;
  }

  getBandwidthEstimate() {
    // 100 MBPS
    return 8 * 100 * 1024 * 1024; // 100 Mbps in bits per second
  }

  getActiveTrackFormats(activeFormat, sabrFormats) {
    const videoFormat = sabrFormats.find((format) => format.itag === parseInt(this.getCurrentVideoLevelID()) && format.mimeType.startsWith('video/'));

    const audioParts = (this.getCurrentAudioLevelID() || '').split('-');
    const itag = parseInt(audioParts[0]);
    let audioTrackId;
    let isDrc = false;

    if (audioParts.length === 3) {
      audioTrackId = parseInt(audioParts[1]);
      if (audioParts[2] === 'drc') {
        isDrc = true;
      }
    } else if (audioParts.length === 2) {
      if (audioParts[1] === 'drc') {
        isDrc = true;
      } else {
        audioTrackId = parseInt(audioParts[1]);
      }
    }

    const audioFormat = sabrFormats.find((format) => format.itag === itag && format.audioTrackId === audioTrackId && format.isDrc === isDrc && format.mimeType.startsWith('audio/'));
    const obj = {audioFormat, videoFormat};
    if (activeFormat.mimeType.startsWith('video/')) {
      obj.videoFormat = activeFormat;
    } else if (activeFormat.mimeType.startsWith('audio/')) {
      obj.audioFormat = activeFormat;
    }
    return obj;
  }

  registerRequestInterceptor(interceptor) {
    this.sabrPreProcessor = interceptor;
  }

  registerResponseInterceptor(interceptor) {
    this.sabrPostProcessor = interceptor;
  }

  async preProcessFragment(entry, request, startTime, isInit) {
    if (this.sabrPreProcessor) {
      const requestObj = {
        ...request,
        segment: {
          getStartTime: () => {
            return startTime;
          },
          isInit: () => {
            return isInit;
          },
        },
      };

      // If rangeStart and rangeEnd are defined, use them
      if (requestObj.rangeEnd !== undefined) {
        requestObj.headers.Range = `bytes=${requestObj.rangeStart || 0}-${requestObj.rangeEnd - 1}`;
        requestObj.rangeEnd = undefined;
        requestObj.rangeStart = undefined;
      }
      return await this.sabrPreProcessor(requestObj);
    }
    return request;
  }


  async makeRequestRecurse(entry, url, headers, startTime = 0, isInit = false) {
    const newRequest = await this.sabrPreProcessor({
      url,
      headers,
      segment: {
        getStartTime: () => startTime,
        isInit: () => isInit,
      },
    });

    const {customHeaderCommands, regularHeaders} = RequestUtils.splitSpecialHeaders(newRequest.headers);
    const xhr = await RequestUtils.request({
      method: newRequest.method || 'GET',
      url: newRequest.url,
      headers: regularHeaders,
      header_commands: customHeaderCommands,
      body: newRequest.body,
      responseType: 'arraybuffer',
    });

    const responseObject = {
      url: xhr.responseURL,
      headers: URLUtils.headersStringToObj(xhr.getAllResponseHeaders()),
      status: xhr.status,
      statusText: xhr.statusText,
      data: xhr.response,
      makeRequest: (url2, headers2) => {
        return this.makeRequestRecurse(entry, url2, headers2, startTime, isInit);
      },
    };

    // Get metadata
    const requestMetadata = this.requestMetadataManager.getRequestMetadata(responseObject.url, true);
    if (!requestMetadata) {
      console.warn('(r) No request metadata found for', entry);
      return response;
    }

    const processor = new SabrUmpProcessor(requestMetadata, this.sabrCache);
    const result = await processor.processChunk(new Uint8Array(responseObject.data));
    // console.log(result);

    if (requestMetadata.error) {
      console.warn('Request metadata has error', requestMetadata.error);
    }

    if (!result) {
      console.warn('(r) No result from SABR UMP processor for', entry, requestMetadata);
      responseObject.data = null;
    } else {
      responseObject.data = result.data;
    }

    this.requestMetadataManager.setRequestMetadata(responseObject.url, requestMetadata);


    const newResponse = await this.sabrPostProcessor(responseObject);
    // console.log(requestMetadata, newResponse);

    if (!this.debugDownloadList) {
      this.debugDownloadList = [];
    }
    this.debugDownloadList.push({
      data: newResponse.data,
    });


    if (!newResponse.data) {
      throw new Error('(r) No data from SABR UMP processor');
    }
    return newResponse;
  }

  async postProcessFragment(entry, response, startTime = 0, isInit = false) {
    if (this.sabrPostProcessor) {
      // Get metadata
      const requestMetadata = this.requestMetadataManager.getRequestMetadata(response.url, true);
      if (!requestMetadata) {
        console.warn('No request metadata found for', entry);
        return response;
      }

      const processor = new SabrUmpProcessor(requestMetadata, this.sabrCache);
      const result = await processor.processChunk(new Uint8Array(response.data));
      // console.log(result);

      if (requestMetadata.error) {
        console.warn('Request metadata has error', requestMetadata.error);
      }

      const responseObject = {
        ...response,
        makeRequest: (url, headers) => {
          return this.makeRequestRecurse(entry, url, headers, startTime, isInit);
        },
      };

      if (!result) {
        console.warn('No result from SABR UMP processor for', entry, requestMetadata);
        responseObject.data = null;
      } else {
        responseObject.data = result.data;
      }

      this.requestMetadataManager.setRequestMetadata(response.url, requestMetadata);


      const newResponse = await this.sabrPostProcessor(responseObject);

      // console.log(requestMetadata, newResponse);

      if (!this.debugDownloadList) {
        this.debugDownloadList = [];
      }
      this.debugDownloadList.push({
        data: newResponse.data,
      });

      if (!newResponse.data) {
        throw new Error('No data from SABR UMP processor');
      }
      return newResponse;
    }
    return response;
  }

  downloadDebugList() {
    if (!this.debugDownloadList || this.debugDownloadList.length === 0) {
      console.warn('No debug download list available');
      return;
    }
    // download each item as separate file
    this.debugDownloadList.forEach((item, index) => {
      const blob = new Blob([item.data], {type: 'application/octet-stream'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `debug-download-${index}.bin`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  dispose() {

  }
}

function buildSabrFormat(formatStream) {
  return {
    itag: formatStream.itag,
    lastModified: parseInt(formatStream.last_modified_ms || formatStream.lastModified || '0'),
    xtags: formatStream.xtags,
    width: formatStream.width,
    height: formatStream.height,
    mimeType: formatStream.mime_type || formatStream.mimeType,
    audioQuality: formatStream.audio_quality || formatStream.audioQuality,
    bitrate: formatStream.bitrate,
    averageBitrate: formatStream.average_bitrate || formatStream.averageBitrate,
    quality: formatStream.quality,
    qualityLabel: formatStream.quality_label || formatStream.qualityLabel,
    audioTrackId: formatStream.audio_track?.id || formatStream.audioTrackId,
    approxDurationMs: formatStream.approx_duration_ms || parseInt(formatStream.approxDurationMs || '0'),
    contentLength: parseInt(formatStream.contentLength || '0') || formatStream.content_length,

    // YouTube.js-specific properties.
    isDrc: formatStream.is_drc,
    isAutoDubbed: formatStream.is_auto_dubbed,
    isDescriptive: formatStream.is_descriptive,
    isDubbed: formatStream.is_dubbed,
    language: formatStream.language,
    isOriginal: formatStream.is_original,
    isSecondary: formatStream.is_secondary,
  };
}

async function getPoTokens(session, videoId) {
  const visitorData = session.context.client.visitorData;

  // first, check cache
  const poTokenCache = JSON.parse(localStorage.getItem('po_token_cache') || '{}');
  if (!poTokenCache.sessionCache) {
    poTokenCache.sessionCache = {};
  }
  if (!poTokenCache.contentCache) {
    poTokenCache.contentCache = [];
  }
  const now = Date.now();
  const sessionCache = poTokenCache.sessionCache;

  let sessionToken = null;
  if (sessionCache.token && sessionCache.visitorData === visitorData && sessionCache.expires > now) {
    // session cache is valid, return it
    sessionToken = sessionCache.token;
  }

  let contentToken = null;
  // find videoId in content cache
  const contentCache = poTokenCache.contentCache.find((item) => item.videoId === videoId);
  if (contentCache && contentCache.token && contentCache.expires > now) {
    // content cache is valid, return it
    contentToken = contentCache.token;
  }

  if (!sessionToken || !contentToken) {
    const identifiers = [];
    if (!contentToken) {
      identifiers.push(videoId);
    }
    if (!sessionToken) {
      identifiers.push(visitorData);
    }
    console.log('Requesting PoToken for identifiers:', identifiers);
    const result = await session.getPot(identifiers).catch((e) => {
      console.warn('Failed to get PoToken', e);
      return null;
    });

    if (!result) {
      return {contentToken, sessionToken};
    }

    const expires = Date.now() + (result.ttl * 1000 * 0.8); // 20% margin

    result.result.forEach((item) => {
      if (item.error) {
        console.warn('PoToken error for', item.identifier, item.error);
        return;
      }
      if (item.id === visitorData) {
        sessionToken = item.pot;
        sessionCache.token = item.pot;
        sessionCache.visitorData = visitorData;
        sessionCache.expires = expires;
      } else if (item.id === videoId) {
        contentToken = item.pot;
        // Remove old tokens that are expired
        const now = Date.now();
        poTokenCache.contentCache = poTokenCache.contentCache.filter((c) => c.expires > now);

        // Remove old content token if exists
        poTokenCache.contentCache = poTokenCache.contentCache.filter((c) => c.videoId !== videoId);

        // Limit to 5
        if (poTokenCache.contentCache.length >= 5) {
          poTokenCache.contentCache.shift();
        }

        poTokenCache.contentCache.push({
          videoId,
          token: item.pot,
          expires,
        });
      }
    });

    localStorage.setItem('po_token_cache', JSON.stringify(poTokenCache));
  }
  return {contentToken, sessionToken};
}
