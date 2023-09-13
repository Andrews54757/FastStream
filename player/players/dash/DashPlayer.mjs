import {DefaultPlayerEvents} from '../../enums/DefaultPlayerEvents.mjs';
import {DownloadStatus} from '../../enums/DownloadStatus.mjs';
import {DashJS} from '../../modules/dash.mjs';
import {EmitterRelay, EventEmitter} from '../../modules/eventemitter.mjs';
import {Utils} from '../../utils/Utils.mjs';
import {DashFragment} from './DashFragment.mjs';
import {DashFragmentRequester} from './DashFragmentRequester.mjs';
import {DASHLoaderFactory} from './DashLoader.mjs';

export default class DashPlayer extends EventEmitter {
  constructor(client, options) {
    super();
    this.client = client;
    this.video = document.createElement('video');
    this.isPreview = options?.isPreview || false;

    this.fragmentRequester = new DashFragmentRequester(this);
  }

  async setup() {
    // eslint-disable-next-line new-cap
    this.dash = DashJS.MediaPlayer().create();

    const preEvents = new EventEmitter();
    const emitterRelay = new EmitterRelay([preEvents, this]);
    Utils.addPassthroughEventListenersToVideo(this.video, emitterRelay);

    this.dash.updateSettings({
      streaming: {
        abr: {
          autoSwitchBitrate: {audio: false, video: false},
        },
        buffer: {
          bufferToKeep: 10,
          bufferTimeAtTopQuality: 10,
          bufferTimeAtTopQualityLongForm: 10,

        },
      },
    });


    this.dash.on('needkey', (e) => {
      this.client.failedToLoad('Failed to load! DRM not supported!');
    });


    let initAlready = false;

    const initialize = ()=> {
      if (initAlready) return;
      initAlready = true;

      let max = 0;
      let maxLevel = 0;

      // Get best quality but within screen resolution
      this.levels.forEach((level, key) => {
        if (level.bitrate > max) {
          if (level.width > window.innerWidth * window.devicePixelRatio * 2 || level.height > window.innerHeight * window.devicePixelRatio * 2) return;
          max = level.bitrate;
          maxLevel = key;
        }
      });
      this.emit(DefaultPlayerEvents.MANIFEST_PARSED, maxLevel);
    };

    this.dash.on('initialInit', (a) => {
      a.streamProcessors.forEach((processor) => {
        const mediaInfo = processor.getMediaInfo();
        mediaInfo.representations.forEach((rep) => {
          rep.processor = processor;
          this.extractFragments(rep);
        });
      });
      initialize();
    });

    this.dash.on('dataUpdateCompleted', (a) => {
      const processors = this.dash.getStreamController().getActiveStream().getProcessors();
      processors.forEach((processor) => {
        const mediaInfo = processor.getMediaInfo();
        mediaInfo.representations.forEach((rep) => {
          this.extractFragments(rep);
        });
      });
    });

    // for (let eventName in dashjs.Protection.events) {
    //     let event = dashjs.Protection.events[eventName];
    //     let test = (() => {
    //         this.dash.on(event, (e) => {
    //             console.log(event, e,  this.dash.getTracksFor("audio"))
    //         });
    //     })(event)
    // }
    // eslint-disable-next-line new-cap
    this.dash.extend('XHRLoader', DASHLoaderFactory(this), false);
  }

  extractFragments(rep) {
    const processor = rep.processor;
    if (!processor) {
      return;
    }
    const streamIndex = processor.getStreamInfo().index;
    const mediaInfo = processor.getMediaInfo();
    const segmentsController = processor.getSegmentsController();
    const dashHandler = processor.getDashHandler();
    if (rep.hasInitialization()) {
      const init = dashHandler.getInitRequest(mediaInfo, rep);
      if (init) {
        init.level = this.getLevelIdentifier(streamIndex, mediaInfo.index, rep.index);
        init.index = -1;
        init.startTime = init.duration = 0;
        if (!this.client.getFragment(init.level, -1)) {
          this.client.makeFragment(init.level, -1, new DashFragment(init));
        }
      }
    }
    if (rep.hasSegments() || rep.segments) {
      const segments = segmentsController.getAllSegments(rep).map((segment) => {
        return dashHandler._getRequestForSegment(mediaInfo, segment);
      });
      segments.forEach((request) => {
        request.level = this.getLevelIdentifier(streamIndex, mediaInfo.index, rep.index);
        const fragment = new DashFragment(request);
        if (!this.client.getFragment(fragment.level, fragment.sn)) {
          this.client.makeFragment(fragment.level, fragment.sn, fragment);
        }
      });

      if (this.currentTime == 0 && this.video.readyState < 2) {
        this.currentTime = segments[0].startTime;
      }
    }
  }


  getLevelIdentifier(streamIndex, mediaIndex, repIndex) {
    return streamIndex + ':' + mediaIndex + ':' + repIndex;
  }

  getLevelIndexes(identifier) {
    const indexes = identifier.split(':');
    return {
      streamIndex: parseInt(indexes[0]),
      mediaIndex: parseInt(indexes[1]),
      repIndex: parseInt(indexes[2]),
    };
  }
  load() {

  }

  getClient() {
    return this.client;
  }

  getVideo() {
    return this.video;
  }

  async setSource(source) {
    this.source = source;
    this.dash.initialize(this.video, this.source.url, false);
  }

  getSource() {
    return this.source;
  }


  downloadFragment(fragment) {
    this.fragmentRequester.requestFragment(fragment, {
      onProgress: (e) => {

      },
      onSuccess: (e) => {

      },
      onFail: (e) => {

      },

    });
  }


  get buffered() {
    return this.video.buffered;
  }

  async play() {
    return this.video.play();
  }

  async pause() {
    return this.video.pause();
  }

  destroy() {
    this.dash.destroy();
    this.dash = null;
    this.emit(DefaultPlayerEvents.DESTROYED);
  }

  set currentTime(value) {
    this.video.currentTime = value;
    this.dash.seek(value);
  }

  get currentTime() {
    return this.video.currentTime;
  }

  get readyState() {
    return this.video.readyState;
  }

  get paused() {
    return this.video.paused;
  }


  get levels() {
    const processor = this.dash.getStreamController().getActiveStream().getProcessors().find((o) => o.getType() == 'video');
    if (!processor) {
      return new Map();
    }

    const result = new Map();

    processor.getMediaInfo().representations.map((rep) => {
      result.set(this.getLevelIdentifier(processor.getStreamInfo().index, processor.getMediaInfo().index, rep.index), {
        bitrate: rep.bandwidth,
        height: rep.height,
        width: rep.width,
      });
    });

    return result;
  }

  get currentLevel() {
    const processor = this.dash.getStreamController()?.getActiveStream()?.getProcessors()?.find((o) => o.getType() === 'video');
    if (!processor) {
      return -1;
    }
    return this.getLevelIdentifier(processor.getStreamInfo().index, processor.getMediaInfo().index, processor.getRepresentationController().getCurrentRepresentation().index);
  }

  set currentLevel(value) {
    if (typeof value !== 'string') return;
    try {
      this.dash.setQualityFor('video', parseInt(this.getLevelIndexes(value).repIndex));
    } catch (e) {
      console.warn(e);
    }
  }

  get currentAudioLevel() {
    const processor = this.dash.getStreamController()?.getActiveStream()?.getProcessors()?.find((o) => o.getType() === 'audio');
    if (!processor) {
      return -1;
    }
    return this.getLevelIdentifier(processor.getStreamInfo().index, processor.getMediaInfo().index, processor.getRepresentationController().getCurrentRepresentation().index);
  }

  set currentAudioLevel(value) {
    if (typeof value !== 'string') return;
    this.dash.setQualityFor('audio', parseInt(this.getLevelIndexes(value).repIndex));
  }

  get duration() {
    return this.video.duration;
  }


  get currentFragment() {
    const frags = this.client.getFragments(this.currentLevel);
    if (!frags) return null;

    let index = Utils.binarySearch(frags, this.currentTime, (time, frag) => {
      if (time < frag.start) return -1;
      if (time >= frag.end) return 1;
      return 0;
    });

    if (index == -1) return frags[0];

    if (index < -1) index = -index - 2;
    return frags[index];
  }

  get currentAudioFragment() {
    const frags = this.client.getFragments(this.currentAudioLevel);
    if (!frags) return null;

    let index = Utils.binarySearch(frags, this.currentTime, (time, frag) => {
      if (time < frag.start) return -1;
      if (time >= frag.end) return 1;
      return 0;
    });
    if (index == -1) return null;

    if (index < -1) index = -index - 2;
    return frags[index];
  }

  canSave() {
    let frags = this.client.fragments;
    if (!frags || this.dash.getStreamController().getStreams().length > 1) {
      return {
        canSave: false,
        isComplete: false,
      };
    }

    let incomplete = false;
    for (let i = -1; i < frags.length; i++) {
      if (frags[i] && frags[i].status !== DownloadStatus.DOWNLOAD_COMPLETE) {
        incomplete = true;
        break;
      }
    }

    frags = this.client.audioFragments || [];
    for (let i = -1; i < frags.length; i++) {
      if (frags[i] && frags[i].status !== DownloadStatus.DOWNLOAD_COMPLETE) {
        incomplete = true;
        break;
      }
    }

    return {
      canSave: true,
      isComplete: !incomplete,
    };
  }

  async getSaveBlob(options) {
    let frags = [];
    const fragments = this.client.getFragments(this.currentLevel) || [];
    const audioFragments = this.client.getFragments(this.currentAudioLevel) || [];

    let fragIndex = 0;
    let audioFragIndex = 0;

    for (let i = 0; i < fragments.length + audioFragments.length; i++) {
      const frag = fragments[fragIndex];
      const audioFrag = audioFragments[audioFragIndex];

      if (frag && audioFrag) {
        if (frag.start < audioFrag.start) {
          frags.push({
            type: 0,
            fragment: frag,
            entry: this.client.downloadManager.getEntry(frag.getContext()),
          });
          fragIndex++;
        } else {
          frags.push({
            type: 1,
            fragment: audioFrag,
            entry: this.client.downloadManager.getEntry(audioFrag.getContext()),
          });
          audioFragIndex++;
        }
      } else if (frag) {
        frags.push({
          type: 0,
          fragment: frag,
          entry: this.client.downloadManager.getEntry(frag.getContext()),
        });
        fragIndex++;
      } else if (audioFrag) {
        frags.push({
          type: 1,
          fragment: audioFrag,
          entry: this.client.downloadManager.getEntry(audioFrag.getContext()),
        });
        audioFragIndex++;
      }
    }

    frags = frags.filter((frag) => {
      return frag.fragment.status === DownloadStatus.DOWNLOAD_COMPLETE;
    });

    const videoProcessor = this.dash.getStreamController()?.getActiveStream()?.getProcessors()?.find((o) => o.getType() === 'video');
    const audioProcessor = this.dash.getStreamController()?.getActiveStream()?.getProcessors()?.find((o) => o.getType() === 'audio');

    const videoDuration = videoProcessor?.getMediaInfo()?.streamInfo?.duration || 0;
    const audioDuration = audioProcessor?.getMediaInfo()?.streamInfo?.duration || 0;

    const videoInitSegment = fragments?.[-1];
    const audioInitSegment = audioFragments?.[-1];

    const videoInitSegmentData = videoInitSegment ? await this.client.downloadManager.getEntry(videoInitSegment.getContext()).getDataFromBlob() : null;
    const audioInitSegmentData = audioInitSegment ? await this.client.downloadManager.getEntry(audioInitSegment.getContext()).getDataFromBlob() : null;

    const {DASH2MP4} = await import('../../modules/dash2mp4/dash2mp4.mjs');

    const dash2mp4 = new DASH2MP4();

    dash2mp4.on('progress', (progress) => {
      if (options?.onProgress) {
        options.onProgress(progress);
      }
    });

    const blob = await dash2mp4.convert(videoDuration, videoInitSegmentData, audioDuration, audioInitSegmentData, frags);

    return {
      extension: 'mp4',
      blob: blob,
    };
  }

  get volume() {
    return this.video.volume;
  }

  set volume(value) {
    this.video.volume = value;
    if (value === 0) this.video.muted = true;
    else this.video.muted = false;
  }

  get playbackRate() {
    return this.video.playbackRate;
  }

  set playbackRate(value) {
    this.video.playbackRate = value;
  }
}
