import {DownloadStatus} from '../enums/DownloadStatus.mjs';
import {PlayerModes} from '../enums/PlayerModes.mjs';
import {Coloris} from '../modules/coloris.mjs';
import {Localize} from '../modules/Localize.mjs';
import {streamSaver} from '../modules/StreamSaver.mjs';
import {ClickActions} from '../options/defaults/ClickActions.mjs';
import {MiniplayerPositions} from '../options/defaults/MiniplayerPositions.mjs';
import {VisChangeActions} from '../options/defaults/VisChangeActions.mjs';
import {SubtitleTrack} from '../SubtitleTrack.mjs';
import {EnvUtils} from '../utils/EnvUtils.mjs';
import {FastStreamArchiveUtils} from '../utils/FastStreamArchiveUtils.mjs';
import {RequestUtils} from '../utils/RequestUtils.mjs';
import {StringUtils} from '../utils/StringUtils.mjs';
import {URLUtils} from '../utils/URLUtils.mjs';
import {Utils} from '../utils/Utils.mjs';
import {WebUtils} from '../utils/WebUtils.mjs';
import {VideoSource} from '../VideoSource.mjs';
import {DOMElements} from './DOMElements.mjs';
import {OptionsWindow} from './OptionsWindow.mjs';

export class InterfaceController {
  constructor(client) {
    this.client = client;
    this.persistent = client.persistent;
    this.isSeeking = false;
    this.hidden = false;
    this.shouldPlay = false;
    this.isMouseOverProgressbar = false;

    this.lastSpeed = 0;
    this.mouseOverControls = false;
    this.mouseActivityCooldown = 0;
    this.playbackRate = 10;

    this.skipSegments = [];

    this.hasShownSkip = false;
    this.failed = false;

    this.optionsWindow = new OptionsWindow();

    this.statusMessages = new Map();
    this.registerStatusLevel('welcome');
    this.registerStatusLevel('download');
    this.registerStatusLevel('info');
    this.registerStatusLevel('error');
    this.registerStatusLevel('save-video', 1);
    this.registerStatusLevel('save-screenshot', 1);
    this.registerStatusLevel('subtitles', 1);
    this.registerStatusLevel('chapter', 2);

    this.setupDOM();
  }

  registerStatusLevel(key, channel) {
    const level = {
      key,
      message: '',
      type: 'info',
      expiry: 0,
      channel: channel || 0,
      maxWidth: 0,
    };
    this.statusMessages.set(key, level);
  }

  setStatusMessage(key, message, type, expiry) {
    const level = this.statusMessages.get(key);
    if (!level) {
      throw new Error(`Unknown status level ${key}`);
    }

    level.message = message;
    level.type = type || 'info';
    level.expiry = expiry ? (Date.now() + expiry) : 0;
    this.updateStatusMessage();
  }

  getStatusMessage(key) {
    const level = this.statusMessages.get(key);
    if (!level) {
      throw new Error(`Unknown status level ${key}`);
    }

    return level.message;
  }

  updateStatusMessage() {
    const elements = DOMElements.statusMessages;
    const toDisplayList = new Array(elements.length).fill(null);
    this.statusMessages.forEach((level) => {
      if (level.expiry && Date.now() > level.expiry) {
        level.message = '';
      }
      if (level.message) {
        toDisplayList[level.channel] = level;
      }
    });

    let displayCount = 0;
    toDisplayList.forEach((toDisplay, index) => {
      const element = elements[index];
      if (!toDisplay) {
        element.style.display = 'none';
        return;
      }

      displayCount++;

      element.style.width = '';
      element.style.display = '';
      element.textContent = toDisplay.message;
      element.title = toDisplay.message;
      element.className = `status_message ${toDisplay.type}`;
    });

    if (displayCount > 1) {
      // Fix the widths of the earlier status messages
      let lastFound = false;
      for (let i = toDisplayList.length - 1; i >= 0; i--) {
        const toDisplay = toDisplayList[i];
        if (!toDisplay) {
          continue;
        }

        if (!lastFound) {
          lastFound = true;
          continue;
        }

        const element = elements[i];
        const width = element.offsetWidth + 5;

        toDisplay.maxWidth = Math.max(toDisplay.maxWidth, width);
        element.style.width = toDisplay.maxWidth + 'px';
      }
    } else {
      this.statusMessages.forEach((level) => {
        level.maxWidth = 0;
      });
    }
  }

  reset() {
    DOMElements.videoContainer.replaceChildren();
    DOMElements.seekPreviewVideo.replaceChildren();

    const spinner = document.createElement('div');
    spinner.classList.add('spinner');
    DOMElements.seekPreviewVideo.appendChild(spinner);
    DOMElements.seekPreviewVideo.classList.remove('loading');

    DOMElements.seekPreviewVideo.style.display = 'none';
    DOMElements.progressLoadedContainer.replaceChildren();
    this.progressCache = [];
    this.progressCacheAudio = [];
    this.skipSegments = [];
    this.hasShownSkip = false;
    this.failed = false;
    this.setStatusMessage('error', null, 'error');
    this.setStatusMessage('chapter', null, 'error');
    this.reuseDownloadURL = false;
    if (this.downloadURL) {
      URL.revokeObjectURL(this.downloadURL);
    }
    this.downloadURL = null;
    this.stopProgressLoop();
    this.persistent.playing = false;
    this.updatePlayPauseButton();
    DOMElements.playPauseButtonBigCircle.style.display = '';
    DOMElements.playerContainer.classList.add('controls_visible');
    this.updateToolVisibility();
  }

  failedToLoad(reason) {
    this.failed = true;
    this.setStatusMessage('error', reason, 'error');
    this.setBuffering(false);
  }

  setBuffering(isBuffering) {
    if (this.failed) {
      isBuffering = false;
    }

    if (this.persistent.buffering === isBuffering) {
      return;
    }

    this.persistent.buffering = isBuffering;

    if (isBuffering) {
      DOMElements.bufferingSpinner.style.display = '';
    } else {
      DOMElements.bufferingSpinner.style.display = 'none';
    }
  }

  dressVideo(video) {
    video.setAttribute('playsinline', 'playsinline');
    video.disableRemotePlayback = true;
  }

  addVideo(video) {
    this.dressVideo(video);
    DOMElements.videoContainer.appendChild(video);
  }

  addPreviewVideo(video) {
    this.dressVideo(video);
    DOMElements.seekPreviewVideo.style.display = '';
    DOMElements.seekPreviewVideo.appendChild(video);
  }

  collectProgressbarData(fragments) {
    let i = 0;
    let total = 0;
    let loaded = 0;
    let failed = 0;
    let currentTime = -1;
    const results = [];
    while (i < fragments.length) {
      const frag = fragments[i];

      if (!frag) {
        i++;
        continue;
      }
      total++;
      if (currentTime === -1) {
        currentTime = frag.start ? Math.max(frag.start, 0) : 0;
      }

      const start = currentTime;

      let end = currentTime + frag.duration;
      currentTime = end;

      if (frag.status === DownloadStatus.WAITING) {
        i++;
        continue;
      }

      const entry = {
        start: start,
        end: 0,
        width: 0,
        statusClass: 'download-uninitiated',
      };
      results.push(entry);

      if (frag.status === DownloadStatus.DOWNLOAD_INITIATED) {
        entry.statusClass = 'download-initiated';
      } else if (frag.status === DownloadStatus.DOWNLOAD_COMPLETE) {
        loaded++;
        entry.statusClass = 'download-complete';
      } else if (frag.status === DownloadStatus.DOWNLOAD_FAILED) {
        failed++;
        entry.statusClass = 'download-failed';
      }

      i++;

      while (i < fragments.length && fragments[i].status === frag.status) {
        end = currentTime + fragments[i].duration;
        currentTime = end;
        i++;

        total++;
        if (frag.status === DownloadStatus.DOWNLOAD_COMPLETE) {
          loaded++;
        } else if (frag.status === DownloadStatus.DOWNLOAD_FAILED) {
          failed++;
        }
      }

      entry.end = end;
      entry.width = end - start;
    }
    return {
      results, total, loaded, failed,
    };
  }

  updateProgressBar(cache, results, additionalClass) {
    const duration = this.client.duration;
    for (let i = cache.length; i < results.length; i++) {
      const entry = {
        start: -1,
        width: -1,
        className: '',
        element: document.createElement('div'),
      };
      DOMElements.progressLoadedContainer.appendChild(entry.element);
      cache.push(entry);
    }

    for (let i = results.length; i < cache.length; i++) {
      cache[i].element.remove();
    }

    cache.length = results.length;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const entry = cache[i];
      if (entry.start !== result.start) {
        entry.start = result.start;
        entry.element.style.left = Math.min(result.start / duration * 100, 100) + '%';
      }

      if (entry.width !== result.width) {
        entry.width = result.width;
        entry.element.style.width = Math.min(result.width / duration * 100, 100) + '%';
      }

      const className = ([result.statusClass, additionalClass]).join(' ');
      if (entry.className !== className) {
        entry.className = className;
        entry.element.className = className;
      }
    }
  }
  renderProgressBar(cache, fragments, additionalClass = null) {
    const {results, total, loaded, failed} = this.collectProgressbarData(fragments);

    this.updateProgressBar(cache, results, additionalClass);

    return {
      total,
      loaded,
      failed,
    };
  }
  updateFragmentsLoaded() {
    if (!this.client.player) {
      this.renderProgressBar(this.progressCache, []);
      this.renderProgressBar(this.progressCacheAudio, []);
      return;
    }

    const level = this.client.player.currentLevel;
    const audioLevel = this.client.player.currentAudioLevel;

    const fragments = this.client.getFragments(level);
    const audioFragments = this.client.getFragments(audioLevel);

    let total = 0;
    let loaded = 0;
    let failed = 0;

    if (fragments) {
      const result = this.renderProgressBar(this.progressCache, fragments, audioFragments ? 'download-video' : null);
      total += result.total;
      loaded += result.loaded;
      failed += result.failed;
    }

    if (audioFragments) {
      const result = this.renderProgressBar(this.progressCacheAudio, audioFragments, fragments ? 'download-audio' : null);
      total += result.total;
      loaded += result.loaded;
      failed += result.failed;
    }

    if (total === 0) {
      return;
    }

    const percentDone = Math.floor((loaded / total) * 1000) / 10;

    const newSpeed = this.client.downloadManager.getSpeed();
    if (newSpeed > 0 && this.lastSpeed > 0) {
      this.lastSpeed = (newSpeed * 0.05 + this.lastSpeed * 0.95) || 0;
    } else {
      this.lastSpeed = newSpeed;
    }

    let speed = this.lastSpeed; // bytes per second
    speed = Math.round(speed / 1000 / 1000 * 10) / 10; // MB per second

    if (loaded < total) {
      this.shownDownloadComplete = false;
      this.setStatusMessage('download', `${this.client.downloadManager.downloaders.length}C ↓${speed}MB/s ${percentDone}%`, 'success');
    } else if (!this.shownDownloadComplete) {
      this.shownDownloadComplete = true;
      this.setStatusMessage('download', Localize.getMessage('player_fragment_allbuffered'), 'success', 2000);
    }

    if (failed > 0) {
      DOMElements.resetFailed.style.display = '';
      DOMElements.resetFailed.textContent = Localize.getMessage(failed === 1 ? 'player_fragment_failed_singular' : 'player_fragment_failed_plural', [failed]);
    } else {
      DOMElements.resetFailed.style.display = 'none';
    }
  }

  setupDOM() {
    DOMElements.volumeContainer.addEventListener('mousedown', this.onVolumeBarMouseDown.bind(this));
    DOMElements.muteBtn.addEventListener('click', this.muteToggle.bind(this));
    DOMElements.volumeBlock.tabIndex = 0;
    DOMElements.volumeBlock.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.muteToggle();
        e.stopPropagation();
      } else if (e.key === 'ArrowLeft') {
        this.client.volume = Math.max(0, this.client.volume - 0.1);
        e.stopPropagation();
      } else if (e.key === 'ArrowRight') {
        this.client.volume = Math.min(3, this.client.volume + 0.1);
        e.stopPropagation();
      }
    });

    DOMElements.volumeBlock.addEventListener('wheel', (e) => {
      this.client.volume = Math.max(0, Math.min(3, this.client.volume + e.deltaY * 0.01));
      e.preventDefault();
      e.stopPropagation();
    });

    DOMElements.playPauseButton.addEventListener('click', this.playPauseToggle.bind(this));
    WebUtils.setupTabIndex(DOMElements.playPauseButton);

    DOMElements.playPauseButtonBigCircle.addEventListener('click', (e) => {
      this.hideControlBarOnAction();
      this.playPauseToggle();
      e.stopPropagation();
    });
    DOMElements.progressContainer.addEventListener('mousedown', this.onProgressbarMouseDown.bind(this));
    DOMElements.progressContainer.addEventListener('mouseenter', this.onProgressbarMouseEnter.bind(this));
    DOMElements.progressContainer.addEventListener('mouseleave', this.onProgressbarMouseLeave.bind(this));
    DOMElements.progressContainer.addEventListener('mousemove', this.onProgressbarMouseMove.bind(this));

    DOMElements.fullscreen.addEventListener('click', this.fullscreenToggle.bind(this));
    WebUtils.setupTabIndex(DOMElements.fullscreen);

    document.addEventListener('fullscreenchange', this.updateFullScreenButton.bind(this));
    let videoSourceClicked = false;
    DOMElements.videoSource.addEventListener('click', (e) => {
      videoSourceClicked = !videoSourceClicked;
      if (videoSourceClicked) {
        DOMElements.videoSourceList.style.display = '';
      } else {
        DOMElements.videoSourceList.style.display = 'none';
      }
      e.stopPropagation();
    });
    DOMElements.playerContainer.addEventListener('click', (e) => {
      videoSourceClicked = false;
      DOMElements.videoSourceList.style.display = 'none';
    });

    DOMElements.videoSource.tabIndex = 0;

    DOMElements.videoSource.addEventListener('focus', ()=>{
      DOMElements.videoSourceList.style.display = '';
    });

    DOMElements.videoSource.addEventListener('blur', ()=>{
      if (!videoSourceClicked) {
        DOMElements.videoSourceList.style.display = 'none';
      }
      const candidates = Array.from(DOMElements.videoSourceList.children);
      let current = candidates.find((el) => el.classList.contains('candidate'));
      if (!current) {
        current = candidates.find((el) => el.classList.contains('source_active'));
      }
      if (!current) {
        return;
      }
      current.classList.remove('candidate');
    });
    DOMElements.videoSource.addEventListener('keydown', (e) => {
      const candidates = Array.from(DOMElements.videoSourceList.children);
      let current = candidates.find((el) => el.classList.contains('candidate'));
      if (!current) {
        current = candidates.find((el) => el.classList.contains('source_active'));
      }
      if (!current) {
        return;
      }

      const index = candidates.indexOf(current);
      if (e.key === 'ArrowDown') {
        current.classList.remove('candidate');
        const next = (index < candidates.length - 1) ? candidates[index + 1] : candidates[0];
        next.classList.add('candidate');
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === 'ArrowUp') {
        current.classList.remove('candidate');
        const next = (index > 0) ? candidates[index - 1] : candidates[candidates.length - 1];
        next.classList.add('candidate');
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === 'Enter') {
        current.click();
        e.preventDefault();
        e.stopPropagation();
      }
    });

    let languageClicked = false;
    DOMElements.languageButton.addEventListener('click', (e) => {
      languageClicked = ! languageClicked;
      if (languageClicked) {
        DOMElements.languageMenu.style.display = '';
      } else {
        DOMElements.languageMenu.style.display = 'none';
      }
      e.stopPropagation();
    });
    DOMElements.playerContainer.addEventListener('click', (e) => {
      languageClicked = false;
      DOMElements.languageMenu.style.display = 'none';
    });

    DOMElements.languageButton.tabIndex = 0;

    DOMElements.languageButton.addEventListener('focus', ()=>{
      DOMElements.languageMenu.style.display = '';
    });

    DOMElements.languageButton.addEventListener('blur', ()=>{
      if (!languageClicked) {
        DOMElements.languageMenu.style.display = 'none';
      }
      const candidates = Array.from(DOMElements.languageMenu.getElementsByClassName('language_track'));
      let current = candidates.find((el) => el.classList.contains('candidate'));
      if (!current) {
        current = candidates.find((el) => el.classList.contains('active'));
      }
      if (!current) {
        return;
      }
      current.classList.remove('candidate');
    });
    DOMElements.languageButton.addEventListener('keydown', (e) => {
      const candidates = Array.from(DOMElements.languageMenu.getElementsByClassName('language_track'));
      let current = candidates.find((el) => el.classList.contains('candidate'));
      if (!current) {
        current = candidates.find((el) => el.classList.contains('active'));
      }
      if (!current) {
        return;
      }

      const index = candidates.indexOf(current);
      if (e.key === 'ArrowDown') {
        current.classList.remove('candidate');
        if (index < candidates.length - 1) {
          candidates[index + 1].classList.add('candidate');
        } else {
          candidates[0].classList.add('candidate');
        }
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === 'ArrowUp') {
        current.classList.remove('candidate');
        if (index > 0) {
          candidates[index - 1].classList.add('candidate');
        } else {
          candidates[candidates.length - 1].classList.add('candidate');
        }
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === 'Enter') {
        current.click();
        e.preventDefault();
        e.stopPropagation();
      }
    });

    DOMElements.languageMenu.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    DOMElements.playerContainer.addEventListener('mousemove', this.onPlayerMouseMove.bind(this));
    DOMElements.controlsContainer.addEventListener('mouseenter', this.onControlsMouseEnter.bind(this));
    DOMElements.controlsContainer.addEventListener('mouseleave', this.onControlsMouseLeave.bind(this));
    DOMElements.controlsContainer.addEventListener('focusin', ()=>{
      this.focusingControls = true;
      this.showControlBar();
    });
    DOMElements.controlsContainer.addEventListener('focusout', ()=>{
      this.focusingControls = false;
      this.queueControlsHide();
    });
    let clickCount = 0;
    let clickTimeout = null;
    DOMElements.videoContainer.addEventListener('click', (e) => {
      if (this.isBigPlayButtonVisible()) {
        this.playPauseToggle();
        return;
      }

      if (clickTimeout !== null) {
        clickCount++;
      } else {
        clickCount = 1;
      }
      clearTimeout(clickTimeout);
      clickTimeout = setTimeout(() => {
        clickTimeout = null;

        let clickAction;
        if (clickCount === 1) {
          clickAction = this.client.options.singleClickAction;
        } else if (clickCount === 2) {
          clickAction = this.client.options.doubleClickAction;
        } else if (clickCount === 3) {
          clickAction = this.client.options.tripleClickAction;
        } else {
          return;
        }

        switch (clickAction) {
          case ClickActions.FULLSCREEN:
            this.fullscreenToggle();
            break;
          case ClickActions.PIP:
            this.pipToggle();
            break;
          case ClickActions.PLAY_PAUSE:
            this.playPauseToggle();
            break;
          case ClickActions.HIDE_CONTROLS:
            this.focusingControls = false;
            this.mouseOverControls = false;
            this.hideControlBar();
            break;
          case ClickActions.HIDE_PLAYER:
            this.toggleHide();
            break;
        }
      }, clickCount < 3 ? 300 : 0);
    });
    DOMElements.hideButton.addEventListener('click', () => {
      DOMElements.hideButton.blur();
      this.focusingControls = false;
      this.hideControlBar();
    });

    WebUtils.setupTabIndex(DOMElements.hideButton);

    DOMElements.resetFailed.addEventListener('click', (e) => {
      this.client.resetFailed();
      e.stopPropagation();
    });
    WebUtils.setupTabIndex(DOMElements.resetFailed);

    DOMElements.skipButton.addEventListener('click', this.skipSegment.bind(this));

    DOMElements.download.addEventListener('click', this.saveVideo.bind(this));
    WebUtils.setupTabIndex(DOMElements.download);

    DOMElements.screenshot.addEventListener('click', this.saveScreenshot.bind(this));
    WebUtils.setupTabIndex(DOMElements.screenshot);

    DOMElements.pip.addEventListener('click', this.pipToggle.bind(this));
    WebUtils.setupTabIndex(DOMElements.pip);

    DOMElements.playerContainer.addEventListener('drop', this.onFileDrop.bind(this), false);

    DOMElements.playerContainer.addEventListener('dragenter', (e) => {
      e.stopPropagation();
      e.preventDefault();
    }, false);
    DOMElements.playerContainer.addEventListener('dragover', (e) => {
      e.stopPropagation();
      e.preventDefault();
    }, false);

    DOMElements.settingsButton.addEventListener('click', (e) => {
      this.optionsWindow.toggleUI();
      e.stopPropagation();
    });
    WebUtils.setupTabIndex(DOMElements.settingsButton);

    const welcomeText = Localize.getMessage('player_welcometext', [this.client.version]);
    this.setStatusMessage('welcome', welcomeText, 'info', 3000);
    this.setupRateChanger();

    this.seekMarker = document.createElement('div');
    this.seekMarker.classList.add('seek_marker');
    DOMElements.markerContainer.appendChild(this.seekMarker);
    this.seekMarker.style.display = 'none';

    this.unseekMarker = document.createElement('div');
    this.unseekMarker.classList.add('seek_marker');
    this.unseekMarker.classList.add('unseek_marker');
    DOMElements.markerContainer.appendChild(this.unseekMarker);
    this.unseekMarker.style.display = 'none';

    this.analyzerMarker = document.createElement('div');
    this.analyzerMarker.classList.add('analyzer_marker');
    DOMElements.markerContainer.appendChild(this.analyzerMarker);
    this.analyzerMarker.style.display = 'none';

    DOMElements.controlsContainer.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    document.addEventListener('visibilitychange', ()=>{
      if (!document.hidden) {
        this.handleVisibilityChange(true);
      } else {
        this.handleVisibilityChange(false);
      }
    });

    const o = new IntersectionObserver(([entry]) => {
      if (entry.intersectionRatio > 0.25 && !document.hidden) {
        this.handleVisibilityChange(true);
      } else {
        this.handleVisibilityChange(false);
      }
    }, {
      threshold: [0, 0.25, 0.5],
    });

    o.observe(document.body);

    // eslint-disable-next-line new-cap
    Coloris({
      theme: 'pill',
      themeMode: 'dark',
      formatToggle: true,
      swatches: [
        'rgb(255,255,255)',
        'rgba(10,10,10,0.3)',
        '#067bc2',
        '#ecc30b',
        '#f37748',
        '#d56062',
      ],
      alpha: true,
    });

    this.updateToolVisibility();
  }

  async handleVisibilityChange(isVisible) {
    const action = this.client.options.visChangeAction;

    if (isVisible === this.lastPageVisibility || this.miniPlayerActive) {
      return;
    }
    switch (action) {
      case VisChangeActions.NOTHING:
        break;
      case VisChangeActions.PLAY_PAUSE:
        if (!isVisible) {
          this.shouldPlay = this.client.persistent.playing;
          await this.client.player?.pause();
        } else {
          if (this.shouldPlay) {
            await this.client.player?.play();
          }
        }
        break;
      case VisChangeActions.PIP:
        if (!isVisible) {
          await this.enterPip();
        } else {
          await this.exitPip();
        }
        break;
      case VisChangeActions.MINI_PLAYER:
        this.requestMiniplayer(!isVisible);
        break;
    }

    this.lastPageVisibility = isVisible;
  }

  requestMiniplayer(force) {
    if (EnvUtils.isExtension()) {
      this.miniPlayerActive = true;

      const styles = {};
      switch (this.client.options.miniPos) {
        case MiniplayerPositions.TOP_LEFT:
          styles.top = '0px';
          styles.left = '0px';
          break;
        case MiniplayerPositions.TOP_RIGHT:
          styles.top = '0px';
          styles.right = '0px';
          break;
        case MiniplayerPositions.BOTTOM_LEFT:
          styles.bottom = '0px';
          styles.left = '0px';
          break;
        case MiniplayerPositions.BOTTOM_RIGHT:
          styles.bottom = '0px';
          styles.right = '0px';
          break;
      }

      chrome.runtime.sendMessage({
        type: 'request_miniplayer',
        size: this.client.options.miniSize,
        force,
        styles,
        autoExit: true,
      }, (response) => {
        if (response !== 'enter') {
          this.miniPlayerActive = false;
        }
      });
    }
  }

  setMiniplayerStatus(isMini) {
    if (isMini) {
      this.miniPlayerActive = true;
      DOMElements.playerContainer.classList.add('miniplayer');
    } else {
      this.miniPlayerActive = false;
      DOMElements.playerContainer.classList.remove('miniplayer');
    }
  }

  updateToolVisibility() {
    DOMElements.pip.style.display = (this.client.player && document.pictureInPictureEnabled) ? 'inline-block' : 'none';
    DOMElements.download.style.display = (this.client.player && !this.client.player.canSave().cantSave) ? 'inline-block' : 'none';
    DOMElements.screenshot.style.display = this.client.player ? 'inline-block' : 'none';
    DOMElements.playinfo.style.display = this.client.player ? 'none' : '';
  }

  toggleHide() {
    if (this.hidden) {
      DOMElements.playerContainer.classList.remove('player-hidden');
      this.hidden = false;
      if (this.shouldPlay) {
        this.client.player?.play();
      }
    } else {
      DOMElements.playerContainer.classList.add('player-hidden');

      this.hidden = true;
      this.shouldPlay = this.client.persistent.playing;
      this.client.player?.pause();
    }
  }

  async documentPipToggle() {
    if (window.documentPictureInPicture.window) {
      window.documentPictureInPicture.window.close();
      return;
    }

    const pipWindow = await documentPictureInPicture.requestWindow({
      width: DOMElements.playerContainer.clientWidth,
      height: DOMElements.playerContainer.clientHeight,
    });

    pipWindow.document.body.appendChild(DOMElements.playerContainer);

    // Copy style sheets over from the initial document
    // so that the player looks the same.
    [...document.styleSheets].forEach((styleSheet) => {
      try {
        const cssRules = [...styleSheet.cssRules]
            .map((rule) => rule.cssText)
            .join('');
        const style = document.createElement('style');

        style.textContent = cssRules;
        pipWindow.document.head.appendChild(style);
      } catch (e) {
        const link = document.createElement('link');

        link.rel = 'stylesheet';
        link.type = styleSheet.type;
        link.media = styleSheet.media;
        link.href = styleSheet.href;
        pipWindow.document.head.appendChild(link);
      }
    });

    pipWindow.addEventListener('pagehide', (event) => {
      document.body.appendChild(DOMElements.playerContainer);
    });
  }

  pipToggle() {
    if (document.pictureInPictureElement) {
      return this.exitPip();
    } else {
      return this.enterPip();
    }
  }

  exitPip() {
    if (document.pictureInPictureElement) {
      return document.exitPictureInPicture();
    }
    return Promise.resolve();
  }

  enterPip() {
    if (!document.pictureInPictureElement && this.client.player) {
      return this.client.player.getVideo().requestPictureInPicture();
    }
    return Promise.resolve();
  }

  setupRateChanger() {
    const els = [];
    const speedList = document.createElement('div');
    speedList.classList.add('rate-changer-list');

    DOMElements.rateMenu.appendChild(speedList);

    let clicked = false;

    DOMElements.playbackRate.addEventListener('focus', (e) => {
      if (DOMElements.rateMenuContainer.style.display === 'none') {
        DOMElements.rateMenuContainer.style.display = '';
        speedList.scrollTop = els[this.playbackRate - 1].offsetTop - 60;
      }
    });

    DOMElements.playbackRate.addEventListener('blur', (e) => {
      if (!clicked) {
        DOMElements.rateMenuContainer.style.display = 'none';
      }
    });

    DOMElements.playbackRate.addEventListener('click', (e) => {
      clicked = !clicked;
      if (!clicked) {
        DOMElements.rateMenuContainer.style.display = 'none';
      } else {
        DOMElements.rateMenuContainer.style.display = '';
        speedList.scrollTop = els[this.playbackRate - 1].offsetTop - 60;
      }
      e.stopPropagation();
    });


    WebUtils.setupTabIndex(DOMElements.playbackRate);


    for (let i = 1; i <= 80; i += 1) {
      ((i) => {
        const el = document.createElement('div');
        els.push(el);
        el.textContent = ((i + 0.1) / 10).toString().substring(0, 3);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.client.playbackRate = i / 10;
        }, true);
        speedList.appendChild(el);
      })(i);
    }

    els[this.playbackRate - 1].classList.add('rate-selected');

    this.playbackElements = els;

    DOMElements.playbackRate.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        this.client.playbackRate = Math.min(8, (this.playbackRate + 1) / 10);
        speedList.scrollTop = els[this.playbackRate - 1].offsetTop - 60;
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === 'ArrowUp') {
        this.client.playbackRate = Math.max(0.1, (this.playbackRate - 1) / 10);
        speedList.scrollTop = els[this.playbackRate - 1].offsetTop - 60;
        e.preventDefault();
        e.stopPropagation();
      }
    });

    DOMElements.playerContainer.addEventListener('click', (e) => {
      DOMElements.rateMenuContainer.style.display = 'none';
    });
  }

  async onFileDrop(e) {
    e.stopPropagation();
    e.preventDefault();

    const dt = e.dataTransfer;
    const files = dt.files;
    const captions = [];
    const audioFormats = [
      'mp3',
      'wav',
      'm4a',
      'm4r',
    ];

    const subtitleFormats = [
      'vtt',
      'srt',
      'xml',
    ];

    let newSource = null;
    let newEntries = null;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = URLUtils.get_url_extension(file.name);

      if (ext === 'json') {
        const fsprofile = await file.text();
        const data = JSON.parse(fsprofile);

        if (data?.type === 'audioProfile') {
          this.client.audioConfigManager.loadProfileFile(data);
        }
      } else if (subtitleFormats.includes(ext)) {
        captions.push({
          url: window.URL.createObjectURL(file),
          name: file.name.substring(0, file.name.length - 4),
        });
      } else if (audioFormats.includes(ext)) {
        newSource = new VideoSource(window.URL.createObjectURL(file), {}, PlayerModes.DIRECT);
      } else if (URLUtils.getModeFromExtension(ext)) {
        let mode = URLUtils.getModeFromExtension(ext);
        if (mode === PlayerModes.ACCELERATED_MP4) {
          mode = PlayerModes.DIRECT;
        }
        newSource = new VideoSource(window.URL.createObjectURL(file), {}, mode);
      } else if (ext === 'fsa') {
        const buffer = await RequestUtils.httpGetLarge(window.URL.createObjectURL(file));
        try {
          const {source, entries, currentLevel, currentAudioLevel} = await FastStreamArchiveUtils.parseFSA(buffer, (progress)=>{
            this.setStatusMessage('save-video', Localize.getMessage('player_archive_loading', [Math.floor(progress * 100)]), 'info');
          }, this.client.downloadManager);

          newEntries = entries;

          newSource = new VideoSource(source.url, null, source.mode);
          newSource.identifier = source.identifier;
          newSource.headers = source.headers;
          newSource.defaultLevelInfo = {
            level: currentLevel,
            audioLevel: currentAudioLevel,
          };

          this.setStatusMessage('save-video', Localize.getMessage('player_archive_loaded'), 'info', 2000);
        } catch (e) {
          console.error(e);
          this.setStatusMessage('save-video', Localize.getMessage('player_archive_fail'), 'error', 2000);
        }
      }
    }

    if (newSource) {
      if (newEntries) {
        this.client.downloadManager.resetOverride(true);
        this.client.downloadManager.setEntries(newEntries);
      }

      try {
        await this.client.addSource(newSource, true);
      } catch (e) {
        console.error(e);
      }

      if (newEntries) {
        this.client.downloadManager.resetOverride(false);
      }
    }

    (await Promise.all(captions.map(async (file) => {
      const track = new SubtitleTrack(file.name);
      await track.loadURL(file.url);
      return track;
    }))).forEach((track) => {
      const returnedTrack = this.client.loadSubtitleTrack(track);
      this.client.subtitlesManager.activateTrack(returnedTrack);
    });

    this.client.play();
  }
  destroy() {
    if (this.downloadURL) {
      URL.revokeObjectURL(this.downloadURL);
      this.downloadURL = null;
    }
  }

  progressLoop() {
    if (!this.shouldRunProgressLoop) {
      this.isRunningProgressLoop = false;
      return;
    }
    window.requestAnimationFrame(this.progressLoop.bind(this));
    if (!this.isSeeking) {
      this.client.updateTime(this.client.currentTime);
    }
  }

  durationChanged() {
    const duration = this.client.duration;
    if (duration < 5 * 60 || this.client.subtitleSyncer.started) {
      this.runProgressLoop();
    } else {
      this.stopProgressLoop();
    }
    this.updateProgress();
    this.updateSkipSegments();
  }

  runProgressLoop() {
    if (!this.isRunningProgressLoop) {
      this.isRunningProgressLoop = true;
      this.shouldRunProgressLoop = true;
      this.progressLoop();
    }
  }

  stopProgressLoop() {
    this.shouldRunProgressLoop = false;
  }

  async saveScreenshot() {
    if (!this.client.player) {
      alert(Localize.getMessage('player_nosource_alert'));
      return;
    }

    const suggestedName = (this.client.mediaName || 'video').replaceAll(' ', '_') + '@' + StringUtils.formatTime(this.client.currentTime);
    const name = EnvUtils.isIncognito() ? suggestedName : prompt(Localize.getMessage('player_filename_prompt'), suggestedName);

    if (!name) {
      return;
    }

    this.setStatusMessage('save-screenshot', Localize.getMessage('player_screenshot_saving'), 'info');
    try {
      const video = this.client.player.getVideo();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // const blob = await new Promise((resolve) => {
      //   canvas.toBlob(resolve, 'image/png');
      // });

      const url = canvas.toDataURL('image/png'); // For some reason this is faster than async
      // const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', name + '.png');
      link.setAttribute('target', '_blank');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      this.setStatusMessage('save-screenshot', Localize.getMessage('player_screenshot_saved'), 'info', 1000);
    } catch (e) {
      console.error(e);
      this.setStatusMessage('save-screenshot', Localize.getMessage('player_screenshot_fail'), 'error', 2000);
    }
  }

  async saveVideo(e) {
    if (!this.client.player) {
      alert(Localize.getMessage('player_nosource_alert'));
      return;
    }

    if (this.makingDownload) {
      alert(Localize.getMessage('player_savevideo_inprogress_alert'));
      return;
    }

    const player = this.client.player;

    const {canSave, isComplete, canStream} = player.canSave();

    if (!canSave) {
      alert(Localize.getMessage('player_savevideo_unsupported'));
      return;
    }

    const doPartial = e.altKey;
    if (doPartial && !isComplete) {
      const res = confirm(Localize.getMessage('player_savevideo_partial_confirm'));
      if (!res) {
        return;
      }
    }

    if (!doPartial && !isComplete && EnvUtils.isIncognito()) {
      const res = confirm(Localize.getMessage('player_savevideo_incognito_confirm'));
      if (!res) {
        return;
      }
    }

    const suggestedName = (this.client.mediaName || 'video').replaceAll(' ', '_');
    const name = EnvUtils.isIncognito() ? suggestedName : prompt(Localize.getMessage('player_filename_prompt'), suggestedName);

    if (!name) {
      return;
    }

    if (e.shiftKey) {
      this.dumpBuffer(name);
      return;
    }

    let url;
    let filestream;
    if (canStream) {
      filestream = streamSaver.createWriteStream(name + '.mp4');
    }

    if (this.reuseDownloadURL && this.downloadURL && isComplete) {
      url = this.downloadURL;
    } else {
      this.reuseDownloadURL = isComplete;
      let result;
      this.makingDownload = true;
      this.setStatusMessage('save-video', Localize.getMessage('player_savevideo_start'), 'info');
      try {
        const start = performance.now();
        result = await player.saveVideo({
          onProgress: (progress) => {
            this.setStatusMessage('save-video', Localize.getMessage('player_savevideo_progress', [Math.floor(progress * 100)]), 'info');
          },
          filestream,
          partialSave: doPartial,
        });
        const end = performance.now();
        console.log('Save took ' + (end - start) / 1000 + 's');
      } catch (e) {
        console.error(e);
        this.setStatusMessage('save-video', Localize.getMessage('player_savevideo_fail'), 'error', 2000);
        this.makingDownload = false;

        if (confirm(Localize.getMessage('player_savevideo_failed_ask_archive'))) {
          this.dumpBuffer(name);
        }
        return;
      }
      this.setStatusMessage('save-video', Localize.getMessage('player_savevideo_complete'), 'info', 2000);
      this.makingDownload = false;
      if (this.downloadURL) {
        URL.revokeObjectURL(this.downloadURL);
        this.downloadURL = null;
      }

      if (!canStream) {
        url = URL.createObjectURL(result.blob);
      }

      setTimeout(() => {
        if (this.downloadURL !== url) return;

        if (this.downloadURL) {
          URL.revokeObjectURL(this.downloadURL);
          this.downloadURL = null;
          this.reuseDownloadURL = false;
        }
      }, 10000);
    }

    if (!canStream) {
      this.downloadURL = url;

      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', name + '.mp4');
      link.setAttribute('target', '_blank');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  async dumpBuffer(name) {
    const entries = this.client.downloadManager.getCompletedEntries();
    const filestream = streamSaver.createWriteStream(name + '.fsa');
    try {
      await FastStreamArchiveUtils.writeFSAToStream(filestream, this.client.player, entries, (progress)=>{
        this.setStatusMessage('save-video', Localize.getMessage('player_archiver_progress', [Math.floor(progress * 100)]), 'info');
      });

      this.setStatusMessage('save-video', Localize.getMessage('player_archiver_saved'), 'info', 2000);
    } catch (e) {
      console.error(e);
      this.setStatusMessage('save-video', 'Unreachable Error', 'error', 2000);
    }
  }

  updateMarkers() {
    const pastSeeks = this.client.pastSeeks;
    const duration = this.client.duration;
    if (pastSeeks.length) {
      const time = pastSeeks[pastSeeks.length - 1];
      this.seekMarker.style.left = (time / duration * 100) + '%';
      this.seekMarker.style.display = '';
    } else {
      this.seekMarker.style.display = 'none';
    }

    const pastUnseeks = this.client.pastUnseeks;
    if (pastUnseeks.length) {
      const time = pastUnseeks[pastUnseeks.length - 1];
      this.unseekMarker.style.left = (time / duration * 100) + '%';
      this.unseekMarker.style.display = '';
    } else {
      this.unseekMarker.style.display = 'none';
    }

    const analyzerMarkerPosition = this.client.videoAnalyzer.getMarkerPosition(); ;
    if (analyzerMarkerPosition !== null) {
      this.analyzerMarker.style.left = (analyzerMarkerPosition / duration * 100) + '%';
      this.analyzerMarker.style.display = '';
    } else {
      this.analyzerMarker.style.display = 'none';
    }
  }
  skipSegment() {
    const time = this.client.currentTime;
    const currentSegment = this.skipSegments.find((segment) => segment.startTime <= time && segment.endTime >= time);
    if (!currentSegment) {
      return;
    }
    this.client.currentTime = currentSegment.endTime;

    if (currentSegment.onSkip) {
      currentSegment.onSkip();
    }

    this.hideControlBarOnAction();
  }

  onControlsMouseEnter() {
    this.showControlBar();
    this.mouseOverControls = true;
  }
  onControlsMouseLeave() {
    this.mouseOverControls = false;
    if (document.activeElement && DOMElements.controlsContainer.contains(document.activeElement)) document.activeElement.blur();
    this.queueControlsHide();
  }
  onPlayerMouseMove() {
    if (Date.now() < this.mouseActivityCooldown) {
      return;
    }
    this.showControlBar();
    this.queueControlsHide();
  }

  queueControlsHide(time) {
    clearTimeout(this.hideControlBarTimeout);
    this.hideControlBarTimeout = setTimeout(() => {
      if (!this.focusingControls && !this.mouseOverControls && !this.isBigPlayButtonVisible() && this.persistent.playing) {
        this.hideControlBar();
      }
    }, time || 2000);
  }

  hideControlBarOnAction(cooldown) {
    if (!this.mouseOverControls && !this.focusingControls) {
      this.mouseActivityCooldown = Date.now() + (cooldown || 500);
      if (!this.isBigPlayButtonVisible()) {
        this.hideControlBar();
      }
    }
  }

  hideBigPlayButton() {
    DOMElements.playPauseButtonBigCircle.style.display = 'none';
  }

  isBigPlayButtonVisible() {
    return DOMElements.playPauseButtonBigCircle.style.display !== 'none';
  }

  hideControlBar() {
    clearTimeout(this.hideControlBarTimeout);
    DOMElements.playerContainer.classList.remove('controls_visible');
    DOMElements.controlsContainer.classList.remove('fade_in');
    DOMElements.controlsContainer.classList.add('fade_out');
    DOMElements.progressContainer.classList.remove('freeze');
  }

  showControlBar() {
    DOMElements.playerContainer.classList.add('controls_visible');
    DOMElements.controlsContainer.classList.remove('fade_out');
    DOMElements.controlsContainer.classList.add('fade_in');
  }

  getOffsetLeft(elem) {
    return elem.getBoundingClientRect().left;
  }

  muteToggle() {
    if (0 !== this.persistent.volume && !this.persistent.muted) {
      this.persistent.volume = 0;
      this.persistent.muted = true;
    } else {
      this.persistent.volume = this.persistent.latestVolume;
      this.persistent.muted = false;
    }
    this.client.volume = this.persistent.volume;
  }

  onProgressbarMouseLeave() {
    this.isMouseOverProgressbar = false;
    if (!this.isSeeking) {
      this.hidePreview();
    }
  }

  onProgressbarMouseEnter() {
    this.isMouseOverProgressbar = true;

    this.showPreview();
  }

  showPreview() {
    DOMElements.seekPreview.style.display = '';
    DOMElements.seekPreviewTip.style.display = '';
  }

  hidePreview() {
    DOMElements.seekPreview.style.display = 'none';
    DOMElements.seekPreviewTip.style.display = 'none';
  }


  onProgressbarMouseMove(event) {
    const currentX = Math.min(Math.max(event.clientX - this.getOffsetLeft(DOMElements.progressContainer), 0), DOMElements.progressContainer.clientWidth);
    const totalWidth = DOMElements.progressContainer.clientWidth;

    const time = this.client.duration * currentX / totalWidth;
    const chapter = this.client.chapters.find((chapter) => chapter.startTime <= time && chapter.endTime >= time);
    const segment = this.skipSegments.find((segment) => segment.startTime <= time && segment.endTime >= time);

    let text = '';
    let offset = 25;

    if (segment) {
      text += segment.name + '\n';
      offset += 25;
    }

    if (chapter) {
      text += chapter.name + '\n';
      offset += 25;
    }

    DOMElements.seekPreviewVideo.style.bottom = offset + 'px';

    text += StringUtils.formatTime(time);
    DOMElements.seekPreviewText.innerText = text;

    const maxWidth = Math.max(DOMElements.seekPreviewVideo.clientWidth, DOMElements.seekPreview.clientWidth);


    let nudgeAmount = 0;

    if (currentX < maxWidth / 2) {
      nudgeAmount = maxWidth / 2 - currentX;
    }

    if (currentX > totalWidth - maxWidth / 2) {
      nudgeAmount = (totalWidth - maxWidth / 2 - currentX);
    }

    DOMElements.seekPreview.style.left = (currentX + nudgeAmount) / totalWidth * 100 + '%';
    DOMElements.seekPreviewTip.style.left = currentX / totalWidth * 100 + '%';

    if (nudgeAmount) {
      DOMElements.seekPreviewTip.classList.add('detached');
    } else {
      DOMElements.seekPreviewTip.classList.remove('detached');
    }


    this.client.seekPreview(time);
  }


  onProgressbarMouseDown(event) {
    let shouldPlay = false;
    if (this.persistent.playing) {
      this.client.player.pause();
      shouldPlay = true;
    }

    this.isSeeking = true;
    this.showPreview();
    this.client.savePosition();
    this.client.setSeekSave(false);

    DOMElements.progressContainer.classList.add('freeze');
    // we need an initial position for touchstart events, as mouse up has no offset x for iOS
    let initialPosition = Math.min(Math.max(event.clientX - this.getOffsetLeft(DOMElements.progressContainer), 0), DOMElements.progressContainer.clientWidth);

    const shiftTime = (timeBarX) => {
      const totalWidth = DOMElements.progressContainer.clientWidth;
      if (totalWidth) {
        const newTime = this.client.duration * timeBarX / totalWidth;
        this.client.currentTime = newTime;
        this.client.updateTime(newTime);
      }
    };

    const onProgressbarMouseMove = (event) => {
      const currentX = Math.min(Math.max(event.clientX - this.getOffsetLeft(DOMElements.progressContainer), 0), DOMElements.progressContainer.clientWidth);
      initialPosition = NaN; // mouse up will fire after the move, we don't want to trigger the initial position in the event of iOS
      shiftTime(currentX);
    };

    const onProgressbarMouseUp = (event) => {
      document.removeEventListener('mousemove', onProgressbarMouseMove);
      document.removeEventListener('touchmove', onProgressbarMouseMove);
      document.removeEventListener('mouseup', onProgressbarMouseUp);
      document.removeEventListener('touchend', onProgressbarMouseUp);
      this.isSeeking = false;

      if (!this.isMouseOverProgressbar) {
        this.hidePreview();
      }

      let clickedX = Math.min(Math.max(event.clientX - this.getOffsetLeft(DOMElements.progressContainer), 0), DOMElements.progressContainer.clientWidth);

      if (isNaN(clickedX) && !isNaN(initialPosition)) {
        clickedX = initialPosition;
      }
      if (!isNaN(clickedX)) {
        shiftTime(clickedX);
      }
      this.client.setSeekSave(true);

      DOMElements.progressContainer.classList.remove('freeze');

      if (shouldPlay) {
        this.client.player?.play();
      }
    };
    shiftTime(initialPosition);
    document.addEventListener('mouseup', onProgressbarMouseUp);
    document.addEventListener('touchend', onProgressbarMouseUp);
    document.addEventListener('mousemove', onProgressbarMouseMove);
    document.addEventListener('touchmove', onProgressbarMouseMove);
  }

  onVolumeBarMouseDown(event) {
    const shiftVolume = (volumeBarX) => {
      const totalWidth = DOMElements.volumeControlBar.clientWidth;

      if (totalWidth) {
        let newVolume = volumeBarX / totalWidth * 3;

        if (newVolume < 0.05) {
          newVolume = 0;
          this.persistent.muted = true;
        } else if (newVolume > 2.95) {
          newVolume = 3;
        }

        if (newVolume > 0.92 && newVolume < 1.08) {
          newVolume = 1;
        }

        if (this.persistent.muted && newVolume > 0) {
          this.persistent.muted = false;
        }
        this.client.volume = newVolume;
      }
    };

    const onVolumeBarMouseMove = (event) => {
      const currentX = event.clientX - this.getOffsetLeft(DOMElements.volumeContainer) - 10;
      shiftVolume(currentX);
    };

    const onVolumeBarMouseUp = (event) => {
      document.removeEventListener('mousemove', onVolumeBarMouseMove);
      document.removeEventListener('touchmove', onVolumeBarMouseMove);
      document.removeEventListener('mouseup', onVolumeBarMouseUp);
      document.removeEventListener('touchend', onVolumeBarMouseUp);

      const currentX = event.clientX - this.getOffsetLeft(DOMElements.volumeContainer) - 10;

      if (!isNaN(currentX)) {
        shiftVolume(currentX);
      }
    };

    document.addEventListener('mouseup', onVolumeBarMouseUp);
    document.addEventListener('touchend', onVolumeBarMouseUp);
    document.addEventListener('mousemove', onVolumeBarMouseMove);
    document.addEventListener('touchmove', onVolumeBarMouseMove);
  }

  updatePlaybackRate() {
    this.playbackRate = Math.round(this.persistent.playbackRate * 10);
    this.playbackElements.forEach((el) => {
      el.classList.remove('rate-selected');
    });

    this.playbackElements[this.playbackRate - 1].classList.add('rate-selected');
  }

  updateSkipSegments() {
    DOMElements.skipSegmentsContainer.replaceChildren();

    const introMatch = this.client.videoAnalyzer.getIntro();
    const outroMatch = this.client.videoAnalyzer.getOutro();
    const duration = this.client.duration;
    if (!duration) {
      return;
    }

    const skipSegments = [];

    if (introMatch) {
      skipSegments.push({
        startTime: Utils.clamp(introMatch.startTime, 0, duration),
        endTime: Utils.clamp(introMatch.endTime, 0, duration),
        class: 'intro',
        name: 'Intro',
        skipText: Localize.getMessage('player_skipintro'),
      });
    }

    if (outroMatch) {
      skipSegments.push({
        startTime: Utils.clamp(outroMatch.startTime, 0, duration),
        endTime: Utils.clamp(outroMatch.endTime, 0, duration),
        class: 'outro',
        name: 'Outro',
        skipText: Localize.getMessage('player_skipoutro'),
      });
    }

    this.client.skipSegments.forEach((segment) => {
      skipSegments.push({
        ...segment,
        startTime: Utils.clamp(segment.startTime, 0, duration),
        endTime: Utils.clamp(segment.endTime, 0, duration),
      });
    });

    let currentSegment = null;
    const time = this.client.currentTime;

    skipSegments.forEach((segment) => {
      const segmentElement = document.createElement('div');
      segmentElement.classList.add('skip_segment');
      segmentElement.classList.add(segment.class);
      segmentElement.style.left = segment.startTime / duration * 100 + '%';
      segmentElement.style.width = (segment.endTime - segment.startTime) / duration * 100 + '%';

      if (segment.color) {
        segmentElement.style.backgroundColor = segment.color;
      }

      DOMElements.skipSegmentsContainer.appendChild(segmentElement);

      if (!currentSegment && time >= segment.startTime && time < segment.endTime) {
        currentSegment = segment;
        segmentElement.classList.add('active');
      }
    });

    this.skipSegments = skipSegments;

    if (currentSegment) {
      DOMElements.skipButton.style.display = '';
      DOMElements.skipButton.textContent = currentSegment.skipText;
      DOMElements.progressContainer.classList.add('skip_freeze');
    } else {
      DOMElements.progressContainer.classList.remove('skip_freeze');
      DOMElements.skipButton.style.display = 'none';
      this.hasShownSkip = false;
    }

    if (DOMElements.skipButton.style.display !== 'none') {
      if (!this.hasShownSkip) {
        this.hasShownSkip = true;

        if (currentSegment.autoSkip) {
          this.skipSegment();
        }

        this.showControlBar();
        this.queueControlsHide(5000);
      }
    }

    const chapters = [];
    this.client.chapters.forEach((chapter) => {
      chapters.push({
        ...chapter,
        startTime: Utils.clamp(chapter.startTime, 0, duration),
        endTime: Utils.clamp(chapter.endTime, 0, duration),
      });
    });

    chapters.forEach((chapter) => {
      if (chapter.startTime !== 0) {
        const chapterElement = document.createElement('div');
        chapterElement.classList.add('chapter');
        chapterElement.style.left = chapter.startTime / duration * 100 + '%';
        DOMElements.skipSegmentsContainer.appendChild(chapterElement);
      }
    });
  }

  updateLanguageTracks() {
    const tracks = this.client.languageTracks;
    const videoTracks = tracks.video;
    const audioTracks = tracks.audio;
    if (videoTracks.length < 2 && audioTracks.length < 2) {
      DOMElements.languageButton.style.display = 'none';
      return;
    } else {
      DOMElements.languageButton.style.display = '';
    }

    DOMElements.languageMenu.replaceChildren();
    const languageTable = document.createElement('div');
    languageTable.classList.add('language_table');
    DOMElements.languageMenu.appendChild(languageTable);

    const languages = [];
    if (videoTracks.length > 1) {
      videoTracks.forEach((track) => {
        if (!languages.includes(track.lang)) {
          languages.push(track.lang);
        }
      });
    }

    if (audioTracks.length > 1) {
      audioTracks.forEach((track) => {
        if (!languages.includes(track.lang)) {
          languages.push(track.lang);
        }
      });
    }

    languages.sort();

    const regionNames = new Intl.DisplayNames([
      navigator.language,
    ], {type: 'language'});

    languages.forEach((language) => {
      const languageElement = document.createElement('div');
      languageElement.classList.add('language_container');
      languageTable.appendChild(languageElement);

      const languageText = document.createElement('div');
      languageText.classList.add('language_text');
      try {
        languageText.textContent = regionNames.of(language);
      } catch (e) {
        languageText.textContent = language || 'Unknown';
      }
      languageElement.appendChild(languageText);

      const videoTrack = videoTracks.find((track) => track.lang === language);
      const audioTrack = audioTracks.find((track) => track.lang === language);
      const trackElements = ([videoTrack, audioTrack]).map((track) => {
        if (!track) return;
        const trackElement = document.createElement('div');
        trackElement.classList.add('language_track');
        trackElement.textContent = Localize.getMessage('player_languagemenu_' + track.type);
        trackElement.setAttribute('aria-label', Localize.getMessage('player_languagemenu_' + track.type) + ': ' + language);
        if (track.isActive) {
          trackElement.classList.add('active');
        }
        languageElement.appendChild(trackElement);
        trackElement.addEventListener('click', (e) => {
          Array.from(DOMElements.languageMenu.getElementsByClassName('active')).forEach((element) => {
            element.classList.remove('active');
          });

          trackElement.classList.add('active');
          this.client.setLanguageTrack(track);
          e.stopPropagation();
        });
        return trackElement;
      });
      languageElement.addEventListener('click', (e) => {
        trackElements.forEach((element) => {
          if (element) {
            element.click();
          }
        });
        e.stopPropagation();
      });
    });
  }

  updateQualityLevels() {
    const levels = this.client.levels;

    if (!levels || levels.size <= 1) {
      DOMElements.videoSource.style.display = 'none';
      return;
    } else {
      DOMElements.videoSource.style.display = '';
    }

    const currentLevel = this.client.currentLevel;

    DOMElements.videoSourceList.replaceChildren();
    levels.forEach((level, i) => {
      const levelelement = document.createElement('div');

      levelelement.classList.add('fluid_video_source_list_item');
      levelelement.addEventListener('click', (e) => {
        Array.from(DOMElements.videoSourceList.getElementsByClassName('source_active')).forEach((element) => {
          element.classList.remove('source_active');
        });
        this.client.currentLevel = i;
        levelelement.classList.add('source_active');
        e.stopPropagation();
      });

      if (i === currentLevel) {
        levelelement.classList.add('source_active');
      }

      const icon = document.createElement('span');
      icon.classList.add('source_button_icon');

      const text = document.createElement('span');
      const label = level.width + 'x' + level.height + ' @' + Math.round(level.bitrate / 1000) + 'kbps';

      text.textContent = (i === currentLevel) ? label + ' ' + Localize.getMessage('player_quality_current') : label;
      levelelement.appendChild(text);

      DOMElements.videoSourceList.appendChild(levelelement);
    });

    const current = levels.get(currentLevel);
    if (!current) {
      console.warn('No current level');
      return;
    }
    const isHD = current.width >= 1280;

    if (isHD) {
      DOMElements.videoSource.classList.add('hd');
    } else {
      DOMElements.videoSource.classList.remove('hd');
    }
  }

  updateVolumeBar() {
    const currentVolumeTag = DOMElements.currentVolume;
    const muteButtonTag = DOMElements.muteBtn;

    const volume = this.persistent.volume;

    if (0 !== volume) {
      this.persistent.latestVolume = volume;
      this.persistent.muted = false;
    } else {
      this.persistent.muted = true;
    }
    if (this.persistent.muted) {
      muteButtonTag.classList.add('muted');
    } else {
      muteButtonTag.classList.remove('muted');
    }

    currentVolumeTag.style.width = (volume * 100) / 3 + '%';
    DOMElements.currentVolumeText.textContent = Math.round(volume * 100) + '%';
  }
  updateProgress() {
    const duration = this.client.duration;
    DOMElements.currentProgress.style.width = Utils.clamp(this.persistent.currentTime / duration, 0, 1) * 100 + '%';
    DOMElements.duration.textContent = StringUtils.formatTime(this.persistent.currentTime) + ' / ' + StringUtils.formatTime(duration);

    const chapters = this.client.chapters;
    if (chapters.length > 0) {
      const time = this.persistent.currentTime;
      const chapter = chapters.find((chapter) => chapter.startTime <= time && chapter.endTime >= time);
      if (chapter) {
        this.setStatusMessage('chapter', chapter.name, 'info');
      }
    } else {
      this.setStatusMessage('chapter', null, 'info');
    }
  }

  fullscreenToggle() {
    try {
      if (document.fullscreenEnabled) {
        if (!document.fullscreenElement) {
          DOMElements.playerContainer.requestFullscreen();
        } else if (document.exitFullscreen) {
          document.exitFullscreen();
        }

        this.updateFullScreenButton();
      } else {
        if (EnvUtils.isExtension()) {
          chrome.runtime.sendMessage({
            type: 'request_fullscreen',
          }, (response)=>{
            this.setFullscreenStatus(response === 'enter');
          });
        }
      }
    } catch (e) {
      console.log('Fullscreen not supported', e);
    }
  }

  updateFullScreenButton() {
    this.setFullscreenStatus(document.fullscreenElement);
  }

  setFullscreenStatus(status) {
    const fullScreenButton = DOMElements.fullscreen;
    if (status) {
      fullScreenButton.classList.add('out');
    } else {
      fullScreenButton.classList.remove('out');
    }
  }

  playPauseToggle() {
    if (!this.client.player) return;

    if (!this.persistent.playing) {
      this.client.play();
    } else {
      this.client.pause();
    }
  }

  play() {
    const previousValue = this.persistent.playing;
    this.persistent.playing = true;
    this.hideBigPlayButton();
    this.updatePlayPauseButton();
    if (!previousValue) {
      this.playPauseAnimation();
      this.queueControlsHide();
    }
  }

  pause() {
    const previousValue = this.persistent.playing;
    this.persistent.playing = false;
    this.updatePlayPauseButton();
    this.showControlBar();
    if (previousValue) {
      this.playPauseAnimation();
    }
  }

  updatePlayPauseButton() {
    const playButton = DOMElements.playPauseButton;
    const playButtonBig = DOMElements.playPauseButtonBig;
    if (this.persistent.playing) {
      playButton.classList.add('playing');
      playButtonBig.classList.replace('fluid_initial_play_button', 'fluid_initial_pause_button');
    } else {
      playButton.classList.remove('playing');
      playButtonBig.classList.replace('fluid_initial_pause_button', 'fluid_initial_play_button');
    }
  }
  playPauseAnimation() {
    if (this.isSeeking) {
      return;
    }
    DOMElements.playPauseButtonBigCircle.classList.remove('transform-active');
    void DOMElements.playPauseButtonBigCircle.offsetWidth;
    DOMElements.playPauseButtonBigCircle.classList.add('transform-active');
    setTimeout(
        function() {
          DOMElements.playPauseButtonBigCircle.classList.remove('transform-active');
        },
        450,
    );
  }
}
