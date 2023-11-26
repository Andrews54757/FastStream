import {DefaultKeybinds} from '../../options/defaults/DefaultKeybinds.mjs';
import {EventEmitter} from '../modules/eventemitter.mjs';
import {WebUtils} from '../utils/WebUtils.mjs';
import {DOMElements} from './DOMElements.mjs';

export class KeybindManager extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.hidden = false;
    this.keybindMap = new Map();
    this.setup();
  }
  setup() {
    for (const keybind in DefaultKeybinds) {
      if (Object.hasOwn(DefaultKeybinds, keybind)) {
        this.keybindMap.set(keybind, DefaultKeybinds[keybind]);
      }
    }

    document.addEventListener('keydown', (e) => {
      this.onKeyDown(e);
    });

    let shouldPlay = false;
    this.on('HidePlayer', (e) => {
      if (this.hidden) {
        DOMElements.playerContainer.classList.remove('player-hidden');
        this.hidden = false;
        if (shouldPlay) {
          this.client.player?.play();
        }
      } else {
        DOMElements.playerContainer.classList.add('player-hidden');

        this.hidden = true;
        shouldPlay = this.client.persistent.playing;
        this.client.player?.pause();
      }
    });

    this.on('GoToStart', (e) => {
      this.client.currentTime = 0;
    });

    this.on('VolumeUp', (e) => {
      this.client.volume = Math.min(this.client.volume + 0.10, 3);
    });

    this.on('VolumeDown', (e) => {
      this.client.volume = Math.max(this.client.volume - 0.10, 0);
    });

    this.on('SeekForward', (e) => {
      this.client.setSeekSave(false);
      this.client.currentTime += this.client.options.seekStepSize;
      this.client.setSeekSave(true);
    });

    this.on('SeekBackward', (e) => {
      this.client.setSeekSave(false);
      this.client.currentTime += -this.client.options.seekStepSize;
      this.client.setSeekSave(true);
    });

    this.on('SeekForwardSmall', (e) => {
      this.client.setSeekSave(false);
      this.client.currentTime += this.client.options.seekStepSize / 10;
      this.client.setSeekSave(true);
    });

    this.on('SeekBackwardSmall', (e) => {
      this.client.setSeekSave(false);
      this.client.currentTime += -this.client.options.seekStepSize / 10;
      this.client.setSeekSave(true);
    });

    this.on('PlayPause', (e) => {
      this.client.interfaceController.playPauseToggle();
    });

    this.on('Fullscreen', (e) => {
      this.client.interfaceController.fullscreenToggle();
      this.client.interfaceController.hideControlBarOnAction(2000);
    });

    this.on('SeekForwardLarge', (e) => {
      this.client.setSeekSave(false);
      this.client.currentTime += this.client.options.seekStepSize * 5;
      this.client.setSeekSave(true);
    });

    this.on('SeekBackwardLarge', (e) => {
      this.client.setSeekSave(false);
      this.client.currentTime += -this.client.options.seekStepSize * 5;
      this.client.setSeekSave(true);
    });

    this.on('IncreasePlaybackRate', (e) => {
      this.client.playbackRate = Math.min(this.client.playbackRate + 0.1, 8);
    });

    this.on('DecreasePlaybackRate', (e) => {
      this.client.playbackRate = Math.max(this.client.playbackRate - 0.1, 0.1);
    });

    this.on('UndoSeek', (e) => {
      this.client.undoSeek();
    });

    this.on('RedoSeek', (e) => {
      this.client.redoSeek();
    });

    this.on('ResetFailed', (e) => {
      this.client.resetFailed();
    });

    this.on('RemoveDownloader', (e) => {
      if (this.client.downloadManager.downloaders.length > 0) {
        this.client.downloadManager.removeDownloader();
        this.client.interfaceController.updateFragmentsLoaded();
      }
    });

    this.on('AddDownloader', (e) => {
      if (this.client.downloadManager.downloaders.length < 6) {
        this.client.downloadManager.addDownloader();
        this.client.interfaceController.updateFragmentsLoaded();
      }
    });

    this.on('SkipIntroOutro', (e) => {
      this.client.interfaceController.skipSegment();
    });

    this.on('SubtrackShiftRight', (e) => {
      this.client.subtitleSyncer.shiftSubtitles(0.2);
    });

    this.on('SubtrackShiftLeft', (e) => {
      this.client.subtitleSyncer.shiftSubtitles(-0.2);
    });

    this.on('keybind', (keybind, e) => {
      // console.log("Keybind", keybind);
    });
  }

  setKeybinds(keybinds) {
    for (const keybind in keybinds) {
      if (this.keybindMap.has(keybind)) {
        this.keybindMap.set(keybind, keybinds[keybind]);
      }
    }
  }

  eventToKeybind(e) {
    return this.eventToKeybinds(e)[0];
  }

  eventToKeybinds(e) {
    const keyString = WebUtils.getKeyString(e);
    const results = [];
    for (const [key, value] of this.keybindMap.entries()) {
      if (value === keyString) {
        results.push(key);
      }
    }
    return results;
  }

  onKeyDown(e) {
    const keybinds = this.eventToKeybinds(e);

    if (keybinds.length !== 0) {
      this.emit('keybind', keybinds, e);
      keybinds.forEach((keybind) => {
        this.emit(keybind, e);
      });
      e.preventDefault();
    }
  }
}
