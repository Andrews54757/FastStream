import {Localize} from '../../modules/Localize.mjs';
import {IndexedDBManager} from '../../network/IndexedDBManager.mjs';
import {AudioUtils} from '../../utils/AudioUtils.mjs';
import {StringUtils} from '../../utils/StringUtils.mjs';
import {WebUtils} from '../../utils/WebUtils.mjs';
import {createDropdown} from '../components/Dropdown.mjs';
import {AbstractAudioModule} from './AbstractAudioModule.mjs';
import {AudioConvolverControl} from './config/AudioConvolverControl.mjs';
import {CHANNEL_NAMES, MAX_AUDIO_CHANNELS} from './config/AudioProfile.mjs';

export class OutputConvolver extends AbstractAudioModule {
  constructor(configManager) {
    super('OutputConvolver');

    this.configManager = configManager;

    this.db = new IndexedDBManager('faststream-impulse-responses');
    this.initPromise = this.db.setup();
    this.loadProfiles();
    this.setupUI();
  }

  loadProfiles() {
    const profileData = localStorage.getItem('audioConvolverProfiles');
    if (profileData) {
      try {
        const obj = JSON.parse(profileData);
        this.config = AudioConvolverControl.fromObj(obj);
      } catch (e) {
        console.warn('Could not parse saved convolver config, using default', e);
        this.config = AudioConvolverControl.default();
      }
    } else {
      this.config = AudioConvolverControl.default();
    }

    this.currentProfile = null;

    const currentProfile = localStorage.getItem('audioConvolverCurrentProfile');
    if (currentProfile) {
      const profile = this.config.profiles.find((profile) => profile.id === parseInt(currentProfile));
      if (profile) {
        this.setCurrentProfile(profile);
      }
    }

    if (!this.currentProfile) {
      this.setCurrentProfile(this.config.profiles[0] || null);
    }
  }

  setCurrentProfile(profile) {
    if (this.convolverChannels) {
      this.convolverChannels.forEach((ch) => {
        ch.impulseBuffer = null;
      });
    }

    this.currentProfile = profile;
    if (this.audioContext) {
      this.loadImpulseResponses();
    }
    localStorage.setItem('audioConvolverCurrentProfile', profile?.id ?? null);
  }

  saveConfig() {
    if (!this.config) {
      return;
    }
    try {
      const obj = this.config.toObj();
      localStorage.setItem('audioConvolverProfiles', JSON.stringify(obj));
    } catch (e) {
      console.warn('Could not save convolver config', e);
    }
  }

  async getChannelCount() {
    return Math.min(await this.configManager.getChannelCount().catch(() => 0), MAX_AUDIO_CHANNELS);
  }

  static isSupported() {
    return IndexedDBManager.isSupported();
  }

  async getImpulseResponse(file) {
    if (!this.audioContext) {
      throw new Error('AudioContext not set up yet');
    }

    // Decode the audio data
    const arrayBuffer = await file.arrayBuffer();
    const audioData = await this.audioContext.decodeAudioData(arrayBuffer).catch((e) => null);
    if (!audioData) {
      throw new Error('Could not decode impulse response: ' + name);
    }

    // audiobuffer, get first channel
    if (audioData.numberOfChannels < 1) {
      throw new Error('Impulse response has no channels');
    }

    const channelData = audioData.getChannelData(0);

    // trim to IMPULSE_LENGTH
    const IMPULSE_LENGTH = this.currentProfile ? this.currentProfile.bufferSize : 2048;
    if (channelData.length > IMPULSE_LENGTH) {
      const trimmedData = channelData.slice(0, IMPULSE_LENGTH);
      const newBuffer = this.audioContext.createBuffer(1, IMPULSE_LENGTH, audioData.sampleRate);
      newBuffer.copyToChannel(trimmedData, 0);
      return newBuffer;
    }

    // or return as is
    return audioData;
  }

  setupNodes(audioContext) {
    super.setupNodes(audioContext);
    this.getInputNode().connect(this.getOutputNode());

    // clear existing channel buffers and convolvers
    this.convolverChannels.forEach((ch) => {
      ch.impulseBuffer = null;
      ch.convolverNode = null;
    });

    this.splitterNode = null;
    this.mergerNode = null;
    this.gainNode = null;

    this.loadImpulseResponses();
  }

  updateUI() {
    this.ui.convolverToggle.classList.toggle('enabled', this.config.enabled);
    this.ui.convolverToggle.textContent = this.config.enabled ? Localize.getMessage('audioconvolver_enabled') : Localize.getMessage('audioconvolver_disabled');

    if (this.currentProfile) {
      this.ui.downmixToggle.classList.toggle('enabled', this.currentProfile.downmix);
      this.ui.downmixToggle.textContent = this.currentProfile.downmix ? Localize.getMessage('audioconvolver_downmix_on') : Localize.getMessage('audioconvolver_downmix_off');
      this.ui.impulseLengthInput.value = this.currentProfile.bufferSize;

      for (const channel of this.convolverChannels) {
        const channelConfig = this.currentProfile.channels[channel.id];
        if (!channelConfig) {
          continue;
        }
        channel.enableCheckbox.checked = channelConfig.enabled;
        channel.normalizeCheckbox.checked = channelConfig.normalize;
        channel.fileButton.textContent = channel.fileName ? StringUtils.truncateFilename(channel.fileName, 32) : Localize.getMessage('audioconvolver_selectfile');
        channel.fileButton.classList.toggle('has_file', !!channel.fileName);
        if (channel.fileName === 'Error' && channel.impulseBuffer === null) {
          channel.fileButton.classList.add('error');
        } else {
          channel.fileButton.classList.remove('error');
        }
      }
    }
  }

  async updateChannelCount() {
    this.updateNodes();
  }

  async updateNodes() {
    if (!this.audioContext) {
      return;
    }

    const channelCount = await this.getChannelCount();
    if (channelCount === 0) {
      return;
    }

    const finalChannelCount = (this.currentProfile?.downmix && this.audioContext.destination.channelCount < channelCount) ? this.audioContext.destination.channelCount : channelCount;
    const activeChannels = AudioUtils.getActiveChannelsForChannelCount(finalChannelCount);
    const isEnabled = this.config.enabled && this.currentProfile && this.currentProfile.channels.some((ch, i) => ch.enabled && this.convolverChannels[i] && this.convolverChannels[i].impulseBuffer && activeChannels.includes(i));
    const needsGain = isEnabled && this.currentProfile.downmix && this.audioContext.destination.channelCount < channelCount;
    const needsDeleteSplitter = !isEnabled || (this.splitterNode && this.splitterNode.numberOfOutputs !== finalChannelCount);

    this.convolverChannels.forEach((ch, i) => {
      if (activeChannels.includes(i)) {
        ch.label.classList.remove('disabled');
      } else {
        ch.label.classList.add('disabled');
      }
    });

    if (this.gainNode && !needsGain) {
      // disconnect gain from input and splitter
      this.getInputNode().disconnect(this.gainNode);
      this.gainNode.disconnect(this.splitterNode);
      this.getInputNode().connect(this.splitterNode);
      this.gainNode = null;
    }

    if (needsDeleteSplitter && this.splitterNode) {
      // disconnect splitter, convolvers, merger
      this.getInputNode().disconnect(this.splitterNode);

      this.convolverChannels.forEach((ch) => {
        if (ch.convolverNode) {
          this.splitterNode.disconnect(ch.convolverNode);
          ch.convolverNode.disconnect(this.mergerNode);
          ch.convolverNode = null;
        }
      });

      this.getOutputNode().disconnectFrom(this.mergerNode);

      this.splitterNode = null;
      this.mergerNode = null;

      this.getInputNode().connect(this.getOutputNode());
    }

    if (isEnabled && !this.splitterNode) {
      this.getInputNode().disconnect(this.getOutputNode());

      // create splitter and merger
      this.splitterNode = this.audioContext.createChannelSplitter(finalChannelCount);
      this.mergerNode = this.audioContext.createChannelMerger(finalChannelCount);

      activeChannels.forEach((ch, idx) => {
        this.splitterNode.connect(this.mergerNode, idx, idx);
      });

      this.getInputNode().connect(this.splitterNode);
      this.getOutputNode().connectFrom(this.mergerNode);
    }

    if (needsGain && !this.gainNode) {
      this.getInputNode().disconnect(this.splitterNode);
      // create gain node
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1;
      this.gainNode.channelCountMode = 'explicit';
      try {
        this.gainNode.channelCount = finalChannelCount;
      } catch (e) {
        console.warn('Could not set channel count on convolver gain node', e);
      }

      this.getInputNode().connect(this.gainNode);
      this.gainNode.connect(this.splitterNode);
    }

    if (this.splitterNode) {
      activeChannels.forEach((i, idx) => {
        const channelConfig = this.currentProfile.channels[i];
        const ch = this.convolverChannels[i];
        if (!channelConfig || !channelConfig.enabled || !ch.impulseBuffer) {
          // disconnect if exists
          if (ch.convolverNode) {
            this.splitterNode.disconnect(ch.convolverNode);
            ch.convolverNode.disconnect(this.mergerNode);
            ch.convolverNode = null;
            this.splitterNode.connect(this.mergerNode, idx, idx);
          }
          return;
        }

        if (!ch.convolverNode) {
          this.splitterNode.disconnect(this.mergerNode, idx, idx);
          ch.convolverNode = this.audioContext.createConvolver();
          this.splitterNode.connect(ch.convolverNode, idx, 0);
          ch.convolverNode.connect(this.mergerNode, 0, idx);
        }

        ch.convolverNode.normalize = channelConfig.normalize;
        ch.convolverNode.buffer = ch.impulseBuffer;
      });
    }
  }

  updateProfileDropdown(defaultID = undefined) {
    const oldDropdown = this.ui.profileDropdown;

    const optionsList = {};

    // optionsList['disable'] = Localize.getMessage('audioconvolver_disable');

    this.config.profiles.forEach((profile) => {
      optionsList['p' + profile.id] = profile.label;
    });


    // optionsList['import'] = Localize.getMessage('player_audioconfig_import_profile');
    const id = defaultID !== undefined ? defaultID : (this.currentProfile?.id ?? null);
    console.log('Setting convolver profile dropdown to', id);

    this.ui.profileDropdown = createDropdown(id === null ? 'disable' : ('p' + id),
        Localize.getMessage('audioconvolver_convolver'), optionsList, (val, prevVal) => {
          if (val === 'disable') {
            this.config.enabled = false;
            this.setCurrentProfile(null);
            this.updateUI();
            this.updateNodes();
            this.saveConfig();
            return;
          }
          const profile = this.config.profiles.find((profile) => profile.id === parseInt(val.substring(1)));
          if (profile) {
            this.setCurrentProfile(profile);
          }
        }, (key, displayName)=>{
          if (key === 'disable') {
            return;
          }

          displayName = displayName.replaceAll('\n', ' ').trim();

          if (displayName.length === 0) {
            displayName = Localize.getMessage('player_audioconfig_profile_unnamed');
          }

          const profile = this.config.profiles.find((profile) => profile.id === parseInt(key.substring(1)));
          if (profile) {
            profile.label = displayName;
            this.saveConfig();
          }
        },
    );
    if (oldDropdown) {
      this.ui.convolverControls.replaceChild(this.ui.profileDropdown, oldDropdown);
    } else {
      this.ui.convolverControls.appendChild(this.ui.profileDropdown);
    }
  }

  setupUI() {
    this.ui = {};

    this.ui.convolver = WebUtils.create('div', null, 'convolver');

    this.ui.convolverTitle = WebUtils.create('div', null, 'convolver_title');
    this.ui.convolverTitle.textContent = Localize.getMessage('audioconvolver_title');
    this.ui.convolver.appendChild(this.ui.convolverTitle);

    this.ui.convolverContainer = WebUtils.create('div', null, 'convolver_container');
    this.ui.convolver.appendChild(this.ui.convolverContainer);

    this.ui.convolverControls = WebUtils.create('div', null, 'convolver_controls');
    this.ui.convolverContainer.appendChild(this.ui.convolverControls);

    this.ui.convolverToggle = WebUtils.create('div', null, 'convolver_toggle');
    this.ui.convolverControls.appendChild(this.ui.convolverToggle);
    WebUtils.setupTabIndex(this.ui.convolverToggle);

    this.ui.convolverToggle.addEventListener('click', () => {
      if (!this.config) {
        return;
      }
      this.config.enabled = !this.config.enabled;
      this.updateUI();
      this.updateNodes();
      this.saveConfig();
    });

    this.updateProfileDropdown();

    this.ui.downmixToggle = WebUtils.create('div', null, 'convolver_downmix_toggle');
    this.ui.convolverControls.appendChild(this.ui.downmixToggle);
    WebUtils.setupTabIndex(this.ui.downmixToggle);

    this.ui.downmixToggle.addEventListener('click', () => {
      if (!this.currentProfile) {
        return;
      }
      this.currentProfile.downmix = !this.currentProfile.downmix;
      this.updateUI();
      this.updateNodes();
      this.saveConfig();
    });

    this.ui.impulseLengthContainer = WebUtils.create('div', null, 'convolver_impulse_length_container');
    this.ui.convolverControls.appendChild(this.ui.impulseLengthContainer);

    const impulseLengthLabel = WebUtils.create('div', null, 'convolver_impulse_length_label');
    impulseLengthLabel.textContent = Localize.getMessage('audioconvolver_impulselength');
    this.ui.impulseLengthContainer.appendChild(impulseLengthLabel);
    const impulseLengthInput = WebUtils.create('input', null, 'convolver_impulse_length_input');
    impulseLengthInput.type = 'number';
    impulseLengthInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });
    impulseLengthInput.addEventListener('keyup', (e) => {
      e.stopPropagation();
    });
    impulseLengthInput.addEventListener('change', () => {
      if (!this.currentProfile) {
        return;
      }
      let val = parseInt(impulseLengthInput.value);
      if (isNaN(val) || val < 128) {
        val = 128;
      } else if (val > 16384) {
        val = 16384;
      }
      impulseLengthInput.value = val;
      this.currentProfile.bufferSize = val;
      this.saveConfig();
      this.loadImpulseResponses();
    });

    this.ui.impulseLengthInput = impulseLengthInput;
    this.ui.impulseLengthContainer.appendChild(impulseLengthInput);


    this.ui.convolverChannelTable = WebUtils.create('div', null, 'convolver_channel_table');
    this.ui.convolverContainer.appendChild(this.ui.convolverChannelTable);


    // add header
    const headerRow = WebUtils.create('div', null, 'convolver_channel_row header');
    this.ui.convolverChannelTable.appendChild(headerRow);

    const headerLabel = WebUtils.create('div', null, 'convolver_channel_label');
    headerLabel.textContent = Localize.getMessage('audioconvolver_channel');
    headerRow.appendChild(headerLabel);

    const headerEnable = WebUtils.create('div', null, 'convolver_channel_enable');
    headerEnable.textContent = Localize.getMessage('audioconvolver_enable');
    headerRow.appendChild(headerEnable);

    const headerNormalize = WebUtils.create('div', null, 'convolver_channel_normalize');
    headerNormalize.textContent = Localize.getMessage('audioconvolver_normalize');
    headerRow.appendChild(headerNormalize);

    const headerFile = WebUtils.create('div', null, 'convolver_channel_file');
    headerFile.textContent = Localize.getMessage('audioconvolver_impulseresponse');
    headerRow.appendChild(headerFile);

    this.convolverChannels = [];

    for (let i = 0; i < MAX_AUDIO_CHANNELS; i++) {
      ((i)=>{
        const channelRow = WebUtils.create('div', null, 'convolver_channel_row');
        this.ui.convolverChannelTable.appendChild(channelRow);

        const channelLabel = WebUtils.create('div', null, 'convolver_channel_label');
        channelLabel.textContent = CHANNEL_NAMES[i] || `Channel ${i + 1}`;
        channelRow.appendChild(channelLabel);

        const enableCheckbox = WebUtils.create('input', null, 'convolver_channel_enable');
        enableCheckbox.type = 'checkbox';
        channelRow.appendChild(enableCheckbox);

        const normalizeCheckbox = WebUtils.create('input', null, 'convolver_channel_normalize');
        normalizeCheckbox.type = 'checkbox';
        channelRow.appendChild(normalizeCheckbox);

        const fileButton = WebUtils.create('div', null, 'convolver_channel_file');
        fileButton.textContent = Localize.getMessage('audioconvolver_selectfile');
        channelRow.appendChild(fileButton);
        WebUtils.setupTabIndex(fileButton);

        const channel = {
          id: i,
          label: channelLabel,
          enableCheckbox: enableCheckbox,
          normalizeCheckbox: normalizeCheckbox,
          fileButton: fileButton,
          fileName: null,
        };
        this.convolverChannels.push(channel);

        enableCheckbox.addEventListener('change', () => {
          if (!this.currentProfile) {
            return;
          }
          const channelConfig = this.currentProfile.channels[i];
          if (channelConfig) {
            channelConfig.enabled = enableCheckbox.checked;
          }
          this.updateUI();
          this.updateNodes();
          this.saveConfig();
        });
        normalizeCheckbox.addEventListener('change', () => {
          if (!this.currentProfile) {
            return;
          }
          const channelConfig = this.currentProfile.channels[i];
          if (channelConfig) {
            channelConfig.normalize = normalizeCheckbox.checked;
          }
          this.updateUI();
          this.updateNodes();
          this.saveConfig();
        });
        fileButton.addEventListener('click', async (e) => {
          if (!this.currentProfile) {
            return;
          }
          const input = WebUtils.create('input');
          input.type = 'file';
          input.accept = '.wav,.mp3,.ogg,.flac,.aiff,.aif';
          input.style.display = 'none';
          document.body.appendChild(input);
          const name = this.getImpulseNameForChannel(this.currentProfile.id, i);
          input.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (file) {
              try {
                await this.setImpulseResponse(name, file);
                const channelConfig = this.currentProfile.channels[i];
                if (channelConfig) {
                  channelConfig.enabled = true;
                  channel.fileName = file.name;
                  this.saveConfig();
                }

                // try to decode to verify it's valid
                try {
                  const data = await this.getImpulseResponse(file);
                  channel.impulseBuffer = data;
                } catch (e) {
                  channel.impulseBuffer = null;
                  console.warn('Could not decode impulse response for channel', i, e);
                  channel.fileName = 'Error';
                }

                this.updateUI();
                this.updateNodes();
              } catch (err) {
                console.error('Error storing impulse response:', err);
                alert(Localize.getMessage('audioconvolver_fileerror'));
              }
            }
            document.body.removeChild(input);
          });
          input.click();
          e.stopPropagation();
        });
      })(i);
    }
  }

  getImpulseNameForChannel(profileId, channelId) {
    return `p${profileId}-ch${channelId}`;
  }


  getElement() {
    return this.ui.convolver;
  }

  setConfig(config) {
    // this.config = config;
    // this.updateUI();
    // this.updateNodes();
  }

  async setImpulseResponse(name, data) {
    await this.initPromise;
    return this.db.setFile(name, data);
  }

  async loadImpulseResponses() {
    try {
      await this.initPromise;
    } catch (e) {
      // not supported, disable
      this.getElement().style.display = 'none';
      console.warn('IndexedDB not supported, disabling convolver', e);
      return;
    }

    for (let i = 0; i < MAX_AUDIO_CHANNELS; i++) {
      const channel = this.convolverChannels[i];
      if (!this.currentProfile) {
        channel.impulseBuffer = null;
        continue;
      }

      const name = this.getImpulseNameForChannel(this.currentProfile.id, i);
      const file = await this.db.getFile(name).catch((e) => null);


      // set name
      channel.fileName = file ? file.name : null;

      if (file) {
        try {
          // try to decode to verify it's valid
          const data = await this.getImpulseResponse(file);
          channel.impulseBuffer = data;
        } catch (e) {
          channel.impulseBuffer = null;
          console.warn('Could not decode impulse response for channel', i, e);
          channel.fileName = 'Error';
        }
      }
    }

    this.updateUI();
    this.updateNodes();
  }
}
