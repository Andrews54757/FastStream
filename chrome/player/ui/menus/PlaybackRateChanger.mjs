import {EventEmitter} from '../../modules/eventemitter.mjs';
import {Utils} from '../../utils/Utils.mjs';
import {WebUtils} from '../../utils/WebUtils.mjs';
import {DOMElements} from '../DOMElements.mjs';

export class PlaybackRateChanger extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.stayOpen = false;
    this.playbackRate = 1;
    this.playbackElements = [];
    this.onSilenceSkipperUIOpenHandle = this.onSilenceSkipperUIOpen.bind(this);
    this.onSilenceSkipperUICloseHandle = this.onSilenceSkipperUIClose.bind(this);
    this.silenceSkipperUIOpen = false;
  }

  onSilenceSkipperUIOpen() {

  }

  onSilenceSkipperUIClose() {

  }

  openSilenceSkipperUI() {
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

  openUI(dontSetStayVisible = false) {
    this.emit('open', {
      target: DOMElements.playbackRate,
    });

    DOMElements.playbackRateMenuContainer.style.display = '';
    DOMElements.playbackRateOptions.style.display = '';

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
    DOMElements.playbackRateOptions.style.display = 'none';

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

    for (let i = 1; i <= 80; i += 1) {
      ((i) => {
        const el = document.createElement('div');
        els.push(el);
        el.textContent = ((i + 0.1) / 10).toString().substring(0, 3);

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

    DOMElements.playbackRateOptions.addEventListener('click', (e) => {
      const fineTimeControls = this.client.interfaceController.fineTimeControls;
      if (this.silenceSkipperUIOpen && fineTimeControls.isStateActive(this.onSilenceSkipperUIOpenHandle)) {
        this.closeSilenceSkipperUI();
      } else {
        this.openSilenceSkipperUI();
      }
      e.stopPropagation();
    });
  }

  shiftPlaybackRate(shift) {
    this.setPlaybackRate(Math.round((this.playbackRate + shift) * 10) / 10);
  }

  setPlaybackRate(rate, noEmit = false) {
    this.playbackRate = Utils.clamp(rate, 0.1, 8);
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
    }
  }
}
