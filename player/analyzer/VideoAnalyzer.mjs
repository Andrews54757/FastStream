import {AnalyzerEvents} from '../enums/AnalyzerEvents.mjs';
import {DefaultPlayerEvents} from '../enums/DefaultPlayerEvents.mjs';
import {DownloadStatus} from '../enums/DownloadStatus.mjs';
import {PlayerModes} from '../enums/PlayerModes.mjs';
import {EventEmitter} from '../modules/eventemitter.mjs';
import {DirectVideoPlayer} from '../players/DirectVideoPlayer.mjs';
import {DashPlayer} from '../players/dash/DashPlayer.mjs';
import {HLSPlayer} from '../players/hls/HLSPlayer.mjs';
import {MP4Player} from '../players/mp4/MP4Player.mjs';
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
  }


  getOutro() {
    return this.outroAligner.getMatch();
  }

  getIntro() {
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

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
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


    if (this.outroStatus !== AnalyzerStatus.RUNNING && this.introStatus == AnalyzerStatus.IDLE) {
      const introEnd = Math.min(this.options.introCutoff, duration);
      if (this.shouldLoadPlayer(0, introEnd)) {
        console.log('[VideoAnalyzer] Running intro finder in background', 0, introEnd);
        this.introStatus = AnalyzerStatus.RUNNING;
        const reserved = this.referenceFragments(0, introEnd);
        this.introPlayer = await this.loadPlayer(this.introAligner, 0, introEnd, (completed) => {
          this.introStatus = completed ? AnalyzerStatus.FINISHED : AnalyzerStatus.FAILED;
          console.log('[VideoAnalyzer] Intro finder completed', completed);
          this.dereferenceFragments(reserved);
        });

        if (!this.introPlayer) {
          this.introStatus = AnalyzerStatus.FAILED;
          console.log('[VideoAnalyzer] Intro finder failed');
        }
      }
    }

    const outroStart = Math.max(duration - this.options.outroCutoff, this.options.introCutoff);
    if (this.introStatus !== AnalyzerStatus.RUNNING && this.outroStatus == AnalyzerStatus.IDLE && duration - outroStart > 30) {
      if (this.shouldLoadPlayer(outroStart, duration)) {
        console.log('[VideoAnalyzer] Running outro finder in background', outroStart, duration);
        this.outroStatus = AnalyzerStatus.RUNNING;
        const reserved = this.referenceFragments(outroStart, duration);
        this.outroPlayer = await this.loadPlayer(this.outroAligner, outroStart, duration, (completed) => {
          this.outroStatus = completed ? AnalyzerStatus.FINISHED : AnalyzerStatus.FAILED;
          console.log('[VideoAnalyzer] Outro finder completed', completed);
          this.dereferenceFragments(reserved);
        });

        if (!this.outroPlayer) {
          this.outroStatus = AnalyzerStatus.FAILED;
          console.log('[VideoAnalyzer] Outro finder failed');
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
    let player = null;

    if (this.source.mode === PlayerModes.ACCELERATED_HLS) {
      player = new HLSPlayer(this.client);
      await player.setup();

      player.on(DefaultPlayerEvents.MANIFEST_PARSED, () => {
        player.currentLevel = this.client.currentLevel;
        player.load();
      });
    } else if (this.source.mode === PlayerModes.ACCELERATED_MP4) {
      player = new MP4Player(this.client);
      await player.setup();

      player.on(DefaultPlayerEvents.MANIFEST_PARSED, () => {
        player.currentLevel = this.client.currentLevel;
        player.load();
      });
    } else if (this.source.mode === PlayerModes.ACCELERATED_DASH) {
      player = new DashPlayer(this.client);
      await player.setup();

      player.on(DefaultPlayerEvents.MANIFEST_PARSED, () => {
        player.currentLevel = this.client.currentLevel;
        player.currentAudioLevel = this.client.currentAudioLevel;
        player.load();
      });
    } else if (this.source.mode === PlayerModes.DIRECT) {
      player = new DirectVideoPlayer();
      await player.setup();
    }

    if (!player) {
      return null;
    }

    const onLoadMeta = () => {
      player.off(DefaultPlayerEvents.LOADEDMETADATA, onLoadMeta);
      this.runAnalyzerInBackground(player, aligner, timeStart, timeEnd, onDone);
    };

    player.on(DefaultPlayerEvents.LOADEDMETADATA, onLoadMeta);
    await player.setSource(this.source);
    return player;
  }
  load(currentLevel, duration) {
    const outroStart = Math.max(duration - this.options.outroCutoff, this.options.introCutoff);
    if (this.outroPlayer && outroStart + 10 > duration) {
      this.outroPlayer.destroy();
      this.outroPlayer = null;
    }
    this.setLevel(currentLevel);
    if (this.introPlayer) {
      this.runAnalyzerInBackground(this.introPlayer, this.introAligner, 0, Math.min(this.options.introCutoff, duration));
      this.introPlayer.on(DefaultPlayerEvents.DESTROYED, () => {
        this.introPlayer = null;
      });
    }

    if (this.outroPlayer) {
      this.runAnalyzerInBackground(this.outroPlayer, this.outroAligner, outroStart, duration);
      this.outroPlayer.on(DefaultPlayerEvents.DESTROYED, () => {
        this.outroPlayer = null;
      });
    }
  }

  shouldAnalyze() {
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
    } else if (this.client.persistent.duration - this.options.outroCutoff < time) {
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
}
