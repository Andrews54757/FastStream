import {DefaultPlayerEvents} from '../../enums/DefaultPlayerEvents.mjs';
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
    if (frame > 5 && !this.volumeBuffer[frame - 1]) {
      // interpolate. Find last non-zero frame within 5 frames
      let lastFrame = frame - 2;
      while (lastFrame > frame - 5 && !this.volumeBuffer[lastFrame]) {
        lastFrame--;
      }

      if (this.volumeBuffer[lastFrame]) {
        const diff = frame - lastFrame;
        const step = (volume - this.volumeBuffer[lastFrame]) / diff;
        for (let i = lastFrame + 1; i < frame; i++) {
          this.volumeBuffer[i] = this.volumeBuffer[lastFrame] + step * (i - lastFrame);
        }
      }
    }
    this.emit('volume', time, volume);
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

  setupAnalyzerNodeForMainPlayer(videoElement, audioSource, audioContext) {
    if (this.analyzerNodes.has('main')) {
      this.analyzerNodes.get('main').destroy();
    }

    const mainAnalyzerNode = new AudioAnalyzerNode();
    this.analyzerNodes.set('main', mainAnalyzerNode);
    mainAnalyzerNode.attach(videoElement, audioSource, audioContext);
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
      this.backgroundAnalyzerPlayer = null;
      if (newSource === this.backgroundAnalyzerSource) {
        console.log('[AudioAnalyzer] Background analyzer finished', completed ? 'successfully' : 'with errors');
        this.backgroundAnalyzerStatus = completed ? AnalyzerStatus.FINISHED : AnalyzerStatus.FAILED;
        this.client.interfaceController.updateMarkers();
      }
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
      this.backgroundAnalyzerPlayer.destroy();
      this.backgroundAnalyzerPlayer = null;
    }
    this.backgroundAnalyzerStatus = AnalyzerStatus.IDLE;
    this.client.interfaceController.updateMarkers();
  }

  async loadPlayer(source, doneRanges, onDone) {
    const player = await this.client.playerLoader.createPlayer(source.mode, this.client, {
      isAnalyzer: true,
      isAudioOnly: true,
    });

    await player.setup();

    const audioAnalyzerNode = new AudioAnalyzerNode();
    const audioContext = new AudioContext();
    const audioSource = audioContext.createMediaElementSource(player.getVideo());
    audioAnalyzerNode.attach(player.getVideo(), audioSource, audioContext);
    audioAnalyzerNode.on('vad', this.onVadFrameProcessed.bind(this));
    audioAnalyzerNode.on('volume', this.onVolumeFrameProcessed.bind(this));
    audioAnalyzerNode.configure({
      vad: false,
      volume: true,
    });

    player.on(DefaultPlayerEvents.MANIFEST_PARSED, () => {
      player.currentLevel = this.client.currentLevel;
      player.load();
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
    await player.setSource(source);
    return player;
  }

  runAnalyzerInBackground(player, doneRanges, onDone) {
    player.currentTime = this.client.currentTime;
    player.playbackRate = 12;
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

    const onEnd = () => {
      completed = true;
      player.destroy();
    };

    context.on(DefaultPlayerEvents.ENDED, ()=>{
      player.currentTime = 0;
    });

    const onAnimFrame = () => {
      if (destroyed) {
        return;
      }

      if (player.readyState >= 1 && player.paused) {
        player.play();
        player.currentTime = Math.max(player.currentTime - 1.5, 0);
        console.log('[AudioAnalyzer] Resumed analyzer');
      }
      requestAnimationFrame(onAnimFrame);

      clearTimeout(pauseTimeout);
      pauseTimeout = setTimeout(() => {
        if (!destroyed && player.readyState >= 1) {
          player.pause();
          console.log('[AudioAnalyzer] Paused analyzer');
        }
      }, 100);

      if (player.readyState < 2) {
        return;
      }

      const time = player.currentTime;
      const clientTime = this.client.currentTime;

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


      if (currentRange.end - currentRange.start >= player.duration - 10) {
        onEnd();
        return;
      }

      if (currentRange.end > time + 5) {
        player.currentTime = currentRange.end - 5;
        console.log('[AudioAnalyzer] Already analyzed range, seeking', player.currentTime, currentRange.end);
      } else if (currentRange.end < time) {
        currentRange.end = time;
      }

      if (clientTime < currentRange.start - 5 || clientTime > currentRange.end + 5) {
        if (!currentClientRange || Math.min(clientTime + 90, player.duration) > currentClientRange.end + 5 || clientTime + 5 < currentClientRange.start) {
          console.log('[AudioAnalyzer] Client time is outside of analyzed region, seeking', clientTime, currentRange.start, currentRange.end);
          player.currentTime = clientTime;
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
