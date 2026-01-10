import {Localize} from '../../modules/Localize.mjs';
import {EventEmitter} from '../../modules/eventemitter.mjs';
import {DOMElements} from '../DOMElements.mjs';
export class LanguageChanger extends EventEmitter {
  constructor() {
    super();
    this.stayOpen = false;
  }
  openUI(dontSetStayVisible = false) {
    this.emit('open', {
      target: DOMElements.languageButton,
    });
    DOMElements.languageMenu.style.display = '';
    if (!dontSetStayVisible) {
      this.stayOpen = true;
    }
  }
  closeUI() {
    if (DOMElements.languageMenu.style.display === 'none') {
      return false;
    }
    DOMElements.languageMenu.style.display = 'none';
    this.stayOpen = false;
    return true;
  }
  isOpen() {
    return DOMElements.languageMenu.style.display !== 'none';
  }
  setupUI() {
    DOMElements.languageButton.tabIndex = 0;
    let isMouseDown = false;
    DOMElements.languageButton.addEventListener('mousedown', (e) => {
      isMouseDown = true;
    }, true);
    DOMElements.languageButton.addEventListener('mouseup', (e) => {
      isMouseDown = false;
    }, true);
    DOMElements.languageButton.addEventListener('click', (e) => {
      if (this.isOpen()) {
        this.closeUI();
      } else {
        this.openUI();
      }
      e.stopPropagation();
    });
    DOMElements.languageButton.addEventListener('focus', () => {
      if (!this.isOpen() && !isMouseDown) {
        this.openUI(true);
      }
    });
    DOMElements.languageButton.addEventListener('blur', () => {
      isMouseDown = false;
      if (!this.stayOpen) {
        this.closeUI();
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
          candidates[index + 1].scrollIntoView({block: 'nearest'});
        } else {
          candidates[0].classList.add('candidate');
          candidates[0].scrollIntoView({block: 'nearest'});
        }
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === 'ArrowUp') {
        current.classList.remove('candidate');
        if (index > 0) {
          candidates[index - 1].classList.add('candidate');
          candidates[index - 1].scrollIntoView({block: 'nearest'});
        } else {
          candidates[candidates.length - 1].classList.add('candidate');
          candidates[candidates.length - 1].scrollIntoView({block: 'nearest'});
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
    DOMElements.languageMenu.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    DOMElements.languageMenu.addEventListener('mouseup', (e) => {
      e.stopPropagation();
    });
  }
  groupLevelsByLanguage(levels) {
    const languageMap = new Map();
    levels.forEach((level) => {
      const lang = level.language;
      if (!languageMap.has(lang)) {
        languageMap.set(lang, []);
      }
      languageMap.get(lang).push(level);
    });
    return languageMap;
  }
  updateLanguageTracks(client) {
    const videoLevels = client.getVideoLevels();
    const audioLevels = client.getAudioLevels();
    const videoLanguageMap = this.groupLevelsByLanguage(videoLevels);
    const audioLanguageMap = this.groupLevelsByLanguage(audioLevels);
    const currentVideoLevelID = client.getLevelManager().getCurrentVideoLevelID();
    const currentAudioLevelID = client.getLevelManager().getCurrentAudioLevelID();
    if (videoLanguageMap.size < 2 && audioLanguageMap.size < 2) {
      DOMElements.languageButton.classList.add('hidden');
      return;
    } else {
      DOMElements.languageButton.classList.remove('hidden');
    }
    DOMElements.languageMenu.replaceChildren();
    const languageTable = document.createElement('div');
    languageTable.classList.add('language_table');
    DOMElements.languageMenu.appendChild(languageTable);
    const languages = [];
    const hasVideoLanguages = videoLanguageMap.size > 1;
    const hasAudioLanguages = audioLanguageMap.size > 1;
    if (hasVideoLanguages) {
      videoLanguageMap.forEach((tracks, lang) => {
        if (!languages.includes(lang)) {
          languages.push(lang);
        }
      });
    }
    if (hasAudioLanguages) {
      audioLanguageMap.forEach((tracks, lang) => {
        if (!languages.includes(lang)) {
          languages.push(lang);
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
      const videoTracks = videoLanguageMap.get(language) || [];
      const audioTracks = audioLanguageMap.get(language) || [];
      const trackElements = ([videoTracks, audioTracks]).map((tracks, i) => {
        const type = (i === 0) ? 'video' : 'audio';
        if (type === 'video' && !hasVideoLanguages) return;
        if (type === 'audio' && !hasAudioLanguages) return;
        if (tracks.length === 0) {
          // filler element to keep layout consistent
          const filler = document.createElement('div');
          filler.classList.add('language_track');
          filler.classList.add('language_track_filler');
          languageElement.appendChild(filler);
          return;
        }
        const trackElement = document.createElement('div');
        trackElement.classList.add('language_track');
        trackElement.dataset.type = type;
        trackElement.textContent = Localize.getMessage('player_languagemenu_' + type);
        trackElement.setAttribute('aria-label', Localize.getMessage('player_languagemenu_' + type) + ': ' + language);
        const currentLevelID = type === 'video' ? currentVideoLevelID : currentAudioLevelID;
        if (tracks.some((level) => level.id === currentLevelID)) {
          trackElement.classList.add('active');
        }
        languageElement.appendChild(trackElement);
        trackElement.addEventListener('click', (e) => {
          Array.from(DOMElements.languageMenu.getElementsByClassName('active')).forEach((element) => {
            if (element.dataset.type === type) {
              element.classList.remove('active');
            }
          });
          trackElement.classList.add('active');
          this.emit('languageChanged', type, language, tracks);
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
}
