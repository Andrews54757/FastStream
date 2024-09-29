import {Localize} from '../../modules/Localize.mjs';
import {AudioUtils} from '../../utils/AudioUtils.mjs';
import {EnvUtils} from '../../utils/EnvUtils.mjs';
import {Utils} from '../../utils/Utils.mjs';
import {WebUtils} from '../../utils/WebUtils.mjs';
import {AbstractAudioModule} from './AbstractAudioModule.mjs';
import {AudioCompressor} from './AudioCompressor.mjs';
import {AudioEqualizer} from './AudioEqualizer.mjs';
import {VirtualAudioNode} from './VirtualAudioNode.mjs';

const CHANNEL_NAMES = ['Left', 'Right', 'Center', 'Bass (LFE)', 'Left Surround', 'Right Surround'];

export class AudioChannelMixer extends AbstractAudioModule {
  constructor() {
    super('AudioChannelMixer');

    this.channelConfigs = null;
    this.masterConfig = null;

    this.channelSplitter = null;
    this.channelMerger = null;
    this.channelNodes = [];
    this.masterNodes = {};

    this.mixerChannelElements = [];
    this.masterElements = null;
  }

  needsUpscaler() {
    return this.channelSplitter !== null;
  }

  getElement() {
    return this.ui.mixer;
  }

  setConfig(config) {
    this.channelConfigs = config.channels;
    this.masterConfig = config.master;

    this.channelConfigs.forEach((channel, i) => {
      this.channelNodes[channel.id].equalizer.setConfig(channel.equalizerNodes);
      this.channelNodes[channel.id].compressor.setConfig(channel.compressor);
    });

    this.masterNodes.equalizer.setConfig(this.masterConfig.equalizerNodes);
    this.masterNodes.compressor.setConfig(this.masterConfig.compressor);

    this.refreshMixer();
    this.updateDynLabels();
  }

  setupUI(equalizerContainer, compressorContainer) {
    this.ui = {};
    this.ui.mixer = WebUtils.create('div', null, 'mixer');

    this.ui.equalizerContainer = equalizerContainer;
    this.ui.compressorContainer = compressorContainer;

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
    if (!this.channelConfigs) return;

    if (this.ui.mixer.offsetParent !== null) {
      this.createAnalyzers();
    } else {
      this.destroyAnalyzers();
    }

    this.channelConfigs.forEach((channel, i) => {
      this.renderChannel(this.channelNodes[channel.id], this.mixerChannelElements[channel.id]);
    });

    this.renderChannel(this.masterNodes, this.masterElements);

    this.channelNodes.forEach((nodes, i) => {
      nodes.equalizer.render();
      nodes.compressor.render();
    });

    this.masterNodes.equalizer.render();
    this.masterNodes.compressor.render();
  }

  renderChannel(nodes, els) {
    const analyzer = nodes ? nodes.analyzer : null;
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
    const maxDB = 40;
    const dbRange = maxDB - minDB;
    const lastVolume = analyzer._lastVolume || 0;
    const volume = Math.max((Utils.clamp(AudioUtils.getVolume(analyzer), minDB, maxDB) - minDB) / dbRange, lastVolume * 0.95);
    analyzer._lastVolume = volume;
    const yScale = height;

    const rectHeight = height / 50;
    const volHeight = volume * yScale;

    const rectCount = Math.round(volHeight / rectHeight);
    const now = Date.now();

    if (!els.peak || rectCount > els.peak) {
      els.peak = rectCount;
      els.peakTime = now;
    }

    for (let i = 0; i < rectCount; i++) {
      const y = height - (i + 1) * rectHeight;


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

    els.dynButton = WebUtils.create('div', null, 'mixer_channel_dyn');
    els.dynButton.textContent = 'EQ/Comp';
    els.dynButton.title = Localize.getMessage('audiomixer_dynamics_label');
    els.buttons.appendChild(els.dynButton);

    els.volume = WebUtils.create('div', null, 'mixer_channel_volume');
    els.container.appendChild(els.volume);

    els.volumeAxis = WebUtils.create('div', null, 'mixer_channel_volume_axis');
    els.volume.appendChild(els.volumeAxis);

    // Volume axis goes from +10 to -30 then -inf
    const dbs = [10, 5, 0, -5, -10, -20, -30];
    for (let i = 0; i < dbs.length; i++) {
      const db = dbs[i];
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
    const els = this.createMixerElements();
    els.channelTitle.textContent = channel.isMaster() ? 'Master' : CHANNEL_NAMES[channel.id];

    if (channel.isMaster()) {
      WebUtils.setLabels(els.volumeHandle, Localize.getMessage('audiomixer_volume_master_handle_label', [els.channelTitle.textContent, Math.round(AudioUtils.gainToDB(channel.gain)), Math.round(channel.gain * 100)]));
    } else {
      WebUtils.setLabels(els.volumeHandle, Localize.getMessage('audiomixer_volume_handle_label', [els.channelTitle.textContent, Math.round(AudioUtils.gainToDB(channel.gain)), Math.round(channel.gain * 100)]));
    }

    els.volumeHandle.style.top = `${AudioUtils.mixerDBToPositionRatio(AudioUtils.gainToDB(channel.gain)) * 100}%`;

    if (channel.isMaster()) { // master
      els.soloButton.style.display = 'none';
      els.muteButton.textContent = Localize.getMessage('audiomixer_mono');
      els.muteButton.title = els.muteButton.textContent;
      els.muteButton.classList.toggle('active', channel.mono);
      els.dynButton.classList.toggle('active', true);
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

      if (channel.isMaster()) {
        WebUtils.setLabels(els.volumeHandle, Localize.getMessage('audiomixer_volume_master_handle_label', [els.channelTitle.textContent, Math.round(AudioUtils.gainToDB(channel.gain)), Math.round(channel.gain * 100)]));
      } else {
        WebUtils.setLabels(els.volumeHandle, Localize.getMessage('audiomixer_volume_handle_label', [els.channelTitle.textContent, Math.round(AudioUtils.gainToDB(channel.gain)), Math.round(channel.gain * 100)]));
      }
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
      if (channel.isMaster()) { // master
        channel.mono = !channel.mono;
        els.muteButton.classList.toggle('active', channel.mono);
      } else {
        channel.muted = !channel.muted;
        els.muteButton.classList.toggle('active', channel.mute);
      }
      this.updateNodes();
    };

    const toggleSolo = () => {
      if (channel.isMaster()) {
        return;
      }

      if (!channel.solo) {
        this.channelConfigs.forEach((channel) => {
          const els = this.mixerChannelElements[channel.id];
          channel.solo = false;
          els.soloButton.classList.remove('active');
        });
      }

      channel.solo = !channel.solo;
      els.soloButton.classList.toggle('active', channel.solo);
      this.updateNodes();
    };

    const toggleDyn = () => {
      this.channelConfigs.forEach((otherChannel) => {
        if (otherChannel.id === channel.id) return;
        const els = this.mixerChannelElements[otherChannel.id];
        otherChannel.dyn = false;
        els.dynButton.classList.remove('active');
      });

      this.masterConfig.dyn = false;
      this.masterElements.dynButton.classList.remove('active');

      channel.dyn = true;
      els.dynButton.classList.toggle('active', channel.dyn);
      this.swapDynActive();
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
      } else if (e.key === 'd' || e.key === 'e' || e.key === 'c') {
        e.stopPropagation();
        e.preventDefault();

        toggleDyn();
      }
    });
    els.volumeHandle.tabIndex = 0;
    els.volumeHandle.role = 'slider';

    els.soloButton.addEventListener('click', toggleSolo);
    els.muteButton.addEventListener('click', toggleMute);
    els.dynButton.addEventListener('click', toggleDyn);


    return els;
  }

  refreshMixer() {
    if (!this.channelConfigs) return;

    this.ui.master.replaceChildren();
    this.ui.channels.replaceChildren();
    this.mixerChannelElements = [];

    this.channelConfigs.forEach((channel, i) => {
      const els = this.createMixerChannel(channel);
      this.mixerChannelElements[channel.id] = els;
      this.ui.channels.appendChild(els.container);
    });

    this.masterElements = this.createMixerChannel(this.masterConfig);
    this.ui.master.appendChild(this.masterElements.container);

    this.updateNodes();
    this.swapDynActive();
  }

  swapDynActive() {
    this.ui.equalizerContainer.replaceChildren();
    this.ui.compressorContainer.replaceChildren();

    for (let i = 0; i < this.channelConfigs.length; i++) {
      const channel = this.channelConfigs[i];
      const nodes = this.channelNodes[channel.id];
      if (channel.dyn) {
        this.ui.equalizerContainer.appendChild(nodes.equalizer.getElement());
        this.ui.compressorContainer.appendChild(nodes.compressor.getElement());
        return;
      }
    }

    this.masterConfig.dyn = true;
    this.ui.equalizerContainer.appendChild(this.masterNodes.equalizer.getElement());
    this.ui.compressorContainer.appendChild(this.masterNodes.compressor.getElement());
  }

  createAnalyzers() {
    if (this.channelNodes.length === 0) {
      return;
    }

    if (this.channelNodes[0].analyzer) {
      return;
    }

    if (!this.needsAnalyzer()) {
      return;
    }

    this.updateNodes();

    this.channelNodes.forEach((nodes) => {
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      nodes.preMerge.connect(analyser);
      nodes.analyzer = analyser;
    });

    const masterAnalyzer = this.audioContext.createAnalyser();
    masterAnalyzer.fftSize = 256;
    this.getOutputNode().connect(masterAnalyzer);
    this.masterNodes.analyzer = masterAnalyzer;
  }

  destroyAnalyzers(skipDisconnect = false) {
    if (this.channelNodes.length === 0) {
      return;
    }

    if (!this.channelNodes[0].analyzer) {
      return;
    }

    this.channelNodes.forEach((nodes, i) => {
      if (!skipDisconnect) {
        nodes.preMerge.disconnect(nodes.analyzer);
        nodes.analyzer.disconnect();
      }
      nodes.analyzer = null;
    });
    if (!skipDisconnect) {
      this.getOutputNode().disconnect(this.masterNodes.analyzer);
      this.masterNodes.analyzer.disconnect();
    }
    this.masterNodes.analyzer = null;

    this.updateNodes();
  }

  getChannelGainsFromConfig() {
    if (!this.channelConfigs) {
      return null;
    }

    const soloChannel = this.channelConfigs.find((channel) => channel.solo);

    return this.channelConfigs.map((channel, i) => {
      if (soloChannel && channel !== soloChannel) {
        return 0;
      } else {
        return channel.muted ? 0 : channel.gain;
      }
    });
  }

  setupNodes(audioContext) {
    super.setupNodes(audioContext);

    this.destroyAnalyzers(true);

    this.channelSplitter = null;
    this.channelMerger = null;
    this.channelNodes = Array.from({length: 6}, (_, i) => {
      const nodes = {
        gain: null,
        analyzer: null,
        postSplit: new VirtualAudioNode(`AudioChannelMixer postSplit ${i}`),
        preGain: new VirtualAudioNode(`AudioChannelMixer preGain ${i}`),
        preMerge: new VirtualAudioNode(`AudioChannelMixer preMerge ${i}`),
        equalizer: new AudioEqualizer(`${CHANNEL_NAMES[i]} `),
        compressor: new AudioCompressor(true, `${CHANNEL_NAMES[i]} `),
      };

      nodes.compressor.setupNodes(audioContext);
      nodes.equalizer.setupNodes(audioContext);

      if (this.channelConfigs && this.channelConfigs[i]) {
        const channel = this.channelConfigs[i];
        nodes.equalizer.setConfig(channel.equalizerNodes);
        nodes.compressor.setConfig(channel.compressor);
      }

      nodes.postSplit.connect(nodes.equalizer.getInputNode());
      nodes.equalizer.getOutputNode().connect(nodes.compressor.getInputNode());
      nodes.compressor.getOutputNode().connect(nodes.preGain);

      nodes.equalizer.on('change', this.updateDynLabels.bind(this));
      nodes.compressor.on('change', this.updateDynLabels.bind(this));

      return nodes;
    });
    this.masterNodes = {
      gain: null,
      analyzer: null,
      postMerge: new VirtualAudioNode('AudioChannelMixer postMerge master'),
      equalizer: new AudioEqualizer('Master '),
      compressor: new AudioCompressor(false, 'Master '),
      preGain: new VirtualAudioNode(`AudioChannelMixer preGain master`),
    };
    this.masterNodes.compressor.setupNodes(audioContext);
    this.masterNodes.equalizer.setupNodes(audioContext);

    if (this.masterConfig) {
      this.masterNodes.equalizer.setConfig(this.masterConfig.equalizerNodes);
      this.masterNodes.compressor.setConfig(this.masterConfig.compressor);
    }

    this.masterNodes.postMerge.connect(this.masterNodes.equalizer.getInputNode());
    this.masterNodes.equalizer.getOutputNode().connect(this.masterNodes.compressor.getInputNode());
    this.masterNodes.compressor.getOutputNode().connect(this.masterNodes.preGain);

    this.masterNodes.equalizer.on('change', this.updateDynLabels.bind(this));
    this.masterNodes.compressor.on('change', this.updateDynLabels.bind(this));

    this.getInputNode().connect(this.masterNodes.postMerge);
    this.masterNodes.preGain.connect(this.getOutputNode());

    this.refreshMixer();
  }

  updateDynLabels() {
    if (!this.mixerChannelElements.length) return;

    this.channelNodes.forEach((nodes, i) => {
      const isEqActive = nodes.equalizer.hasNodes();
      const isCompActive = nodes.compressor.isEnabled();
      const els = this.mixerChannelElements[i];
      els.dynButton.classList.toggle('configured', isEqActive || isCompActive);
    });

    const isEqActive = this.masterNodes.equalizer.hasNodes();
    const isCompActive = this.masterNodes.compressor.isEnabled();
    const els = this.masterElements;
    els.dynButton.classList.toggle('configured', isEqActive || isCompActive);
  }

  updateNodes() {
    if (!this.audioContext) return;

    const gains = this.getChannelGainsFromConfig();
    if (!gains) {
      return;
    }

    const hasNonUnityMasterGain = this.masterConfig.gain !== 1;
    const isMono = this.masterConfig.mono;

    if (hasNonUnityMasterGain || isMono) {
      if (!this.masterNodes.gain) {
        this.masterNodes.gain = this.audioContext.createGain();
        this.masterNodes.preGain.disconnect(this.getOutputNode());
        this.masterNodes.preGain.connect(this.masterNodes.gain);
        this.getOutputNode().connectFrom(this.masterNodes.gain);
      }
      this.masterNodes.gain.gain.value = this.masterConfig.gain;

      if (isMono) {
        this.masterNodes.gain.channelCount = 1;
        this.masterNodes.gain.channelCountMode = 'explicit';
      } else {
        this.masterNodes.gain.channelCountMode = 'max';
      }
    } else {
      if (this.masterNodes.gain) {
        this.masterNodes.preGain.disconnect(this.masterNodes.gain);
        this.getOutputNode().disconnectFrom(this.masterNodes.gain);
        this.masterNodes.preGain.connect(this.getOutputNode());
        this.masterNodes.gain = null;
      }
    }

    const hasNonUnityChannelGains = gains.some((gain) => gain !== 1);
    const needsAnalyzer = this.needsAnalyzer();
    if (hasNonUnityChannelGains || needsAnalyzer) {
      if (!this.channelSplitter) {
        this.channelSplitter = this.audioContext.createChannelSplitter();
        this.channelMerger = this.audioContext.createChannelMerger();
        this.getInputNode().disconnect(this.masterNodes.postMerge);
        this.getInputNode().connect(this.channelSplitter);
        this.masterNodes.postMerge.connectFrom(this.channelMerger);

        this.channelNodes.forEach((nodes, i) => {
          nodes.postSplit.connectFrom(this.channelSplitter, i, 0);
          nodes.preGain.connect(nodes.preMerge);
          nodes.preMerge.connect(this.channelMerger, 0, i);
        });

        this.emit('upscale');
      }

      this.channelNodes.forEach((nodes, i) => {
        const gain = gains[i];
        if (gain === 1) {
          if (nodes.gain) {
            nodes.preGain.disconnect(nodes.gain);
            nodes.preMerge.disconnectFrom(nodes.gain);
            nodes.preGain.connect(nodes.preMerge);
            nodes.gain = null;
          }
        } else {
          if (!nodes.gain) {
            nodes.gain = this.audioContext.createGain();
            nodes.preGain.disconnect(nodes.preMerge);
            nodes.preGain.connect(nodes.gain);
            nodes.preMerge.connectFrom(nodes.gain);
          }

          nodes.gain.gain.value = gains[i];
        }
      });
    } else {
      if (this.channelSplitter) {
        this.getInputNode().disconnect(this.channelSplitter);
        this.masterNodes.postMerge.disconnectFrom(this.channelMerger);
        this.getInputNode().connect(this.masterNodes.postMerge);

        this.channelNodes.forEach((nodes, i) => {
          nodes.postSplit.disconnectFrom(this.channelSplitter, i, 0);
          if (nodes.gain) {
            nodes.preGain.disconnect(nodes.gain);
            nodes.preMerge.disconnectFrom(nodes.gain);
            nodes.gain = null;
          } else {
            nodes.preGain.disconnect(nodes.preMerge);
          }
          nodes.preMerge.disconnect(this.channelMerger, 0, i);
        });

        this.channelSplitter.disconnect();
        this.channelMerger.disconnect();

        this.channelSplitter = null;
        this.channelMerger = null;
        this.emit('upscale');
      }
    }
  }
}
