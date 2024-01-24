import {Localize} from '../../modules/Localize.mjs';
import {EventEmitter} from '../../modules/eventemitter.mjs';
import {DOMElements} from '../DOMElements.mjs';

export class VideoQualityChanger extends EventEmitter {
  constructor() {
    super();
    this.stayVisible = false;
  }

  showUI(dontSetVisible = false) {
    DOMElements.videoSourceList.style.display = '';
    if (!dontSetVisible) {
      this.stayVisible = true;
    }
  }

  hideUI() {
    DOMElements.videoSourceList.style.display = 'none';
    this.stayVisible = false;
  }

  isVisible() {
    return DOMElements.videoSourceList.style.display !== 'none';
  }

  setupUI() {
    DOMElements.videoSource.addEventListener('click', (e) => {
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

    DOMElements.videoSource.tabIndex = 0;

    DOMElements.videoSource.addEventListener('focus', ()=>{
      if (!this.isVisible()) {
        this.showUI(true);
      }
    });

    DOMElements.videoSource.addEventListener('blur', ()=>{
      if (!this.stayVisible) {
        this.hideUI();
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
  }

  updateQualityLevels(client) {
    const levels = client.levels;

    if (!levels || levels.size <= 1) {
      DOMElements.videoSource.style.display = 'none';
      return;
    } else {
      DOMElements.videoSource.style.display = '';
    }

    const currentLevel = client.currentLevel;

    DOMElements.videoSourceList.replaceChildren();

    levels.forEach((level, levelKey) => {
      const levelelement = document.createElement('div');

      levelelement.classList.add('fluid_video_source_list_item');
      levelelement.addEventListener('click', (e) => {
        Array.from(DOMElements.videoSourceList.getElementsByClassName('source_active')).forEach((element) => {
          element.classList.remove('source_active');
        });
        this.emit('qualityChanged', levelKey);
        levelelement.classList.add('source_active');
        e.stopPropagation();
      });

      if (levelKey === currentLevel) {
        levelelement.classList.add('source_active');
      }

      const icon = document.createElement('span');
      icon.classList.add('source_button_icon');

      const text = document.createElement('span');
      const label = level.width + 'x' + level.height + ' @' + Math.round(level.bitrate / 1000) + 'kbps';

      text.textContent = (levelKey === currentLevel) ? label + ' ' + Localize.getMessage('player_quality_current') : label;
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
}
