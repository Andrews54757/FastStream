import { DefaultPlayerEvents } from "../enums/DefaultPlayerEvents.mjs";
import { EmitterRelay, EventEmitter } from "../modules/eventemitter.mjs";
import { Utils } from "../utils/Utils.mjs";

export class DirectVideoPlayer extends EventEmitter {
    constructor(client, config) {
        super();
        this.client = client;

        this.video = document.createElement("video");


    }


    load() {

    }

    getClient() {
        return this.client;
    }


    async setup() {
        let pre_events = new EventEmitter();
        let emitter_relay = new EmitterRelay([pre_events, this]);
        Utils.addPassthroughEventListenersToVideo(this.video, emitter_relay);
    }


    getVideos() {
        return [this.video];
    }
    getCurrentVideo() {
        return this.video;
    }


    async setSource(source) {
        this.source = source;
        this.video.src = source.url;
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

        this.video.src = "";

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
        return [];
    }

    get currentLevel() {
        return -1;
    }

    set currentLevel(value) {

    }

    get duration() {

        return this.video.duration;
    }


    get currentFragment() {
        return null;
    }

    canSave() {

        return {
            canSave: false,
            isComplete: true
        }
    }

    async getSaveBlob(options) {


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
