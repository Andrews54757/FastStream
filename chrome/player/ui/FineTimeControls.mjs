import {EventEmitter} from '../modules/eventemitter.mjs';
import {DOMElements} from './DOMElements.mjs';
import {WebUtils} from '../utils/WebUtils.mjs';
import {StringUtils} from '../utils/StringUtils.mjs';

export class FineTimeControls extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.isSeeking = false;
    this.analyzerHandle = this.onAnalyzerFrameProcessed.bind(this);
    this.resetHandle = this.reset.bind(this);

    this.renderFrames = false;

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
    this.currentFrameCtx = this.currentFrameCanvas.getContext('2d');

    this.ui.timelineVOD = WebUtils.create('div', '', 'timeline_vod');
    this.ui.timelineContainer.appendChild(this.ui.timelineVOD);

    this.ui.timelineTrackContainer = WebUtils.create('div', '', 'timeline_track_container');
    this.ui.timelineContainer.appendChild(this.ui.timelineTrackContainer);

    // timeline is grabbable
    let isGrabbing = false;
    let grabStart = 0;
    let grabStartTime = 0;
    let shouldPlay = false;

    const mouseDown = (e) => {
      if (!this.client.player) return;
      const video = this.client.player.getVideo();
      isGrabbing = true;
      grabStart = e.clientX;
      grabStartTime = video.currentTime;
      this.isSeeking = true;
      shouldPlay = this.client.persistent.playing;
      if (this.client.persistent.playing) {
        this.client.player.pause();
      }
    };
    this.ui.timelineTicks.addEventListener('mousedown', mouseDown);
    this.ui.timelineVOD.addEventListener('mousedown', mouseDown);
    this.ui.timelineImages.addEventListener('mousedown', mouseDown);

    document.addEventListener('mouseup', (e) => {
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
    });

    document.addEventListener('mousemove', (e) => {
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

  onAnalyzerFrameProcessed(time, isSpeechProb) {
    this.canvasElements.find((el) => {
      if (el.index * 10 <= time && (el.index + 1) * 10 > time) {
        el.cachedWidth = 0;
        return true;
      }
      return false;
    });
  }

  reset() {
    this.ticklineElements = [];
    this.canvasElements = [];
    this.frameElements = [];
    this.ui.timelineTicks.replaceChildren();
    this.ui.timelineVOD.replaceChildren();
    this.ui.timelineImages.replaceChildren();
    this.ui.timelineImages.appendChild(this.currentFrameCanvas);

    this.vadLineColor = window.getComputedStyle(document.body).getPropertyValue('--timeline-vad-line-color');
  }

  async start() {
    const video = this.client.currentVideo;
    if (this.started || !video) return;
    this.started = true;
    this.reset();

    const aspect = video.videoWidth / video.videoHeight;
    this.currentFrameCanvas.height = 128;
    this.currentFrameCanvas.width = this.currentFrameCanvas.height * aspect;

    this.client.audioAnalyzer.on('vad', this.analyzerHandle);
    this.client.audioAnalyzer.on('volume', this.analyzerHandle);
    this.client.audioAnalyzer.on('audioLevelChanged', this.resetHandle);
    this.client.audioAnalyzer.addVadDependent(this);
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

    this.client.audioAnalyzer.removeVadDependent(this);
    this.client.audioAnalyzer.removeVolumeDependent(this);
    this.client.audioAnalyzer.removeBackgroundDependent(this);
    this.client.audioAnalyzer.off('vad', this.analyzerHandle);
    this.client.audioAnalyzer.off('volume', this.analyzerHandle);
    this.client.audioAnalyzer.off('audioLevelChanged', this.resetHandle);

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

    const isCurrentFrameValid = video.readyState >= 2 && !this.client.interfaceController.isUserSeeking();


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

      const el = WebUtils.create('canvas', '', 'timeline_vod_canvas');
      el.style.left = canvIndex * 10 / duration * 100 + '%';
      el.style.width = 10 / duration * 100 + '%';
      el.height = 22 * window.devicePixelRatio;
      this.ui.timelineVOD.appendChild(el);

      this.canvasElements.push({
        index: canvIndex,
        element: el,
        ctx: el.getContext('2d'),
        cachedWidth: 0,
      });
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

      const audioAnalyzer = this.client.audioAnalyzer;
      const outputRate = audioAnalyzer.getOutputRate();
      const vadBuffer = audioAnalyzer.getVadData();
      const volumeBuffer = audioAnalyzer.getVolumeData();
      const startFrame = Math.floor(time * outputRate);
      const endFrame = Math.floor(Math.min(time + 10, duration) * outputRate);

      const context = el.ctx;
      el.element.width = newWidth;
      context.clearRect(0, 0, el.element.width, el.element.height);

      const barWidth = Math.ceil(el.element.width / outputRate / 10);
      // set fill opacity
      context.globalAlpha = 0.9;
      // Draw volume bars using buffer
      for (let i = startFrame; i < endFrame; i++) {
        const volumeVal = (volumeBuffer[i] || 0);
        // draw volume bar. vertical rectangle. with color blue -> red. Fillrect
        const color = `rgb(${volumeVal}, ${255 - volumeVal}, 255)`;
        context.fillStyle = color;
        context.fillRect((i - startFrame) / (10 * outputRate) * el.element.width, Math.floor((0.5 - volumeVal / 255 / 2) * el.element.height), Math.floor(barWidth / 2), Math.ceil((volumeVal / 255) * el.element.height));
      }
      context.globalAlpha = 1;

      // Draw VAD line using buffer
      context.beginPath();
      context.strokeStyle = this.vadLineColor;
      let vadVal = (startFrame > 0) ? (vadBuffer[startFrame - 1] || 0) : 0;
      context.moveTo(0, (1 - vadVal / 255) * el.element.height);
      for (let i = startFrame; i < endFrame; i++) {
        vadVal = (vadBuffer[i] || 0);
        context.lineTo((i - startFrame + 1) / (10 * outputRate) * el.element.width, (1 - vadVal / 255) * el.element.height);
      }
      context.stroke();
    });
  }

  renderTimeline() {
    if (!this.started || !this.client.player) return;
    const time = this.client.persistent.currentTime;

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
}
