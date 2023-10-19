import {EventEmitter} from '../modules/eventemitter.mjs';
import {Knob} from '../modules/knob.mjs';
import {InterfaceUtils} from '../utils/InterfaceUtils.mjs';
import {StringUtils} from '../utils/StringUtils.mjs';
import {Utils} from '../utils/Utils.mjs';
import {WebUtils} from '../utils/WebUtils.mjs';
import {DOMElements} from './DOMElements.mjs';

export class AudioEQNode {
  constructor(type, frequency, gain, q) {
    this.type = type;
    this.frequency = parseFloat(frequency);
    this.gain = parseFloat(gain);
    this.q = parseFloat(q);
  }

  static fromObj(obj) {
    return new AudioEQNode(obj.type, obj.frequency, obj.gainDb === undefined ? obj.gain : obj.gainDb, obj.q);
  }

  toObj() {
    return {
      type: this.type,
      frequency: this.frequency,
      gainDb: this.gain,
      q: this.q,
    };
  }
}

export class AudioCompressionControl {
  constructor(enabled, attack, knee, ratio, release, threshold, gain) {
    this.enabled = !!enabled;
    this.attack = parseFloat(attack);
    this.knee = parseFloat(knee);
    this.ratio = parseFloat(ratio);
    this.release = parseFloat(release);
    this.threshold = parseFloat(threshold);
    this.gain = parseFloat(gain);
  }

  static fromObj(obj) {
    return new AudioCompressionControl(obj.enabled, obj.attack, obj.knee, obj.ratio, obj.release, obj.threshold, obj.gain);
  }

  toObj() {
    return {
      enabled: this.enabled,
      attack: this.attack,
      knee: this.knee,
      ratio: this.ratio,
      release: this.release,
      threshold: this.threshold,
      gain: this.gain,
    };
  }
}

export class AudioChannelControl {
  constructor(channelId, gain, muted, solo) {
    this.id = parseInt(channelId);
    this.gain = parseFloat(gain);
    this.muted = muted;
    this.solo = solo;
  }

  static fromObj(obj) {
    return new AudioChannelControl(obj.id === 'master' ? 6 : obj.id, obj.gain, obj.muted, obj.solo);
  }

  toObj() {
    return {
      id: this.id === 6 ? 'master' : this.id,
      gain: this.gain,
      muted: this.muted,
      solo: this.solo,
    };
  }
}

export class AudioProfile {
  constructor(id) {
    this.id = parseInt(id);
    this.equalizerNodes = [];
    this.mixerChannels = [];
    this.compressor = new AudioCompressionControl(false, 0.003, 30, 12, 0.25, -24, 1);
    this.label = `Profile ${id}`;
  }

  static fromObj(obj) {
    const profile = new AudioProfile(obj.id);
    profile.label = obj.label;
    profile.equalizerNodes = obj.equalizerNodes?.map((nodeObj) => {
      return AudioEQNode.fromObj(nodeObj);
    }) || [];
    profile.mixerChannels = obj.mixerChannels?.map((channelObj) => {
      return AudioChannelControl.fromObj(channelObj);
    }) || [];

    if (obj.compressor) {
      profile.compressor = AudioCompressionControl.fromObj(obj.compressor || {});
    }

    return profile;
  }

  copy() {
    return AudioProfile.fromObj(this.toObj());
  }

  toObj() {
    return {
      id: this.id,
      label: this.label,
      equalizerNodes: this.equalizerNodes.map((node) => {
        return node.toObj();
      }),
      mixerChannels: this.mixerChannels.map((channel) => {
        return channel.toObj();
      }),
      compressor: this.compressor.toObj(),
    };
  }
}

export class AudioConfigManager extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.profiles = [];
    this.ui = {};

    this.setupUI();

    this.renderLoopRunning = false;
    this.shouldRunRenderLoop = false;

    this.equalizerNodes = [];
    this.loadProfilesFromStorage();
  }

  loadProfilesFromStorage() {
    chrome.storage.local.get({
      audioProfiles: '[]',
      currentAudioProfile: -1,
    }, (data) => {
      const audioProfiles = JSON.parse(data.audioProfiles) || [];
      const currentAudioProfileID = data.currentAudioProfile || -1;

      if (audioProfiles.length === 0) {
        this.newProfile();
        this.setCurrentProfile(this.profiles[0]);
      } else {
        this.profiles = audioProfiles.map((profile) => {
          return AudioProfile.fromObj(profile);
        });
        const currentProfile = this.profiles.find((profile) => profile.id === currentAudioProfileID);
        if (currentProfile) {
          this.setCurrentProfile(currentProfile);
        } else {
          this.setCurrentProfile(this.profiles[0]);
        }
        this.updateProfileDropdown();
      }
      this.refreshEQNodes();
      this.refreshMixer();
      this.setupCompressorControls();
    });
  }

  saveProfilesToStorage() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      chrome.storage.local.set({
        audioProfiles: JSON.stringify(this.profiles.map((profile) => profile.toObj())),
        currentAudioProfile: this.currentProfile?.id || this.profiles[0]?.id || 0,
      });
    }, 500);
  }

  getNextProfileID() {
    let id = 1;
    // Really bad code
    while (this.profiles.find((profile) => profile.id === id)) {
      id++;
    }

    return id;
  }

  newProfile() {
    const newID = this.getNextProfileID();
    const profile = new AudioProfile(newID);
    this.addProfile(profile);

    Array.from(this.ui.profileDropdown.children[1].children).find((el) => el.dataset.val === 'p' + newID).click();
  }

  loadProfileFile(obj) {
    if (obj.type !== 'audioProfile') {
      throw new Error('Invalid profile type');
    }

    obj.profiles.forEach((profileObj) => {
      const profile = AudioProfile.fromObj(profileObj);
      profile.id = this.getNextProfileID();

      if (this.profiles.some((test) => test.label === profile.label)) {
        profile.label = profile.label + ` (loaded from file on ${(new Date()).toDateString()})`;
      }

      this.profiles.push(profile);
    });
    this.updateProfileDropdown();
    this.saveProfilesToStorage();
  }

  addProfile(profile) {
    this.profiles.push(profile);
    this.updateProfileDropdown();
    this.saveProfilesToStorage();
  }

  setCurrentProfile(profile) {
    this.currentProfile = profile.copy();
    this.saveProfilesToStorage();
  }

  deleteProfile(profile) {
    const index = this.profiles.indexOf(profile);
    if (index !== -1) this.profiles.splice(index, 1);

    if (this.profiles.length === 0) {
      this.newProfile();
    }

    this.updateProfileDropdown();

    Array.from(this.ui.profileDropdown.children[1].children).find((el) =>
      el.dataset.val === 'p' + this.profiles[Math.max(0, index - 1)].id,
    ).click();

    this.saveProfilesToStorage();
  }

  updateProfileDropdown(defaultID = null) {
    const oldDropdown = this.ui.profileDropdown;

    const optionsList = {};

    this.profiles.forEach((profile) => {
      optionsList['p' + profile.id] = profile.label;
    });

    optionsList['create'] = 'Create new profile';
    optionsList['import'] = 'Import profiles from file';

    let id = defaultID !== null ? defaultID : (this.currentProfile?.id || 0);
    if (!this.profiles.find((profile) => profile.id === id)) {
      id = this.profiles[0]?.id || 0;
    }

    this.ui.profileDropdown = WebUtils.createDropdown('p' + id,
        'Profile', optionsList, (val, prevVal) => {
          if (val === 'create') {
            this.newProfile();
          } else if (val === 'import') {
            this.updateProfileDropdown(parseInt(prevVal.substring(1)));
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.addEventListener('change', () => {
              const file = input.files[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (e) => {
                try {
                  const obj = JSON.parse(e.target.result);
                  this.loadProfileFile(obj);
                } catch (e) {
                  alert('Invalid profile file');
                }
              };
              reader.readAsText(file);
            });
            input.click();
          }
        }, (key, displayName)=>{
          if (key === 'create' || key === 'import') {
            return;
          }

          displayName = displayName.replaceAll('\n', ' ').trim();

          if (displayName.length === 0) {
            displayName = 'Unnamed Profile';
          }

          const profile = this.profiles.find((profile) => profile.id === parseInt(key.substring(1)));
          if (profile) {
            profile.label = displayName;
            this.saveProfilesToStorage();
          }
        },
    );

    this.ui.profileDropdown.children[0].children[0].addEventListener('blur', ()=>{
      this.updateProfileDropdown(parseInt(this.ui.profileDropdown.dataset.val.substring(1)));
    });

    this.ui.profileDropdown.classList.add('profile_selector');
    this.ui.profileManager.replaceChild(this.ui.profileDropdown, oldDropdown);
  }

  openUI() {
    InterfaceUtils.closeWindows();
    DOMElements.audioConfigContainer.style.display = '';
    this.startRenderLoop();
  }

  closeUI() {
    DOMElements.audioConfigContainer.style.display = 'none';
    this.stopRenderLoop();
  }

  saveCurrentProfile() {
    const profile = this.getDropdownProfile();
    if (!profile) {
      this.updateProfileDropdown();
      alert('Couldn\'t save profile');
      return;
    }

    const newProfile = this.currentProfile.copy();
    newProfile.label = profile.label;
    newProfile.id = profile.id;

    const index = this.profiles.indexOf(profile);
    if (index !== -1) this.profiles.splice(index, 1, newProfile);

    this.updateProfileDropdown();
    this.saveProfilesToStorage();
  }

  getDropdownProfile() {
    const id = parseInt(this.ui.profileDropdown.dataset.val.substring(1));
    return this.profiles.find((profile) => profile.id === id);
  }
  setupUI() {
    DOMElements.audioConfigContainer.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    DOMElements.audioConfigContainer.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    DOMElements.audioConfigContainer.addEventListener('keyup', (e) => {
      e.stopPropagation();
    });

    DOMElements.playerContainer.addEventListener('click', (e) => {
      this.closeUI();
    });

    DOMElements.audioConfigBtn.addEventListener('click', (e) => {
      if (DOMElements.audioConfigContainer.style.display === 'none') {
        this.openUI();
      } else {
        this.closeUI();
      }
      e.stopPropagation();
    });
    WebUtils.setupTabIndex(DOMElements.audioConfigBtn);

    const closeBtn = DOMElements.audioConfigContainer.getElementsByClassName('close_button')[0];
    closeBtn.addEventListener('click', (e) => {
      this.closeUI();
    });
    WebUtils.setupTabIndex(closeBtn);


    // setup dropdowns
    this.ui.profileManager = WebUtils.create('div', null, 'profile_manager');
    DOMElements.audioConfigContainer.appendChild(this.ui.profileManager);

    this.ui.profileDropdown = document.createElement('div');
    this.ui.profileManager.appendChild(this.ui.profileDropdown);
    this.updateProfileDropdown();

    // load button
    this.ui.loadButton = WebUtils.create('div', null, 'textbutton load_button');
    this.ui.loadButton.textContent = 'Load Profile';
    this.ui.profileManager.appendChild(this.ui.loadButton);
    this.ui.loadButton.addEventListener('click', () => {
      const profile = this.getDropdownProfile();
      if (!profile) {
        this.updateProfileDropdown();
        return;
      }
      this.setCurrentProfile(profile);
      this.refreshEQNodes();
    });
    WebUtils.setupTabIndex(this.ui.loadButton);

    // save button
    this.ui.saveButton = WebUtils.create('div', null, 'textbutton save_button');
    this.ui.saveButton.textContent = 'Save Profile';
    this.ui.profileManager.appendChild(this.ui.saveButton);
    this.ui.saveButton.addEventListener('click', () => {
      this.saveCurrentProfile();
    });
    WebUtils.setupTabIndex(this.ui.saveButton);

    // download button
    this.ui.downloadButton = WebUtils.create('div', null, 'textbutton download_button');
    this.ui.downloadButton.textContent = 'Download Profile';
    this.ui.profileManager.appendChild(this.ui.downloadButton);
    this.ui.downloadButton.addEventListener('click', () => {
      const profile = this.getDropdownProfile();
      if (!profile) {
        this.updateProfileDropdown();
        return;
      }

      const data = {
        type: 'audioProfile',
        version: 1,
        profiles: [],
      };

      const profileObj = profile.toObj();
      delete profileObj.id;
      data.profiles.push(profileObj);

      const downloadBlob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(downloadBlob);
      a.download = `${profile.label}.fsprofile.json`;
      a.click();
    });
    WebUtils.setupTabIndex(this.ui.downloadButton);

    // delete button
    this.ui.deleteButton = WebUtils.create('div', null, 'textbutton delete_button');
    this.ui.deleteButton.textContent = 'Delete';
    this.ui.profileManager.appendChild(this.ui.deleteButton);
    this.ui.deleteButton.addEventListener('click', () => {
      const profile = this.getDropdownProfile();
      if (!profile) {
        this.updateProfileDropdown();
        return;
      }
      this.deleteProfile(profile);
    });
    WebUtils.setupTabIndex(this.ui.deleteButton);


    this.ui.dynamicsContainer = WebUtils.create('div', null, 'dynamics_container');
    DOMElements.audioConfigContainer.appendChild(this.ui.dynamicsContainer);

    this.ui.equalizer = WebUtils.create('div', null, 'equalizer');
    this.ui.dynamicsContainer.appendChild(this.ui.equalizer);

    const equalizerTitle = WebUtils.create('div', null, 'equalizer_title');
    equalizerTitle.textContent = 'Audio Equalizer';
    this.ui.equalizer.appendChild(equalizerTitle);

    this.ui.equalizerText = WebUtils.create('div', null, 'dynamics_center_text');
    this.ui.equalizerText.textContent = 'No audio context!';
    this.ui.equalizer.appendChild(this.ui.equalizerText);

    this.ui.spectrumCanvas = WebUtils.create('canvas', null, 'spectrum_canvas');
    this.ui.equalizer.appendChild(this.ui.spectrumCanvas);
    this.spectrumCtx = this.ui.spectrumCanvas.getContext('2d');

    this.ui.equalizerCanvas = WebUtils.create('canvas', null, 'equalizer_canvas');
    this.ui.equalizer.appendChild(this.ui.equalizerCanvas);
    this.equalizerCtx = this.ui.equalizerCanvas.getContext('2d');

    this.ui.equalizerFrequencyAxis = WebUtils.create('div', null, 'equalizer_frequency_axis');
    this.ui.equalizer.appendChild(this.ui.equalizerFrequencyAxis);

    this.ui.equalizerDecibelAxis = WebUtils.create('div', null, 'equalizer_decibel_axis');
    this.ui.equalizer.appendChild(this.ui.equalizerDecibelAxis);

    this.ui.equalizerNodes = WebUtils.create('div', null, 'equalizer_nodes');
    this.ui.equalizer.appendChild(this.ui.equalizerNodes);

    this.ui.zeroLineNode = WebUtils.create('div', null, 'zero_line_node');
    this.ui.equalizerNodes.appendChild(this.ui.zeroLineNode);
    this.ui.zeroLineNode.style.display = 'none';

    const moveZeroLineNode = (e) => {
      const pos = e.clientX - this.ui.equalizerNodes.getBoundingClientRect().left;
      let x = Utils.clamp(pos / this.ui.equalizerNodes.clientWidth * 100, 0, 100);
      if (x < 1) x = 0;
      else if (x > 99) x = 100;
      this.ui.zeroLineNode.style.left = `${x}%`;

      if (x === 0) {
        this.ui.zeroLineNode.classList.add('highpass');
      } else if (x === 100) {
        this.ui.zeroLineNode.classList.add('lowpass');
      } else {
        this.ui.zeroLineNode.classList.remove('highpass');
        this.ui.zeroLineNode.classList.remove('lowpass');
      }
    };

    this.ui.zeroLineNode.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.preAnalyser) return;

      let type = 'peaking';
      if (this.ui.zeroLineNode.classList.contains('highpass')) {
        type = 'highpass';
      } else if (this.ui.zeroLineNode.classList.contains('lowpass')) {
        type = 'lowpass';
      }
      const frequency = this.ratioToFrequency(parseFloat(this.ui.zeroLineNode.style.left) / 100);
      const node = new AudioEQNode(type, frequency, 0, 1);
      this.addEQNode(node);
    });

    const zeroLineNodeShowHide = (e)=> {
      // if no analysers, don't show the zero line node
      if (!this.preAnalyser || !this.postAnalyser) {
        this.ui.zeroLineNode.style.display = 'none';
        return;
      }

      // if targetting a node, don't show the zero line node
      if (e.target.classList.contains('equalizer_node')) {
        this.ui.zeroLineNode.style.display = 'none';
        return;
      }

      // if not close to halfway vertically, don't show the zero line node
      const y = e.clientY - this.ui.equalizer.getBoundingClientRect().top;
      if (y < this.ui.equalizer.clientHeight * 0.4 || y > this.ui.equalizer.clientHeight * 0.6) {
        this.ui.zeroLineNode.style.display = 'none';
        return;
      }

      this.ui.zeroLineNode.style.display = '';
      moveZeroLineNode(e);
    };
    this.ui.equalizer.addEventListener('mouseover', (e) => {
      zeroLineNodeShowHide(e);
    });

    this.ui.equalizer.addEventListener('mousemove', (e) => {
      zeroLineNodeShowHide(e);
      moveZeroLineNode(e);
    });


    this.ui.equalizer.addEventListener('mouseout', (e) => {
      this.ui.zeroLineNode.style.display = 'none';
      zeroLineNodeShowHide(e);
    });


    this.ui.compressor = WebUtils.create('div', null, 'compressor');
    this.ui.dynamicsContainer.appendChild(this.ui.compressor);

    this.ui.compressorTitle = WebUtils.create('div', null, 'compressor_title');
    this.ui.compressorTitle.textContent = 'Audio Compressor';
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

    this.ui.mixer = WebUtils.create('div', null, 'mixer');
    this.ui.dynamicsContainer.appendChild(this.ui.mixer);

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
    const knob = new Knob(knobKnob, (knob, indicator)=>{
      knobKnob.style.transform = `rotate(-${indicator.angle}deg)`;
      // dont update the value if the user is editing it
      if (knobValue !== document.activeElement) {
        knobValue.textContent = knob.val().toFixed(decimals) + ' ' + units;
      }

      if (shouldCall && callback) {
        callback(knob.val());
      }
    });

    knobValue.addEventListener('input', ()=>{
      const val = parseFloat(knobValue.textContent.replace(units, ''));
      if (isNaN(val)) {
        return;
      }
      knob.val(val);
    });

    knobValue.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter') {
        e.preventDefault();
        knobValue.blur();
      }
    });

    knobValue.addEventListener('blur', (e)=>{
      const val = parseFloat(knobValue.textContent.replace(units, ''));
      knob.val(val);
    });

    knob.options.indicatorAutoRotate = true;
    knob.options.angleEnd = 315;
    knob.options.angleStart = 45;
    knob.options.valueMin = minValue;
    knob.options.valueMax = maxValue;
    knob.val(minValue);

    setTimeout(()=>{
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

    container.addEventListener('mousedown', (e) =>{
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

  setupCompressorControls() {
    this.ui.compressorControls.replaceChildren();

    this.ui.compressorToggle = WebUtils.create('div', null, 'compressor_toggle');
    this.ui.compressorControls.appendChild(this.ui.compressorToggle);
    WebUtils.setupTabIndex(this.ui.compressorToggle);

    this.ui.compressorToggle.addEventListener('click', () => {
      this.currentProfile.compressor.enabled = !this.currentProfile.compressor.enabled;
      this.updateCompressor();
    });

    this.compressorKnobs = {};

    this.compressorKnobs.threshold = this.createKnob('Threshold', -80, 0, (val) => {
      if (this.currentProfile && val !== this.currentProfile.compressor.threshold) {
        this.currentProfile.compressor.threshold = val;
        this.updateCompressor();
      }
    }, 'dB');
    this.ui.compressorControls.appendChild(this.compressorKnobs.threshold.container);

    this.compressorKnobs.knee = this.createKnob('Knee', 0, 40, (val) => {
      if (this.currentProfile && val !== this.currentProfile.compressor.knee) {
        this.currentProfile.compressor.knee = val;
        this.updateCompressor();
      }
    }, 'dB');
    this.ui.compressorControls.appendChild(this.compressorKnobs.knee.container);

    this.compressorKnobs.ratio = this.createKnob('Ratio', 1, 20, (val) => {
      if (this.currentProfile && val !== this.currentProfile.compressor.ratio) {
        this.currentProfile.compressor.ratio = val;
        this.updateCompressor();
      }
    }, 'dB');
    this.ui.compressorControls.appendChild(this.compressorKnobs.ratio.container);

    this.compressorKnobs.attack = this.createKnob('Attack', 0, 1, (val) => {
      if (this.currentProfile && val !== this.currentProfile.compressor.attack) {
        this.currentProfile.compressor.attack = val;
        this.updateCompressor();
      }
    }, 's');
    this.ui.compressorControls.appendChild(this.compressorKnobs.attack.container);

    this.compressorKnobs.release = this.createKnob('Release', 0, 1, (val) => {
      if (this.currentProfile && val !== this.currentProfile.compressor.release) {
        this.currentProfile.compressor.release = val;
        this.updateCompressor();
      }
    }, 's');
    this.ui.compressorControls.appendChild(this.compressorKnobs.release.container);

    this.compressorKnobs.gain = this.createKnob('Gain', 0, 20, (val) => {
      if (this.currentProfile && this.dbToGain(val) !== this.currentProfile.compressor.gain) {
        this.currentProfile.compressor.gain = this.dbToGain(val);
        this.updateCompressor();
      }
    }, 'dB');
    this.ui.compressorControls.appendChild(this.compressorKnobs.gain.container);

    if (this.currentProfile) {
      this.compressorKnobs.threshold.knob.val(this.currentProfile.compressor.threshold);
      this.compressorKnobs.knee.knob.val(this.currentProfile.compressor.knee);
      this.compressorKnobs.ratio.knob.val(this.currentProfile.compressor.ratio);
      this.compressorKnobs.attack.knob.val(this.currentProfile.compressor.attack);
      this.compressorKnobs.release.knob.val(this.currentProfile.compressor.release);
      this.compressorKnobs.gain.knob.val(this.gainToDB(this.currentProfile.compressor.gain));
    }

    this.updateCompressor();
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
    const compressor = this.currentProfile.compressor;

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

  renderCompressorGraph() {
    if (!this.currentProfile) return;

    const width = this.ui.compressorGraphCanvas.clientWidth * window.devicePixelRatio;
    const height = this.ui.compressorGraphCanvas.clientHeight * window.devicePixelRatio;

    if (width === 0 || height === 0) return;

    this.ui.compressorGraphCanvas.width = width;
    this.ui.compressorGraphCanvas.height = height;

    const ctx = this.ui.compressorGraphCtx;

    ctx.clearRect(0, 0, width, height);

    // draw line
    const minDB = -80;
    const maxDB = 0;

    ctx.beginPath();
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 2;
    for (let x = 0; x < width; x++) {
      const db = minDB + (maxDB - minDB) * x / width;
      const newDB = this.getCompressorNewDBfromOldDB(db);

      const y = height - (newDB - minDB) * height / (maxDB - minDB);

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
    const threshold = this.currentProfile.compressor.threshold;
    const x = (threshold - minDB) * width / (maxDB - minDB);
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    // draw knee line
    const knee = this.currentProfile.compressor.knee;
    if (knee > 0) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.7)';
      ctx.lineWidth = 1;
      const x2 = (threshold + knee - minDB) * width / (maxDB - minDB);
      ctx.moveTo(x2, 0);
      ctx.lineTo(x2, height);
      ctx.stroke();
    }


    if (this.compressorNode) {
      // reduction line
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 200, 0, 0.7)';
      ctx.lineWidth = 1;
      const reduction = this.compressorNode.reduction;
      const y = height - (reduction - minDB) * height / (maxDB - minDB);
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }
  addEQNode(node) {
    this.currentProfile.equalizerNodes.push(node);
    this.refreshEQNodes();
  }

  refreshEQNodes() {
    if (!this.currentProfile) return;
    try {
      this.preAnalyser.disconnect(this.postAnalyser);
    } catch (e) {

    }

    this.equalizerNodes.forEach((node) => {
      node.disconnect();
    });

    this.equalizerNodes = [];
    this.currentProfile.equalizerNodes.forEach((node) => {
      const eqNode = this.audioContext.createBiquadFilter();
      eqNode.type = node.type;
      eqNode.frequency.value = node.frequency;
      eqNode.gain.value = node.gain;
      eqNode.Q.value = node.q;

      this.equalizerNodes.push(eqNode);
    });

    this.equalizerNodes.forEach((node, index) => {
      if (index === 0) {
        this.preAnalyser.connect(node);
      } else {
        this.equalizerNodes[index - 1].connect(node);
      }
    });

    if (this.equalizerNodes.length === 0) {
      this.preAnalyser.connect(this.postAnalyser);
    } else {
      this.equalizerNodes[this.equalizerNodes.length - 1].connect(this.postAnalyser);
    }

    this.renderEqualizerResponse();
    this.updateEqualizerNodeMarkers();
  }
  ratioToFrequency(ratio) {
    const sampleRate = this.preAnalyser.context.sampleRate;
    const maxFreq = sampleRate / 2;
    const frequencyWidth = maxFreq;
    const logFrequencyWidth = Math.log10(frequencyWidth / 20);
    return Utils.clamp(Math.pow(10, ratio * logFrequencyWidth + Math.log10(20)), 0, maxFreq);
  }

  renderLoop() {
    if (!this.shouldRunRenderLoop) {
      this.renderLoopRunning = false;
      return;
    } else {
      requestAnimationFrame(() => {
        this.renderLoop();
      });
    }

    if (this.ui.equalizer.clientWidth !== this.pastWidth) {
      this.pastWidth = this.ui.equalizer.clientWidth;

      // Rerender equalizer response when width changes
      this.renderEqualizerResponse();
    }

    this.renderEqualizerSpectrum();
    this.renderCompressorGraph();
    this.renderMixerMeters();
  }

  startRenderLoop() {
    if (this.renderLoopRunning) return;
    this.shouldRunRenderLoop = true;
    this.renderLoopRunning = true;
    this.renderLoop();
  }

  stopRenderLoop() {
    this.shouldRunRenderLoop = false;
  }

  renderEqualizerSpectrum() {
    if (!this.preAnalyser || !this.postAnalyser) return;


    if (this.ui.equalizer.clientWidth === 0 || this.ui.equalizer.clientHeight === 0) return;

    const bufferLength = this.preAnalyser.frequencyBinCount;
    const dataArrayPre = new Uint8Array(bufferLength);
    const dataArrayPost = new Uint8Array(bufferLength);
    this.preAnalyser.getByteFrequencyData(dataArrayPre);
    this.postAnalyser.getByteFrequencyData(dataArrayPost);

    this.ui.spectrumCanvas.width = this.ui.equalizer.clientWidth * window.devicePixelRatio;
    this.ui.spectrumCanvas.height = this.ui.equalizer.clientHeight * window.devicePixelRatio;

    const width = this.ui.spectrumCanvas.width;
    const height = this.ui.spectrumCanvas.height;

    this.spectrumCtx.clearRect(0, 0, width, height);

    const sampleRate = this.preAnalyser.context.sampleRate;
    const maxFreq = sampleRate / 2;

    const frequencyWidth = maxFreq;
    const logFrequencyWidth = Math.log10(frequencyWidth) - Math.log10(20);

    // Draw bars but with log frequency scale
    const xScale = width / logFrequencyWidth;
    const yScale = height / 255;

    let lastX = -1;
    let currentSum = 0;
    const windowSizeHalf = 7;
    for (let i = 0; i < windowSizeHalf && i < bufferLength; i++) {
      currentSum += dataArrayPost[i];
    }

    for (let i = 0; i < bufferLength; i++) {
      if (i + windowSizeHalf < bufferLength) {
        currentSum += dataArrayPost[i + windowSizeHalf];
      }

      if (i - windowSizeHalf - 1 >= 0) {
        currentSum -= dataArrayPost[i - windowSizeHalf - 1];
      }

      const x = Math.log10((i+1) * frequencyWidth / bufferLength, 1) - Math.log10(20);
      const x2 = Math.log10((i+2) * frequencyWidth / bufferLength, 1) - Math.log10(20);
      if (x < 0) continue;
      const yPre = dataArrayPre[i];
      const yPost = dataArrayPost[i];
      // sky blue->red colors based on strength
      const newX = Math.floor(x * xScale);
      if (newX === lastX) continue;

      const windowSize = Utils.clamp(i + windowSizeHalf, 0, bufferLength) - Utils.clamp(i - windowSizeHalf, 0, bufferLength) + 1;
      const average = currentSum / windowSize;

      const barWidth = Utils.clamp((x2 - x) * xScale / 2, 1, 5);
      const eqResponse = this.equalizerDbResponse?.[Math.min(Math.floor(x / logFrequencyWidth * this.equalizerDbResponse.length), this.equalizerDbResponse.length - 1)] || 0;
      const peakN = Utils.clamp(Math.max((yPost - average) * 2, 0) + yPost, 0, 255);
      const color = `rgb(${peakN}, ${255 - peakN}, 255)`;
      if (eqResponse < 0 && yPost < yPre) {
        this.spectrumCtx.fillStyle = `rgba(0, 50, 255, 0.8)`;
        this.spectrumCtx.fillRect(newX, height - yPre * yScale, barWidth, yPre * yScale);
        this.spectrumCtx.fillStyle = color;
        this.spectrumCtx.fillRect(newX, height - yPost * yScale, barWidth, yPost * yScale);
        this.spectrumCtx.fillStyle = `rgba(0, 100, 180, 0.5)`;
        this.spectrumCtx.fillRect(newX, height - yPost * yScale, barWidth, yPost * yScale);
      } else if (eqResponse > 0 && yPost > yPre) {
        this.spectrumCtx.fillStyle = color;
        this.spectrumCtx.fillRect(newX, height - yPost * yScale, barWidth, yPost * yScale);
        this.spectrumCtx.fillStyle = `rgba(0, 100, 180, 0.5)`;
        this.spectrumCtx.fillRect(newX, height - yPre * yScale, barWidth, yPre * yScale);
      } else {
        this.spectrumCtx.fillStyle = color;
        this.spectrumCtx.fillRect(newX, height - yPost * yScale, barWidth, yPost * yScale);
        this.spectrumCtx.fillStyle = `rgba(0, 100, 180, 0.5)`;
        this.spectrumCtx.fillRect(newX, height - yPost * yScale, barWidth, yPost * yScale);
      }
      // // draw average fill color red
      // this.spectrumCtx.fillStyle = `rgb(255, 255, 0)`;
      // this.spectrumCtx.fillRect(newX, height - average * yScale, barWidth, 2);

      // if (yPost > this.spectrumMaximums[i] || this.spectrumMaximumsFreshness[i] > 140) {
      //   this.spectrumMaximums[i] = yPost;
      //   this.spectrumMaximumsFreshness[i] = 0;
      // } else {
      //   this.spectrumMaximumsFreshness[i] += 1;
      // }
      // const timeDiff = this.spectrumMaximumsFreshness[i];
      // const freshness = timeDiff < 100 ? 1 : 1 - ( ( timeDiff - 100 ) / (140 - 100) );
      // this.spectrumCtx.fillStyle = `rgba(238, 119, 85, ${freshness})`;
      // this.spectrumCtx.fillRect(newX, height - this.spectrumMaximums[i] * yScale, barWidth, 2);

      lastX = newX;
    }
  }

  updateEqualizerNodeMarkers() {
    if (!this.preAnalyser) return;

    Array.from(this.ui.equalizerNodes.children).forEach((node) => {
      if (node.classList.contains('zero_line_node')) return;
      node.remove();
    });


    const typesThatUseGain = ['peaking', 'lowshelf', 'highshelf'];
    const typesThatUseQ = ['lowpass', 'highpass', 'bandpass', 'peaking', 'notch'];

    function nodeToString(node) {
      const header = `${node.type.charAt(0).toUpperCase() + node.type.substring(1)} node at ${StringUtils.formatFrequency(node.frequency.value)}Hz`;
      const lines = [header];
      const description = [];
      const instructions = ['Double click to change type'];

      if (typesThatUseGain.includes(node.type)) {
        description.push(`Gain: ${node.gain.value.toFixed(1)}dB`);
      }

      if (typesThatUseQ.includes(node.type)) {
        description.push(`Q: ${node.Q.value.toFixed(3)}`);
        instructions.push('Scroll to change Q');
      }

      if (description.length > 0) {
        lines.push(description.join(' '));
      }

      lines.push(instructions.join('\r\n'));
      return lines.join('\r\n');
    }

    const sampleRate = this.preAnalyser.context.sampleRate;
    const maxFreq = sampleRate / 2;
    this.equalizerNodes.forEach((node, i) => {
      const el = WebUtils.create('div', null, 'equalizer_node tooltip');
      const frequencyPercent = Math.log10(node.frequency.value / 20) / Math.log10(maxFreq / 20);
      const gainDb = Utils.clamp(node.gain.value, -20, 20) / 40;

      const tooltipText = WebUtils.create('div', null, 'tooltiptext');
      el.appendChild(tooltipText);

      el.style.left = `${frequencyPercent * 100}%`;
      el.style.top = `${(-gainDb + 0.5) * 100}%`;
      WebUtils.setupTabIndex(el);
      this.ui.equalizerNodes.appendChild(el);

      let isDragging = false;

      const updateTooltip = (x, y) => {
        if (y < 40) {
          tooltipText.classList.add('down');
        } else {
          tooltipText.classList.remove('down');
        }

        if (x < 80) {
          tooltipText.classList.add('right');
        } else {
          tooltipText.classList.remove('right');
        }

        if (x > this.ui.equalizerNodes.clientWidth - 80) {
          tooltipText.classList.add('left');
        } else {
          tooltipText.classList.remove('left');
        }

        tooltipText.textContent = nodeToString(node);
      };

      const mouseMove = (e) => {
        if (!isDragging) return;
        const x = e.clientX - this.ui.equalizerNodes.getBoundingClientRect().left;
        const y = e.clientY - this.ui.equalizerNodes.getBoundingClientRect().top;

        const newXPercent = Utils.clamp(x / this.ui.equalizerNodes.clientWidth * 100, 0, 100);
        const newYPercent = Utils.clamp(y / this.ui.equalizerNodes.clientHeight * 100, 0, 100);


        const frequency = this.ratioToFrequency(newXPercent / 100);
        const newDB = Utils.clamp(-newYPercent + 50, -50, 50) / 100 * 40;

        el.style.left = `${newXPercent}%`;
        node.frequency.value = frequency;
        this.currentProfile.equalizerNodes[i].frequency = frequency;

        if (typesThatUseGain.includes(node.type)) {
          el.style.top = `${newYPercent}%`;
          node.gain.value = newDB;
          this.currentProfile.equalizerNodes[i].gain = newDB;
        } else {
          el.style.top = '50%';
        }
        updateTooltip(x, y);
        this.renderEqualizerResponse();
      };

      const mouseUp = (e) => {
        isDragging = false;

        document.removeEventListener('mousemove', mouseMove);
        document.removeEventListener('mouseup', mouseUp);
      };

      el.addEventListener('mousedown', (e) => {
        if (isDragging) return;
        isDragging = true;
        e.stopPropagation();
        document.addEventListener('mousemove', mouseMove);
        document.addEventListener('mouseup', mouseUp);
      });

      el.addEventListener('wheel', (e) => {
        // scroll for q
        e.preventDefault();
        const delta = Math.sign(e.deltaY);
        const q = Utils.clamp(node.Q.value * Math.pow(1.1, delta), 0.0001, 1000);
        node.Q.value = q;
        this.currentProfile.equalizerNodes[i].q = q;
        tooltipText.textContent = nodeToString(node);
        this.renderEqualizerResponse();
      });

      let lastClick = 0;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const now = Date.now();
        if (now - lastClick > 300) {
          lastClick = now;
          return;
        }
        lastClick = now;
        const rotateTypes = ['peaking', 'lowshelf', 'highshelf', 'lowpass', 'highpass', 'notch', 'bandpass'];
        const index = rotateTypes.indexOf(node.type);
        if (index === -1) return;

        const newType = rotateTypes[(index + 1) % rotateTypes.length];
        node.type = newType;
        this.currentProfile.equalizerNodes[i].type = newType;

        if (!typesThatUseGain.includes(node.type)) {
          el.style.top = '50%';
        } else {
          const gainDb = Utils.clamp(node.gain.value, -20, 20) / 40;
          el.style.top = `${(-gainDb + 0.5) * 100}%`;
        }
        tooltipText.textContent = nodeToString(node);
        this.renderEqualizerResponse();
      });

      el.addEventListener('contextmenu', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const now = Date.now();
        if (now - lastClick > 300) {
          lastClick = now;
          return;
        }
        lastClick = now;
        const rotateTypes = ['peaking', 'lowshelf', 'highshelf', 'lowpass', 'highpass', 'notch', 'bandpass'];
        const index = rotateTypes.indexOf(node.type);
        if (index === -1) return;

        const newType = rotateTypes[(index - 1 + rotateTypes.length) % rotateTypes.length];
        node.type = newType;
        this.currentProfile.equalizerNodes[i].type = newType;

        if (!typesThatUseGain.includes(node.type)) {
          el.style.top = '50%';
        } else {
          const gainDb = Utils.clamp(node.gain.value, -20, 20) / 40;
          el.style.top = `${(-gainDb + 0.5) * 100}%`;
        }
        tooltipText.textContent = nodeToString(node);
        this.renderEqualizerResponse();
      });

      el.addEventListener('keydown', (e)=>{
        if (e.key === 'Delete' || e.key === 'Backspace') {
          this.currentProfile.equalizerNodes.splice(i, 1);
          this.refreshEQNodes();
        }
      });

      el.addEventListener('mouseenter', (e) => {
        const x = e.clientX - this.ui.equalizerNodes.getBoundingClientRect().left;
        const y = e.clientY - this.ui.equalizerNodes.getBoundingClientRect().top;
        updateTooltip(x, y);
        el.focus();
      });

      el.addEventListener('mouseleave', (e) => {
        el.blur();
      });
    });
  }
  renderEqualizerResponse() {
    if (!this.preAnalyser || !this.postAnalyser) return;

    if (this.ui.equalizer.clientWidth === 0 || this.ui.equalizer.clientHeight === 0) return;

    this.ui.equalizerCanvas.width = this.ui.equalizer.clientWidth * window.devicePixelRatio;
    this.ui.equalizerCanvas.height = this.ui.equalizer.clientHeight * window.devicePixelRatio;

    const width = this.ui.equalizerCanvas.width;
    const height = this.ui.equalizerCanvas.height;
    const sampleRate = this.preAnalyser.context.sampleRate;
    const maxFreq = sampleRate / 2;

    const bufferLength = width;
    const frequencyArray = new Float32Array(bufferLength);
    const step = Math.log10(maxFreq / 20) / bufferLength;
    for (let i = 0; i < bufferLength; i++) {
      frequencyArray[i] = Math.min(Math.pow(10, i * step + Math.log10(20)), maxFreq);
    }

    const dbResponse = new Float32Array(bufferLength);

    const currentMagResponse = new Float32Array(bufferLength);
    const currentPhaseResponse = new Float32Array(bufferLength);

    this.equalizerNodes.forEach((node) => {
      node.getFrequencyResponse(frequencyArray, currentMagResponse, currentPhaseResponse);

      for (let i = 0; i < bufferLength; i++) {
        dbResponse[i] += 20 * Math.log10(currentMagResponse[i]);
      }
    });

    this.equalizerDbResponse = dbResponse;

    // draw lines
    this.equalizerCtx.clearRect(0, 0, width, height);

    const xScale = width / Math.log10(maxFreq / 20);
    const yScale = height / 40;

    this.equalizerCtx.beginPath();
    this.equalizerCtx.strokeStyle = 'green';
    this.equalizerCtx.lineWidth = 2;
    for (let i = 0; i < bufferLength; i++) {
      const x = Math.log10(frequencyArray[i] / 20);
      const y = dbResponse[i];
      if (i === 0) {
        this.equalizerCtx.moveTo(x * xScale, height / 2 - y * yScale);
      } else {
        this.equalizerCtx.lineTo(x * xScale, height / 2 - y * yScale);
      }
    }
    this.equalizerCtx.stroke();

    // fill in the area under the curve
    this.equalizerCtx.beginPath();
    this.equalizerCtx.fillStyle = 'rgba(0, 255, 0, 0.2)';
    this.equalizerCtx.moveTo(0, height / 2);

    for (let i = 0; i < bufferLength; i++) {
      const x = Math.log10(frequencyArray[i] / 20);
      const y = dbResponse[i];
      this.equalizerCtx.lineTo(x * xScale, height / 2 - y * yScale);
    }
    this.equalizerCtx.lineTo(width, height / 2);
    this.equalizerCtx.closePath();
    this.equalizerCtx.fill();
  }

  renderMixerMeters() {
    if (!this.currentProfile) return;

    const channels = this.currentProfile.mixerChannels;
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

      const volume = this.getVolume(analyzer);
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

  setupEqualizerDecibelAxis() {
    this.ui.equalizerDecibelAxis.replaceChildren();
    const minDecibels = -20;
    const maxDecibels = 20;
    const decibelWidth = maxDecibels - minDecibels;

    for (let i = 0; i <= decibelWidth / 5; i++) {
      const db = Math.round(maxDecibels - i * 5);

      const el = WebUtils.create('div', null, 'eq_tick_marker');
      el.style.top = `${i / (decibelWidth / 5) * 100}%`;
      this.ui.equalizerDecibelAxis.appendChild(el);

      if (i % 2 === 0) {
        if (db === 0) {
          el.classList.add('zero_tick');
        } else {
          el.classList.add('major_tick');
        }
        const label = WebUtils.create('div', null, 'tick_label');
        label.textContent = `${db}`;
        el.appendChild(label);
      } else {
        el.classList.add('minor_tick');
      }
    }
  }
  setupEqualizerFrequencyAxis() {
    this.ui.equalizerFrequencyAxis.replaceChildren();

    const sampleRate = this.preAnalyser.context.sampleRate;
    const maxFreq = sampleRate / 2;
    const frequencyWidth = maxFreq;
    const logFrequencyWidth = Math.log10(frequencyWidth);
    const logFrequencyWidthUI = Math.log10(frequencyWidth / 20);

    for (let i = 0; i < Math.ceil(logFrequencyWidth); i++) {
      const frequency = Math.pow(10, i);
      const position = Math.log10(frequency / 20) / logFrequencyWidthUI;
      if (position >= 0) {
        const el = WebUtils.create('div', null, 'eq_tick_marker');
        el.style.left = `${position * 100}%`;
        this.ui.equalizerFrequencyAxis.appendChild(el);

        el.classList.add('major_tick');
        const label = WebUtils.create('div', null, 'tick_label');
        label.textContent = `${StringUtils.formatFrequency(frequency)}Hz`;
        el.appendChild(label);
      }

      for (let j = 1; j < 9; j++) {
        const subfrequency = frequency + j * frequency;
        const position = Math.log10(subfrequency / 20) / logFrequencyWidthUI;
        if (position < 0) continue;
        else if (position > 1) {
          break;
        }

        const el = WebUtils.create('div', null, 'eq_tick_marker');
        el.style.left = `${position * 100}%`;
        this.ui.equalizerFrequencyAxis.appendChild(el);
        el.classList.add('minor_tick');
        if (j === 4 || j === 1) {
          const label = WebUtils.create('div', null, 'tick_label');
          label.textContent = `${StringUtils.formatFrequency(subfrequency)}Hz`;
          el.appendChild(label);
        }
      }
    }

    let lastTick = this.ui.equalizerFrequencyAxis.lastChild;
    if (parseInt(lastTick.style.left) < 97) {
      const el = WebUtils.create('div', null, 'eq_tick_marker');
      this.ui.equalizerFrequencyAxis.appendChild(el);
      lastTick = el;
    }

    lastTick.style.left = '100%';
    lastTick.classList.add('major_tick');
    lastTick.classList.remove('minor_tick');

    if (!lastTick.lastChild) {
      const label = WebUtils.create('div', null, 'tick_label');
      label.textContent = `${maxFreq}Hz`;
      lastTick.appendChild(label);
    } else {
      lastTick.lastChild.textContent = `${StringUtils.formatFrequency(maxFreq)}Hz`;
    }
  }

  getVolume(analyser) {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    return sum / bufferLength / 255;
  }

  dbToGain(db) {
    return Math.pow(10, db / 20);
  }

  gainToDB(gain) {
    return 20 * Math.log10(gain);
  }

  symmetricalLogScaleY(x, c) {
    return Math.sign(x) * (Math.log10(Math.abs(x / c) + 1));
  }

  symmetricalLogScaleX(y, c) {
    return Math.sign(y) * c * (Math.pow(10, Math.abs(y)) - 1);
  }

  mixerDBToPositionRatio(db) {
    if (db <= -50) {
      return 1;
    }

    const c = 40 / Math.log(10);
    const maxY = this.symmetricalLogScaleY(10, c);
    const minY = this.symmetricalLogScaleY(-50, c);
    const y = this.symmetricalLogScaleY(db, c);
    return Utils.clamp((maxY - y) / (maxY - minY), 0, 1);
  }

  mixerPositionRatioToDB(ratio) {
    if (ratio >= 1) {
      return -Infinity;
    }

    const c = 40 / Math.log(10);
    const maxY = this.symmetricalLogScaleY(10, c);
    const minY = this.symmetricalLogScaleY(-50, c);
    const y = maxY - ratio * (maxY - minY);
    return Utils.clamp(this.symmetricalLogScaleX(y, c), -50, 10);
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
      el.style.top = `${this.mixerDBToPositionRatio(db) * 100}%`;
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

    els.volumeHandle.style.top = `${this.mixerDBToPositionRatio(this.gainToDB(channel.gain)) * 100}%`;

    if (channel.id === 6) { // master
      els.soloButton.style.display = 'none';
    }

    const currentProfile = this.currentProfile;
    const zeroPos = this.mixerDBToPositionRatio(0);
    const mouseMove = (e) => {
      const y = e.clientY - els.volumeTrack.getBoundingClientRect().top;
      let newYPercent = Utils.clamp(y / els.volumeTrack.clientHeight * 100, 0, 100);

      if (Math.abs(newYPercent / 100 - zeroPos) < 0.025) {
        newYPercent = zeroPos * 100;
      }

      if (newYPercent >= 98) {
        newYPercent = 100;
      }

      const db = this.mixerPositionRatioToDB(newYPercent / 100);
      els.volumeHandle.style.top = `${newYPercent}%`;
      this.setChannelGain(channel, this.dbToGain(db));
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
      const db = this.mixerPositionRatioToDB(ratio - delta * 0.05);
      els.volumeHandle.style.top = `${this.mixerDBToPositionRatio(db) * 100}%`;
      this.setChannelGain(channel, this.dbToGain(db));
    });

    const toggleMute = () => {
      channel.muted = !channel.muted;
      els.muteButton.classList.toggle('active', channel.mute);
      this.updateMixerNodes();
    };

    const toggleSolo = () => {
      if (!channel.solo) {
        currentProfile.mixerChannels.forEach((channel) => {
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
        const db = this.mixerPositionRatioToDB(ratio - 0.025);
        els.volumeHandle.style.top = `${this.mixerDBToPositionRatio(db) * 100}%`;
        this.setChannelGain(channel, this.dbToGain(db));
      } else if (e.key === 'ArrowDown') {
        e.stopPropagation();
        e.preventDefault();

        const db = this.mixerPositionRatioToDB(ratio + 0.025);
        els.volumeHandle.style.top = `${this.mixerDBToPositionRatio(db) * 100}%`;
        this.setChannelGain(channel, this.dbToGain(db));
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

    if (!this.currentProfile) return;
    const mixerChannels = this.currentProfile.mixerChannels;

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
    if (!this.channelGains || !this.currentProfile) return;
    const channels = this.currentProfile.mixerChannels;

    const soloChannel = channels.find((channel) => channel.solo);

    channels.forEach((channel, i) => {
      if (soloChannel && channel !== soloChannel && channel.id !== 6) {
        this.channelGains[channel.id].gain.value = 0;
      } else {
        this.channelGains[channel.id].gain.value = channel.muted ? 0 : channel.gain;
      }
    });
  }

  setupCompressor() {
    this.ui.compressor.replaceChildren();
    this.updateCompressor();
  }

  updateCompressor() {
    if (!this.currentProfile) return;

    const compressor = this.currentProfile.compressor;
    this.ui.compressorToggle.textContent = compressor.enabled ? 'Compressor Enabled' : 'Compressor Disabled';
    this.ui.compressorToggle.classList.toggle('enabled', compressor.enabled);

    if (compressor.enabled) {
      if (!this.compressorNode) {
        this.postAnalyser.disconnect(this.channelSplitter);
        this.compressorNode = this.audioContext.createDynamicsCompressor();
        this.compressorGain = this.audioContext.createGain();
        this.postAnalyser.connect(this.compressorNode);
        this.compressorNode.connect(this.compressorGain);
        this.compressorGain.connect(this.channelSplitter);
      }

      this.compressorNode.threshold.value = compressor.threshold;
      this.compressorNode.knee.value = compressor.knee;
      this.compressorNode.ratio.value = compressor.ratio;
      this.compressorNode.attack.value = compressor.attack;
      this.compressorNode.release.value = compressor.release;
      this.compressorGain.gain.value = compressor.gain;
    } else {
      if (this.compressorNode) {
        this.postAnalyser.disconnect(this.compressorNode);
        this.compressorNode.disconnect(this.compressorGain);
        this.compressorNode = null;
        this.compressorGain.disconnect(this.channelSplitter);
        this.compressorGain = null;
        this.postAnalyser.connect(this.channelSplitter);
      }
    }
  }

  setupNodes() {
    this.audioContext = this.client.audioContext;
    this.audioSource = this.client.audioSource;
    this.preAnalyser = this.audioContext.createAnalyser();
    this.postAnalyser = this.audioContext.createAnalyser();

    this.spectrumMaximums = new Uint8Array(this.postAnalyser.frequencyBinCount);
    this.spectrumMaximumsFreshness = new Uint8Array(this.postAnalyser.frequencyBinCount);

    this.preAnalyser.smoothingTimeConstant = 0.6;
    this.postAnalyser.smoothingTimeConstant = 0.6;
    this.preAnalyser.maxDecibels = -20;
    this.postAnalyser.maxDecibels = -20;
    if (this.audioSource) {
      this.audioSource.connect(this.preAnalyser);
    }

    this.preAnalyser.connect(this.postAnalyser);
    this.ui.equalizerText.style.display = 'none';

    this.setupEqualizerFrequencyAxis();
    this.setupEqualizerDecibelAxis();
    this.refreshEQNodes();

    this.channelSplitter = this.audioContext.createChannelSplitter();
    this.compressorNode = null;
    this.postAnalyser.connect(this.channelSplitter);

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
    this.updateCompressor();

    if (DOMElements.audioConfigContainer.style.display !== 'none') {
      this.startRenderLoop();
    }
  }

  getOutputNode() {
    return this.finalAnalyser;
  }
}
