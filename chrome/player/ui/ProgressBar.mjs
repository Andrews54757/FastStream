import {DownloadStatus} from '../enums/DownloadStatus.mjs';
import {Localize} from '../modules/Localize.mjs';
import {EventEmitter} from '../modules/eventemitter.mjs';
import {StringUtils} from '../utils/StringUtils.mjs';
import {Utils} from '../utils/Utils.mjs';
import {WebUtils} from '../utils/WebUtils.mjs';
import {DOMElements} from './DOMElements.mjs';

export class ProgressBar extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.progressCache = [];
    this.progressCacheAudio = [];
    this.skipSegments = [];
    this.skipSegmentsCache = [];
    this.chapterCache = [];
    this.hasShownSkip = false;
    this.isSeeking = false;
    this.isMouseOverProgressbar = false;

    this.preciseMode = false;
    this.keepPreciseModeOpen = false;
    this.onPreciseModeStartHandle = this.onPreciseModeStart.bind(this);
    this.onPreciseModeEndHandle = this.onPreciseModeEnd.bind(this);
  }

  onPreciseModeStart() {
    const fineTimeControls = this.client.interfaceController.fineTimeControls;

    fineTimeControls.ui.timelineAudio.style.height = '22px';
    fineTimeControls.ui.timelineAudio.style.top = '52px';
    fineTimeControls.shouldRenderFrames(true);
  }

  onPreciseModeEnd() {
    const fineTimeControls = this.client.interfaceController.fineTimeControls;

    fineTimeControls.ui.timelineAudio.style.height = '';
    fineTimeControls.ui.timelineAudio.style.top = '';
    fineTimeControls.shouldRenderFrames(false);
  }

  startPreciseMode(keepOpen = false) {
    if (!this.client.player) {
      return;
    }

    const fineTimeControls = this.client.interfaceController.fineTimeControls;
    if (this.preciseMode) {
      fineTimeControls.prioritizeState(this.onPreciseModeStartHandle);
      return;
    }

    if (keepOpen) {
      this.keepPreciseModeOpen = true;
    }
    this.preciseMode = true;
    fineTimeControls.pushState(this.onPreciseModeStartHandle, this.onPreciseModeEndHandle);
  }

  endPreciseMode() {
    if (!this.preciseMode) {
      return;
    }
    this.preciseMode = false;
    this.keepPreciseModeOpen = false;
    const fineTimeControls = this.client.interfaceController.fineTimeControls;
    fineTimeControls.removeState(this.onPreciseModeStartHandle);
  }

  setupUI() {
    this.seekMarker = document.createElement('div');
    this.seekMarker.classList.add('seek_marker');
    DOMElements.markerContainer.appendChild(this.seekMarker);
    this.seekMarker.style.display = 'none';

    this.unseekMarker = document.createElement('div');
    this.unseekMarker.classList.add('seek_marker');
    this.unseekMarker.classList.add('unseek_marker');
    DOMElements.markerContainer.appendChild(this.unseekMarker);
    this.unseekMarker.style.display = 'none';

    this.videoAnalyzerMarker = document.createElement('div');
    this.videoAnalyzerMarker.classList.add('analyzer_marker');
    DOMElements.markerContainer.appendChild(this.videoAnalyzerMarker);
    this.videoAnalyzerMarker.style.display = 'none';

    this.audioAnalyzerMarker = document.createElement('div');
    this.audioAnalyzerMarker.classList.add('analyzer_marker');
    this.audioAnalyzerMarker.style.backgroundColor = '#ff0';
    DOMElements.markerContainer.appendChild(this.audioAnalyzerMarker);
    this.audioAnalyzerMarker.style.display = 'none';

    this.frameExtractorMarker = document.createElement('div');
    this.frameExtractorMarker.classList.add('analyzer_marker');
    this.frameExtractorMarker.style.backgroundColor = '#f00';
    DOMElements.markerContainer.appendChild(this.frameExtractorMarker);
    this.frameExtractorMarker.style.display = 'none';

    DOMElements.progressContainer.addEventListener('mousedown', this.onProgressbarMouseDown.bind(this));
    DOMElements.progressContainer.addEventListener('mouseenter', this.onProgressbarMouseEnter.bind(this));
    DOMElements.progressContainer.addEventListener('mouseleave', this.onProgressbarMouseLeave.bind(this));
    DOMElements.progressContainer.addEventListener('mousemove', this.onProgressbarMouseMove.bind(this));

    DOMElements.nextVideoBannerButton.addEventListener('click', (e) => {
      this.client.nextVideo();
      e.preventDefault();
      e.stopPropagation();
    });
    WebUtils.setupTabIndex(DOMElements.nextVideoBannerButton);
  }

  reset() {
    DOMElements.progressLoadedContainer.replaceChildren();
    this.progressCache = [];
    this.progressCacheAudio = [];
    this.skipSegments = [];
    this.hasShownSkip = false;
  }

  collectProgressbarData(fragments) {
    let i = 0;
    let total = 0;
    let loaded = 0;
    let failed = 0;
    let currentTime = -1;
    const results = [];
    while (i < fragments.length) {
      const frag = fragments[i];
      if (!frag) {
        i++;
        continue;
      }
      total++;
      if (currentTime === -1) {
        currentTime = frag.start ? Math.max(frag.start, 0) : 0;
      }

      const start = currentTime;

      let end = currentTime + frag.duration;
      currentTime = end;

      if (frag.status === DownloadStatus.WAITING) {
        i++;
        continue;
      }

      const entry = {
        start: start,
        end: 0,
        width: 0,
        statusClass: 'download-uninitiated',
      };
      results.push(entry);

      if (frag.status === DownloadStatus.DOWNLOAD_INITIATED) {
        entry.statusClass = 'download-initiated';
      } else if (frag.status === DownloadStatus.DOWNLOAD_COMPLETE) {
        loaded++;
        entry.statusClass = 'download-complete';
      } else if (frag.status === DownloadStatus.DOWNLOAD_FAILED) {
        failed++;
        entry.statusClass = 'download-failed';
      }

      i++;

      while (i < fragments.length && fragments[i].status === frag.status) {
        end = currentTime + fragments[i].duration;
        currentTime = end;
        i++;

        total++;
        if (frag.status === DownloadStatus.DOWNLOAD_COMPLETE) {
          loaded++;
        } else if (frag.status === DownloadStatus.DOWNLOAD_FAILED) {
          failed++;
        }
      }

      entry.end = end;
      entry.width = end - start;
    }
    return {
      results, total, loaded, failed,
    };
  }


  updateProgressBar(duration, cache, results, additionalClass) {
    for (let i = cache.length; i < results.length; i++) {
      const entry = {
        start: -1,
        width: -1,
        className: '',
        element: document.createElement('div'),
      };
      DOMElements.progressLoadedContainer.appendChild(entry.element);
      cache.push(entry);
    }

    for (let i = results.length; i < cache.length; i++) {
      cache[i].element.remove();
    }

    cache.length = results.length;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const entry = cache[i];
      if (entry.start !== result.start) {
        entry.start = result.start;
        entry.element.style.left = Math.min(result.start / duration * 100, 100) + '%';
      }

      if (entry.width !== result.width) {
        entry.width = result.width;
        entry.element.style.width = Math.min(result.width / duration * 100, 100) + '%';
      }

      const className = ([result.statusClass, additionalClass]).join(' ');
      if (entry.className !== className) {
        entry.className = className;
        entry.element.className = className;
      }
    }
  }

  renderProgressBar(duration, cache, fragments, additionalClass = null) {
    const {results, total, loaded, failed} = this.collectProgressbarData(fragments);

    this.updateProgressBar(duration, cache, results, additionalClass);

    return {
      total,
      loaded,
      failed,
    };
  }

  updateFragmentsLoaded() {
    if (!this.client.player) {
      this.renderProgressBar(0, this.progressCache, []);
      this.renderProgressBar(0, this.progressCacheAudio, []);
      return;
    }

    const player = this.client.player;
    const duration = player.duration;

    const currentVideoLevelID = player.getCurrentVideoLevelID();
    const currentAudioLevelID = player.getCurrentAudioLevelID();

    const fragments = this.client.getFragments(currentVideoLevelID);
    const audioFragments = this.client.getFragments(currentAudioLevelID);

    let total = 0;
    let loaded = 0;
    let failed = 0;

    if (fragments) {
      const result = this.renderProgressBar(duration, this.progressCache, fragments, audioFragments ? 'download-video' : null);
      total += result.total;
      loaded += result.loaded;
      failed += result.failed;
    }

    if (audioFragments) {
      const result = this.renderProgressBar(duration, this.progressCacheAudio, audioFragments, fragments ? 'download-audio' : null);
      total += result.total;
      loaded += result.loaded;
      failed += result.failed;
    }

    this.loaded = loaded;
    this.failed = failed;
    this.total = total;
  }

  getFragmentCounts() {
    return {
      loaded: this.loaded,
      failed: this.failed,
      total: this.total,
    };
  }

  updateSkipSegments() {
    // DOMElements.skipSegmentsContainer.replaceChildren();

    const introMatch = this.client.videoAnalyzer.getIntro();
    const outroMatch = this.client.videoAnalyzer.getOutro();

    const duration = this.client.duration;
    if (!duration) {
      return;
    }

    const skipSegments = [];

    if (introMatch) {
      skipSegments.push({
        startTime: Utils.clamp(introMatch.startTime, 0, duration),
        endTime: Utils.clamp(introMatch.endTime, 0, duration),
        class: 'intro',
        name: 'Intro',
        skipText: Localize.getMessage('player_skipintro'),
      });
    }

    if (outroMatch) {
      skipSegments.push({
        startTime: Utils.clamp(outroMatch.startTime, 0, duration),
        endTime: Utils.clamp(outroMatch.endTime, 0, duration),
        class: 'outro',
        name: 'Outro',
        skipText: Localize.getMessage('player_skipoutro'),
      });
    }

    this.client.skipSegments.forEach((segment) => {
      skipSegments.push({
        ...segment,
        startTime: Utils.clamp(segment.startTime, 0, duration),
        endTime: Utils.clamp(segment.endTime, 0, duration),
      });
    });

    let currentSegment = null;
    const time = this.client.currentTime;

    if (this.skipSegmentsCache.length > skipSegments.length) {
      // Remove elements
      for (let i = skipSegments.length; i < this.skipSegmentsCache.length; i++) {
        this.skipSegmentsCache[i].remove();
      }
      this.skipSegmentsCache.length = skipSegments.length;
    } else if (this.skipSegmentsCache.length < skipSegments.length) {
      // Add elements
      for (let i = this.skipSegmentsCache.length; i < skipSegments.length; i++) {
        const segmentElement = document.createElement('div');
        DOMElements.skipSegmentsContainer.appendChild(segmentElement);
        this.skipSegmentsCache.push(segmentElement);
      }
    }


    skipSegments.forEach((segment, i) => {
      const segmentElement = this.skipSegmentsCache[i];
      segmentElement.className = 'skip_segment ' + segment.class;
      segmentElement.style.left = segment.startTime / duration * 100 + '%';
      segmentElement.style.width = (segment.endTime - segment.startTime) / duration * 100 + '%';

      if (segment.color) {
        segmentElement.style.backgroundColor = segment.color;
      }

      if (!currentSegment && time >= segment.startTime && time < segment.endTime) {
        currentSegment = segment;
        segmentElement.classList.add('active');
      }
    });

    this.skipSegments = skipSegments;

    if (currentSegment) {
      DOMElements.skipButton.style.display = '';
      DOMElements.skipButton.textContent = currentSegment.skipText;
      DOMElements.skipButton.ariaLabel = currentSegment.skipText;
      DOMElements.progressContainer.classList.add('skip_freeze');
    } else {
      DOMElements.progressContainer.classList.remove('skip_freeze');
      DOMElements.skipButton.style.display = 'none';
    }

    if (this.client.options.autoplayNext && this.client.hasNextVideo() && (currentSegment?.class === 'outro' || Math.ceil(duration - time) <= 10)) { // Outro
      DOMElements.nextVideoBannerButton.style.display = '';
      DOMElements.nextVideoBannerButton.textContent = Localize.getMessage('player_nextvideoin', [Math.ceil(duration - time)]);
      DOMElements.skipButton.classList.add('shiftup');
    } else {
      DOMElements.nextVideoBannerButton.style.display = 'none';
      DOMElements.skipButton.classList.remove('shiftup');
    }

    if (DOMElements.skipButton.style.display !== 'none' || DOMElements.nextVideoBannerButton.style.display !== 'none') {
      if (!this.hasShownSkip) {
        this.hasShownSkip = true;

        if (currentSegment && currentSegment.autoSkip) {
          this.skipSegment();
        } else {
          this.emit('show-skip', currentSegment);
        }
      }
    } else {
      this.hasShownSkip = false;
    }

    const chapters = [];
    this.client.chapters.forEach((chapter) => {
      if (chapter.startTime > 0) {
        chapters.push({
          ...chapter,
          startTime: Utils.clamp(chapter.startTime, 0, duration),
          endTime: Utils.clamp(chapter.endTime, 0, duration),
        });
      }
    });

    if (this.chapterCache.length > chapters.length) {
      // Remove elements
      for (let i = chapters.length; i < this.chapterCache.length; i++) {
        this.chapterCache[i].remove();
      }
      this.chapterCache.length = chapters.length;
    } else if (this.chapterCache.length < chapters.length) {
      // Add elements
      for (let i = this.chapterCache.length; i < chapters.length; i++) {
        const chapterElement = document.createElement('div');
        DOMElements.skipSegmentsContainer.appendChild(chapterElement);
        this.chapterCache.push(chapterElement);
      }
    }

    chapters.forEach((chapter, i) => {
      const chapterElement = this.chapterCache[i];
      chapterElement.classList.add('chapter');
      chapterElement.style.left = chapter.startTime / duration * 100 + '%';
    });
  }

  skipSegment() {
    const time = this.client.currentTime;
    const currentSegment = this.skipSegments.find((segment) => segment.startTime <= time && segment.endTime >= time);
    if (!currentSegment) {
      return;
    }
    this.client.currentTime = currentSegment.endTime;

    if (currentSegment.onSkip) {
      currentSegment.onSkip();
    }
  }

  onProgressbarMouseMove(event) {
    const currentX = Math.min(Math.max(event.clientX - WebUtils.getOffsetLeft(DOMElements.progressContainer), 0), DOMElements.progressContainer.clientWidth);
    const totalWidth = DOMElements.progressContainer.clientWidth;

    const time = this.client.duration * currentX / totalWidth;
    const chapter = this.client.chapters.find((chapter) => chapter.startTime <= time && chapter.endTime >= time);
    const segment = this.skipSegments.find((segment) => segment.startTime <= time && segment.endTime >= time);

    let text = '';
    let offset = 25;

    if (segment) {
      text += segment.name + '\n';
      offset += 25;
    }

    if (chapter) {
      text += chapter.name + '\n';
      offset += 25;
    }

    DOMElements.seekPreviewVideo.style.bottom = offset + 'px';

    text += StringUtils.formatTime(time);
    DOMElements.seekPreviewText.innerText = text;

    const maxWidth = Math.max(DOMElements.seekPreviewVideo.clientWidth, DOMElements.seekPreview.clientWidth);

    let nudgeAmount = 0;

    if (currentX < maxWidth / 2) {
      nudgeAmount = maxWidth / 2 - currentX;
    }

    if (currentX > totalWidth - maxWidth / 2) {
      nudgeAmount = (totalWidth - maxWidth / 2 - currentX);
    }

    DOMElements.seekPreview.style.left = (currentX + nudgeAmount) / totalWidth * 100 + '%';
    DOMElements.seekPreviewTip.style.left = currentX / totalWidth * 100 + '%';

    if (nudgeAmount) {
      DOMElements.seekPreviewTip.classList.add('detached');
    } else {
      DOMElements.seekPreviewTip.classList.remove('detached');
    }


    this.client.seekPreview(time);
  }

  onProgressbarMouseDown(event) {
    // check if left mouse button was pressed
    if (event.button !== 0) {
      return;
    }

    let shouldPlay = false;
    if (this.client.state.playing) {
      this.client.player.pause();
      shouldPlay = true;
    }

    this.isSeeking = true;
    this.client.savePosition();
    this.client.setSeekSave(false);

    DOMElements.progressContainer.classList.add('freeze');
    // we need an initial position for touchstart events, as mouse up has no offset x for iOS
    let initialPosition = Math.min(Math.max(event.clientX - WebUtils.getOffsetLeft(DOMElements.progressContainer), 0), DOMElements.progressContainer.clientWidth);

    let preciseSavedTime = null;
    let preciseSavedPosition = null;
    const shiftTime = (timeBarX) => {
      const totalWidth = DOMElements.progressContainer.clientWidth;
      if (totalWidth) {
        let newTime;
        if (preciseSavedPosition !== null) {
          newTime = preciseSavedTime + 60 * (timeBarX - preciseSavedPosition) / totalWidth;
        } else {
          newTime = this.client.duration * timeBarX / totalWidth;
        }
        this.client.currentTime = newTime;
        this.client.updateTime(newTime);
        DOMElements.currentProgress.style.width = Utils.clamp(newTime / this.client.duration, 0, 1) * 100 + '%';
      }
    };

    const onProgressbarMouseMove = (event) => {
      this.hidePreview();
      const currentY = Math.min(Math.max(event.clientY - WebUtils.getOffsetTop(DOMElements.progressContainer), -100), 50);
      const currentX = Math.min(Math.max(event.clientX - WebUtils.getOffsetLeft(DOMElements.progressContainer), 0), DOMElements.progressContainer.clientWidth);
      const isExpanded = DOMElements.playerContainer.classList.contains('expanded');
      const offset = isExpanded ? 0 : 80;
      if ((this.preciseMode || preciseSavedPosition !== null) && currentY > 20) {
        preciseSavedTime = null;
        preciseSavedPosition = null;
        if (!this.keepPreciseModeOpen) {
          this.endPreciseMode();
        }
      } else if (preciseSavedPosition === null && currentY <= -10 - offset) {
        preciseSavedTime = this.client.currentTime;
        preciseSavedPosition = currentX;
        this.startPreciseMode();
      }

      initialPosition = NaN; // mouse up will fire after the move, we don't want to trigger the initial position in the event of iOS
      shiftTime(currentX);
    };

    const onProgressbarMouseUp = (event) => {
      DOMElements.playerContainer.removeEventListener('mousemove', onProgressbarMouseMove);
      DOMElements.playerContainer.removeEventListener('touchmove', onProgressbarMouseMove);
      DOMElements.playerContainer.removeEventListener('mouseup', onProgressbarMouseUp);
      DOMElements.playerContainer.removeEventListener('mouseleave', onProgressbarMouseUp);
      DOMElements.playerContainer.removeEventListener('touchend', onProgressbarMouseUp);
      if (!this.keepPreciseModeOpen) {
        this.endPreciseMode();
      }
      this.isSeeking = false;

      if (this.isMouseOverProgressbar) {
        this.showPreview();
      }

      let clickedX = Math.min(Math.max(event.clientX - WebUtils.getOffsetLeft(DOMElements.progressContainer), 0), DOMElements.progressContainer.clientWidth);

      if (isNaN(clickedX) && !isNaN(initialPosition)) {
        clickedX = initialPosition;
      }
      if (!isNaN(clickedX)) {
        shiftTime(clickedX);
      }
      this.client.setSeekSave(true);

      DOMElements.progressContainer.classList.remove('freeze');

      if (shouldPlay) {
        this.client.player?.play();
      }
    };
    shiftTime(initialPosition);
    DOMElements.playerContainer.addEventListener('mouseup', onProgressbarMouseUp);
    DOMElements.playerContainer.addEventListener('touchend', onProgressbarMouseUp);
    DOMElements.playerContainer.addEventListener('mouseleave', onProgressbarMouseUp);
    DOMElements.playerContainer.addEventListener('mousemove', onProgressbarMouseMove);
    DOMElements.playerContainer.addEventListener('touchmove', onProgressbarMouseMove);
  }

  onProgressbarMouseLeave() {
    this.isMouseOverProgressbar = false;
    if (!this.isSeeking) {
      this.hidePreview();
    }
  }

  onProgressbarMouseEnter() {
    this.isMouseOverProgressbar = true;
    this.showPreview();
  }

  showPreview() {
    DOMElements.seekPreview.style.display = '';
    DOMElements.seekPreviewTip.style.display = '';
  }

  hidePreview() {
    DOMElements.seekPreview.style.display = 'none';
    DOMElements.seekPreviewTip.style.display = 'none';
  }

  updateMarkers() {
    const pastSeeks = this.client.pastSeeks;
    const duration = this.client.duration;
    if (pastSeeks.length) {
      const time = pastSeeks[pastSeeks.length - 1];
      this.seekMarker.style.left = (time / duration * 100) + '%';
      this.seekMarker.style.display = '';
    } else {
      this.seekMarker.style.display = 'none';
    }

    const pastUnseeks = this.client.pastUnseeks;
    if (pastUnseeks.length) {
      const time = pastUnseeks[pastUnseeks.length - 1];
      this.unseekMarker.style.left = (time / duration * 100) + '%';
      this.unseekMarker.style.display = '';
    } else {
      this.unseekMarker.style.display = 'none';
    }

    const videoAnalyzerMarkerPosition = this.client.videoAnalyzer.getMarkerPosition();
    if (videoAnalyzerMarkerPosition !== null) {
      this.videoAnalyzerMarker.style.left = (videoAnalyzerMarkerPosition / duration * 100) + '%';
      this.videoAnalyzerMarker.style.display = '';
    } else {
      this.videoAnalyzerMarker.style.display = 'none';
    }

    const audioAnalyzerMarkerPosition = this.client.audioAnalyzer.getMarkerPosition();
    if (audioAnalyzerMarkerPosition !== null) {
      this.audioAnalyzerMarker.style.left = (audioAnalyzerMarkerPosition / duration * 100) + '%';
      this.audioAnalyzerMarker.style.display = '';
    } else {
      this.audioAnalyzerMarker.style.display = 'none';
    }

    const frameExtractorMarkerPosition = this.client.frameExtractor.getMarkerPosition();
    if (frameExtractorMarkerPosition !== null) {
      this.frameExtractorMarker.style.left = (frameExtractorMarkerPosition / duration * 100) + '%';
      this.frameExtractorMarker.style.display = '';
    } else {
      this.frameExtractorMarker.style.display = 'none';
    }
  }
}
