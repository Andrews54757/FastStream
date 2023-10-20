import {AudioUtils} from '../../utils/AudioUtils.mjs';
import {Utils} from '../../utils/Utils.mjs';
import {WebUtils} from '../../utils/WebUtils.mjs';
import {AudioChannelControl} from './config/AudioChannelControl.mjs';


export class AudioChannelMixer {
  constructor() {
    this.channelSplitter = null;
    this.channelMerger = null;
    this.channelGains = [];
    this.channelAnalyzers = [];
    this.finalGain = null;
    this.finalAnalyser = null;
    this.channelMixerConfig = [];
    this.setupUI();
  }

  getElement() {
    return this.ui.mixer;
  }

  setChannelMixerConfig(config) {
    this.channelMixerConfig = config;
    this.refreshMixer();
  }

  getInputNode() {
    return this.channelSplitter;
  }

  getOutputNode() {
    return this.finalAnalyser;
  }

  setupUI() {
    this.ui = {};
    this.ui.mixer = WebUtils.create('div', null, 'mixer');

    this.ui.mixerTitle = WebUtils.create('div', null, 'mixer_title');
    this.ui.mixerTitle.textContent = 'Audio Channel Mixer';
    this.ui.mixer.appendChild(this.ui.mixerTitle);

    this.ui.mixerContainer = WebUtils.create('div', null, 'mixer_container');
    this.ui.mixer.appendChild(this.ui.mixerContainer);

    this.ui.channels = WebUtils.create('div', null, 'channels');
    this.ui.mixerContainer.appendChild(this.ui.channels);

    this.ui.master = WebUtils.create('div', null, 'master');
    this.ui.mixerContainer.appendChild(this.ui.master);
  }


  render() {
    const channels = this.channelMixerConfig;
    if (!channels) return;

    channels.forEach((channel) => {
      const analyzer = this.channelAnalyzers[channel.id];
      const els = this.mixerChannelElements[channel.id];

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

      const volume = AudioUtils.getVolume(analyzer);
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
    });
  }

  setChannelGain(channel, gain) {
    channel.gain = gain;
    if (this.channelGains && this.channelGains[channel.id]) {
      this.channelGains[channel.id].gain.value = gain;
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
    els.soloButton.title = 'Solo';
    els.buttons.appendChild(els.soloButton);

    els.muteButton = WebUtils.create('div', null, 'mixer_channel_mute');
    els.muteButton.textContent = 'M';
    els.muteButton.title = 'Mute';
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
      this.setChannelGain(channel, AudioUtils.dbToGain(db));
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
      const delta = Math.sign(e.deltaY);
      const ratio = parseFloat(els.volumeHandle.style.top) / 100;
      const db = AudioUtils.mixerPositionRatioToDB(ratio - delta * 0.05);
      els.volumeHandle.style.top = `${AudioUtils.mixerDBToPositionRatio(db) * 100}%`;
      this.setChannelGain(channel, AudioUtils.dbToGain(db));
    });

    const toggleMute = () => {
      channel.muted = !channel.muted;
      els.muteButton.classList.toggle('active', channel.mute);
      this.updateMixerNodes();
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
      this.updateMixerNodes();
    };


    els.volumeHandle.addEventListener('keydown', (e) => {
      const ratio = parseFloat(els.volumeHandle.style.top) / 100;
      if (e.key === 'ArrowUp') {
        e.stopPropagation();
        e.preventDefault();
        const db = AudioUtils.mixerPositionRatioToDB(ratio - 0.025);
        els.volumeHandle.style.top = `${AudioUtils.mixerDBToPositionRatio(db) * 100}%`;
        this.setChannelGain(channel, AudioUtils.dbToGain(db));
      } else if (e.key === 'ArrowDown') {
        e.stopPropagation();
        e.preventDefault();

        const db = AudioUtils.mixerPositionRatioToDB(ratio + 0.025);
        els.volumeHandle.style.top = `${AudioUtils.mixerDBToPositionRatio(db) * 100}%`;
        this.setChannelGain(channel, AudioUtils.dbToGain(db));
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
      this.mixerChannelElements.push(els);
    }

    const els = this.createMixerChannel(mixerChannels[6]);
    this.ui.master.appendChild(els.container);
    this.mixerChannelElements.push(els);

    this.updateMixerNodes();
  }

  updateMixerNodes() {
    const channels = this.channelMixerConfig;

    const soloChannel = channels.find((channel) => channel.solo);

    channels.forEach((channel, i) => {
      if (soloChannel && channel !== soloChannel && channel.id !== 6) {
        this.channelGains[channel.id].gain.value = 0;
      } else {
        this.channelGains[channel.id].gain.value = channel.muted ? 0 : channel.gain;
      }
    });
  }

  setupNodes(audioContext) {
    this.audioContext = audioContext;
    this.channelSplitter = this.audioContext.createChannelSplitter();
    this.channelMerger = this.audioContext.createChannelMerger();

    this.channelGains = [];
    this.channelAnalyzers = [];
    for (let i = 0; i < 6; i++) {
      const gain = this.audioContext.createGain();
      this.channelGains.push(gain);

      this.channelSplitter.connect(gain, i);

      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 32;
      analyser.maxDecibels = -20;

      this.channelAnalyzers.push(analyser);

      gain.connect(analyser);

      analyser.connect(this.channelMerger, 0, i);
    }

    this.finalGain = this.audioContext.createGain();
    this.channelMerger.connect(this.finalGain);

    this.finalAnalyser = this.audioContext.createAnalyser();
    this.finalAnalyser.fftSize = 32;
    this.finalAnalyser.maxDecibels = -20;
    this.finalGain.connect(this.finalAnalyser);

    this.channelGains.push(this.finalGain);
    this.channelAnalyzers.push(this.finalAnalyser);

    this.refreshMixer();
  }
}
