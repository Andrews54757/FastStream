import {Coloris} from '../../modules/coloris.mjs';
import {DefaultSubtitlesSettings, SubtitleSettingsConfigData} from '../../options/defaults/DefaultSubtitlesSettings.mjs';
import {EventEmitter} from '../../modules/eventemitter.mjs';
import {DOMElements} from '../DOMElements.mjs';
import {Utils} from '../../utils/Utils.mjs';
import {Localize} from '../../modules/Localize.mjs';

export const SubtitlesSettingsManagerEvents = {
  SETTINGS_CHANGED: 'settingsChanged',
};

export class SubtitlesSettingsManager extends EventEmitter {
  constructor() {
    super();
    this.settings = {...DefaultSubtitlesSettings};

    this.on(SubtitlesSettingsManagerEvents.SETTINGS_CHANGED, ()=>{
      this.saveSettings();
    });

    this.setupSettingsUI();
  }

  getSettings() {
    return this.settings;
  }

  saveSettings() {
    try {
      return Utils.setConfig('subtitlesSettings', JSON.stringify(this.settings));
    } catch (e) {
      console.error(e);
    }
  }

  setupSettingsUI() {
    DOMElements.subtitlesOptionsList.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    DOMElements.subtitlesOptionsList.addEventListener('keyup', (e) => {
      e.stopPropagation();
    });

    DOMElements.subtitlesOptionsBackButton.addEventListener('click', (e) => {
      this.closeUI();
      e.stopPropagation();
    });

    DOMElements.subtitlesOptionsList.addEventListener('click', (e) => {
      Coloris.close();
    }, true);

    this.updateSettingsUI();
  }

  applyStyles(element) {
    const settings = this.getSettings();
    for (const key in settings) {
      if (!Object.hasOwn(settings, key)) continue;
      const config = SubtitleSettingsConfigData[key];
      if (!config) continue;

      if (config.type === 'css') {
        element.style[config.property] = settings[key];
      }
    }
    this.applyOutline(element, settings);
  }

  applyOutline(element, settings) {
    element.style.textShadow = '';
    const outlineWidth = settings.outlineWidth;
    const outlineColor = settings.outlineColor;
    const unit = 'px';
    const outlineWidthValue = parseFloat(outlineWidth);
    if (isNaN(outlineWidthValue) || outlineWidthValue === 0) return;

    // This is a hack to make the outline look better
    // go around the perimeter of the text, circularly
    const shadow = [];
    for (let r = outlineWidthValue; r > 0; r -= 4) {
      const resolution = Math.min(Math.max(360 / (r * 8), 2), 45);
      for (let i = 0; i < 360; i += resolution) {
        const x = Math.cos(i * Math.PI / 180) * r;
        const y = Math.sin(i * Math.PI / 180) * r;
        shadow.push(`${x.toFixed(2)}${unit} ${y.toFixed(2)}${unit} 0px ${outlineColor}`);
      }
    }
    element.style.textShadow = shadow.join(',');
  }

  updateSettingsUI() {
    DOMElements.subtitlesOptionsList.replaceChildren();
    for (const key in this.settings) {
      if (!Object.hasOwn(this.settings, key)) continue;
      const config = SubtitleSettingsConfigData[key];
      if (!config) continue;

      const option = document.createElement('div');
      option.classList.add('option');

      const label = document.createElement('div');
      label.textContent = Localize.getMessage('subtitles_settings_' + key);

      const input = document.createElement('input');
      input.name = key;
      input.type = 'text';
      input.value = this.settings[key];
      input.ariaLabel = label.textContent;

      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('spellcheck', 'false');

      if (config.isColor) {
        Coloris.bindElement(input);
        input.addEventListener('keydown', (e)=>{
          if (e.key === 'Enter') {
            e.stopPropagation();
            input.click();
          }
        });
      }
      let timeout = null;
      input.addEventListener('keyup', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          this.settings[key] = input.value;
          this.emit(SubtitlesSettingsManagerEvents.SETTINGS_CHANGED, this.settings);
        }, 200);
      });

      input.addEventListener('input', () => {
        this.settings[key] = input.value;
        this.emit(SubtitlesSettingsManagerEvents.SETTINGS_CHANGED, this.settings);
      });
      option.appendChild(label);
      option.appendChild(input);
      DOMElements.subtitlesOptionsList.appendChild(option);
    }
  }

  async loadSettings() {
    this.settings = await Utils.getSubtitlesSettingsFromStorage();
    this.updateSettingsUI();
    this.emit(SubtitlesSettingsManagerEvents.SETTINGS_CHANGED, this.settings);
  }

  openUI() {
    DOMElements.subtitlesMenu.classList.add('settings');
  }

  closeUI() {
    DOMElements.subtitlesMenu.classList.remove('settings');
    Coloris.close();
  }

  isOpen() {
    return DOMElements.subtitlesMenu.classList.contains('settings');
  }
}
