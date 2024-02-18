import {Localize} from '../../modules/Localize.mjs';
import {CrosstalkNode} from '../../modules/crosstalk/crosstalk.mjs';
import {AudioUtils} from '../../utils/AudioUtils.mjs';
import {Utils} from '../../utils/Utils.mjs';
import {WebUtils} from '../../utils/WebUtils.mjs';

export class AudioCrosstalk {
  constructor() {
    this.crosstalkNode = null;
    this.crosstalkConfig = null;
    this.setupUI();
  }

  getElement() {
    return this.ui.crosstalk;
  }

  getInputNode() {
    return this.crosstalkNode;
  }

  getOutputNode() {
    return this.crosstalkNode;
  }

  setCrosstalkConfig(config) {
    this.crosstalkConfig = config;
    this.setupCrosstalkControls();
    this.updateCrosstalk();
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
    return {
      microdelay: this.crosstalkConfig.microdelay,
      decaygain: AudioUtils.dbToGain(this.crosstalkConfig.decaygain),
      colorgain: AudioUtils.dbToGain(this.crosstalkConfig.colorgain),
      highbypass: this.crosstalkConfig.highbypass,
      lowbypass: this.crosstalkConfig.lowbypass,
    };
  }

  async updateCrosstalk() {
    if (!this.crosstalkConfig || this.settingUpCrosstalk) return;
    const crosstalk = this.crosstalkConfig;
    this.ui.crosstalkToggle.textContent = crosstalk.enabled ? Localize.getMessage('audiocrosstalk_enabled') : Localize.getMessage('audiocrosstalk_disabled');
    this.ui.crosstalkToggle.classList.toggle('enabled', crosstalk.enabled);

    if (crosstalk.enabled) {
      if (!this.crosstalkNode) {
        this.crosstalkNode = new CrosstalkNode(this.audioContext, this.getCrosstalkConfigObj());

        this.settingUpCrosstalk = true;
        try {
          await this.crosstalkNode.init();
        } catch (e) {
          this.settingUpCrosstalk = false;
          this.crosstalkNode = null;
          console.error('Failed to initialize crosstalk', e);
          return;
        }
        this.settingUpCrosstalk = false;
        this.sourceNode.disconnect(this.destinationNode);
        this.sourceNode.connect(this.crosstalkNode.input);
        this.crosstalkNode.output.connect(this.destinationNode);
      } else {
        this.crosstalkNode.configure(this.getCrosstalkConfigObj());
      }
    } else {
      if (this.crosstalkNode) {
        this.sourceNode.disconnect(this.crosstalkNode.input);
        this.crosstalkNode.output.disconnect(this.destinationNode);
        this.sourceNode.connect(this.destinationNode);
        this.crosstalkNode.destroy();
        this.crosstalkNode = null;
      }
    }
  }

  setupNodes(audioContext, sourceNode, destinationNode) {
    if (this.audioContext !== audioContext) {
      if (this.crosstalkNode) {
        this.crosstalkNode.destroy();
        this.crosstalkNode = null;
      }
    }
    this.audioContext = audioContext;
    this.sourceNode = sourceNode;
    this.destinationNode = destinationNode;

    this.updateCrosstalk();
  }

  calculateCrosstalkDelayAndDecay(speakerDistance, headDistance) {
    const speedOfSound = 34320; // cm/s
    const earToEarDistance = 17.5; // cm
    const l1 = Math.sqrt(Math.pow(earToEarDistance / 2 - speakerDistance / 2, 2) + headDistance * headDistance);
    const l2 = Math.sqrt(Math.pow(earToEarDistance / 2 + speakerDistance / 2, 2) + headDistance * headDistance);
    const dl = l2 - l1;

    return {
      microdelay: Utils.clamp(Math.round(dl / speedOfSound * 1e6), 30, 150),
      decaygain: Utils.clamp(Math.round(AudioUtils.gainToDB(l1 / l2) * 100) / 100, -10, -0.01),
    };
  }

  updateSuggestions() {
    const {microdelay, decaygain} = this.calculateCrosstalkDelayAndDecay(this.crosstalkConfig.speakerdistance, this.crosstalkConfig.headdistance);
    this.crosstalkKnobs.microdelay.setSuggestedValue(microdelay);
    this.crosstalkKnobs.decaygain.setSuggestedValue(decaygain);
  }

  setupCrosstalkControls() {
    this.ui.crosstalkControls.replaceChildren();

    this.ui.crosstalkToggle = WebUtils.create('div', null, 'compressor_toggle');
    this.ui.crosstalkControls.appendChild(this.ui.crosstalkToggle);
    WebUtils.setupTabIndex(this.ui.crosstalkToggle);

    this.ui.crosstalkToggle.addEventListener('click', () => {
      if (this.settingUpCrosstalk) return;
      this.crosstalkConfig.enabled = !this.crosstalkConfig.enabled;
      this.updateCrosstalk();
    });

    this.crosstalkKnobs = {};

    const calculatorContainer = WebUtils.create('div', null, 'crosstalk_calculator');

    const speakerDistanceContainer = WebUtils.create('div', null, 'crosstalk_calculator_input_container');
    const speakerDistanceLabel = WebUtils.create('label', null, 'crosstalk_calculator_label');
    speakerDistanceLabel.textContent = Localize.getMessage('audiocrosstalk_speakerdistance');
    speakerDistanceContainer.appendChild(speakerDistanceLabel);
    const speakerDistanceInput = WebUtils.create('input', null, 'crosstalk_calculator_input');
    speakerDistanceContainer.appendChild(speakerDistanceInput);
    calculatorContainer.appendChild(speakerDistanceContainer);

    speakerDistanceInput.addEventListener('input', () => {
      const val = parseFloat(speakerDistanceInput.value);
      if (this.crosstalkConfig && val !== this.crosstalkConfig.speakerdistance) {
        this.crosstalkConfig.speakerdistance = val;
        this.updateSuggestions();
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
    headDistanceContainer.appendChild(headDistanceInput);
    calculatorContainer.appendChild(headDistanceContainer);

    headDistanceInput.addEventListener('input', () => {
      const val = parseFloat(headDistanceInput.value);
      if (this.crosstalkConfig && val !== this.crosstalkConfig.headdistance) {
        this.crosstalkConfig.headdistance = val;
        this.updateSuggestions();
      }
    });

    headDistanceInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    this.crosstalkKnobs.decaygain = WebUtils.createKnob(Localize.getMessage('audiocrosstalk_decaygain'), -10, -0.01, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.decaygain) {
        this.crosstalkConfig.decaygain = val;
        this.updateCrosstalk();
      }
    }, 'dB');

    this.crosstalkKnobs.colorgain = WebUtils.createKnob(Localize.getMessage('audiocrosstalk_colorgain'), 0, 20, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.colorgain) {
        this.crosstalkConfig.colorgain = val;
        this.updateCrosstalk();
      }
    }, 'dB');


    this.crosstalkKnobs.microdelay = WebUtils.createKnob(Localize.getMessage('audiocrosstalk_microdelay'), 30, 150, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.microdelay) {
        this.crosstalkConfig.microdelay = val;
        this.updateCrosstalk();
      }
    }, 'µs');


    this.crosstalkKnobs.lowbypass = WebUtils.createKnob(Localize.getMessage('audiocrosstalk_lowbypass'), 20, 2000, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.lowbypass) {
        this.crosstalkConfig.lowbypass = val;
        this.updateCrosstalk();
      }
    }, 'Hz');


    this.crosstalkKnobs.highbypass = WebUtils.createKnob(Localize.getMessage('audiocrosstalk_highbypass'), 2000, 20000, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.highbypass) {
        this.crosstalkConfig.highbypass = val;
        this.updateCrosstalk();
      }
    }, 'Hz');

    this.ui.crosstalkControls.appendChild(calculatorContainer);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.microdelay.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.decaygain.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.colorgain.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.lowbypass.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.highbypass.container);

    if (this.crosstalkConfig) {
      speakerDistanceInput.value = this.crosstalkConfig.speakerdistance + ' cm';
      headDistanceInput.value = this.crosstalkConfig.headdistance + ' cm';

      this.crosstalkKnobs.decaygain.knob.val(this.crosstalkConfig.decaygain);
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
