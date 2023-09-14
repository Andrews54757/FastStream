import {InterfaceController} from './ui/InterfaceController.mjs';
import {KeybindManager} from './ui/KeybindManager.mjs';
import {DownloadManager} from './network/DownloadManager.mjs';
import {DefaultPlayerEvents} from './enums/DefaultPlayerEvents.mjs';
import {DownloadStatus} from './enums/DownloadStatus.mjs';
import {SubtitlesManager} from './ui/SubtitlesManager.mjs';
import {VideoAnalyzer} from './analyzer/VideoAnalyzer.mjs';
import {AnalyzerEvents} from './enums/AnalyzerEvents.mjs';
import {EventEmitter} from './modules/eventemitter.mjs';
import {SourcesBrowser} from './ui/SourcesBrowser.mjs';
import {SubtitleSyncer} from './ui/SubtitleSyncer.mjs';
import {PlayerLoader} from './players/PlayerLoader.mjs';


export class FastStreamClient extends EventEmitter {
  constructor() {
    super();
    this.version = (typeof chrome !== undefined && chrome.runtime) ? chrome.runtime.getManifest().version : '#.#.#';

    this.options = {
      introCutoff: 5 * 60,
      outroCutoff: 5 * 60,
      bufferAhead: 60,
      bufferBehind: 20,
      freeFragments: true,
      downloadAll: false,
    };
    this.persistent = {
      playing: false,
      buffering: false,
      currentTime: 0,
      volume: 1,
      muted: false,
      latestVolume: 1,
      duration: 0,
      playbackRate: 1,
    };

    this.playerLoader = new PlayerLoader();
    this.interfaceController = new InterfaceController(this);
    this.keybindManager = new KeybindManager(this);
    this.downloadManager = new DownloadManager(this);
    this.subtitlesManager = new SubtitlesManager(this);
    this.sourcesBrowser = new SourcesBrowser(this);
    this.videoAnalyzer = new VideoAnalyzer(this);
    this.subtitleSyncer = new SubtitleSyncer(this);
    this.videoAnalyzer.on(AnalyzerEvents.MATCH, () => {
      this.interfaceController.updateIntroOutroBar();
    });

    this.player = null;
    this.previewPlayer = null;
    this.saveSeek = true;
    this.seeks = [];
    this.fragmentsStore = {};
    this.mainloop();
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
  }

  destroy() {
    this.destroyed = true;
    this.resetPlayer();
    this.downloadManager.destroy();
    this.videoAnalyzer.destroy();
    this.interfaceController.destroy();
  }

  setOptions(options) {
    this.options.analyzeVideos = options.analyzeVideos;
    this.options.downloadAll = options.downloadAll;
    this.options.autoEnableBestSubtitles = options.autoEnableBestSubtitles;

    if (options.keybinds) {
      this.keybindManager.setKeybinds(options.keybinds);
    }
  }

  loadAnalyzerData(data) {
    if (data) this.videoAnalyzer.loadAnalyzerData(data);
  }

  clearSubtitles() {
    this.subtitlesManager.clearTracks();
  }

  loadSubtitleTrack(subtitleTrack) {
    this.subtitlesManager.addTrack(subtitleTrack);
    const defLang = this.subtitlesManager.settings['default-lang'];
    if (this.options.autoEnableBestSubtitles && subtitleTrack.language === defLang && this.subtitlesManager.activeTracks.length === 0) {
      this.subtitlesManager.activateTrack(subtitleTrack);
    }
  }
  updateDuration(duration) {
    this.persistent.duration = duration;
    this.interfaceController.durationChanged();
    this.updateHasDownloadSpace();
  }

  updateTime(time) {
    this.persistent.currentTime = time;
    this.interfaceController.updateProgress();
    this.subtitlesManager.renderSubtitles();
    this.subtitleSyncer.onVideoTimeUpdate();
    this.interfaceController.updateIntroOutroBar();
  }

  seekPreview(time) {
    if (this.previewPlayer) {
      this.previewPlayer.currentTime = time;
    }
  }

  updateQualityLevels() {
    this.interfaceController.updateQualityLevels();
    this.updateHasDownloadSpace();
  }

  updateHasDownloadSpace() {
    this.hasDownloadSpace = false;
    this.options.bufferBehind = 20;
    this.options.bufferAhead = 60;
    const levels = this.levels;
    if (!levels) return;

    const currentLevel = this.previousLevel;
    const level = levels.get(currentLevel);

    if (!level) return;

    if (chrome?.extension?.inIncognitoContext) {
      this.interfaceController.setDownloadStatus(``, -1);
      this.interfaceController.setDownloadStatus(`Not enough space to download video in Incognito mode`, 5000);
      this.hasDownloadSpace = false;
    } else {
      if (level.bitrate && this.duration) {
        const storageAvailable = (this.storageAvailable * 8) * 0.6;
        this.hasDownloadSpace = (level.bitrate * this.duration) < storageAvailable;
        const bufferable = storageAvailable / level.bitrate;
        this.options.bufferBehind = Math.round(Math.min(20, bufferable / 2));
        this.options.bufferAhead = Math.round(bufferable - this.options.bufferBehind);
      } else {
        this.hasDownloadSpace = true;
      }

      this.interfaceController.setDownloadStatus(``, -1);
      if (!this.hasDownloadSpace) {
        this.interfaceController.setDownloadStatus(`Not enough space to download video, will buffer ${this.options.bufferBehind + this.options.bufferAhead}s`, 5000);
      }
    }
  }

  async addSource(source, setSource = false) {
    console.log('addSource', source);
    this.sourcesBrowser.addSource(source);
    if (setSource) {
      await this.setSource(source);
    }
    this.sourcesBrowser.updateSources();
    return source;
  }


  async setSource(source) {
    console.log('setSource', source);
    this.resetPlayer();
    this.source = source;

    const estimate = await navigator.storage.estimate();
    this.storageAvailable = estimate.quota - estimate.usage;

    this.player = await this.playerLoader.createPlayer(source.mode, this);
    await this.player.setup();

    this.bindPlayer(this.player);

    this.player.volume = this.persistent.volume;
    this.player.playbackRate = this.persistent.playbackRate;

    await this.player.setSource(source);
    this.interfaceController.addVideo(this.player.getVideo());


    this.setSeekSave(false);
    this.currentTime = 0;
    this.setSeekSave(true);

    this.previewPlayer = await this.playerLoader.createPlayer(this.player.getSource().mode, this, {
      isPreview: true,
    });
    await this.previewPlayer.setup();

    await this.previewPlayer.setSource(this.player.getSource());
    this.interfaceController.addPreviewVideo(this.previewPlayer.getVideo());

    await this.videoAnalyzer.setSource(this.player.getSource());
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
      }
    }

    this.videoAnalyzer.update();
    this.videoAnalyzer.saveAnalyzerData();
  }

  predownloadFragments() {
    let nextDownload = this.getNextToDownload();
    let hasDownloaded = false;
    let index = 0;
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

  resetPlayer() {
    this.lastTime = 0;

    this.fragmentsStore = {};
    this.seeks.length = 0;
    if (this.context) {
      this.context.destroy();
      this.context = null;
    }

    if (this.player) {
      this.player.destroy();
      this.player = null;
    }

    if (this.source) {
      this.source.destroy();
      this.source = null;
    }

    if (this.previewPlayer) {
      this.previewPlayer.destroy();
      this.previewPlayer = null;
    }

    this.downloadManager.reset();
    this.interfaceController.reset();
    this.subtitlesManager.clearTracks();

    this.persistent.buffering = false;

    this.storageAvailable = 0;
    this.hasDownloadSpace = false;
    this.previousLevel = -1;
    this.previousAudioLevel = -1;
    this.options.bufferBehind = 20;
    this.options.bufferAhead = 60;
  }

  setMediaName(name) {
    this.mediaName = name;
    this.subtitlesManager.mediaNameSet();
  }

  debugstuff() {
    const res = [];
    this.fragmentsStore[this.currentLevel].forEach((fragment) => {
      const entry = this.downloadManager.getEntry(fragment.getContext());
      res.push(entry.data.size);
    });
    console.log(res.join('\n'));
  }

  bindPlayer() {
    this.context = this.player.createContext();


    this.context.on(DefaultPlayerEvents.MANIFEST_PARSED, (maxLevel, maxAudioLevel) => {
      if (maxLevel !== undefined) {
        this.currentLevel = maxLevel;
      } else {
        console.warn('No recommended level found');
      }
      if (maxAudioLevel !== undefined) {
        this.currentAudioLevel = maxAudioLevel;
      }

      this.player.load();
      if (this.previewPlayer) {
        this.previewPlayer.load();
      }
      this.updateQualityLevels();
    });

    this.context.on(DefaultPlayerEvents.ABORT, (event) => {

    });

    this.context.on(DefaultPlayerEvents.CANPLAY, (event) => {

    });

    this.context.on(DefaultPlayerEvents.CANPLAYTHROUGH, (event) => {

    });

    this.context.on(DefaultPlayerEvents.COMPLETE, (event) => {

    });

    this.context.on(DefaultPlayerEvents.DURATIONCHANGE, (event) => {
      this.updateDuration(this.duration);
      this.interfaceController.updateFragmentsLoaded();
    });

    this.context.on(DefaultPlayerEvents.EMPTIED, (event) => {
    });


    this.context.on(DefaultPlayerEvents.ENDED, (event) => {
      this.pause();
    });

    this.context.on(DefaultPlayerEvents.ERROR, (event) => {
      console.log('ERROR', event);
      this.failedToLoad('Failed to load video');
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

    if (this.previewPlayer) {
      this.previewPlayer.on(DefaultPlayerEvents.MANIFEST_PARSED, () => {
        this.previewPlayer.currentLevel = this.currentLevel;
      });

      this.previewPlayer.on(DefaultPlayerEvents.FRAGMENT_UPDATE, (fragment) => {
        this.interfaceController.updateFragmentsLoaded();
      });

      const seekHideTimeouts = [];
      this.previewPlayer.on(DefaultPlayerEvents.SEEKING, () => {
        seekHideTimeouts.push(setTimeout(() => {
          this.previewPlayer.getVideo().style.opacity = 0;
        }, 200));
      });

      this.previewPlayer.on(DefaultPlayerEvents.SEEKED, () => {
        seekHideTimeouts.forEach((timeout) => {
          clearTimeout(timeout);
        });
        seekHideTimeouts.length = 0;

        this.previewPlayer.getVideo().style.opacity = 1;
      });

      this.previewPlayer.on(DefaultPlayerEvents.ERROR, (e) => {
        console.log('Preview player error', e);
      });
    }
  }

  async play() {
    await this.player.play();
    this.interfaceController.play();
  }

  async pause() {
    await this.player.pause();
    this.interfaceController.pause();
  }

  undoSeek() {
    if (this.seeks.length) {
      this.player.currentTime = this.seeks.pop();
      this.interfaceController.updateMarkers();
    }
  }
  savePosition() {
    if (!this.seeks.length || this.seeks[this.seeks.length - 1] != this.persistent.currentTime) {
      this.seeks.push(this.persistent.currentTime);
    }
    if (this.seeks.length > 50) {
      this.seeks.shift();
    }
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
    return this.player.currentLevel;
  }

  get currentAudioLevel() {
    return this.player?.currentAudioLevel;
  }

  set currentLevel(value) {
    const previousLevel = this.previousLevel;
    this.previousLevel = value;
    this.player.currentLevel = value;
    if (this.previewPlayer) {
      this.previewPlayer.currentLevel = value;
    }
    this.videoAnalyzer.setLevel(value);

    if (value !== previousLevel && this.fragmentsStore[previousLevel]) {
      this.fragmentsStore[previousLevel].forEach((fragment, i) => {
        if (i === -1) return;
        this.freeFragment(fragment);
      });
    }

    const currentLevel = this.currentLevel;
    const currentAudioLevel = this.currentAudioLevel;

    // Reset all fragments to waiting in case some have failed.
    if (this.fragmentsStore[currentLevel]) {
      this.fragmentsStore[currentLevel].forEach((fragment, i) => {
        if (i === -1) return;
        fragment.status = DownloadStatus.WAITING;
      });
    }

    if (this.fragmentsStore[currentAudioLevel]) {
      this.fragmentsStore[currentAudioLevel].forEach((fragment, i) => {
        if (i === -1) return;
        fragment.status = DownloadStatus.WAITING;
      });
    }

    this.updateQualityLevels();
  }

  set currentAudioLevel(value) {
    const previousLevel = this.previousAudioLevel;
    this.previousAudioLevel = value;
    this.player.currentAudioLevel = value;

    if (value !== previousLevel && this.fragmentsStore[previousLevel]) {
      this.fragmentsStore[previousLevel].forEach((fragment, i) => {
        if (i === -1) return;
        this.freeFragment(fragment);
      });
    }

    this.updateQualityLevels();
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

  get volume() {
    return this.player?.volume || this.persistent.volume;
  }

  set volume(value) {
    this.persistent.volume = value;
    if (this.player) this.player.volume = value;
    this.interfaceController.updateVolumeBar();
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
}

