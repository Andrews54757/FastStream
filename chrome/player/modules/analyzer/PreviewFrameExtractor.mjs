import {DefaultPlayerEvents} from '../../enums/DefaultPlayerEvents.mjs';
import {EventEmitter} from '../eventemitter.mjs';

const AnalyzerStatus = {
  IDLE: 'idle',
  RUNNING: 'running',
  FINISHED: 'finished',
  FAILED: 'failed',
};

const SHOULD_STORE_AS_BLOB = true;

export class PreviewFrameExtractor extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.outputRateInv = 2;
    this.frameBuffer = [];

    this.backgroundNeededBy = [];

    this.backgroundAnalyzerStatus = AnalyzerStatus.IDLE;
    this.backgroundDoneRanges = [];
    this.backgroundAnalyzerEnabled = true;

    this.extractorCanvas = document.createElement('canvas');
    this.extractorContext = this.extractorCanvas.getContext('2d');
  }

  getFrameBuffer() {
    return this.frameBuffer;
  }

  getOutputRateInv() {
    return this.outputRateInv;
  }

  addBackgroundDependent(dependent) {
    if (this.backgroundNeededBy.includes(dependent)) return;
    this.backgroundNeededBy.push(dependent);

    this.updateBackground();
  }

  removeBackgroundDependent(dependent) {
    const index = this.backgroundNeededBy.indexOf(dependent);
    if (index !== -1) {
      this.backgroundNeededBy.splice(index, 1);
    }

    this.updateBackground();
  }

  updateBackground() {
    if (this.shouldRunAnalyzerInBackground()) {
      this.startBackgroundAnalyzer();
    } else {
      this.stopBackgroundAnalyzer();
    }
  }

  reset() {
    try {
      if (SHOULD_STORE_AS_BLOB) {
        this.frameBuffer.forEach((frame) => {
          URL.revokeObjectURL(frame.url);
        });
      }
      this.frameBuffer = [];
      this.backgroundAnalyzerSource = null;
      this.backgroundDoneRanges = [];
      this.stopBackgroundAnalyzer();
      this.backgroundAnalyzerStatus = AnalyzerStatus.IDLE;
    } catch (e) {
      console.error(e);
    }
  }


  async startBackgroundAnalyzer() {
    if (!this.client.player || this.backgroundAnalyzerStatus !== AnalyzerStatus.IDLE) {
      return;
    }

    const video = this.client.player?.getVideo();
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
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

    console.log('[FrameExtractor] Starting background analyzer');

    const backgroundAnalyzerPlayer = await this.loadPlayer(this.backgroundAnalyzerSource, this.backgroundDoneRanges, (completed) => {
      if (backgroundAnalyzerPlayer === this.backgroundAnalyzerPlayer) {
        console.log('[FrameExtractor] Background analyzer finished', completed ? 'successfully' : 'with errors');
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
    });

    await player.setup();

    player.on(DefaultPlayerEvents.MANIFEST_PARSED, () => {
      player.currentLevel = this.client.currentLevel;
      player.load();
    });

    const onLoadMeta = () => {
      player.off(DefaultPlayerEvents.LOADEDMETADATA, onLoadMeta);
      this.runAnalyzerInBackground(player, doneRanges, (completed)=>{
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
    player.volume = 0;
    player.muted = true;

    const video = player.getVideo();
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const aspect = videoWidth / videoHeight;
    const height = 64;
    const width = Math.round(height * aspect);
    this.extractorCanvas.width = width;
    this.extractorCanvas.height = height;

    let destroyed = false;
    let completed = false;
    const context = player.createContext();
    context.on(DefaultPlayerEvents.DESTROYED, () => {
      context.destroy();
      destroyed = true;
      onDone(completed);
    });

    if (videoWidth === 0 || videoHeight === 0) {
      console.error('[FrameExtractor] Invalid video dimensions');
      player.destroy();
      return;
    }

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

    let paused = false;
    const pauseHandler = () => {
      if (!destroyed && !paused ) {
        paused = true;
        console.log('[FrameExtractor] Paused analyzer');
      }
    };

    const onAnimFrame = () => {
      if (destroyed) {
        return;
      }

      const time = player.currentTime;
      const clientTimeOriginal = this.client.currentTime;

      if (paused) {
        if (player.readyState >= 1 && Math.abs(time - clientTimeOriginal) <= 40) {
          paused = false;
          console.log('[FrameExtractor] Resumed analyzer');
        }
      } else {
        if (Math.abs(time - clientTimeOriginal) > 60) {
          paused = true;
          console.log('[FrameExtractor] Outside of bounds, pausing');
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

      const frame = Math.floor(time / this.outputRateInv);

      if (!this.frameBuffer[frame]) {
        this.extractorContext.drawImage(video, 0, 0, this.extractorCanvas.width, this.extractorCanvas.height);
        const url = this.extractorCanvas.toDataURL('image/png');
        if (SHOULD_STORE_AS_BLOB) {
          // convert to blob
          const byteString = atob(url.split(',')[1]);
          const buffer = new ArrayBuffer(byteString.length);
          const array = new Uint8Array(buffer);
          for (let i = 0; i < byteString.length; i++) {
            array[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([buffer], {type: 'image/png'});
          this.frameBuffer[frame] = {
            blob,
            url: URL.createObjectURL(blob),
          };
        } else {
          this.frameBuffer[frame] = {
            url,
          };
        }
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

      let timeSet = false;
      if (currentRange.end > time + 10) {
        player.currentTime = Math.floor((currentRange.end - 5) / this.outputRateInv) * this.outputRateInv;
        timeSet = true;
        console.log('[FrameExtractor] Already analyzed range, seeking', player.currentTime, currentRange.end);
      } else if (currentRange.end < time) {
        currentRange.end = time;
      }

      if (clientTime < currentRange.start - 5 || clientTime > currentRange.end + 5) {
        if (!currentClientRange || Math.min(clientTime + 90, player.duration) > currentClientRange.end + 5 || clientTime + 5 < currentClientRange.start) {
          console.log('[FrameExtractor] Client time is outside of analyzed region, seeking', clientTime, currentRange.start, currentRange.end);
          offset = this.client.isRegionBuffered(clientTimeOriginal + offsetTarget, clientTimeOriginal) ? offsetTarget : 0;
          player.currentTime = Math.floor(Math.max(clientTimeOriginal + offset, 0) / this.outputRateInv) * this.outputRateInv;
          timeSet = true;
          currentRange = null;
        }
      } else {
        currentClientRange = currentRange;
      }

      if (!timeSet && !paused) {
        player.currentTime = (1 + Math.floor(time / this.outputRateInv)) * this.outputRateInv;
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

    this.updateBackground();
  }

  disableBackground() {
    this.backgroundAnalyzerEnabled = false;
    this.updateBackground();
  }

  setLevel(level, audioLevel) {
    if (this.backgroundAnalyzerPlayer) {
      this.backgroundAnalyzerPlayer.currentLevel = level;
      this.backgroundAnalyzerPlayer.currentAudioLevel = audioLevel;
    }
  }

  getMarkerPosition() {
    if (this.backgroundAnalyzerPlayer && this.backgroundAnalyzerStatus === AnalyzerStatus.RUNNING) {
      return this.backgroundAnalyzerPlayer.currentTime;
    }
    return null;
  }
}
