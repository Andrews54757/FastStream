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
      this.hideUI();
      e.stopPropagation();
    });

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
      if (config.type === 'css' && config.isColor) {
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
    try {
      const settingsStr = await Utils.getConfig('subtitlesSettings');
      if (settingsStr) {
        const settings = JSON.parse(settingsStr);
        this.settings = Utils.mergeOptions(DefaultSubtitlesSettings, settings);
      }
      this.updateSettingsUI();
      this.emit(SubtitlesSettingsManagerEvents.SETTINGS_CHANGED, this.settings);
    } catch (e) {
      console.error(e);
      this.updateSettingsUI();
      this.emit(SubtitlesSettingsManagerEvents.SETTINGS_CHANGED, this.settings);
    }
  }

  showUI() {
    DOMElements.subtitlesMenu.classList.add('settings');
  }

  hideUI() {
    DOMElements.subtitlesMenu.classList.remove('settings');
  }
}
