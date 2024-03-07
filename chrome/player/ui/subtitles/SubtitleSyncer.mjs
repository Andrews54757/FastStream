import {EventEmitter} from '../../modules/eventemitter.mjs';
import {WebVTT} from '../../modules/vtt.mjs';
import {DOMElements} from '../DOMElements.mjs';
import {WebUtils} from '../../utils/WebUtils.mjs';
import {StringUtils} from '../../utils/StringUtils.mjs';

export class SubtitleSyncer extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.trackToSync = null;
    this.isSeeking = false;
    this.analyzerHandle = this.onAnalyzerFrameProcessed.bind(this);
    this.setup();
  }

  shiftSubtitles(delta) {
    if (!this.started) return;
    this.trackToSync.shift(delta);
    this.client.interfaceController.subtitlesManager.renderSubtitles();
    this.onVideoTimeUpdate();
  }

  setup() {
    this.ui = {};
    this.ui.currentPosition = WebUtils.create('div', '', 'current_position_bar');
    DOMElements.timelineSyncer.appendChild(this.ui.currentPosition);

    this.ui.timelineContainer = WebUtils.create('div', '', 'timeline_container');
    DOMElements.timelineSyncer.appendChild(this.ui.timelineContainer);

    this.ui.timelineTicks = WebUtils.create('div', '', 'timeline_ticks');
    this.ui.timelineContainer.appendChild(this.ui.timelineTicks);

    this.ui.timelineVOD = WebUtils.create('div', '', 'timeline_vod');
    this.ui.timelineContainer.appendChild(this.ui.timelineVOD);

    this.ui.timelineTrack = WebUtils.create('div', '', 'timeline_track');
    this.ui.timelineContainer.appendChild(this.ui.timelineTrack);

    // timeline is grabbable
    let isGrabbing = false;
    let grabStart = 0;
    let grabStartTime = 0;
    let shouldPlay = false;

    this.ui.timelineTicks.addEventListener('mousedown', (e) => {
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
    });

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

    // track line is grabbable
    let isGrabbingTrack = false;
    let grabStartTrack = 0;

    this.ui.timelineTrack.addEventListener('mousedown', (e) => {
      isGrabbingTrack = true;
      grabStartTrack = e.clientX;
    });

    document.addEventListener('mouseup', () => {
      isGrabbingTrack = false;
    });

    document.addEventListener('mousemove', (e) => {
      if (isGrabbingTrack) {
        const delta = e.clientX - grabStartTrack;
        grabStartTrack = e.clientX;
        this.trackToSync.shift(delta / this.ui.timelineTicks.clientWidth * video.duration);
        this.client.interfaceController.subtitlesManager.renderSubtitles();
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

  toggleTrack(track, removeOnly = false) {
    if (this.trackToSync === track) {
      this.trackToSync = null;
      this.stop();
    } else if (!removeOnly) {
      this.trackToSync = track;
      this.start();
      this.renderSyncTimeline();
    }

    return this.trackToSync;
  }

  reset() {
    this.lastUpdate = 0;
    this.ticklineElements = [];
    this.canvasElements = [];
    this.trackElements = [];
    this.ui.timelineTicks.replaceChildren();
    this.ui.timelineVOD.replaceChildren();
    this.ui.timelineTrack.replaceChildren();

    this.vadLineColor = window.getComputedStyle(document.body).getPropertyValue('--timeline-vad-line-color');
  }

  async start() {
    const video = this.client.currentVideo;
    if (this.started || !video) return;
    this.started = true;
    this.reset();

    this.client.audioAnalyzer.on('vad', this.analyzerHandle);
    this.client.audioAnalyzer.on('volume', this.analyzerHandle);
    this.client.audioAnalyzer.addVadDependent(this);
    this.client.audioAnalyzer.addVolumeDependent(this);
    this.client.audioAnalyzer.addBackgroundDependent(this);
    this.client.audioAnalyzer.updateBackgroundAnalyzer();

    DOMElements.playerContainer.classList.add('expanded');
    this.client.interfaceController.runProgressLoop();
    this.renderSyncTimeline();
  }

  onVideoTimeUpdate() {
    if (!this.started) {
      return;
    }
    this.renderSyncTimeline();
  }

  renderSyncTimeline() {
    if (!this.started || !this.client.player) return;
    const time = this.client.persistent.currentTime;

    const video = this.client.player.getVideo();

    const timePerWidth = 60;
    const minTime = Math.floor(Math.max(0, time - timePerWidth / 2 - 5));
    const maxTime = Math.ceil(Math.min(video.duration, time + timePerWidth / 2 + 5));
    this.ui.timelineContainer.style.width = (video.duration / timePerWidth) * 100 + '%';


    let hasArr = new Array(maxTime - minTime).fill(false);

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
      el.style.left = tickTime / video.duration * 100 + '%';
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

    const minCanvIndex = Math.floor(minTime / 10);
    const maxCanvIndex = Math.ceil(maxTime / 10);
    hasArr = new Array(maxCanvIndex - minCanvIndex).fill(false);
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
      el.style.left = canvIndex * 10 / video.duration * 100 + '%';
      el.style.width = 10 / video.duration * 100 + '%';
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
      if (el.cachedWidth === newWidth || newWidth === 0) return;
      el.cachedWidth = newWidth;
      const index = el.index;
      const time = index * 10;

      const audioAnalyzer = this.client.audioAnalyzer;
      const outputRate = audioAnalyzer.getOutputRate();
      const vadBuffer = audioAnalyzer.getVadData();
      const volumeBuffer = audioAnalyzer.getVolumeData();
      const startFrame = Math.floor(time * outputRate);
      const endFrame = Math.floor(Math.min(time + 10, video.duration) * outputRate);

      const context = el.ctx;
      el.element.width = newWidth;
      context.clearRect(0, 0, el.element.width, el.element.height);

      const barWidth = el.element.width / outputRate / 10;
      // set fill opacity
      context.globalAlpha = 0.9;
      // Draw volume bars using buffer
      for (let i = startFrame; i < endFrame; i++) {
        const volumeVal = (volumeBuffer[i] || 0);
        // draw volume bar. vertical rectangle. with color blue -> red. Fillrect
        const color = `rgb(${volumeVal}, ${255 - volumeVal}, 255)`;
        context.fillStyle = color;
        context.fillRect((i - startFrame) / (10 * outputRate) * el.element.width, (0.5 - volumeVal / 255 / 2) * el.element.height, barWidth / 2, (volumeVal / 255) * el.element.height);
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

    this.ui.timelineContainer.style.transform = `translateX(${-(time - timePerWidth / 2) / video.duration * 100}%)`;

    const now = Date.now();
    if (now - this.lastUpdate >= 500) {
      this.lastUpdate = now;

      const cues = this.trackToSync.cues;
      this.visibleCues = cues.filter((cue) => {
        return cue.startTime <= maxTime || cue.endTime >= minTime;
      });
    }


    this.trackElements = this.trackElements.filter((el) => {
      if (!this.visibleCues.includes(el.cue)) {
        el.element.remove();
        return false;
      } else {
        el.element.style.left = el.cue.startTime / video.duration * 100 + '%';
      }
      return true;
    });

    this.visibleCues.forEach((cue) => {
      if (cue.text.length === 0) return;
      if (this.trackElements.find((el) => el.cue === cue)) return;

      const el = WebUtils.create('div', '', 'timeline_track_cue');
      el.style.left = cue.startTime / video.duration * 100 + '%';
      el.style.width = (cue.endTime - cue.startTime) / video.duration * 100 + '%';
      if (!cue.dom2) {
        cue.dom2 = WebVTT.convertCueToDOMTree(window, cue.text);
      }
      el.appendChild(cue.dom2);
      el.title = cue.text;
      this.ui.timelineTrack.appendChild(el);

      this.trackElements.push({
        cue,
        element: el,
      });
    });
  }

  async stop() {
    if (!this.started) return;
    this.started = false;

    this.client.audioAnalyzer.removeVadDependent(this);
    this.client.audioAnalyzer.removeVolumeDependent(this);
    this.client.audioAnalyzer.removeBackgroundDependent(this);
    this.client.audioAnalyzer.off('vad', this.analyzerHandle);
    this.client.audioAnalyzer.off('volume', this.analyzerHandle);

    this.client.interfaceController.durationChanged();
    DOMElements.playerContainer.classList.remove('expanded');
  }
}
