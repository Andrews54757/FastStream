import {EventEmitter} from '../modules/eventemitter.mjs';
import {DOMElements} from './DOMElements.mjs';
import {WebUtils} from '../utils/WebUtils.mjs';
import {StringUtils} from '../utils/StringUtils.mjs';
import {Utils} from '../utils/Utils.mjs';

export class FineTimeControls extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.isSeeking = false;
    this.analyzerHandle = this.onAnalyzerFrameProcessed.bind(this);
    this.resetAudioHandle = this.resetAudio.bind(this);

    this.renderFrames = false;
    this.renderVAD = false;
    this.renderVolume = true;
    this.audioSilenceThreshold = null;
    this.audioSilencePaddingStart = 0;
    this.audioSilencePaddingEnd = 0;

    this.stateStack = [];

    this.setup();
  }

  pushState(onOpen, onClose, settings = {}) {
    if (this.activeCloseFn) {
      this.activeCloseFn();
      this.activeCloseFn = null;
      clearTimeout(this.closeTimeout);
    }

    if (this.stateStack.length > 0) {
      this.stateStack[this.stateStack.length - 1].onClose();
    }
    this.stateStack.push({
      onOpen,
      onClose,
      settings,
    });
    onOpen();
    this.start();
  }

  removeState(onOpen) {
    const index = this.stateStack.findIndex((state) => state.onOpen === onOpen);
    if (index === -1) {
      return false;
    }

    if (index === this.stateStack.length - 1) {
      if (this.activeCloseFn) {
        this.activeCloseFn();
        this.activeCloseFn = null;
        clearTimeout(this.closeTimeout);
      }

      const closeFn = this.stateStack[index].onClose;
      if (this.stateStack.length > 1) {
        closeFn();
      } else {
        this.activeCloseFn = closeFn;
        this.closeTimeout = setTimeout(()=>{
          if (closeFn === this.activeCloseFn) {
            closeFn();
            this.activeCloseFn = null;
          }
        }, 1000);
      }
      this.stateStack.pop();
      if (this.stateStack.length > 0) {
        this.stateStack[this.stateStack.length - 1].onOpen();
      } else {
        this.stop();
      }
    } else {
      this.stateStack.splice(index, 1);
    }
    return true;
  }

  removeAll() {
    if (this.stateStack.length === 0) {
      return;
    }
    this.stateStack = [this.stateStack.pop()];
    this.removeState(this.stateStack[0].onOpen);
  }

  prioritizeState(onOpen) {
    const index = this.stateStack.findIndex((state) => state.onOpen === onOpen);
    if (index === -1) {
      return false;
    }

    if (index === this.stateStack.length - 1) {
      return true;
    }

    const state = this.stateStack.splice(index, 1)[0];
    this.pushState(state.onOpen, state.onClose, state.settings);
    return true;
  }

  isStateActive(onOpen) {
    if (this.stateStack.length === 0) {
      return false;
    }
    return this.stateStack[this.stateStack.length - 1].onOpen === onOpen;
  }

  setup() {
    this.ui = {};
    this.ui.currentPosition = WebUtils.create('div', '', 'current_position_bar');
    DOMElements.timelineSyncer.appendChild(this.ui.currentPosition);

    this.ui.timelineContainer = WebUtils.create('div', '', 'timeline_container');
    DOMElements.timelineSyncer.appendChild(this.ui.timelineContainer);

    this.ui.timelineTicks = WebUtils.create('div', '', 'timeline_ticks');
    this.ui.timelineContainer.appendChild(this.ui.timelineTicks);

    this.ui.timelineImages = WebUtils.create('div', '', 'timeline_images');
    this.ui.timelineContainer.appendChild(this.ui.timelineImages);
    this.ui.timelineImages.style.display = 'none';

    this.currentFrameCanvas = document.createElement('canvas');
    this.currentFrameCanvas.classList.add('timeline_frame');
    this.currentFrameCanvas.height = 64;
    this.currentFrameCtx = this.currentFrameCanvas.getContext('2d');

    this.ui.timelineAudio = WebUtils.create('div', '', 'timeline_audio');
    this.ui.timelineContainer.appendChild(this.ui.timelineAudio);

    this.ui.timelineAudioCanvasContainer = WebUtils.create('div', '', 'timeline_audio_canvas_container');
    this.ui.timelineAudio.appendChild(this.ui.timelineAudioCanvasContainer);

    this.ui.timelineTrackContainer = WebUtils.create('div', '', 'timeline_track_container');
    this.ui.timelineContainer.appendChild(this.ui.timelineTrackContainer);

    // timeline is grabbable
    let isGrabbing = false;
    let grabStart = 0;
    let grabStartTime = 0;
    let shouldPlay = false;

    const mouseDown = (e) => {
      // check if left mouse button is pressed
      if (e.button !== 0) return;
      if (!this.client.player) return;
      const video = this.client.player.getVideo();
      isGrabbing = true;
      grabStart = e.clientX;
      grabStartTime = video.currentTime;
      this.isSeeking = true;
      shouldPlay = this.client.state.playing;
      if (this.client.state.playing) {
        this.client.player.pause();
      }
    };
    this.ui.timelineTicks.addEventListener('mousedown', mouseDown);
    // this.ui.timelineAudioCanvasContainer.addEventListener('mousedown', mouseDown);
    // this.ui.timelineImages.addEventListener('mousedown', mouseDown);

    DOMElements.playerContainer.addEventListener('mouseup', (e) => {
      if (!this.client.player) return;
      const video = this.client.player.getVideo();
      if (isGrabbing) {
        const delta = e.clientX - grabStart;
        const time = grabStartTime - (delta / this.ui.timelineTicks.clientWidth * video.duration);
        this.client.currentTime = time;
        this.client.updateTime(time);
        this.isSeeking = false;

        if (shouldPlay) {
          this.client.player.play();
        }
      }
      isGrabbing = false;
    }, true);

    DOMElements.playerContainer.addEventListener('mousemove', (e) => {
      if (!this.client.player) return;
      const video = this.client.player.getVideo();
      if (isGrabbing) {
        const delta = e.clientX - grabStart;
        const time = grabStartTime - (delta / this.ui.timelineTicks.clientWidth * video.duration);
        this.client.currentTime = time;
        this.client.updateTime(time);
      }
    });
  }

  onAnalyzerFrameProcessed(time, isSpeechProb, interpolated = 0) {
    const frame = Math.floor(time / 10);
    const shouldDoPreviousFrame = interpolated > 0 && (time - frame * 10) < 2;
    let done = 0;
    this.canvasElements.some((el) => {
      if (el.index === frame || (shouldDoPreviousFrame && el.index === frame - 1)) {
        el.cachedWidth = 0;
        done++;
        return done === (shouldDoPreviousFrame ? 2 : 1);
      }
      return false;
    });
  }

  reset() {
    this.ticklineElements = [];
    this.frameElements = [];
    this.ui.timelineTicks.replaceChildren();
    this.resetAudio();
    this.ui.timelineImages.replaceChildren();
    this.ui.timelineImages.appendChild(this.currentFrameCanvas);
    this.vadLineColor = window.getComputedStyle(document.body).getPropertyValue('--timeline-vad-line-color');
  }

  resetAudio() {
    this.canvasElements = [];
    this.ui.timelineAudioCanvasContainer.replaceChildren();
  }

  async start() {
    const video = this.client.currentVideo;
    if (this.started || !video) return;
    this.started = true;
    this.reset();

    this.client.audioAnalyzer.on('vad', this.analyzerHandle);
    this.client.audioAnalyzer.on('volume', this.analyzerHandle);
    this.client.audioAnalyzer.on('audioLevelChanged', this.resetAudioHandle);
    this.client.audioAnalyzer.addVolumeDependent(this);
    this.client.audioAnalyzer.addBackgroundDependent(this);
    this.client.audioAnalyzer.updateBackgroundAnalyzer();

    DOMElements.playerContainer.classList.add('expanded');
    this.client.interfaceController.runProgressLoop();
    this.renderTimeline();
  }

  async stop() {
    if (!this.started) return;
    this.started = false;

    this.client.audioAnalyzer.removeVolumeDependent(this);
    this.client.audioAnalyzer.removeBackgroundDependent(this);
    this.client.audioAnalyzer.off('vad', this.analyzerHandle);
    this.client.audioAnalyzer.off('volume', this.analyzerHandle);
    this.client.audioAnalyzer.off('audioLevelChanged', this.resetAudioHandle);

    this.client.interfaceController.durationChanged();
    DOMElements.playerContainer.classList.remove('expanded');
  }

  onVideoTimeUpdate() {
    if (!this.started) {
      return;
    }
    this.renderTimeline();
  }

  renderTicks(duration, maxTime, minTime) {
    const hasArr = new Array(maxTime - minTime).fill(false);

    this.ticklineElements = this.ticklineElements.filter((el) => {
      if (el.time < minTime || el.time > maxTime) {
        el.element.remove();
        return false;
      }

      hasArr[el.time - minTime] = true;
      return true;
    });

    for (let tickTime = minTime; tickTime < maxTime; tickTime++) {
      if (hasArr[tickTime - minTime]) continue;

      const el = WebUtils.create('div', '', 'timeline_tick');
      el.style.left = tickTime / duration * 100 + '%';
      this.ui.timelineTicks.appendChild(el);
      this.ticklineElements.push({
        time: tickTime,
        element: el,
      });


      if (tickTime % 10 === 0) {
        const label = WebUtils.create('div', '', 'timeline_tick_label');
        label.textContent = StringUtils.formatTime(tickTime);
        el.appendChild(label);

        if (tickTime % (60 * 60) === 0) {
          el.classList.add('hour');
        } else if (tickTime % 60 === 0) {
          el.classList.add('minute');
        } else {
          el.classList.add('major');
        }
      } else if (tickTime % 5 === 0) {
        el.classList.add('major');
      }
    }
  }

  renderVideoFrames(duration, minTime, maxTime) {
    const frameExtractor = this.client.frameExtractor;
    const frameBuffer = frameExtractor.getFrameBuffer();
    const outputRateInv = frameExtractor.getOutputRateInv();

    const minFrameIndex = Math.floor(minTime / outputRateInv);
    const maxFrameIndex = Math.ceil(maxTime / outputRateInv);

    const currentTime = this.client.currentTime;
    const currentFrame = Math.floor(currentTime / outputRateInv);
    const video = this.client.player.getVideo();

    const isCurrentFrameValid = video.readyState >= 2 && !this.client.interfaceController.isUserSeeking() && frameBuffer[currentFrame];


    const hasArr = new Array(maxFrameIndex - minFrameIndex).fill(false);
    this.frameElements = this.frameElements.filter((el) => {
      if (el.index < minFrameIndex || el.index > maxFrameIndex) {
        el.element.remove();
        return false;
      }
      hasArr[el.index - minFrameIndex] = true;
      return true;
    });

    for (let frameIndex = minFrameIndex; frameIndex < maxFrameIndex; frameIndex++) {
      if (hasArr[frameIndex - minFrameIndex]) continue;

      const el = WebUtils.create('img', '', 'timeline_frame');
      el.style.left = frameIndex * outputRateInv / duration * 100 + '%';
      el.style.width = outputRateInv / duration * 100 + '%';
      el.style.display = 'none';
      el.draggable = false;
      this.ui.timelineImages.appendChild(el);

      this.frameElements.push({
        index: frameIndex,
        element: el,
        cachedSrc: null,
      });
    }

    this.frameElements.forEach((el) => {
      const index = el.index;


      let src = index;
      if (index < currentFrame) {
        src++;
      } else if (index === currentFrame && isCurrentFrameValid) {
        src = -1;
      }


      if (el.cachedSrc === src) return;

      if (src === -1) {
        el.cachedSrc = src;
        el.element.style.display = 'none';
        return;
      }

      if (frameBuffer[src]) {
        el.element.src = frameBuffer[src].url;
        el.cachedSrc = src;
        el.element.style.display = '';
      } else {
        el.element.style.display = 'none';
      }
    });


    if (isCurrentFrameValid) {
      if (currentFrame === this.lastFrameRenderIndex && Math.abs(this.lastFrameRenderTime - currentTime) < 0.0435) { // 1/23
        return;
      }
      this.lastFrameRenderIndex = currentFrame;
      this.lastFrameRenderTime = currentTime;
      const aspect = video.videoWidth / video.videoHeight;
      const newWidth = Math.round(this.currentFrameCanvas.height * aspect);
      if (this.currentFrameCanvas.width !== newWidth) {
        this.currentFrameCanvas.width = newWidth;
      }

      this.currentFrameCtx.drawImage(video, 0, 0, this.currentFrameCanvas.width, this.currentFrameCanvas.height);
      this.currentFrameCanvas.style.left = currentFrame * outputRateInv / duration * 100 + '%';
      this.currentFrameCanvas.style.width = outputRateInv / duration * 100 + '%';
      this.currentFrameCanvas.style.display = '';
    } else {
      this.currentFrameCanvas.style.display = 'none';
    }
  }

  renderAudio(duration, minTime, maxTime) {
    const minCanvIndex = Math.floor(minTime / 10);
    const maxCanvIndex = Math.ceil(maxTime / 10);
    const hasArr = new Array(maxCanvIndex - minCanvIndex).fill(false);
    this.canvasElements = this.canvasElements.filter((el) => {
      if (el.index < minCanvIndex || el.index > maxCanvIndex) {
        el.element.remove();
        return false;
      }
      hasArr[el.index - minCanvIndex] = true;
      return true;
    });

    for (let canvIndex = minCanvIndex; canvIndex < maxCanvIndex; canvIndex++) {
      if (hasArr[canvIndex - minCanvIndex]) continue;

      const el = WebUtils.create('canvas', '', 'timeline_audio_canvas');
      el.style.left = canvIndex * 10 / duration * 100 + '%';
      el.style.width = 10 / duration * 100 + '%';
      el.height = 22 * window.devicePixelRatio;
      this.ui.timelineAudioCanvasContainer.appendChild(el);

      this.canvasElements.push({
        index: canvIndex,
        element: el,
        ctx: el.getContext('2d'),
        cachedWidth: 0,
      });
    }

    const audioAnalyzer = this.client.audioAnalyzer;
    const outputRate = audioAnalyzer.getOutputRate();
    const vadBuffer = audioAnalyzer.getVadData();
    const volumeBuffer = audioAnalyzer.getVolumeData();
    const startFrame = Math.floor(minCanvIndex * 10 * outputRate);
    const endFrame = Math.floor(maxCanvIndex * 10 * outputRate);

    const minDB = -100;
    const maxDB = -30;
    const dbRange = maxDB - minDB;

    let silencedBitset;
    if (this.audioSilenceThreshold !== null) {
      silencedBitset = new Array(endFrame - startFrame).fill(true);
      const paddingStart = Math.ceil(this.audioSilencePaddingStart * outputRate);
      const paddingEnd = Math.ceil(this.audioSilencePaddingEnd * outputRate);
      let cooldown = 0;
      for (let i = startFrame; i < endFrame; i++) {
        const volume = volumeBuffer[i];

        if (volume === undefined || Utils.clamp((volume - minDB) / dbRange, 0, 1) >= this.audioSilenceThreshold) {
          silencedBitset[i - startFrame] = false;
          if (cooldown === 0) {
            for (let j = Math.max(0, i - paddingStart); j < i; j++) {
              silencedBitset[j - startFrame] = false;
            }
          }
          cooldown = paddingEnd;
        } else if (cooldown > 0) {
          silencedBitset[i - startFrame] = false;
          cooldown--;
        }
      }
    }

    this.canvasElements.forEach((el) => {
      const newWidth = el.element.clientWidth * window.devicePixelRatio;
      const newHeight = el.element.clientHeight * window.devicePixelRatio;
      if (newWidth === 0) return;
      if (el.cachedWidth === newWidth && el.cachedHeight === newHeight) return;
      el.cachedWidth = newWidth;
      el.cachedHeight = newHeight;
      const index = el.index;
      const time = index * 10;
      const startFrame2 = Math.floor(time * outputRate);
      const endFrame2 = Math.floor(Math.min(time + 10, duration) * outputRate);

      const context = el.ctx;
      el.element.width = newWidth;
      context.clearRect(0, 0, el.element.width, el.element.height);

      if (this.audioSilenceThreshold !== null) {
        for (let i = startFrame2; i < endFrame2;) {
          const startVal = silencedBitset[i - startFrame];
          let end = i;
          while (end < endFrame2 - 1 && startVal === silencedBitset[end - startFrame + 1]) {
            end++;
          }
          if (startVal) {
            context.fillStyle = 'rgba(255, 0, 0, 0.25)';
          } else {
            context.fillStyle = 'rgba(0, 200, 0, 0.25)';
          }
          context.fillRect((i - startFrame2) / (10 * outputRate) * el.element.width, 0, (end - i + 1) / (10 * outputRate) * el.element.width, el.element.height);
          i = end + 1;
        }
      }

      if (this.renderVolume) {
        const barWidth = Math.ceil(el.element.width / outputRate / 10);
        // Draw volume bars using buffer
        for (let i = startFrame2; i < endFrame2; i++) {
          const volumeVal = volumeBuffer[i] === undefined ? 0 : Utils.clamp((volumeBuffer[i] - minDB) / dbRange, 0, 1);
          // draw volume bar. vertical rectangle. with color blue -> red. Fillrect
          let color = `rgb(${volumeVal * 255}, ${255 - volumeVal * 255}, 255)`;
          if (this.audioSilenceThreshold !== null && volumeVal <= this.audioSilenceThreshold) {
            // white grey
            color = 'rgb(200, 200, 200)';
          }
          context.fillStyle = color;
          context.fillRect((i - startFrame2) / (10 * outputRate) * el.element.width, Math.floor((0.5 - volumeVal / 2) * el.element.height), Math.floor(barWidth / 2), Math.ceil(volumeVal * el.element.height));
        }
      }

      if (this.renderVAD) {
      // Draw VAD line using buffer
        context.beginPath();
        context.strokeStyle = this.vadLineColor;
        let vadVal = (startFrame2 > 0) ? (vadBuffer[startFrame2 - 1] || 0) : 0;
        context.moveTo(0, (1 - vadVal / 255) * el.element.height);
        for (let i = startFrame2; i < endFrame2; i++) {
          vadVal = (vadBuffer[i] || 0);
          context.lineTo((i - startFrame2 + 1) / (10 * outputRate) * el.element.width, (1 - vadVal / 255) * el.element.height);
        }
        context.stroke();
      }
    });
  }

  renderTimeline() {
    if (!this.started || !this.client.interfaceController.controlsVisible || !this.client.player) return;

    const time = this.client.state.currentTime;

    const video = this.client.player.getVideo();
    const duration = video.duration;

    const timePerWidth = 60;
    const minTime = Math.floor(Math.max(0, time - timePerWidth / 2 - 5));
    const maxTime = Math.ceil(Math.min(video.duration, time + timePerWidth / 2 + 5));
    this.ui.timelineContainer.style.width = (video.duration / timePerWidth) * 100 + '%';

    this.renderTicks(duration, maxTime, minTime);
    this.renderAudio(duration, minTime, maxTime);

    if (this.renderFrames) {
      this.renderVideoFrames(duration, minTime, maxTime);
    }

    this.ui.timelineContainer.style.transform = `translateX(${-(time - timePerWidth / 2) / duration * 100}%)`;

    this.emit('render', minTime, maxTime);
  }

  shouldRenderFrames(value) {
    if (this.renderFrames === value) return;
    this.renderFrames = value;

    if (value) {
      this.client.frameExtractor.addBackgroundDependent(this);
      this.ui.timelineImages.style.display = '';
    } else {
      this.client.frameExtractor.removeBackgroundDependent(this);
      this.ui.timelineImages.style.display = 'none';
    }
  }

  shouldRenderVolume(value) {
    if (this.renderVolume === value) return;
    this.renderVolume = value;
    this.resetAudio();
  }

  shouldRenderVAD(value) {
    if (this.renderVAD === value) return;
    this.renderVAD = value;
    if (value) {
      this.client.audioAnalyzer.addVadDependent(this);
    } else {
      this.client.audioAnalyzer.removeVadDependent(this);
    }
    this.resetAudio();
  }

  setAudioSilenceThreshold(threshold, paddingStart, paddingEnd) {
    this.audioSilenceThreshold = threshold;
    this.audioSilencePaddingStart = paddingStart || 0;
    this.audioSilencePaddingEnd = paddingEnd || 0;
    this.resetAudio();
  }
}
