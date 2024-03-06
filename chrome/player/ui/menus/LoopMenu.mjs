import {EventEmitter} from '../../modules/eventemitter.mjs';
import {DOMElements} from '../DOMElements.mjs';
import {Localize} from '../../modules/Localize.mjs';
import {WebUtils} from '../../utils/WebUtils.mjs';
import {Utils} from '../../utils/Utils.mjs';

export class LoopMenu extends EventEmitter {
  constructor(client) {
    super();

    this.client = client;
    this.loopEnabled = false;
    this.loopStart = null;
    this.loopEnd = null;
    this.loopTimeSettings = {
      start: '00:00:00.000',
      end: '00:00:00.000',
    };

    this.loopHandler = this.checkLoop.bind(this);
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
    WebUtils.setupTabIndex(DOMElements.loopButton);

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
      WebUtils.setupTabIndex(nowButton);
      option.appendChild(nowButton);

      option.appendChild(input);


      DOMElements.loopMenu.appendChild(option);
    }

    const loopButtonContainer = document.createElement('div');
    loopButtonContainer.style = 'display: flex; justify-content: center';
    DOMElements.loopMenu.appendChild(loopButtonContainer);

    const toggleLoopButton = document.createElement('div');
    this.toggleLoopButton = toggleLoopButton;
    toggleLoopButton.role = 'button';
    toggleLoopButton.classList.add('loop_menu_toggle_button');
    toggleLoopButton.textContent = Localize.getMessage('loop_menu_toggle_' + (this.loopEnabled ? 'enabled' : 'disabled'));
    toggleLoopButton.addEventListener('click', (e) => {
      this.loopEnabled = !this.loopEnabled;
      this.updateLoop();
      e.stopPropagation();
    });
    WebUtils.setupTabIndex(toggleLoopButton);
    loopButtonContainer.appendChild(toggleLoopButton);

    const gifButton = document.createElement('div');
    gifButton.role = 'button';
    gifButton.classList.add('loop_menu_gif_button');
    gifButton.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    WebUtils.setupTabIndex(gifButton);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', 'assets/fluidplayer/static/icons.svg#gif');
    svg.appendChild(use);
    gifButton.appendChild(svg);
    // loopButtonContainer.appendChild(gifButton);

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
    clearTimeout(this.loopTimeout);
    const player = this.client.player;
    if (this.loopEnabled && player) {
      this.loopStart = this.timecodeToSeconds(this.loopTimeSettings.start);
      this.loopEnd = this.timecodeToSeconds(this.loopTimeSettings.end);

      if (this.loopEnd <= 0) {
        this.loopEnd = this.client.duration;
      }

      if (this.loopStart >= this.loopEnd || this.loopStart >= this.client.duration) {
        this.loopEnabled = false;
      } else {
        this.loopStart = Utils.clamp(this.loopStart, 0, this.client.duration);
        this.loopEnd = Utils.clamp(this.loopEnd, 0, this.client.duration);
      }
    } else {
      this.loopStart = null;
      this.loopEnd = null;
    }

    this.toggleLoopButton.textContent = Localize.getMessage('loop_menu_toggle_' + (this.loopEnabled ? 'enabled' : 'disabled'));
    if (this.loopEnabled) {
      this.toggleLoopButton.classList.add('enabled');
    } else {
      this.toggleLoopButton.classList.remove('enabled');
    }

    if (this.loopEnabled) {
      player.getVideo().loop = true;
      this.client.on('tick', this.loopHandler);
    } else {
      player.getVideo().loop = false;
      this.client.off('tick', this.loopHandler);
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

  checkLoop() {
    const player = this.client.player;
    if (!player || !this.loopEnabled) {
      return;
    }

    const currentTime = this.client.currentTime;
    const playbackRate = this.client.playbackRate;

    if (currentTime >= this.loopEnd) {
      clearTimeout(this.loopTimeout);
      this.client.currentTime = this.loopStart;
    } else if (currentTime >= this.loopEnd - 5 && currentTime < this.loopEnd - 0.5) {
      clearTimeout(this.loopTimeout);
      this.loopTimeout = setTimeout(() => {
        this.client.currentTime = this.loopStart;
      }, (this.loopEnd - currentTime) * 1000 / playbackRate);
    } else if (this.loopStart > 0) {
      clearTimeout(this.loopTimeout);
      if (currentTime < this.loopStart) {
        this.client.currentTime = this.loopStart;
      }
    }
  }
}
