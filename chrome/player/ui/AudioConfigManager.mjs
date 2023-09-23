import {EventEmitter} from '../modules/eventemitter.mjs';
import {InterfaceUtils} from '../utils/InterfaceUtils.mjs';
import {StringUtils} from '../utils/StringUtils.mjs';
import {Utils} from '../utils/Utils.mjs';
import {WebUtils} from '../utils/WebUtils.mjs';
import {DOMElements} from './DOMElements.mjs';

export class AudioEQNode {
  constructor(type, frequency, gain, q) {
    this.type = type;
    this.frequency = frequency;
    this.gain = gain;
    this.q = q;
  }
}

export class AudioProfile {
  constructor(id) {
    this.id = id;
    this.equalizerNodes = [];
    this.label = `Profile ${id}`;
  }

  static fromObj(obj) {
    const profile = new AudioProfile(obj.id);
    profile.label = obj.label;
    profile.equalizerNodes = obj.equalizerNodes.map((node) => {
      return new AudioEQNode(node.type, node.frequency, node.gain, node.q);
    });
    return profile;
  }

  copy() {
    const profile = new AudioProfile(this.id);
    profile.label = this.label;
    profile.equalizerNodes = this.equalizerNodes.map((node) => {
      return new AudioEQNode(node.type, node.frequency, node.gain, node.q);
    });
    return profile;
  }

  toObj() {
    return {
      id: this.id,
      label: this.label,
      equalizerNodes: this.equalizerNodes.map((node) => {
        return {
          type: node.type,
          frequency: node.frequency,
          gain: node.gain,
          q: node.q,
        };
      }),
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
    });
  }

  saveProfilesToStorage() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      chrome.storage.local.set({
        audioProfiles: JSON.stringify(this.profiles.map((profile) => profile.toObj())),
        currentAudioProfile: this.currentProfile.id,
      });
    }, 500);
  }

  getNextProfileID() {
    let id = 1;
    // Really bad code
    while (this.profiles.find((profile) => profile.id === id)) {
      id++;
    }

    // if (this.currentProfile && this.currentProfile.id === id) {
    //   id++;
    // }

    return id;
  }

  newProfile() {
    const newID = this.getNextProfileID();
    const profile = new AudioProfile(newID);
    this.addProfile(profile);

    Array.from(this.ui.profileDropdown.children[1].children).find((el) => el.dataset.val === 'p' + newID).click();
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
    this.saveProfilesToStorage();
  }

  updateProfileDropdown() {
    const oldDropdown = this.ui.profileDropdown;

    const optionsList = {};

    this.profiles.forEach((profile) => {
      optionsList['p' + profile.id] = profile.label;
    });

    optionsList['create'] = 'Create new profile';

    let id = (this.currentProfile?.id || 0);
    if (!this.profiles.find((profile) => profile.id === id)) {
      id = this.profiles[0]?.id || 0;
    }

    this.ui.profileDropdown = WebUtils.createDropdown('p' + id,
        'Profile', optionsList, (val) => {
          if (val === 'create') {
            this.newProfile();
          } else {

          }
        }, (key, displayName)=>{
          if (key === 'create') {
            return;
          }

          const profile = this.profiles.find((profile) => profile.id === parseInt(key.substring(1)));
          if (profile) {
            profile.label = displayName;
            this.saveProfilesToStorage();
          }
        },
    );
    this.ui.profileDropdown.classList.add('profile_selector');
    this.ui.profileManager.replaceChild(this.ui.profileDropdown, oldDropdown);
  }

  openUI() {
    InterfaceUtils.closeWindows();
    DOMElements.audioConfigContainer.style.display = '';
  }

  closeUI() {
    DOMElements.audioConfigContainer.style.display = 'none';
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

    DOMElements.audioConfigBtn.addEventListener('click', (e) => {
      if (DOMElements.audioConfigContainer.style.display === 'none') {
        this.openUI();
      } else {
        this.closeUI();
      }
      e.stopPropagation();
    });

    DOMElements.playerContainer.addEventListener('click', (e) => {
      this.closeUI();
    });
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


    this.ui.equalizerContainer = WebUtils.create('div', null, 'equalizer_container');
    DOMElements.audioConfigContainer.appendChild(this.ui.equalizerContainer);

    this.ui.equalizer = WebUtils.create('div', null, 'equalizer');
    this.ui.equalizerContainer.appendChild(this.ui.equalizer);

    this.ui.equalizerText = WebUtils.create('div', 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);');
    this.ui.equalizerText.textContent = 'No audio! Please play a video to see the equalizer.';
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
  }

  addEQNode(node) {
    this.currentProfile.equalizerNodes.push(node);
    this.refreshEQNodes();
  }

  refreshEQNodes() {
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

  reset() {

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
    this.renderEqualizerSpectrum();
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
    for (let i = 0; i < bufferLength; i++) {
      const x = Math.log10((i+1) * frequencyWidth / bufferLength, 1) - Math.log10(20);
      const x2 = Math.log10((i+2) * frequencyWidth / bufferLength, 1) - Math.log10(20);
      if (x < 0) continue;
      const yPre = dataArrayPre[i];
      const yPost = dataArrayPost[i];
      // sky blue->red colors based on strength
      const newX = Math.floor(x * xScale);
      if (newX === lastX) continue;

      const barWidth = Utils.clamp((x2 - x) * xScale / 2, 1, 5);
      // pre bar is gray
      if (yPre >= yPost) {
        this.spectrumCtx.fillStyle = `rgba(128, 128, 128, 0.8)`;
        this.spectrumCtx.fillRect(newX, height - yPre * yScale, barWidth, yPre * yScale);

        this.spectrumCtx.fillStyle = `rgb(${yPost}, ${255 - yPost}, 255)`;
        this.spectrumCtx.fillRect(newX, height - yPost * yScale, barWidth, yPost * yScale);
      } else {
        this.spectrumCtx.fillStyle = `rgb(${yPost}, ${255 - yPost}, 255)`;
        this.spectrumCtx.fillRect(newX, height - yPost * yScale, barWidth, yPost * yScale);

        this.spectrumCtx.fillStyle = `rgba(40, 40, 40, 0.5)`;
        this.spectrumCtx.fillRect(newX, height - yPre * yScale, barWidth, yPre * yScale);
      }
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
      let str = `${StringUtils.formatFrequency(node.frequency.value)}Hz ${node.type}`;


      if (typesThatUseGain.includes(node.type)) {
        str += ` ${node.gain.value.toFixed(1)}dB`;
      }

      if (typesThatUseQ.includes(node.type)) {
        str += ` Q=${node.Q.value.toFixed(3)}`;
      }

      return str;
    }

    const sampleRate = this.preAnalyser.context.sampleRate;
    const maxFreq = sampleRate / 2;
    this.equalizerNodes.forEach((node, i) => {
      const el = WebUtils.create('div', null, 'equalizer_node tooltip');
      const frequencyPercent = Math.log10(node.frequency.value / 20) / Math.log10(maxFreq / 20);
      const gainDb = Utils.clamp(node.gain.value, -20, 20) / 40;

      const tooltipText = WebUtils.create('div', null, 'tooltiptext');
      tooltipText.textContent = nodeToString(node);
      el.appendChild(tooltipText);

      el.style.left = `${frequencyPercent * 100}%`;
      el.style.top = `${(-gainDb + 0.5) * 100}%`;
      WebUtils.setupTabIndex(el);
      this.ui.equalizerNodes.appendChild(el);

      let isDragging = false;

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
        tooltipText.textContent = nodeToString(node);
        this.renderEqualizerResponse();
      };

      const mouseUp = (e) => {
        isDragging = false;

        this.ui.equalizer.removeEventListener('mousemove', mouseMove);
        this.ui.equalizer.removeEventListener('mouseup', mouseUp);
      };

      el.addEventListener('mousedown', (e) => {
        if (isDragging) return;
        isDragging = true;
        e.stopPropagation();
        this.ui.equalizer.addEventListener('mousemove', mouseMove);
        this.ui.equalizer.addEventListener('mouseup', mouseUp);
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
      lastTick.lastChild.textContent = `${StringUtils.formatFrequency(maxFreq)}`;
    }
  }

  setupNodes() {
    if (this.client.audioContext !== this.audioContext) {
      this.reset();
    }

    this.audioContext = this.client.audioContext;
    this.audioSource = this.client.audioSource;

    this.preAnalyser = this.audioContext.createAnalyser();
    this.preAnalyser.fftSize = 2048;
    this.preAnalyser.smoothingTimeConstant = 0.5;

    this.postAnalyser = this.audioContext.createAnalyser();
    this.postAnalyser.fftSize = 2048;
    this.postAnalyser.smoothingTimeConstant = 0.5;
    // this.analyser.minDecibels = -100;
    // this.analyser.maxDecibels = 0;

    this.audioSource.connect(this.preAnalyser);
    this.preAnalyser.connect(this.postAnalyser);
    this.ui.equalizerText.style.display = 'none';

    this.setupEqualizerFrequencyAxis();
    this.setupEqualizerDecibelAxis();
    this.startRenderLoop();

    this.refreshEQNodes();
  }

  getOutputNode() {
    return this.postAnalyser;
  }
}
