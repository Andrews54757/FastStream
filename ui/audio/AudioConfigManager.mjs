import {Localize} from '../../modules/Localize.mjs';
import {EventEmitter} from '../../modules/eventemitter.mjs';
import {InterfaceUtils} from '../../utils/InterfaceUtils.mjs';
import {Utils} from '../../utils/Utils.mjs';
import {WebUtils} from '../../utils/WebUtils.mjs';
import {DOMElements} from '../DOMElements.mjs';
import {AudioChannelMixer} from './AudioChannelMixer.mjs';
import {AudioCompressor} from './AudioCompressor.mjs';
import {AudioEqualizer} from './AudioEqualizer.mjs';
import {AudioProfile} from './config/AudioProfile.mjs';
export class AudioConfigManager extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.profiles = [];
    this.ui = {};
    this.renderLoopRunning = false;
    this.shouldRunRenderLoop = false;
    this.audioEqualizer = new AudioEqualizer();
    this.audioCompressor = new AudioCompressor();
    this.audioChannelMixer = new AudioChannelMixer();
    this.setupUI();
    this.loadProfilesFromStorage();
  }
  async loadProfilesFromStorage() {
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
    this.audioEqualizer.setEqualizerConfig(this.currentProfile.equalizerNodes);
    this.audioCompressor.setCompressionConfig(this.currentProfile.compressor);
    this.audioChannelMixer.setChannelMixerConfig(this.currentProfile.mixerChannels);
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
    this.ui.profileDropdown = WebUtils.createDropdown('p' + id,
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
                  alert(Localize.getMessage('player_audioconfig_import_invalid'));
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
  }
  closeUI() {
    DOMElements.audioConfigContainer.style.display = 'none';
    this.stopRenderLoop();
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
    DOMElements.audioConfigContainer.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    DOMElements.audioConfigContainer.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeUI();
        e.preventDefault();
        e.stopPropagation();
      }
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
    DOMElements.audioConfigContainer.appendChild(this.ui.dynamicsContainer);
    this.ui.dynamicsContainer.appendChild(this.audioEqualizer.getElement());
    this.ui.dynamicsContainer.appendChild(this.audioCompressor.getElement());
    this.ui.dynamicsContainer.appendChild(this.audioChannelMixer.getElement());
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
    this.audioEqualizer.render();
    this.audioCompressor.render();
    this.audioChannelMixer.render();
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
  setupNodes() {
    this.audioContext = this.client.audioContext;
    this.audioSource = this.client.audioSource;
    this.audioEqualizer.setupNodes(this.audioContext);
    if (this.audioSource) {
      this.audioSource.connect(this.audioEqualizer.getInputNode());
    }
    this.audioChannelMixer.setupNodes(this.audioContext);
    this.audioEqualizer.getOutputNode().connect(this.audioChannelMixer.getInputNode());
    this.audioCompressor.setupNodes(this.audioContext, this.audioEqualizer.getOutputNode(), this.audioChannelMixer.getInputNode());
    if (DOMElements.audioConfigContainer.style.display !== 'none') {
      this.startRenderLoop();
    }
  }
  getOutputNode() {
    return this.audioChannelMixer.getOutputNode();
  }
}
