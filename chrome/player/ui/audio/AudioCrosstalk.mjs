import {Localize} from '../../modules/Localize.mjs';
import {Crosstalk} from '../../modules/crosstalk/Crosstalk.mjs';
import {Knob} from '../../modules/knob.mjs';
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
  createKnob(name, minValue, maxValue, callback, units = '') {
    const knobContainer = WebUtils.create('div', null, 'knob_container');
    const knobName = WebUtils.create('div', null, 'knob_name');
    knobName.textContent = name;
    knobContainer.appendChild(knobName);

    const knobMinValueTick = WebUtils.create('div', null, 'knob_min_value_tick');
    knobContainer.appendChild(knobMinValueTick);

    const knobMinValueLabel = WebUtils.create('div', null, 'knob_min_value_label');
    knobMinValueLabel.textContent = minValue;
    knobContainer.appendChild(knobMinValueLabel);

    const knobMaxValueTick = WebUtils.create('div', null, 'knob_max_value_tick');
    knobContainer.appendChild(knobMaxValueTick);

    const knobMaxValueLabel = WebUtils.create('div', null, 'knob_max_value_label');
    knobMaxValueLabel.textContent = maxValue;
    knobContainer.appendChild(knobMaxValueLabel);

    const knobKnobContainer = WebUtils.create('div', null, 'knob_knob_container');
    knobContainer.appendChild(knobKnobContainer);

    const knobKnob = WebUtils.create('div', null, 'knob_knob');
    const knobBump = WebUtils.create('div', null, 'knob_bump');
    knobKnob.appendChild(knobBump);
    knobKnobContainer.appendChild(knobKnob);

    const knobValue = WebUtils.create('div', null, 'knob_value');
    knobContainer.appendChild(knobValue);
    knobValue.contentEditable = true;

    const decimals = Utils.clamp(3 - Math.ceil(Math.log10(maxValue - minValue)), 0, 3);

    let shouldCall = false;
    const knob = new Knob(knobKnob, (knob, indicator) => {
      knobKnob.style.transform = `rotate(-${indicator.angle}deg)`;
      // dont update the value if the user is editing it
      if (knobValue !== document.activeElement) {
        knobValue.textContent = knob.val().toFixed(decimals) + ' ' + units;
      }

      if (shouldCall && callback) {
        callback(knob.val());
      }
    });

    knobValue.addEventListener('input', () => {
      const val = parseFloat(knobValue.textContent.replace(units, ''));
      if (isNaN(val)) {
        return;
      }
      knob.val(val);
    });

    knobValue.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        knobValue.blur();
      }
    });

    knobValue.addEventListener('blur', (e) => {
      const val = parseFloat(knobValue.textContent.replace(units, ''));
      knob.val(val);
    });

    knob.options.indicatorAutoRotate = true;
    knob.options.angleEnd = 315;
    knob.options.angleStart = 45;
    knob.options.valueMin = minValue;
    knob.options.valueMax = maxValue;
    knob.val(minValue);

    setTimeout(() => {
      shouldCall = true;
    }, 1);


    const container = knobKnobContainer;
    const rect = container.getBoundingClientRect();
    knob.setPosition(rect.left, rect.top);
    knob.setDimensions(50, 50);

    const mouseMove = (e) => {
      knob.doTouchMove([{
        pageX: e.pageX,
        pageY: e.pageY,
      }], e.timeStamp);
      e.preventDefault();
    };

    const mouseUp = (e) => {
      knob.doTouchEnd(e.timeStamp);
      document.removeEventListener('mousemove', mouseMove);
      document.removeEventListener('mouseup', mouseUp);
    };

    container.addEventListener('mousedown', (e) => {
      const rect = container.getBoundingClientRect();
      knob.setPosition(rect.left, rect.top);

      knob.doTouchStart([{
        pageX: e.pageX,
        pageY: e.pageY,
      }], e.timeStamp);

      document.addEventListener('mousemove', mouseMove);
      document.addEventListener('mouseup', mouseUp);
    });

    // Handle scroll
    container.addEventListener('wheel', function(e) {
      // reset the position in case knob moved
      knob.setPosition(container.offsetLeft, container.offsetTop);

      const delta = -e.wheelDelta;
      knob.doMouseScroll(delta, e.timeStamp, e.pageX, e.pageY);

      e.preventDefault();
    });


    return {
      container: knobContainer,
      knob: knob,
    };
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

    this.crosstalkKnobs.inputgain = this.createKnob(Localize.getMessage('audiocrosstalk_inputgain'), -10, 10, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.inputgain) {
        this.crosstalkConfig.inputgain = val;
        this.updateCrosstalk();
      }
    }, 'dB');

    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.inputgain.container);

    this.crosstalkKnobs.decaygain = this.createKnob(Localize.getMessage('audiocrosstalk_decaygain'), -10, -1, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.decaygain) {
        this.crosstalkConfig.decaygain = val;
        this.updateCrosstalk();
      }
    }, 'dB');

    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.decaygain.container);

    this.crosstalkKnobs.endgain = this.createKnob(Localize.getMessage('audiocrosstalk_endgain'), -10, 10, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.endgain) {
        this.crosstalkConfig.endgain = val;
        this.updateCrosstalk();
      }
    }, 'dB');

    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.endgain.container);

    this.crosstalkKnobs.centergain = this.createKnob(Localize.getMessage('audiocrosstalk_centergain'), -10, 10, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.centergain) {
        this.crosstalkConfig.centergain = val;
        this.updateCrosstalk();
      }
    }, 'dB');

    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.centergain.container);

    this.crosstalkKnobs.microdelay = this.createKnob(Localize.getMessage('audiocrosstalk_microdelay'), 1, 100, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.microdelay) {
        this.crosstalkConfig.microdelay = val;
        this.updateCrosstalk();
      }
    }, 'us');

    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.microdelay.container);

    this.crosstalkKnobs.highpass = this.createKnob(Localize.getMessage('audiocrosstalk_highpass'), 20, 2000, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.highpass) {
        this.crosstalkConfig.highpass = val;
        this.updateCrosstalk();
      }
    }, 'Hz');

    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.highpass.container);

    this.crosstalkKnobs.lowpass = this.createKnob(Localize.getMessage('audiocrosstalk_lowpass'), 3000, 8000, (val) => {
      if (this.crosstalkConfig && val !== this.crosstalkConfig.lowpass) {
        this.crosstalkConfig.lowpass = val;
        this.updateCrosstalk();
      }
    }, 'Hz');

    this.ui.crosstalkControls.appendChild(this.crosstalkKnobs.lowpass.container);

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
