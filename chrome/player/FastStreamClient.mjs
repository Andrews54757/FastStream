import {InterfaceController} from './ui/InterfaceController.mjs';
import {KeybindManager} from './ui/KeybindManager.mjs';
import {DownloadManager} from './network/DownloadManager.mjs';
import {DefaultPlayerEvents} from './enums/DefaultPlayerEvents.mjs';
import {DownloadStatus} from './enums/DownloadStatus.mjs';
import {SubtitlesManager} from './ui/subtitles/SubtitlesManager.mjs';
import {VideoAnalyzer} from './modules/analyzer/VideoAnalyzer.mjs';
import {AnalyzerEvents} from './enums/AnalyzerEvents.mjs';
import {EventEmitter} from './modules/eventemitter.mjs';
import {SourcesBrowser} from './ui/SourcesBrowser.mjs';
import {SubtitleSyncer} from './ui/subtitles/SubtitleSyncer.mjs';
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


export class FastStreamClient extends EventEmitter {
  constructor() {
    super();
    this.version = EnvUtils.getVersion();

    this.options = {
      autoPlay: false,
      maxSpeed: 300 * 1000 * 1000, // 300 MB/s
      introCutoff: 5 * 60,
      outroCutoff: 5 * 60,
      bufferAhead: 120,
      bufferBehind: 20,
      freeFragments: true,
      downloadAll: false,
      freeUnusedChannels: true,
      storeProgress: false,
      singleClickAction: ClickActions.HIDE_CONTROLS,
      doubleClickAction: ClickActions.PLAY_PAUSE,
      tripleClickAction: ClickActions.FULLSCREEN,
      visChangeAction: VisChangeActions.NOTHING,
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
      defaultPlaybackRate: 1,
      qualityMultiplier: 1,
    };
    this.persistent = {
      playing: false,
      buffering: false,
      currentTime: 0,
      volume: 1,
      muted: false,
      latestVolume: 1,
      playbackRate: 1,
    };

    this.progressMemory = null;
    this.playerLoader = new PlayerLoader();
    this.interfaceController = new InterfaceController(this);
    this.keybindManager = new KeybindManager(this);
    this.downloadManager = new DownloadManager(this);
    this.subtitlesManager = new SubtitlesManager(this);
    this.sourcesBrowser = new SourcesBrowser(this);
    this.videoAnalyzer = new VideoAnalyzer(this);
    this.subtitleSyncer = new SubtitleSyncer(this);
    this.audioConfigManager = new AudioConfigManager(this);
    this.videoAnalyzer.on(AnalyzerEvents.MATCH, () => {
      this.interfaceController.updateSkipSegments();
    });
    this.interfaceController.updateVolumeBar();

    this.player = null;
    this.previewPlayer = null;
    this.saveSeek = true;
    this.pastSeeks = [];
    this.pastUnseeks = [];
    this.fragmentsStore = {};
    this.audioContext = new AudioContext();
    this.audioConfigManager.setupNodes();
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
  }

  shouldDownloadAll() {
    return this.options.downloadAll && this.hasDownloadSpace;
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

    if (options.storeProgress !== this.options.storeProgress) {
      if (options.storeProgress) {
        if (this.progressMemory && this.player) {
          this.loadProgressData(false);
        }
      }
    }

    this.options.storeProgress = options.storeProgress;
    this.options.downloadAll = options.downloadAll;
    this.options.freeUnusedChannels = options.freeUnusedChannels;
    this.options.autoEnableBestSubtitles = options.autoEnableBestSubtitles;
    this.options.maxSpeed = options.maxSpeed;
    this.options.seekStepSize = options.seekStepSize;
    this.options.singleClickAction = options.singleClickAction;
    this.options.doubleClickAction = options.doubleClickAction;
    this.options.tripleClickAction = options.tripleClickAction;
    this.options.visChangeAction = options.visChangeAction;
    this.options.miniSize = options.miniSize;
    this.options.miniPos = options.miniPos;

    this.options.videoBrightness = options.videoBrightness;
    this.options.videoContrast = options.videoContrast;
    this.options.videoSaturation = options.videoSaturation;
    this.options.videoGrayscale = options.videoGrayscale;
    this.options.videoSepia = options.videoSepia;
    this.options.videoInvert = options.videoInvert;
    this.options.videoHueRotate = options.videoHueRotate;
    this.options.videoDaltonizerType = options.videoDaltonizerType;
    this.options.videoDaltonizerStrength = options.videoDaltonizerStrength;

    this.options.qualityMultiplier = options.qualityMultiplier;

    if (this.persistent.playbackRate === this.options.defaultPlaybackRate) {
      this.playbackRate = options.playbackRate;
    }
    this.options.defaultPlaybackRate = options.playbackRate;

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
  }

  updateCSSFilters() {
    if (this.options.videoDaltonizerType !== -1 && this.options.videoDaltonizerStrength > 0) {
      const previous = document.getElementById('daltonizer-svg');
      if (previous) {
        previous.remove();
      }

      const {svg, filter} = CSSFilterUtils.makeLMSDaltonizerFilter(
          this.options.videoDaltonizerType, this.options.videoDaltonizerStrength,
      );
      svg.id = 'daltonizer-svg';
      filter.id = 'daltonizer';
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
    this.subtitlesManager.clearTracks();
  }

  loadSubtitleTrack(subtitleTrack, autoset = false) {
    return this.subtitlesManager.loadTrackAndActivateBest(subtitleTrack, autoset);
  }

  updateDuration() {
    this.interfaceController.durationChanged();
    this.updateHasDownloadSpace();
  }

  updateTime(time) {
    this.persistent.currentTime = time;
    this.interfaceController.updateProgress();
    this.subtitlesManager.renderSubtitles();
    this.subtitleSyncer.onVideoTimeUpdate();
    this.interfaceController.updateSkipSegments();

    if (this.options.storeProgress && this.progressData && time !== this.progressData.lastTime) {
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
    this.hasDownloadSpace = false;
    const levels = this.levels;
    if (!levels) return;

    const currentLevel = this.currentLevel;
    const level = levels.get(currentLevel);

    if (!level) return;

    if (EnvUtils.isIncognito()) {
      this.interfaceController.setStatusMessage('info', Localize.getMessage('player_buffer_incognito_warning', [this.options.bufferBehind + this.options.bufferAhead]), 'warning', 5000);
      this.hasDownloadSpace = false;
    } else {
      if (level.bitrate && this.duration) {
        const storageAvailable = (this.storageAvailable * 8) * 0.6;
        this.hasDownloadSpace = (level.bitrate * this.duration) < storageAvailable;
      } else {
        this.hasDownloadSpace = true;
      }

      if (!this.hasDownloadSpace) {
        this.interfaceController.setStatusMessage('info', Localize.getMessage('player_buffer_storage_warning', [this.options.bufferBehind + this.options.bufferAhead]), 'warning', 5000);
      }
    }
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

  async setSource(source) {
    source = source.copy();

    const autoPlay = this.options.autoPlay;

    console.log('setSource', source);
    await this.resetPlayer();
    this.source = source;

    const estimate = await navigator.storage.estimate();
    this.storageAvailable = estimate.quota - estimate.usage;

    this.player = await this.playerLoader.createPlayer(source.mode, this, {
      qualityMultiplier: this.options.qualityMultiplier,
    });

    await this.player.setup();

    this.bindPlayer(this.player);

    await this.player.setSource(source);
    this.interfaceController.addVideo(this.player.getVideo());

    this.audioContext = new AudioContext();
    this.audioSource = this.audioContext.createMediaElementSource(this.player.getVideo());

    this.audioConfigManager.setupNodes();

    this.audioGain = this.audioContext.createGain();
    this.audioConfigManager.getOutputNode().connect(this.audioGain);
    this.audioGain.connect(this.audioContext.destination);
    this.updateVolume();


    this.player.playbackRate = this.persistent.playbackRate;

    this.setSeekSave(false);
    this.currentTime = 0;
    this.setSeekSave(true);

    this.previewPlayer = await this.playerLoader.createPlayer(this.player.getSource().mode, this, {
      isPreview: true,
    });

    await this.previewPlayer.setup();
    this.bindPreviewPlayer(this.previewPlayer);


    await this.previewPlayer.setSource(this.player.getSource());
    this.interfaceController.addPreviewVideo(this.previewPlayer.getVideo());

    await this.videoAnalyzer.setSource(this.player.getSource());

    this.updateCSSFilters();
    this.interfaceController.updateToolVisibility();

    if (autoPlay) {
      this.play();
    }

    if (this.progressMemory && this.options.storeProgress) {
      await this.loadProgressData(true);
    }
  }

  async loadProgressData(changeTime = false) {
    if (this.progressDataLoading || this.progressData) {
      return;
    }

    this.progressDataLoading = true;
    this.progressHashesCache = await this.progressMemory.getHashes(this.player.getSource().identifier);
    this.progressData = (await this.progressMemory.getFile(this.progressHashesCache)) || {
      lastTime: 0,
    };

    if (!changeTime) {
      this.progressDataLoading = false;
      return;
    }

    const changeTimeFn = () =>{
      if (!this.duration) return;
      this.player.off(DefaultPlayerEvents.DURATIONCHANGE, changeTimeFn);

      if (!this.progressDataLoading || !this.progressData) return;
      this.progressDataLoading = false;

      const lastTime = this.progressData.lastTime;
      if (lastTime && lastTime < this.duration - 5) {
        this.setSeekSave(false);
        this.currentTime = lastTime;
        this.setSeekSave(true);
      }
    };

    this.player.on(DefaultPlayerEvents.DURATIONCHANGE, changeTimeFn);
    changeTimeFn();
  }

  async saveProgressData() {
    if (this.progressDataLoading || !this.progressData) {
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
    const diffV = Math.abs(nextVideo.start - this.persistent.currentTime);
    const diffA = Math.abs(nextAudio.start - this.persistent.currentTime);

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

    if (this.player) {
      this.updatePreview();
      this.predownloadFragments();

      if (!this.shouldDownloadAll()) {
        if (this.fragments) this.freeFragments(this.fragments);
        if (this.audioFragments) this.freeFragments(this.audioFragments);
      }

      this.interfaceController.updateFragmentsLoaded();

      // Detect buffering
      if (this.persistent.playing) {
        const time = this.currentTime;
        if (time === this.lastTime) {
          this.interfaceController.setBuffering(true);
        } else {
          this.interfaceController.setBuffering(false);
        }
        this.lastTime = time;
      } else if (this.currentVideo) {
        if (this.currentVideo.readyState === 0) {
          this.interfaceController.setBuffering(true);
        } else if (this.currentVideo.readyState > 1) {
          this.interfaceController.setBuffering(false);
        }
      }
    }

    this.checkLevelChange();
    this.videoAnalyzer.update();
    this.videoAnalyzer.saveAnalyzerData();
    this.interfaceController.updateStatusMessage();
  }

  predownloadFragments() {
    let nextDownload = this.getNextToDownload();
    let hasDownloaded = false;
    let index = 0;

    const speed = this.downloadManager.getSpeed();

    // throttle download speed so blob can catch up
    if (speed > this.options.maxSpeed) {
      return false;
    }

    while (nextDownload) {
      if (nextDownload.canFree() && !this.shouldDownloadAll()) {
        if (nextDownload.start > this.persistent.currentTime + this.options.bufferAhead) {
          break;
        }

        if (nextDownload.end < this.persistent.currentTime - this.options.bufferBehind) {
          break;
        }
      }

      if (!this.downloadManager.canGetFile(nextDownload.getContext())) {
        break;
      }

      hasDownloaded = true;
      this.player.downloadFragment(nextDownload);
      nextDownload = this.getNextToDownload();
      if (index++ > 10000) {
        throw new Error('Infinite loop detected');
      }
    }

    if (!hasDownloaded && this.videoAnalyzer.isRunning()) {
      hasDownloaded = this.predownloadReservedFragments();
    }
    return hasDownloaded;
  }

  predownloadReservedFragments() {
    const fragments = this.getReservedFragments(this.fragments);
    const audioFragments = this.getReservedFragments(this.audioFragments);

    if (audioFragments.length) {
      let currentVideoIndex = 0;
      audioFragments.forEach((fragment) => {
        const videoFragment = fragments[currentVideoIndex];
        while (videoFragment && videoFragment.start < fragment.start) {
          currentVideoIndex++;
        }

        fragments.splice(currentVideoIndex, 0, fragment);
      });
    }

    let hasDownloaded = false;

    fragments.every((fragment) => {
      if (!this.downloadManager.canGetFile(fragment.getContext())) {
        return false;
      }
      this.player.downloadFragment(fragment);
      hasDownloaded = true;
      return true;
    });

    return hasDownloaded;
  }

  getReservedFragments(fragments) {
    if (!fragments) return [];
    return fragments.filter((fragment) => {
      return fragment && fragment.status === DownloadStatus.WAITING && !fragment.canFree();
    });
  }

  freeFragments(fragments) {
    for (let i = 0; i < fragments.length; i++) {
      const fragment = fragments[i];
      if (fragment && fragment.status === DownloadStatus.DOWNLOAD_COMPLETE && fragment.canFree()) {
        if (fragment.end < this.persistent.currentTime - this.options.bufferBehind || fragment.start > this.persistent.currentTime + this.options.bufferAhead) {
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
    this.progressDataLoading = false;
    this.lastProgressSave = 0;
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

    if (this.audioGain) {
      this.audioGain.disconnect();
      this.audioGain = null;
    }

    promises.push(this.downloadManager.reset());
    this.interfaceController.reset();

    this.persistent.buffering = false;

    this.storageAvailable = 0;
    this.hasDownloadSpace = false;
    this.previousLevel = -1;
    this.previousAudioLevel = -1;

    await Promise.all(promises);
  }

  setMediaName(name) {
    this.mediaName = name;
    this.subtitlesManager.mediaNameSet();
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
      this.player.playbackRate = this.persistent.playbackRate;

      if (!autoPlayTriggered && this.options.autoPlay && this.persistent.playing === false) {
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
      if (this.interfaceController.isSeeking) return;

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
    });
  }

  async play() {
    if (!this.player) {
      throw new Error('No source is loaded!');
    }
    await this.player.play();
    this.interfaceController.play();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
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
    if (!this.pastSeeks.length || this.pastSeeks[this.pastSeeks.length - 1] != this.persistent.currentTime) {
      this.pastSeeks.push(this.persistent.currentTime);
    }
    if (this.pastSeeks.length > 50) {
      this.pastSeeks.shift();
    }
    this.pastUnseeks.length = 0;
    this.interfaceController.updateMarkers();
  }
  set currentTime(value) {
    if (this.saveSeek) {
      this.savePosition();
    }
    this.persistent.currentTime = value;
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
      this.videoAnalyzer.setLevel(level);
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
      this.resetFailed();
      this.updateQualityLevels();
    }
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

  updateVolume() {
    const value = this.persistent.volume;
    if (this.player) this.player.volume = 1;
    if (this.audioGain) this.audioGain.gain.value = value;
    this.interfaceController.updateVolumeBar();
  }

  get volume() {
    return this.persistent.volume;
  }

  set volume(value) {
    this.persistent.volume = value;
    this.updateVolume();
  }

  get playbackRate() {
    return this.player?.playbackRate || this.persistent.playbackRate;
  }

  set playbackRate(value) {
    this.persistent.playbackRate = value;
    if (this.player) this.player.playbackRate = value;
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

