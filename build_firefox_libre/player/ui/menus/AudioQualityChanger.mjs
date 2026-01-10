import {Localize} from '../../modules/Localize.mjs';
import {EventEmitter} from '../../modules/eventemitter.mjs';
import {DOMElements} from '../DOMElements.mjs';
export class AudioQualityChanger extends EventEmitter {
  constructor() {
    super();
    this.stayOpen = false;
    this.enabled = false;
  }
  openUI(dontSetStayVisible = false) {
    this.emit('open', {
      target: DOMElements.audioConfigBtn,
    });
    DOMElements.audioSourceList.style.display = '';
    if (!dontSetStayVisible) {
      this.stayOpen = true;
    }
  }
  closeUI() {
    if (!this.isOpen()) {
      return false;
    }
    DOMElements.audioSourceList.style.display = 'none';
    this.stayOpen = false;
    return true;
  }
  isOpen() {
    return DOMElements.audioSourceList.style.display !== 'none';
  }
  setupUI() {
    DOMElements.audioConfigBtn.tabIndex = 0;
    let isMouseDown = false;
    DOMElements.audioConfigBtn.addEventListener('mousedown', (e) => {
      isMouseDown = true;
    }, true);
    DOMElements.audioConfigBtn.addEventListener('mouseup', (e) => {
      isMouseDown = false;
    }, true);
    DOMElements.audioConfigBtn.addEventListener('contextmenu', (e) => {
      if (this.isOpen() || !this.enabled) {
        this.closeUI();
      } else {
        this.openUI();
      }
      e.stopPropagation();
      e.preventDefault();
    });
    DOMElements.audioConfigBtn.addEventListener('focus', ()=>{
      if ( this.enabled &&!this.isOpen() && !isMouseDown) {
        this.openUI(true);
      }
    });
    DOMElements.audioConfigBtn.addEventListener('blur', ()=>{
      isMouseDown = false;
      if (!this.stayOpen) {
        this.closeUI();
      }
      const candidates = Array.from(DOMElements.audioSourceList.children);
      let current = candidates.find((el) => el.classList.contains('candidate'));
      if (!current) {
        current = candidates.find((el) => el.classList.contains('source_active'));
      }
      if (!current) {
        return;
      }
      current.classList.remove('candidate');
    });
    DOMElements.audioConfigBtn.addEventListener('keydown', (e) => {
      const candidates = Array.from(DOMElements.audioSourceList.children);
      let current = candidates.find((el) => el.classList.contains('candidate'));
      if (!current) {
        current = candidates.find((el) => el.classList.contains('source_active'));
      }
      if (!current || !this.enabled) {
        return;
      }
      const index = candidates.indexOf(current);
      if (e.key === 'ArrowDown') {
        current.classList.remove('candidate');
        const next = (index < candidates.length - 1) ? candidates[index + 1] : candidates[0];
        next.classList.add('candidate');
        // scroll into view
        next.scrollIntoView({block: 'nearest'});
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === 'ArrowUp') {
        current.classList.remove('candidate');
        const next = (index > 0) ? candidates[index - 1] : candidates[candidates.length - 1];
        next.classList.add('candidate');
        // scroll into view
        next.scrollIntoView({block: 'nearest'});
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === 'Enter') {
        if (current.classList.contains('source_active')) {
          return;
        }
        current.click();
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
    DOMElements.audioSourceList.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    DOMElements.audioSourceList.addEventListener('mouseup', (e) => {
      e.stopPropagation();
    });
  }
  updateQualityLevels(client) {
    const audioLevels = client.getLevelManager().filterAudioLevelsByLanguage(Array.from(client.getAudioLevels().values()));
    if (!audioLevels || audioLevels.length < 1) {
    //   DOMElements.audioSource.classList.add('hidden');
      this.enabled = false;
      return;
    } else {
    //   DOMElements.audioSource.classList.remove('hidden');
      this.enabled = true;
    }
    // sort levels by bitrate ascending
    audioLevels.sort((a, b) => {
      return a.bitrate - b.bitrate;
    });
    const currentAudioLevelID = client.getCurrentAudioLevelID();
    DOMElements.audioSourceList.replaceChildren();
    audioLevels.forEach((level) => {
      const levelelement = document.createElement('div');
      levelelement.classList.add('fluid_audio_source_list_item');
      levelelement.addEventListener('click', (e) => {
        // if already active, do nothing
        const currentLevelID = client.getCurrentAudioLevelID();
        if (level.id === currentLevelID) {
          e.stopPropagation();
          return;
        }
        Array.from(DOMElements.audioSourceList.getElementsByClassName('source_active')).forEach((element) => {
          element.classList.remove('source_active');
        });
        this.emit('qualityChanged', level);
        levelelement.classList.add('source_active');
        e.stopPropagation();
      });
      const isLevelActive = (level.id === currentAudioLevelID);
      if (isLevelActive) {
        levelelement.classList.add('source_active');
      }
      const icon = document.createElement('span');
      icon.classList.add('source_button_icon');
      const text = document.createElement('span');
      const mimeParts = level.mimeType ? level.mimeType.split('/') : [];
      const container = (mimeParts.length >= 2) ? mimeParts[1] : '';
      const label = `${container}${level.id.includes('-drc') ? ' [DRC]' : ''} @${Math.round(level.bitrate / 1000)} kbps`;
      text.textContent = isLevelActive ? label + ' ' + Localize.getMessage('player_quality_current') : label;
      const titleParts = [];
      titleParts.push(`ID: ${level.id}`);
      if (container) {
        titleParts.push(`Container: ${container}`);
      }
      titleParts.push(`Bitrate: ${level.bitrate + ' bps'}`);
      if (level.audioCodec) {
        titleParts.push(`Audio codec: ${level.audioCodec}`);
      }
      if (level.language) {
        titleParts.push(`Language: ${level.language}`);
      }
      levelelement.title = titleParts.join('\n');
      levelelement.appendChild(text);
      DOMElements.audioSourceList.appendChild(levelelement);
    });
  }
}
