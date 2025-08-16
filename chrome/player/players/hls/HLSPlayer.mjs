import {DefaultPlayerEvents} from '../../enums/DefaultPlayerEvents.mjs';
import {DownloadStatus} from '../../enums/DownloadStatus.mjs';
import {ReferenceTypes} from '../../enums/ReferenceTypes.mjs';
import {EmitterRelay, EventEmitter} from '../../modules/eventemitter.mjs';
import {Hls} from '../../modules/hls.mjs';
import {Utils} from '../../utils/Utils.mjs';
import {VideoUtils} from '../../utils/VideoUtils.mjs';
import {HLSFragment} from './HLSFragment.mjs';
import {HLSFragmentRequester} from './HLSFragmentRequester.mjs';
import {HLSLoaderFactory} from './HLSLoader.mjs';


export default class HLSPlayer extends EventEmitter {
  constructor(client, config) {
    super();
    this.client = client;
    this.isPreview = config?.isPreview || false;
    this.isAudioOnly = config?.isAudioOnly || false;
    this.defaultQuality = client.options.defaultQuality || 'Auto';
    this.source = null;
    this.activeRequests = [];
    this.fragmentRequester = new HLSFragmentRequester(this);
    this.video = document.createElement(this.isAudioOnly ? 'audio' : 'video');
    if (!Hls.isSupported()) {
      throw new Error('HLS Not supported');
    }

    const workerLocation = 'modules/hls.worker.js';
    const split = import.meta.url.split('/');
    const basePath = split.slice(0, split.length - 3).join('/');
    const workerPath = `${basePath}/${workerLocation}`;
    this.hls = new Hls({
      autoStartLoad: false,
      startPosition: -1,
      debug: false,
      capLevelOnFPSDrop: false,
      capLevelToPlayerSize: true,
      defaultAudioCodec: undefined,
      initialLiveManifestSize: 1,
      maxBufferLength: this.isPreview ? 1 : 10,
      maxMaxBufferLength: this.isPreview ? 1 : 10,
      backBufferLength: this.isPreview ? 0 : 10,
      maxBufferSize: this.isPreview ? 0 : (1000 * 1000),
      maxBufferHole: 0.5,
      highBufferWatchdogPeriod: 2,
      nudgeOffset: 0.1,
      nudgeMaxRetry: 3,
      maxFragLookUpTolerance: 0.25,
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: Infinity,
      liveDurationInfinity: false,
      enableWorker: true,
      workerPath: workerPath,
      enableSoftwareAES: true,
      startLevel: 5,
      startFragPrefetch: false,
      testBandwidth: false,
      progressive: false,
      lowLatencyMode: false,
      fpsDroppedMonitoringPeriod: 5000,
      fpsDroppedMonitoringThreshold: 0.2,
      appendErrorMaxRetry: 3,
      // eslint-disable-next-line new-cap
      loader: HLSLoaderFactory(this),
      enableDateRangeMetadataCues: true,
      enableEmsgMetadataCues: true,
      enableID3MetadataCues: true,
      enableWebVTT: true,
      enableIMSC1: true,
      enableCEA708Captions: true,
      stretchShortVideoTrack: false,
      maxAudioFramesDrift: 1,
      forceKeyFrameOnDiscontinuity: true,
      abrEwmaFastLive: 3.0,
      abrEwmaSlowLive: 9.0,
      abrEwmaFastVoD: 3.0,
      abrEwmaSlowVoD: 9.0,
      abrEwmaDefaultEstimate: 5000000,
      abrBandWidthFactor: 0.95,
      abrBandWidthUpFactor: 0.7,
      abrMaxWithRealBitrate: false,
      maxStarvationDelay: 4,
      maxLoadingDelay: 4,
      minAutoBitrate: 0,
      emeEnabled: false,
      licenseXhrSetup: undefined,
      drmSystems: {},
      drmSystemOptions: {},
      // requestMediaKeySystemAccessFunc: requestMediaKeySystemAccess,
      cmcd: undefined,
    });
  }

  canSave() {
    const frags = this.client.getFragments(this.currentLevel);
    if (!frags) {
      return {
        canSave: false,
        isComplete: false,
      };
    }
    let incomplete = false;
    for (let i = 0; i < frags.length; i++) {
      if (frags[i] && frags[i].status !== DownloadStatus.DOWNLOAD_COMPLETE) {
        incomplete = true;
        break;
      }
    }

    return {
      canSave: true,
      isComplete: !incomplete,
    };
  }

  async saveVideo(options) {
    const fragments = this.client.getFragments(this.currentLevel) || [];
    const audioFragments = this.client.getFragments(this.currentAudioLevel) || [];

    let zippedFragments = Utils.zipTimedFragments([fragments, audioFragments]);

    if (options.partialSave) {
      zippedFragments = zippedFragments.filter((data) => {
        return data.fragment.status === DownloadStatus.DOWNLOAD_COMPLETE;
      });
    }

    zippedFragments.forEach((data) => {
      data.fragment.addReference(ReferenceTypes.SAVER);
      data.getEntry = async () => {
        if (data.fragment.status !== DownloadStatus.DOWNLOAD_COMPLETE) {
          while (true) {
            try {
              await this.downloadFragment(data.fragment, -1);
              break;
            } catch (e) {
              if (e.message !== 'Aborted download') {
                throw e;
              }
            }
          }
        }
        data.fragment.removeReference(ReferenceTypes.SAVER);
        return this.client.downloadManager.getEntry(data.fragment.getContext());
      };
    });

    const level = this.hls.levels[this.getIndexes(this.currentLevel).levelID];
    const audioLevel = this.hls.audioTracks[this.hls.audioTrack];

    let levelInitData = null;
    let audioLevelInitData = null;

    if (fragments[-1]) {
      levelInitData = new Uint8Array(await this.client.downloadManager.getEntry(fragments[-1].getContext()).getDataFromBlob());
    }

    if (audioFragments[-1]) {
      audioLevelInitData = new Uint8Array(await this.client.downloadManager.getEntry(audioFragments[-1].getContext()).getDataFromBlob());
    }

    try {
      if (levelInitData && audioLevelInitData) {
        const {MP4Merger} = await import('../../modules/dash2mp4/mp4merger.mjs');

        const mp4merger = new MP4Merger(options.registerCancel);

        mp4merger.on('progress', (progress) => {
          if (options?.onProgress) {
            options.onProgress(progress);
          }
        });

        const blob = await mp4merger.convert(level.details.totalduration, levelInitData.buffer, audioLevel.details.totalduration, audioLevelInitData.buffer, zippedFragments);

        return {
          extension: 'mp4',
          blob: blob,
        };
      } else {
        if (levelInitData || audioLevelInitData) {
          console.warn('Unexpected init data');
        }
        const {HLS2MP4} = await import('../../modules/hls2mp4/hls2mp4.mjs');
        const hls2mp4 = new HLS2MP4(options.registerCancel);

        hls2mp4.on('progress', (progress) => {
          if (options?.onProgress) {
            options.onProgress(progress);
          }
        });
        const blob = await hls2mp4.convert(level, levelInitData, audioLevel, audioLevelInitData, zippedFragments);

        return {
          extension: 'mp4',
          blob: blob,
        };
      }
    } catch (e) {
      zippedFragments.forEach((data) => {
        data.fragment.removeReference(ReferenceTypes.SAVER);
      });
      throw e;
    }
  }

  load() {
    this.hls.startLoad();
  }

  getClient() {
    return this.client;
  }


  async setup() {
    this.hls.attachMedia(this.video);

    await new Promise((resolve, reject) => {
      this.hls.on(Hls.Events.MEDIA_ATTACHED, function() {
        resolve();
      });
    });

    const preEvents = new EventEmitter();
    const emitterRelay = new EmitterRelay([preEvents, this]);
    VideoUtils.addPassthroughEventListenersToVideo(this.video, emitterRelay);


    this.hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
      const level = Utils.selectQuality(this.levels, this.defaultQuality);
      this.emit(DefaultPlayerEvents.MANIFEST_PARSED, level);

      this.hls.subtitleDisplay = false;
      this.hls.subtitleTrack = -1;
    });

    this.hls.on(Hls.Events.LEVEL_UPDATED, (a, data) => {
      this.trackUpdated(data.details, 0);
    });


    this.hls.on(Hls.Events.AUDIO_TRACK_UPDATED, (a, data) => {
      this.trackUpdated(data.details, 1);
    });
  }

  trackUpdated(levelDetails, trackID) {
    levelDetails.trackID = trackID;
    let time = 0;
    levelDetails.fragments.forEach((fragment, i) => {
      const identifier = this.getIdentifier(levelDetails.trackID, fragment.level);
      if (fragment.initSegment && i === 0) {
        fragment.initSegment.trackID = levelDetails.trackID;
        if (!this.client.getFragment(identifier, -1)) {
          this.client.makeFragment(identifier, -1, new HLSFragment(fragment.initSegment, 0, 0));
        }
      }
      if (fragment.encrypted) {
        if (fragment.decryptdata && fragment.levelkeys) {
          fragment.fs_oldcryptdata = fragment.decryptdata;
          fragment.fs_oldlevelKeys = fragment.levelkeys;
        } else {
          this.emit(DefaultPlayerEvents.NEED_KEY);
          // console.log(fragment);
          // console.error('SAMPLE-AES not supported!');
          // throw new Error('SAMPLE-AES not supported!');
        }

        fragment.levelkeys = null;
        fragment._decryptdata = null;

        void fragment.decryptdata;
      }
      const start = time;
      time += fragment.duration;
      const end = time;
      fragment.levelIdentifier = identifier;
      fragment.trackID = levelDetails.trackID;
      if (!this.client.getFragment(identifier, fragment.sn)) {
        this.client.makeFragment(identifier, fragment.sn, new HLSFragment(fragment, start, end));
      }
    });

    this.emit(DefaultPlayerEvents.LANGUAGE_TRACKS);
  }
  getVideo() {
    return this.video;
  }

  getIdentifier(trackID, levelID) {
    return `${trackID}:${levelID}`;
  }

  getIndexes(identifier) {
    const parts = identifier.split(':');
    return {
      trackID: parseInt(parts[0]),
      levelID: parseInt(parts[1]),
    };
  }

  async setSource(source) {
    this.source = source;
    this.hls.loadSource(source.url);
  }

  getSource() {
    return this.source;
  }

  downloadFragment(fragment, priority) {
    return new Promise((resolve, reject) => {
      this.fragmentRequester.requestFragment(fragment, {
        skipProcess: true,
        onProgress: (e) => {

        },
        onSuccess: (e) => {
          resolve();
        },
        onFail: (e) => {
          reject(new Error('Failed to download fragment'));
        },
        onAbort: (e) => {
          reject(new Error('Aborted download'));
        },
      }, null, priority);
    });
  }

  get buffered() {
    return this.video.buffered;
  }

  async play() {
    return this.video.play();
  }

  async pause() {
    return this.video.pause();
  }

  destroy() {
    this.fragmentRequester.destroy();
    this.hls.destroy();

    VideoUtils.destroyVideo(this.video);
    this.video = null;

    this.emit(DefaultPlayerEvents.DESTROYED);
  }

  set currentTime(value) {
    if (this.isPreview && this.activeRequests.length > 0 && !VideoUtils.isBuffered(this.video.buffered, value)) {
      this.activeRequests.forEach((loader) => {
        loader.abort();
      });
      this.activeRequests.length = 0;
    }

    this.video.currentTime = value;
  }

  get currentTime() {
    return this.video.currentTime;
  }

  get readyState() {
    return this.video.readyState;
  }

  get paused() {
    return this.video.paused;
  }

  get levels() {
    const result = new Map();
    this.hls.levels.forEach((level, index) => {
      result.set(this.getIdentifier(0, index), {
        width: level.width,
        height: level.height,
        bitrate: level.bitrate,
      });
    });

    return result;
  }

  get currentLevel() {
    return this.getIdentifier(0, this.hls.currentLevel === -1 ? this.hls.loadLevel : this.hls.currentLevel);
  }

  set currentLevel(value) {
    // Use loadLevel for quality switching instead of currentLevel
    // currentLevel is read-only in HLS.js and represents the currently playing level
    // loadLevel is what we should set for quality switching
    try {
      const levelID = this.getIndexes(value).levelID;
      if (levelID >= 0 && levelID < this.hls.levels.length) {
        this.hls.loadLevel = levelID;
        // Immediately start loading the new level if playing
        if (!this.video.paused) {
          this.hls.currentLevel = -1; // Force level switch
        }
      } else {
        console.warn('Invalid level ID for quality switch:', levelID);
      }
    } catch (e) {
      console.error('Error switching quality level:', e);
    }
  }

  get duration() {
    return this.video.duration;
  }

  get currentFragment() {
    if (!this.hls.streamController.currentFrag) return null;
    return this.client.getFragment(this.getIdentifier(0, this.hls.streamController.currentFrag.level), this.hls.streamController.currentFrag.sn);
  }

  get currentAudioLevel() {
    return this.getIdentifier(1, this.hls.audioTrack);
  }

  set currentAudioLevel(value) {
    this.hls.audioTrack = this.getIndexes(value).levelID;
  }

  get currentAudioFragment() {
    const frags = this.client.getFragments(this.currentAudioLevel);
    if (!frags) return null;

    const time = this.currentTime;
    return frags.find((frag) => {
      if (!frag) return false;
      return time >= frag.start && time < frag.end;
    });
  }

  get languageTracks() {
    const seenLanguages = [];
    return {
      audio: this.hls.audioTracks.map((track, i) => {
        return {
          type: 'audio',
          lang: track.lang,
          index: i,
          isActive: i === this.hls.audioTrack,
        };
      }).filter((track) => {
        if (seenLanguages.includes(track.lang)) return false;
        seenLanguages.push(track.lang);
        return true;
      }),
      video: [],
    };
  }

  setLanguageTrack(track) {
    if (track.type === 'audio') {
      this.hls.audioTrack = track.index;
    }
  }

  get volume() {
    return this.video.volume;
  }

  set volume(value) {
    this.video.volume = value;
    if (value === 0) this.video.muted = true;
    else this.video.muted = false;
  }

  get playbackRate() {
    return this.video.playbackRate;
  }

  set playbackRate(value) {
    this.video.playbackRate = value;
  }
}
