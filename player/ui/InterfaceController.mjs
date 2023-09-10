import {DownloadStatus} from '../enums/DownloadStatus.mjs';
import {PlayerModes} from '../enums/PlayerModes.mjs';
import {Coloris} from '../modules/coloris.mjs';
import {SubtitleTrack} from '../SubtitleTrack.mjs';
import {Utils} from '../utils/Utils.mjs';
import {VideoSource} from '../VideoSource.mjs';
import {DOMElements} from './DOMElements.mjs';

export class InterfaceController {
  constructor(client) {
    this.client = client;
    this.persistent = client.persistent;
    this.isSeeking = false;
    this.isMouseOverProgressbar = false;

    this.lastSpeed = 0;
    this.mouseOverControls = false;
    this.mouseActivityCooldown = 0;
    this.playbackRate = 10;

    this.hasShownSkip = false;
    this.failed = false;
    this.setupDOM();
  }
  reset() {
    DOMElements.videoContainer.innerHTML = '';
    DOMElements.seekPreviewVideo.innerHTML = '';
    DOMElements.seekPreviewVideo.style.display = 'none';
    DOMElements.progressLoadedContainer.innerHTML = '';
    DOMElements.downloadStatus.textContent = '';
    this.hasShownSkip = false;
    this.failed = false;
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
    this.persistent.duration = 0;
  }

  failedToLoad(reason) {
    this.failed = true;
    DOMElements.downloadStatus.textContent = reason;
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

  renderProgressBar(fragments, additionalClass = null) {
    let i = 0;
    let total = 0;
    let loaded = 0;
    let currentTime = 0;
    while (i < fragments.length) {
      const frag = fragments[i];

      if (!frag) {
        i++;
        continue;
      }
      total++;
      if (frag.start && !currentTime) {
        currentTime = frag.start;
      }
      const start = Math.max(currentTime, 0);

      let end = currentTime + frag.duration;
      currentTime = end;

      if (frag.status === DownloadStatus.WAITING) {
        i++;
        continue;
      }

      const element = document.createElement('div');
      element.style.left = Math.min(start / this.persistent.duration * 100, 100) + '%';

      if (additionalClass) {
        element.classList.add(additionalClass);
      }

      if (frag.status === DownloadStatus.DOWNLOAD_INITIATED) {
        element.classList.add('download-initiated');
      } else if (frag.status === DownloadStatus.DOWNLOAD_COMPLETE) {
        loaded++;
        element.classList.add('download-complete');
      } else if (frag.status === DownloadStatus.DOWNLOAD_FAILED) {
        element.classList.add('download-failed');
      }

      i++;

      while (i < fragments.length && fragments[i].status === frag.status) {
        end = currentTime + fragments[i].duration;
        currentTime = end;
        i++;

        total++;
        if (frag.status === DownloadStatus.DOWNLOAD_COMPLETE) {
          loaded++;
        }
      }

      end = Math.min(end, this.persistent.duration);

      element.style.width = Math.min((end - start) / this.persistent.duration * 100, 100) + '%';

      DOMElements.progressLoadedContainer.appendChild(element);
    }
    return {
      i, total, loaded,
    };
  }
  updateFragmentsLoaded() {
    DOMElements.progressLoadedContainer.innerHTML = '';


    if (!this.persistent.duration) {
      return;
    }

    if (!this.client.player) {
      return;
    }

    const level = this.client.player.currentLevel;
    const audioLevel = this.client.player.currentAudioLevel;

    const fragments = this.client.getFragments(level);
    const audioFragments = this.client.getFragments(audioLevel);

    let total = 0;
    let loaded = 0;

    if (fragments) {
      const result = this.renderProgressBar(fragments, audioFragments ? 'download-video' : null);
      total += result.total;
      loaded += result.loaded;
    }

    if (audioFragments) {
      const result = this.renderProgressBar(audioFragments, fragments ? 'download-audio' : null);
      total += result.total;
      loaded += result.loaded;
    }

    if (total === 0) {
      return;
    }

    const percentDone = Math.round((loaded / total) * 1000) / 10;

    this.lastSpeed = (this.client.downloadManager.getSpeed() * 0.1 + this.lastSpeed * 0.9) || 0;
    let speed = this.lastSpeed; // bytes per second
    speed = Math.round(speed / 1000 / 1000 * 10) / 10; // MB per second

    if (!this.makingDownload) {
      if (percentDone < 100) {
        this.setDownloadStatus(`${this.client.downloadManager.downloaders.length}C ↓${speed}MB/s ${percentDone}%`);
      } else {
        if (DOMElements.downloadStatus.textContent != 'Save complete') {
          this.setDownloadStatus(`100% Downloaded`);
        }
      }
    }
  }


  setupDOM() {
    DOMElements.volumeContainer.addEventListener('mousedown', this.onVolumeBarMouseDown.bind(this));
    // DOMElements.muteBtn.addEventListener('mouseenter', () => {
    //     DOMElements.volumeContainer.classList.remove("hidden");
    // });
    // DOMElements.muteBtn.addEventListener('mouseleave', () => {
    //     DOMElements.volumeContainer.classList.add("hidden");
    // });
    DOMElements.muteBtn.addEventListener('click', this.muteToggle.bind(this));
    DOMElements.playPauseButton.addEventListener('click', this.playPauseToggle.bind(this));
    DOMElements.playPauseButtonBigCircle.addEventListener('click', () => {
      this.hideControlBarOnAction();
      this.playPauseToggle();
    });
    DOMElements.videoContainer.addEventListener('dblclick', () => {
      this.hideControlBarOnAction();
      this.playPauseToggle();
    });
    DOMElements.progressContainer.addEventListener('mousedown', this.onProgressbarMouseDown.bind(this));
    DOMElements.progressContainer.addEventListener('mouseenter', this.onProgressbarMouseEnter.bind(this));
    DOMElements.progressContainer.addEventListener('mouseleave', this.onProgressbarMouseLeave.bind(this));
    DOMElements.progressContainer.addEventListener('mousemove', this.onProgressbarMouseMove.bind(this));

    DOMElements.fullscreen.addEventListener('click', this.fullscreenToggle.bind(this));
    document.addEventListener('fullscreenchange', this.updateFullScreenButton.bind(this));
    DOMElements.videoSource.addEventListener('click', (e) => {
      if (DOMElements.videoSourceList.style.display === 'none') {
        DOMElements.videoSourceList.style.display = 'block';
      } else {
        DOMElements.videoSourceList.style.display = 'none';
      }
      e.stopPropagation();
    });
    DOMElements.playerContainer.addEventListener('click', (e) => {
      DOMElements.videoSourceList.style.display = 'none';
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
    DOMElements.videoContainer.addEventListener('click', () => {
      this.hideControlBarOnAction();
    });
    DOMElements.hideButton.addEventListener('click', () => {
      DOMElements.hideButton.blur();
      this.focusingControls = false;
      this.hideControlBar();
    });

    Utils.setupTabIndex(DOMElements.hideButton);

    DOMElements.skipButton.addEventListener('click', this.skipIntroOutro.bind(this));
    DOMElements.download.addEventListener('click', this.downloadMovie.bind(this));
    Utils.setupTabIndex(DOMElements.download);
    DOMElements.playerContainer.addEventListener('drop', this.onFileDrop.bind(this), false);

    DOMElements.playerContainer.addEventListener('dragenter', (e) => {
      e.stopPropagation();
      e.preventDefault();
    }, false);
    DOMElements.playerContainer.addEventListener('dragover', (e) => {
      e.stopPropagation();
      e.preventDefault();
    }, false);

    DOMElements.settingsButton.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
    Utils.setupTabIndex(DOMElements.settingsButton);

    const welcomeText = 'Welcome to FastStream v' + this.client.version + '!';
    this.setDownloadStatus(welcomeText);
    setTimeout(() => {
      if (DOMElements.downloadStatus.textContent == welcomeText) {
        this.setDownloadStatus('');
      }
    }, 3000);
    this.setupRateChanger();

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
  }

  setupRateChanger() {
    const els = [];
    const speedList = document.createElement('div');
    speedList.style = 'overflow-y: scroll; padding-right: 20px; box-sizing: content-box; width: 80px; height: 100%';

    DOMElements.rateMenu.appendChild(speedList);

    let clicked = false;

    DOMElements.playbackRate.addEventListener('focus', (e) => {
      if (DOMElements.rateMenu.style.display == 'none') {
        DOMElements.rateMenu.style.display = '';
        speedList.scrollTop = els[this.playbackRate - 1].offsetTop - 20.5 * 2;
      }
    });

    DOMElements.playbackRate.addEventListener('blur', (e) => {
      if (!clicked) {
        DOMElements.rateMenu.style.display = 'none';
      }
    });

    DOMElements.playbackRate.addEventListener('click', (e) => {
      clicked = !clicked;
      if (!clicked) {
        DOMElements.rateMenu.style.display = 'none';
      } else {
        DOMElements.rateMenu.style.display = '';
        speedList.scrollTop = els[this.playbackRate - 1].offsetTop - 20.5 * 2;
      }
      e.stopPropagation();
    });


    Utils.setupTabIndex(DOMElements.playbackRate);


    for (let i = 1; i <= 30; i += 1) {
      ((i) => {
        const el = document.createElement('div');
        els.push(el);
        el.style = 'font-family: Arial; font-size: 15px; width: 60px; text-align: center; padding: 3px 0px; line-height: 1em';
        el.textContent = ((i + 0.1) / 10).toString().substring(0, 3);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.client.playbackRate = i / 10;
        }, true);
        speedList.appendChild(el);
      })(i);
    }


    els[this.playbackRate - 1].style.backgroundColor = 'rgba(0,0,0,0.3)';

    this.playbackElements = els;

    DOMElements.playbackRate.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        this.client.playbackRate = Math.min(3, (this.playbackRate + 1) / 10);
        speedList.scrollTop = els[this.playbackRate - 1].offsetTop - 20.5 * 2;
        e.stopPropagation();
      } else if (e.key === 'ArrowUp') {
        this.client.playbackRate = Math.max(0.1, (this.playbackRate - 1) / 10);
        speedList.scrollTop = els[this.playbackRate - 1].offsetTop - 20.5 * 2;
        e.stopPropagation();
      }
    });

    DOMElements.playerContainer.addEventListener('click', (e) => {
      DOMElements.rateMenu.style.display = 'none';
    });
  }

  async onFileDrop(e) {
    e.stopPropagation();
    e.preventDefault();

    const dt = e.dataTransfer;
    const files = dt.files;
    const captions = [];
    const audioFormats = [
      '.mp3',
      '.wav',
      '.m4a',
      '.m4r',
    ];
    let src = null;
    const mode = PlayerModes.DIRECT;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.substring(file.name.length - 4);

      if (audioFormats.indexOf(ext) !== -1) {
        src = file;
      } else if (ext == 'm3u8') {
        src = file;
      } else if (ext == '.mp4' || ext == '.mkv' || ext == '.mov') {
        src = file;
        //  mode = PlayerModes.ACCELERATED_MP4;
      } else if (ext == '.vtt' || ext == '.srt') {
        captions.push({
          url: window.URL.createObjectURL(file),
          name: file.name.substring(0, file.name.length - 4),
        });
      }
    }

    if (src) {
      const source = new VideoSource(src, {}, mode);
      await this.client.addSource(source, true);
    }

    (await Promise.all(captions.map(async (file) => {
      const track = new SubtitleTrack(file.name);
      await track.loadURL(file.url);
      return track;
    }))).forEach((track) => {
      this.client.loadSubtitleTrack(track);
      this.client.subtitlesManager.activateTrack(track);
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
    const duration = this.persistent.duration;
    if (duration < 5 * 60 || this.client.subtitleSyncer.started) {
      this.runProgressLoop();
    } else {
      this.stopProgressLoop();
    }
    this.updateProgress();
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

  setDownloadStatus(text) {
    if (this.failed) return;
    DOMElements.downloadStatus.textContent = text;
  }

  async downloadMovie() {
    if (!this.client.player) {
      alert('No video loaded!');
      return;
    }

    if (this.makingDownload) {
      alert('Already making download!');
      return;
    }

    const player = this.client.player;

    const {canSave, isComplete} = player.canSave();

    if (!canSave) {
      alert('Download is not supported for this video!');
      return;
    }

    if (!isComplete) {
      const res = confirm('Video has not finished downloading yet! Are you sure you want to save it?');
      if (!res) {
        return;
      }
    }

    const name = prompt('Enter a name for the file', (this.client.mediaName || 'video').replaceAll(' ', '_'));

    if (!name) {
      return;
    }

    let url;
    if (this.reuseDownloadURL && this.downloadURL && isComplete) {
      url = this.downloadURL;
    } else {
      this.reuseDownloadURL = isComplete;
      let result;
      this.makingDownload = true;
      this.setDownloadStatus(`Making download...`);
      try {
        result = await player.getSaveBlob({
          onProgress: (progress) => {
            this.setDownloadStatus(`Saving ${Math.round(progress * 100)}%`);
          },
        });
      } catch (e) {
        console.error(e);
        alert('Failed to save video!');
        this.setDownloadStatus(`Save Failed`);
        this.makingDownload = false;
        return;
      }
      this.setDownloadStatus(`Save complete`);
      this.makingDownload = false;
      if (this.downloadURL) {
        URL.revokeObjectURL(this.downloadURL);
        this.downloadURL = null;
      }
      url = URL.createObjectURL(result.blob);
      this.downloadExtension = result.extension;

      setTimeout(() => {
        if (this.downloadURL !== url) return;

        if (this.downloadURL) {
          URL.revokeObjectURL(this.downloadURL);
          this.downloadURL = null;
          this.reuseDownloadURL = false;
        }

        this.setDownloadStatus('');

        this.updateFragmentsLoaded();
      }, 20000);
    }

    this.downloadURL = url;

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', name + '.' + this.downloadExtension);
    link.setAttribute('target', '_blank');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  updateMarkers() {
    DOMElements.markerContainer.innerHTML = '';
    const seeks = this.client.seeks;
    if (seeks.length) {
      const time = seeks[seeks.length - 1];
      const marker = document.createElement('div');
      marker.classList.add('seek_marker');
      marker.style.left = (time / this.persistent.duration * 100) + '%';
      DOMElements.markerContainer.appendChild(marker);
    }
  }
  skipIntroOutro() {
    const introMatch = this.client.videoAnalyzer.getIntro();
    const outroMatch = this.client.videoAnalyzer.getOutro();
    const time = this.client.currentTime;
    if (introMatch && time >= introMatch.startTime && time < introMatch.endTime) {
      this.client.currentTime = introMatch.endTime;
    } else if (outroMatch && time >= outroMatch.startTime && time < outroMatch.endTime) {
      this.client.currentTime = outroMatch.endTime;
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
      if (!this.focusingControls && !this.mouseOverControls && DOMElements.playPauseButtonBigCircle.style.display == 'none') {
        this.hideControlBar();
      }
    }, time || 2000);
  }

  hideControlBarOnAction(cooldown) {
    if (!this.mouseOverControls && !this.focusingControls) {
      this.mouseActivityCooldown = Date.now() + (cooldown || 500);
      if (DOMElements.playPauseButtonBigCircle.style.display == 'none') {
        this.hideControlBar();
      }
    }
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
    let offsetLeft = 0;
    do {
      if (!isNaN(elem.offsetLeft)) {
        offsetLeft += elem.offsetLeft;
      }
    } while (elem = elem.offsetParent);
    return offsetLeft;
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

    const time = this.persistent.duration * currentX / totalWidth;

    DOMElements.seekPreviewText.textContent = Utils.formatTime(time);

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
    DOMElements.playPauseButtonBigCircle.style.display = 'none';
    // we need an initial position for touchstart events, as mouse up has no offset x for iOS
    let initialPosition = Math.min(Math.max(event.clientX - this.getOffsetLeft(DOMElements.progressContainer), 0), DOMElements.progressContainer.clientWidth);

    const shiftTime = (timeBarX) => {
      const totalWidth = DOMElements.progressContainer.clientWidth;
      if (totalWidth) {
        this.client.currentTime = this.persistent.duration * timeBarX / totalWidth;
      }
      this.updateProgress();
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
        let newVolume = volumeBarX / totalWidth;

        if (newVolume < 0.05) {
          newVolume = 0;
          this.persistent.muted = true;
        } else if (newVolume > 0.95) {
          newVolume = 1;
        }

        if (this.persistent.muted && newVolume > 0) {
          this.persistent.muted = false;
        }
        this.client.volume = newVolume;
      }
    };

    const onVolumeBarMouseMove = (event) => {
      const currentX = event.clientX - this.getOffsetLeft(DOMElements.volumeContainer);
      shiftVolume(currentX);
    };

    const onVolumeBarMouseUp = (event) => {
      document.removeEventListener('mousemove', onVolumeBarMouseMove);
      document.removeEventListener('touchmove', onVolumeBarMouseMove);
      document.removeEventListener('mouseup', onVolumeBarMouseUp);
      document.removeEventListener('touchend', onVolumeBarMouseUp);

      const currentX = event.clientX - this.getOffsetLeft(DOMElements.volumeContainer);

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
      el.style.backgroundColor = '';
    });

    this.playbackElements[this.playbackRate - 1].style.backgroundColor = 'rgba(0,0,0,0.3)';
  }

  updateIntroOutroBar() {
    DOMElements.introOutroContainer.innerHTML = '';

    const introMatch = this.client.videoAnalyzer.getIntro();
    const outroMatch = this.client.videoAnalyzer.getOutro();

    if (introMatch) {
      introMatch.endTime = Math.min(introMatch.endTime, this.persistent.duration);
      const introElement = document.createElement('div');
      introElement.style.left = introMatch.startTime / this.persistent.duration * 100 + '%';
      introElement.style.width = (introMatch.endTime - introMatch.startTime) / this.persistent.duration * 100 + '%';
      DOMElements.introOutroContainer.appendChild(introElement);
    }


    if (outroMatch) {
      outroMatch.endTime = Math.min(outroMatch.endTime, this.persistent.duration);
      const outroElement = document.createElement('div');
      outroElement.style.left = outroMatch.startTime / this.persistent.duration * 100 + '%';
      outroElement.style.width = (outroMatch.endTime - outroMatch.startTime) / this.persistent.duration * 100 + '%';
      DOMElements.introOutroContainer.appendChild(outroElement);
    }


    const time = this.client.currentTime;
    if (introMatch && time >= introMatch.startTime && time < introMatch.endTime) {
      DOMElements.skipButton.style.display = '';
      DOMElements.skipButton.textContent = 'Skip Intro';
      DOMElements.progressContainer.classList.add('skip_freeze');
    } else if (outroMatch && time >= outroMatch.startTime && time < outroMatch.endTime) {
      DOMElements.skipButton.style.display = '';
      DOMElements.skipButton.textContent = 'Skip Outro';
      DOMElements.progressContainer.classList.add('skip_freeze');
    } else {
      DOMElements.progressContainer.classList.remove('skip_freeze');
      DOMElements.skipButton.style.display = 'none';
      this.hasShownSkip = false;
    }

    if (DOMElements.skipButton.style.display !== 'none') {
      if (!this.hasShownSkip) {
        this.hasShownSkip = true;

        this.showControlBar();
        this.queueControlsHide(5000);
      }
    }
  }
  updateQualityLevels() {
    if (this.persistent.levels.size <= 1) {
      DOMElements.videoSource.style.display = 'none';
      return;
    } else {
      DOMElements.videoSource.style.display = 'inline-block';
    }

    DOMElements.videoSourceList.innerHTML = '';
    this.persistent.levels.forEach((level, i) => {
      const levelelement = document.createElement('div');

      levelelement.classList.add('fluid_video_source_list_item');
      levelelement.addEventListener('click', () => {
        this.client.currentLevel = i;
        this.updateQualityLevels();
      });

      if (i === this.persistent.currentLevel) {
        levelelement.classList.add('source_active');
      }

      const icon = document.createElement('span');
      icon.classList.add('source_button_icon');

      const text = document.createElement('span');
      const label = level.width + 'x' + level.height + ' @' + Math.round(level.bitrate / 1000) + 'kbps';

      text.textContent = (i === this.persistent.currentLevel) ? label + ' (current)' : label;
      //   levelelement.appendChild(icon);
      levelelement.appendChild(text);

      DOMElements.videoSourceList.appendChild(levelelement);
    });

    const current = this.persistent.levels.get(this.persistent.currentLevel);
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
    const volumeposTag = DOMElements.currentVolumePos;
    const volumebarTotalWidth = DOMElements.volumeControlBar.clientWidth;
    const volumeposTagWidth = volumeposTag.clientWidth;
    const muteButtonTag = DOMElements.muteBtn;

    const volume = this.persistent.volume;

    if (0 !== volume) {
      this.persistent.latestVolume = volume;
      this.persistent.muted = false;
    } else {
      this.persistent.muted = true;
    }
    if (this.persistent.muted) {
      muteButtonTag.classList.replace('fluid_button_volume', 'fluid_button_mute');
    } else {
      muteButtonTag.classList.replace('fluid_button_mute', 'fluid_button_volume');
    }

    currentVolumeTag.style.width = (volume * 100) + '%';
  }
  updateProgress() {
    DOMElements.currentProgress.style.width = (this.persistent.currentTime / this.persistent.duration) * 100 + '%';
    DOMElements.duration.textContent = Utils.formatTime(this.persistent.currentTime) + ' / ' + Utils.formatTime(this.persistent.duration);
  }

  fullscreenToggle() {
    try {
      if (document.fullscreenEnabled) {
        if (!document.fullscreenElement) {
          DOMElements.playerContainer.requestFullscreen();
        } else if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      } else {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            type: 'fullscreen',
          });
        }
      }
    } catch (e) {
      console.log('Fullscreen not supported', e);
    }

    this.persistent.fullscreen = document.fullscreen;
    this.updateFullScreenButton();
  }

  updateFullScreenButton() {
    const fullScreenButton = DOMElements.fullscreen;
    if (document.fullscreenElement) {
      fullScreenButton.classList.replace('fluid_button_fullscreen', 'fluid_button_fullscreen_exit');
    } else {
      fullScreenButton.classList.replace('fluid_button_fullscreen_exit', 'fluid_button_fullscreen');
    }
  }

  playPauseToggle() {
    if (!this.persistent.playing) {
      this.play();
      this.client.player?.play();
    } else {
      this.pause();
      this.client.player?.pause();
    }
  }

  play() {
    const previousValue = this.persistent.playing;
    this.persistent.playing = true;
    DOMElements.playPauseButtonBigCircle.style.display = 'none';
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
    if (previousValue) {
      this.playPauseAnimation();
    }
  }

  updatePlayPauseButton() {
    const playButton = DOMElements.playPauseButton;
    const playButtonBig = DOMElements.playPauseButtonBig;
    if (this.persistent.playing) {
      playButton.classList.replace('fluid_button_play', 'fluid_button_pause');
      playButtonBig.classList.replace('fluid_initial_play_button', 'fluid_initial_pause_button');
    } else {
      playButton.classList.replace('fluid_button_pause', 'fluid_button_play');
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
        500,
    );
  }
}
