import {DefaultPlayerEvents} from '../../enums/DefaultPlayerEvents.mjs';
import {DownloadStatus} from '../../enums/DownloadStatus.mjs';
import {EmitterCancel, EmitterRelay, EventEmitter} from '../../modules/eventemitter.mjs';
import {MP4Box} from '../../modules/mp4box.mjs';
import {BlobManager} from '../../utils/BlobManager.mjs';
import {Utils} from '../../utils/Utils.mjs';
import {VideoUtils} from '../../utils/VideoUtils.mjs';
import {MP4Fragment} from './MP4Fragment.mjs';
import {MP4FragmentRequester} from './MP4FragmentRequester.mjs';
import {SourceBufferWrapper} from './SourceBufferWrapper.mjs';
const FRAGMENT_SIZE = 1000000;

export default class MP4Player extends EventEmitter {
  constructor(client, config) {
    super();
    this.client = client;

    this.isPreview = config?.isPreview || false;
    this.video = document.createElement('video');

    this.mp4box = MP4Box.createFile(false);

    this.options = {
      backBufferLength: 10,
      maxFragmentsBuffered: 30,
      maxBufferLength: this.isPreview ? 10 : 30,
    };

    this.metaData = null;
    this.fileLength = 0;

    this.fragmentRequester = new MP4FragmentRequester(this);

    this.running = false;

    this.loaded = false;

    this.videoTracks = [];
    this.audioTracks = [];


    this.currentVideoTrack = 0;
    this.currentAudioTrack = this.isPreview ? -1 : 0;

    this.currentFragments = [];

    this._duration = 0;
  }


  load() {
    this.loaded = true;
  }

  getClient() {
    return this.client;
  }

  removeSourceBuffers() {
    if (this.videoSourceBuffer) {
      this.mediaSource.removeSourceBuffer(this.videoSourceBuffer.sourceBuffer);
      this.videoSourceBuffer = null;
    }

    if (this.audioSourceBuffer) {
      this.mediaSource.removeSourceBuffer(this.audioSourceBuffer.sourceBuffer);
      this.audioSourceBuffer = null;
    }
  }

  makeSourceBuffers() {
    const videoTrack = this.metaData.videoTracks[this.currentVideoTrack];
    if (videoTrack) {
      const videoCodec = 'video/mp4; codecs=\"' + videoTrack.codec + '\"';
      this.videoSourceBuffer = new SourceBufferWrapper(this.mediaSource, videoCodec);
    }

    const audioTrack = this.metaData.audioTracks[this.currentAudioTrack];
    if (audioTrack) {
      const audioCodec = 'audio/mp4; codecs=\"' + audioTrack.codec + '\"';
      this.audioSourceBuffer = new SourceBufferWrapper(this.mediaSource, audioCodec);
    }
  }

  freeSamples(id) {
    // return;
    const trak = this.mp4box.getTrackById(id);

    trak.samples_stored.forEach((sample) => {
      this.mp4box.releaseSample(trak, sample.number);
    });

    trak.samples_stored.length = 0;
  }

  setupHLS() {
    this.removeSourceBuffers();
    this.makeSourceBuffers();

    this.mp4box.fragmentedTracks.length = 0;

    const videoTrack = this.metaData.videoTracks[this.currentVideoTrack];
    const audioTrack = this.metaData.audioTracks[this.currentAudioTrack];

    this.mp4box.onSegment = (id, user, buffer, sampleNumber, last) => {
      // console.log(id, sampleNumber)
      if (videoTrack.id === id) {
        this.videoSourceBuffer.appendBuffer(buffer);

        this.freeSamples(id);
      } else if (audioTrack.id === id) {
        this.audioSourceBuffer.appendBuffer(buffer);

        this.freeSamples(id);
      } else {
        throw new Error('Unknown track id');
      }
      this.updateDuration();
    };

    if (videoTrack) {
      this.mp4box.setSegmentOptions(videoTrack.id, 1, {
        nbSamples: 1,
      });
    }

    if (audioTrack) {
      this.mp4box.setSegmentOptions(audioTrack.id, 1, {
        nbSamples: 1,
      });
    }


    const initSegs = this.mp4box.initializeSegmentation();

    let ind = 0;
    if (videoTrack) {
      this.videoSourceBuffer.appendBuffer(initSegs[ind++].buffer);
    }

    if (audioTrack) {
      this.audioSourceBuffer.appendBuffer(initSegs[ind++].buffer);
    }

    this.mp4box.seek(this.currentTime);
    this.mp4box.start();
  }


  async setup() {
    return new Promise((resolve, reject) => {
      const preEvents = new EventEmitter();

      preEvents.on(DefaultPlayerEvents.DURATIONCHANGE, () => {
        return EmitterCancel;
      });

      const emitterRelay = new EmitterRelay([preEvents, this]);
      VideoUtils.addPassthroughEventListenersToVideo(this.video, emitterRelay);

      this.mp4box.onReady = (info) => {
        this.onMetadataParsed(info);
      };

      this.mp4box.onError = (error) => {
        console.error('onError', error);
        this.running = false;
        this.emit(DefaultPlayerEvents.ERROR, error);
      };

      this.mediaSource = new MediaSource();
      this.mediaSourceURL = URL.createObjectURL(this.mediaSource);
      this.mediaSource.addEventListener('sourceopen', () => {
        resolve();
      });
      this.video.src = this.mediaSourceURL;
    });
  }

  sortSamples(samples) {
    samples = samples.filter((sample) => {
      return sample.is_sync;
    });
    samples.sort((a, b) => {
      return a.cts - b.cts;
    });
    return samples;
  }

  onMetadataParsed(info) {
    this.metaData = info;

    const max = Math.ceil(this.fileLength / FRAGMENT_SIZE);
    // for (let l = 0; l < info.videoTracks.length; l++) {
    const l = this.currentVideoTrack;
    for (let i = 0; i < max; i++) {
      if (!this.client.getFragment(l, i)) {
        this.client.makeFragment(l, i, new MP4Fragment(l, i, this.source, i * FRAGMENT_SIZE, Math.min((i + 1) * FRAGMENT_SIZE, this.fileLength)));
      }
    }
    const trak = this.mp4box.moov.traks.find((trak) => {
      return trak.tkhd.track_id == info.videoTracks[l].id;
    });
    const samples = trak.samples;
    this.videoTracks.push({
      trak,
      track: info.videoTracks[l],
      samples: samples,
      sortedSamples: this.sortSamples(samples),
    });
    //  }

    for (let l = 0; l < info.audioTracks.length; l++) {
      const trak = this.mp4box.moov.traks.find((trak) => {
        return trak.tkhd.track_id == info.audioTracks[l].id;
      });
      const samples = trak.samples;
      this.audioTracks.push({
        trak,
        track: info.audioTracks[l],
        samples: samples,
        sortedSamples: this.sortSamples(samples),
      });
    }

    this.setFragmentTimes();
    this.emit(DefaultPlayerEvents.MANIFEST_PARSED, 0);
    this.updateDuration();
    this.setupHLS();
  }

  getVideo() {
    return this.video;
  }

  async setSource(source) {
    if (this.source) {
      throw new Error('Source already set');
    }

    this.source = source;
    this.needsInit = true;

    if (!this.client.getFragment(0, 0)) {
      this.client.makeFragment(0, 0, new MP4Fragment(0, 0, source, 0, FRAGMENT_SIZE));
    }

    this.running = true;
    this.mainLoop();
  }

  getSource() {
    return this.source;
  }

  mainLoop() {
    if (!this.running) {
      return;
    }

    if (this.needsInit && this.readyState === 1) {
      const buffered = this.buffered;
      this.client.setSeekSave(false);
      if (buffered.length > 0) {
        const start = buffered.start(0);
        if (this.currentTime < start) {
          this.currentTime = start;
        }
      } else {
        this.currentTime = this.currentTime;
      }
      this.client.setSeekSave(true);
    }

    if (this.readyState > 1) {
      this.needsInit = false;
    }

    this.runLoad();
    this.loopTimeout = setTimeout(this.mainLoop.bind(this), 1);
  }

  initializeFragments() {
    const max = Math.ceil(this.fileLength / FRAGMENT_SIZE);
    for (let i = 1; i < max; i++) {
      if (!this.client.getFragment(0, i)) {
        this.client.makeFragment(0, i, new MP4Fragment(0, i, this.source, i * FRAGMENT_SIZE, Math.min((i + 1) * FRAGMENT_SIZE, this.fileLength)));
      }
    }
  }

  setFragmentTimes() {
    this.levels.forEach((level, l) => {
      const frags = this.client.getFragments(l);
      let currentFragment = frags[0];
      currentFragment.start = 0;
      for (let i = 1; i < frags.length; i++) {
        const frag = frags[i];
        const dt = this.getMinTimeFromOffset(this.videoTracks[l].samples, frag.rangeStart, frag.rangeEnd);
        if (dt !== null) {
          const time = Math.floor(dt);
          currentFragment.end = time;
          currentFragment.duration = time - currentFragment.start;
          frag.start = time;
          currentFragment = frag;
        }
      }

      currentFragment.end = Math.ceil(this.metaData.duration / this.metaData.timescale);
      currentFragment.duration = currentFragment.end - currentFragment.start;
    });
  }

  removeFromBuffers(start, end) {
    start = Math.max(0, start);
    end = Math.min(this.mediaSource.duration, Math.max(end, start));

    if (start === end) {
      return;
    }
    if (this.videoSourceBuffer) {
      this.videoSourceBuffer.remove(start, end);
    }
    if (this.audioSourceBuffer) {
      this.audioSourceBuffer.remove(start, end);
    }
  }
  runLoad() {
    if (this.metaData && !this.loaded) return;

    if (this.isPreview && this.readyState >= 2) {
      return;
    }

    if (this.loader) {
      return;
    }

    const currentFragment = this.currentFragment;

    if (!currentFragment) {
      this.running = false;
      throw new Error('No current fragment');
    }
    const frags = this.client.getFragments(this.currentVideoTrack) || [];

    const time = this.video.currentTime;
    for (let i = 0; i < this.currentFragments.length; i++) {
      const frag = this.currentFragments[i];
      if (frag.sn >= currentFragment.sn) continue;

      if (frag.end < time - this.options.backBufferLength) {
        this.currentFragments.splice(i, 1);
        frag.removeReference();
        i--;
      }
    }

    this.removeFromBuffers(0, Math.min(time - this.options.backBufferLength - 1, currentFragment.start));

    const len = frags.length;
    for (let i = currentFragment.sn; i < Math.min(currentFragment.sn + this.options.maxFragmentsBuffered, len); i++) {
      const frag = this.client.getFragment(this.currentVideoTrack, i);
      if (!frag) {
        this.running = false;
        throw new Error('No next fragment');
      }

      if (i !== currentFragment.sn && frag.start > this.video.currentTime + this.options.maxBufferLength) {
        break;
      }

      if (frag.status === DownloadStatus.DOWNLOAD_FAILED) {
        break;
      }

      if (!this.currentFragments.includes(frag)) {
        const loader = this.loader = this.fragmentRequester.requestFragment(frag, {
          onSuccess: (entry, data) => {
            if (this.loader === loader) {
              this.loader = null;
            } else return;

            if (!this.fileLength) {
              const rangeHeader = entry.responseHeaders['content-range'];
              if (!rangeHeader) {
                console.log(entry.responseHeaders);
                this.running = false;
                throw new Error('No content length');
              }

              this.fileLength = parseInt(rangeHeader.split('/')[1]);

              this.initializeFragments();
            }
            // console.log("append", frag)
            this.mp4box.appendBuffer(data);
            this.currentFragments.push(frag);
            frag.addReference();
            this.runLoad();
          },
          onProgress: (stats, context, data, xhr) => {

          },
          onFail: (entry) => {
            if (this.loader === loader) {
              this.loader = null;
            }

            if (len === 1) {
              this.emit(DefaultPlayerEvents.ERROR, 'Failed first fragment');
            }
          },
          onAbort: (entry) => {
            if (this.loader === loader) {
              this.loader = null;
            } else return;
          },

        });
        return;
      }
    }
  }

  downloadFragment(fragment) {
    this.fragmentRequester.requestFragment(fragment, {
      onSuccess: (entry, data) => {

      },
      onProgress: (stats, context, data, xhr) => {

      },
      onFail: (entry) => {
      },
      onAbort: (entry) => {
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
    this.running = false;
    if (this.videoSourceBuffer) {
      this.videoSourceBuffer.abort();
      this.videoSourceBuffer = null;
    }
    if (this.audioSourceBuffer) {
      this.audioSourceBuffer.abort();
      this.audioSourceBuffer = null;
    }
    if (this.mediaSourceURL) {
      URL.revokeObjectURL(this.mediaSourceURL);
      this.mediaSourceURL = null;
    }

    if (this.loader) {
      this.loader.abort();
      this.loader = null;
    }

    this.mp4box = null;
    this.metaData = null;

    this.videoTracks = null;
    this.audioTracks = null;

    clearTimeout(this.loopTimeout);
    this.emit(DefaultPlayerEvents.DESTROYED);
  }

  resetHLS(noLoad) {
    if (!this.metaData) return;
    // console.log("resetHLS");
    this.removeFromBuffers(0, this.video.duration);
    this.mp4box.flush();
    this.mp4box.stream.buffers.length = 0;

    this.metaData.tracks.forEach((track) => {
      this.freeSamples(track.id);
    });
    if (this.loader) {
      this.loader.abort();
      this.loader = null;
    }

    this.currentFragments.forEach((frag) => {
      frag.removeReference();
    });

    this.currentFragments.length = 0;
    this.mp4box.seek(this.currentTime, true);
    if (!noLoad) this.runLoad();
  }

  isBuffered(time) {
    if (this.video.buffered.length === 0) return false;

    if (this.video.buffered.length > 1) {
      console.log('More than one buffered range', this.video.buffered);
    }

    const buffered = this.video.buffered;
    const currentTime = time;
    for (let i = 0; i < buffered.length; i++) {
      if (currentTime >= buffered.start(i) && currentTime <= buffered.end(i)) {
        return true;
      }
    }
    return false;
  }

  set currentTime(value) {
    this.video.currentTime = value;
    if (!this.isBuffered(value)) {
      this.resetHLS();
    }
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
    if (!this.metaData) return new Map();
    const track = this.metaData.videoTracks[0];
    const result = new Map();
    result.set(0, {
      bitrate: track.bitrate,
      width: track.track_width,
      height: track.track_height,
      language: track.language,
    });
    return result;
  }

  get currentLevel() {
    return this.currentVideoTrack;
  }

  set currentLevel(value) {

  }

  get duration() {
    return this._duration;
  }

  calculateDuration() {
    if (!this.metaData) return 0;
    const info = this.metaData;
    let duration = ((info.isFragmented ? info.fragment_duration : info.duration) || 0) / info.timescale;
    if (duration === 0 && info.isFragmented) {
      duration = this.mp4box.moov.traks.reduce((acc, track) => {
        return Math.max(acc, track.samples_duration / track.samples[0].timescale, 0);
      }, 0);
    }
    return duration;
  }

  updateDuration() {
    const newDuration = this.calculateDuration();
    if (newDuration !== this._duration) {
      this._duration = newDuration;
      this.mediaSource.duration = newDuration;
      this.emit(DefaultPlayerEvents.DURATIONCHANGE);
    }
  }

  getFragmentOffset(samples, time) {
    let index = Utils.binarySearch(samples, time * samples[0].timescale, (time, sample) => {
      return time - sample.cts;
    });

    if (index < 0) {
      index = Math.max(-1 - index - 1, 0);
    }

    return samples[index].offset;
  }

  get currentFragment() {
    let startOffset = 0;
    if (!this.metaData && this.mp4box.nextParsePosition) {
      startOffset = this.mp4box.nextParsePosition;
    } else if (this.videoTracks.length || this.audioTracks.length) {
      const time = this.currentTime;
      let seekOffset = Infinity;
      const sortedSamples = [];
      if (this.videoTracks[this.currentVideoTrack]) {
        sortedSamples.push(this.videoTracks[this.currentVideoTrack].sortedSamples);
      }

      if (this.audioTracks[this.currentAudioTrack]) {
        sortedSamples.push(this.audioTracks[this.currentAudioTrack].sortedSamples);
      }
      for (let i = 0; i < sortedSamples.length; i++) {
        const samples = sortedSamples[i];
        const offset = this.getFragmentOffset(samples, time);
        if (offset < seekOffset) {
          seekOffset = offset;
        }
      }
      startOffset = seekOffset;
    }


    const index = Math.floor(startOffset / FRAGMENT_SIZE);

    return this.client.getFragment(this.currentVideoTrack, index);
  }

  getMinTimeFromOffset(samples, offset, end) {
    let index = Utils.binarySearch(samples, offset, (offset, sample) => {
      return offset - sample.offset;
    });

    if (index < 0) {
      index = Math.max(-1 - index, 0);
    }

    let minTime = Infinity;
    for (let i = index; i < samples.length; i++) {
      if (samples[i].offset > end) {
        break;
      }
      minTime = Math.min(minTime, samples[i].cts);
    }


    if (minTime !== Infinity) {
      return minTime / samples[0].timescale;
    } else {
      return null;
    }
  }

  canSave() {
    const frags = this.client.getFragments(this.currentLevel);
    if (!frags) {
      return {
        canSave: false,
        isComplete: false,
      };
    }
    let incomplete = false;
    for (let i = 0; i < frags.length; i++) {
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
    const frags = this.client.getFragments(this.currentVideoTrack);
    const emptyTemplate = BlobManager.createBlob([new ArrayBuffer(FRAGMENT_SIZE)], 'application/octet-stream');

    const files = [];
    let lastFrag = 0;
    for (let i = frags.length - 1; i >= 0; i--) {
      const frag = frags[i];
      if (frag.status === DownloadStatus.DOWNLOAD_COMPLETE) {
        lastFrag = i + 1;
        break;
      }
    }
    for (let i = 0; i < lastFrag; i++) {
      const frag = frags[i];
      if (frag.status === DownloadStatus.DOWNLOAD_COMPLETE) {
        const entry = this.client.downloadManager.getEntry(frag.getContext());
        if (entry.getData()) {
          files.push(entry.getData());
        } else {
          throw new Error('No data for fragment');
        }
      } else {
        files.push(emptyTemplate);
      }
    }

    return {
      extension: 'mp4',
      blob: BlobManager.createBlob(files, 'video/mp4'),
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
