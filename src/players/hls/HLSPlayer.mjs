import { DefaultPlayerEvents } from "../../enums/DefaultPlayerEvents.mjs";
import { DownloadStatus } from "../../enums/DownloadStatus.mjs";
import { EmitterRelay, EventEmitter } from "../../modules/eventemitter.mjs";
import { Hls } from "../../modules/hls.mjs";
import { HLS2MP4 } from "../../modules/hls2mp4/hls2mp4.mjs";
import { Utils } from "../../utils/Utils.mjs";
import { HLSFragment } from "./HLSFragment.mjs";
import { HLSFragmentRequester } from "./HLSFragmentRequester.mjs";
import { HLSLoaderFactory } from "./HLSLoader.mjs";


export class HLSPlayer extends EventEmitter {
    constructor(client, config) {
        super();
        this.client = client;
        this.isPreview = config?.isPreview || false;
        this.source = null;
        this.fragmentRequester = new HLSFragmentRequester(this);
        this.video = document.createElement("video");
        if (!Hls.isSupported()) {
            throw new Error("HLS Not supported")
        }

        this.hls = new Hls({
            autoStartLoad: false,
            startPosition: -1,
            debug: false,
            capLevelOnFPSDrop: false,
            capLevelToPlayerSize: true,
            defaultAudioCodec: undefined,
            initialLiveManifestSize: 1,
            maxBufferLength: 1,
            maxMaxBufferLength: 1,
            backBufferLength: 0,
            maxBufferSize: 0,
            maxBufferHole: 0.5,
            highBufferWatchdogPeriod: 2,
            nudgeOffset: 0.1,
            nudgeMaxRetry: 3,
            maxFragLookUpTolerance: 0.25,
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: Infinity,
            liveDurationInfinity: false,
            enableWorker: true,
            enableSoftwareAES: true,
            manifestLoadingTimeOut: 10000,
            manifestLoadingMaxRetry: 1,
            manifestLoadingRetryDelay: 1000,
            manifestLoadingMaxRetryTimeout: 64000,
            startLevel: 5,
            levelLoadingTimeOut: 10000,
            levelLoadingMaxRetry: 4,
            levelLoadingRetryDelay: 1000,
            levelLoadingMaxRetryTimeout: 64000,
            fragLoadingTimeOut: 20000,
            fragLoadingMaxRetry: 6,
            fragLoadingRetryDelay: 1000,
            fragLoadingMaxRetryTimeout: 64000,
            startFragPrefetch: false,
            testBandwidth: false,
            progressive: false,
            lowLatencyMode: false,
            fpsDroppedMonitoringPeriod: 5000,
            fpsDroppedMonitoringThreshold: 0.2,
            appendErrorMaxRetry: 3,
            loader: HLSLoaderFactory(this),
            //loader: XHRTestLoader,
            // xhrSetup: XMLHttpRequestSetupCallback,
            // fetchSetup: FetchSetupCallback,
            // abrController: AbrController,
            // bufferController: BufferController,
            // capLevelController: CapLevelController,
            // fpsController: FPSController,
            // timelineController: TimelineController,
            enableDateRangeMetadataCues: true,
            enableEmsgMetadataCues: true,
            enableID3MetadataCues: true,
            enableWebVTT: true,
            enableIMSC1: true,
            enableCEA708Captions: true,
            stretchShortVideoTrack: false,
            maxAudioFramesDrift: 1,
            forceKeyFrameOnDiscontinuity: true,
            abrEwmaFastLive: 3.0,
            abrEwmaSlowLive: 9.0,
            abrEwmaFastVoD: 3.0,
            abrEwmaSlowVoD: 9.0,
            abrEwmaDefaultEstimate: 5000000,
            abrBandWidthFactor: 0.95,
            abrBandWidthUpFactor: 0.7,
            abrMaxWithRealBitrate: false,
            maxStarvationDelay: 4,
            maxLoadingDelay: 4,
            minAutoBitrate: 0,
            emeEnabled: false,
            licenseXhrSetup: undefined,
            drmSystems: {},
            drmSystemOptions: {},
            // requestMediaKeySystemAccessFunc: requestMediaKeySystemAccess,
            cmcd: undefined,
        });


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
            canSave: this.readyState >= 3,
            isComplete: !incomplete
        }
    }

    async getSaveBlob(options) {
        let hls2mp4 = new HLS2MP4();

        hls2mp4.on("progress", (progress) => {
            if (options?.onProgress) {
                options.onProgress(progress);
            }
        })
        let frags = [];
        this.client.getFragments(this.currentLevel).map((f) => {
            if (f.status === DownloadStatus.DOWNLOAD_COMPLETE) {
                frags.push({
                    fragment: f,
                    entry: this.client.downloadManager.getEntry(f.getContext())
                });
            }
        })
        let blob = await hls2mp4.convert(this.hls.levels[this.currentLevel], frags);

        return {
            extension: "mp4",
            blob: blob
        }
    }

    load() {
        this.hls.startLoad();
    }

    getClient() {
        return this.client;
    }



    async setup() {

        this.hls.attachMedia(this.video);

        await new Promise((resolve, reject) => {
            this.hls.on(Hls.Events.MEDIA_ATTACHED, function () {
                resolve();
            })
        });

        let pre_events = new EventEmitter();
        let emitter_relay = new EmitterRelay([pre_events, this]);
        Utils.addPassthroughEventListenersToVideo(this.video, emitter_relay);


        this.hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
            this.emit(DefaultPlayerEvents.MANIFEST_PARSED, this.hls.maxAutoLevel);
        });


        this.hls.on(Hls.Events.LEVEL_UPDATED, (a, data) => {

            let time = 0;
            data.details.fragments.forEach((fragment) => {

                if (fragment.encrypted) {
                    fragment.fs_oldcryptdata = fragment.decryptdata;
                    fragment.fs_oldlevelKeys = fragment.levelkeys;

                    fragment.levelkeys = null;
                    fragment._decryptdata = null;

                    void fragment.decryptdata;
                }
                let start = time;
                time += fragment.duration;
                let end = time;
                if (!this.client.getFragment(fragment.level, fragment.sn))
                    this.client.makeFragment(fragment.level, fragment.sn, new HLSFragment(fragment, start, end));
            })


        });

    }

    getVideos() {
        return [this.video];
    }
    getCurrentVideo() {
        return this.video;
    }


    async setSource(source) {
        this.source = source;
        this.hls.loadSource(source.url);
    }

    downloadFragment(fragment) {
        this.fragmentRequester.requestFragment(fragment, {
            onProgress: (e) => {

            },
            onSuccess: (e) => {

            },
            onFail: (e) => {

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
        this.fragmentRequester.destroy();
        this.hls.destroy();
        this.emit(DefaultPlayerEvents.DESTROYED);
    }

    set currentTime(value) {
        this.video.currentTime = value;
    }

    get currentTime() {
        return this.video.currentTime;
    }

    get readyState() {
        return this.video.readyState;
    }

    get paused() {
        return this.video.paused
    }

    get levels() {
        return this.hls.levels.map((level) => {
            return {
                width: level.width,
                height: level.height,
                bitrate: level.bitrate
            }
        })
    }

    get currentLevel() {
        return this.hls.currentLevel;
    }

    set currentLevel(value) {
        this.hls.currentLevel = value;
    }

    get duration() {
        return this.video.duration;
    }

    get currentFragment() {
        if (!this.hls.streamController.currentFrag) return null;
        return this.client.getFragment(this.hls.streamController.currentFrag.level, this.hls.streamController.currentFrag.sn);
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