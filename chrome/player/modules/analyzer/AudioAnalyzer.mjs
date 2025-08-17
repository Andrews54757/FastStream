import {DefaultPlayerEvents} from '../../enums/DefaultPlayerEvents.mjs';
import {EnvUtils} from '../../utils/EnvUtils.mjs';
import {EventEmitter} from '../eventemitter.mjs';
import {AudioAnalyzerNode} from './AudioAnalyzerNode.mjs';

const AnalyzerStatus = {
  IDLE: 'idle',
  RUNNING: 'running',
  FINISHED: 'finished',
  FAILED: 'failed',
};

export class AudioAnalyzer extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.outputRate = 10;
    this.vadBuffer = [];
    this.volumeBuffer = [];

    this.vadNeededBy = [];
    this.volumeNeededBy = [];
    this.backgroundNeededBy = [];

    this.analyzerNodes = new Map();

    this.backgroundAnalyzerStatus = AnalyzerStatus.IDLE;
    this.backgroundDoneRanges = [];
    this.backgroundAnalyzerEnabled = true;
  }

  onVadFrameProcessed(time, isSpeechProb) {
    const frame = Math.floor(time * this.outputRate);
    this.vadBuffer[frame] = isSpeechProb;
    this.emit('vad', time, isSpeechProb);
  }

  onVolumeFrameProcessed(time, volume) {
    const frame = Math.floor(time * this.outputRate);
    this.volumeBuffer[frame] = volume;
    const interpMax = 8;
    let interp = 0;
    if (frame >= 2 && !this.volumeBuffer[frame - 1]) {
      // interpolate. Find last non-zero frame within 5 frames
      let lastFrame = frame - 2;
      const min = Math.max(0, frame - interpMax);
      while (lastFrame > min && !this.volumeBuffer[lastFrame]) {
        lastFrame--;
      }
      if (this.volumeBuffer[lastFrame]) {
        interp = frame - lastFrame - 1;
        const diff = frame - lastFrame;
        const step = (volume - this.volumeBuffer[lastFrame]) / diff;
        for (let i = lastFrame + 1; i < frame; i++) {
          this.volumeBuffer[i] = this.volumeBuffer[lastFrame] + step * (i - lastFrame);
        }
      }
    }
    this.emit('volume', time, volume, interp);
  }

  addVadDependent(dependent) {
    if (this.vadNeededBy.includes(dependent)) return;
    this.vadNeededBy.push(dependent);

    this.sendConfigToAnalyzerNodes();
  }

  removeVadDependent(dependent) {
    const index = this.vadNeededBy.indexOf(dependent);
    if (index !== -1) {
      this.vadNeededBy.splice(index, 1);
    }

    this.sendConfigToAnalyzerNodes();
  }

  addVolumeDependent(dependent) {
    if (this.volumeNeededBy.includes(dependent)) return;
    this.volumeNeededBy.push(dependent);

    this.sendConfigToAnalyzerNodes();
  }

  removeVolumeDependent(dependent) {
    const index = this.volumeNeededBy.indexOf(dependent);
    if (index !== -1) {
      this.volumeNeededBy.splice(index, 1);
    }

    this.sendConfigToAnalyzerNodes();
  }

  addBackgroundDependent(dependent) {
    if (this.backgroundNeededBy.includes(dependent)) return;
    this.backgroundNeededBy.push(dependent);
  }

  removeBackgroundDependent(dependent) {
    const index = this.backgroundNeededBy.indexOf(dependent);
    if (index !== -1) {
      this.backgroundNeededBy.splice(index, 1);
    }

    if (!this.shouldRunAnalyzerInBackground()) {
      this.stopBackgroundAnalyzer();
    }
  }

  sendConfigToAnalyzerNodes() {
    const vad = this.vadNeededBy.length > 0;
    const volume = this.volumeNeededBy.length > 0;

    this.analyzerNodes.forEach((node) => {
      node.configure({vad, volume});
    });
  }

  reset() {
    try {
      this.vadBuffer = [];
      this.volumeBuffer = [];
      this.backgroundDoneRanges = [];

      this.analyzerNodes.forEach((node) => {
        node.destroy();
      });
      this.analyzerNodes.clear();

      this.stopBackgroundAnalyzer();
      this.backgroundAnalyzerStatus = AnalyzerStatus.IDLE;
    } catch (e) {
      console.error(e);
    }
  }

  getVadData() {
    return this.vadBuffer;
  }

  getVolumeData() {
    return this.volumeBuffer;
  }

  getOutputRate() {
    return this.outputRate;
  }

  setupAnalyzerNodeForMainPlayer(videoElement, audioOutputNode, audioContext, getTime) {
    if (this.analyzerNodes.has('main')) {
      this.analyzerNodes.get('main').destroy();
    }

    const mainAnalyzerNode = new AudioAnalyzerNode();
    this.analyzerNodes.set('main', mainAnalyzerNode);
    mainAnalyzerNode.attach(videoElement, audioOutputNode, audioContext, getTime);
    mainAnalyzerNode.on('vad', this.onVadFrameProcessed.bind(this));
    mainAnalyzerNode.on('volume', this.onVolumeFrameProcessed.bind(this));

    mainAnalyzerNode.configure({
      vad: this.vadNeededBy.length > 0,
      volume: this.volumeNeededBy.length > 0,
    });
  }

  async startBackgroundAnalyzer() {
    if (!this.client.player || this.backgroundAnalyzerStatus !== AnalyzerStatus.IDLE) {
      return;
    }

    if (EnvUtils.isSafari()) {
      console.log('[AudioAnalyzer] Background analyzer is not supported on Safari');
      return;
    }

    const newSource = this.client.player.getSource();
    if (this.backgroundAnalyzerSource === newSource) {
      return;
    }

    this.backgroundAnalyzerSource = newSource;

    if (this.backgroundAnalyzerPlayer) {
      this.backgroundAnalyzerPlayer.destroy();
      this.backgroundAnalyzerPlayer = null;
    }

    console.log('[AudioAnalyzer] Starting background analyzer');

    const backgroundAnalyzerPlayer = await this.loadPlayer(this.backgroundAnalyzerSource, this.backgroundDoneRanges, (completed) => {
      if (this.backgroundAnalyzerPlayer === backgroundAnalyzerPlayer) {
        console.log('[AudioAnalyzer] Background analyzer finished', completed ? 'successfully' : 'with errors');
        this.backgroundAnalyzerStatus = completed ? AnalyzerStatus.FINISHED : AnalyzerStatus.FAILED;
        this.client.interfaceController.updateMarkers();
      }
      this.backgroundAnalyzerPlayer = null;
    });

    if (newSource !== this.backgroundAnalyzerSource) {
      backgroundAnalyzerPlayer.destroy();
      return;
    }

    this.backgroundAnalyzerStatus = AnalyzerStatus.RUNNING;
    this.backgroundAnalyzerPlayer = backgroundAnalyzerPlayer;
  }

  stopBackgroundAnalyzer() {
    this.backgroundAnalyzerSource = null;
    if (this.backgroundAnalyzerPlayer) {
      const player = this.backgroundAnalyzerPlayer;
      this.backgroundAnalyzerPlayer = null;
      player.destroy();
    }
    if (this.backgroundAnalyzerStatus === AnalyzerStatus.RUNNING) {
      this.backgroundAnalyzerStatus = AnalyzerStatus.IDLE;
    }
    this.client.interfaceController.updateMarkers();
  }

  async loadPlayer(source, doneRanges, onDone) {
    const player = await this.client.playerLoader.createPlayer(source.mode, this.client, {
      isAnalyzer: true,
      isAudioOnly: true,
    });

    await player.setup();

    const audioAnalyzerNode = new AudioAnalyzerNode();
    const audioContext = new AudioContext({
      sinkId: {type: 'none'},
    });
    const audioSource = audioContext.createMediaElementSource(player.getVideo());
    audioAnalyzerNode.attach(player.getVideo(), audioSource, audioContext);
    audioAnalyzerNode.on('vad', this.onVadFrameProcessed.bind(this));
    audioAnalyzerNode.on('volume', this.onVolumeFrameProcessed.bind(this));
    audioAnalyzerNode.configure({
      vad: false,
      volume: true,
    });

    player.on(DefaultPlayerEvents.MANIFEST_PARSED, () => {
      player.setCurrentVideoLevelID(this.client.getCurrentVideoLevelID());
      player.setCurrentAudioLevelID(this.client.getCurrentAudioLevelID());
    });

    const onLoadMeta = () => {
      player.off(DefaultPlayerEvents.LOADEDMETADATA, onLoadMeta);
      this.runAnalyzerInBackground(player, doneRanges, (completed)=>{
        audioAnalyzerNode.destroy();
        audioSource.disconnect();
        audioContext.close();
        onDone(completed);
      });
    };

    player.on(DefaultPlayerEvents.LOADEDMETADATA, onLoadMeta);

    this.client.attachProcessorsToPlayer(player);

    await player.setSource(source);
    return player;
  }

  runAnalyzerInBackground(player, doneRanges, onDone) {
    const offsetTarget = -35;
    const time = this.client.currentTime;
    let offset = this.client.isRegionBuffered(time + offsetTarget, time) ? offsetTarget : 0;
    player.currentTime = Math.max(time + offset, 0);
    player.playbackRate = EnvUtils.isChrome() ? 16 : 8; // Firefox mutes audio at high playback rates
    player.loop = true;
    player.play();

    let destroyed = false;
    let completed = false;
    const context = player.createContext();
    context.on(DefaultPlayerEvents.DESTROYED, () => {
      context.destroy();
      destroyed = true;
      onDone(completed);
    });


    let pauseTimeout;

    if (!doneRanges) {
      doneRanges = [];
    }

    let currentRange = null;
    let currentRangeIndex = 0;
    let currentClientRange = null;
    let lastOffsetCalc = Date.now();

    const onEnd = () => {
      completed = true;
      player.destroy();
    };

    context.on(DefaultPlayerEvents.ENDED, ()=>{
      player.currentTime = 0;
    });

    const pauseHandler = () => {
      if (!destroyed && player.readyState >= 1) {
        player.pause();
        console.log('[AudioAnalyzer] Paused analyzer');
      }
    };

    const onAnimFrame = () => {
      if (destroyed) {
        return;
      }
      const time = player.currentTime;
      const clientTimeOriginal = this.client.currentTime;

      if (player.paused) {
        if (player.readyState >= 1 && Math.abs(time - clientTimeOriginal) <= 40) {
          player.play();
          console.log('[AudioAnalyzer] Resumed analyzer');
        }
      } else {
        if (Math.abs(time - clientTimeOriginal) > 60) {
          player.pause();
          console.log('[AudioAnalyzer] Outside of bounds, pausing');
        }
      }

      clearTimeout(pauseTimeout);
      pauseTimeout = setTimeout(pauseHandler, 100);

      requestAnimationFrame(onAnimFrame);

      if (player.readyState < 2) {
        return;
      }

      const now = Date.now();
      if (now - lastOffsetCalc > 1000) {
        lastOffsetCalc = now;
        offset = this.client.isRegionBuffered(clientTimeOriginal + offsetTarget, clientTimeOriginal) ? offsetTarget : 0;
      }

      const clientTime = Math.max(clientTimeOriginal + offset, 0);

      if (doneRanges.length === 0) {
        currentRange = null;
        currentClientRange = null;
      }

      if (!currentRange || time < currentRange.start || time > currentRange.end + 16) {
        currentRangeIndex = -1;
        for (let i = 0; i < doneRanges.length; i++) {
          if (doneRanges[i].start <= time && doneRanges[i].end >= time) {
            currentRange = doneRanges[i];
            currentRangeIndex = i;
            break;
          }
        }

        if (currentRangeIndex === -1) {
          currentRange = {start: time, end: time};
          // insert in order
          currentRangeIndex = -1;
          for (let i = 0; i < doneRanges.length; i++) {
            if (doneRanges[i].start > time) {
              doneRanges.splice(i, 0, currentRange);
              currentRangeIndex = i;
              break;
            }
          }
          if (currentRangeIndex === -1) {
            doneRanges.push(currentRange);
            currentRangeIndex = doneRanges.length - 1;
          }
        }

        // check if ranges need to merge (if they are close enough)
        if (currentRangeIndex > 0 && currentRange.start - doneRanges[currentRangeIndex - 1].end < 0) {
          doneRanges[currentRangeIndex - 1].end = Math.max(doneRanges[currentRangeIndex - 1].end, currentRange.end);
          doneRanges.splice(currentRangeIndex, 1);
          currentRangeIndex--;
          currentRange = doneRanges[currentRangeIndex];
        }
      }

      if (currentRangeIndex < doneRanges.length - 1 && doneRanges[currentRangeIndex + 1].start - currentRange.end < 0) {
        currentRange.end = Math.max(currentRange.end, doneRanges[currentRangeIndex + 1].end);
        doneRanges.splice(currentRangeIndex + 1, 1);
      }


      if (currentRange.end - currentRange.start >= player.duration - 5) {
        onEnd();
        return;
      }

      if (currentRange.end > time + 10) {
        player.currentTime = currentRange.end - 5;
        console.log('[AudioAnalyzer] Already analyzed range, seeking', player.currentTime, currentRange.end);
      } else if (currentRange.end < time) {
        currentRange.end = time;
      }

      if (clientTime < currentRange.start - 5 || clientTime > currentRange.end + 5) {
        if (!currentClientRange || Math.min(clientTime + 90, player.duration) > currentClientRange.end + 5 || clientTime + 5 < currentClientRange.start) {
          console.log('[AudioAnalyzer] Client time is outside of analyzed region, seeking', clientTime, currentRange.start, currentRange.end);
          offset = this.client.isRegionBuffered(clientTimeOriginal + offsetTarget, clientTimeOriginal) ? offsetTarget : 0;
          player.currentTime = Math.max(clientTimeOriginal + offset, 0);
          currentRange = null;
        }
      } else {
        currentClientRange = currentRange;
      }

      this.client.interfaceController.updateMarkers();
    };

    requestAnimationFrame(onAnimFrame);

    return doneRanges;
  }

  getMarkerPosition() {
    if (this.backgroundAnalyzerPlayer && this.backgroundAnalyzerStatus === AnalyzerStatus.RUNNING) {
      return this.backgroundAnalyzerPlayer.currentTime;
    }
    return null;
  }

  shouldRunAnalyzerInBackground() {
    if (!this.backgroundAnalyzerEnabled) {
      return false;
    }
    return this.backgroundNeededBy.length > 0;
  }

  enableBackground() {
    this.backgroundAnalyzerEnabled = true;
  }

  disableBackground() {
    this.backgroundAnalyzerEnabled = false;
    this.stopBackgroundAnalyzer();
  }

  setLevel(videoLevel, audioLevel) {
    if (this.backgroundAnalyzerPlayer) {
      const changedVideo = this.backgroundAnalyzerPlayer.getCurrentVideoLevelID() !== videoLevel;
      const changedAudio = this.backgroundAnalyzerPlayer.getCurrentAudioLevelID() !== audioLevel;
      this.backgroundAnalyzerPlayer.setCurrentVideoLevelID(videoLevel);
      this.backgroundAnalyzerPlayer.setCurrentAudioLevelID(audioLevel);
      if (audioLevel === null ? changedVideo : changedAudio) {
        this.backgroundDoneRanges.length = 0;
        this.vadBuffer = [];
        this.volumeBuffer = [];
        if (this.backgroundAnalyzerStatus !== AnalyzerStatus.RUNNING) {
          this.reset();
        }
        this.emit('audioLevelChanged', audioLevel);
      }
    }
  }

  /**
   * Must only run on trusted events to ensure the player runs.
   */
  updateBackgroundAnalyzer() {
    if (this.shouldRunAnalyzerInBackground()) {
      this.startBackgroundAnalyzer();
    } else {
      this.stopBackgroundAnalyzer();
    }
  }
}
