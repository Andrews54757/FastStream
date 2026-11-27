import {EventEmitter} from '../modules/eventemitter.mjs';
import {Localize} from '../modules/Localize.mjs';
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
    this.touchVolumeBarExpanded = false;
    this.mutePointerStart = null;
    this.ignoreMuteClickUntil = 0;
  }

  setupUI() {
    DOMElements.volumeContainer.addEventListener('pointerdown', this.onVolumeBarPointerDown.bind(this));
    DOMElements.volumeContainer.addEventListener('dblclick', (e) => {
      this.setVolume(1);
      e.stopPropagation();
    });
    DOMElements.muteBtn.addEventListener('pointerdown', this.onMuteButtonPointerDown.bind(this));
    DOMElements.muteBtn.addEventListener('pointerup', this.onMuteButtonPointerUp.bind(this));
    DOMElements.muteBtn.addEventListener('pointercancel', ()=>{
      this.mutePointerStart = null;
    });
    DOMElements.muteBtn.addEventListener('click', this.onMuteButtonClick.bind(this));
    DOMElements.volumeBlock.tabIndex = 0;
    DOMElements.volumeBlock.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.setTouchVolumeBarExpanded(false);
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

    document.addEventListener('pointerdown', (e)=>{
      if (this.touchVolumeBarExpanded &&
          !DOMElements.volumeBlock.contains(e.target)) {
        this.setTouchVolumeBarExpanded(false);
      }
    });

    this.loadVolumeState();
  }

  setVolume(volume, dontSave = false) {
    if (volume < 0) {
      volume = 0;
    }

    if (volume > MAX_VOLUME) {
      volume = MAX_VOLUME;
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

  isTouchPointer(event) {
    return event.pointerType === 'touch' || event.pointerType === 'pen' ||
      event.sourceCapabilities?.firesTouchEvents === true;
  }

  onMuteButtonPointerDown(event) {
    if (!this.isTouchPointer(event) || event.button !== 0 ||
        event.isPrimary === false) {
      return;
    }
    DOMElements.muteBtn.setPointerCapture?.(event.pointerId);
    this.mutePointerStart = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
      pointerId: event.pointerId,
    };
  }

  onMuteButtonPointerUp(event) {
    if (!this.mutePointerStart || !this.isTouchPointer(event) ||
        this.mutePointerStart.pointerId !== event.pointerId) {
      return;
    }

    const start = this.mutePointerStart;
    this.mutePointerStart = null;
    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (distance > 16 || performance.now() - start.time > 800) {
      return;
    }

    this.ignoreMuteClickUntil = performance.now() + 1000;
    this.setTouchVolumeBarExpanded(!this.touchVolumeBarExpanded);
    event.stopPropagation();
  }

  onMuteButtonClick(event) {
    if (performance.now() < this.ignoreMuteClickUntil) {
      event.stopPropagation();
      return;
    }

    if (this.isTouchPointer(event)) {
      this.setTouchVolumeBarExpanded(!this.touchVolumeBarExpanded);
      event.stopPropagation();
      return;
    }

    this.setTouchVolumeBarExpanded(false);
    this.muteToggle();
  }

  setTouchVolumeBarExpanded(expanded) {
    this.touchVolumeBarExpanded = expanded;
    DOMElements.volumeBlock.classList.toggle('touch_expanded', expanded);

    if (expanded) {
      DOMElements.volumeBlock.focus();
      this.client.interfaceController?.showControlBar();
    } else if (document.activeElement === DOMElements.volumeBlock) {
      DOMElements.volumeBlock.blur();
    }
  }

  onVolumeBarPointerDown(event) {
    if (event.button !== 0 || event.isPrimary === false) return;

    const shiftVolume = (volumeBarX) => {
      const totalWidth = DOMElements.volumeControlBar.clientWidth;

      if (totalWidth) {
        const newVolume = volumeBarX / totalWidth * MAX_VOLUME;

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

    const updateFromPointer = (pointerEvent) => {
      const currentX = pointerEvent.clientX -
        WebUtils.getOffsetLeft(DOMElements.volumeContainer) - 10;
      shiftVolume(currentX);
    };

    const pointerId = event.pointerId;
    const pointerListeners = new AbortController();
    const onVolumeBarPointerMove = (pointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      updateFromPointer(pointerEvent);
      pointerEvent.preventDefault();
    };

    const onVolumeBarPointerUp = (pointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      pointerListeners.abort();
      updateFromPointer(pointerEvent);
    };

    const onVolumeBarPointerCancel = (pointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      pointerListeners.abort();
    };

    DOMElements.volumeContainer.setPointerCapture?.(pointerId);
    document.addEventListener('pointermove', onVolumeBarPointerMove, {
      signal: pointerListeners.signal,
    });
    document.addEventListener('pointerup', onVolumeBarPointerUp, {
      signal: pointerListeners.signal,
    });
    document.addEventListener('pointercancel', onVolumeBarPointerCancel, {
      signal: pointerListeners.signal,
    });

    updateFromPointer(event);
    event.stopPropagation();
    event.preventDefault();
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

    WebUtils.setLabels(DOMElements.volumeBlock, Localize.getMessage('player_volume_label', [Math.round(volume * 100)]));
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
