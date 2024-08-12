import {Localize} from '../../modules/Localize.mjs';
import {StringUtils} from '../../utils/StringUtils.mjs';
import {Utils} from '../../utils/Utils.mjs';
import {WebUtils} from '../../utils/WebUtils.mjs';
import {AbstractAudioModule} from './AbstractAudioModule.mjs';
import {AudioEQNode} from './config/AudioEQNode.mjs';

export class AudioEqualizer extends AbstractAudioModule {
  constructor() {
    super('AudioEqualizer');
    this.equalizerConfig = null;
    this.equalizerNodes = [];
    this.preAnalyzer = null;
    this.postAnalyzer = null;
    this.equalizerDbResponse = null;
    this.renderCache = {};

    this.setupUI();
  }

  getElement() {
    return this.ui.equalizer;
  }

  setupNodes(audioContext) {
    super.setupNodes(audioContext);
    this.preAnalyzer = null;
    this.postAnalyzer = null;

    this.getInputNode().connect(this.getOutputNode());

    this.setupEqualizerFrequencyAxis();
    this.setupEqualizerDecibelAxis();
    if (this.equalizerConfig) {
      this.refreshEQNodes();
    }
  }

  setEqualizerConfig(config) {
    this.equalizerConfig = config;
    this.refreshEQNodes();
  }

  setupUI() {
    this.ui = {};
    this.ui.equalizer = WebUtils.create('div', null, 'equalizer');

    const equalizerTitle = WebUtils.create('div', null, 'equalizer_title');
    equalizerTitle.textContent = Localize.getMessage('audioeq_title');
    this.ui.equalizer.appendChild(equalizerTitle);

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

  render() {
    if (this.ui.equalizer.clientWidth !== this.pastWidth) {
      this.pastWidth = this.ui.equalizer.clientWidth;
      // Re-render equalizer response when width changes
      this.renderEqualizerResponse();
    }

    this.renderEqualizerSpectrum();
  }

  addEQNode(node) {
    this.equalizerConfig.push(node);
    this.refreshEQNodes();
  }

  refreshEQNodes() {
    try {
      this.getInputNode().disconnect(this.getOutputNode());
    } catch (e) {

    }

    this.equalizerNodes.forEach((node, i) => {
      if (i === 0) {
        this.getInputNode().disconnect(node);
      }
      if (i === this.equalizerNodes.length - 1) {
        this.getOutputNode().disconnectFrom(node);
      }
      node.disconnect();
    });

    this.equalizerNodes = [];
    this.equalizerConfig.forEach((node) => {
      const eqNode = this.audioContext.createBiquadFilter();
      eqNode.type = node.type;
      eqNode.frequency.value = node.frequency;
      eqNode.gain.value = node.gain;
      eqNode.Q.value = node.q;

      this.equalizerNodes.push(eqNode);
    });

    this.equalizerNodes.forEach((node, index) => {
      if (index === 0) {
        this.getInputNode().connect(node);
      } else {
        this.equalizerNodes[index - 1].connect(node);
      }
    });

    if (this.equalizerNodes.length === 0) {
      this.getInputNode().connect(this.getOutputNode());
    } else {
      this.getOutputNode().connectFrom(this.equalizerNodes[this.equalizerNodes.length - 1]);
    }

    this.renderEqualizerResponse();
    this.updateEqualizerNodeMarkers();
  }

  renderEqualizerSpectrum() {
    // check if ui is visible
    if (this.ui.spectrumCanvas.offsetParent !== null) {
      this.setupAnalyzers();
    } else {
      this.destroyAnalyzers();
    }

    if (!this.preAnalyzer || !this.postAnalyzer) return;

    const bufferLength = this.preAnalyzer.frequencyBinCount;
    const dataArrayPre = new Uint8Array(bufferLength);
    const dataArrayPost = new Uint8Array(bufferLength);
    this.preAnalyzer.getByteFrequencyData(dataArrayPre);
    this.postAnalyzer.getByteFrequencyData(dataArrayPost);

    const width = this.ui.equalizer.clientWidth * window.devicePixelRatio;
    const height = this.ui.equalizer.clientHeight * window.devicePixelRatio;

    if (this.renderCache.width !== width || this.renderCache.height !== height) {
      this.ui.spectrumCanvas.width = width;
      this.ui.spectrumCanvas.height = height;
      this.renderCache.width = width;
      this.renderCache.height = height;
    }

    this.spectrumCtx.clearRect(0, 0, width, height);

    const sampleRate = this.audioContext.sampleRate;
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
      lastX = newX;
    }
  }

  updateEqualizerNodeMarkers() {
    Array.from(this.ui.equalizerNodes.children).forEach((node) => {
      if (node.classList.contains('zero_line_node')) return;
      node.remove();
    });

    const typesThatUseGain = ['peaking', 'lowshelf', 'highshelf'];
    const typesThatUseQ = ['lowpass', 'highpass', 'bandpass', 'peaking', 'notch'];

    function nodeToString(node) {
      const header = `${node.type.charAt(0).toUpperCase() + node.type.substring(1)} @${StringUtils.formatFrequency(node.frequency.value)}Hz`;
      const lines = [header];
      const description = [];
      const instructions = [Localize.getMessage('audioeq_instructions')];

      if (typesThatUseGain.includes(node.type)) {
        description.push(Localize.getMessage('audioeq_gain', [node.gain.value.toFixed(1)]));
      }

      if (typesThatUseQ.includes(node.type)) {
        description.push(`Q: ${node.Q.value.toFixed(3)}`);
        instructions.push(Localize.getMessage('audioeq_qscroll'));
      }

      if (description.length > 0) {
        lines.push(description.join(' '));
      }

      lines.push(instructions.join('\r\n'));
      return lines.join('\r\n');
    }

    const sampleRate = this.audioContext.sampleRate;
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
        this.equalizerConfig[i].frequency = frequency;

        if (typesThatUseGain.includes(node.type)) {
          el.style.top = `${newYPercent}%`;
          node.gain.value = newDB;
          this.equalizerConfig[i].gain = newDB;
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
        const delta = Utils.clamp(e.deltaY, -1, 1);
        const q = Utils.clamp(node.Q.value * Math.pow(1.1, delta), 0.0001, 1000);
        node.Q.value = q;
        this.equalizerConfig[i].q = q;
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
        this.equalizerConfig[i].type = newType;

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
        this.equalizerConfig[i].type = newType;

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
          this.equalizerConfig.splice(i, 1);
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
    this.ui.equalizerCanvas.width = this.ui.equalizer.clientWidth * window.devicePixelRatio;
    this.ui.equalizerCanvas.height = this.ui.equalizer.clientHeight * window.devicePixelRatio;

    const width = this.ui.equalizerCanvas.width;
    const height = this.ui.equalizerCanvas.height;
    const sampleRate = this.audioContext.sampleRate;
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

    const sampleRate = this.audioContext.sampleRate;
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

  ratioToFrequency(ratio) {
    const sampleRate = this.audioContext.sampleRate;
    const maxFreq = sampleRate / 2;
    const frequencyWidth = maxFreq;
    const logFrequencyWidth = Math.log10(frequencyWidth / 20);
    return Utils.clamp(Math.pow(10, ratio * logFrequencyWidth + Math.log10(20)), 0, maxFreq);
  }

  setupAnalyzers() {
    if (!this.audioContext || this.preAnalyzer) return;
    const audioContext = this.audioContext;
    this.preAnalyzer = audioContext.createAnalyser();
    this.postAnalyzer = audioContext.createAnalyser();

    this.preAnalyzer.smoothingTimeConstant = 0.6;
    this.postAnalyzer.smoothingTimeConstant = 0.6;
    this.preAnalyzer.maxDecibels = -20;
    this.postAnalyzer.maxDecibels = -20;

    this.getInputNode().connect(this.preAnalyzer);
    this.getOutputNode().connect(this.postAnalyzer);
  }

  destroyAnalyzers() {
    if (!this.preAnalyzer) return;
    this.getInputNode().disconnect(this.preAnalyzer);
    this.getOutputNode().disconnect(this.postAnalyzer);
    this.preAnalyzer = null;
    this.postAnalyzer = null;
  }
}
