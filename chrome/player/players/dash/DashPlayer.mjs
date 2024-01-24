import {DefaultPlayerEvents} from '../../enums/DefaultPlayerEvents.mjs';
import {DownloadStatus} from '../../enums/DownloadStatus.mjs';
import {DashJS} from '../../modules/dash.mjs';
import {EmitterRelay, EventEmitter} from '../../modules/eventemitter.mjs';
import {Utils} from '../../utils/Utils.mjs';
import {VideoUtils} from '../../utils/VideoUtils.mjs';
import {DashFragment} from './DashFragment.mjs';
import {DashFragmentRequester} from './DashFragmentRequester.mjs';
import {DASHLoaderFactory} from './DashLoader.mjs';
import {TrackFilter} from './TrackFilter.mjs';

export default class DashPlayer extends EventEmitter {
  constructor(client, options) {
    super();
    this.client = client;
    this.video = document.createElement('video');
    this.isPreview = options?.isPreview || false;
    this.qualityMultiplier = options?.qualityMultiplier || 1.1;

    this.fragmentRequester = new DashFragmentRequester(this);

    this.desiredVideoLevel = null;
    this.desiredAudioLevel = null;
  }

  async setup() {
    // eslint-disable-next-line new-cap
    this.dash = DashJS.MediaPlayer().create();

    const preEvents = new EventEmitter();
    const emitterRelay = new EmitterRelay([preEvents, this]);
    VideoUtils.addPassthroughEventListenersToVideo(this.video, emitterRelay);

    this.dash.updateSettings({
      'streaming': {
        abr: {
          autoSwitchBitrate: {audio: false, video: false},
        },
        buffer: {
          bufferToKeep: 10,
          bufferTimeAtTopQuality: 10,
          bufferTimeAtTopQualityLongForm: 10,
          bufferPruningInterval: 1,

        },
      },
      // 'debug': {
      //   'logLevel': DashJS.Debug.LOG_LEVEL_DEBUG,
      // },
    });

    this.dash.setCustomInitialTrackSelectionFunction((tracks)=>{
      const lang = navigator.language || 'en';
      return TrackFilter.filterTracks(tracks, lang, this.qualityMultiplier);
    });

    this.dash.on('needkey', (e) => {
      this.emit(DefaultPlayerEvents.NEED_KEY);
    });

    let initAlready = false;

    const initialize = ()=> {
      if (initAlready) return;
      initAlready = true;

      const level = Utils.selectQuality(this.levels, this.qualityMultiplier);
      this.emit(DefaultPlayerEvents.MANIFEST_PARSED, level);
    };

    this.dash.on('initialInit', (a) => {
      this.extractAllFragments();
      initialize();
    });

    this.dash.on('dataUpdateCompleted', (a) => {
      this.extractAllFragments();
    });

    this.dash.on('currentTrackChanged', (a)=>{
      this.extractAllFragments();
    });

    this.dash.on('initFragmentNeeded', ()=>{
      console.log(this.desiredVideoLevel, this.desiredAudioLevel, this.currentLevel, this.currentAudioLevel);
      if (this.currentLevel !== this.desiredVideoLevel) {
        this.currentLevel = this.desiredVideoLevel;
      }

      if (this.currentAudioLevel !== this.desiredAudioLevel) {
        this.currentAudioLevel = this.desiredAudioLevel;
      }
    });

    this.dash.on(DashJS.MediaPlayer.events.STREAM_INITIALIZED, (e) => {
      this.emit(DefaultPlayerEvents.LANGUAGE_TRACKS);
    });

    // eslint-disable-next-line new-cap
    this.dash.extend('XHRLoader', DASHLoaderFactory(this), false);
  }

  extractAllFragments() {
    const processors = this.dash.getStreamController().getActiveStream().getProcessors();
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

      if (this.currentTime === 0 && this.video.readyState < 2) {
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


  downloadFragment(fragment, priority) {
    return new Promise((resolve, reject) => {
      this.fragmentRequester.requestFragment(fragment, {
        onProgress: (e) => {

        },
        onSuccess: (e) => {
          resolve();
        },
        onFail: (e) => {
          reject(new Error('Failed to download fragment'));
        },
      }, null, priority);
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
    try {
      this.dash.destroy();
    } catch (e) {

    }
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
    const tracks = this.dash.getTracksFor('video');
    const currentLang = this.dash.getCurrentTrackFor('video')?.lang || navigator.language || 'en';
    return TrackFilter.getLevelList(tracks, currentLang);
  }

  get currentLevel() {
    const processor = this.dash.getStreamController()?.getActiveStream()?.getProcessors()?.find((o) => o.getType() === 'video');
    if (!processor) {
      return -1;
    }
    return this.getLevelIdentifier(processor.getStreamInfo().index, processor.getMediaInfo().index, processor.getRepresentationController().getCurrentRepresentation().index);
  }

  set currentLevel(value) {
    console.error('set current level', value );
    if (typeof value !== 'string') return;
    try {
      const tracks = this.dash.getTracksFor('video');
      const {mediaIndex, repIndex} = this.getLevelIndexes(value);
      const track = tracks.find((track) => {
        return track.index === mediaIndex;
      });
      if (!track) {
        console.warn('Could not find video track', value);
      }
      this.desiredVideoLevel = value;
      this.dash.setCurrentTrack(track);
      this.dash.setQualityFor('video', repIndex, true);
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
    const tracks = this.dash.getTracksFor('audio');
    const {mediaIndex, repIndex} = this.getLevelIndexes(value);
    const track = tracks.find((track) => {
      return track.index === mediaIndex;
    });
    if (!track) {
      console.warn('Could not find audio track', value);
    }
    this.desiredAudioLevel = value;
    this.dash.setCurrentTrack(track);
    this.dash.setQualityFor('audio', repIndex, true);
  }

  get duration() {
    return this.video.duration;
  }

  get audioTracks() {
    return TrackFilter.uniqueLanguages(this.dash.getTracksFor('audio'));
  }

  get videoTracks() {
    return TrackFilter.uniqueLanguages(this.dash.getTracksFor('video'));
  }

  get languageTracks() {
    return {
      audio: this.audioTracks.map((track) => {
        return {
          type: 'audio',
          lang: track.lang,
          index: track.index,
          isActive: track === this.dash.getCurrentTrackFor('audio'),
          track,
        };
      }),
      video: this.videoTracks.map((track) => {
        return {
          type: 'video',
          lang: track.lang,
          index: track.index,
          isActive: track === this.dash.getCurrentTrackFor('video'),
          track,
        };
      }),
    };
  }

  setLanguageTrack(track) {
    this.dash.setCurrentTrack(track.track);
  }

  get currentFragment() {
    const frags = this.client.getFragments(this.currentLevel);
    if (!frags) return null;

    const time = this.currentTime;
    return frags.find((frag) => {
      if (!frag) return false;
      return time >= frag.start && time < frag.end;
    });
  }

  get currentAudioFragment() {
    const frags = this.client.getFragments(this.currentAudioLevel);
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
    const fragments = this.client.getFragments(this.currentLevel) || [];
    const audioFragments = this.client.getFragments(this.currentAudioLevel) || [];

    let zippedFragments = Utils.zipTimedFragments([fragments, audioFragments]);

    if (options.partialSave) {
      zippedFragments = zippedFragments.filter((data) => {
        return data.fragment.status === DownloadStatus.DOWNLOAD_COMPLETE;
      });
    }

    zippedFragments.forEach((data) => {
      data.getEntry = async () => {
        if (data.fragment.status !== DownloadStatus.DOWNLOAD_COMPLETE) {
          await this.downloadFragment(data.fragment, -1);
        }
        return this.client.downloadManager.getEntry(data.fragment.getContext());
      };
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

    const blob = await dash2mp4.convert(videoDuration, videoInitSegmentData, audioDuration, audioInitSegmentData, zippedFragments);

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
