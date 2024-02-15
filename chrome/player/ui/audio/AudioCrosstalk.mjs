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
      inputgain: AudioUtils.dbToGain(this.crosstalkConfig.inputgain),
      decaygain: AudioUtils.dbToGain(this.crosstalkConfig.decaygain),
      endgain: AudioUtils.dbToGain(this.crosstalkConfig.endgain),
      centergain: AudioUtils.dbToGain(this.crosstalkConfig.centergain),
      microdelay: this.crosstalkConfig.microdelay,
    };
  }

  async updateCrosstalk() {
    if (!this.crosstalkConfig || this.settingUpCrosstalk) return;
    const crosstalk = this.crosstalkConfig;
    this.ui.crosstalkToggle.textContent = crosstalk.enabled ? Localize.getMessage('audiocrosstalk_enabled') : Localize.getMessage('audiocrosstalk_disabled');
    this.ui.crosstalkToggle.classList.toggle('enabled', crosstalk.enabled);

    if (crosstalk.enabled) {
      if (!this.crosstalkNode) {
        this.highpass = this.audioContext.createBiquadFilter();
        this.highpass.type = 'highpass';

        this.lowpass = this.audioContext.createBiquadFilter();
        this.lowpass.type = 'lowpass';

        this.highpass.connect(this.lowpass); // connect the highpass to the lowpass to make bandpass

        this.highpass_inv = this.audioContext.createBiquadFilter();
        this.highpass_inv.type = 'highpass';

        this.lowpass_inv = this.audioContext.createBiquadFilter();
        this.lowpass_inv.type = 'lowpass';

        this.sourceNode.disconnect(this.destinationNode);
        this.crosstalkNode = new Crosstalk.CrosstalkNode(this.audioContext, this.getCrosstalkConfigObj());

        this.settingUpCrosstalk = true;
        try {
          await this.crosstalkNode.init();
        } catch (e) {
          console.error('Error initializing crosstalk', e);
        }
        this.settingUpCrosstalk = false;

        this.sourceNode.connect(this.highpass);
        this.sourceNode.connect(this.highpass_inv);
        this.sourceNode.connect(this.lowpass_inv);
        this.lowpass.connect(this.crosstalkNode.getNode());
        this.crosstalkNode.getNode().connect(this.destinationNode);
        this.highpass_inv.connect(this.destinationNode);
        this.lowpass_inv.connect(this.destinationNode);
      } else {
        this.crosstalkNode.configure(this.getCrosstalkConfigObj());
      }

      this.highpass.frequency.value = crosstalk.highpass;
      this.lowpass.frequency.value = crosstalk.lowpass;
      this.highpass_inv.frequency.value = crosstalk.lowpass;
      this.lowpass_inv.frequency.value = crosstalk.highpass;
    } else {
      if (this.crosstalkNode) {
        this.sourceNode.disconnect(this.highpass);
        this.sourceNode.disconnect(this.highpass_inv);
        this.sourceNode.disconnect(this.lowpass_inv);
        this.highpass.disconnect(this.lowpass);
        this.lowpass.disconnect(this.crosstalkNode.getNode());
        this.crosstalkNode.getNode().disconnect(this.destinationNode);
        this.highpass_inv.disconnect(this.destinationNode);
        this.lowpass_inv.disconnect(this.destinationNode);
        this.sourceNode.connect(this.destinationNode);
        this.crosstalkNode.destroy();
        this.crosstalkNode = null;
        this.highpass = null;
        this.lowpass = null;
        this.highpass_inv = null;
        this.lowpass_inv = null;
      }
    }
  }

  setupNodes(audioContext, sourceNode, destinationNode) {
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

    this.crosstalkKnobs.inputgain = WebUtils.createKnob(Localize.getMessage('audiocrosstalk_inputgain'), -10, 10, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.inputgain) {
        this.crosstalkConfig.inputgain = val;
        this.updateCrosstalk();
      }
    }, 'dB');

    this.crosstalkKnobs.decaygain = WebUtils.createKnob(Localize.getMessage('audiocrosstalk_decaygain'), -10, -1, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.decaygain) {
        this.crosstalkConfig.decaygain = val;
        this.updateCrosstalk();
      }
    }, 'dB');

    this.crosstalkKnobs.endgain = WebUtils.createKnob(Localize.getMessage('audiocrosstalk_endgain'), -10, 10, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.endgain) {
        this.crosstalkConfig.endgain = val;
        this.updateCrosstalk();
      }
    }, 'dB');


    this.crosstalkKnobs.centergain = WebUtils.createKnob(Localize.getMessage('audiocrosstalk_centergain'), -10, 10, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.centergain) {
        this.crosstalkConfig.centergain = val;
        this.updateCrosstalk();
      }
    }, 'dB');


    this.crosstalkKnobs.microdelay = WebUtils.createKnob(Localize.getMessage('audiocrosstalk_microdelay'), 1, 100, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.microdelay) {
        this.crosstalkConfig.microdelay = val;
        this.updateCrosstalk();
      }
    }, 'µs');


    this.crosstalkKnobs.highpass = WebUtils.createKnob(Localize.getMessage('audiocrosstalk_highpass'), 20, 20000, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.highpass) {
        this.crosstalkConfig.highpass = val;
        this.updateCrosstalk();
      }
    }, 'Hz');


    this.crosstalkKnobs.lowpass = WebUtils.createKnob(Localize.getMessage('audiocrosstalk_lowpass'), 20, 20000, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.lowpass) {
        this.crosstalkConfig.lowpass = val;
        this.updateCrosstalk();
      }
    }, 'Hz');

    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.microdelay.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.decaygain.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.highpass.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.lowpass.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.inputgain.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.centergain.container);
    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.endgain.container);

    if (this.crosstalkConfig) {
      this.crosstalkKnobs.inputgain.knob.val(this.crosstalkConfig.inputgain);
      this.crosstalkKnobs.decaygain.knob.val(this.crosstalkConfig.decaygain);
      this.crosstalkKnobs.endgain.knob.val(this.crosstalkConfig.endgain);
      this.crosstalkKnobs.centergain.knob.val(this.crosstalkConfig.centergain);
      this.crosstalkKnobs.microdelay.knob.val(this.crosstalkConfig.microdelay);
      this.crosstalkKnobs.highpass.knob.val(this.crosstalkConfig.highpass);
      this.crosstalkKnobs.lowpass.knob.val(this.crosstalkConfig.lowpass);
    }
  }

  render() {

  }
}
