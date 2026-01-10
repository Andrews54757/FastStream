import {Localize} from '../../modules/Localize.mjs';
import {CrosstalkNode} from '../../modules/crosstalk/crosstalk.mjs';
import {AudioUtils} from '../../utils/AudioUtils.mjs';
import {Utils} from '../../utils/Utils.mjs';
import {WebUtils} from '../../utils/WebUtils.mjs';
import {createKnob} from '../components/Knob.mjs';
import {AbstractAudioModule} from './AbstractAudioModule.mjs';
export class AudioCrosstalk extends AbstractAudioModule {
  constructor() {
    super('AudioCrosstalk');
    this.crosstalkNode = null;
    this.crosstalkConfig = null;
    this.speakerDistance = 30;
    this.headDistance = 60;
    this.loadDistanceConfig();
    this.setupUI();
  }
  loadDistanceConfig() {
    const items = localStorage.getItem('audiocrosstalk_distanceconfig') || '{}';
    try {
      const obj = JSON.parse(items);
      if (typeof obj.speakerDistance === 'number' && typeof obj.headDistance === 'number') {
        this.speakerDistance = obj.speakerDistance;
        this.headDistance = obj.headDistance;
      }
    } catch (e) {
    }
  }
  saveDistanceConfig() {
    const obj = {
      speakerDistance: this.speakerDistance,
      headDistance: this.headDistance,
    };
    localStorage.setItem('audiocrosstalk_distanceconfig', JSON.stringify(obj));
  }
  needsUpscaler() {
    return this.crosstalkConfig && this.crosstalkConfig.enabled;
  }
  getElement() {
    return this.ui.crosstalk;
  }
  setCrosstalkConfig(config) {
    this.crosstalkConfig = config;
    this.setupCrosstalkControls();
    this.updateCrosstalk();
    this.emit('upscale');
  }
  setupUI() {
    this.ui = {};
    this.ui.crosstalk = WebUtils.create('div', null, 'crosstalk');
    this.ui.crosstalkTitle = WebUtils.create('div', null, 'compressor_title');
    this.ui.crosstalkTitle.textContent = Localize.getMessage('audiocrosstalk_title');
    this.ui.crosstalk.appendChild(this.ui.crosstalkTitle);
    this.ui.crosstalkContainer = WebUtils.create('div', null, 'crosstalk_container');
    this.ui.crosstalk.appendChild(this.ui.crosstalkContainer);
    this.ui.crosstalkControls = WebUtils.create('div', null, 'crosstalk_controls');
    this.ui.crosstalkContainer.appendChild(this.ui.crosstalkControls);
    this.setupCrosstalkControls();
  }
  setupCrosstalk() {
    this.ui.crosstalk.replaceChildren();
    this.updateCrosstalk();
  }
  getCrosstalkConfigObj() {
    const predicted = this.calculateCrosstalkDelayAndDecay(this.speakerDistance, this.headDistance);
    return {
      microdelay: isNaN(this.crosstalkConfig.microdelay) ? predicted.microdelay : this.crosstalkConfig.microdelay,
      decay: AudioUtils.dbToGain(isNaN(this.crosstalkConfig.decay) ? predicted.decay : this.crosstalkConfig.decay),
      colorgain: this.crosstalkConfig.colorgain === 20 ? Infinity : AudioUtils.dbToGain(this.crosstalkConfig.colorgain),
      highbypass: this.crosstalkConfig.highbypass,
      lowbypass: this.crosstalkConfig.lowbypass,
    };
  }
  async updateCrosstalk() {
    if (!this.crosstalkConfig) return;
    const crosstalk = this.crosstalkConfig;
    this.ui.crosstalkToggle.textContent = crosstalk.enabled ? Localize.getMessage('audiocrosstalk_enabled') : Localize.getMessage('audiocrosstalk_disabled');
    this.ui.crosstalkToggle.classList.toggle('enabled', crosstalk.enabled);
    if (crosstalk.enabled) {
      this.createCrosstalkNode();
      this.crosstalkNode?.configure(this.getCrosstalkConfigObj());
    } else {
      this.removeCrosstalkNode();
    }
  }
  async createCrosstalkNode() {
    if (this.crosstalkNode || !this.audioContext) {
      return;
    }
    this.crosstalkNode = new CrosstalkNode(this.audioContext, this.getCrosstalkConfigObj());
    const node = this.crosstalkNode;
    try {
      await this.crosstalkNode.init();
    } catch (e) {
      this.crosstalkNode = null;
      console.error('Failed to initialize crosstalk', e);
      return;
    }
    if (this.crosstalkNode !== node) {
      node.destroy();
      return;
    }
    this.getInputNode().disconnect(this.getOutputNode());
    this.getInputNode().connect(this.crosstalkNode.getInputNode());
    this.getOutputNode().connectFrom(this.crosstalkNode.getOutputNode());
  }
  removeCrosstalkNode() {
    if (!this.crosstalkNode) {
      return;
    }
    this.getInputNode().disconnect(this.crosstalkNode.getInputNode());
    this.getOutputNode().disconnectFrom(this.crosstalkNode.getOutputNode());
    this.getInputNode().connect(this.getOutputNode());
    this.crosstalkNode.destroy();
    this.crosstalkNode = null;
  }
  setupNodes(audioContext) {
    super.setupNodes(audioContext);
    if (this.crosstalkNode) {
      this.crosstalkNode.destroy();
      this.crosstalkNode = null;
    }
    this.getInputNode().connect(this.getOutputNode());
    this.updateCrosstalk();
  }
  calculateCrosstalkDelayAndDecay(speakerDistance, headDistance) {
    const speedOfSound = 34320; // cm/s
    const earToEarDistance = 17.5; // cm
    const l1 = Math.sqrt(Math.pow(earToEarDistance / 2 - speakerDistance / 2, 2) + headDistance * headDistance);
    const l2 = Math.sqrt(Math.pow(earToEarDistance / 2 + speakerDistance / 2, 2) + headDistance * headDistance);
    const dl = l2 - l1;
    return {
      microdelay: Utils.clamp(Math.round(dl / speedOfSound * 1e6), 30, 200),
      decay: Utils.clamp(AudioUtils.gainToDB(l1 / l2).toFixed(3), -5, -0.01),
    };
  }
  updateSuggestions() {
    const {microdelay, decay} = this.calculateCrosstalkDelayAndDecay(this.speakerDistance, this.headDistance);
    this.crosstalkKnobs.microdelay.setSuggestedValue(microdelay);
    this.crosstalkKnobs.decay.setSuggestedValue(decay);
  }
  setupCrosstalkControls() {
    this.ui.crosstalkControls.replaceChildren();
    this.ui.crosstalkToggle = WebUtils.create('div', null, 'compressor_toggle');
    this.ui.crosstalkControls.appendChild(this.ui.crosstalkToggle);
    WebUtils.setupTabIndex(this.ui.crosstalkToggle);
    this.ui.crosstalkToggle.addEventListener('click', () => {
      this.crosstalkConfig.enabled = !this.crosstalkConfig.enabled;
      this.updateCrosstalk();
      this.emit('upscale');
    });
    this.crosstalkKnobs = {};
    const calculatorContainer = WebUtils.create('div', null, 'crosstalk_calculator');
    const speakerDistanceContainer = WebUtils.create('div', null, 'crosstalk_calculator_input_container');
    const speakerDistanceLabel = WebUtils.create('label', null, 'crosstalk_calculator_label');
    speakerDistanceLabel.textContent = Localize.getMessage('audiocrosstalk_speakerdistance');
    speakerDistanceContainer.appendChild(speakerDistanceLabel);
    const speakerDistanceInput = WebUtils.create('input', null, 'crosstalk_calculator_input');
    speakerDistanceInput.ariaLabel = speakerDistanceLabel.textContent;
    speakerDistanceContainer.appendChild(speakerDistanceInput);
    calculatorContainer.appendChild(speakerDistanceContainer);
    speakerDistanceInput.addEventListener('input', () => {
      const val = parseFloat(speakerDistanceInput.value);
      if (val !== this.speakerDistance) {
        this.speakerDistance = val;
        this.updateSuggestions();
        this.saveDistanceConfig();
      }
    });
    speakerDistanceInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });
    const headDistanceContainer = WebUtils.create('div', null, 'crosstalk_calculator_input_container');
    const headDistanceLabel = WebUtils.create('label', null, 'crosstalk_calculator_label');
    headDistanceLabel.textContent = Localize.getMessage('audiocrosstalk_headdistance');
    headDistanceContainer.appendChild(headDistanceLabel);
    const headDistanceInput = WebUtils.create('input', null, 'crosstalk_calculator_input');
    headDistanceInput.ariaLabel = headDistanceLabel.textContent;
    headDistanceContainer.appendChild(headDistanceInput);
    calculatorContainer.appendChild(headDistanceContainer);
    headDistanceInput.addEventListener('input', () => {
      const val = parseFloat(headDistanceInput.value);
      if (val !== this.headDistance) {
        this.headDistance = val;
        this.updateSuggestions();
        this.saveDistanceConfig();
      }
    });
    headDistanceInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });
    this.crosstalkKnobs.decay = createKnob(Localize.getMessage('audiocrosstalk_decay'), -5, -0.01, (val, isSuggested) => {
      if (isSuggested) {
        val = NaN;
      }
      if (this.crosstalkConfig && val !== this.crosstalkConfig.decay) {
        this.crosstalkConfig.decay = val;
        this.updateCrosstalk();
      }
    }, 'dB');
    this.crosstalkKnobs.colorgain = createKnob(Localize.getMessage('audiocrosstalk_colorgain'), 0, 20, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.colorgain) {
        this.crosstalkConfig.colorgain = val;
        this.updateCrosstalk();
      }
    }, 'dB');
    this.crosstalkKnobs.microdelay = createKnob(Localize.getMessage('audiocrosstalk_microdelay'), 30, 200, (val, isSuggested) => {
      if (isSuggested) {
        val = NaN;
      }
      if (this.crosstalkConfig && val !== this.crosstalkConfig.microdelay) {
        this.crosstalkConfig.microdelay = val;
        this.updateCrosstalk();
      }
    }, 'µs');
    this.crosstalkKnobs.lowbypass = createKnob(Localize.getMessage('audiocrosstalk_lowbypass'), 20, 2000, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.lowbypass) {
        this.crosstalkConfig.lowbypass = val;
        this.updateCrosstalk();
      }
    }, 'Hz');
    this.crosstalkKnobs.highbypass = createKnob(Localize.getMessage('audiocrosstalk_highbypass'), 2000, 20000, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.highbypass) {
        this.crosstalkConfig.highbypass = val;
        this.updateCrosstalk();
      }
    }, 'Hz');
    this.ui.crosstalkControls.appendChild(calculatorContainer);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.microdelay.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.decay.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.colorgain.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.lowbypass.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.highbypass.container);
    if (this.crosstalkConfig) {
      speakerDistanceInput.value = this.speakerDistance + ' cm';
      headDistanceInput.value = this.headDistance + ' cm';
      this.crosstalkKnobs.decay.knob.val(this.crosstalkConfig.decay);
      this.crosstalkKnobs.colorgain.knob.val(this.crosstalkConfig.colorgain);
      this.crosstalkKnobs.microdelay.knob.val(this.crosstalkConfig.microdelay);
      this.crosstalkKnobs.lowbypass.knob.val(this.crosstalkConfig.lowbypass);
      this.crosstalkKnobs.highbypass.knob.val(this.crosstalkConfig.highbypass);
      this.updateSuggestions();
    }
  }
  render() {
  }
}
