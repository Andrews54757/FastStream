import {Localize} from '../../modules/Localize.mjs';
import {AudioUtils} from '../../utils/AudioUtils.mjs';
import {EnvUtils} from '../../utils/EnvUtils.mjs';
import {Utils} from '../../utils/Utils.mjs';
import {WebUtils} from '../../utils/WebUtils.mjs';
import {AbstractAudioModule} from './AbstractAudioModule.mjs';
import {AudioChannelControl} from './config/AudioChannelControl.mjs';
import {VirtualAudioNode} from './VirtualAudioNode.mjs';


export class AudioChannelMixer extends AbstractAudioModule {
  constructor() {
    super('AudioChannelMixer');
    this.channelSplitter = null;
    this.channelMerger = null;
    this.channelGains = [];
    this.channelAnalyzers = [];
    this.finalGain = null;
    this.finalAnalyser = null;
    this.channelMixerConfig = [];
    this.setupUI();
  }

  needsUpscaler() {
    return this.channelSplitter !== null;
  }

  getElement() {
    return this.ui.mixer;
  }

  setChannelMixerConfig(config) {
    this.channelMixerConfig = config;
    this.refreshMixer();
  }

  setupUI() {
    this.ui = {};
    this.ui.mixer = WebUtils.create('div', null, 'mixer');

    this.ui.mixerTitle = WebUtils.create('div', null, 'mixer_title');
    this.ui.mixerTitle.textContent = Localize.getMessage('audiomixer_title');
    this.ui.mixer.appendChild(this.ui.mixerTitle);

    this.ui.mixerContainer = WebUtils.create('div', null, 'mixer_container');
    this.ui.mixer.appendChild(this.ui.mixerContainer);

    this.ui.channels = WebUtils.create('div', null, 'channels');
    this.ui.mixerContainer.appendChild(this.ui.channels);

    this.ui.master = WebUtils.create('div', null, 'master');
    this.ui.mixerContainer.appendChild(this.ui.master);
  }

  needsAnalyzer() {
    return this.ui.mixer.offsetParent !== null;
  }


  render() {
    const channels = this.channelMixerConfig;
    if (!channels) return;

    if (this.ui.mixer.offsetParent !== null) {
      this.createAnalyzers();
    } else {
      this.destroyAnalyzers();
    }

    channels.forEach((channel, i) => {
      if (i === 6) return;
      this.renderChannel(this.channelAnalyzers[channel.id], this.mixerChannelElements[channel.id]);
    });

    this.renderChannel(this.masterAnalyser, this.mixerChannelElements[6]);
  }

  renderChannel(analyzer, els) {
    if (!analyzer || !els) {
      return;
    }

    const canvas = els.volumeMeter;
    const ctx = els.volumeMeterCtx;

    const width = canvas.clientWidth * window.devicePixelRatio;
    const height = canvas.clientHeight * window.devicePixelRatio;
    if (width === 0 || height === 0) return;

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    const minDB = -40;
    const maxDB = 20;
    const dbRange = maxDB - minDB;
    const lastVolume = analyzer._lastVolume || 0;
    const volume = Math.max((Utils.clamp(AudioUtils.getVolume(analyzer), minDB, maxDB) - minDB) / dbRange, lastVolume * 0.95);
    analyzer._lastVolume = volume;
    const yScale = height;

    const rectHeight = height / 50;
    const volHeight = volume * yScale;

    const rectCount = Math.ceil(volHeight / rectHeight);
    const now = Date.now();

    if (!els.peak || rectCount > els.peak) {
      els.peak = rectCount;
      els.peakTime = now;
    }

    for (let i = 0; i < rectCount; i++) {
      const y = height - i * rectHeight;


      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, y, width, rectHeight);

      const color = `rgb(${Utils.clamp(i * 7, 0, 255)}, ${Utils.clamp(255 - i * 7, 0, 255)}, 0)`;
      ctx.fillStyle = color;
      ctx.fillRect(0, y + 1, width, rectHeight - 2);
    }

    const timeDiff = now - els.peakTime;

    // Code snippet from https://github.com/kevincennis/Mix.js/blob/master/src/js/views/app.views.track.js
    // MIT License
    /**
     * The MIT License (MIT)
     * Copyright (c) 2014 Kevin Ennis
     * https://github.com/kevincennis/Mix.js/blob/master/LICENSE
     */
    if ( timeDiff < 1000 && els.peak >= 1 ) {
      // for first 650 ms, use full alpha, then fade out
      const freshness = timeDiff < 650 ? 1 : 1 - ( ( timeDiff - 650 ) / 350 );
      ctx.fillStyle = 'rgba(238,119,85,' + freshness + ')';
      ctx.fillRect(0, height - els.peak * rectHeight - 1, width, 1);
    } else {
      els.peak = 0;
      els.peakTime = now;
    }
  }

  createMixerElements() {
    const els = {};

    els.container = WebUtils.create('div', null, 'mixer_channel_container');

    els.channelTitle = WebUtils.create('div', null, 'mixer_channel_title');
    els.container.appendChild(els.channelTitle);

    els.buttons = WebUtils.create('div', null, 'mixer_channel_buttons');
    els.container.appendChild(els.buttons);

    els.soloButton = WebUtils.create('div', null, 'mixer_channel_solo');
    els.soloButton.textContent = 'S';
    els.soloButton.title = Localize.getMessage('audiomixer_solo_label');
    els.buttons.appendChild(els.soloButton);

    els.muteButton = WebUtils.create('div', null, 'mixer_channel_mute');
    els.muteButton.textContent = 'M';
    els.muteButton.title = Localize.getMessage('audiomixer_mute_label');
    els.buttons.appendChild(els.muteButton);

    els.volume = WebUtils.create('div', null, 'mixer_channel_volume');
    els.container.appendChild(els.volume);

    els.volumeAxis = WebUtils.create('div', null, 'mixer_channel_volume_axis');
    els.volume.appendChild(els.volumeAxis);

    // Volume axis goes from +10 to -60 then -inf
    for (let i = 0; i < 6; i++) {
      const db = 10 - i * 10;
      const el = WebUtils.create('div', null, 'mixer_channel_volume_tick');
      el.style.top = `${AudioUtils.mixerDBToPositionRatio(db) * 100}%`;
      els.volumeAxis.appendChild(el);

      const label = WebUtils.create('div', null, 'mixer_channel_volume_tick_label');
      label.textContent = `${db > 0 ? '+' : ''}${db}`;
      el.appendChild(label);
    }

    const el = WebUtils.create('div', null, 'mixer_channel_volume_tick');
    el.style.top = `100%`;
    els.volumeAxis.appendChild(el);

    const label = WebUtils.create('div', null, 'mixer_channel_volume_tick_label');
    label.textContent = `-∞`;
    el.appendChild(label);


    els.volumeTrack = WebUtils.create('div', null, 'mixer_channel_volume_track');
    els.volume.appendChild(els.volumeTrack);

    els.volumeMeter = WebUtils.create('canvas', null, 'mixer_channel_volume_meter');
    els.volumeTrack.appendChild(els.volumeMeter);

    els.volumeMeterCtx = els.volumeMeter.getContext('2d');

    els.volumeHandle = WebUtils.create('div', null, 'mixer_channel_volume_handle');
    els.volumeTrack.appendChild(els.volumeHandle);

    return els;
  }

  createMixerChannel(channel) {
    const channelNames = ['Left', 'Right', 'Center', 'Bass (LFE)', 'Left Surround', 'Right Surround', 'Master'];
    const els = this.createMixerElements();
    els.channelTitle.textContent = channelNames[channel.id];

    els.volumeHandle.style.top = `${AudioUtils.mixerDBToPositionRatio(AudioUtils.gainToDB(channel.gain)) * 100}%`;

    if (channel.id === 6) { // master
      els.soloButton.style.display = 'none';
      els.muteButton.textContent = Localize.getMessage('audiomixer_mono');
      els.muteButton.title = els.muteButton.textContent;
      els.muteButton.classList.toggle('active', channel.mono);
    } else {
      els.soloButton.classList.toggle('active', channel.solo);
      els.muteButton.classList.toggle('active', channel.muted);
    }

    const zeroPos = AudioUtils.mixerDBToPositionRatio(0);
    const mouseMove = (e) => {
      const y = e.clientY - els.volumeTrack.getBoundingClientRect().top;
      let newYPercent = Utils.clamp(y / els.volumeTrack.clientHeight * 100, 0, 100);

      if (Math.abs(newYPercent / 100 - zeroPos) < 0.025) {
        newYPercent = zeroPos * 100;
      }

      if (newYPercent >= 98) {
        newYPercent = 100;
      }

      const db = AudioUtils.mixerPositionRatioToDB(newYPercent / 100);
      els.volumeHandle.style.top = `${newYPercent}%`;
      channel.gain = AudioUtils.dbToGain(db);
      this.updateNodes();
    };

    const mouseUp = (e) => {
      document.removeEventListener('mousemove', mouseMove);
      document.removeEventListener('mouseup', mouseUp);
    };

    els.volumeHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      document.addEventListener('mousemove', mouseMove);
      document.addEventListener('mouseup', mouseUp);
    });

    els.volumeTrack.addEventListener('click', (e) => {
      mouseMove(e);
    });

    els.volumeTrack.addEventListener('wheel', (e) => {
      if (e.deltaX !== 0) return; // ignore horizontal scrolling (for trackpad)
      e.preventDefault();
      e.stopPropagation();
      let delta = Utils.clamp(e.deltaY, -1, 1);
      if (!EnvUtils.isMacOS()) {
        delta = -delta;
      }
      const ratio = parseFloat(els.volumeHandle.style.top) / 100;
      const db = AudioUtils.mixerPositionRatioToDB(ratio - delta * 0.05);
      els.volumeHandle.style.top = `${AudioUtils.mixerDBToPositionRatio(db) * 100}%`;
      channel.gain = AudioUtils.dbToGain(db);
      this.updateNodes();
    });

    const toggleMute = () => {
      if (channel.id === 6) { // master
        channel.mono = !channel.mono;
        els.muteButton.classList.toggle('active', channel.mono);
      } else {
        channel.muted = !channel.muted;
        els.muteButton.classList.toggle('active', channel.mute);
      }
      this.updateNodes();
    };

    const toggleSolo = () => {
      if (!channel.solo) {
        this.channelMixerConfig.forEach((channel) => {
          const els = this.mixerChannelElements[channel.id];
          channel.solo = false;
          els.soloButton.classList.remove('active');
        });
      }

      channel.solo = !channel.solo;
      els.soloButton.classList.toggle('active', channel.solo);
      this.updateNodes();
    };


    els.volumeHandle.addEventListener('keydown', (e) => {
      const ratio = parseFloat(els.volumeHandle.style.top) / 100;
      if (e.key === 'ArrowUp') {
        e.stopPropagation();
        e.preventDefault();
        const db = AudioUtils.mixerPositionRatioToDB(ratio - 0.025);
        els.volumeHandle.style.top = `${AudioUtils.mixerDBToPositionRatio(db) * 100}%`;
        channel.gain = AudioUtils.dbToGain(db);
        this.updateNodes();
      } else if (e.key === 'ArrowDown') {
        e.stopPropagation();
        e.preventDefault();

        const db = AudioUtils.mixerPositionRatioToDB(ratio + 0.025);
        els.volumeHandle.style.top = `${AudioUtils.mixerDBToPositionRatio(db) * 100}%`;
        channel.gain = AudioUtils.dbToGain(db);
        this.updateNodes();
      } else if (e.key === 'm') {
        e.stopPropagation();
        e.preventDefault();

        toggleMute();
      } else if (e.key === 's') {
        e.stopPropagation();
        e.preventDefault();

        toggleSolo();
      }
    });
    els.volumeHandle.tabIndex = 0;

    els.soloButton.addEventListener('click', toggleSolo);

    els.muteButton.addEventListener('click', toggleMute);


    return els;
  }

  refreshMixer() {
    this.ui.master.replaceChildren();
    this.ui.channels.replaceChildren();
    this.mixerChannelElements = [];

    const mixerChannels = this.channelMixerConfig;

    if (mixerChannels.length < 7) {
      // add channels
      for (let i = mixerChannels.length; i < 7; i++) {
        mixerChannels.push(new AudioChannelControl(i, 1, false, false));
      }
    }

    for (let i = 0; i < 6; i++) {
      const channel = mixerChannels[i];
      const els = this.createMixerChannel(channel);
      this.ui.channels.appendChild(els.container);
      this.mixerChannelElements[i] = els;
    }

    const els = this.createMixerChannel(mixerChannels[6]);
    this.ui.master.appendChild(els.container);
    this.mixerChannelElements[6] = els;
    this.updateNodes();
  }

  createAnalyzers() {
    if (this.channelAnalyzers.length > 0 || !this.needsAnalyzer()) {
      return;
    }

    this.updateNodes();

    this.channelGains.forEach((gain) => {
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      this.channelAnalyzers.push(analyser);
      gain.connect(analyser);
    });

    this.masterAnalyser = this.audioContext.createAnalyser();
    this.masterAnalyser.fftSize = 256;
    this.getOutputNode().connect(this.masterAnalyser);
  }

  destroyAnalyzers(skipDisconnect = false) {
    if (this.channelAnalyzers.length === 0) {
      return;
    }

    if (!skipDisconnect) {
      this.channelGains.forEach((gain, i) => {
        gain.disconnect(this.channelAnalyzers[i]);
        this.channelAnalyzers[i].disconnect();
      });

      this.getOutputNode().disconnect(this.masterAnalyser);
      this.masterAnalyser.disconnect();
    }

    this.channelAnalyzers = [];
    this.masterAnalyser = null;

    this.updateNodes();
  }

  getChannelGainsFromConfig() {
    if (!this.channelMixerConfig) {
      return null;
    }

    const channels = this.channelMixerConfig;
    const soloChannel = channels.find((channel) => channel.solo);

    return channels.map((channel, i) => {
      if (soloChannel && channel !== soloChannel && channel.id !== 6) {
        return 0;
      } else {
        return channel.muted ? 0 : channel.gain;
      }
    });
  }

  setupNodes(audioContext) {
    super.setupNodes(audioContext);

    this.destroyAnalyzers(true);

    this.postMerger = new VirtualAudioNode('AudioChannelMixer postMerger');

    this.getInputNode().connect(this.postMerger);
    this.postMerger.connect(this.getOutputNode());

    this.channelSplitter = null;
    this.channelMerger = null;
    this.channelGains = [];
    this.finalGain = null;
    this.refreshMixer();
  }

  updateNodes() {
    if (!this.audioContext) return;

    const gains = this.getChannelGainsFromConfig();
    if (!gains) {
      return;
    }

    const hasNonUnityMasterGain = gains[6] !== 1;
    const isMono = this.channelMixerConfig[6].mono;
    if (hasNonUnityMasterGain || isMono) {
      if (!this.finalGain) {
        this.finalGain = this.audioContext.createGain();
        this.postMerger.disconnect(this.getOutputNode());
        this.postMerger.connect(this.finalGain);
        this.getOutputNode().connectFrom(this.finalGain);
      }
      this.finalGain.gain.value = gains[6];

      if (isMono) {
        this.finalGain.channelCount = 1;
        this.finalGain.channelCountMode = 'explicit';
      } else {
        this.finalGain.channelCountMode = 'max';
      }
    } else {
      if (this.finalGain) {
        this.postMerger.disconnect(this.finalGain);
        this.getOutputNode().disconnectFrom(this.finalGain);
        this.finalGain = null;
        this.postMerger.connect(this.getOutputNode());
      }
    }

    const hasNonUnityChannelGains = gains.slice(0, 6).some((gain) => gain !== 1);
    if (hasNonUnityChannelGains || this.needsAnalyzer()) {
      if (!this.channelSplitter) {
        this.channelSplitter = this.audioContext.createChannelSplitter();
        this.channelMerger = this.audioContext.createChannelMerger();
        this.getInputNode().disconnect(this.postMerger);
        this.getInputNode().connect(this.channelSplitter);
        this.postMerger.connectFrom(this.channelMerger);
        for (let i = 0; i < 6; i++) {
          const gain = this.audioContext.createGain();
          this.channelGains[i] = gain;
          this.channelSplitter.connect(gain, i);
          gain.connect(this.channelMerger, 0, i);
        }
        this.emit('upscale');
      }

      for (let i = 0; i < 6; i++) {
        this.channelGains[i].gain.value = gains[i];
      }
    } else {
      if (this.channelSplitter) {
        this.getInputNode().disconnect(this.channelSplitter);
        this.postMerger.disconnectFrom(this.channelMerger);
        this.getInputNode().connect(this.postMerger);

        this.channelGains.forEach((gain) => {
          gain.disconnect();
        });

        this.channelSplitter.disconnect();
        this.channelMerger.disconnect();

        this.channelSplitter = null;
        this.channelMerger = null;
        this.channelGains = [];
        this.emit('upscale');
      }
    }
  }
}
