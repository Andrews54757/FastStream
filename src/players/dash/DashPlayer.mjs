import { DefaultPlayerEvents } from "../../enums/DefaultPlayerEvents.mjs";
import { DashJS } from "../../modules/dash.mjs";
import { EmitterRelay, EventEmitter } from "../../modules/eventemitter.mjs";
import { Utils } from "../../utils/Utils.mjs";
import { DashFragment } from "./DashFragment.mjs";
import { DashFragmentRequester } from "./DashFragmentRequester.mjs";
import { DASHLoaderFactory } from "./DashLoader.mjs";

export class DashPlayer extends EventEmitter {
    constructor(client, options) {
        super();
        this.client = client;
        this.video = document.createElement('video');
        this.isPreview = options?.isPreview || false;

        this.fragmentRequester = new DashFragmentRequester(this);
    }

    async setup() {
        this.dash = DashJS.MediaPlayer().create();

        let pre_events = new EventEmitter();
        let emitter_relay = new EmitterRelay([pre_events, this]);
        Utils.addPassthroughEventListenersToVideo(this.video, emitter_relay);

        this.dash.updateSettings({
            streaming: {
                abr: {
                    autoSwitchBitrate: { audio: false, video: false },
                },
                buffer: {
                    bufferToKeep: 10,
                    bufferTimeAtTopQuality: 10,
                    bufferTimeAtTopQualityLongForm: 10
    
                }
            }
        });

        this.dash.on("initComplete" ,(a)=>{
            a.streamProcessors.forEach((processor)=>{
                const mediaInfo = processor.getMediaInfo();
                const segmentsController = processor.getSegmentsController();
                const dashHandler = processor.getDashHandler();
                mediaInfo.representations.forEach((rep)=>{
                    let index = 0;
                    const init = dashHandler.getInitRequest(mediaInfo, rep);
                    if (init) {
                        init.level = mediaInfo.index + ":" + rep.index;
                        init.index = -1;
                        init.startTime = init.duration = 0;
                        this.client.makeFragment(init.level, -1, new DashFragment(init));
                    }
                    while (true) {
                        let segment = segmentsController.getSegmentByIndex(rep,index,-1);
                        if (!segment) break;
                        const request = dashHandler._getRequestForSegment(mediaInfo, segment)
                        request.level = mediaInfo.index + ":" + rep.index;
                        const fragment = new DashFragment(request);
                        if (!this.client.getFragment(fragment.level, fragment.sn))
                            this.client.makeFragment(fragment.level, fragment.sn, fragment);
                        index++;
                    }
                });
            })

            let max = 0;
            let maxLevel = null;
            
            // Get best quality but within screen resolution
            this.levels.forEach((level, key)=>{
                if (level.bitrate > max) {
                    if (level.width > window.innerWidth * window.devicePixelRatio * 2 || level.height > window.innerHeight * window.devicePixelRatio * 2) return;
                    max = level.bitrate;
                    maxLevel = key;
                }
            });


            this.emit(DefaultPlayerEvents.MANIFEST_PARSED, maxLevel, this.currentAudioLevel);
        })

        // for (let eventName in dashjs.MediaPlayer.events) {
        //     let event = dashjs.MediaPlayer.events[eventName];
        //     let test = (() => {
        //         this.dash.on(event, (e) => {
        //             console.log(event, e,  this.dash.getTracksFor("audio"))
        //         });
        //     })(event)
        // }
        this.dash.extend("XHRLoader", DASHLoaderFactory(this) , false)
    }


    load() {

    }

    getClient() {
        return this.client;
    }




    getVideos() {
        return [this.video];
    }
    getCurrentVideo() {
        return this.video;
    }


    async setSource(source) {
        this.source = source;
        this.dash.initialize(this.video, this.source.url, false);
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
        this.dash.destroy();
        this.dash = null;
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
        return this.video.paused;
    }


    get levels() {
        const mediaInfo = this.dash.getStreamController().getActiveStream().getProcessors().find(o=>o.getType() == "video")?.getMediaInfo();
        if (!mediaInfo) {
            return new Map();
        }

        let result = new Map();

        mediaInfo.representations.map(rep=>{
            result.set(mediaInfo.index + ":" + rep.index, {
                bitrate: rep.bandwidth,
                height: rep.height,
                width: rep.width
            });
        });

        return result;

    }

    get currentLevel() {
        const processor = this.dash.getStreamController().getActiveStream().getProcessors().find(o=>o.getType() == "video");
        if (!processor) {
            return -1;
        }

        return processor.getMediaInfo().index + ":" + processor.getRepresentationController().getCurrentRepresentation().index;
    }

    set currentLevel(value) {
        this.dash.setQualityFor("video", parseInt(value.split(":")[1]));
    }

    get currentAudioLevel() {
        const processor = this.dash.getStreamController().getActiveStream().getProcessors().find(o=>o.getType() == "audio");
        if (!processor) {
            return -1;
        }

        return processor.getMediaInfo().index + ":" + processor.getRepresentationController().getCurrentRepresentation().index;
    }

    set currentAudioLevel(value) {
        this.dash.setQualityFor("audio", parseInt(value.split(":")[1]));
    }
    get duration() {
        return this.video.duration
    }


    get currentFragment() {
        let frags = this.client.fragments;
        if (!frags) return null;

        let index = Utils.binarySearch(frags, this.currentTime, (time, frag)=>{
            if (time < frag.start) return -1;
            if (time >= frag.end) return 1;
            return 0;
        });
        if (index == -1) return null;

        if (index < -1) index = -index - 2;
        return frags[index];
    }

    get currentAudioFragment() {
        let frags = this.client.audioFragments;
        if (!frags) return null;

        let index = Utils.binarySearch(frags, this.currentTime, (time, frag)=>{
            if (time < frag.start) return -1;
            if (time >= frag.end) return 1;
            return 0;
        });
        if (index == -1) return null;

        if (index < -1) index = -index - 2;
        return frags[index];
    }

    canSave() {


        return {
            canSave: false,
            isComplete: false
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