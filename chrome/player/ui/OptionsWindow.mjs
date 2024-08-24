import {Localize} from '../modules/Localize.mjs';
import {InterfaceUtils} from '../utils/InterfaceUtils.mjs';
import {WebUtils} from '../utils/WebUtils.mjs';
import {DOMElements} from './DOMElements.mjs';

export class OptionsWindow {
  constructor() {
    this.setupUI();
  }

  setupUI() {
    DOMElements.optionsContainer.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    DOMElements.optionsContainer.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeUI();
        e.preventDefault();
        e.stopPropagation();
      }
    });

    DOMElements.optionsContainer.addEventListener('keyup', (e) => {
      e.stopPropagation();
    });

    DOMElements.playerContainer.addEventListener('click', (e) => {
      this.closeUI();
    });
    const closeBtn = DOMElements.optionsContainer.getElementsByClassName('close_button')[0];
    closeBtn.addEventListener('click', (e) => {
      this.closeUI();
    });
    WebUtils.setupTabIndex(closeBtn);
  }

  openUI() {
    InterfaceUtils.closeWindows();
    DOMElements.optionsContainer.style.display = '';

    WebUtils.setLabels(DOMElements.settingsButton, Localize.getMessage('player_settings_close_label'));
  }

  closeUI() {
    DOMElements.optionsContainer.style.display = 'none';

    WebUtils.setLabels(DOMElements.settingsButton, Localize.getMessage('player_settings_open_label'));
  }

  toggleUI() {
    if (DOMElements.optionsContainer.style.display === 'none') {
      this.openUI();
    } else {
      this.closeUI();
    }
  }
}
