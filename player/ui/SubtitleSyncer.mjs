import { EventEmitter } from "../modules/eventemitter.mjs";
import { VadJS } from "../modules/vad/vad.mjs";
import { WebVTT } from "../modules/vtt.mjs";
import { DOMElements } from "./DOMElements.mjs";
import { Utils } from "../utils/Utils.mjs";

export class SubtitleSyncer extends EventEmitter {
    constructor(client) {
        super();
        this.client = client;
        this.buffer = [];
        this.trackToSync = null;
        this.options = {
            onFrameProcessed: (prob) => {
                this.onFrameProcessed(prob.isSpeech)
            },

            positiveSpeechThreshold: 1,
            negativeSpeechThreshold: 1,
            frameSamples: 1024

        }
        this.rate = 16000 / this.options.frameSamples;
        this.setup();
    }

    setup() {
        this.ui = {};
        this.ui.currentPosition = Utils.create("div", '', "current_position_bar");
        DOMElements.timelineSyncer.appendChild(this.ui.currentPosition);

        this.ui.timelineContainer = Utils.create("div", '', "timeline_container");
        DOMElements.timelineSyncer.appendChild(this.ui.timelineContainer);

        this.ui.timelineTicks = Utils.create("div", '', "timeline_ticks");
        this.ui.timelineContainer.appendChild(this.ui.timelineTicks);

        this.ui.timelineVOD = Utils.create("div", '', "timeline_vod");
        this.ui.timelineContainer.appendChild(this.ui.timelineVOD);

        this.ui.timelineTrack = Utils.create("div", '', "timeline_track");
        this.ui.timelineContainer.appendChild(this.ui.timelineTrack);

        // timeline is grabbable
        let isGrabbing = false;
        let grabStart = 0;
        let grabStartTime = 0;

        this.ui.timelineTicks.addEventListener("mousedown", (e) => {
            isGrabbing = true;
            grabStart = e.clientX;
            grabStartTime = this.video.currentTime;
            this.client.ignoreUpdateTime = true;

            if (this.client.persistent.playing) {
                this.client.player.pause();
            }
        });

        document.addEventListener("mouseup", (e) => {
            if (isGrabbing) {
                const delta = e.clientX - grabStart;
                const time = grabStartTime - (delta / this.ui.timelineTicks.clientWidth * this.video.duration);
                this.client.currentTime = time;
                this.client.updateTime(time); this.client.ignoreUpdateTime = false;

                if (this.client.persistent.playing) {
                    this.client.player.play();
                }
            }
            isGrabbing = false;
        });

        document.addEventListener("mousemove", (e) => {
            if (isGrabbing) {
                const delta = e.clientX - grabStart;
                const time = grabStartTime - (delta / this.ui.timelineTicks.clientWidth * this.video.duration);
                this.client.currentTime = time;
                this.client.updateTime(time);
            }
        });



        // track line is grabbable
        let isGrabbingTrack = false;
        let grabStartTrack = 0;

        this.ui.timelineTrack.addEventListener("mousedown", (e) => {
            isGrabbingTrack = true;
            grabStartTrack = e.clientX;
        });

        document.addEventListener("mouseup", () => {
            isGrabbingTrack = false;
        });

        document.addEventListener("mousemove", (e) => {
            if (isGrabbingTrack) {
                const delta = e.clientX - grabStartTrack;
                grabStartTrack = e.clientX;
                this.trackToSync.shift(delta / this.ui.timelineTicks.clientWidth * this.video.duration);
                this.client.subtitlesManager.renderSubtitles();
            }
        });
    }
    onFrameProcessed(isSpeechProb) {
        if (!this.started || this.video.readyState < 4 || this.video.paused) return;

        const time = this.video.currentTime;

        const frame = Math.floor(time * this.rate);
        this.buffer[frame] = isSpeechProb;
        this.buffer[frame + 1] = isSpeechProb;

        this.canvasElements.find((el) => {
            if (el.index * 10 <= time && (el.index + 1) * 10 > time) {
                el.update = true;
                return true;
            }
            return false;
        });
    }

    toggleTrack(track, removeOnly = false) {
        if (this.trackToSync === track) {
            this.trackToSync = null;
            this.stop();
        } else if (!removeOnly) {
            this.trackToSync = track;
            this.start(this.client.currentVideo);
            this.renderSyncTimeline();
        }

        return this.trackToSync
    }

    reset() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.audioSource = null;
        this.audioNodeVAD = null;
        this.buffer.length = 0;
        this.lastUpdate = 0;
        this.ticklineElements = [];
        this.canvasElements = [];
        this.trackElements = [];
        this.ui.timelineTicks.innerHTML = "";
        this.ui.timelineVOD.innerHTML = "";
        this.ui.timelineTrack.innerHTML = "";
    }

    async start(video) {
        if (this.started || !video) return;
        this.started = true;

        if (this.video !== video) {
            this.reset();
            this.video = video;
            this.audioContext = new AudioContext();
            this.audioSource = this.audioContext.createMediaElementSource(video);
            this.audioSource.connect(this.audioContext.destination);



            const frames = this.video.duration * this.rate;
            for (let i = 0; i <= frames; i++) {
                this.buffer.push(0);
            }

        }

        this.audioNodeVAD = await VadJS.AudioNodeVAD.new(this.audioContext, this.options);
        this.audioNodeVAD.receive(this.audioSource);
        this.audioNodeVAD.start();

        DOMElements.playerContainer.classList.add("expanded");
        this.client.interfaceController.runProgressLoop();
        this.renderSyncTimeline();
    }

    onVideoTimeUpdate() {
        if (!this.started) {
            return
        }
        this.renderSyncTimeline();

    }

    renderSyncTimeline() {
        if (!this.started) return;
        const time = this.client.persistent.currentTime;

        const timePerWidth = 60;
        const minTime = Math.floor(Math.max(0, time - timePerWidth / 2 - 5))
        const maxTime = Math.ceil(Math.min(this.video.duration, time + timePerWidth / 2 + 5));
        this.ui.timelineContainer.style.width = (this.video.duration / timePerWidth) * 100 + "%";


        let hasArr = new Array(maxTime - minTime).fill(false);

        this.ticklineElements = this.ticklineElements.filter((el) => {
            if (el.time < minTime || el.time > maxTime) {
                el.element.remove();
                return false;
            }

            hasArr[el.time - minTime] = true;
            return true;
        });

        for (let tickTime = minTime; tickTime < maxTime; tickTime++) {
            if (hasArr[tickTime - minTime]) continue;

            const el = Utils.create("div", '', "timeline_tick");
            el.style.left = tickTime / this.video.duration * 100 + "%";
            this.ui.timelineTicks.appendChild(el);
            this.ticklineElements.push({
                time: tickTime,
                element: el,
            });


            if (tickTime % 10 === 0) {
                const label = Utils.create("div", '', "timeline_tick_label");
                label.textContent = Utils.formatTime(tickTime);
                el.appendChild(label);

                if (tickTime % (60 * 60) === 0) {
                    el.classList.add("hour");
                } else if (tickTime % 60 === 0) {
                    el.classList.add("minute");
                } else {
                    el.classList.add("major");
                }
            } else if (tickTime % 5 === 0) {
                el.classList.add("major");
            }

        }

        const minCanvIndex = Math.floor(minTime / 10)
        const maxCanvIndex = Math.ceil(maxTime / 10);
        hasArr = new Array(maxCanvIndex - minCanvIndex).fill(false);
        this.canvasElements = this.canvasElements.filter((el) => {
            if (el.index < minCanvIndex || el.index > maxCanvIndex) {
                el.element.remove();
                return false;
            }
            hasArr[el.index - minCanvIndex] = true;
            return true;
        });

        for (let canvIndex = minCanvIndex; canvIndex < maxCanvIndex; canvIndex++) {
            if (hasArr[canvIndex - minCanvIndex]) continue;

            const el = Utils.create("canvas", '', "timeline_vod_canvas");
            el.style.left = canvIndex * 10 / this.video.duration * 100 + "%";
            el.style.width = 10 / this.video.duration * 100 + "%";
            el.height = 40;
            this.ui.timelineVOD.appendChild(el);

            this.canvasElements.push({
                index: canvIndex,
                element: el,
                ctx: el.getContext("2d"),
                update: true
            });
        }

        this.canvasElements.forEach((el) => {
            if (!el.update) return;
            el.update = false;
            const index = el.index;
            const time = index * 10;

            const startFrame = Math.floor(time * this.rate);
            const endFrame = Math.floor(Math.min(time + 10, this.video.duration) * this.rate);

            const context = el.ctx;
            el.element.width = el.element.clientWidth * 2;
            context.clearRect(0, 0, el.element.width, el.element.height);

            // Draw line using buffer
            context.beginPath();
            context.strokeStyle = "#fff";
            let val = (startFrame > 0) ? (1 - this.buffer[startFrame - 1]) : 1;
            context.moveTo(0, val * el.element.height);
            for (let i = startFrame; i < endFrame; i++) {
                val = 1 - this.buffer[i];

                context.lineTo((i - startFrame + 1) / (10 * this.rate) * el.element.width, val * el.element.height);

            }
            context.stroke();
        });

        this.ui.timelineContainer.style.transform = `translateX(${-(time - timePerWidth / 2) / this.video.duration * 100}%)`;


        let now = Date.now();
        if (now - this.lastUpdate >= 500) {
            this.lastUpdate = now;

            const cues = this.trackToSync.cues;
            this.visibleCues = cues.filter((cue) => {
                return cue.startTime <= maxTime || cue.endTime >= minTime;
            });
        }


        this.trackElements = this.trackElements.filter((el) => {
            if (!this.visibleCues.includes(el.cue)) {
                el.element.remove();
                return false;
            } else {
                el.element.style.left = el.cue.startTime / this.video.duration * 100 + "%";
            }
            return true;
        });

        this.visibleCues.forEach((cue) => {
            if (this.trackElements.find((el) => el.cue === cue)) return;

            const el = Utils.create("div", '', "timeline_track_cue");
            el.style.left = cue.startTime / this.video.duration * 100 + "%";
            el.style.width = (cue.endTime - cue.startTime) / this.video.duration * 100 + "%";
            el.appendChild(WebVTT.convertCueToDOMTree(window, cue.text));
            el.title = cue.text;
            this.ui.timelineTrack.appendChild(el);

            this.trackElements.push({
                cue,
                element: el
            });
        });
    }

    async stop() {
        if (!this.started) return;
        this.started = false;
        this.audioNodeVAD.stop();
        this.audioSource.disconnect();
        this.audioSource.connect(this.audioContext.destination);
        this.audioNodeVAD = null;

        this.client.interfaceController.durationChanged();
        DOMElements.playerContainer.classList.remove("expanded");
    }
}