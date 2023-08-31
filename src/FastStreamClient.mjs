import { InterfaceController } from "./ui/InterfaceController.mjs";
import { PlayerModes } from "./enums/PlayerModes.mjs";
import { KeybindManager } from "./ui/KeybindManager.mjs";
import { HLSPlayer } from "./players/hls/HLSPlayer.mjs";
import { DownloadManager } from "./network/DownloadManager.mjs";
import { DefaultPlayerEvents } from "./enums/DefaultPlayerEvents.mjs";
import { DownloadStatus } from "./enums/DownloadStatus.mjs";
import { SubtitlesManager } from "./ui/SubtitlesManager.mjs";
import { VideoAnalyzer } from "./analyzer/VideoAnalyzer.mjs";
import { AnalyzerEvents } from "./enums/AnalyzerEvents.mjs";
import { MP4Player } from "./players/mp4/MP4Player.mjs";

import { DashPlayer } from "./players/dash/DashPlayer.mjs";
import { YTPlayer } from "./players/yt/YTPlayer.mjs";
import { DirectVideoPlayer } from "./players/DirectVideoPlayer.mjs";
import { EventEmitter } from "./modules/eventemitter.mjs";
import { SourcesBrowser } from "./ui/SourcesBrowser.mjs";


export class FastStreamClient extends EventEmitter {
    constructor() {
        super();
        this.options = {
            introCutoff: 5 * 60,
            outroCutoff: 5 * 60,
            bufferAhead: 60,
            bufferBehind: 20,
            freeFragments: true,
            downloadAll: false
        }
        this.persistent = {
            playing: false,
            buffering: false,
            currentTime: 0,
            volume: 1,
            muted: false,
            latestVolume: 1,
            duration: 0,
            currentLevel: -1,
            playbackRate: 1,
            levels: []
        }

        this.interfaceController = new InterfaceController(this);
        this.keybindManager = new KeybindManager(this);
        this.downloadManager = new DownloadManager(this);
        this.subtitlesManager = new SubtitlesManager(this);
        this.sourcesBrowser = new SourcesBrowser(this);
        this.videoAnalyzer = new VideoAnalyzer(this);
        this.videoAnalyzer.on(AnalyzerEvents.MATCH, () => {
            this.interfaceController.updateIntroOutroBar();
        });

        this.ignoreUpdateTime = false;
        this.player = null;
        this.previewPlayer = null;
        this.saveSeek = true;
        this.seeks = [];
        this.fragmentsStore = [];
        this.mainloop();
    }

    cantDownloadAll() {
        this.options.downloadAll = false;
        this.options.cantDownloadAll = true;
    }

    setSeekSave(value) {
        this.saveSeek = value;
    }

    resetFailed() {
        this.fragmentsStore.forEach((level) => {
            level.forEach((fragment) => {
                if (fragment.status === DownloadStatus.DOWNLOAD_FAILED) {
                    fragment.status = DownloadStatus.WAITING;
                }
            });
        });
    }

    destroy() {
        this.destroyed = true;
        this.resetPlayer();
        this.downloadManager.destroy();
        this.videoAnalyzer.destroy();
        this.interfaceController.destroy();
    }

    setOptions(options) {
        this.options.analyzeVideos = options.analyzeVideos;
        if (!this.options.cantDownloadAll)
            this.options.downloadAll = options.downloadAll;
    }

    loadAnalyzerData(data) {

        if (data) this.videoAnalyzer.loadAnalyzerData(data);
    }

    clearSubtitles() {
        this.subtitlesManager.clearTracks();
    }

    loadSubtitleTrack(subtitleTrack) {
        this.subtitlesManager.addTrack(subtitleTrack);
    }
    updateDuration(duration) {
        this.persistent.duration = duration;
        this.interfaceController.durationChanged();
    }

    updateTime(time) {
        this.persistent.currentTime = time;
        this.interfaceController.updateProgress();
        this.subtitlesManager.renderSubtitles();
        this.interfaceController.updateIntroOutroBar()
    }


    seekPreview(time) {
        if (this.previewPlayer) {
            this.previewPlayer.currentTime = time;
        }
    }
    updateQualityLevels() {
        this.persistent.levels = this.player.levels;
        this.interfaceController.updateQualityLevels();
    }

    async addSource(source, setSource = false) {
        console.log("addSource", source)
        this.sourcesBrowser.addSource(source);
        if (setSource) {
            await this.setSource(source);
        }
        this.sourcesBrowser.updateSources();
        return source;
    }


    async setSource(source) {
        console.log("setSource", source)
        this.resetPlayer();
        this.source = source;



        switch (source.mode) {
            case PlayerModes.DIRECT:
                this.player = new DirectVideoPlayer(this);
                this.previewPlayer = new DirectVideoPlayer(this);

                await this.player.setup();
                await this.previewPlayer.setup();

                break;
            case PlayerModes.ACCELERATED_HLS:
                this.player = new HLSPlayer(this);
                await this.player.setup();

                this.previewPlayer = new HLSPlayer(this, {
                    isPreview: true
                });
                await this.previewPlayer.setup();
                break;

            case PlayerModes.ACCELERATED_MP4:
                this.player = new MP4Player(this);
                await this.player.setup();

                this.previewPlayer = new MP4Player(this, {
                    isPreview: true
                });
                await this.previewPlayer.setup();
                break;
            case PlayerModes.ACCELERATED_DASH:
                this.player = new DashPlayer(this);
                await this.player.setup();

                break;
            case PlayerModes.YT:
                this.player = new YTPlayer(this);
                await this.player.setup();
                break;
        }

        this.bindPlayer(this.player);


        this.player.volume = this.persistent.volume;
        this.player.playbackRate = this.persistent.playbackRate;

        await this.player.setSource(source);

        this.player.getVideos().forEach((video) => {
            this.interfaceController.addVideo(video);
        });

        this.setSeekSave(false);
        this.currentTime = 0;
        this.setSeekSave(true);

        if (this.previewPlayer) {
            await this.previewPlayer.setSource(source);
            this.previewPlayer.getVideos().forEach((video) => {
                this.interfaceController.addPreviewVideo(video);
            });
        }
        await this.videoAnalyzer.setSource(source);
    //    this.subtitleSyncer.start(this.player.getCurrentVideo());
    }



    getNextToDownload(currentFragment) {
        if (!currentFragment) {
            return null;
        }

        if (currentFragment.level !== this.currentLevel) {
            return null;
        }

        let index = currentFragment.sn;

        let nextItem = this.getNextForward(index) || this.getNextBackward(index);

        return nextItem;
    }


    getNextForward(index) {
        let fragments = this.fragments;
        for (let i = index; i < fragments.length; i++) {
            let fragment = fragments[i];
            if (fragment && fragment.status === DownloadStatus.WAITING) {
                return fragment;
            }
        }

    }

    getNextBackward(index) {
        let fragments = this.fragments;
        for (let i = index - 1; i >= 0; i--) {
            let fragment = fragments[i];
            if (fragment && fragment.status === DownloadStatus.WAITING) {
                return fragment;
            }
        }
    }

    mainloop() {
        if (this.destroyed) return;
        setTimeout(this.mainloop.bind(this), 1000);

        if (this.player && this.fragments && this.currentLevel !== -1) {
            let hasDownloaded = this.predownloadFragments();
            if (!hasDownloaded && this.videoAnalyzer.isRunning()) {
                this.predownloadReservedFragments();
            }
            if (!this.options.downloadAll)
                this.freeFragments();
            this.interfaceController.updateFragmentsLoaded();
        }

        // Detect buffering
        if (this.player && this.persistent.playing) {
            let time = this.currentTime;
            if (time === this.lastTime) {
                this.interfaceController.setBuffering(true);
            } else {
                this.interfaceController.setBuffering(false);
            }
            this.lastTime = time;
        }

        this.videoAnalyzer.update();
        this.videoAnalyzer.saveAnalyzerData()

    }


    predownloadFragments() {
        let currentFragment = this.currentFragment;
        let nextDownload = this.getNextToDownload(currentFragment);
        let hasDownloaded = false;
        while (nextDownload) {

            if (nextDownload.canFree() && !this.options.downloadAll) {
                if (nextDownload.start > this.persistent.currentTime + this.options.bufferAhead) {
                    break;
                }

                if (nextDownload.end < this.persistent.currentTime - this.options.bufferBehind) {
                    break;
                }
            }

            if (!this.downloadManager.canGetFile(nextDownload.getContext())) {
                break;
            }

            hasDownloaded = true;
            this.player.downloadFragment(nextDownload);
            nextDownload = this.getNextToDownload(currentFragment);
        }

        return hasDownloaded;
    }

    predownloadReservedFragments() {
        let fragments = this.fragments;
        for (let i = 0; i < fragments.length; i++) {
            let fragment = fragments[i];
            if (fragment && fragment.status === DownloadStatus.WAITING && !fragment.canFree()) {
                if (!this.downloadManager.canGetFile(fragment.getContext())) {
                    break;
                }
                this.player.downloadFragment(fragment);
            }
        }
    }

    freeFragments() {
        let fragments = this.fragments;
        for (let i = 0; i < fragments.length; i++) {
            let fragment = fragments[i];
            if (fragment && fragment.status === DownloadStatus.DOWNLOAD_COMPLETE && fragment.canFree()) {
                if (fragment.end < this.persistent.currentTime - this.options.bufferBehind || fragment.start > this.persistent.currentTime + this.options.bufferAhead) {
                    this.freeFragment(fragment);
                }
            }
        }
    }

    freeFragment(fragment) {
        this.downloadManager.removeFile(fragment.getContext());
        fragment.status = DownloadStatus.WAITING;
    }

    getFragment(level, sn) {
        if (!this.fragmentsStore[level]) {
            return null;
        }
        return this.fragmentsStore[level][sn];
    }

    makeFragment(level, sn, frag) {
        if (!this.fragmentsStore[level]) {
            this.fragmentsStore[level] = [];
        }

        this.fragmentsStore[level][sn] = frag
    }

    resetPlayer() {
        this.lastTime = 0;

        this.fragmentsStore.length = 0;
        this.seeks.length = 0;
        if (this.context) {
            this.context.destroy();
            this.context = null;
        }

        if (this.player) {
            this.player.destroy();
            this.player = null;
        }

        if (this.source) {
            this.source.destroy();
            this.source = null;
        }

        if (this.previewPlayer) {
            this.previewPlayer.destroy();
            this.previewPlayer = null;
        }

        this.downloadManager.reset();
        this.interfaceController.reset();
        this.subtitlesManager.clearTracks();

        this.persistent.currentLevel = -1;
        this.persistent.buffering = false;
        this.persistent.levels = [];
        this.ignoreUpdateTime = false;


    }

    debugstuff() {
        let res = [];
        this.fragmentsStore[this.currentLevel].forEach((fragment) => {
            let entry = this.downloadManager.getEntry(fragment.getContext());
            res.push(entry.data.size)
        });
        console.log(res.join('\n'));
    }

    bindPlayer() {



        this.context = this.player.createContext();



        this.context.on(DefaultPlayerEvents.MANIFEST_PARSED, (maxLevel) => {
            this.currentLevel = maxLevel;
            this.player.load();
            if (this.previewPlayer) {
                this.previewPlayer.load();
            }
        });

        this.context.on(DefaultPlayerEvents.ABORT, (event) => {

        })

        this.context.on(DefaultPlayerEvents.CANPLAY, (event) => {

        })

        this.context.on(DefaultPlayerEvents.CANPLAYTHROUGH, (event) => {

        })

        this.context.on(DefaultPlayerEvents.COMPLETE, (event) => {

        })

        this.context.on(DefaultPlayerEvents.DURATIONCHANGE, (event) => {
            this.updateDuration(this.duration);
            this.interfaceController.updateFragmentsLoaded();
        })

        this.context.on(DefaultPlayerEvents.EMPTIED, (event) => {
        })


        this.context.on(DefaultPlayerEvents.ENDED, (event) => {
            this.pause();
        })


        this.context.on(DefaultPlayerEvents.LOADEDDATA, (event) => {
        })


        this.context.on(DefaultPlayerEvents.LOADEDMETADATA, (event) => {

        })


        this.context.on(DefaultPlayerEvents.PAUSE, (event) => {
        })


        this.context.on(DefaultPlayerEvents.PLAY, (event) => {
        })


        this.context.on(DefaultPlayerEvents.PLAYING, (event) => {
            this.interfaceController.setBuffering(false);
        })


        this.context.on(DefaultPlayerEvents.PROGRESS, (event) => {
        })


        this.context.on(DefaultPlayerEvents.RATECHANGE, (event) => {
        })


        this.context.on(DefaultPlayerEvents.SEEKED, (event) => {
        })


        this.context.on(DefaultPlayerEvents.SEEKING, (event) => {
        })


        this.context.on(DefaultPlayerEvents.STALLED, (event) => {
        })


        this.context.on(DefaultPlayerEvents.SUSPEND, (event) => {
        })


        this.context.on(DefaultPlayerEvents.TIMEUPDATE, (event) => {

            if (this.ignoreUpdateTime) return;
            
            this.updateTime(this.currentTime)

            if (this.videoAnalyzer.pushFrame(this.player.getCurrentVideo()))
                this.videoAnalyzer.calculate();

        })


        this.context.on(DefaultPlayerEvents.VOLUMECHANGE, (event) => {

        })


        this.context.on(DefaultPlayerEvents.WAITING, (event) => {
            this.interfaceController.setBuffering(true);
        })

        this.context.on(DefaultPlayerEvents.FRAGMENT_UPDATE, () => {
            this.interfaceController.updateFragmentsLoaded();
        })
        
        if (this.previewPlayer) {
            this.previewPlayer.on(DefaultPlayerEvents.MANIFEST_PARSED, () => {
                if (this.persistent.currentLevel !== -1)
                    this.previewPlayer.currentLevel = this.persistent.currentLevel;
            });

            this.previewPlayer.on(DefaultPlayerEvents.FRAGMENT_UPDATE, (fragment) => {
                this.interfaceController.updateFragmentsLoaded();
            });

            let seekHideTimeouts = [];
            this.previewPlayer.on(DefaultPlayerEvents.SEEKING, () => {
                seekHideTimeouts.push(setTimeout(() => {
                    this.previewPlayer.getVideos()[0].style.opacity = 0;
                }, 200));
            });

            this.previewPlayer.on(DefaultPlayerEvents.SEEKED, () => {

                seekHideTimeouts.forEach((timeout) => {
                    clearTimeout(timeout);
                });
                seekHideTimeouts.length = 0;

                this.previewPlayer.getVideos()[0].style.opacity = 1;
            })
        }

    }

    async play() {

        await this.player.play();
        this.interfaceController.play();
    }

    async pause() {
        await this.player.pause();
        this.interfaceController.pause();
    }

    undoSeek() {
        if (this.seeks.length) {
            this.player.currentTime = this.seeks.pop();
            this.interfaceController.updateMarkers();
        }
    }
    savePosition() {
        if (!this.seeks.length || this.seeks[this.seeks.length - 1] != this.persistent.currentTime) {

            this.seeks.push(this.persistent.currentTime);
        }
        if (this.seeks.length > 50) {
            this.seeks.shift();
        }
        this.interfaceController.updateMarkers();
    }
    set currentTime(value) {
        if (this.saveSeek) {
            this.savePosition();
        }
        this.persistent.currentTime = value;
        if (this.player)
            this.player.currentTime = value;
    }

    get duration() {
        return this.player?.duration || 0;
    }

    get currentTime() {
        return this.player?.currentTime || 0;
    }

    get paused() {
        return this.player?.paused || true;
    }

    get levels() {
        return this.player?.levels || [];
    }

    get currentLevel() {
        return this.persistent.currentLevel;
    }

    set currentLevel(value) {
        let previousLevel = this.currentLevel;

        this.persistent.currentLevel = value;
        this.player.currentLevel = value;
        if (this.previewPlayer) {
            this.previewPlayer.currentLevel = value;
        }
        this.videoAnalyzer.setLevel(value);

        if (value !== previousLevel && this.fragmentsStore[previousLevel])
            this.fragmentsStore[previousLevel].forEach((fragment) => {

                fragment.status = DownloadStatus.WAITING;
                if (this.source.mode === PlayerModes.ACCELERATED_HLS)
                    this.downloadManager.removeFile(fragment.getContext());

            });

        if (this.fragmentsStore[this.persistent.currentLevel]) this.fragmentsStore[this.persistent.currentLevel].forEach((fragment) => {
            fragment.status = DownloadStatus.WAITING;
        });
        this.updateQualityLevels();
    }

    get fragments() {
        return this.fragmentsStore[this.currentLevel];
    }

    get currentFragment() {
        return this.player?.currentFragment || null;
    }
    getFragments(level) {
        return this.fragmentsStore[level];
    }

    get volume() {
        return this.player?.volume || this.persistent.volume;
    }

    set volume(value) {
        this.persistent.volume = value;
        if (this.player) this.player.volume = value;
        this.interfaceController.updateVolumeBar();
    }

    get playbackRate() {
        return this.player?.playbackRate || this.persistent.playbackRate;
    }

    set playbackRate(value) {
        this.persistent.playbackRate = value;
        if (this.player) this.player.playbackRate = value;
        this.interfaceController.updatePlaybackRate();
    }

    get currentVideo() {
        return this.player?.getCurrentVideo() || null;
    }
}

