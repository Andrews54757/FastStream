import {Localize} from '../../modules/Localize.mjs';
import {Crosstalk} from '../../modules/crosstalk/Crosstalk.mjs';
import {AudioUtils} from '../../utils/AudioUtils.mjs';
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

    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.microdelay.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.decaygain.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.lowbypass.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.highbypass.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.centergain.container);

    if (this.crosstalkConfig) {
      this.crosstalkKnobs.decaygain.knob.val(this.crosstalkConfig.decaygain);
      this.crosstalkKnobs.centergain.knob.val(this.crosstalkConfig.centergain);
      this.crosstalkKnobs.microdelay.knob.val(this.crosstalkConfig.microdelay);
      this.crosstalkKnobs.lowbypass.knob.val(this.crosstalkConfig.lowbypass);
      this.crosstalkKnobs.highbypass.knob.val(this.crosstalkConfig.highbypass);
    }
  }

  render() {

  }
}
