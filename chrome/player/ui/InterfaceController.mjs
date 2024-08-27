import {PlayerModes} from '../enums/PlayerModes.mjs';
import {Coloris} from '../modules/coloris.mjs';
import {Localize} from '../modules/Localize.mjs';
import {ClickActions} from '../options/defaults/ClickActions.mjs';
import {MiniplayerPositions} from '../options/defaults/MiniplayerPositions.mjs';
import {VisChangeActions} from '../options/defaults/VisChangeActions.mjs';
import {EnvUtils} from '../utils/EnvUtils.mjs';
import {StringUtils} from '../utils/StringUtils.mjs';
import {URLUtils} from '../utils/URLUtils.mjs';
import {Utils} from '../utils/Utils.mjs';
import {WebUtils} from '../utils/WebUtils.mjs';
import {DOMElements} from './DOMElements.mjs';
import {FineTimeControls} from './FineTimeControls.mjs';
import {LanguageChanger} from './menus/LanguageChanger.mjs';
import {LoopMenu} from './menus/LoopMenu.mjs';
import {PlaybackRateChanger} from './menus/PlaybackRateChanger.mjs';
import {VideoQualityChanger} from './menus/VideoQualityChanger.mjs';
import {OptionsWindow} from './OptionsWindow.mjs';
import {ProgressBar} from './ProgressBar.mjs';
import {SaveManager} from './SaveManager.mjs';
import {StatusManager, StatusTypes} from './StatusManager.mjs';
import {SubtitlesManager} from './subtitles/SubtitlesManager.mjs';
import {ToolManager} from './ToolManager.mjs';
import {VolumeControls} from './VolumeControls.mjs';

export class InterfaceController {
  constructor(client) {
    this.client = client;
    this.state = client.state;
    this.hidden = false;
    this.lastTime = 0;
    this.lastSpeed = 0;
    this.mouseOverControls = false;
    this.controlsVisible = true;
    this.mouseActivityCooldown = 0;

    this.failed = false;

    this.toolManager = new ToolManager(this.client, this);

    this.toolManager.setupUI();

    this.fineTimeControls = new FineTimeControls(this.client);

    this.subtitlesManager = new SubtitlesManager(this.client);

    this.playbackRateChanger = new PlaybackRateChanger(this.client);
    this.playbackRateChanger.on('rateChanged', (rate) => {
      this.client.playbackRate = rate;
    });
    this.playbackRateChanger.setupUI();

    this.videoQualityChanger = new VideoQualityChanger();
    this.videoQualityChanger.setupUI();
    this.videoQualityChanger.on('qualityChanged', (level) => {
      this.client.currentLevel = level;
    });

    this.languageChanger = new LanguageChanger();
    this.languageChanger.setupUI();
    this.languageChanger.on('languageChanged', (track) => {
      this.client.setLanguageTrack(track);
    });

    this.loopControls = new LoopMenu(this.client);
    this.loopControls.setupUI();

    this.saveManager = new SaveManager(this.client);
    this.saveManager.setupUI();

    this.playbackRateChanger.on('open', this.closeAllMenus.bind(this));
    this.videoQualityChanger.on('open', this.closeAllMenus.bind(this));
    this.languageChanger.on('open', this.closeAllMenus.bind(this));
    this.subtitlesManager.on('open', this.closeAllMenus.bind(this));
    this.loopControls.on('open', this.closeAllMenus.bind(this));

    this.progressBar = new ProgressBar(this.client);
    this.progressBar.on('show-skip', (segment)=>{
      this.showControlBar();
      this.queueControlsHide(5000);
    });
    this.progressBar.setupUI();

    this.volumeControls = new VolumeControls(this.client);
    this.volumeControls.on('volume', (volume)=>{
      this.client.setVolume(volume);
    });
    this.volumeControls.setupUI();

    this.statusManager = new StatusManager();
    this.optionsWindow = new OptionsWindow();

    this.setupDOM();
  }

  updateToolVisibility() {
    this.toolManager.updateToolVisibility();
  }

  openTimeline() {
    this.progressBar.startPreciseMode(true);
  }

  closeTimeline() {
    this.fineTimeControls.removeAll();
    this.progressBar.endPreciseMode();
    this.subtitlesManager.subtitleSyncer.stop();
    this.playbackRateChanger.closeSilenceSkipperUI();
  }

  closeAllMenus(e) {
    if (e && e.target && !DOMElements.extraTools.contains(e.target)) {
      DOMElements.extraTools.classList.remove('visible');
    }
    this.playbackRateChanger.closeUI();
    this.videoQualityChanger.closeUI();
    this.languageChanger.closeUI();
    this.subtitlesManager.closeUI();
    this.loopControls.closeUI();
  }

  setStatusMessage(key, message, type, expiry) {
    this.statusManager.setStatusMessage(key, message, type, expiry);
  }

  tick() {
    if (this.client.player) {
      this.updateFragmentsLoaded();
      this.checkBuffering();
    }

    this.statusManager.updateStatusMessage();
  }

  checkBuffering() {
    const currentVideo = this.client.currentVideo;
    if (this.state.playing) {
      const time = this.client.currentTime;
      if (time === this.lastTime) {
        this.setBuffering(true);
      } else {
        this.setBuffering(false);
      }
      this.lastTime = time;
    } else if (currentVideo) {
      if (currentVideo.readyState === 0) {
        this.setBuffering(true);
      } else if (currentVideo.readyState > 1) {
        this.setBuffering(false);
      }
    }
  }

  reset() {
    DOMElements.videoContainer.replaceChildren();

    this.resetPreviewVideo();
    this.progressBar.reset();
    this.saveManager.reset();
    this.failed = false;
    this.setStatusMessage('error', null, 'error');
    this.setStatusMessage('chapter', null, 'error');
    this.stopProgressLoop();
    this.state.playing = false;
    this.updatePlayPauseButton();
    DOMElements.playPauseButtonBigCircle.style.display = '';
    DOMElements.playerContainer.classList.add('controls_visible');
    this.updateToolVisibility();
    this.fineTimeControls.reset();
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

    if (this.state.buffering === isBuffering) {
      return;
    }

    this.state.buffering = isBuffering;

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

  resetPreviewVideo() {
    DOMElements.seekPreviewVideo.replaceChildren();
    const spinner = document.createElement('div');
    spinner.classList.add('spinner');
    DOMElements.seekPreviewVideo.appendChild(spinner);
    DOMElements.seekPreviewVideo.classList.remove('loading');
    DOMElements.seekPreviewVideo.style.display = 'none';
  }

  updateMarkers() {
    this.progressBar.updateMarkers();
  }

  updateFragmentsLoaded() {
    this.progressBar.updateFragmentsLoaded();
    this.updateDownloadStatus();
  }

  updateDownloadStatus() {
    const {loaded, total, failed} = this.progressBar.getFragmentCounts();
    if (total === 0) {
      this.setStatusMessage('download', null);
      return;
    }

    const percentDone = total === 0 ? 0 :
        Math.floor((loaded / total) * 1000) / 10;

    const newSpeed = this.client.downloadManager.getSpeed();
    if (newSpeed > 0 && this.lastSpeed > 0) {
      this.lastSpeed = (newSpeed * 0.05 + this.lastSpeed * 0.95) || 0;
    } else {
      this.lastSpeed = newSpeed;
    }

    let speed = this.lastSpeed; // bytes per second
    speed = Math.round(speed / 1000 / 1000 * 10) / 10; // MB per second

    if (total === 0 || loaded < total) {
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

  updateSkipSegments() {
    this.progressBar.updateSkipSegments();
  }

  setupDOM() {
    const interactHandler = (e) => {
      this.client.userInteracted();
    };

    DOMElements.playerContainer.addEventListener('keydown', interactHandler, true);
    DOMElements.playerContainer.addEventListener('mousedown', interactHandler, true);
    DOMElements.playerContainer.addEventListener('touchstart', interactHandler, true);

    DOMElements.playPauseButton.addEventListener('click', this.playPauseToggle.bind(this));
    WebUtils.setupTabIndex(DOMElements.playPauseButton);

    DOMElements.playPauseButtonBigCircle.addEventListener('click', (e) => {
      this.hideControlBarOnAction();
      this.playPauseToggle();
      e.stopPropagation();
    });

    DOMElements.fullscreen.addEventListener('click', (e)=>{
      if (e.shiftKey) {
        this.pipToggle();
        return;
      } else if (e.altKey) {
        this.toggleWindowedFullscreen();
        return;
      }

      this.fullscreenToggle();
      e.stopPropagation();
    });
    WebUtils.setupTabIndex(DOMElements.fullscreen);

    DOMElements.windowedFullscreen.addEventListener('click', (e)=>{
      this.toggleWindowedFullscreen();
    });
    WebUtils.setupTabIndex(DOMElements.windowedFullscreen);

    document.addEventListener('fullscreenchange', this.updateFullScreenButton.bind(this));

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

    DOMElements.playerContainer.addEventListener('mouseleave', (e)=>{
      this.queueControlsHide(1);
    });

    let holdTimeout = null;
    let lastSpeed = null;
    let wasPlaying = false;
    DOMElements.videoContainer.addEventListener('mousedown', (e)=>{
      if (e.button === 0) {
        clearTimeout(holdTimeout);
        holdTimeout = setTimeout(() => {
          if (lastSpeed !== null || !this.client.player) {
            return;
          }
          wasPlaying = this.state.playing;
          lastSpeed = this.client.playbackRate;
          this.client.playbackRate = lastSpeed * 2;

          this.client.play();
        }, 800);
      }
    });

    const stopSpeedUp = () => {
      if (lastSpeed !== null) {
        this.client.playbackRate = lastSpeed;
        lastSpeed = null;

        if (!wasPlaying) {
          this.client.pause();
        }
      }
      clearTimeout(holdTimeout);
    };

    // DOMElements.videoContainer.addEventListener('mouseup', (e)=>{
    //   stopSpeedUp();
    // });

    DOMElements.videoContainer.addEventListener('mouseleave', (e)=>{
      stopSpeedUp();
    });

    let clickCount = 0;
    let clickTimeout = null;
    DOMElements.videoContainer.addEventListener('click', (e) => {
      clearTimeout(holdTimeout);
      if (lastSpeed !== null) {
        stopSpeedUp();
        return;
      }

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

    DOMElements.pip.addEventListener('click', this.pipToggle.bind(this));
    WebUtils.setupTabIndex(DOMElements.pip);

    DOMElements.playerContainer.addEventListener('dragenter', (e) => {
      e.stopPropagation();
      e.preventDefault();
    }, false);
    DOMElements.playerContainer.addEventListener('dragover', (e) => {
      e.stopPropagation();
      e.preventDefault();
    }, false);

    DOMElements.settingsButton.addEventListener('click', (e) => {
      if (e.shiftKey) {
        chrome.runtime.openOptionsPage();
      } else {
        this.optionsWindow.toggleUI();
      }
      e.stopPropagation();
    });
    WebUtils.setupTabIndex(DOMElements.settingsButton);

    const welcomeText = Localize.getMessage('player_welcometext', [this.client.version]);
    this.setStatusMessage('welcome', welcomeText, 'info', 3000);

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

    DOMElements.skipForwardButton.addEventListener('click', (e) => {
      this.client.setSeekSave(false);
      this.client.currentTime += 10;
      this.client.setSeekSave(true);
      e.stopPropagation();
    });

    WebUtils.setupTabIndex(DOMElements.skipForwardButton);

    DOMElements.skipBackwardButton.addEventListener('click', (e) => {
      this.client.setSeekSave(false);
      this.client.currentTime += -10;
      this.client.setSeekSave(true);
      e.stopPropagation();
    });

    WebUtils.setupTabIndex(DOMElements.skipBackwardButton);

    DOMElements.moreButton.addEventListener('click', (e) => {
      if (!DOMElements.extraTools.classList.contains('visible')) {
        this.closeAllMenus();
        DOMElements.extraTools.classList.add('visible');
      } else {
        DOMElements.extraTools.classList.remove('visible');
      }
      e.stopPropagation();
    });
    WebUtils.setupTabIndex(DOMElements.moreButton);

    DOMElements.duration.addEventListener('click', (e) => {
      let copyURL = '';
      if (this.client.source) {
        const source = this.client.source;
        if (source.mode === PlayerModes.ACCELERATED_YT) {
          copyURL = `https://youtu.be/${URLUtils.get_yt_identifier(source.url)}`;
          copyURL += `?t=${Math.floor(this.client.currentTime)}`;
        } else {
          try {
            const url = new URL(source.url);
            if (source.countHeaders() > 0) {
              const headers = JSON.stringify(source.headers);
              url.searchParams.set('faststream-headers', headers);
            }
            url.searchParams.set('faststream-mode', source.mode);
            url.searchParams.set('faststream-timestamp', Math.floor(this.client.currentTime).toString());
            copyURL = url.toString();
          } catch (e) {
          }
        }
      }

      const input = document.createElement('input');
      input.value = copyURL;
      document.body.appendChild(input);
      input.focus();
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);

      this.setStatusMessage(StatusTypes.COPY, Localize.getMessage('source_copied'), 'info', 2000);
    });
    WebUtils.setupTabIndex(DOMElements.duration);

    DOMElements.nextVideo.addEventListener('click', (e) => {
      this.client.nextVideo();
      e.stopPropagation();
    });

    WebUtils.setupTabIndex(DOMElements.nextVideo);

    DOMElements.previousVideo.addEventListener('click', (e) => {
      this.client.previousVideo();
      e.stopPropagation();
    });

    WebUtils.setupTabIndex(DOMElements.previousVideo);

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
      focusInput: false,
    });

    const mouseUpHandler = (e) => {
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);
    };

    const mouseMoveHandler = (e) => {
      const currentY = Math.min(Math.max(e.clientY - WebUtils.getOffsetTop(DOMElements.progressContainer), -100), 100);
      const isExpanded = DOMElements.playerContainer.classList.contains('expanded');
      const offset = isExpanded ? 0 : 80;
      if (currentY > 50) {
        this.closeTimeline();
      } else if (currentY <= -5 - offset) {
        this.openTimeline();
      }
    };

    DOMElements.controlsLeft.addEventListener('mousedown', (e) => {
      document.addEventListener('mousemove', mouseMoveHandler);
      document.addEventListener('mouseup', mouseUpHandler);
    });
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
          this.shouldPlay = this.client.state.playing;
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
      this.shouldPlay = this.client.state.playing;
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

  destroy() {
    this.saveManager.destroy();
  }

  progressLoop() {
    if (!this.shouldRunProgressLoop) {
      this.isRunningProgressLoop = false;
      return;
    }
    window.requestAnimationFrame(this.progressLoop.bind(this));
    this.client.updateTime(this.client.currentTime);
  }

  durationChanged() {
    const duration = this.client.duration;
    if (duration < (5 * 60 * this.client.playbackRate) || this.fineTimeControls.started) {
      this.runProgressLoop();
    } else {
      this.stopProgressLoop();
    }
    this.timeUpdated();
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

  skipSegment() {
    this.progressBar.skipSegment();
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
      if (!this.focusingControls && !this.mouseOverControls && !this.isBigPlayButtonVisible() && this.state.playing && this.toolManager.canHideControls()) {
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
    this.controlsVisible = false;
    DOMElements.playerContainer.classList.remove('controls_visible');
    DOMElements.controlsContainer.classList.remove('fade_in');
    DOMElements.controlsContainer.classList.add('fade_out');
    DOMElements.progressContainer.classList.remove('freeze');
  }

  showControlBar() {
    this.controlsVisible = true;
    DOMElements.playerContainer.classList.add('controls_visible');
    DOMElements.controlsContainer.classList.remove('fade_out');
    DOMElements.controlsContainer.classList.add('fade_in');
  }


  updatePlaybackRate() {
    this.playbackRateChanger.setPlaybackRate(this.state.playbackRate, true);
    this.durationChanged();
  }

  updateLanguageTracks() {
    this.languageChanger.updateLanguageTracks(this.client);
  }

  updateQualityLevels() {
    this.videoQualityChanger.updateQualityLevels(this.client);
  }

  setVolume(volume) {
    this.volumeControls.setVolume(volume);
  }

  timeUpdated() {
    const duration = this.client.duration;
    if (!this.progressBar.isSeeking) {
      DOMElements.currentProgress.style.width = Utils.clamp(this.state.currentTime / duration, 0, 1) * 100 + '%';
    }
    DOMElements.duration.textContent = StringUtils.formatTime(this.state.currentTime) + ' / ' + StringUtils.formatTime(duration);

    const chapters = this.client.chapters;
    if (chapters.length > 0) {
      const time = this.state.currentTime;
      const chapter = chapters.find((chapter) => chapter.startTime <= time && chapter.endTime >= time);
      if (chapter) {
        this.setStatusMessage('chapter', chapter.name, 'info');
      }
    } else {
      this.setStatusMessage('chapter', null, 'info');
    }

    this.subtitlesManager.renderSubtitles();
    this.fineTimeControls.onVideoTimeUpdate();
    this.updateSkipSegments();
  }

  toggleWindowedFullscreen() {
    chrome.runtime.sendMessage({
      type: 'request_windowed_fullscreen',
    }, (response) => {
    });
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

    if (!this.state.playing) {
      this.client.play();
    } else {
      this.client.pause();
    }
  }

  play() {
    const previousValue = this.state.playing;
    this.state.playing = true;
    this.hideBigPlayButton();
    this.updatePlayPauseButton();
    if (!previousValue) {
      this.playPauseAnimation();
      this.queueControlsHide();
    }
  }

  pause() {
    const previousValue = this.state.playing;
    this.state.playing = false;
    this.updatePlayPauseButton();
    this.showControlBar();
    if (previousValue) {
      this.playPauseAnimation();
    }
  }

  updatePlayPauseButton() {
    const playButton = DOMElements.playPauseButton;
    const playButtonBig = DOMElements.playPauseButtonBig;
    if (this.state.playing) {
      playButton.classList.add('playing');
      playButtonBig.classList.replace('fluid_initial_play_button', 'fluid_initial_pause_button');
      WebUtils.setLabels(playButton, Localize.getMessage('player_pause_label'));
    } else {
      playButton.classList.remove('playing');
      playButtonBig.classList.replace('fluid_initial_pause_button', 'fluid_initial_play_button');
      WebUtils.setLabels(playButton, Localize.getMessage('player_play_label'));
    }
  }

  isUserSeeking() {
    return this.progressBar.isSeeking || this.fineTimeControls.isSeeking;
  }

  playPauseAnimation() {
    if (this.isUserSeeking()) {
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
