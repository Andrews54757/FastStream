import {Localize} from '../../modules/Localize.mjs';
import {IndexedDBManager} from '../../network/IndexedDBManager.mjs';
import {AudioUtils} from '../../utils/AudioUtils.mjs';
import {WebUtils} from '../../utils/WebUtils.mjs';
import {AbstractAudioModule} from './AbstractAudioModule.mjs';
import {AudioConvolverControl} from './config/AudioConvolverControl.mjs';
import {CHANNEL_NAMES, MAX_AUDIO_CHANNELS} from './config/AudioProfile.mjs';

const IMPULSE_LENGTH = 2048;

export class OutputConvolver extends AbstractAudioModule {
  constructor(configManager) {
    super('OutputConvolver');

    this.configManager = configManager;

    this.db = new IndexedDBManager('faststream-impulse-responses');
    this.loadConfig();
    this.setupUI();
  }

  loadConfig() {
    const configData = localStorage.getItem('audioConvolverConfig');
    if (configData) {
      try {
        const obj = JSON.parse(configData);
        this.config = AudioConvolverControl.fromObj(obj);
      } catch (e) {
        console.warn('Could not parse saved convolver config, using default', e);
        this.config = AudioConvolverControl.default();
      }
    } else {
      this.config = AudioConvolverControl.default();
    }
  }

  saveConfig() {
    if (!this.config) {
      return;
    }
    try {
      const obj = this.config.toObj();
      localStorage.setItem('audioConvolverConfig', JSON.stringify(obj));
    } catch (e) {
      console.warn('Could not save convolver config', e);
    }
  }

  async getChannelCount() {
    return Math.min(await this.configManager.getChannelCount().catch(() => 0), MAX_AUDIO_CHANNELS);
  }

  static async isSupported() {
    return IndexedDBManager.isSupportedAndAvailable();
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
    if (channelData.length > IMPULSE_LENGTH) {
      const trimmedData = channelData.slice(0, IMPULSE_LENGTH);
      const newBuffer = this.audioContext.createBuffer(1, IMPULSE_LENGTH, audioData.sampleRate);
      newBuffer.copyToChannel(trimmedData, 0);
      return newBuffer;
    }

    // or return as is
    return audioData;
  }

  async setImpulseResponse(name, data) {
    if (!this.db.getDatabase()) {
      await this.db.setup();
    }
    return this.db.setFile(name, data);
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
    if (!this.config) {
      return;
    }
    this.ui.convolverToggle.classList.toggle('enabled', this.config.enabled);
    this.ui.convolverToggle.textContent = this.config.enabled ? Localize.getMessage('audioconvolver_enabled') : Localize.getMessage('audioconvolver_disabled');
    this.ui.downmixToggle.classList.toggle('enabled', this.config.downmix);
    this.ui.downmixToggle.textContent = this.config.downmix ? Localize.getMessage('audioconvolver_downmix_on') : Localize.getMessage('audioconvolver_downmix_off');

    for (const channel of this.convolverChannels) {
      const channelConfig = this.config.channels[channel.id];
      if (!channelConfig) {
        continue;
      }
      channel.enableCheckbox.checked = channelConfig.enabled;
      channel.normalizeCheckbox.checked = channelConfig.normalize;
      channel.fileButton.textContent = channel.fileName ? channel.fileName : Localize.getMessage('audioconvolver_selectfile');
      channel.fileButton.classList.toggle('has_file', !!channel.fileName);
    }
  }

  async updateChannelCount() {
    this.updateNodes();
  }

  async updateNodes() {
    if (!this.audioContext || !this.config) {
      return;
    }

    const channelCount = await this.getChannelCount();
    if (channelCount === 0) {
      return;
    }

    const isEnabled = this.config.enabled && this.config.channels.some((ch, i) => ch.enabled && this.convolverChannels[i] && this.convolverChannels[i].impulseBuffer);
    const needsGain = isEnabled && this.config.downmix && this.audioContext.destination.channelCount < channelCount;
    const finalChannelCount = (this.config.downmix && this.audioContext.destination.channelCount < channelCount) ? this.audioContext.destination.channelCount : channelCount;
    const needsDeleteSplitter = !isEnabled || (this.splitterNode && this.splitterNode.numberOfOutputs !== finalChannelCount);

    const activeChannels = AudioUtils.getActiveChannelsForChannelCount(finalChannelCount);
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
        const channelConfig = this.config.channels[i];
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

    this.ui.downmixToggle = WebUtils.create('div', null, 'convolver_downmix_toggle');
    this.ui.convolverControls.appendChild(this.ui.downmixToggle);
    WebUtils.setupTabIndex(this.ui.downmixToggle);

    this.ui.downmixToggle.addEventListener('click', () => {
      if (!this.config) {
        return;
      }
      this.config.downmix = !this.config.downmix;
      this.updateUI();
      this.updateNodes();
      this.saveConfig();
    });

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
          if (!this.config) {
            return;
          }
          const channelConfig = this.config.channels[i];
          if (channelConfig) {
            channelConfig.enabled = enableCheckbox.checked;
          }
          this.updateUI();
          this.updateNodes();
          this.saveConfig();
        });
        normalizeCheckbox.addEventListener('change', () => {
          if (!this.config) {
            return;
          }
          const channelConfig = this.config.channels[i];
          if (channelConfig) {
            channelConfig.normalize = normalizeCheckbox.checked;
          }
          this.updateUI();
          this.updateNodes();
          this.saveConfig();
        });
        fileButton.addEventListener('click', async (e) => {
          if (!this.config) {
            return;
          }
          const input = WebUtils.create('input');
          input.type = 'file';
          input.accept = '.wav,.mp3,.ogg,.flac,.aiff,.aif';
          input.style.display = 'none';
          document.body.appendChild(input);
          const name = this.getImpulseNameForChannel(i);
          input.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (file) {
              try {
                await this.setImpulseResponse(name, file);
                const channelConfig = this.config.channels[i];
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

  getImpulseNameForChannel(channelId) {
    return `ch${channelId}`;
  }


  getElement() {
    return this.ui.convolver;
  }

  setConfig(config) {
    // this.config = config;
    // this.updateUI();
    // this.updateNodes();
  }

  async loadImpulseResponses() {
    if (!this.db) {
      return;
    }
    if (!this.db.getDatabase()) {
      await this.db.setup();
    }

    for (let i = 0; i < MAX_AUDIO_CHANNELS; i++) {
      const name = this.getImpulseNameForChannel(i);
      const file = await this.db.getFile(name).catch((e) => null);
      const channel = this.convolverChannels[i];

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
