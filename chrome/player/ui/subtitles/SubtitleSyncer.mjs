import {EventEmitter} from '../../modules/eventemitter.mjs';
import {WebVTT} from '../../modules/vtt.mjs';
import {WebUtils} from '../../utils/WebUtils.mjs';

export class SubtitleSyncer extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.trackToSync = null;
    this.renderHandle = this.renderTracks.bind(this);
  }

  shiftSubtitles(delta) {
    if (!this.started) return;
    this.trackToSync.shift(delta);
    this.client.interfaceController.subtitlesManager.renderSubtitles();
    this.onVideoTimeUpdate();
  }

  setup() {
    this.ui = {};

    this.fineTimeControls = this.client.interfaceController.fineTimeControls;

    this.ui.timelineTrackContainer = this.client.interfaceController.fineTimeControls.ui.timelineTrackContainer;

    this.ui.timelineTrack = WebUtils.create('div', '', 'timeline_track');

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
      if (!this.client.player) return;
      const video = this.client.player.getVideo();
      if (isGrabbingTrack) {
        const delta = e.clientX - grabStartTrack;
        grabStartTrack = e.clientX;
        this.trackToSync.shift(delta / this.ui.timelineTrack.clientWidth * video.duration);
        this.client.interfaceController.subtitlesManager.renderSubtitles();
      }
    });
  }

  toggleTrack(track, removeOnly = false) {
    if (this.trackToSync === track) {
      this.trackToSync = null;
      this.stop();
    } else if (!removeOnly) {
      this.trackToSync = track;
      this.start();
    }

    return this.trackToSync;
  }

  async start() {
    const video = this.client.currentVideo;
    if (this.started || !video) return;
    this.started = true;

    if (!this.ui) {
      this.setup();
    }

    this.lastUpdate = 0;
    this.trackElements = [];
    this.ui.timelineTrack.replaceChildren();
    this.ui.timelineTrackContainer.appendChild(this.ui.timelineTrack);
    this.fineTimeControls.on('render', this.renderHandle);
    return this.fineTimeControls.start();
  }


  async stop() {
    if (!this.started) return;
    this.started = false;
    this.ui.timelineTrack.remove();
    this.fineTimeControls.off('render', this.renderHandle);
    this.fineTimeControls.stop();
  }

  renderTracks() {
    if (!this.started || !this.client.player) return;
    const time = this.client.persistent.currentTime;

    const video = this.client.player.getVideo();

    const timePerWidth = 60;
    const minTime = Math.floor(Math.max(0, time - timePerWidth / 2 - 5));
    const maxTime = Math.ceil(Math.min(video.duration, time + timePerWidth / 2 + 5));

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
}
