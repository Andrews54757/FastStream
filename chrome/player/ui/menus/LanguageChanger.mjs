import {Localize} from '../../modules/Localize.mjs';
import {EventEmitter} from '../../modules/eventemitter.mjs';
import {DOMElements} from '../DOMElements.mjs';

export class LanguageChanger extends EventEmitter {
  constructor() {
    super();
    this.stayOpen = false;
  }

  openUI(dontSetStayVisible = false) {
    DOMElements.languageMenu.style.display = '';
    if (!dontSetStayVisible) {
      this.stayOpen = true;
    }
  }

  closeUI() {
    DOMElements.languageMenu.style.display = 'none';
    this.stayOpen = false;
  }

  isVisible() {
    return DOMElements.languageMenu.style.display !== 'none';
  }

  setupUI() {
    DOMElements.languageButton.addEventListener('click', (e) => {
      if (this.stayOpen) {
        this.closeUI();
      } else {
        this.openUI();
      }
      e.stopPropagation();
    });

    DOMElements.playerContainer.addEventListener('click', (e) => {
      this.closeUI();
    });

    DOMElements.languageButton.tabIndex = 0;

    DOMElements.languageButton.addEventListener('focus', ()=>{
      if (!this.isVisible()) {
        this.openUI(true);
      }
    });

    DOMElements.languageButton.addEventListener('blur', ()=>{
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
  }

  updateLanguageTracks(client) {
    const tracks = client.languageTracks;
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
          this.emit('languageChanged', track);
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
