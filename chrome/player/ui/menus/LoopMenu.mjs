import {EventEmitter} from '../../modules/eventemitter.mjs';
import {DOMElements} from '../DOMElements.mjs';
import {Localize} from '../../modules/Localize.mjs';

export class LoopMenu extends EventEmitter {
  constructor(client) {
    super();

    this.client = client;
    this.loopEnabled = false;
    this.loopTimeSettings = {
      start: '00:00:00.000',
      end: '00:00:00.000',
    };
  }

  currentTimeToTimecode(time) {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor(time / 60) % 60;
    const seconds = Math.floor(time % 60);
    const milliseconds = Math.floor(time * 1000) % 1000;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }
  setupUI() {
    DOMElements.loopMenu.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    DOMElements.loopMenu.addEventListener('keyup', (e) => {
      e.stopPropagation();
    });

    DOMElements.loopMenu.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    DOMElements.loopMenu.addEventListener('mouseup', (e) => {
      e.stopPropagation();
    });

    DOMElements.loopMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
    });

    DOMElements.loopButton.addEventListener('click', (e) => {
      if (this.isOpen()) {
        this.closeUI();
      } else {
        this.openUI();
      }
      e.stopPropagation();
    });

    const timeSettings = this.loopTimeSettings;

    for (const [name, value] of Object.entries(timeSettings)) {
      const option = document.createElement('div');
      option.classList.add('option');

      const label = document.createElement('div');
      label.classList.add('label');
      label.textContent = Localize.getMessage('loop_menu_' + name);

      const input = document.createElement('input');
      input.name = name;
      input.type = 'text';
      input.value = value;

      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('spellcheck', 'false');

      let timeout = null;
      input.addEventListener('keyup', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          this.loopTimeSettings[name] = input.value;
          this.updateLoop();
        }, 200);
      });

      input.addEventListener('input', () => {
        this.loopTimeSettings[name] = input.value;
        this.updateLoop();
      });
      option.appendChild(label);

      const nowButton = document.createElement('div');
      nowButton.role = 'button';
      nowButton.classList.add('now_button');
      nowButton.textContent = '→';
      nowButton.addEventListener('click', () => {
        input.value = this.currentTimeToTimecode(this.client.currentTime);
        this.loopTimeSettings[name] = input.value;
        this.updateLoop();
      });
      option.appendChild(nowButton);

      option.appendChild(input);


      DOMElements.loopMenu.appendChild(option);
    }

    const loopButtonContainer = document.createElement('div');
    loopButtonContainer.style = 'display: flex; justify-content: center';
    DOMElements.loopMenu.appendChild(loopButtonContainer);

    const toggleLoopButton = document.createElement('div');
    toggleLoopButton.role = 'button';
    toggleLoopButton.classList.add('loop_menu_toggle_button');
    toggleLoopButton.textContent = Localize.getMessage('loop_menu_toggle_' + (this.loopEnabled ? 'enabled' : 'disabled'));
    toggleLoopButton.addEventListener('click', (e) => {
      this.loopEnabled = !this.loopEnabled;
      toggleLoopButton.textContent = Localize.getMessage('loop_menu_toggle_' + (this.loopEnabled ? 'enabled' : 'disabled'));
      if (this.loopEnabled) {
        toggleLoopButton.classList.add('enabled');
      } else {
        toggleLoopButton.classList.remove('enabled');
      }
      this.updateLoop();
      e.stopPropagation();
    });

    loopButtonContainer.appendChild(toggleLoopButton);

    this.updateUI();
  }

  timecodeToSeconds(timecode) {
    const split = timecode.split(':');
    const seconds = parseFloat(split.pop());
    const minutes = parseInt(split.pop() || 0);
    const hours = parseInt(split.pop() || 0);
    return hours * 3600 + minutes * 60 + seconds;
  }

  updateLoop() {
    if (this.loopEnabled) {
      this.client.setLoop(this.timecodeToSeconds(this.loopTimeSettings.start), this.timecodeToSeconds(this.loopTimeSettings.end));
    } else {
      this.client.setLoop(null, null);
    }
  }

  updateUI() {

  }

  isOpen() {
    return DOMElements.loopMenu.style.display !== 'none';
  }

  openUI() {
    this.emit('open', {
      target: DOMElements.loopButton,
    });

    DOMElements.loopMenu.style.display = '';
  }

  closeUI() {
    DOMElements.loopMenu.style.display = 'none';
  }
}
