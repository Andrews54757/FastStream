import {InterfaceController} from './ui/InterfaceController.mjs';
import {KeybindManager} from './ui/KeybindManager.mjs';
import {DownloadManager} from './network/DownloadManager.mjs';
import {DefaultPlayerEvents} from './enums/DefaultPlayerEvents.mjs';
import {DownloadStatus} from './enums/DownloadStatus.mjs';
import {VideoAnalyzer} from './modules/analyzer/VideoAnalyzer.mjs';
import {AnalyzerEvents} from './enums/AnalyzerEvents.mjs';
import {EventEmitter} from './modules/eventemitter.mjs';
import {SourcesBrowser} from './ui/SourcesBrowser.mjs';
import {PlayerLoader} from './players/PlayerLoader.mjs';
import {DOMElements} from './ui/DOMElements.mjs';
import {AudioConfigManager} from './ui/audio/AudioConfigManager.mjs';
import {EnvUtils} from './utils/EnvUtils.mjs';
import {Localize} from './modules/Localize.mjs';
import {ClickActions} from './options/defaults/ClickActions.mjs';
import {VisChangeActions} from './options/defaults/VisChangeActions.mjs';
import {MiniplayerPositions} from './options/defaults/MiniplayerPositions.mjs';
import {SecureMemory} from './modules/SecureMemory.mjs';
import {CSSFilterUtils} from './utils/CSSFilterUtils.mjs';
import {DaltonizerTypes} from './options/defaults/DaltonizerTypes.mjs';
import {Utils} from './utils/Utils.mjs';
import {DefaultToolSettings} from './options/defaults/ToolSettings.mjs';
import {AudioAnalyzer} from './modules/analyzer/AudioAnalyzer.mjs';
import {PreviewFrameExtractor} from './modules/analyzer/PreviewFrameExtractor.mjs';
import {PlayerModes} from './enums/PlayerModes.mjs';
import {URLUtils} from './utils/URLUtils.mjs';
import {YoutubeClients} from './enums/YoutubeClients.mjs';
import {StringUtils} from './utils/StringUtils.mjs';
import {StatusTypes} from './ui/StatusManager.mjs';
import {InterfaceUtils} from './utils/InterfaceUtils.mjs';
import {VirtualAudioNode} from './ui/audio/VirtualAudioNode.mjs';
import {SyncedAudioPlayer} from './players/SyncedAudioPlayer.mjs';
import {AlertPolyfill} from './utils/AlertPolyfill.mjs';
import {MessageTypes} from './enums/MessageTypes.mjs';
import {LevelManager} from './players/LevelManager.mjs';

const SET_VOLUME_USING_NODE = !EnvUtils.isSafari() && EnvUtils.isWebAudioSupported();

export class FastStreamClient extends EventEmitter {
  constructor() {
    super();
    this.version = EnvUtils.getVersion();

    this.options = {
      autoPlay: false,
      maxSpeed: -1,
      maxVideoSize: 5000000000, // 5GB max size
      introCutoff: 5 * 60,
      outroCutoff: 5 * 60,
      bufferAhead: 300,
      bufferBehind: 20,
      freeFragments: true,
      downloadAll: false,
      freeUnusedChannels: true,
      storeProgress: false,
      disableLoadProgress: false,
      previewEnabled: true,
      autoplayNext: false,
      singleClickAction: ClickActions.HIDE_CONTROLS,
      doubleClickAction: ClickActions.PLAY_PAUSE,
      tripleClickAction: ClickActions.FULLSCREEN,
      visChangeAction: VisChangeActions.NOTHING,
      defaultYoutubeClient: YoutubeClients.WEB,
      miniSize: 0.25,
      miniPos: MiniplayerPositions.BOTTOM_RIGHT,
      videoBrightness: 1,
      videoContrast: 1,
      videoSaturation: 1,
      videoGrayscale: 0,
      videoSepia: 0,
      videoInvert: 0,
      videoHueRotate: 0,
      videoDaltonizerType: DaltonizerTypes.NONE,
      videoDaltonizerStrength: 1,
      videoZoom: 1,
      seekStepSize: 0.2,
      defaultQuality: 'Auto',
      toolSettings: Utils.mergeOptions(DefaultToolSettings, {}),
      videoDelay: 0,
      videoFlip: 0,
      videoRotate: 0,
      disableVisualFilters: false,
      maximumDownloaders: 6,
    };
    this.state = {
      playing: false,
      buffering: false,
      currentTime: 0,
      volume: 1,
      muted: false,
      playbackRate: 1,
      hasUserInteracted: false,
      bufferBehind: this.options.bufferBehind,
      bufferAhead: this.options.bufferAhead,
      hasNextVideo: false,
      hasPrevVideo: false,
      fullscreen: false,
      miniplayer: false,
      windowedFullscreen: false,
      autoPlayTriggered: false,
    };

    this._needsUserInteraction = false;

    this.progressMemory = null;
    this.playerLoader = new PlayerLoader();
    this.levelManager = new LevelManager(this);
    this.interfaceController = new InterfaceController(this);
    this.keybindManager = new KeybindManager(this);
    this.downloadManager = new DownloadManager(this);
    this.sourcesBrowser = new SourcesBrowser(this);
    this.videoAnalyzer = new VideoAnalyzer(this);
    this.audioAnalyzer = new AudioAnalyzer(this);
    this.frameExtractor = new PreviewFrameExtractor(this);
    if (EnvUtils.isWebAudioSupported()) {
      this.audioConfigManager = new AudioConfigManager(this);
      this.audioContext = new AudioContext();
      this.audioConfigManager.setupNodes(this.audioContext);
    }

    this.videoAnalyzer.on(AnalyzerEvents.MATCH, () => {
      this.interfaceController.updateSkipSegments();
    });

    DOMElements.playerContainer.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.escapeAll();
        e.preventDefault();
        e.stopPropagation();
      }
    });

    this.player = null;
    this.syncedAudioPlayer = null;
    this.previewPlayer = null;
    this.saveSeek = true;
    this.pastSeeks = [];
    this.pastUnseeks = [];
    this.fragmentsStore = {};
    this.mainloop();
  }

  getLevelManager() {
    return this.levelManager;
  }

  async setup() {
    await this.downloadManager.setup();
    if (SecureMemory.isSupported()) {
      const progressMemory = new SecureMemory('faststream-progress');
      try {
        await progressMemory.setup();
        this.progressMemory = progressMemory;
      } catch (e) {
        console.warn('Failed to setup secure progress memory', e);
      }
    }

    if (this.progressMemory) {
      await this.progressMemory.pruneOld(Date.now() - 1000 * 60 * 60 * 24 * 365); // 1 year
    }

    try {
      Utils.loadAndParseOptions('toolSettings', DefaultToolSettings).then((settings) => {
        this.options.toolSettings = settings;
        this.interfaceController.updateToolVisibility();
      });
    } catch (e) {
      console.error(e);
    }
  }

  pollPrevNext() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({type: MessageTypes.REQUEST_PLAYLIST_POLL}, (response) => {
        if (!response) {
          resolve(null);
          return;
        }
        if (this.state.hasNextVideo !== response.next || this.state.hasPrevVideo !== response.previous) {
          this.state.hasPrevVideo = response.previous;
          this.state.hasNextVideo = response.next;
          this.interfaceController.updateToolVisibility();
        }
        resolve(response);
      });
    });
  }

  setupPoll() {
    const count = 10;
    const initialTimeout = 500;
    const pollDurationLengthen = 1.2;

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        this.pollPrevNext();
      }, initialTimeout * Math.pow(pollDurationLengthen, i));
    }
  }

  shouldDownloadAll() {
    return (this.options.downloadAll && this.hasDownloadSpace) || this.source?.loadedFromArchive;
  }

  userInteracted() {
    if (!this.state.hasUserInteracted) {
      this.state.hasUserInteracted = true;
      this.interfaceController.setStatusMessage(StatusTypes.REQINTERACTION, null);
    }
  }

  needsUserInteraction() {
    return this._needsUserInteraction && !this.state.hasUserInteracted && !this.state.playing;
  }

  setNeedsUserInteraction(value) {
    this._needsUserInteraction = value;
  }

  setSeekSave(value) {
    this.saveSeek = value;
  }

  resetFailed() {
    for (const levelID in this.fragmentsStore) {
      if (Object.hasOwn(this.fragmentsStore, levelID)) {
        this.fragmentsStore[levelID].forEach((fragment) => {
          if (fragment.status === DownloadStatus.DOWNLOAD_FAILED) {
            fragment.status = DownloadStatus.WAITING;
          }
        });
      }
    }
    this.interfaceController.updateFragmentsLoaded();
  }

  destroy() {
    this.destroyed = true;
    this.resetPlayer();
    this.downloadManager.destroy();
    this.videoAnalyzer.destroy();
    this.interfaceController.destroy();
    if (this.progressMemory) {
      this.progressMemory.destroy();
      this.progressMemory = null;
    }
  }

  setOptions(options) {
    this.options.analyzeVideos = options.analyzeVideos;

    this.options.storeProgress = options.storeProgress;
    this.options.downloadAll = options.downloadAll;
    this.options.autoEnableBestSubtitles = options.autoEnableBestSubtitles;
    this.options.maxSpeed = options.maxSpeed;
    this.options.maxVideoSize = options.maxVideoSize;
    this.options.seekStepSize = options.seekStepSize;
    this.options.singleClickAction = options.singleClickAction;
    this.options.doubleClickAction = options.doubleClickAction;
    this.options.tripleClickAction = options.tripleClickAction;
    this.options.visChangeAction = options.visChangeAction;
    this.options.miniSize = options.miniSize;
    this.options.miniPos = options.miniPos;
    // this.options.defaultYoutubeClient = options.defaultYoutubeClient;
    this.options.maximumDownloaders = options.maximumDownloaders;

    if (sessionStorage && sessionStorage.getItem('autoplayNext') !== null) {
      this.options.autoplayNext = sessionStorage.getItem('autoplayNext') == 'true';
    } else {
      this.options.autoplayNext = options.autoplayNext;
    }

    if (sessionStorage) {
      this.options.disableVisualFilters = sessionStorage.getItem('disableVisualFilters') == 'true';
    }

    this.options.videoBrightness = options.videoBrightness;
    this.options.videoContrast = options.videoContrast;
    this.options.videoSaturation = options.videoSaturation;
    this.options.videoGrayscale = options.videoGrayscale;
    this.options.videoSepia = options.videoSepia;
    this.options.videoInvert = options.videoInvert;
    this.options.videoHueRotate = options.videoHueRotate;
    this.options.videoDaltonizerType = options.videoDaltonizerType;
    this.options.videoDaltonizerStrength = options.videoDaltonizerStrength;
    this.options.videoZoom = options.videoZoom;
    this.options.previewEnabled = options.previewEnabled;
    this.options.videoDelay = options.videoDelay;
    document.body.dataset.theme = options.colorTheme;
    // save color theme to local storage
    localStorage.setItem('faststream-color-theme', options.colorTheme);

    this.loadProgressData();

    if (this.options.previewEnabled) {
      this.setupPreviewPlayer().catch((e) => {
        console.error(e);
      });
    } else {
      if (this.previewPlayer) {
        this.previewPlayer.destroy();
        this.previewPlayer = null;
        this.interfaceController.resetPreviewVideo();
      }
    }

    this.options.defaultQuality = options.defaultQuality;

    this.updateCSSFilters();

    if (options.keybinds) {
      this.keybindManager.setKeybinds(options.keybinds);
    }

    if (this.options.analyzeVideos) {
      this.videoAnalyzer.enable();
    } else {
      this.videoAnalyzer.disable();
    }

    if (this.state.miniplayer) {
      this.interfaceController.requestMiniplayer(true);
    }

    if (options.toolSettings) {
      this.options.toolSettings = options.toolSettings;
      this.interfaceController.updateToolVisibility();
    }

    this.updateHasDownloadSpace();
    this.interfaceController.updateAutoNextIndicator();

    this.syncedAudioPlayer?.setVideoDelay(this.options.videoDelay);
  }

  updateCSSFilters() {
    if (this.options.videoDaltonizerType !== DaltonizerTypes.NONE && this.options.videoDaltonizerStrength > 0) {
      const previous = document.getElementById('daltonizer-svg');
      if (previous) {
        previous.remove();
      }

      const {svg, filter} = CSSFilterUtils.makeLMSDaltonizerFilter(
          this.options.videoDaltonizerType, this.options.videoDaltonizerStrength,
      );
      svg.id = 'daltonizer-svg';
      filter.id = `daltonizer-${this.options.videoDaltonizerType}-${this.options.videoDaltonizerStrength}`;
      svg.style.position = 'absolute';
      svg.style.width = '0px';
      svg.style.height = '0px';
      DOMElements.playerContainer.appendChild(svg);
    }

    const filterStr = CSSFilterUtils.getFilterString(this.options);
    const transformStr = CSSFilterUtils.getTransformString(this.options);

    if (this.player) {
      this.player.getVideo().style.filter = filterStr;
      this.player.getVideo().style.transform = transformStr;
    }

    if (this.previewPlayer) {
      this.previewPlayer.getVideo().style.filter = filterStr;
      this.previewPlayer.getVideo().style.transform = transformStr;
    }
  }

  loadAnalyzerData(data) {
    if (data) this.videoAnalyzer.loadAnalyzerData(data);
  }

  clearSubtitles() {
    this.interfaceController.subtitlesManager.clearTracks();
  }

  loadSubtitleTrack(subtitleTrack, autoset = false) {
    return this.interfaceController.subtitlesManager.loadTrackAndActivateBest(subtitleTrack, autoset);
  }

  updateDuration() {
    this.interfaceController.durationChanged();
    this.updateHasDownloadSpace();
  }

  updateTime(time) {
    this.state.currentTime = time;
    this.interfaceController.timeUpdated();

    if (this.options.storeProgress && this.progressData && time !== this.progressData.lastTime && !this.disableProgressSave) {
      const now = Date.now();
      if (now - this.lastProgressSave > 1000) {
        this.lastProgressSave = now;
        this.progressData.lastTime = time;
        this.saveProgressData();
      }
    }
  }

  seekPreview(time) {
    if (this.previewPlayer) {
      this.previewPlayer.currentTime = time;
      this.updatePreview();
    }
  }

  hidePreview() {
    if (this.previewPlayer) {
      this.previewPlayer.getVideo().style.opacity = 0;
      clearTimeout(this.previewPlayerLoadingTimeout);
      this.previewPlayerLoadingTimeout = setTimeout(() => {
        if (parseFloat(this.previewPlayer.getVideo().style.opacity) === 0) {
          DOMElements.seekPreviewVideo.classList.add('loading');
        }
      }, 200);
    }
  }

  showPreview() {
    if (this.previewPlayer) {
      this.previewPlayer.getVideo().style.opacity = 1;
      DOMElements.seekPreviewVideo.classList.remove('loading');
      clearTimeout(this.previewPlayerLoadingTimeout);
    }
  }

  updatePreview() {
    if (!this.previewPlayer) return;

    if (this.previewPlayer.getVideo().readyState > 1) {
      this.showPreview();
      return;
    }

    let shouldShowPreview = false;
    // check if time is buffered
    const time = this.previewPlayer.currentTime;
    const buffered = this.previewPlayer.buffered;
    for (let i = 0; i < buffered.length; i++) {
      if (time >= buffered.start(i) && time <= buffered.end(i)) {
        shouldShowPreview = true;
        break;
      }
    }

    if (shouldShowPreview) {
      this.showPreview();
    } else {
      this.hidePreview();
    }
  }

  updateQualityLevels() {
    this.interfaceController.updateQualityLevels();
    this.interfaceController.updateLanguageTracks();
    this.updateHasDownloadSpace();
  }

  changeLanguage(type, language) {
    const levels = type === 'video' ? this.getVideoLevels() : this.getAudioLevels();
    if (!levels) return;
    const currentLevelID = type === 'video' ? this.getCurrentVideoLevelID() : this.getCurrentAudioLevelID();
    const currentLevel = levels.get(currentLevelID);
    const matchingLevels = Array.from(levels.values()).filter((level) => level.language === language);
    if (matchingLevels.length === 0) {
      console.warn('No matching levels for language', language, type, levels);
      return;
    }

    if (type === 'video') {
      this.levelManager.setCurrentVideoLanguage(language);
    } else {
      this.levelManager.setCurrentAudioLanguage(language);
    }

    const chosen = type === 'video' ?
      this.levelManager.pickVideoLevel(matchingLevels, currentLevel?.height) :
      this.levelManager.pickAudioLevel(matchingLevels);

    console.log('changeLanguage chosen level', chosen, type, language);
    if (chosen) {
      if (type === 'video') {
        this.setCurrentVideoLevelID(chosen.id);
      } else {
        this.setCurrentAudioLevelID(chosen.id);
      }
    }
  }

  updateHasDownloadSpace() {
    const levels = this.getVideoLevels();
    if (!levels) return;

    const currentVideoLevelID = this.getCurrentVideoLevelID();
    const level = levels.get(currentVideoLevelID);
    if (!level) return;

    if (this.source?.loadedFromArchive) {
      return;
    }

    if (EnvUtils.isIncognito()) {
      if (this.hasDownloadSpace) {
        this.state.bufferBehind = this.options.bufferBehind;
        this.state.bufferAhead = this.options.bufferAhead;
        const timestr = StringUtils.formatDuration(this.state.bufferBehind + this.state.bufferAhead);
        this.interfaceController.setStatusMessage('info', Localize.getMessage('player_buffer_incognito_warning', [timestr]), 'warning', 5000);
        this.hasDownloadSpace = false;
      }
    } else {
      let bitrate = level.bitrate;
      const fragments = this.fragments;
      if (fragments) {
        let count = 0;
        let size = 0;
        let totalDuration = 0;
        fragments.forEach((fragment) => {
          if (fragment && fragment.dataSize !== null) {
            count++;
            size += fragment.dataSize;
            totalDuration += fragment.duration;
          }
        });

        if (count > 4) {
          bitrate = size / totalDuration * 8;
        }
      }
      if (bitrate && this.duration) {
        let storageAvailable = (this.storageAvailable * 8) * 0.6;
        if (this.options.maxVideoSize > 0 && this.options.maxVideoSize * 8 < storageAvailable) {
          storageAvailable = this.options.maxVideoSize * 8;
        }

        const canBufferTime = storageAvailable / bitrate / 1.1;
        let bufferAhead = Math.max(Math.floor(canBufferTime - this.state.bufferBehind), 0);

        if (bufferAhead < this.options.bufferAhead || !this.options.downloadAll) {
          this.state.bufferAhead = this.options.bufferAhead;
          bufferAhead = 0;
        } else if (bufferAhead > 0 && Math.abs(this.state.bufferAhead - bufferAhead) > 30) {
          this.state.bufferAhead = Math.max(bufferAhead, this.options.bufferAhead);
        }

        const newHasDownloadSpace = (bitrate * this.duration) * (this.hasDownloadSpace ? 1 : 1.1) < storageAvailable;
        if (!newHasDownloadSpace && this.hasDownloadSpace) {
          // fragments.forEach((fragment) => {
          //   if (fragment && fragment.status === DownloadStatus.DOWNLOAD_COMPLETE) {
          //     fragment.addReference(ReferenceTypes.GRANDFATHERED); // Don't free already downloaded fragments
          //   }
          // });
          const timestr = StringUtils.formatDuration(this.state.bufferBehind + this.state.bufferAhead);
          this.interfaceController.setStatusMessage(StatusTypes.INFO, Localize.getMessage('player_buffer_storage_warning', [timestr]), 'warning', 5000);
        }
        this.hasDownloadSpace = newHasDownloadSpace;
      } else {
        this.hasDownloadSpace = true;
      }
    }

    // if (!this.hasDownloadSpace) {
    //   this.audioAnalyzer.disableBackground();
    //   this.frameExtractor.disableBackground();
    // } else {
    //   this.audioAnalyzer.enableBackground();
    //   this.frameExtractor.enableBackground();
    // }
  }

  async addSource(source, setSource = false) {
    source = source.copy();

    console.log('addSource', source);
    source = this.sourcesBrowser.addSource(source);
    if (setSource) {
      await this.setSource(source);
    }
    this.sourcesBrowser.updateSources();
    return source;
  }

  setAutoPlay(value) {
    console.log('setAutoPlay', value);
    this.options.autoPlay = value;
  }

  attachProcessorsToPlayer(player) {
    if (this.source.mode === PlayerModes.ACCELERATED_YT) {
      player.preProcessFragment = this.player.preProcessFragment.bind(this.player);
      player.postProcessFragment = this.player.postProcessFragment.bind(this.player);
    }
  }

  async setupPreviewPlayer() {
    if (!this.player || this.previewPlayer || !this.options.previewEnabled) {
      return;
    }

    if (this.player.getSource()) {
      this.previewPlayer = await this.playerLoader.createPlayer(this.player.getSource().mode, this, {
        isPreview: true,
      });

      // check if its yt mode
      this.attachProcessorsToPlayer(this.previewPlayer);

      await this.previewPlayer.setup();
      this.bindPreviewPlayer(this.previewPlayer);

      await this.previewPlayer.setSource(this.player.getSource());
      this.interfaceController.addPreviewVideo(this.previewPlayer.getVideo());
      this.updateCSSFilters();
    }
  }

  async setSource(source) {
    try {
      source = source.copy();

      let timeFromURL = null;
      if (source.mode === PlayerModes.ACCELERATED_YT) {
        timeFromURL = URLUtils.get_param(source.url, 't') || URLUtils.get_param(source.url, 'start') || '';
        timeFromURL = timeFromURL.replace('s', '');
        timeFromURL = parseInt(timeFromURL);
      } else {
        timeFromURL = URLUtils.get_param(source.url, 'faststream-timestamp');
        timeFromURL = parseInt(timeFromURL);
      }

      if (isNaN(timeFromURL)) {
        timeFromURL = null;
      }

      // Strip out the timestamp from the URL
      if (timeFromURL !== null) {
        try {
          const url = new URL(source.url);
          url.searchParams.delete('faststream-timestamp');
          source.url = url.toString();
        } catch (e) {
          console.error(e);
        }
      }

      if (timeFromURL === null) {
        timeFromURL = URLUtils.get_param(window.location.href, 'faststream-timestamp');
        timeFromURL = parseInt(timeFromURL);
      }


      const autoPlay = this.options.autoPlay;

      console.log('setSource', source);
      await this.resetPlayer();
      this.source = source;

      if (source.defaultLevelInfo?.level !== undefined) {
        this.getLevelManager().setCurrentVideoLevelID(source.defaultLevelInfo.level);
      }

      if (source.defaultLevelInfo?.audio !== undefined) {
        this.getLevelManager().setCurrentAudioLevelID(source.defaultLevelInfo.audio);
      }

      this.storageAvailable = await EnvUtils.getAvailableStorage();

      const options = {};
      if (source.mode === PlayerModes.ACCELERATED_YT) {
        options.defaultClient = this.options.defaultYoutubeClient;
      }
      this.player = await this.playerLoader.createPlayer(source.mode, this, options);

      await this.player.setup();

      this.bindPlayer(this.player);

      if (!this.initPromise) {
        this.initPromise = this.setupInitHook();
        this.initPromise.then(() => {
          this.initPromise = null;
        });
      }


      await this.player.setSource(source);
      this.interfaceController.addVideo(this.player.getVideo());

      if (EnvUtils.isWebAudioSupported()) {
        this.audioContext = new AudioContext();
        this.audioSource = this.audioContext.createMediaElementSource(this.player.getVideo());

        this.audioOutputNode = new VirtualAudioNode('mainSource');
        this.audioOutputNode.connectFrom(this.audioSource);

        this.audioAnalyzer.setupAnalyzerNodeForMainPlayer(this.player.getVideo(), this.audioOutputNode, this.audioContext, ()=>{
          return this.currentVideo.currentTime + this.options.videoDelay / 1000;
        });
        this.audioConfigManager.setupNodes(this.audioContext);
        this.audioConfigManager.getInputNode().connectFrom(this.audioOutputNode);
        this.audioConfigManager.getOutputNode().connect(this.audioContext.destination);
      }

      this.syncedAudioPlayer = new SyncedAudioPlayer(this);
      this.syncedAudioPlayer.setPlaybackRate(this.state.playbackRate);
      await this.syncedAudioPlayer.setup(this.audioContext, this.audioSource, this.audioOutputNode);
      this.syncedAudioPlayer.setVideoDelay(this.options.videoDelay);

      this.setVolume(this.state.volume);

      this.player.playbackRate = this.state.playbackRate;

      this.setSeekSave(false);
      this.currentTime = 0;
      this.setSeekSave(true);

      if (this.player.getSource()) {
        await this.setupPreviewPlayer();

        await this.videoAnalyzer.setSource(this.player.getSource());

        this.frameExtractor.updateBackground();
      }

      this.updateCSSFilters();

      this.interfaceController.updateToolVisibility();

      this.state.autoPlayTriggered = false;
      if (autoPlay) {
        this.play().then(() => {
          this.state.autoPlayTriggered = true;
        });
      }

      this.loadProgressData().then(async () => {
        this.disableProgressSave = true;

        // Wait for the player to be ready
        if (this.initPromise) {
          await this.initPromise;
        }

        if (timeFromURL) {
          this.setSeekSave(false);
          this.currentTime = timeFromURL || 0;
          this.setSeekSave(true);
        } else if (this.options.storeProgress && this.progressData && !this.options.disableLoadProgress) {
          const lastTime = this.progressData.lastTime;
          if (lastTime && lastTime < this.duration - 5) {
            this.setSeekSave(false);
            this.currentTime = lastTime;
            this.setSeekSave(true);
          }
        }

        this.disableProgressSave = false;

        if (autoPlay && !this.state.autoPlayTriggered) {
          this.play().then(() => {
            this.state.autoPlayTriggered = true;
          });
        }
      });
    } catch (e) {
      AlertPolyfill.errorSendToDeveloper(e);
      console.error(e);
    }

    this.emit('setsource', this);
  }


  setupInitHook() {
    return new Promise((resolve) => {
      let interval = 0;

      const hook = () => {
        if (!this.duration || !this.currentVideo || this.currentVideo.readyState === 0) return;
        clearInterval(interval);
        this.context.off(DefaultPlayerEvents.DURATIONCHANGE, hook);
        resolve();
      };

      interval = setInterval(hook, 1000);

      this.context.on(DefaultPlayerEvents.DURATIONCHANGE, hook);
      hook();
    });
  }

  async loadProgressData() {
    if (!this.options.storeProgress || !this.player || this.disableProgressSave || this.progressData || !this.progressMemory) {
      return;
    }

    this.disableProgressSave = true;
    this.progressHashesCache = await this.progressMemory.getHashes(this.player.getSource().identifier);
    this.progressData = (await this.progressMemory.getFile(this.progressHashesCache)) || {
      lastTime: 0,
    };
    this.disableProgressSave = false;
  }

  async saveProgressData() {
    if (this.disableProgressSave || !this.progressData) {
      return;
    }

    return this.progressMemory.setFile(this.progressHashesCache, this.progressData);
  }

  getNextToDownload() {
    const currentFragment = this.currentFragment;
    const audioFragment = this.currentAudioFragment;

    const nextVideo = this.getNextToDownloadTrack(currentFragment);
    const nextAudio = this.getNextToDownloadTrack(audioFragment);

    if (!nextVideo) {
      return nextAudio;
    }

    if (!nextAudio) {
      return nextVideo;
    }
    const diffV = Math.abs(nextVideo.start - this.state.currentTime);
    const diffA = Math.abs(nextAudio.start - this.state.currentTime);

    if (diffV < diffA) {
      return nextVideo;
    } else {
      return nextAudio;
    }
  }

  getNextToDownloadTrack(currentFragment) {
    if (!currentFragment) {
      return null;
    }

    const fragments = this.getFragments(currentFragment.level);
    if (!fragments) {
      return null;
    }

    const index = currentFragment.sn;

    const nextItem = this.getNextForward(fragments, index) || this.getNextBackward(fragments, index);

    return nextItem;
  }

  getNextForward(fragments, index) {
    for (let i = index; i < fragments.length; i++) {
      const fragment = fragments[i];
      if (fragment && fragment.status === DownloadStatus.WAITING) {
        return fragment;
      }
    }
  }

  getNextBackward(fragments, index) {
    for (let i = index - 1; i >= 0; i--) {
      const fragment = fragments[i];
      if (fragment && fragment.status === DownloadStatus.WAITING) {
        return fragment;
      }
    }
  }

  mainloop() {
    if (this.destroyed) return;
    setTimeout(this.mainloop.bind(this), 1000);

    if (this.needsUserInteraction()) {
      this.interfaceController.setStatusMessage(StatusTypes.REQINTERACTION, Localize.getMessage('player_needs_interaction'), 'warning clickable');
    } else {
      this.interfaceController.setStatusMessage(StatusTypes.REQINTERACTION, null);
    }

    if (this.player) {
      this.updatePreview();
      this.predownloadFragments();

      if (!this.shouldDownloadAll()) {
        if (this.fragments) this.freeFragments(this.fragments);
        if (this.audioFragments) this.freeFragments(this.audioFragments);
      }
    }

    this.interfaceController.tick();
    this.checkLevelChange();
    this.videoAnalyzer.update();
    this.videoAnalyzer.saveAnalyzerData();
    this.updateHasDownloadSpace();
    if (this.syncedAudioPlayer) this.syncedAudioPlayer.watcherLoop();
    this.emit('tick', this);
  }

  predownloadFragments() {
    // Don't pre-download if user is offline
    if (!navigator.onLine) {
      return false;
    }

    // Don't pre-download if user needs to interact
    if (this.needsUserInteraction()) {
      return false;
    }

    // throttle download speed if needed
    const speed = this.downloadManager.getSpeed();
    if (this.options.maxSpeed >= 0 && speed > this.options.maxSpeed) {
      return false;
    }

    let nextDownload = this.getNextToDownload();
    let hasDownloaded = false;
    let index = 0;

    while (nextDownload) {
      if (nextDownload.canFree() && !this.shouldDownloadAll()) {
        if (nextDownload.start > this.state.currentTime + this.state.bufferAhead) {
          break;
        }

        if (nextDownload.end < this.state.currentTime - this.state.bufferBehind) {
          break;
        }
      }

      if (!this.downloadManager.canGetFile(nextDownload.getContext())) {
        break;
      }

      hasDownloaded = true;
      this.player.downloadFragment(nextDownload).catch((e) => {

      });
      nextDownload = this.getNextToDownload();
      if (index++ > 10000) {
        throw new Error('Infinite loop detected');
      }
    }

    if (!hasDownloaded && (
      this.videoAnalyzer.isRunning() || this.interfaceController.saveManager.makingDownload
    )) {
      hasDownloaded = this.predownloadReservedFragments();
    }
    return hasDownloaded;
  }

  predownloadReservedFragments() {
    const fragments = this.getWaitingReservedFragments(this.fragments);
    const audioFragments = this.getWaitingReservedFragments(this.audioFragments);

    let hasDownloaded = false;

    if (audioFragments.length > 0 && (
      fragments.length === 0 || fragments[0].start > audioFragments[0].start
    )) {
      audioFragments.every((fragment) => {
        if (!this.downloadManager.canGetFile(fragment.getContext())) {
          return false;
        }
        this.player.downloadFragment(fragment).catch((e) => {

        });
        hasDownloaded = true;
        return true;
      });
    }

    if (hasDownloaded) {
      return true;
    }

    fragments.every((fragment) => {
      if (!this.downloadManager.canGetFile(fragment.getContext())) {
        return false;
      }
      this.player.downloadFragment(fragment).catch((e) => {

      });
      hasDownloaded = true;
      return true;
    });

    return hasDownloaded;
  }

  getWaitingReservedFragments(fragments) {
    if (!fragments) return [];
    return fragments.filter((fragment) => {
      return fragment && fragment.status === DownloadStatus.WAITING && !fragment.canFree();
    });
  }

  freeFragments(fragments) {
    for (let i = 0; i < fragments.length; i++) {
      const fragment = fragments[i];
      if (fragment && fragment.status === DownloadStatus.DOWNLOAD_COMPLETE && fragment.canFree()) {
        if (fragment.end < this.state.currentTime - this.state.bufferBehind || fragment.start > this.state.currentTime + this.state.bufferAhead) {
          this.freeFragment(fragment);
        }
      }
    }
  }

  freeFragment(fragment) {
    this.downloadManager.removeFile(fragment.getContext());
    fragment.status = DownloadStatus.WAITING;
  }

  getFragment(level, sn) {
    if (!this.fragmentsStore[level]) {
      return null;
    }
    return this.fragmentsStore[level][sn];
  }

  makeFragment(level, sn, frag) {
    if (!this.fragmentsStore[level]) {
      this.fragmentsStore[level] = [];
    }

    this.fragmentsStore[level][sn] = frag;
  }

  failedToLoad(reason) {
    this.downloadManager.removeAllDownloaders();
    this.interfaceController.failedToLoad(reason);
  }

  async resetPlayer() {
    const promises = [];
    this.lastTime = 0;

    this.fragmentsStore = {};
    this.pastSeeks.length = 0;
    this.pastUnseeks.length = 0;
    this.progressHashesCache = null;
    this.progressData = null;
    this.disableProgressSave = false;
    this.lastProgressSave = 0;
    this.state.bufferBehind = this.options.bufferBehind;
    this.state.bufferAhead = this.options.bufferAhead;
    if (this.context) {
      this.context.destroy();
      this.context = null;
    }

    if (this.previewContext) {
      this.previewContext.destroy();
      this.previewContext = null;
    }

    if (this.player) {
      try {
        this.player.destroy();
      } catch (e) {
        console.error(e);
      }
      this.player = null;
    }

    if (this.source) {
      this.source.destroy();
      this.source = null;
    }

    if (this.previewPlayer) {
      try {
        this.previewPlayer.destroy();
      } catch (e) {
        console.error(e);
      }
      this.previewPlayer = null;
    }

    if (this.syncedAudioPlayer) {
      try {
        this.syncedAudioPlayer.destroy();
      } catch (e) {
        console.error(e);
      }
      this.syncedAudioPlayer = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.audioSource) {
      this.audioSource.disconnect();
      this.audioSource = null;
    }

    this.audioAnalyzer.reset();
    this.frameExtractor.reset();

    promises.push(this.downloadManager.reset());
    this.interfaceController.reset();

    this.state.buffering = false;

    this.storageAvailable = 0;
    this.hasDownloadSpace = true;
    this.previousLevel = -1;
    this.previousAudioLevel = -1;
    this.getLevelManager().reset();

    await Promise.all(promises);
  }

  setMediaInfo(info) {
    this.mediaInfo = info;
    this.interfaceController.subtitlesManager.mediaInfoSet();
  }

  bindPlayer(player) {
    this.context = player.createContext();
    this.context.on(DefaultPlayerEvents.MANIFEST_PARSED, () => {
      console.log('MANIFEST_PARSED');
      this.updateQualityLevels();
    });

    this.context.on(DefaultPlayerEvents.ABORT, (event) => {

    });

    this.context.on(DefaultPlayerEvents.CANPLAY, (event) => {
      this.player.playbackRate = this.state.playbackRate;

      if (!this.state.autoPlayTriggered && this.options.autoPlay && this.state.playing === false) {
        this.state.autoPlayTriggered = true;
        this.play();
      }
    });

    this.context.on(DefaultPlayerEvents.CANPLAYTHROUGH, (event) => {

    });

    this.context.on(DefaultPlayerEvents.COMPLETE, (event) => {

    });

    this.context.on(DefaultPlayerEvents.DURATIONCHANGE, (event) => {
      this.updateDuration();
      this.interfaceController.updateFragmentsLoaded();
    });

    this.context.on(DefaultPlayerEvents.EMPTIED, (event) => {
    });


    this.context.on(DefaultPlayerEvents.ENDED, (event) => {
      this.pause();
      if (this.options.autoplayNext) {
        this.nextVideo();
      }
    });

    this.context.on(DefaultPlayerEvents.ERROR, (event, msg) => {
      console.error('ERROR', event);
      this.failedToLoad(msg || Localize.getMessage('player_error_load'));
    });

    this.context.on(DefaultPlayerEvents.NEED_KEY, (event) => {
      this.failedToLoad(Localize.getMessage('player_error_drm'));
    });

    this.context.on(DefaultPlayerEvents.LOADEDDATA, (event) => {
    });


    this.context.on(DefaultPlayerEvents.LOADEDMETADATA, (event) => {
      this.interfaceController.updateQualityLevels();
    });


    this.context.on(DefaultPlayerEvents.PAUSE, (event) => {
      this.interfaceController.pause();
    });


    this.context.on(DefaultPlayerEvents.PLAY, (event) => {
      this.interfaceController.play();
    });


    this.context.on(DefaultPlayerEvents.PLAYING, (event) => {
      this.interfaceController.setBuffering(false);
    });


    this.context.on(DefaultPlayerEvents.PROGRESS, (event) => {
    });


    this.context.on(DefaultPlayerEvents.RATECHANGE, (event) => {
    });


    this.context.on(DefaultPlayerEvents.SEEKED, (event) => {
      this.interfaceController.updateFragmentsLoaded();
    });


    this.context.on(DefaultPlayerEvents.SEEKING, (event) => {
    });


    this.context.on(DefaultPlayerEvents.STALLED, (event) => {
    });


    this.context.on(DefaultPlayerEvents.SUSPEND, (event) => {
    });


    this.context.on(DefaultPlayerEvents.TIMEUPDATE, (event) => {
      if (this.interfaceController.isUserSeeking()) return;

      this.updateTime(this.currentTime);

      if (this.videoAnalyzer.pushFrame(this.player.getVideo())) {
        this.videoAnalyzer.calculate();
      }
    });


    this.context.on(DefaultPlayerEvents.VOLUMECHANGE, (event) => {

    });


    this.context.on(DefaultPlayerEvents.WAITING, (event) => {
      this.interfaceController.setBuffering(true);
    });

    this.context.on(DefaultPlayerEvents.FRAGMENT_UPDATE, () => {
      this.interfaceController.updateFragmentsLoaded();
    });

    this.context.on(DefaultPlayerEvents.SKIP_SEGMENTS, () => {
      this.interfaceController.updateSkipSegments();
    });
  }

  bindPreviewPlayer(player) {
    this.previewContext = player.createContext();

    this.previewContext.on(DefaultPlayerEvents.MANIFEST_PARSED, () => {
      player.setCurrentVideoLevelID(this.getCurrentVideoLevelID());
      player.setCurrentAudioLevelID(this.getCurrentAudioLevelID());
    });

    this.previewContext.on(DefaultPlayerEvents.FRAGMENT_UPDATE, (fragment) => {
      this.interfaceController.updateFragmentsLoaded();
    });

    this.previewContext.on(DefaultPlayerEvents.SEEKED, (event) => {
      this.updatePreview();
    });


    this.previewContext.on(DefaultPlayerEvents.SEEKING, (event) => {
      this.updatePreview();
    });


    this.previewContext.on(DefaultPlayerEvents.ERROR, (e) => {
      console.log('Preview player error', e);
      this.previewPlayer.destroy();
      this.previewPlayer = null;
      this.interfaceController.resetPreviewVideo();

      if (!this.interfaceController.failed) {
        const now = Date.now();
        if (this.lastPreviewReload && now - this.lastPreviewReload < 1000) {
          return;
        }
        this.lastPreviewReload = now;
        console.error('Reloading preview player');
        this.setupPreviewPlayer();
      }
    });
  }

  async play() {
    if (!this.player) {
      throw new Error('No source is loaded!');
    }

    // Will throw if browser blocks autoplay
    await this.player.play();

    // Everything below will only run if browser allows playing the video
    // (e.g. not blocked by autoplay policy)
    if (this.syncedAudioPlayer) {
      await this.syncedAudioPlayer.play();
    }

    this.interfaceController.play();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    this.audioAnalyzer.updateBackgroundAnalyzer();
  }

  async pause() {
    await this.player.pause();

    if (this.syncedAudioPlayer) {
      await this.syncedAudioPlayer.pause();
    }

    this.interfaceController.pause();
  }

  undoSeek() {
    if (this.pastSeeks.length) {
      this.pastUnseeks.push(this.player.currentTime);
      this.player.currentTime = this.pastSeeks.pop();
      this.interfaceController.updateMarkers();
    }
  }

  redoSeek() {
    if (this.pastUnseeks.length) {
      this.pastSeeks.push(this.player.currentTime);
      this.player.currentTime = this.pastUnseeks.pop();
      this.interfaceController.updateMarkers();
    }
  }

  savePosition() {
    if (!this.pastSeeks.length || this.pastSeeks[this.pastSeeks.length - 1] != this.state.currentTime) {
      this.pastSeeks.push(this.state.currentTime);
    }
    if (this.pastSeeks.length > 50) {
      this.pastSeeks.shift();
    }
    this.pastUnseeks.length = 0;
    this.interfaceController.updateMarkers();
  }

  isRegionBuffered(start, end) {
    const fragments = this.getFragments(this.getCurrentVideoLevelID());
    if (!fragments) {
      return true;
    }

    for (let i = 0; i < fragments.length; i++) {
      const fragment = fragments[i];
      if (fragment && fragment.end >= start && fragment.start <= end) {
        if (fragment.status !== DownloadStatus.DOWNLOAD_COMPLETE) {
          return false;
        }
      }
    }

    return true;
  }

  set currentTime(value) {
    if (this.saveSeek) {
      this.savePosition();
    }
    this.state.currentTime = value;
    if (this.player) {
      this.player.currentTime = value;
    }
    if (this.syncedAudioPlayer) this.syncedAudioPlayer.setCurrentTime(value);
  }

  get duration() {
    return this.player?.duration || 0;
  }

  get currentTime() {
    return this.player?.currentTime || 0;
  }

  get paused() {
    return this.player?.paused || true;
  }

  getVideoLevels() {
    return this.player?.getVideoLevels() || new Map();
  }

  getAudioLevels() {
    return this.player?.getAudioLevels() || new Map();
  }

  getCurrentVideoLevelID() {
    return this.player?.getCurrentVideoLevelID() ?? null;
  }

  getCurrentAudioLevelID() {
    return this.player?.getCurrentAudioLevelID() ?? null;
  }

  setCurrentVideoLevelID(levelID) {
    this.player.setCurrentVideoLevelID(levelID);
    this.checkLevelChange();
  }

  setCurrentAudioLevelID(levelID) {
    this.player.setCurrentAudioLevelID(levelID);
    this.checkLevelChange();
  }

  checkLevelChange() {
    const videoLevelID = this.getCurrentVideoLevelID();
    const audioLevelID = this.getCurrentAudioLevelID();

    const previousVideoLevelID = this.levelManager.getCurrentVideoLevelID();
    const previousAudioLevelID = this.levelManager.getCurrentAudioLevelID();

    const videoChanged = videoLevelID !== null && (videoLevelID !== previousVideoLevelID);
    const audioChanged = audioLevelID !== null && (audioLevelID !== previousAudioLevelID);

    if (videoChanged) {
      if (this.options.freeUnusedChannels && this.fragmentsStore[previousVideoLevelID]) {
        this.fragmentsStore[previousVideoLevelID].forEach((fragment, i) => {
          if (i === -1) return;
          this.freeFragment(fragment);
        });
      }
      this.levelManager.setCurrentVideoLevelID(videoLevelID);
    }

    if (audioChanged) {
      if (this.options.freeUnusedChannels && this.fragmentsStore[previousAudioLevelID]) {
        this.fragmentsStore[previousAudioLevelID].forEach((fragment, i) => {
          if (i === -1) return;
          this.freeFragment(fragment);
        });
      }
      this.levelManager.setCurrentAudioLevelID(audioLevelID);
    }

    if (videoChanged || audioChanged) {
      this.videoAnalyzer.setLevel(videoLevelID, audioLevelID);
      this.audioAnalyzer.setLevel(videoLevelID, audioLevelID);
      this.frameExtractor.setLevel(videoLevelID, audioLevelID);
      if (this.syncedAudioPlayer) {
        this.syncedAudioPlayer.setLevel(videoLevelID, audioLevelID);
      }
      if (this.previewPlayer) {
        this.previewPlayer.setCurrentVideoLevelID(videoLevelID);
        this.previewPlayer.setCurrentAudioLevelID(audioLevelID);
      }
      this.resetFailed();
      this.updateQualityLevels();
    }
  }

  getFullscreenState() {
    if (this.state.fullscreen) {
      return 'fullscreen';
    }

    if (this.interfaceController.isInPip()) {
      return 'pip';
    }

    if (this.state.windowedFullscreen) {
      return 'windowed';
    }

    return 'normal';
  }

  escapeAll() {
    if (this.interfaceController.closeAllMenus(false)) {
      return;
    }

    if (InterfaceUtils.closeWindows()) {
      return;
    }

    if (this.state.fullscreen) {
      this.interfaceController.fullscreenToggle(false);
      return;
    }

    if (this.interfaceController.isInPip()) {
      this.interfaceController.pipToggle(false);
      return;
    }

    if (this.state.windowedFullscreen) {
      this.interfaceController.toggleWindowedFullscreen(false);
      return;
    }

    this.interfaceController.hideControlBar();
  }

  nextVideo() {
    if (!this.hasNextVideo()) return;
    if (EnvUtils.isExtension()) {
      chrome.runtime.sendMessage({
        type: MessageTypes.REQUEST_PLAYLIST_NAVIGATION,
        direction: 'next',
        continuationOptions: {
          fullscreenState: this.getFullscreenState(),
          autoPlay: true,
          disableLoadProgress: true,
        },
      }, ()=>{

      });
    }
  }

  previousVideo() {
    if (!this.hasPreviousVideo()) return;
    if (EnvUtils.isExtension()) {
      chrome.runtime.sendMessage({
        type: MessageTypes.REQUEST_PLAYLIST_NAVIGATION,
        direction: 'previous',
        continuationOptions: {
          fullscreenState: this.getFullscreenState(),
          autoPlay: true,
        },
      }, ()=>{

      });
    }
  }


  hasPreviousVideo() {
    if (!this.player) return false;
    if (window.top === window.self) return false;
    if (!this.state.hasPrevVideo) return false;
    return true;
  }

  hasNextVideo() {
    if (!this.player) return false;
    if (window.top === window.self) return false;
    if (!this.state.hasNextVideo) return false;
    return true;
  }

  get fragments() {
    return this.fragmentsStore[this.getCurrentVideoLevelID()];
  }

  get audioFragments() {
    return this.fragmentsStore[this.getCurrentAudioLevelID()];
  }

  get currentFragment() {
    return this.player?.currentFragment || null;
  }

  get currentAudioFragment() {
    return this.player?.currentAudioFragment || null;
  }

  getFragments(level) {
    return this.fragmentsStore[level];
  }

  setVolume(volume) {
    this.state.volume = volume;
    if (SET_VOLUME_USING_NODE || (volume > 1 && EnvUtils.isWebAudioSupported())) {
      if (this.player && (!this.syncedAudioPlayer || !this.syncedAudioPlayer.setVolume(1))) {
        this.player.volume = 1;
      }
      this.audioConfigManager.updateVolume(volume);
    } else {
      if (this.player && (!this.syncedAudioPlayer || !this.syncedAudioPlayer.setVolume(volume))) {
        this.player.volume = volume;
      }
      if (EnvUtils.isWebAudioSupported()) this.audioConfigManager.updateVolume(1);
    }
  }

  get volume() {
    return this.state.volume;
  }

  set volume(value) {
    this.interfaceController.setVolume(value);
  }

  get playbackRate() {
    return this.player?.playbackRate || this.state.playbackRate;
  }

  set playbackRate(value) {
    this.state.playbackRate = value;
    if (this.player) {
      this.player.playbackRate = value;
    }
    if (this.syncedAudioPlayer) {
      this.syncedAudioPlayer.setPlaybackRate(value);
    }
    this.interfaceController.updatePlaybackRate();
  }

  get currentVideo() {
    return this.player?.getVideo() || null;
  }

  get skipSegments() {
    return this.player?.skipSegments || [];
  }

  get chapters() {
    return this.player?.chapters || [];
  }

  get videoWidth() {
    return this.player?.getVideo().videoWidth || 0;
  }

  get videoHeight() {
    return this.player?.getVideo().videoHeight || 0;
  }

  debugDemo() {
    this.interfaceController.hideControlBar = ()=>{};

    this.videoAnalyzer.introAligner.detectedStartTime = 0;
    this.videoAnalyzer.introAligner.detectedEndTime = 30;
    this.videoAnalyzer.introAligner.found = true;
    this.videoAnalyzer.introAligner.emit('match', true);

    this.currentTime = 6;
    this.player.getVideo().style.objectFit = 'cover';
  }
}

