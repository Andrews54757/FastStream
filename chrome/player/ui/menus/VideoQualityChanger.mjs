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
    if (!this.isOpen()) {
      return false;
    }
    DOMElements.videoSourceList.style.display = 'none';
    this.stayOpen = false;
    return true;
  }

  isOpen() {
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
      if (this.isOpen()) {
        this.closeUI();
      } else {
        this.openUI();
      }
      e.stopPropagation();
    });

    DOMElements.videoSource.addEventListener('focus', () => {
      if (!this.isOpen() && !isMouseDown) {
        this.openUI(true);
      }
    });

    DOMElements.videoSource.addEventListener('blur', () => {
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

  groupLevelsByDimensions(levels) {
    const map = new Map();
    levels.forEach((level) => {
      const key = level.width + 'x' + level.height;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(level);
    });
    return map;
  }

  updateQualityLevels(client) {
    const videoLevels = client.getVideoLevels();
    if (!videoLevels || videoLevels.size <= 1) {
      DOMElements.videoSource.classList.add('hidden');
      return;
    } else {
      DOMElements.videoSource.classList.remove('hidden');
    }

    const videoLevelsByDimensions = this.groupLevelsByDimensions(client.getLevelManager().filterVideoLevelsByLanguage(Array.from(videoLevels.values())));
    const currentVideoLevelID = client.getCurrentVideoLevelID();

    DOMElements.videoSourceList.replaceChildren();

    videoLevelsByDimensions.forEach((levels, dimensions) => {
      const levelelement = document.createElement('div');

      levelelement.classList.add('fluid_video_source_list_item');
      levelelement.addEventListener('click', (e) => {
        const chosen = client.getLevelManager().pickVideoLevel(levels, null, true);
        if (!chosen) {
          console.warn('No level chosen');
          e.stopPropagation();
          return;
        }

        // if already active, do nothing
        const currentLevelID = client.getCurrentVideoLevelID();
        if (chosen.id === currentLevelID) {
          e.stopPropagation();
          return;
        }

        Array.from(DOMElements.videoSourceList.getElementsByClassName('source_active')).forEach((element) => {
          element.classList.remove('source_active');
        });
        this.emit('qualityChanged', chosen, levels.length <= 1);
        levelelement.classList.add('source_active');
        e.stopPropagation();
      });

      const isLevelActive = levels.some((level) => level.id === currentVideoLevelID);
      if (isLevelActive && levels.length <= 1) {
        levelelement.classList.add('source_active');
      } else if (isLevelActive) {
        levelelement.classList.add('subsource_active');
      }

      // sort levels by bitrate ascending
      levels.sort((a, b) => a.bitrate - b.bitrate);

      const icon = document.createElement('span');
      icon.classList.add('source_button_icon');

      const text = document.createElement('span');
      const label = `${dimensions}${(levels.length > 1 && isLevelActive) ? '' : ` @${levels.length > 1 ? `${Math.round(levels[0].bitrate / 1000)}-${Math.round(levels[levels.length - 1].bitrate / 1000)}` : Math.round(levels[0].bitrate / 1000)} kbps`}`;

      text.textContent = (isLevelActive && levels.length <= 1) ? label + ' ' + Localize.getMessage('player_quality_current') : (isLevelActive ? (label + ' ▼') : label);

      const audioCodecSet = new Set();
      const videoCodecSet = new Set();
      const containerSet = new Set();
      const languageSet = new Set();
      levels.forEach((lvl) => {
        if (lvl.audioCodec) {
          audioCodecSet.add(lvl.audioCodec);
        }
        if (lvl.videoCodec) {
          videoCodecSet.add(lvl.videoCodec);
        }
        if (lvl.mimeType) {
          const mimeParts = lvl.mimeType.split('/');
          if (mimeParts.length >= 2) {
            containerSet.add(mimeParts[1]);
          }
        }
        if (lvl.language) {
          languageSet.add(lvl.language);
        }
      });

      const titleParts = [];
      titleParts.push(`IDs: ${levels.map((o) => o.id).join(', ')}`);
      if (containerSet.size > 0) {
        titleParts.push(`Containers: ${Array.from(containerSet).join(', ')}`);
      }
      titleParts.push(`Bitrate: ${levels.length > 1 ? levels.map((lvl) => lvl.bitrate).join(', ') + ' bps' : levels[0].bitrate + ' bps'}`);

      if (videoCodecSet.size > 0) {
        titleParts.push(`Video codecs: ${Array.from(videoCodecSet).join(', ')}`);
      }
      if (audioCodecSet.size > 0) {
        titleParts.push(`Audio codecs: ${Array.from(audioCodecSet).join(', ')}`);
      }
      if (languageSet.size > 0) {
        titleParts.push(`Languages: ${Array.from(languageSet).join(', ')}`);
      }
      levelelement.title = titleParts.join('\n');
      levelelement.appendChild(text);

      DOMElements.videoSourceList.appendChild(levelelement);

      if (levels.length > 1 && isLevelActive) {
        // Add sub-level elements
        levels.forEach((level) => {
          const subLevelElement = document.createElement('div');
          subLevelElement.classList.add('fluid_video_source_sublist_item');
          const mimeParts = level.mimeType ? level.mimeType.split('/') : [];
          const container = (mimeParts.length >= 2) ? mimeParts[1] : '';

          const isActive = level.id === currentVideoLevelID;
          if (isActive) {
            subLevelElement.classList.add('source_active');
          }

          const text = document.createElement('span');
          text.textContent = `${container} @${Math.round(level.bitrate / 1000)} kbps${level.id === currentVideoLevelID ? ' ' + Localize.getMessage('player_quality_current') : ''}`;
          const titleParts = [];
          titleParts.push(`ID: ${level.id}`);
          if (container) {
            titleParts.push(`Container: ${container}`);
          }
          titleParts.push(`Bitrate: ${level.bitrate} bps`);
          if (level.videoCodec) {
            titleParts.push(`Video codec: ${level.videoCodec}`);
          }
          if (level.audioCodec) {
            titleParts.push(`Audio codec: ${level.audioCodec}`);
          }
          if (level.language) {
            titleParts.push(`Language: ${level.language}`);
          }
          subLevelElement.title = titleParts.join('\n');
          subLevelElement.appendChild(text);

          subLevelElement.addEventListener('click', (e) => {
            // if already active, do nothing
            const currentLevelID = client.getCurrentVideoLevelID();
            if (level.id === currentLevelID) {
              e.stopPropagation();
              return;
            }

            Array.from(DOMElements.videoSourceList.getElementsByClassName('source_active')).forEach((element) => {
              element.classList.remove('source_active');
            });
            this.emit('qualityChanged', level, true);
            subLevelElement.classList.add('source_active');
            e.stopPropagation();
          });
          DOMElements.videoSourceList.appendChild(subLevelElement);
        });
      }
    });


    const current = videoLevels.get(currentVideoLevelID);
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
