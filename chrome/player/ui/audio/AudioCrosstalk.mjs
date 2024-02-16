import {Localize} from '../../modules/Localize.mjs';
import {Crosstalk} from '../../modules/crosstalk/Crosstalk.mjs';
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
      decaygain: AudioUtils.dbToGain(this.crosstalkConfig.decaygain),
      centergain: AudioUtils.dbToGain(this.crosstalkConfig.centergain),
      microdelay: this.crosstalkConfig.microdelay,
      lowbypass: this.crosstalkConfig.lowbypass,
      highbypass: this.crosstalkConfig.highbypass,
    };
  }

  async updateCrosstalk() {
    if (!this.crosstalkConfig || this.settingUpCrosstalk) return;
    const crosstalk = this.crosstalkConfig;
    this.ui.crosstalkToggle.textContent = crosstalk.enabled ? Localize.getMessage('audiocrosstalk_enabled') : Localize.getMessage('audiocrosstalk_disabled');
    this.ui.crosstalkToggle.classList.toggle('enabled', crosstalk.enabled);

    if (crosstalk.enabled) {
      if (!this.crosstalkNode) {
        this.sourceNode.disconnect(this.destinationNode);
        this.crosstalkNode = new Crosstalk.CrosstalkNode(this.audioContext, this.getCrosstalkConfigObj());

        this.settingUpCrosstalk = true;
        try {
          await this.crosstalkNode.init();
        } catch (e) {
          console.error('Error initializing crosstalk', e);
        }
        this.settingUpCrosstalk = false;
        this.sourceNode.connect(this.crosstalkNode.getNode());
        this.crosstalkNode.getNode().connect(this.destinationNode);
      } else {
        this.crosstalkNode.configure(this.getCrosstalkConfigObj());
      }
    } else {
      if (this.crosstalkNode) {
        this.sourceNode.disconnect(this.crosstalkNode.getNode());
        this.crosstalkNode.getNode().disconnect(this.destinationNode);
        this.sourceNode.connect(this.destinationNode);
        this.crosstalkNode.destroy();
        this.crosstalkNode = null;
      }
    }
  }

  setupNodes(audioContext, sourceNode, destinationNode) {
    if (this.audioContext !== audioContext) {
      if (this.crosstalkNode) {
        this.crosstalkNode.getNode().disconnect();
        this.crosstalkNode.destroy();
        this.crosstalkNode = null;
      }
    }
    this.audioContext = audioContext;
    this.sourceNode = sourceNode;
    this.destinationNode = destinationNode;

    this.updateCrosstalk();
  }

  calculateCrosstalkDelay(speakerDistance, headDistance) {
    const speedOfSound = 343.2; // m/s
    const earToEarDistance = 17.5e-2; // m
    const ratio = speakerDistance / headDistance / 2;

    if (ratio > 1 || headDistance === 0) {
      return null;
    }

    const delay = 1e6 * earToEarDistance/2 * (Math.asin(ratio) + ratio) / speedOfSound;

    return Math.round(Utils.clamp(delay, 30, 120));
  }

  calculateCrosstalkDecayGain(delay) {
    return Math.round(Utils.clamp(-(0.016667 * (delay - 17) + 1.8), -10, -1) * 100) / 100;
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

    this.crosstalkKnobs.speakerdistance = WebUtils.createKnob(Localize.getMessage('audiocrosstalk_speakerdistance'), 1, 100, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.speakerdistance) {
        this.crosstalkConfig.speakerdistance = val;
        this.crosstalkKnobs.microdelay.setSuggestedValue(this.calculateCrosstalkDelay(this.crosstalkConfig.speakerdistance, this.crosstalkConfig.headdistance));
      }
    }, 'cm');

    this.crosstalkKnobs.headdistance = WebUtils.createKnob(Localize.getMessage('audiocrosstalk_headdistance'), 1, 100, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.headdistance) {
        this.crosstalkConfig.headdistance = val;
        this.crosstalkKnobs.microdelay.setSuggestedValue(this.calculateCrosstalkDelay(this.crosstalkConfig.speakerdistance, this.crosstalkConfig.headdistance));
      }
    }, 'cm');


    this.crosstalkKnobs.decaygain = WebUtils.createKnob(Localize.getMessage('audiocrosstalk_decaygain'), -10, -1, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.decaygain) {
        this.crosstalkConfig.decaygain = val;
        this.updateCrosstalk();
      }
    }, 'dB');

    this.crosstalkKnobs.centergain = WebUtils.createKnob(Localize.getMessage('audiocrosstalk_centergain'), -10, 10, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.centergain) {
        this.crosstalkConfig.centergain = val;
        this.updateCrosstalk();
      }
    }, 'dB');


    this.crosstalkKnobs.microdelay = WebUtils.createKnob(Localize.getMessage('audiocrosstalk_microdelay'), 30, 150, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.microdelay) {
        this.crosstalkConfig.microdelay = val;
        this.crosstalkKnobs.decaygain.setSuggestedValue(this.calculateCrosstalkDecayGain(val));
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

    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.speakerdistance.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.headdistance.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.microdelay.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.decaygain.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.lowbypass.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.highbypass.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.centergain.container);

    if (this.crosstalkConfig) {
      this.crosstalkKnobs.speakerdistance.knob.val(this.crosstalkConfig.speakerdistance);
      this.crosstalkKnobs.headdistance.knob.val(this.crosstalkConfig.headdistance);

      this.crosstalkKnobs.decaygain.knob.val(this.crosstalkConfig.decaygain);
      this.crosstalkKnobs.centergain.knob.val(this.crosstalkConfig.centergain);
      this.crosstalkKnobs.microdelay.knob.val(this.crosstalkConfig.microdelay);
      this.crosstalkKnobs.lowbypass.knob.val(this.crosstalkConfig.lowbypass);
      this.crosstalkKnobs.highbypass.knob.val(this.crosstalkConfig.highbypass);
      this.crosstalkKnobs.microdelay.setSuggestedValue(this.calculateCrosstalkDelay(this.crosstalkConfig.speakerdistance, this.crosstalkConfig.headdistance));
      this.crosstalkKnobs.decaygain.setSuggestedValue(this.calculateCrosstalkDecayGain(this.crosstalkConfig.microdelay));
    }
  }

  render() {

  }
}
