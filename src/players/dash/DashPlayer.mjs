import { DashJS } from "../../modules/dash.mjs";
import { EmitterRelay, EventEmitter } from "../../modules/eventemitter.mjs";
import { Utils } from "../../utils/Utils.mjs";

export class DashPlayer extends EventEmitter {
    constructor(options) {
        super();
        this.video = document.createElement('video');
        this.isPreview = options?.isPreview || false;
    }

    async setup() {
        this.dash = DashJS.MediaPlayer().create();

        let pre_events = new EventEmitter();
        let emitter_relay = new EmitterRelay([pre_events, this]);
        Utils.addPassthroughEventListenersToVideo(this.video, emitter_relay);

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

    }

    get currentLevel() {
        return this.currentVideoTrack;
    }

    set currentLevel(value) {

    }

    get duration() {
        return this.video.duration
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