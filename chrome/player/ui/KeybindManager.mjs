import {DefaultKeybinds} from '../../options/defaults/DefaultKeybinds.mjs';
import {EventEmitter} from '../modules/eventemitter.mjs';
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
      this.client.currentTime += 2;
      this.client.setSeekSave(true);
    });

    this.on('SeekBackward', (e) => {
      this.client.setSeekSave(false);
      this.client.currentTime += -2;
      this.client.setSeekSave(true);
    });

    this.on('SeekForwardSmall', (e) => {
      this.client.setSeekSave(false);
      this.client.currentTime += 0.2;
      this.client.setSeekSave(true);
    });

    this.on('SeekBackwardSmall', (e) => {
      this.client.setSeekSave(false);
      this.client.currentTime += -0.2;
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
      this.client.currentTime += 10;
      this.client.setSeekSave(true);
    });

    this.on('SeekBackwardLarge', (e) => {
      this.client.setSeekSave(false);
      this.client.currentTime += -10;
      this.client.setSeekSave(true);
    });

    this.on('UndoSeek', (e) => {
      this.client.undoSeek();
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
      this.client.interfaceController.skipIntroOutro();
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
  getKeyString(e) {
    const metaPressed = e.metaKey && e.key !== 'Meta';
    const ctrlPressed = e.ctrlKey && e.key !== 'Control';
    const altPressed = e.altKey && e.key !== 'Alt';
    const shiftPressed = e.shiftKey && e.key !== 'Shift';
    const key = e.key === ' ' ? 'Space' : e.code;

    return (metaPressed ? 'Meta+' : '') + (ctrlPressed ? 'Control+' : '') + (altPressed ? 'Alt+' : '') + (shiftPressed ? 'Shift+' : '') + key;
  }

  eventToKeybind(e) {
    const keyString = this.getKeyString(e);
    let keybind = null;
    for (const [key, value] of this.keybindMap.entries()) {
      if (value === keyString) {
        keybind = key;
        break;
      }
    }
    return keybind;
  }

  onKeyDown(e) {
    const keybind = this.eventToKeybind(e);

    if (keybind) {
      this.emit('keybind', keybind, e);
      this.emit(keybind, e);
      e.preventDefault();
    }
  }
}
