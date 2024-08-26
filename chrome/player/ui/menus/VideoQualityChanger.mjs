import {Localize} from '../../modules/Localize.mjs';
import {EventEmitter} from '../../modules/eventemitter.mjs';
import {DOMElements} from '../DOMElements.mjs';

export class VideoQualityChanger extends EventEmitter {
  constructor() {
    super();
    this.stayOpen = false;
  }

  openUI(dontSetStayVisible = false) {
    this.emit('open', {
      target: DOMElements.videoSource,
    });

    DOMElements.videoSourceList.style.display = '';
    if (!dontSetStayVisible) {
      this.stayOpen = true;
    }
  }

  closeUI() {
    DOMElements.videoSourceList.style.display = 'none';
    this.stayOpen = false;
  }

  isVisible() {
    return DOMElements.videoSourceList.style.display !== 'none';
  }

  setupUI() {
    DOMElements.videoSource.tabIndex = 0;

    let isMouseDown = false;
    DOMElements.videoSource.addEventListener('mousedown', (e) => {
      isMouseDown = true;
    }, true);

    DOMElements.videoSource.addEventListener('mouseup', (e) => {
      isMouseDown = false;
    }, true);

    DOMElements.videoSource.addEventListener('click', (e) => {
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

    DOMElements.videoSource.addEventListener('focus', ()=>{
      if (!this.isVisible() && !isMouseDown) {
        this.openUI(true);
      }
    });

    DOMElements.videoSource.addEventListener('blur', ()=>{
      isMouseDown = false;
      if (!this.stayOpen) {
        this.closeUI();
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

    DOMElements.videoSourceList.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    DOMElements.videoSourceList.addEventListener('mouseup', (e) => {
      e.stopPropagation();
    });
  }

  updateQualityLevels(client) {
    const levels = client.levels;

    if (!levels || levels.size <= 1) {
      DOMElements.videoSource.classList.add('hidden');
      return;
    } else {
      DOMElements.videoSource.classList.remove('hidden');
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
    const maxSize = Math.min(current.width, current.height);

    const qualityList = {
      'sd': maxSize < 720,
      'hd': maxSize >= 720 && maxSize < 1080,
      'fhd': maxSize >= 1080 && maxSize < 1440,
      '2k': maxSize >= 1440 && maxSize < 2160,
      '4k': maxSize >= 2160 && maxSize < 4320,
      '8k': maxSize >= 4320,
    };

    for (const quality in qualityList) {
      if (!Object.hasOwn(qualityList, quality)) {
        continue;
      }

      // Find element with .quality-<quality> class
      const element = DOMElements.videoSource.querySelector(`.quality-${quality}`);
      if (!element) {
        console.warn('No element for quality', quality);
        continue;
      }

      if (qualityList[quality]) {
        element.style.display = 'inline-block';
      } else {
        element.style.display = '';
      }
    }
  }
}
