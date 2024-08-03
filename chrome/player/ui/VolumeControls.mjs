import {EventEmitter} from '../modules/eventemitter.mjs';
import {EnvUtils} from '../utils/EnvUtils.mjs';
import {Utils} from '../utils/Utils.mjs';
import {WebUtils} from '../utils/WebUtils.mjs';
import {DOMElements} from './DOMElements.mjs';

const MAX_VOLUME = EnvUtils.isWebAudioSupported() ? 3 : 1;

if (!EnvUtils.isWebAudioSupported()) {
  DOMElements.volumeUnity.style.display = 'none';
}

export class VolumeControls extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.volume = 1;
    this.previousVolume = 1;
    this.muted = false;
  }

  setupUI() {
    DOMElements.volumeContainer.addEventListener('mousedown', this.onVolumeBarMouseDown.bind(this));
    DOMElements.muteBtn.addEventListener('click', this.muteToggle.bind(this));
    DOMElements.volumeBlock.tabIndex = 0;
    DOMElements.volumeBlock.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.muteToggle();
        e.stopPropagation();
      } else if (e.key === 'ArrowLeft') {
        this.setVolume(Math.max(0, this.volume - 0.1));
      } else if (e.key === 'ArrowRight') {
        this.setVolume(Math.min(1, this.volume + 0.1));
        e.stopPropagation();
      }
    });

    DOMElements.volumeBlock.addEventListener('wheel', (e) => {
      let delta = e.deltaY;
      if (!EnvUtils.isMacOS()) {
        delta = -delta;
      }
      this.setVolume(Math.max(0, Math.min(3, this.client.volume + Utils.clamp(delta, -1, 1) * 0.01)));
      e.preventDefault();
      e.stopPropagation();
    });

    this.loadVolumeState();
  }

  setVolume(volume, dontSave = false) {
    if (volume < 0) {
      volume = 0;
    }

    if (volume > MAX_VOLUME) {
      volume = max;
    }

    if (volume === 0 && this.volume !== 0) {
      this.previousVolume = this.volume;
    }

    this.muted = volume === 0;
    this.volume = volume;

    this.updateVolumeBar(volume);

    if (!dontSave) {
      this.saveVolumeState();
    }

    this.emit('volume', volume);
  }

  muteToggle() {
    if (0 !== this.volume && !this.muted) {
      this.setVolume(0);
    } else {
      this.setVolume(this.previousVolume);
    }
  }

  onVolumeBarMouseDown(event) {
    const shiftVolume = (volumeBarX) => {
      const totalWidth = DOMElements.volumeControlBar.clientWidth;

      if (totalWidth) {
        const newVolume = volumeBarX / totalWidth * 3;

        if (newVolume < 0.025) {
          this.setVolume(0);
        } else if (newVolume > 2.975) {
          this.setVolume(3);
        } else if (newVolume > 0.975 && newVolume < 1.025) {
          this.setVolume(1);
        } else {
          this.setVolume(newVolume);
        }
      }
    };

    const onVolumeBarMouseMove = (event) => {
      const currentX = event.clientX - WebUtils.getOffsetLeft(DOMElements.volumeContainer) - 10;
      shiftVolume(currentX);
    };

    const onVolumeBarMouseUp = (event) => {
      document.removeEventListener('mousemove', onVolumeBarMouseMove);
      document.removeEventListener('touchmove', onVolumeBarMouseMove);
      document.removeEventListener('mouseup', onVolumeBarMouseUp);
      document.removeEventListener('touchend', onVolumeBarMouseUp);

      const currentX = event.clientX - WebUtils.getOffsetLeft(DOMElements.volumeContainer) - 10;

      if (!isNaN(currentX)) {
        shiftVolume(currentX);
      }
    };

    document.addEventListener('mouseup', onVolumeBarMouseUp);
    document.addEventListener('touchend', onVolumeBarMouseUp);
    document.addEventListener('mousemove', onVolumeBarMouseMove);
    document.addEventListener('touchmove', onVolumeBarMouseMove);
  }

  updateVolumeBar(volume) {
    const currentVolumeTag = DOMElements.currentVolume;
    const muteButtonTag = DOMElements.muteBtn;

    if (volume === 0) {
      muteButtonTag.classList.add('muted');
    } else {
      muteButtonTag.classList.remove('muted');
    }

    currentVolumeTag.style.width = (volume * 100) / MAX_VOLUME + '%';
    DOMElements.currentVolumeText.textContent = Math.round(volume * 100) + '%';

    DOMElements.volumeBanner.textContent = Math.round(volume * 100) + '%';
    if (volume === 1 || volume === 0) {
      DOMElements.volumeBanner.style.display = 'none';
    } else {
      DOMElements.volumeBanner.style.display = '';
    }
  }

  async loadVolumeState() {
    const state = await Utils.loadAndParseOptions('volumeState', {
      volume: 1,
    });
    this.setVolume(state.volume, true);
  }

  async saveVolumeState() {
    await Utils.setConfig('volumeState', JSON.stringify({
      volume: this.volume,
    }));
  }
}
