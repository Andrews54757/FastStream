import {EventEmitter} from '../../modules/eventemitter.mjs';
import {Utils} from '../../utils/Utils.mjs';
import {WebUtils} from '../../utils/WebUtils.mjs';
import {DOMElements} from '../DOMElements.mjs';

export class PlaybackRateChanger extends EventEmitter {
  constructor() {
    super();
    this.stayVisible = false;
    this.playbackRate = 1;
    this.playbackElements = [];
  }

  showUI(dontSetVisible = false) {
    DOMElements.rateMenuContainer.style.display = '';
    this.speedList.scrollTop = this.playbackElements[Math.round(this.playbackRate * 10) - 1].offsetTop - 60;
    if (!dontSetVisible) {
      this.stayVisible = true;
    }
  }

  hideUI() {
    DOMElements.rateMenuContainer.style.display = 'none';
    this.stayVisible = false;
  }

  isVisible() {
    return DOMElements.rateMenuContainer.style.display !== 'none';
  }

  setupUI() {
    const els = [];
    const speedList = document.createElement('div');
    this.speedList = speedList;
    speedList.classList.add('rate-changer-list');

    DOMElements.rateMenu.appendChild(speedList);

    DOMElements.playbackRate.addEventListener('focus', (e) => {
      if (!this.isVisible()) {
        this.showUI(true);
      }
    });

    DOMElements.playbackRate.addEventListener('blur', (e) => {
      if (!this.stayVisible) {
        this.hideUI();
      }
    });

    DOMElements.playbackRate.addEventListener('click', (e) => {
      if (this.stayVisible) {
        this.hideUI();
      } else {
        this.showUI();
      }
      e.stopPropagation();
    });

    DOMElements.playerContainer.addEventListener('click', (e) => {
      this.hideUI();
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
    this.speedList.scrollTop = element.offsetTop - 60;
    element.classList.add('rate-selected');

    if (!noEmit) {
      this.emit('rateChanged', this.playbackRate);
    }
  }
}
