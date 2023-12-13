import {AnalyzerEvents} from '../../enums/AnalyzerEvents.mjs';
import {DefaultPlayerEvents} from '../../enums/DefaultPlayerEvents.mjs';
import {DownloadStatus} from '../../enums/DownloadStatus.mjs';
import {PlayerModes} from '../../enums/PlayerModes.mjs';
import {EventEmitter} from '../eventemitter.mjs';
import {EnvUtils} from '../../utils/EnvUtils.mjs';
import {VideoAligner} from './VideoAligner.mjs';

const AnalyzerStatus = {
  IDLE: 'idle',
  RUNNING: 'running',
  FINISHED: 'finished',
  FAILED: 'failed',
};

export class VideoAnalyzer extends EventEmitter {
  constructor(client, options) {
    super();
    this.options = {
      introCutoff: 5 * 60,
      outroCutoff: 5 * 60,
      ...options,
    };
    this.client = client;

    this.introAligner = new VideoAligner();
    this.outroAligner = new VideoAligner();

    this.introAligner.on(AnalyzerEvents.MATCH, (aligner) => {
      this.emit(AnalyzerEvents.INTRO_MATCH, this);
      this.emit(AnalyzerEvents.MATCH, this);
    });

    this.outroAligner.on(AnalyzerEvents.MATCH, (aligner) => {
      this.emit(AnalyzerEvents.OUTRO_MATCH, this);
      this.emit(AnalyzerEvents.MATCH, this);
    });

    this.introPlayer = null;
    this.outroPlayer = null;

    this.introStatus = AnalyzerStatus.IDLE;
    this.outroStatus = AnalyzerStatus.IDLE;

    this.lastAnalyzerSave = 0;

    this.enabled = true;
  }


  getOutro() {
    if (!this.enabled) return null;
    return this.outroAligner.getMatch();
  }

  getIntro() {
    if (!this.enabled) return null;
    return this.introAligner.getMatch();
  }

  reset() {
    this.destroyPlayers();
    this.introStatus = AnalyzerStatus.IDLE;
    this.outroStatus = AnalyzerStatus.IDLE;
  }

  saveAnalyzerData() {
    if (!this.introAligner.hasMemoryChanges && !this.outroAligner.hasMemoryChanges) {
      return;
    }

    const now = Date.now();
    if (now - this.lastAnalyzerSave <= 1000 * 10) {
      return;
    }
    this.lastAnalyzerSave = now;

    if (EnvUtils.isExtension()) {
      this.introAligner.unsetChangesFlag();
      this.outroAligner.unsetChangesFlag();
      chrome.runtime.sendMessage({
        type: 'analyzerData',
        data: {
          intro: this.introAligner.getMemoryForSave(),
          outro: this.outroAligner.getMemoryForSave(),
        },
      });
    }
  }

  loadAnalyzerData(data) {
    console.log('[VideoAnalyzer] Loading analyzer data');
    if (data.intro) {
      this.introAligner.loadMemoryFromSave(data.intro);
    }
    if (data.outro) {
      this.outroAligner.loadMemoryFromSave(data.outro);
    }
  }

  destroyPlayers() {
    if (this.introPlayer) {
      this.introPlayer.destroy();
      this.introPlayer = null;
    }

    if (this.outroPlayer) {
      this.outroPlayer.destroy();
      this.outroPlayer = null;
    }
  }

  async update() {
    if (!this.shouldAnalyze()) return;
    const duration = this.client.duration;
    const introStart = 0;
    const introEnd = Math.min(introStart + this.options.introCutoff, duration);
    const outroStart = Math.max(duration - this.options.outroCutoff, introEnd);
    const outroEnd = duration;

    this.introAligner.setRange(introStart, introEnd);
    this.outroAligner.setRange(outroStart, outroEnd);

    if (this.outroStatus !== AnalyzerStatus.RUNNING && this.introStatus === AnalyzerStatus.IDLE && introEnd - introStart > 30) {
      if (this.shouldLoadPlayer(introStart, introEnd)) {
        console.log('[VideoAnalyzer] Running intro finder in background', introStart, introEnd);
        this.introStatus = AnalyzerStatus.RUNNING;
        const reserved = this.referenceFragments(introStart, introEnd);
        this.introPlayer = await this.loadPlayer(this.introAligner, introStart, introEnd, (completed) => {
          this.introStatus = completed ? AnalyzerStatus.FINISHED : AnalyzerStatus.FAILED;
          this.introPlayer = null;
          console.log('[VideoAnalyzer] Intro finder completed', completed);
          this.dereferenceFragments(reserved);
          this.client.interfaceController.updateMarkers();
        });

        if (!this.introPlayer) {
          this.introStatus = AnalyzerStatus.FAILED;
          console.log('[VideoAnalyzer] Intro finder failed');
          this.client.interfaceController.updateMarkers();
        }
      }
    }

    if (this.introStatus !== AnalyzerStatus.RUNNING && this.outroStatus === AnalyzerStatus.IDLE && outroEnd - outroStart > 30) {
      if (this.shouldLoadPlayer(outroStart, outroEnd)) {
        console.log('[VideoAnalyzer] Running outro finder in background', outroStart, outroEnd);
        this.outroStatus = AnalyzerStatus.RUNNING;
        const reserved = this.referenceFragments(outroStart, outroEnd);
        this.outroPlayer = await this.loadPlayer(this.outroAligner, outroStart, outroEnd, (completed) => {
          this.outroStatus = completed ? AnalyzerStatus.FINISHED : AnalyzerStatus.FAILED;
          this.outroPlayer = null;
          console.log('[VideoAnalyzer] Outro finder completed', completed);
          this.dereferenceFragments(reserved);
          this.client.interfaceController.updateMarkers();
        });

        if (!this.outroPlayer) {
          this.outroStatus = AnalyzerStatus.FAILED;
          console.log('[VideoAnalyzer] Outro finder failed');
          this.client.interfaceController.updateMarkers();
        }
      }
    }
  }

  isRunning() {
    return this.introStatus === AnalyzerStatus.RUNNING || this.outroStatus === AnalyzerStatus.RUNNING;
  }

  destroy() {
    this.destroyPlayers();
  }

  isModeSupported() {
    const mode = this.source.mode;
    const supportedModes = [
      PlayerModes.ACCELERATED_HLS,
      PlayerModes.ACCELERATED_MP4,
      PlayerModes.ACCELERATED_DASH,
    ];
    return supportedModes.includes(mode);
  }

  shouldLoadPlayer(timeStart, timeEnd) {
    if (this.isModeSupported()) {
      const fragments = this.client.fragments;
      if (!fragments || fragments.length === 0) return false;

      if (this.client.currentLevel === -1) return false;

      const start = fragments.find((fragment) => {
        return fragment && fragment.start <= timeStart && fragment.end >= timeStart;
      });

      if (!start) return false;
      return start.status === DownloadStatus.DOWNLOAD_COMPLETE || !this.client.options.downloadAll;
    } else if (this.source.mode === PlayerModes.DIRECT) {
      return true;
    }
    return false;
  }

  dereferenceFragments(fragments) {
    for (let i = 0; i < fragments.length; i++) {
      fragments[i].removeReference();
    }
    fragments.length = 0;
  }


  referenceFragments(timeStart, timeEnd) {
    if (!this.isModeSupported()) {
      return [];
    }
    const fragments = this.client.fragments;
    if (!fragments || fragments.length === 0) return [];

    let start = fragments.find((fragment) => {
      return fragment && fragment.start <= timeStart && fragment.end >= timeStart;
    });

    if (!start) return [];

    start = fragments.indexOf(start);
    const reserved = [];
    for (let i = start; i < fragments.length; i++) {
      if (fragments[i].end > timeEnd) {
        break;
      }
      fragments[i].addReference();
      reserved.push(fragments[i]);
    }
    return reserved;
  }

  async loadPlayer(aligner, timeStart, timeEnd, onDone) {
    const player = await this.client.playerLoader.createPlayer(this.source.mode, this.client, {
      isAnalyzer: true,
    });

    await player.setup();

    player.on(DefaultPlayerEvents.MANIFEST_PARSED, () => {
      player.currentLevel = this.client.currentLevel;
      player.load();
    });

    const onLoadMeta = () => {
      player.off(DefaultPlayerEvents.LOADEDMETADATA, onLoadMeta);
      this.runAnalyzerInBackground(player, aligner, timeStart, timeEnd, onDone);
    };

    player.on(DefaultPlayerEvents.LOADEDMETADATA, onLoadMeta);
    await player.setSource(this.source);
    return player;
  }

  shouldAnalyze() {
    if (!this.enabled) {
      return false;
    }

    if (!this.source) {
      return false;
    }

    const duration = this.client.duration;
    if (!duration) { // No duration
      return false;
    }

    if (duration < 5 * 60) { // Video is too short
      return false;
    }

    if (duration > 90 * 60) { // Video is likely a movie
      return false;
    }

    return true;
  }

  getMarkerPosition() {
    if (this.introStatus === AnalyzerStatus.RUNNING) {
      return this.introPlayer.currentTime;
    } else if (this.outroStatus === AnalyzerStatus.RUNNING) {
      return this.outroPlayer.currentTime;
    }
    return null;
  }

  runAnalyzerInBackground(player, aligner, timeStart, timeEnd, onDone) {
    //  document.body.appendChild(player.video);
    player.currentTime = timeStart;
    player.playbackRate = 6;
    player.volume = 0;
    player.play();


    let destroyed = false;
    let completed = false;
    const context = player.createContext();
    context.on(DefaultPlayerEvents.DESTROYED, () => {
      context.destroy();
      destroyed = true;
      onDone(completed);
    });

    context.on(DefaultPlayerEvents.ENDED, () => {
      completed = true;
      player.destroy();
    });

    let pauseTimeout;
    let lastTime = -1;

    let lastCalculate = Date.now();
    const onAnimFrame = () => {
      if (destroyed) {
        aligner.calculate();
        return;
      }
      if (player.readyState >= 1 && player.paused) {
        player.play();
        player.currentTime = Math.max(player.currentTime - 1.5, timeStart);
        console.log('[VideoAnalyzer] Resumed analyzer');
      }
      requestAnimationFrame(onAnimFrame);

      clearTimeout(pauseTimeout);
      pauseTimeout = setTimeout(() => {
        if (!destroyed && player.readyState >= 1) {
          player.pause();
          console.log('[VideoAnalyzer] Paused analyzer');
        }
      }, 100);

      if (player.readyState < 2) {
        return;
      }

      const time = player.currentTime;

      if (time + 1 < timeStart) {
        console.log('[VideoAnalyzer] Seeking analyzer back to start');
        player.currentTime = timeStart;
        return;
      }

      if (time === lastTime) return;
      lastTime = time;

      if (time < timeStart) {
        player.currentTime = timeStart;
        return;
      }

      if (time >= timeEnd) {
        completed = true;
        player.destroy();
        return;
      }

      aligner.pushVideoFrame(player.getVideo());

      if (Date.now() - lastCalculate > 1000) {
        setTimeout(() => {
          aligner.calculate();
          lastCalculate = Date.now();
        }, 1);
        lastCalculate = Date.now();
      }

      this.client.interfaceController.updateMarkers();
    };

    requestAnimationFrame(onAnimFrame);
  }

  setLevel(level) {
    this.destroyPlayers();

    if (this.introStatus === AnalyzerStatus.FAILED) {
      this.introStatus = AnalyzerStatus.IDLE;
    }

    if (this.outroStatus === AnalyzerStatus.FAILED) {
      this.outroStatus = AnalyzerStatus.IDLE;
    }
  }

  pushFrame(video) {
    if (!this.shouldAnalyze()) return false;

    const time = video.currentTime;
    if (time < this.options.introCutoff) {
      return this.introAligner.pushVideoFrame(video);
    } else if (this.client.duration - this.options.outroCutoff < time) {
      return this.outroAligner.pushVideoFrame(video);
    }
    return false;
  }

  calculate() {
    this.introAligner.calculate();
    this.outroAligner.calculate();
  }

  async setSource(source) {
    this.reset();

    this.source = source;
    this.introAligner.prepare(source.identifier);
    this.outroAligner.prepare(source.identifier);
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
    this.reset();
  }
}
