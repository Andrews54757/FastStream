import {EventEmitter} from '../../modules/eventemitter.mjs';
import {DOMElements} from '../DOMElements.mjs';
import {Localize} from '../../modules/Localize.mjs';
import {WebUtils} from '../../utils/WebUtils.mjs';
import {GIF} from '../../modules/gif/gif.mjs';

export class LoopMenu extends EventEmitter {
  constructor(client) {
    super();

    this.client = client;
    this.loopEnabled = false;
    this.loopStart = 0;
    this.loopEnd = null;
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
      this.updateLoopAndGif();
      e.stopPropagation();
    });
    WebUtils.setupTabIndex(toggleLoopButton);
    loopButtonContainer.appendChild(toggleLoopButton);

    const gifButton = document.createElement('div');
    gifButton.role = 'button';
    gifButton.classList.add('loop_menu_gif_button');
    gifButton.addEventListener('click', (e) => {
      this.loopEnabled = true;
      this.updateLoopAndGif();
      this.recordGif();
      e.stopPropagation();
    });
    WebUtils.setupTabIndex(gifButton);

    const svgIcon = WebUtils.createSVGIcon('assets/fluidplayer/static/icons2.svg#gif');
    gifButton.appendChild(svgIcon);
    loopButtonContainer.appendChild(gifButton);

    this.updateUI();
  }

  updateLoopAndGif() {
    const player = this.client.player;
    if (this.gifLoopRunning) {
      this.stopGifRecording(true);
    }
    if (this.loopEnabled && player) {
      // Loop the full video (start -> end) when enabled.
      this.loopStart = 0;
      const duration = this.client.duration ?? player.getVideo()?.duration;
      this.loopEnd = Number.isFinite(duration) && duration > 0 ? duration : 0;
    } else {
      this.loopStart = 0;
      this.loopEnd = 0;
    }

    this.toggleLoopButton.textContent = Localize.getMessage('loop_menu_toggle_' + (this.loopEnabled ? 'enabled' : 'disabled'));
    if (this.loopEnabled) {
      this.toggleLoopButton.classList.add('enabled');
    } else {
      this.toggleLoopButton.classList.remove('enabled');
    }

    if (player) {
      player.getVideo().loop = !!this.loopEnabled;
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
    if (DOMElements.loopMenu.style.display === 'none') {
      return false;
    }
    DOMElements.loopMenu.style.display = 'none';
    return true;
  }

  recordGif() {
    if (!this.loopEnabled || this.gifLoopRunning) {
      return;
    }
    this.gif = new GIF({
      workers: 4,
      quality: 4,
      dither: false,
    });

    const player = this.client.player;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = player.getVideo().videoWidth;
    canvas.height = player.getVideo().videoHeight;

    this.gifCanvas = canvas;
    this.gifCtx = ctx;
    this.lastTimeRecorded = null;

    const loopStart = this.loopStart;

    this.client.currentTime = Math.max(loopStart - 1, 0);
    this.client.play();

    this.previousPlaybackRate = this.client.playbackRate;
    this.client.playbackRate = 4;

    this.startGifRecording();
  }

  startGifRecording() {
    if (this.gifLoopRunning) {
      return;
    }
    console.log('start gif recording');
    this.client.interfaceController.setStatusMessage('save-gif', Localize.getMessage('loop_menu_gif_start'), 'info');
    this.recordingGif = true;
    this.gifLoopRunning = true;
    this.gifLoop();
  }

  stopGifRecording(abort) {
    this.recordingGif = false;
    if (abort && this.gif) {
      this.gif.abort();
      this.gif = null;
      this.client.interfaceController.setStatusMessage('save-gif', Localize.getMessage('loop_menu_gif_abort'), 'info', 5000);
    }
  }

  gifLoop() {
    const player = this.client.player;
    const currentTime = Math.floor(player.currentTime * 100) / 100;
    const loopStart = this.loopStart;
    const loopEnd = Number.isFinite(this.loopEnd) && this.loopEnd > 0 ? this.loopEnd : this.client.duration;
    let reachedEnd = false;
    if (currentTime >= loopStart) {
      const lastRecorded = this.lastTimeRecorded;

      if ((Number.isFinite(loopEnd) && loopEnd > 0 && currentTime >= loopEnd) || (lastRecorded !== null && currentTime < lastRecorded)) {
        reachedEnd = true;
      } else if (lastRecorded === null || currentTime - lastRecorded > 1/30) {
        if (lastRecorded !== null && this.gif) {
          this.gif.addFrame(this.gifCanvas, {
            delay: Math.round((currentTime - lastRecorded) * 1000),
            copy: true,
          });
        }

        this.gifCtx.drawImage(player.getVideo(), 0, 0, this.gifCanvas.width, this.gifCanvas.height);
        this.lastTimeRecorded = currentTime;
      }
    }

    if (reachedEnd || !this.loopEnabled || !this.recordingGif) {
      console.log('gif recording reached end');
      this.gifLoopRunning = false;
      this.loopEnabled = false;
      this.client.pause();
      this.client.playbackRate = this.previousPlaybackRate;
      this.updateLoopAndGif();
      this.finishGif();
      return;
    }
    requestAnimationFrame(this.gifLoop.bind(this));
  }

  finishGif() {
    this.recordingGif = false;
    this.gifLoopRunning = false;
    this.lastTimeRecorded = null;
    this.gifCtx = null;
    this.gifCanvas = null;


    const gif = this.gif;
    if (gif) {
      this.client.interfaceController.setStatusMessage('save-gif', Localize.getMessage('loop_menu_gif_end'), 'info', 5000);
      gif.on('progress', (p) => {
        if (this.gif === gif) {
          this.client.interfaceController.setStatusMessage('save-gif', Localize.getMessage('loop_menu_gif_progress', [Math.round(p * 1000) / 10]), 'info');
        }
      });
      gif.on('finished', (blob) => {
        this.client.interfaceController.setStatusMessage('save-gif', Localize.getMessage('loop_menu_gif_finished'), 'info', 5000);
        gif.abort();
        console.log('gif finished');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'loop.gif';
        a.click();
        URL.revokeObjectURL(url);
      });
      gif.render();
    }
  }
}
