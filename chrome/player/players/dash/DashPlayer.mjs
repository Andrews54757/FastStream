import {DefaultPlayerEvents} from '../../enums/DefaultPlayerEvents.mjs';
import {DownloadStatus} from '../../enums/DownloadStatus.mjs';
import {ReferenceTypes} from '../../enums/ReferenceTypes.mjs';
import {MediaPlayer} from '../../modules/dash.mjs';
import {EmitterRelay, EventEmitter} from '../../modules/eventemitter.mjs';
import {Utils} from '../../utils/Utils.mjs';
import {VideoUtils} from '../../utils/VideoUtils.mjs';
import {DashFragment} from './DashFragment.mjs';
import {DashFragmentRequester} from './DashFragmentRequester.mjs';
import {DASHLoaderFactory} from './DashLoader.mjs';
import {DashTrackUtils} from './DashTrackUtils.mjs';

export default class DashPlayer extends EventEmitter {
  constructor(client, config) {
    super();
    this.client = client;
    this.isPreview = config?.isPreview || false;
    this.isAudioOnly = config?.isAudioOnly || false;
    this.isAnalyzer = config?.isAnalyzer || false;
    this.defaultQuality = client.options.defaultQuality || 'Auto';
    this.video = document.createElement(this.isAudioOnly ? 'audio' : 'video');

    this.fragmentRequester = new DashFragmentRequester(this);
    this.activeRequests = [];
  }

  async setup() {
    // eslint-disable-next-line new-cap
    this.dash = MediaPlayer().create();

    const preEvents = new EventEmitter();
    const emitterRelay = new EmitterRelay([preEvents, this]);
    VideoUtils.addPassthroughEventListenersToVideo(this.video, emitterRelay);

    const newSettings = {
      streaming: {
        abr: {
          autoSwitchBitrate: {audio: false, video: false},
        },
        buffer: {
          bufferToKeep: 10,
          bufferTimeAtTopQuality: 10,
          bufferTimeAtTopQualityLongForm: 10,
          bufferPruningInterval: 1,

        },
        text: {
          defaultEnabled: false,
        },
        capabilities: {
          useMediaCapabilitiesApi: false,
        },
      },
      errors: {
        recoverAttempts: {
          mediaErrorDecode: 1000000,
        },
      },
    };

    // if (this.isPreview) {
    // newSettings.debug ={
    //   'logLevel': Debug.LOG_LEVEL_DEBUG,
    // };
    // }

    this.dash.updateSettings(newSettings);

    this.dash.setCustomInitialTrackSelectionFunction((tracks) => {
      const type = tracks[0]?.type;
      if (type === 'video') {
        const levels = DashTrackUtils.getVideoLevelList(tracks);
        const chosen = this.client.getLevelManager().pickVideoLevel(Array.from(levels.values()));
        if (chosen) {
          return [chosen.track];
        } else {
          console.warn('No matching video track found for chosen level, falling back to all tracks', tracks, chosen);
          return tracks;
        }
      } else if (type === 'audio') {
        const levels = DashTrackUtils.getAudioLevelList(tracks);
        const chosen = this.client.getLevelManager().pickAudioLevel(Array.from(levels.values()));
        if (chosen) {
          return [chosen.track];
        } else {
          console.warn('No matching audio track found for chosen level, falling back to all tracks', tracks, chosen);
          return tracks;
        }
      }
      return tracks;
    });

    this.dash.setCustomBitrateSelectionFunction((representations, bitrate, mediaInfo) => {
      const type = mediaInfo.type;
      if (type === 'video') {
        const levels = DashTrackUtils.getVideoLevelList([mediaInfo]);
        const chosen = this.client.getLevelManager().pickVideoLevel(Array.from(levels.values()));
        const result = representations.filter((rep) => {
          return chosen && rep.id === chosen.id;
        });
        if (result.length === 0) {
          return representations;
        } else {
          return result;
        }
      } else if (type === 'audio') {
        const levels = DashTrackUtils.getAudioLevelList([mediaInfo]);
        const chosen = this.client.getLevelManager().pickAudioLevel(Array.from(levels.values()));
        const result = representations.filter((rep) => {
          return chosen && rep.id === chosen.id;
        });
        if (result.length === 0) {
          console.warn('No matching audio representation found for chosen level, falling back to all representations', representations, chosen);
          return representations;
        } else {
          return result;
        }
      }
      return representations;
    });

    this.dash.on('needkey', (e) => {
      this.emit(DefaultPlayerEvents.NEED_KEY);
    });

    let initAlready = false;

    const initialize = () => {
      if (initAlready) return;
      initAlready = true;
      this.emit(DefaultPlayerEvents.MANIFEST_PARSED);
    };

    this.dash.on('initialInit', (a) => {
      this.extractAllFragments();
      initialize();
    });

    this.dash.on('REPRESENTATION_UPDATED', (a) => {
      const rep = a.representation;
      this.extractFragments(rep);
    });

    this.dash.on('dataUpdateCompleted', (a) => {
      this.extractAllFragments();
    });

    this.dash.on('currentTrackChanged', (a) => {
      this.extractAllFragments();
    });

    // eslint-disable-next-line new-cap
    this.dash.extend('XHRLoader', DASHLoaderFactory(this), false);
  }

  extractAllFragments() {
    const processors = this.dash.getStreamController().getActiveStream().getStreamProcessors();
    processors.forEach((processor) => {
      const mediaInfo = processor.getMediaInfo();
      mediaInfo.representations.forEach((rep) => {
        rep.processor = processor;
        this.extractFragments(rep);
      });
    });
  }

  extractFragments(rep) {
    const processor = rep.processor;
    if (!processor) {
      return;
    }
    const mediaInfo = processor.getMediaInfo();
    const segmentsController = processor.getSegmentsController();
    const dashHandler = processor.getDashHandler();
    if (rep.hasInitialization()) {
      const init = dashHandler.getInitRequest(mediaInfo, rep);
      if (init) {
        init.level = DashTrackUtils.getLevelFromRepresentation(rep);
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
        if (!request) return;
        request.level = DashTrackUtils.getLevelFromRepresentation(rep);
        const fragment = new DashFragment(request);
        if (!this.client.getFragment(fragment.level, fragment.sn)) {
          this.client.makeFragment(fragment.level, fragment.sn, fragment);
        }
      });
    }
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

  downloadFragment(fragment, priority) {
    return new Promise((resolve, reject) => {
      this.fragmentRequester.requestFragment(fragment, {
        skipProcess: true,
        onProgress: (e) => {

        },
        onSuccess: (e) => {
          resolve();
        },
        onFail: (e) => {
          reject(new Error('Failed to download fragment'));
        },
        onAbort: (e) => {
          reject(new Error('Aborted download'));
        },
      }, null, priority);
    });
  }

  async play() {
    return this.video.play();
  }

  async pause() {
    return this.video.pause();
  }

  set currentTime(value) {
    this.video.currentTime = value;
  }

  destroy() {
    try {
      this.dash.destroy();
    } catch (e) {

    }
    this.dash = null;

    VideoUtils.destroyVideo(this.video);
    this.video = null;

    this.emit(DefaultPlayerEvents.DESTROYED);
  }

  getProcessor(adaptationIndex) {
    const processors = this.dash.getStreamController().getActiveStream().getStreamProcessors();
    for (let i = 0; i < processors.length; i++) {
      const processor = processors[i];
      if (processor.getMediaInfo().index === adaptationIndex) {
        return processor;
      }
    }
    return null;
  }

  getVideoLevels() {
    try {
      const tracks = this.dash.getTracksFor('video');
      return DashTrackUtils.getVideoLevelList(tracks);
    } catch (e) {
      console.warn(e);
      return new Map();
    }
  }

  getAudioLevels() {
    try {
      const tracks = this.dash.getTracksFor('audio');
      return DashTrackUtils.getAudioLevelList(tracks);
    } catch (e) {
      console.warn(e);
      return new Map();
    }
  }

  getCurrentVideoLevelID() {
    const processor = this.dash.getStreamController()?.getActiveStream()?.getStreamProcessors()?.find((o) => o.getType() === 'video');
    if (!processor) {
      return -1;
    }
    return DashTrackUtils.getLevelFromRepresentation(processor.getRepresentationController().getCurrentRepresentation());
  }

  setCurrentVideoLevelID(id) {
    if (typeof id !== 'string') return;
    try {
      this.dash.setRepresentationForTypeById('video', DashTrackUtils.deconstructLevel(id).id);
    } catch (e) {
      console.warn(e);
    }
  }

  getCurrentAudioLevelID() {
    const processor = this.dash.getStreamController()?.getActiveStream()?.getStreamProcessors()?.find((o) => o.getType() === 'audio');
    if (!processor) {
      return -1;
    }
    return DashTrackUtils.getLevelFromRepresentation(processor.getRepresentationController().getCurrentRepresentation());
  }

  setCurrentAudioLevelID(id) {
    if (typeof id !== 'string') return;
    try {
      this.dash.setRepresentationForTypeById('audio', DashTrackUtils.deconstructLevel(id).id, true);
    } catch (e) {
      console.warn(e);
    }
  }

  get duration() {
    return this.video.duration;
  }

  get currentFragment() {
    const frags = this.client.getFragments(this.getCurrentVideoLevelID());
    if (!frags) return null;

    const time = this.currentTime;
    return frags.find((frag) => {
      if (!frag) return false;
      return time >= frag.start && time < frag.end;
    });
  }

  get currentAudioFragment() {
    const frags = this.client.getFragments(this.getCurrentAudioLevelID());
    if (!frags) return null;

    const time = this.currentTime;
    return frags.find((frag) => {
      if (!frag) return false;
      return time >= frag.start && time < frag.end;
    });
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

  async saveVideo(options) {
    const videoFragments = this.client.getFragments(this.getCurrentVideoLevelID()) || [];
    const audioFragments = this.client.getFragments(this.getCurrentAudioLevelID()) || [];

    let zippedFragments = Utils.zipTimedFragments([videoFragments, audioFragments]);

    if (options.partialSave) {
      zippedFragments = zippedFragments.filter((data) => {
        return data.fragment.status === DownloadStatus.DOWNLOAD_COMPLETE;
      });
    }

    zippedFragments.forEach((data) => {
      data.fragment.addReference(ReferenceTypes.SAVER);
      data.getEntry = async () => {
        if (data.fragment.status !== DownloadStatus.DOWNLOAD_COMPLETE) {
          while (true) {
            try {
              await this.downloadFragment(data.fragment, -1);
              break;
            } catch (e) {
              if (e.message !== 'Aborted download') {
                throw e;
              }
            }
          }
        }
        data.fragment.removeReference(ReferenceTypes.SAVER);
        return this.client.downloadManager.getEntry(data.fragment.getContext());
      };
    });

    const videoProcessor = this.dash.getStreamController()?.getActiveStream()?.getStreamProcessors()?.find((o) => o.getType() === 'video');
    const audioProcessor = this.dash.getStreamController()?.getActiveStream()?.getStreamProcessors()?.find((o) => o.getType() === 'audio');

    const videoDuration = videoProcessor?.getMediaInfo()?.streamInfo?.duration || 0;
    const audioDuration = audioProcessor?.getMediaInfo()?.streamInfo?.duration || 0;

    const videoInitSegment = videoFragments?.[-1];
    const audioInitSegment = audioFragments?.[-1];

    // if init segments are not downloaded, we will try to download them
    if (videoInitSegment && videoInitSegment.status !== DownloadStatus.DOWNLOAD_COMPLETE) {
      await this.downloadFragment(videoInitSegment, -1);
    }

    if (audioInitSegment && audioInitSegment.status !== DownloadStatus.DOWNLOAD_COMPLETE) {
      await this.downloadFragment(audioInitSegment, -1);
    }

    const videoInitSegmentData = videoInitSegment ? await this.client.downloadManager.getEntry(videoInitSegment.getContext()).getDataFromBlob() : null;
    const audioInitSegmentData = audioInitSegment ? await this.client.downloadManager.getEntry(audioInitSegment.getContext()).getDataFromBlob() : null;

    const {DASH2MP4} = await import('../../modules/dash2mp4/dash2mp4.mjs');

    const dash2mp4 = new DASH2MP4(options.registerCancel);

    dash2mp4.on('progress', (progress) => {
      if (options?.onProgress) {
        options.onProgress(progress);
      }
    });

    const videoMimeType = videoProcessor.getRepresentation().mimeType;
    const audioMimeType = audioProcessor.getRepresentation().mimeType;

    try {
      const blob = await dash2mp4.convert(videoMimeType, videoDuration, videoInitSegmentData, audioMimeType, audioDuration, audioInitSegmentData, zippedFragments);

      return {
        extension: 'mp4',
        blob: blob,
      };
    } catch (e) {
      zippedFragments.forEach((data) => {
        data.fragment.removeReference(ReferenceTypes.SAVER);
      });
      throw e;
    }
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

  get buffered() {
    return this.video.buffered;
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
}
