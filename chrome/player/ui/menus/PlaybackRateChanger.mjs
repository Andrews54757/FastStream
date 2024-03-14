import {EventEmitter} from '../../modules/eventemitter.mjs';
import {EnvUtils} from '../../utils/EnvUtils.mjs';
import {Utils} from '../../utils/Utils.mjs';
import {WebUtils} from '../../utils/WebUtils.mjs';
import {DOMElements} from '../DOMElements.mjs';

export class PlaybackRateChanger extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.stayOpen = false;
    this.playbackRate = 1;
    this.maxPlaybackRate = EnvUtils.isChrome() ? 16 : 8;
    this.playbackElements = [];
    this.onSilenceSkipperUIOpenHandle = this.onSilenceSkipperUIOpen.bind(this);
    this.onSilenceSkipperUICloseHandle = this.onSilenceSkipperUIClose.bind(this);
    this.onAudioMouseDownHandle = this.onAudioMouseDown.bind(this);
    this.minDB = -80;
    this.maxDB = 0;
    this.silenceSkipperUIOpen = false;
    this.silenceSkipperActive = false;
    this.silenceSkipSpeed = this.maxPlaybackRate; // Firefox mutes audio if playback rate is too high
    this.regularSpeed = 1;
    this.silenceThreshold = 0;
    this.audioPaddingStart = 0.5;
    this.audioPaddingEnd = 0.25;
    this.setupOptionsUI();

    this.silenceSkipperLoopHandle = this.silenceSkipperLoop.bind(this);

    this.loadState();
  }

  async saveState() {
    const state = {
      playbackRate: this.silenceSkipperActive ? this.regularSpeed : this.playbackRate,
      silenceSkipSpeed: this.silenceSkipSpeed,
      audioPaddingStart: this.audioPaddingStart,
      audioPaddingEnd: this.audioPaddingEnd,
    };

    return Utils.setConfig('playbackRateConfig', JSON.stringify(state));
  }

  async loadState() {
    const state = await Utils.loadAndParseOptions('playbackRateConfig', {
      playbackRate: 1,
      silenceSkipSpeed: this.maxPlaybackRate,
      // audioPaddingStart: 0.25,
      // audioPaddingEnd: 0.25,
    });

    this.client.playbackRate = state.playbackRate;
    this.silenceSkipSpeed = state.silenceSkipSpeed;
    // this.audioPaddingStart = state.audioPaddingStart;
    // this.audioPaddingEnd = state.audioPaddingEnd;
  }

  onAudioMouseDown(e) {
    const startY = e.clientY;
    const startThreshold = this.silenceThreshold;
    const fineTimeControls = this.client.interfaceController.fineTimeControls;
    const onAudioMouseMove = (e) => {
      const diff = startY - e.clientY;
      this.silenceThreshold = Utils.clamp(startThreshold + diff / fineTimeControls.ui.timelineAudio.clientHeight, 0, 1);
      this.updateSilenceSkipper();
    };

    const onAudioMouseUp = (e) => {
      document.removeEventListener('mousemove', onAudioMouseMove);
      document.removeEventListener('mouseup', onAudioMouseUp);
      document.removeEventListener('mouseleave', onAudioMouseUp);
    };

    document.addEventListener('mousemove', onAudioMouseMove);
    document.addEventListener('mouseup', onAudioMouseUp);
    document.addEventListener('mouseleave', onAudioMouseUp);
    e.stopPropagation();
    e.preventDefault();
  }

  updateSilenceSkipper() {
    const fineTimeControls = this.client.interfaceController.fineTimeControls;

    this.ui.thresholdBar.style.bottom = this.silenceThreshold * 100 + '%';
    if (fineTimeControls.isStateActive(this.onSilenceSkipperUIOpenHandle)) {
      fineTimeControls.setAudioSilenceThreshold(this.silenceThreshold, this.audioPaddingStart, this.audioPaddingEnd);
    }
  }

  onSilenceSkipperUIOpen() {
    const fineTimeControls = this.client.interfaceController.fineTimeControls;
    fineTimeControls.ui.timelineAudioCanvasContainer.style.height = '200%';
    fineTimeControls.ui.timelineAudio.appendChild(this.ui.thresholdBar);
    fineTimeControls.ui.timelineAudio.addEventListener('mousedown', this.onAudioMouseDownHandle);
    fineTimeControls.ui.timelineAudio.style.cursor = 'ns-resize';
    this.updateSilenceSkipper();

    this.client.interfaceController.setStatusMessage('silence-skip', 'Drag pink line to set silence threshold', 'info', 5000);
  }

  onSilenceSkipperUIClose() {
    const fineTimeControls = this.client.interfaceController.fineTimeControls;
    fineTimeControls.ui.timelineAudioCanvasContainer.style.height = '';
    fineTimeControls.ui.timelineAudio.removeChild(this.ui.thresholdBar);
    fineTimeControls.ui.timelineAudio.removeEventListener('mousedown', this.onAudioMouseDownHandle);
    fineTimeControls.ui.timelineAudio.style.cursor = '';
    fineTimeControls.setAudioSilenceThreshold(null);
    this.client.interfaceController.setStatusMessage('silence-skip');
  }

  openSilenceSkipperUI() {
    if (!this.client.player) return;

    const fineTimeControls = this.client.interfaceController.fineTimeControls;
    if (this.silenceSkipperUIOpen) {
      fineTimeControls.prioritizeState(this.onSilenceSkipperUIOpenHandle);
      return;
    }
    this.silenceSkipperUIOpen = true;
    fineTimeControls.pushState(this.onSilenceSkipperUIOpenHandle, this.onSilenceSkipperUICloseHandle);
  }

  closeSilenceSkipperUI() {
    if (!this.silenceSkipperUIOpen) {
      return;
    }
    this.silenceSkipperUIOpen = false;

    const fineTimeControls = this.client.interfaceController.fineTimeControls;
    fineTimeControls.removeState(this.onSilenceSkipperUIOpenHandle);
  }


  silenceSkipperLoop() {
    if (!this.silenceSkipperActive) {
      this.silenceSkipperLoopRunning = false;
      return;
    }
    const playbackRate = this.client.playbackRate;
    setTimeout(this.silenceSkipperLoopHandle, 100 / playbackRate);

    if (!this.client.player) return;


    const time = this.client.currentTime;
    if (this.shouldSkipSilence(time)) {
      if (playbackRate !== this.silenceSkipSpeed) {
        // Fix for chrome desync bug
        if (EnvUtils.isChrome()) {
          this.client.player.currentTime = this.client.player.currentTime;
        }
        this.client.playbackRate = this.silenceSkipSpeed;
      }
    } else {
      if (playbackRate !== this.regularSpeed) {
        this.client.playbackRate = this.regularSpeed;
      }
    }
  }

  shouldSkipSilence(time) {
    const minDB = -80;
    const maxDB = 0;
    const dbRange = maxDB - minDB;

    const volumeBuffer = this.client.audioAnalyzer.getVolumeData();
    const outputRate = this.client.audioAnalyzer.getOutputRate();
    const minIndex = Math.floor((time - this.audioPaddingEnd) * outputRate);
    const maxIndex = Math.floor((time + this.audioPaddingStart) * outputRate);
    for (let i = minIndex; i < maxIndex; i++) {
      if (volumeBuffer[i] === undefined) continue;
      const volume = Utils.clamp((volumeBuffer[i] - minDB) / dbRange, 0, 1);
      if (volume >= this.silenceThreshold) {
        return false;
      }
    }
    return true;
  }

  enableSilenceSkipper() {
    if (this.silenceSkipperActive || !this.client.player) {
      return;
    }
    this.silenceSkipperActive = true;
    this.openSilenceSkipperUI();
    this.client.audioAnalyzer.addVolumeDependent(this);
    this.client.audioAnalyzer.addBackgroundDependent(this);

    if (this.shouldSkipSilence(this.client.currentTime)) {
      if (this.playbackRate > this.regularSpeed) {
        this.silenceSkipSpeed = this.playbackRate;
      }
    } else {
      if (this.playbackRate < this.silenceSkipSpeed) {
        this.regularSpeed = this.playbackRate;
      }
    }

    if (!this.silenceSkipperLoopRunning) {
      this.silenceSkipperLoopRunning = true;
      this.silenceSkipperLoop();
    }
  }

  disableSilenceSkipper() {
    if (!this.silenceSkipperActive) {
      return;
    }
    this.silenceSkipperActive = false;
    this.client.audioAnalyzer.removeVolumeDependent(this);
    this.client.audioAnalyzer.removeBackgroundDependent(this);
    this.closeSilenceSkipperUI();
  }

  toggleSilenceSkipper() {
    if (this.silenceSkipperActive) {
      const fineTimeControls = this.client.interfaceController.fineTimeControls;
      if (!fineTimeControls.isStateActive(this.onSilenceSkipperUIOpenHandle)) {
        this.openSilenceSkipperUI();
        return;
      }
      this.disableSilenceSkipper();
    } else {
      this.enableSilenceSkipper();
    }
  }

  setupOptionsUI() {
    this.ui = {};
    this.ui.thresholdBar = WebUtils.create('div', '', 'threshold_bar');
  }
  openUI(dontSetStayVisible = false) {
    this.emit('open', {
      target: DOMElements.playbackRate,
    });

    DOMElements.playbackRateMenuContainer.style.display = '';

    this.scrollToPosition();
    if (!dontSetStayVisible) {
      this.stayOpen = true;
    }
  }

  scrollToPosition() {
    const element = this.playbackElements[Math.round(this.playbackRate * 10) - 1];
    this.speedList.scrollTop = element.offsetTop - this.speedList.clientHeight / 2 + element.clientHeight / 2;
  }

  closeUI() {
    DOMElements.playbackRateMenuContainer.style.display = 'none';
    this.stayOpen = false;
  }

  isVisible() {
    return DOMElements.playbackRateMenuContainer.style.display !== 'none';
  }

  setupUI() {
    const els = [];
    const speedList = document.createElement('div');
    this.speedList = speedList;
    speedList.classList.add('rate-changer-list');

    DOMElements.rateMenu.appendChild(speedList);

    let isMouseDown = false;
    DOMElements.playbackRate.addEventListener('mousedown', (e) => {
      isMouseDown = true;
    }, true);

    DOMElements.playbackRate.addEventListener('mouseup', (e) => {
      isMouseDown = false;
    }, true);

    DOMElements.playbackRate.addEventListener('focus', (e) => {
      if (!this.isVisible() && !isMouseDown) {
        this.openUI(true);
      }
    });

    DOMElements.playbackRate.addEventListener('blur', (e) => {
      isMouseDown = false;
      if (!this.stayOpen) {
        this.closeUI();
      }
    });

    DOMElements.playbackRate.addEventListener('click', (e) => {
      if (e.shiftKey) {
        this.toggleSilenceSkipper();
        e.stopPropagation();
        return;
      }

      if (this.isVisible()) {
        this.closeUI();
      } else {
        this.openUI();
      }
      e.stopPropagation();
    });

    DOMElements.playerContainer.addEventListener('click', (e) => {
      this.closeUI();
    });

    WebUtils.setupTabIndex(DOMElements.playbackRate);

    for (let i = 1; i <= this.maxPlaybackRate * 10; i += 1) {
      ((i) => {
        const el = document.createElement('div');
        els.push(el);
        const val = Math.floor(i / 10);
        const dec = i % 10;
        el.textContent = `${val}.${dec}`;

        el.addEventListener('click', (e) => {
          this.setPlaybackRate(i / 10);
          e.stopPropagation();
        }, true);
        speedList.appendChild(el);
      })(i);
    }

    els[Math.round(this.playbackRate * 10) - 1].classList.add('rate-selected');

    this.playbackElements = els;

    DOMElements.playbackRate.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        this.shiftPlaybackRate(0.1);
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === 'ArrowUp') {
        this.shiftPlaybackRate(-0.1);
        e.preventDefault();
        e.stopPropagation();
      }
    });

    DOMElements.rateMenu.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    DOMElements.rateMenu.addEventListener('mouseup', (e) => {
      e.stopPropagation();
    });
  }

  shiftPlaybackRate(shift) {
    this.setPlaybackRate(Math.round((this.playbackRate + shift) * 10) / 10);
  }

  setPlaybackRate(rate, noEmit = false) {
    this.playbackRate = Utils.clamp(rate, 0.1, this.maxPlaybackRate);
    this.playbackElements.forEach((el) => {
      el.classList.remove('rate-selected');
    });

    const element = this.playbackElements[Math.round(this.playbackRate * 10) - 1];
    this.scrollToPosition();
    element.classList.add('rate-selected');

    DOMElements.playbackRateBanner.textContent = this.playbackRate.toFixed(1).padStart(1, '0');
    if (this.playbackRate === 1) {
      DOMElements.playbackRateBanner.style.display = 'none';
    } else {
      DOMElements.playbackRateBanner.style.display = '';
    }

    if (!noEmit) {
      this.emit('rateChanged', this.playbackRate);

      if (this.silenceSkipperActive) {
        if (this.shouldSkipSilence(this.client.currentTime)) {
          if (this.playbackRate > this.regularSpeed) {
            this.silenceSkipSpeed = this.playbackRate;
          }
        } else {
          if (this.playbackRate < this.silenceSkipSpeed) {
            this.regularSpeed = this.playbackRate;
          }
        }
      }

      this.saveState();
    }
  }
}
