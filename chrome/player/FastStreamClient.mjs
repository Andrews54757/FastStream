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
import {ReferenceTypes} from './enums/ReferenceTypes.mjs';
import {PlayerModes} from './enums/PlayerModes.mjs';
import {URLUtils} from './utils/URLUtils.mjs';
import {YoutubeClients} from './enums/YoutubeClients.mjs';
import {StringUtils} from './utils/StringUtils.mjs';
import {StatusTypes} from './ui/StatusManager.mjs';

const SET_VOLUME_USING_NODE = false; // !EnvUtils.isSafari() && EnvUtils.isWebAudioSupported();

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
      bufferAhead: 180,
      bufferBehind: 20,
      freeFragments: true,
      downloadAll: false,
      freeUnusedChannels: true,
      storeProgress: false,
      previewEnabled: true,
      autoplayNext: false,
      singleClickAction: ClickActions.HIDE_CONTROLS,
      doubleClickAction: ClickActions.PLAY_PAUSE,
      tripleClickAction: ClickActions.FULLSCREEN,
      visChangeAction: VisChangeActions.NOTHING,
      defaultYoutubeClient: YoutubeClients.IOS,
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
      seekStepSize: 0.2,
      defaultQuality: 'Auto',
      toolSettings: Utils.mergeOptions(DefaultToolSettings, {}),
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
    };

    this._needsUserInteraction = false;

    this.progressMemory = null;
    this.playerLoader = new PlayerLoader();
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

    this.player = null;
    this.previewPlayer = null;
    this.saveSeek = true;
    this.pastSeeks = [];
    this.pastUnseeks = [];
    this.fragmentsStore = {};
    this.mainloop();
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

  shouldDownloadAll() {
    return this.options.downloadAll && this.hasDownloadSpace;
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
    this.options.defaultYoutubeClient = options.defaultYoutubeClient;
    this.options.autoplayNext = options.autoplayNext;

    this.options.videoBrightness = options.videoBrightness;
    this.options.videoContrast = options.videoContrast;
    this.options.videoSaturation = options.videoSaturation;
    this.options.videoGrayscale = options.videoGrayscale;
    this.options.videoSepia = options.videoSepia;
    this.options.videoInvert = options.videoInvert;
    this.options.videoHueRotate = options.videoHueRotate;
    this.options.videoDaltonizerType = options.videoDaltonizerType;
    this.options.videoDaltonizerStrength = options.videoDaltonizerStrength;
    this.options.previewEnabled = options.previewEnabled;

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
    if (this.interfaceController.miniPlayerActive) {
      this.interfaceController.requestMiniplayer(true);
    }

    if (options.toolSettings) {
      this.options.toolSettings = options.toolSettings;
      this.interfaceController.updateToolVisibility();
    }

    this.updateHasDownloadSpace();
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
      document.body.appendChild(svg);
    }

    const filterStr = CSSFilterUtils.getFilterString(this.options);

    if (this.player) {
      this.player.getVideo().style.filter = filterStr;
    }

    if (this.previewPlayer) {
      this.previewPlayer.getVideo().style.filter = filterStr;
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

  updateHasDownloadSpace() {
    const levels = this.levels;
    if (!levels) return;

    const currentLevel = this.currentLevel;
    const level = levels.get(currentLevel);
    if (!level) return;

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
        let bufferAhead = 0;
        if (this.options.maxVideoSize > 0 && this.options.maxVideoSize * 8 < storageAvailable) {
          storageAvailable = this.options.maxVideoSize * 8;
          const canBufferTime = storageAvailable / bitrate / 1.1;
          bufferAhead = Math.floor(canBufferTime - this.state.bufferBehind);
        }

        if (bufferAhead === 0 || !this.options.downloadAll) {
          this.state.bufferAhead = this.options.bufferAhead;
          bufferAhead = 0;
        }

        const newHasDownloadSpace = (bitrate * this.duration) * (this.hasDownloadSpace ? 1 : 1.1) < storageAvailable;
        if (!newHasDownloadSpace && this.hasDownloadSpace) {
          fragments.forEach((fragment) => {
            if (fragment && fragment.status === DownloadStatus.DOWNLOAD_COMPLETE) {
              fragment.addReference(ReferenceTypes.GRANDFATHERED); // Don't free already downloaded fragments
            }
          });
          if (bufferAhead > 0) {
            this.state.bufferAhead = Math.max(bufferAhead, this.options.bufferAhead);
          }
          const timestr = StringUtils.formatDuration(this.state.bufferBehind + this.state.bufferAhead);
          this.interfaceController.setStatusMessage(StatusTypes.INFO, Localize.getMessage('player_buffer_storage_warning', [timestr]), 'warning', 5000);
        } else if (bufferAhead > 0) {
          this.state.bufferAhead = Math.max(Math.min(bufferAhead, this.state.bufferAhead), this.options.bufferAhead);
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

  async setupPreviewPlayer() {
    if (!this.player || this.previewPlayer || !this.options.previewEnabled) {
      return;
    }

    if (this.player.getSource()) {
      this.previewPlayer = await this.playerLoader.createPlayer(this.player.getSource().mode, this, {
        isPreview: true,
      });

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

      const estimate = await navigator.storage.estimate();
      this.storageAvailable = estimate.quota - estimate.usage;

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
        this.audioAnalyzer.setupAnalyzerNodeForMainPlayer(this.player.getVideo(), this.audioSource, this.audioContext);
        this.audioConfigManager.setupNodes(this.audioContext);
        this.audioConfigManager.getInputNode().connectFrom(this.audioSource);
        this.audioConfigManager.getOutputNode().connect(this.audioContext.destination);
      }

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

      if (autoPlay) {
        this.play();
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
        } else if (this.options.storeProgress && this.progressData) {
          const lastTime = this.progressData.lastTime;
          if (lastTime && lastTime < this.duration - 5) {
            this.setSeekSave(false);
            this.currentTime = lastTime;
            this.setSeekSave(true);
          }
        }

        this.disableProgressSave = false;

        if (autoPlay) {
          this.play();
        }
      });
    } catch (e) {
      const msg = 'Please send this error to the developer at https://github.com/Andrews54757/FastStream/issues \n' + e + '\n' + e.stack;
      const el = document.createElement('div');
      el.style.position = 'fixed';
      el.style.top = '0';
      el.style.left = '0';
      el.style.width = '100%';
      el.style.height = '200px';
      el.style.backgroundColor = 'white';
      el.style.zIndex = '999999999';
      el.innerText = msg;
      document.body.appendChild(el);

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
      this.videoAnalyzer.isRunning() || this.interfaceController.makingDownload
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

    await Promise.all(promises);
  }

  setMediaName(name) {
    this.mediaName = name;
    this.interfaceController.subtitlesManager.mediaNameSet();
  }

  bindPlayer(player) {
    this.context = player.createContext();
    this.context.on(DefaultPlayerEvents.MANIFEST_PARSED, (maxLevel, maxAudioLevel) => {
      const source = player.getSource();
      console.log('MANIFEST_PARSED', maxLevel, maxAudioLevel);
      if (maxLevel !== undefined) {
        if (source.defaultLevelInfo?.level !== undefined) {
          this.currentLevel = source.defaultLevelInfo.level;
        } else {
          this.currentLevel = maxLevel;
        }
      } else {
        console.warn('No recommended level found');
      }
      if (maxAudioLevel !== undefined) {
        if (source.defaultLevelInfo?.audio !== undefined) {
          this.currentAudioLevel = source.defaultLevelInfo.audio;
        } else {
          this.currentAudioLevel = maxAudioLevel;
        }
      }

      this.player.load();
      this.updateQualityLevels();
    });

    this.context.on(DefaultPlayerEvents.ABORT, (event) => {

    });

    let autoPlayTriggered = false;
    this.context.on(DefaultPlayerEvents.CANPLAY, (event) => {
      this.player.playbackRate = this.state.playbackRate;

      if (!autoPlayTriggered && this.options.autoPlay && this.state.playing === false) {
        autoPlayTriggered = true;
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

    this.context.on(DefaultPlayerEvents.LANGUAGE_TRACKS, (e) => {
      this.interfaceController.updateLanguageTracks();
    });
  }

  bindPreviewPlayer(player) {
    this.previewContext = player.createContext();

    this.previewContext.on(DefaultPlayerEvents.MANIFEST_PARSED, () => {
      player.currentLevel = this.currentLevel;
      player.load();
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
    this.interfaceController.play();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    this.audioAnalyzer.updateBackgroundAnalyzer();
  }

  async pause() {
    await this.player.pause();
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
    const fragments = this.getFragments(this.currentLevel);
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

  get levels() {
    return this.player?.levels || new Map();
  }

  get currentLevel() {
    return this.player?.currentLevel;
  }

  get currentAudioLevel() {
    return this.player?.currentAudioLevel;
  }

  set currentLevel(value) {
    this.player.currentLevel = value;
    this.checkLevelChange();
  }

  set currentAudioLevel(value) {
    this.player.currentAudioLevel = value;
    this.checkLevelChange();
  }

  checkLevelChange() {
    const level = this.currentLevel;
    const audioLevel = this.currentAudioLevel;

    let hasChanged = false;

    if (level !== this.previousLevel) {
      if (this.options.freeUnusedChannels && this.fragmentsStore[this.previousLevel]) {
        this.fragmentsStore[this.previousLevel].forEach((fragment, i) => {
          if (i === -1) return;
          this.freeFragment(fragment);
        });
      }
      if (this.previewPlayer) {
        this.previewPlayer.currentLevel = level;
      }
      this.previousLevel = level;
      hasChanged = true;
    }

    if (audioLevel !== this.previousAudioLevel) {
      if (this.options.freeUnusedChannels && this.fragmentsStore[this.previousAudioLevel]) {
        this.fragmentsStore[this.previousAudioLevel].forEach((fragment, i) => {
          if (i === -1) return;
          this.freeFragment(fragment);
        });
      }
      this.previousAudioLevel = audioLevel;
      hasChanged = true;
    }

    if (hasChanged) {
      this.videoAnalyzer.setLevel(level, audioLevel);
      this.audioAnalyzer.setLevel(level, audioLevel);
      this.frameExtractor.setLevel(level, audioLevel);
      this.resetFailed();
      this.updateQualityLevels();
    }
  }

  nextVideo() {
    if (!this.player || !this.player.nextVideo) {
      return null;
    }
    return this.player.nextVideo();
  }

  previousVideo() {
    if (!this.player || !this.player.previousVideo) {
      return null;
    }
    return this.player.previousVideo();
  }

  get fragments() {
    return this.fragmentsStore[this.currentLevel];
  }

  get audioFragments() {
    return this.fragmentsStore[this.currentAudioLevel];
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
      if (this.player) this.player.volume = 1;
      this.audioConfigManager.updateVolume(volume);
    } else {
      if (this.player) this.player.volume = volume;
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

  get languageTracks() {
    return this.player?.languageTracks || {
      video: [],
      audio: [],
    };
  }

  setLanguageTrack(track) {
    this.player.setLanguageTrack(track);
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

