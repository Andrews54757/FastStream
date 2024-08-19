import {Localize} from '../../modules/Localize.mjs';
import {AudioUtils} from '../../utils/AudioUtils.mjs';
import {WebUtils} from '../../utils/WebUtils.mjs';
import {createKnob} from '../components/Knob.mjs';
import {AbstractAudioModule} from './AbstractAudioModule.mjs';

export class AudioCompressor extends AbstractAudioModule {
  constructor(skipSplitter = false, customTitlePrepend) {
    super('AudioCompressor');
    this.compressorNode = null;
    this.compressorGain = null;
    this.compressorConfig = null;
    this.dontPass = skipSplitter;
    this.customTitlePrepend = customTitlePrepend || '';
    this.renderCache = {};
    this.setupUI();
  }

  isEnabled() {
    return this.compressorConfig && this.compressorConfig.enabled;
  }

  getElement() {
    return this.ui.compressor;
  }

  setConfig(config) {
    this.compressorConfig = config;
    this.setupCompressorControls();
    this.updateCompressor();
    this.emit('upscale');
    this.emit('change');
  }

  setupUI() {
    this.ui = {};
    this.ui.compressor = WebUtils.create('div', null, 'compressor');

    this.ui.compressorTitle = WebUtils.create('div', null, 'compressor_title');
    this.ui.compressorTitle.textContent = this.customTitlePrepend + Localize.getMessage('audiocompressor_title');
    this.ui.compressor.appendChild(this.ui.compressorTitle);

    this.ui.compressorContainer = WebUtils.create('div', null, 'compressor_container');
    this.ui.compressor.appendChild(this.ui.compressorContainer);

    this.ui.compressorGraph = WebUtils.create('div', null, 'compressor_graph');
    this.ui.compressorContainer.appendChild(this.ui.compressorGraph);

    this.ui.compressorYAxis = WebUtils.create('div', null, 'compressor_y_axis');
    this.ui.compressorGraph.appendChild(this.ui.compressorYAxis);

    this.ui.compressorXAxis = WebUtils.create('div', null, 'compressor_x_axis');
    this.ui.compressorGraph.appendChild(this.ui.compressorXAxis);

    this.setupCompressorAxis();

    this.ui.compressorGraphContainer = WebUtils.create('div', null, 'compressor_graph_container');
    this.ui.compressorGraph.appendChild(this.ui.compressorGraphContainer);

    this.ui.compressorGraphCanvas = WebUtils.create('canvas', null, 'compressor_graph_canvas');
    this.ui.compressorGraphContainer.appendChild(this.ui.compressorGraphCanvas);

    this.ui.compressorGraphCtx = this.ui.compressorGraphCanvas.getContext('2d');

    this.ui.compressorControls = WebUtils.create('div', null, 'compressor_controls');
    this.ui.compressorContainer.appendChild(this.ui.compressorControls);

    this.setupCompressorControls();
  }

  setupCompressor() {
    this.ui.compressor.replaceChildren();
    this.updateCompressor();
  }

  updateCompressor() {
    if (!this.compressorConfig) return;

    const compressor = this.compressorConfig;
    this.ui.compressorToggle.textContent = compressor.enabled ? Localize.getMessage('audiocompressor_enabled') : Localize.getMessage('audiocompressor_disabled');
    this.ui.compressorToggle.classList.toggle('enabled', compressor.enabled);

    if (compressor.enabled) {
      this.createCompressorNodes();
      this.compressorNode.threshold.value = compressor.threshold;
      this.compressorNode.knee.value = compressor.knee;
      this.compressorNode.ratio.value = compressor.ratio;
      this.compressorNode.attack.value = compressor.attack;
      this.compressorNode.release.value = compressor.release;
      this.compressorGain.gain.value = compressor.gain;
    } else {
      this.destroyCompressorNodes();
    }
  }

  createCompressorNodes() {
    if (this.compressorNode) return;

    const audioContext = this.audioContext;

    this.compressorNode = audioContext.createDynamicsCompressor();
    this.compressorGain = audioContext.createGain();

    this.compressorNode.connect(this.compressorGain);

    if (!this.dontPass) {
      this.splitterNode = audioContext.createChannelSplitter(6);
      this.mergerNode = audioContext.createChannelMerger(6);
      this.compressorMerger = audioContext.createChannelMerger(2);
      this.compressorSplitter = audioContext.createChannelSplitter(2);

      for (let i = 2; i < 6; i++) {
        this.splitterNode.connect(this.mergerNode, i, i);
      }

      this.splitterNode.connect(this.compressorMerger, 0, 0);
      this.splitterNode.connect(this.compressorMerger, 1, 1);

      this.compressorMerger.connect(this.compressorNode);
      this.compressorGain.connect(this.compressorSplitter);

      this.compressorSplitter.connect(this.mergerNode, 0, 0);
      this.compressorSplitter.connect(this.mergerNode, 1, 1);

      this.getInputNode().disconnect(this.getOutputNode());
      this.getInputNode().connect(this.splitterNode);
      this.getOutputNode().connectFrom(this.mergerNode);
    } else {
      this.getInputNode().disconnect(this.getOutputNode());
      this.getInputNode().connect(this.compressorNode);
      this.getOutputNode().connectFrom(this.compressorGain);
    }
  }

  destroyCompressorNodes(skipDisconnect = false) {
    if (!this.compressorNode) return;

    if (!skipDisconnect) {
      if (!this.dontPass) {
        this.getInputNode().disconnect(this.splitterNode);
        this.splitterNode.disconnect(this.compressorMerger);
        this.compressorMerger.disconnect(this.compressorNode);
        this.compressorGain.disconnect(this.compressorSplitter);
        this.compressorSplitter.disconnect(this.mergerNode);
        this.getOutputNode().disconnectFrom(this.mergerNode);
      } else {
        this.getInputNode().disconnect(this.compressorNode);
        this.getOutputNode().disconnectFrom(this.compressorGain);
      }

      this.compressorNode.disconnect(this.compressorGain);
      this.getInputNode().connect(this.getOutputNode());
    }

    this.splitterNode = null;
    this.mergerNode = null;
    this.compressorMerger = null;
    this.compressorNode = null;
    this.compressorGain = null;
    this.compressorSplitter = null;
  }

  setupNodes(audioContext) {
    super.setupNodes(audioContext);
    this.getInputNode().connect(this.getOutputNode());
    this.destroyCompressorNodes(true);
    this.updateCompressor();
  }

  setupCompressorControls() {
    this.ui.compressorControls.replaceChildren();

    this.ui.compressorToggle = WebUtils.create('div', null, 'compressor_toggle');
    this.ui.compressorControls.appendChild(this.ui.compressorToggle);
    WebUtils.setupTabIndex(this.ui.compressorToggle);

    this.ui.compressorToggle.addEventListener('click', () => {
      this.compressorConfig.enabled = !this.compressorConfig.enabled;
      this.updateCompressor();
      this.emit('upscale');
      this.emit('change');
    });

    this.compressorKnobs = {};

    this.compressorKnobs.threshold = createKnob(Localize.getMessage('audiocompressor_threshold'), -80, 0, (val) => {
      if (this.compressorConfig && val !== this.compressorConfig.threshold) {
        this.compressorConfig.threshold = val;
        this.updateCompressor();
        this.emit('change');
      }
    }, 'dB');
    this.ui.compressorControls.appendChild(this.compressorKnobs.threshold.container);

    this.compressorKnobs.knee = createKnob(Localize.getMessage('audiocompressor_knee'), 0, 40, (val) => {
      if (this.compressorConfig && val !== this.compressorConfig.knee) {
        this.compressorConfig.knee = val;
        this.updateCompressor();
        this.emit('change');
      }
    }, 'dB');

    this.ui.compressorControls.appendChild(this.compressorKnobs.knee.container);

    this.compressorKnobs.ratio = createKnob(Localize.getMessage('audiocompressor_ratio'), 1, 20, (val) => {
      if (this.compressorConfig && val !== this.compressorConfig.ratio) {
        this.compressorConfig.ratio = val;
        this.updateCompressor();
        this.emit('change');
      }
    }, 'dB');
    this.ui.compressorControls.appendChild(this.compressorKnobs.ratio.container);

    this.compressorKnobs.attack = createKnob(Localize.getMessage('audiocompressor_attack'), 0, 1, (val) => {
      if (this.compressorConfig && val !== this.compressorConfig.attack) {
        this.compressorConfig.attack = val;
        this.updateCompressor();
        this.emit('change');
      }
    }, 's');
    this.ui.compressorControls.appendChild(this.compressorKnobs.attack.container);

    this.compressorKnobs.release = createKnob(Localize.getMessage('audiocompressor_release'), 0, 1, (val) => {
      if (this.compressorConfig && val !== this.compressorConfig.release) {
        this.compressorConfig.release = val;
        this.updateCompressor();
        this.emit('change');
      }
    }, 's');
    this.ui.compressorControls.appendChild(this.compressorKnobs.release.container);

    this.compressorKnobs.gain = createKnob(Localize.getMessage('audiocompressor_gain'), 0, 20, (val) => {
      if (this.compressorConfig && AudioUtils.dbToGain(val) !== this.compressorConfig.gain) {
        this.compressorConfig.gain = AudioUtils.dbToGain(val);
        this.updateCompressor();
        this.emit('change');
      }
    }, 'dB');
    this.ui.compressorControls.appendChild(this.compressorKnobs.gain.container);

    if (this.compressorConfig) {
      this.compressorKnobs.threshold.knob.val(this.compressorConfig.threshold);
      this.compressorKnobs.knee.knob.val(this.compressorConfig.knee);
      this.compressorKnobs.ratio.knob.val(this.compressorConfig.ratio);
      this.compressorKnobs.attack.knob.val(this.compressorConfig.attack);
      this.compressorKnobs.release.knob.val(this.compressorConfig.release);
      this.compressorKnobs.gain.knob.val(AudioUtils.gainToDB(this.compressorConfig.gain));
    }
  }
  setupCompressorAxis() {
    this.ui.compressorXAxis.replaceChildren();
    this.ui.compressorYAxis.replaceChildren();

    const maxDB = 0;
    const minDB = -80;

    for (let i = minDB; i <= maxDB; i += 10) {
      const tick = WebUtils.create('div', null, 'compressor_x_axis_tick');
      tick.style.left = `${(i - minDB) / (maxDB - minDB) * 100}%`;
      this.ui.compressorXAxis.appendChild(tick);

      if (i % 20 === 0) {
        const label = WebUtils.create('div', null, 'tick_label');
        label.textContent = `${i}`;
        tick.classList.add('major');
        tick.appendChild(label);
      } else {
        tick.classList.add('minor');
      }

      if (i === minDB || i === maxDB) {
        tick.classList.add('zero');
      }
    }

    for (let i = minDB; i <= maxDB; i += 10) {
      const tick = WebUtils.create('div', null, 'compressor_y_axis_tick');
      tick.style.top = `${(-i) / (maxDB - minDB) * 100}%`;
      this.ui.compressorYAxis.appendChild(tick);

      if (i % 20 === 0) {
        const label = WebUtils.create('div', null, 'tick_label');
        label.textContent = `${i}`;
        tick.classList.add('major');
        tick.appendChild(label);
      } else {
        tick.classList.add('minor');
      }

      if (i === minDB || i === maxDB) {
        tick.classList.add('zero');
      }
    }
  }

  getCompressorNewDBfromOldDB(db) {
    const compressor = this.compressorConfig;

    const threshold = compressor.threshold;
    const ratio = compressor.ratio;
    const slope = 1 / ratio;
    const knee = compressor.knee;

    if (db < threshold) { // no compression
      return db;
    } else if (db <= threshold + knee) { // soft knee
      const diff = db - threshold;
      return (slope - 1) * (diff * diff / 2) / knee + diff + threshold;
    } else { // hard knee
      const yOffset = (slope - 1) * (knee / 2) + knee + threshold;
      return slope * (db - threshold - knee) + yOffset;
    }
  }

  render() {
    if (!this.compressorConfig) return;

    const width = this.ui.compressorGraphCanvas.clientWidth * window.devicePixelRatio;
    const height = this.ui.compressorGraphCanvas.clientHeight * window.devicePixelRatio;

    if (width === 0 || height === 0) return;
    const ctx = this.ui.compressorGraphCtx;


    // draw line
    const minDB = -80;
    const maxDB = 0;
    const rangeDB = maxDB - minDB;


    const reduction = this.compressorNode ? this.compressorNode.reduction : 0;
    const threshold = this.compressorConfig.threshold;
    const knee = this.compressorConfig.knee;

    if (
      this.renderCache.width === width &&
      this.renderCache.height === height &&
      this.renderCache.reduction === reduction &&
      this.renderCache.threshold === threshold &&
      this.renderCache.knee === knee
    ) {
      return;
    }

    if (this.renderCache.width !== width || this.renderCache.height !== height) {
      this.ui.compressorGraphCanvas.width = width;
      this.ui.compressorGraphCanvas.height = height;
    }

    this.renderCache.width = width;
    this.renderCache.height = height;
    this.renderCache.reduction = reduction;
    this.renderCache.threshold = threshold;
    this.renderCache.knee = knee;

    ctx.clearRect(0, 0, width, height);

    ctx.beginPath();
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 2;
    // Draw response line
    for (let x = 0; x < width; x++) {
      const db = minDB + rangeDB * x / width;
      const newDB = this.getCompressorNewDBfromOldDB(db);

      const y = height - (newDB - minDB) * height / rangeDB;

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // draw threshold line
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(230, 0, 0, 0.7)';
    ctx.lineWidth = 1;
    const x = (threshold - minDB) * width / rangeDB;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    // draw knee line
    if (knee > 0) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.7)';
      ctx.lineWidth = 1;
      const x2 = (threshold + knee - minDB) * width / rangeDB;
      ctx.moveTo(x2, 0);
      ctx.lineTo(x2, height);
      ctx.stroke();
    }

    if (reduction !== 0) {
      // reduction line
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 200, 0, 0.7)';
      ctx.lineWidth = 1;
      const y = height - (reduction - minDB) * height / rangeDB;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }
}
