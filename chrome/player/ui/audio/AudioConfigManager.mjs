import {Localize} from '../../modules/Localize.mjs';
import {AlertPolyfill} from '../../utils/AlertPolyfill.mjs';
import {InterfaceUtils} from '../../utils/InterfaceUtils.mjs';
import {Utils} from '../../utils/Utils.mjs';
import {WebUtils} from '../../utils/WebUtils.mjs';
import {DOMElements} from '../DOMElements.mjs';
import {createDropdown} from '../components/Dropdown.mjs';
import {AbstractAudioModule} from './AbstractAudioModule.mjs';
import {AudioChannelMixer} from './AudioChannelMixer.mjs';
import {AudioCrosstalk} from './AudioCrosstalk.mjs';
import {AudioGain} from './AudioGain.mjs';
import {MonoUpscaler} from './MonoUpscaler.mjs';
import {AudioProfile} from './config/AudioProfile.mjs';

export class AudioConfigManager extends AbstractAudioModule {
  constructor(client) {
    super('AudioConfigManager');
    this.client = client;
    this.profiles = [];
    this.ui = {};


    this.renderLoopRunning = false;
    this.shouldRunRenderLoop = false;
    this.audioUpscaler = new MonoUpscaler();
    this.audioChannelMixer = new AudioChannelMixer();
    this.audioCrosstalk = new AudioCrosstalk();
    this.finalGain = new AudioGain();

    const upscale = () => {
      return; // Webaudio is bugged
      if (this.audioCompressor.needsUpscaler() || this.audioChannelMixer.needsUpscaler() || this.audioCrosstalk.needsUpscaler()) {
        this.audioUpscaler.enable();
      } else {
        this.audioUpscaler.disable();
      }
    };
    this.audioChannelMixer.on('upscale', upscale);
    this.audioCrosstalk.on('upscale', upscale);

    this.setupUI();
    this.loadProfilesFromStorage();
  }

  async loadProfilesFromStorage() {
    try {
      const audioProfilesStr = await Utils.getConfig('audioProfiles') || '[]';
      const currentAudioProfileStr = await Utils.getConfig('currentAudioProfile') || '-1';

      const audioProfiles = JSON.parse(audioProfilesStr);
      const currentAudioProfileID = parseInt(currentAudioProfileStr);

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
    } catch (e) {
      AlertPolyfill.errorSendToDeveloper(e);
    }
  }

  async saveProfilesToStorage() {
    await Utils.setConfig('audioProfiles', JSON.stringify(this.profiles.map((profile) => profile.toObj())));
    await Utils.setConfig('currentAudioProfile', this.currentProfile ? this.currentProfile.id : (this.profiles[0]?.id || 0));
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
        profile.label = profile.label + ' ' + Localize.getMessage('player_audioconfig_duplicate_profile', [(new Date()).toDateString()]);
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
    this.audioChannelMixer.setConfig(this.currentProfile);
    this.audioCrosstalk.setCrosstalkConfig(this.currentProfile.crosstalk);
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

    return this.saveProfilesToStorage();
  }

  updateProfileDropdown(defaultID = null) {
    const oldDropdown = this.ui.profileDropdown;

    const optionsList = {};

    this.profiles.forEach((profile) => {
      optionsList['p' + profile.id] = profile.label;
    });

    optionsList['create'] = Localize.getMessage('player_audioconfig_create_profile');
    optionsList['import'] = Localize.getMessage('player_audioconfig_import_profile');

    let id = defaultID !== null ? defaultID : (this.currentProfile?.id || 0);
    if (!this.profiles.find((profile) => profile.id === id)) {
      id = this.profiles[0]?.id || 0;
    }

    this.ui.profileDropdown = createDropdown('p' + id,
        Localize.getMessage('player_audioconfig_profile'), optionsList, (val, prevVal) => {
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
                  AlertPolyfill.alert(Localize.getMessage('player_audioconfig_import_invalid'), 'error');
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
            displayName = Localize.getMessage('player_audioconfig_profile_unnamed');
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

    WebUtils.setLabels(DOMElements.audioConfigBtn, Localize.getMessage('player_audioconfig_close_label'));
  }

  closeUI() {
    DOMElements.audioConfigContainer.style.display = 'none';
    this.stopRenderLoop();

    WebUtils.setLabels(DOMElements.audioConfigBtn, Localize.getMessage('player_audioconfig_open_label'));
  }

  isOpen() {
    return DOMElements.audioConfigContainer.style.display !== 'none';
  }

  saveCurrentProfile() {
    const profile = this.getDropdownProfile();
    if (!profile) {
      this.updateProfileDropdown();
      console.error('Couldn\'t save profile');
      return;
    }

    const newProfile = this.currentProfile.copy();
    newProfile.label = profile.label;
    newProfile.id = profile.id;

    const index = this.profiles.indexOf(profile);
    if (index !== -1) this.profiles.splice(index, 1, newProfile);

    this.updateProfileDropdown();
    return this.saveProfilesToStorage();
  }

  getDropdownProfile() {
    const id = parseInt(this.ui.profileDropdown.dataset.val.substring(1));
    return this.profiles.find((profile) => profile.id === id);
  }
  setupUI() {
    const contentContainer = DOMElements.audioConfigContainer.getElementsByClassName('content_container')[0];

    DOMElements.audioConfigContainer.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    DOMElements.audioConfigContainer.addEventListener('keyup', (e) => {
      e.stopPropagation();
    });

    DOMElements.audioConfigBtn.addEventListener('click', (e) => {
      if (!this.isOpen()) {
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
    contentContainer.appendChild(this.ui.profileManager);

    this.ui.profileDropdown = document.createElement('div');
    this.ui.profileManager.appendChild(this.ui.profileDropdown);
    this.updateProfileDropdown();

    // load button
    this.ui.loadButton = WebUtils.create('div', null, 'textbutton load_button');
    this.ui.loadButton.textContent = Localize.getMessage('player_audioconfig_profile_load');
    let loadTimeout = null;
    this.ui.profileManager.appendChild(this.ui.loadButton);
    this.ui.loadButton.addEventListener('click', () => {
      const profile = this.getDropdownProfile();
      if (!profile) {
        this.updateProfileDropdown();
        return;
      }
      this.setCurrentProfile(profile);
      this.ui.loadButton.textContent = Localize.getMessage('player_audioconfig_profile_loaded');
      clearTimeout(loadTimeout);
      loadTimeout = setTimeout(() => {
        this.ui.loadButton.textContent = Localize.getMessage('player_audioconfig_profile_load');
      }, 1000);
    });
    WebUtils.setupTabIndex(this.ui.loadButton);

    // save button
    this.ui.saveButton = WebUtils.create('div', null, 'textbutton save_button');
    this.ui.saveButton.textContent = Localize.getMessage('player_audioconfig_profile_save');
    this.ui.profileManager.appendChild(this.ui.saveButton);
    let saveTimeout = null;
    this.ui.saveButton.addEventListener('click', async () => {
      this.ui.saveButton.textContent = Localize.getMessage('player_audioconfig_profile_saving');
      await this.saveCurrentProfile();
      this.ui.saveButton.textContent = Localize.getMessage('player_audioconfig_profile_saved');
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        this.ui.saveButton.textContent = Localize.getMessage('player_audioconfig_profile_save');
      }, 1000);
    });
    WebUtils.setupTabIndex(this.ui.saveButton);

    // download button
    this.ui.downloadButton = WebUtils.create('div', null, 'textbutton download_button');
    this.ui.downloadButton.textContent = Localize.getMessage('player_audioconfig_profile_download');
    let downloadTimeout = null;
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
      this.ui.downloadButton.textContent = Localize.getMessage('player_audioconfig_profile_downloaded');
      clearTimeout(downloadTimeout);
      downloadTimeout = setTimeout(() => {
        this.ui.downloadButton.textContent = Localize.getMessage('player_audioconfig_profile_download');
      }, 1000);
    });
    WebUtils.setupTabIndex(this.ui.downloadButton);

    // delete button
    this.ui.deleteButton = WebUtils.create('div', null, 'textbutton delete_button');
    this.ui.deleteButton.textContent = Localize.getMessage('player_audioconfig_profile_delete');
    this.ui.profileManager.appendChild(this.ui.deleteButton);

    const deleteTimeout = null;
    this.ui.deleteButton.addEventListener('click', async () => {
      const profile = this.getDropdownProfile();
      if (!profile) {
        this.updateProfileDropdown();
        return;
      }

      this.ui.deleteButton.textContent = Localize.getMessage('player_audioconfig_profile_deleting');
      await this.deleteProfile(profile);
      this.ui.deleteButton.textContent = Localize.getMessage('player_audioconfig_profile_deleted');
      clearTimeout(deleteTimeout);
      setTimeout(() => {
        this.ui.deleteButton.textContent = Localize.getMessage('player_audioconfig_profile_delete');
      }, 1000);
    });
    WebUtils.setupTabIndex(this.ui.deleteButton);


    this.ui.dynamicsContainer = WebUtils.create('div', null, 'dynamics_container');
    contentContainer.appendChild(this.ui.dynamicsContainer);

    this.ui.equalizerContainer = WebUtils.create('div', null, 'equalizer-swap');
    this.ui.dynamicsContainer.appendChild(this.ui.equalizerContainer);

    this.ui.compressorContainer = WebUtils.create('div', null, 'compressor-swap');
    this.ui.dynamicsContainer.appendChild(this.ui.compressorContainer);

    this.audioChannelMixer.setupUI(this.ui.equalizerContainer, this.ui.compressorContainer);

    this.ui.dynamicsContainer.appendChild(this.audioChannelMixer.getElement());
    this.ui.dynamicsContainer.appendChild(this.audioCrosstalk.getElement());
  }


  renderLoop() {
    if (!this.shouldRunRenderLoop) {
      this.renderLoopRunning = false;
    } else {
      requestAnimationFrame(() => {
        this.renderLoop();
      });
    }

    this.audioChannelMixer.render();
    this.audioCrosstalk.render();
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

  setupNodes(audioContext) {
    super.setupNodes(audioContext);

    try {
      this.audioUpscaler.setupNodes(this.audioContext);
      this.audioChannelMixer.setupNodes(this.audioContext);
      this.audioCrosstalk.setupNodes(this.audioContext);
      this.finalGain.setupNodes(this.audioContext);

      this.getInputNode().connect(this.audioUpscaler.getInputNode());
      this.audioUpscaler.getOutputNode().connect(this.audioChannelMixer.getInputNode());
      this.audioChannelMixer.getOutputNode().connect(this.audioCrosstalk.getInputNode());
      this.audioCrosstalk.getOutputNode().connect(this.finalGain.getInputNode());
      this.finalGain.getOutputNode().connect(this.getOutputNode());

      // IDK why but webaudio is bugged
      this.audioUpscaler.enable();
    } catch (e) {
      AlertPolyfill.errorSendToDeveloper(e);
    }
  }

  updateVolume(value) {
    this.finalGain.setGain(value);
  }
}
