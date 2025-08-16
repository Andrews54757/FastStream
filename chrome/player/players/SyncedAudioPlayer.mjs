import {DefaultPlayerEvents} from '../enums/DefaultPlayerEvents.mjs';
import {EventEmitter} from '../modules/eventemitter.mjs';
import {Localize} from '../modules/Localize.mjs';
import {Utils} from '../utils/Utils.mjs';

export class SyncedAudioPlayer extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.audioPlayers = [];
    this.currentAudioPlayer = 0;
    this.videoDelay = 0;
    this.volume = 1;
    this.playbackRate = 1;
    this.consecutiveResyncs = 0;
    this.audioDelayNode = null;
    this.resyncDecreaseCount = 0;
    this.madePlayers = false;
  }

  async setup(audioContext, audioSource, audioOutputNode) {
    this.audioContext = audioContext;
    this.audioSource = audioSource;
    this.outputNode = audioOutputNode;
  }

  async setVideoDelay(delay) {
    if (this.videoDelay === delay || !this.client.player) {
      return;
    }

    this.videoDelay = delay;

    if (this.shouldUseSeparateAudioPlayers()) {
      if (!this.madePlayers) {
        this.madePlayers = true;
        await this.makePlayers(this.client.player.getSource());
      }
      this.resync();
    } else {
      this.client.player.volume = this.volume;
      this.audioPlayers.forEach((player) => {
        player.volume = 0;
        player.pause();
      });
    }

    if (this.audioContext && this.videoDelay < 0) {
      if (!this.audioDelayNode) {
        this.audioDelayNode = this.audioContext.createDelay(1);
        this.outputNode.disconnectFrom(this.audioSource);
        this.audioSource.connect(this.audioDelayNode);
        this.outputNode.connectFrom(this.audioDelayNode);
      }

      this.audioDelayNode.delayTime.value = -this.videoDelay / 1000;
    } else {
      if (this.audioDelayNode) {
        this.outputNode.disconnectFrom(this.audioDelayNode);
        this.audioSource.disconnect(this.audioDelayNode);
        this.outputNode.connectFrom(this.audioSource);
        this.audioDelayNode = null;
      }
    }
    this.consecutiveResyncs = 0;
  }

  shouldUseSeparateAudioPlayers() {
    return this.videoDelay !== 0 && (this.videoDelay > 0 || !this.audioContext);
  }

  async makePlayers(source) {
    this.source = source;

    for (let i = 0; i < 2; i++) {
      const player = await this.client.playerLoader.createPlayer(source.mode, this.client, {
        isAudioOnly: true,
      });

      await player.setup();
      this.client.interfaceController.addVideo(player.getVideo());

      if (this.audioContext) {
        const audioSource = this.audioContext.createMediaElementSource(player.getVideo());
        player.audioSource = audioSource;
        this.outputNode.connectFrom(audioSource);
      }

      player.volume = 0;
      player.playbackRate = this.playbackRate;

      player.on(DefaultPlayerEvents.MANIFEST_PARSED, () => {
        // TODO: fix levels
        // player.currentLevel = this.client.currentLevel;
        // player.currentAudioLevel = this.client.currentAudioLevel;
      });

      player.on(DefaultPlayerEvents.ERROR, (msg) => {
        this.client.failedToLoad(msg || Localize.getMessage('player_error_load'));
      });

      this.client.attachProcessorsToPlayer(player);

      await player.setSource(source);

      this.audioPlayers.push(player);
    }
  }

  getOutputNode() {
    return this.outputNode;
  }

  async play() {
    if (!this.shouldUseSeparateAudioPlayers() || this.audioPlayers.length !== 2) {
      return;
    }
    this.audioPlayers[this.currentAudioPlayer].play();
    this.resync();
    this.consecutiveResyncs = 0;
  }

  async pause() {
    if (!this.shouldUseSeparateAudioPlayers() || this.audioPlayers.length !== 2) {
      return;
    }
    this.audioPlayers[this.currentAudioPlayer].pause();
    this.consecutiveResyncs = 0;
  }

  setCurrentTime(time) {
    if (!this.shouldUseSeparateAudioPlayers() || this.audioPlayers.length !== 2) {
      return;
    }
    this.audioPlayers.forEach((player) => {
      player.currentTime = time + this.videoDelay / 1000;
    });
    this.consecutiveResyncs = 0;
  }

  async syncTime(playerToSync, targetPlayer, offset = 0) {
    const syncVideo = playerToSync.getVideo();
    const targetVideo = targetPlayer.getVideo();

    let res;
    if (Math.abs((targetVideo.currentTime + offset) - syncVideo.currentTime) > 3 || targetVideo.paused) {
      syncVideo.currentTime = targetVideo.currentTime + offset;
      if (!targetVideo.paused) {
        res = await Utils.timeoutableEvent(playerToSync, DefaultPlayerEvents.PLAYING, 1000);
        if (!res) {
          return false;
        }
      }
    } else {
      syncVideo.currentTime = targetVideo.currentTime + offset;
      res = await Utils.timeoutableEvent(playerToSync, DefaultPlayerEvents.PLAYING, 1000);
      if (!res) {
        return false;
      }

      await Utils.asyncTimeout(500);

      const error = (targetVideo.currentTime + offset) - syncVideo.currentTime;
      syncVideo.currentTime = (targetVideo.currentTime + offset) + error;
      res = await Utils.timeoutableEvent(playerToSync, DefaultPlayerEvents.PLAYING, 1000);
      if (!res) {
        return false;
      }

      await Utils.asyncTimeout(500);
    }

    return true;
  }

  async watcherLoop() {
    if (this.audioPlayers.length < 2 || !this.shouldUseSeparateAudioPlayers()) {
      return;
    }

    if (this.resyncDecreaseCount > 0) {
      this.resyncDecreaseCount--;
    } else {
      this.resyncDecreaseCount = 60; // 1 minute
      if (this.consecutiveResyncs > 0) {
        this.consecutiveResyncs--;
      }
    }

    const currentPlayer = this.audioPlayers[this.currentAudioPlayer];

    // Check error
    const offset = this.videoDelay / 1000;
    const error = Math.abs(this.client.currentVideo.currentTime + offset - currentPlayer.getVideo().currentTime);
    // console.log('Error is', error);
    if (error > 0.01 && this.client.currentVideo.readyState >= 2) {
      if (!this.resyncing) {
        let resyncMax = 1;
        if (error > 0.05) {
          resyncMax = 3;
        } else if (error > 0.1) {
          resyncMax = 6;
        } else if (error > 0.2) {
          resyncMax = 10;
        }

        if (this.consecutiveResyncs < resyncMax) {
          this.consecutiveResyncs++;
          this.resync();
          if (this.consecutiveResyncs === resyncMax) {
            console.log('Will not resync anymore');
          }
        }
      }
    } else {
      this.consecutiveResyncs = 0;
    }
  }

  async resync() {
    if (this.resyncing) {
      return;
    }

    this.resyncing = true;
    await this.silentResyncInternal();
    this.resyncing = false;
  }

  async silentResyncInternal() {
    if (this.audioPlayers.length < 1) {
      return false;
    }

    const nextIndex = (this.currentAudioPlayer + 1) % 2;
    const current = this.audioPlayers[this.currentAudioPlayer];
    const next = this.audioPlayers[nextIndex];

    // Get current error
    const offset = this.videoDelay / 1000;
    const error = (this.client.currentVideo.currentTime + offset) - current.getVideo().currentTime;
    console.log('Resyncing audio, current error is', error);

    next.volume = 0;

    if (this.client.state.playing && this.client.currentVideo.readyState >= 2) {
      try {
        await next.play();
      } catch (e) {
        console.log('Failed to play audio');
        return false;
      }
    } else {
      await next.pause();
    }

    const res = await this.syncTime(next, this.client.player, this.videoDelay / 1000);
    if (!res) {
      console.error('Failed to sync audio');
      return false;
    }

    if (!this.shouldUseSeparateAudioPlayers()) {
      return false;
    }

    const newError = (this.client.currentVideo.currentTime + offset) - next.getVideo().currentTime;
    if (Math.abs(newError) > Math.abs(error)) {
      console.error('Failed to resync audio. New error is bigger than old error', newError, error);
      return false;
    }

    next.volume = this.volume;
    current.volume = 0;
    this.currentAudioPlayer = nextIndex;
    this.client.player.volume = 0;
    await current.pause();

    console.log('Resync complete! New error is', newError);

    return true;
  }

  setVolume(value) {
    this.volume = value;

    if (!this.shouldUseSeparateAudioPlayers() || this.audioPlayers.length !== 2) {
      return;
    }

    this.audioPlayers[this.currentAudioPlayer].volume = value;
    return true;
  }

  setPlaybackRate(value) {
    this.playbackRate = value;

    if (!this.shouldUseSeparateAudioPlayers() || this.audioPlayers.length !== 2) {
      return;
    }

    this.audioPlayers.forEach((player) => {
      player.playbackRate = value;
    });
  }

  setLevel(level, audioLevel) {
    const changed = false;
    this.audioPlayers.forEach((player) => {
      // TODO: fix levels
      // changed = changed || player.currentAudioLevel !== audioLevel;
      // player.currentLevel = level;
      // player.currentAudioLevel = audioLevel;
    });

    if (changed) {
      this.consecutiveResyncs = 0;
      this.emit('audioLevelChanged', audioLevel);
    }
  }

  destroy() {
    this.audioPlayers.forEach((player) => player.destroy());
    this.audioPlayers = [];
    this.audioContext.close();
  }
}
