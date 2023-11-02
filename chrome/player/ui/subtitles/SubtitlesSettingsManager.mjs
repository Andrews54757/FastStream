import {Coloris} from '../../modules/coloris.mjs';
import {DefaultSubtitlesSettings} from '../../../options/defaults/DefaultSubtitlesSettings.mjs';
import {EventEmitter} from '../../modules/eventemitter.mjs';
import {DOMElements} from '../DOMElements.mjs';
import {Utils} from '../../utils/Utils.mjs';

const COLOR_SETTINGS = ['color', 'background'];

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

  updateSettingsUI() {
    DOMElements.subtitlesOptionsList.replaceChildren();
    for (const key in this.settings) {
      if (!Object.hasOwn(this.settings, key)) continue;
      const option = document.createElement('div');
      option.classList.add('option');

      const label = document.createElement('div');
      label.textContent = key.charAt(0).toUpperCase() + key.substring(1);

      const input = document.createElement('input');
      input.name = key;
      input.type = 'text';
      input.value = this.settings[key];
      if (COLOR_SETTINGS.includes(key)) {
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
    DOMElements.subtitlesOptions.style.display = '';
    DOMElements.subtitlesView.style.display = 'none';
  }

  hideUI() {
    DOMElements.subtitlesOptions.style.display = 'none';
    DOMElements.subtitlesView.style.display = '';
  }
}
