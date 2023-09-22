import {EventEmitter} from '../modules/eventemitter.mjs';
import {InterfaceUtils} from '../utils/InterfaceUtils.mjs';
import {StringUtils} from '../utils/StringUtils.mjs';
import {WebUtils} from '../utils/WebUtils.mjs';
import {DOMElements} from './DOMElements.mjs';

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
  }

  openUI() {
    InterfaceUtils.closeWindows();
    DOMElements.audioConfigContainer.style.display = '';
  }

  closeUI() {
    DOMElements.audioConfigContainer.style.display = 'none';
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

    this.ui.profileDropdown = WebUtils.createDropdown('1',
        'Profile', {
          '1': 'Default',
          'create': 'Create new profile',
        }, (val) => {

        }, (key, displayName)=>{

        },
    );
    this.ui.profileDropdown.classList.add('profile_selector');
    this.ui.profileManager.appendChild(this.ui.profileDropdown);

    // load button
    this.ui.loadButton = WebUtils.create('div', null, 'textbutton load_button');
    this.ui.loadButton.textContent = 'Load Profile';
    this.ui.profileManager.appendChild(this.ui.loadButton);
    WebUtils.setupTabIndex(this.ui.loadButton);

    // save button
    this.ui.saveButton = WebUtils.create('div', null, 'textbutton save_button');
    this.ui.saveButton.textContent = 'Save Profile';
    this.ui.profileManager.appendChild(this.ui.saveButton);
    WebUtils.setupTabIndex(this.ui.saveButton);

    // delete button
    this.ui.deleteButton = WebUtils.create('div', null, 'textbutton delete_button');
    this.ui.deleteButton.textContent = 'Delete';
    this.ui.profileManager.appendChild(this.ui.deleteButton);
    WebUtils.setupTabIndex(this.ui.deleteButton);


    this.ui.equalizerContainer = WebUtils.create('div', null, 'equalizer_container');
    DOMElements.audioConfigContainer.appendChild(this.ui.equalizerContainer);

    this.ui.equalizer = WebUtils.create('div', null, 'equalizer');
    this.ui.equalizerContainer.appendChild(this.ui.equalizer);

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
    if (!this.analyser) return;


    if (this.ui.equalizer.clientWidth === 0 || this.ui.equalizer.clientHeight === 0) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    this.ui.spectrumCanvas.width = this.ui.equalizer.clientWidth * window.devicePixelRatio;
    this.ui.spectrumCanvas.height = this.ui.equalizer.clientHeight * window.devicePixelRatio;

    const width = this.ui.spectrumCanvas.width;
    const height = this.ui.spectrumCanvas.height;

    this.spectrumCtx.clearRect(0, 0, width, height);

    const sampleRate = this.analyser.context.sampleRate;
    const maxFreq = sampleRate / 2;

    const frequencyWidth = maxFreq;
    const logFrequencyWidth = Math.log10(frequencyWidth) - Math.log10(20);

    // Draw bars but with log frequency scale
    const xScale = width / logFrequencyWidth;
    const yScale = height / 255;

    let lastX = -1;
    for (let i = 0; i < bufferLength; i++) {
      const x = Math.log10((i+1) * frequencyWidth / bufferLength, 1) - Math.log10(20);
      if (x < 0) continue;
      const y = dataArray[i];
      // sky blue->red colors based on strength
      this.spectrumCtx.fillStyle = `rgb(${y}, ${255 - y}, 255)`;
      const newX = Math.floor(x * xScale);
      if (newX === lastX) continue;
      this.spectrumCtx.fillRect(newX, height - y * yScale, 1, y * yScale);
      lastX = newX;
    }
  }

  renderEqualizerResponse() {
    if (!this.analyser) return;

    if (this.ui.equalizer.clientWidth === 0 || this.ui.equalizer.clientHeight === 0) return;

    this.ui.equalizerCanvas.width = this.ui.equalizer.clientWidth * window.devicePixelRatio;
    this.ui.equalizerCanvas.height = this.ui.equalizer.clientHeight * window.devicePixelRatio;

    const width = this.ui.equalizerCanvas.width;
    const height = this.ui.equalizerCanvas.height;
    const sampleRate = this.analyser.context.sampleRate;
    const maxFreq = sampleRate / 2;

    const bufferLength = width;
    const frequencyArray = new Float32Array(bufferLength);
    const step = Math.log10(maxFreq / 20) / bufferLength;
    for (let i = 0; i < bufferLength; i++) {
      frequencyArray[i] = Math.floor(Math.min(Math.pow(10, i * step + Math.log10(20)), maxFreq));
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
        this.equalizerCtx.moveTo(x * xScale, height - y * yScale);
      } else {
        this.equalizerCtx.lineTo(x * xScale, height - y * yScale);
      }
    }
    this.equalizerCtx.stroke();
  }

  setupEqualizerAxis() {
    this.ui.equalizerFrequencyAxis.replaceChildren();
    this.ui.equalizerDecibelAxis.replaceChildren();

    const sampleRate = this.analyser.context.sampleRate;
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
        label.textContent = `${StringUtils.formatFrequency(frequency)}`;
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
          label.textContent = `${StringUtils.formatFrequency(subfrequency)}`;
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
      label.textContent = `${maxFreq}`;
      lastTick.appendChild(label);
    } else {
      lastTick.lastChild.textContent = `${StringUtils.formatFrequency(maxFreq)}`;
    }


    const minDecibels = -20;
    const maxDecibels = 20;
    const decibelWidth = maxDecibels - minDecibels;

    for (let i = 0; i <= decibelWidth / 5; i++) {
      const el = WebUtils.create('div', null, 'eq_tick_marker');
      const db = Math.round(maxDecibels - i * 5);
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

  setupNodes() {
    if (this.client.audioContext !== this.audioContext) {
      this.reset();
    }

    this.audioContext = this.client.audioContext;
    this.audioSource = this.client.audioSource;

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.5;
    // this.analyser.minDecibels = -100;
    // this.analyser.maxDecibels = 0;

    this.audioSource.connect(this.analyser);
    this.setupEqualizerAxis();
    this.startRenderLoop();
    this.renderEqualizerResponse();
  }
}
