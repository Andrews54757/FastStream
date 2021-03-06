import { DefaultPlayerEvents } from "../../enums/DefaultPlayerEvents.mjs";
import { DownloadStatus } from "../../enums/DownloadStatus.mjs";
import { EmitterCancel, EmitterRelay, EventEmitter } from "../../modules/eventemitter.mjs";
import { MP4Box } from "../../modules/mp4box.mjs";
import { BlobManager } from "../../utils/BlobManager.mjs";
import { Utils } from "../../utils/Utils.mjs";
import { MP4Fragment } from "./MP4Fragment.mjs";
import { MP4FragmentRequester } from "./MP4FragmentRequester.mjs";
import { SourceBufferWrapper } from "./SourceBufferWrapper.mjs";
const FRAGMENT_SIZE = 1000000;

export class MP4Player extends EventEmitter {
    constructor(client, config) {
        super();
        this.client = client;

        this.isPreview = config?.isPreview || false;
        this.video = document.createElement("video");

        //  this.persistentCurrentTime = 0;

        this.mp4box = MP4Box.createFile(false);

        this.options = {
            backBufferLength: 10,
            maxFragmentsBuffered: 30,
            maxBufferLength: this.isPreview ? 10 : 30
        }

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
        let videoTrack = this.metaData.videoTracks[this.currentVideoTrack];
        if (videoTrack) {
            let videoCodec = 'video/mp4; codecs=\"' + videoTrack.codec + '\"';
            this.videoSourceBuffer = new SourceBufferWrapper(this.mediaSource, videoCodec);
        }

        let audioTrack = this.metaData.audioTracks[this.currentAudioTrack];
        if (audioTrack) {
            let audioCodec = 'audio/mp4; codecs=\"' + audioTrack.codec + '\"';
            this.audioSourceBuffer = new SourceBufferWrapper(this.mediaSource, audioCodec);
        }

    }

    freeSamples(id) {
       // return;
        let trak = this.mp4box.getTrackById(id);

        trak.samples_stored.forEach((sample) => {
            this.mp4box.releaseSample(trak, sample.number);
        });

        trak.samples_stored.length = 0;
    }

    setupHLS() {
        this.removeSourceBuffers();
        this.makeSourceBuffers();

        this.mp4box.fragmentedTracks.length = 0;

        let videoTrack = this.metaData.videoTracks[this.currentVideoTrack];
        let audioTrack = this.metaData.audioTracks[this.currentAudioTrack];

        this.mp4box.onSegment = (id, user, buffer, sampleNumber, last) => {

           // console.log(id, sampleNumber)
            if (videoTrack.id === id) {
                this.videoSourceBuffer.appendBuffer(buffer);

                this.freeSamples(id)
            } else if (audioTrack.id === id) {
                this.audioSourceBuffer.appendBuffer(buffer);

                this.freeSamples(id)
            } else {
                throw new Error("Unknown track id");
            }



        }

        if (videoTrack) {

            this.mp4box.setSegmentOptions(videoTrack.id, 1, {
                nbSamples: 1
            });
        }

        if (audioTrack) {
            this.mp4box.setSegmentOptions(audioTrack.id, 1, {
                nbSamples: 1
            });
        }


        let initSegs = this.mp4box.initializeSegmentation();

        let ind = 0;
        if (videoTrack) {
            this.videoSourceBuffer.appendBuffer(initSegs[ind++].buffer);
        }

        if (audioTrack) {
            this.audioSourceBuffer.appendBuffer(initSegs[ind++].buffer);
        }


        this.mp4box.seek(this.currentTime)
        this.mp4box.start();
    }


    async setup() {
        return new Promise((resolve, reject) => {
            let pre_events = new EventEmitter();

            pre_events.on(DefaultPlayerEvents.DURATIONCHANGE, () => {
                return EmitterCancel;
            })

            let emitter_relay = new EmitterRelay([pre_events, this]);
            Utils.addPassthroughEventListenersToVideo(this.video, emitter_relay);

            this.mp4box.onReady = (info) => {
                this.onMetadataParsed(info);

            }

            this.mp4box.onError = (error) => {
                console.error("onError", error);
                this.running = false;
            }

            this.mediaSource = new MediaSource();
            this.mediaSourceURL = URL.createObjectURL(this.mediaSource);
            this.mediaSource.addEventListener("sourceopen", () => {
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
        console.log("onReady", info);
        this.metaData = info;

        if (info.isFragmented) {
            this.mediaSource.duration = info.fragment_duration / info.timescale;
        } else {
            this.mediaSource.duration = info.duration / info.timescale;
        }

        let max = Math.ceil(this.fileLength / FRAGMENT_SIZE);
        // for (let l = 0; l < info.videoTracks.length; l++) {
        let l = this.currentVideoTrack;
        for (let i = 0; i < max; i++) {
            if (!this.client.getFragment(l, i)) {
                this.client.makeFragment(l, i, new MP4Fragment(l, i, this.source, i * FRAGMENT_SIZE, Math.min((i + 1) * FRAGMENT_SIZE, this.fileLength)));
            }
        }
        let trak = this.mp4box.moov.traks.find((trak) => {
            return trak.tkhd.track_id == info.videoTracks[l].id;
        });
        let samples = trak.samples
        this.videoTracks.push({
            trak,
            track: info.videoTracks[l],
            samples: samples,
            sortedSamples: this.sortSamples(samples)
        })
        //  }

        for (let l = 0; l < info.audioTracks.length; l++) {
            let trak = this.mp4box.moov.traks.find((trak) => {
                return trak.tkhd.track_id == info.audioTracks[l].id;
            });
            let samples = trak.samples
            this.audioTracks.push({
                trak,
                track: info.audioTracks[l],
                samples: samples,
                sortedSamples: this.sortSamples(samples)
            })
        }

        this.setFragmentTimes();


        this.emit(DefaultPlayerEvents.MANIFEST_PARSED, 0);
        this.emit(DefaultPlayerEvents.DURATIONCHANGE);
        this.setupHLS();
    }

    getVideos() {
        return [this.video];
    }
    getCurrentVideo() {
        return this.video;
    }


    async setSource(source) {
        if (this.source) {
            throw new Error("Source already set");
        }

        this.source = source;

        if (!this.client.getFragment(0, 0))
            this.client.makeFragment(0, 0, new MP4Fragment(0, 0, source, 0, FRAGMENT_SIZE));

        this.running = true;
        this.mainLoop();

    }

    mainLoop() {
        if (!this.running) {
            return;
        }


        this.runLoad();
        this.loopTimeout = setTimeout(this.mainLoop.bind(this), 1);
    }

    initializeFragments() {
        let max = Math.ceil(this.fileLength / FRAGMENT_SIZE);
        for (let i = 1; i < max; i++) {
            if (!this.client.getFragment(0, i)) {
                this.client.makeFragment(0, i, new MP4Fragment(0, i, this.source, i * FRAGMENT_SIZE, Math.min((i + 1) * FRAGMENT_SIZE, this.fileLength)));
            }

        }


    }

    setFragmentTimes() {
        let levels = this.levels;
        for (let l = 0; l < levels.length; l++) {
            let frags = this.client.getFragments(l);
            let currentFragment = frags[0]
            currentFragment.start = 0;
            for (let i = 1; i < frags.length; i++) {
                let frag = frags[i];
                let dt = this.getMinTimeFromOffset(this.videoTracks[l].samples, frag.rangeStart, frag.rangeEnd);
                if (dt !== null) {
                    let time = Math.floor(dt);
                    currentFragment.end = time;
                    currentFragment.duration = time - currentFragment.start;
                    frag.start = time;
                    currentFragment = frag;
                }
            }

            currentFragment.end = Math.ceil(this.metaData.duration / this.metaData.timescale);
            currentFragment.duration = currentFragment.end - currentFragment.start;
        }
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

        let currentFragment = this.currentFragment;

        if (!currentFragment) {
            this.running = false;
            throw new Error("No current fragment");

        }
        let frags = this.client.getFragments(this.currentVideoTrack) || [];

        let time = this.video.currentTime;
        for (let i = 0; i < this.currentFragments.length; i++) {
            let frag = this.currentFragments[i];
            if (frag.sn >= currentFragment.sn) continue;

            if (frag.end < time - this.options.backBufferLength) {
                this.currentFragments.splice(i, 1);
                frag.removeReference();
                i--;
            }
        }

        this.removeFromBuffers(0, Math.min(time - this.options.backBufferLength - 1, currentFragment.start));

        let len = frags.length;
        for (let i = currentFragment.sn; i < Math.min(currentFragment.sn + this.options.maxFragmentsBuffered, len); i++) {
            let frag = this.client.getFragment(this.currentVideoTrack, i);
            if (!frag) {
                this.running = false;
                throw new Error("No next fragment");
            }

            if (i !== currentFragment.sn && frag.start > this.video.currentTime + this.options.maxBufferLength) {
                break;
            }


            if (!this.currentFragments.includes(frag)) {
                const loader = this.loader = this.fragmentRequester.requestFragment(frag, {
                    onSuccess: (entry, data) => {
                        if (this.loader === loader)
                            this.loader = null;
                        else return;

                        if (!this.fileLength) {
                            let rangeHeader = entry.responseHeaders["content-range"];
                            if (!rangeHeader) {
                                console.log(entry.responseHeaders);
                                this.running = false;
                                throw new Error("No content length");
                            }

                            this.fileLength = parseInt(rangeHeader.split("/")[1]);

                            this.initializeFragments();

                        }
                        //console.log("append", frag)
                        this.mp4box.appendBuffer(data);
                        this.currentFragments.push(frag);
                        frag.addReference();
                        this.runLoad();
                    },
                    onProgress: (stats, context, data, xhr) => {

                    },
                    onFail: (entry) => {
                        if (this.loader === loader)
                            this.loader = null;
                        else return;
                    },
                    onAbort: (entry) => {
                        if (this.loader === loader)
                            this.loader = null;
                        else return;
                    }

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
            }

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

        this.metaData.tracks.forEach(track => {
            this.freeSamples(track.id);
        });
        if (this.loader) {
            this.loader.abort();
            this.loader = null;
        }

        this.currentFragments.forEach(frag => {
            frag.removeReference();
        });

        this.currentFragments.length = 0;
        this.mp4box.seek(this.currentTime, true);
        if (!noLoad) this.runLoad();
    }

    isBuffered(time) {
        if (this.video.buffered.length === 0) return false;

        if (this.video.buffered.length > 1) {
            console.log("More than one buffered range", this.video.buffered);
        }

        let buffered = this.video.buffered;
        let currentTime = time;
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
        if (!this.metaData) return [];
        let track = this.metaData.videoTracks[0]

        return [{
            bitrate: track.bitrate,
            width: track.track_width,
            height: track.track_height,
            language: track.language
        }];
    }

    get currentLevel() {
        return this.currentVideoTrack;
    }

    set currentLevel(value) {

    }

    get duration() {
        if (!this.metaData) return 0;
        return this.metaData.duration / this.metaData.timescale;
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

            let time = this.currentTime;
            var seek_offset = Infinity;
            let sortedSamples = [];
            if (this.videoTracks[this.currentVideoTrack]) {
                sortedSamples.push(this.videoTracks[this.currentVideoTrack].sortedSamples);
            }

            if (this.audioTracks[this.currentAudioTrack]) {
                sortedSamples.push(this.audioTracks[this.currentAudioTrack].sortedSamples);
            }
            for (var i = 0; i < sortedSamples.length; i++) {
                var samples = sortedSamples[i];
                let offset = this.getFragmentOffset(samples, time)
                if (offset < seek_offset) {
                    seek_offset = offset;
                }
            }
            startOffset = seek_offset;
        }


        let index = Math.floor(startOffset / FRAGMENT_SIZE);

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
        let frags = this.client.getFragments(this.currentLevel);
        if (!frags) {
            return {
                canSave: false,
                isComplete: false
            }
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
            isComplete: !incomplete
        }
    }

    async getSaveBlob(options) {
        let frags = this.client.getFragments(this.currentVideoTrack);
        let emptyTemplate = BlobManager.createBlob([new ArrayBuffer(FRAGMENT_SIZE)], "application/octet-stream");

        let files = [];
        let lastFrag = 0;
        for (let i = frags.length - 1; i >= 0; i--) {
            let frag = frags[i];
            if (frag.status === DownloadStatus.DOWNLOAD_COMPLETE) {
                lastFrag = i + 1;
                break;
            }
        }
        for (let i = 0; i < lastFrag; i++) {
            let frag = frags[i];
            if (frag.status === DownloadStatus.DOWNLOAD_COMPLETE) {
                let entry = this.client.downloadManager.getEntry(frag.getContext());
                if (entry.getData()) {
                    files.push(entry.getData());
                } else {
                    throw new Error("No data for fragment");
                }
            } else {
                files.push(emptyTemplate);
            }
        }

        return {
            extension: "mp4",
            blob: BlobManager.createBlob(files, "video/mp4")
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
}
