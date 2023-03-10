import { DownloadStatus } from "../enums/DownloadStatus.mjs";
import { PlayerModes } from "../enums/PlayerModes.mjs";
import { SubtitleTrack } from "../SubtitleTrack.mjs";
import { VideoSource } from "../VideoSource.mjs";
import { DOMElements } from "./DOMElements.mjs";

export class InterfaceController {
    constructor(client) {
        this.client = client;
        this.persistent = client.persistent;
        this.isSeeking = false;
        this.isMouseOverProgressbar = false;
        this.setupDOM();

        this.lastSpeed = 0;
        this.mouseOverControls = false;
        this.mouseActivityCooldown = 0;


        this.hasShownSkip = false;
    }
    reset() {
        DOMElements.videoContainer.innerHTML = "";
        DOMElements.seekPreviewVideo.innerHTML = "";
        DOMElements.seekPreviewVideo.style.display = "none";
        DOMElements.progressLoadedContainer.innerHTML = "";
        this.hasShownSkip = false;
        this.reuseDownloadURL = false;
        if (this.downloadURL) {
            URL.revokeObjectURL(this.downloadURL);
        }
        this.downloadURL = null;
    }

    addVideo(video) {
        DOMElements.videoContainer.appendChild(video);
    }

    addPreviewVideo(video) {
        DOMElements.seekPreviewVideo.style.display = "";
        DOMElements.seekPreviewVideo.appendChild(video);
    }

    updateFragmentsLoaded() {
        DOMElements.progressLoadedContainer.innerHTML = "";
        const fragments = this.client.fragments;

        if (!fragments || !this.persistent.duration) {
            return;
        }

        let currentTime = 0;


        let i = 0;
        let total = 0;
        let loaded = 0;
        while (i < fragments.length) {
            let frag = fragments[i];

            if (!frag) {
                i++;
                continue;
            }
            total++;

            let start = currentTime;
            let end = currentTime + frag.duration;
            currentTime = end;

            if (frag.status === DownloadStatus.WAITING) {
                i++;
                continue;
            }

            let element = document.createElement("div");
            element.style.left = (start / this.persistent.duration * 100) + "%";

            if (frag.status === DownloadStatus.DOWNLOAD_INITIATED) {
                element.classList.add("download-initiated");
            } else if (frag.status === DownloadStatus.DOWNLOAD_COMPLETE) {
                loaded++;
                element.classList.add("download-complete");
            } else if (frag.status === DownloadStatus.DOWNLOAD_FAILED) {
                element.classList.add("download-failed");
            }

            i++;

            while (i < fragments.length && fragments[i].status === frag.status) {
                end = currentTime + fragments[i].duration;
                currentTime = end;
                i++;

                total++;
                if (frag.status === DownloadStatus.DOWNLOAD_COMPLETE) {
                    loaded++;
                }
            }

            element.style.width = ((end - start) / this.persistent.duration * 100) + "%";

            DOMElements.progressLoadedContainer.appendChild(element);
        }

        let percentDone = Math.round((loaded / total) * 1000) / 10;

        this.lastSpeed = (this.client.downloadManager.getSpeed() * 0.1 + this.lastSpeed * 0.9) || 0;
        let speed = this.lastSpeed; // bytes per second
        speed = Math.round(speed / 1000 / 1000 * 10) / 10; // MB per second

        if (!this.makingDownload) {
            if (percentDone < 100) {
                DOMElements.downloadStatus.textContent = `${this.client.downloadManager.downloaders.length}C ???${speed}MB/s ${percentDone}%`;
            } else {
                DOMElements.downloadStatus.textContent = `100% Downloaded`;
            }
        }
    }



    setupDOM() {

        DOMElements.volumeContainer.addEventListener('mousedown', this.onVolumeBarMouseDown.bind(this));
        // DOMElements.muteBtn.addEventListener('mouseenter', () => {
        //     DOMElements.volumeContainer.classList.remove("hidden");
        // });
        // DOMElements.muteBtn.addEventListener('mouseleave', () => {
        //     DOMElements.volumeContainer.classList.add("hidden");
        // });
        DOMElements.muteBtn.addEventListener('click', this.muteToggle.bind(this));
        DOMElements.playPauseButton.addEventListener('click', this.playPauseToggle.bind(this));
        DOMElements.playPauseButtonBigCircle.addEventListener('click', () => {
            this.hideControlBarOnAction();
            this.playPauseToggle();
        });
        DOMElements.videoContainer.addEventListener('dblclick', () => {
            this.hideControlBarOnAction();
            this.playPauseToggle();
        });
        DOMElements.progressContainer.addEventListener('mousedown', this.onProgressbarMouseDown.bind(this));
        DOMElements.progressContainer.addEventListener('mouseenter', this.onProgressbarMouseEnter.bind(this));
        DOMElements.progressContainer.addEventListener('mouseleave', this.onProgressbarMouseLeave.bind(this));
        DOMElements.progressContainer.addEventListener('mousemove', this.onProgressbarMouseMove.bind(this));

        DOMElements.fullscreen.addEventListener('click', this.fullscreenToggle.bind(this));
        document.addEventListener('fullscreenchange', this.updateFullScreenButton.bind(this));
        DOMElements.videoSource.addEventListener('click', () => {
            if (DOMElements.videoSourceList.style.display === "none") {
                DOMElements.videoSourceList.style.display = "block";
            } else {
                DOMElements.videoSourceList.style.display = "none";
            }
        });

        DOMElements.playerContainer.addEventListener('mousemove', this.onPlayerMouseMove.bind(this));
        DOMElements.controlsContainer.addEventListener('mouseenter', this.onControlsMouseEnter.bind(this));
        DOMElements.controlsContainer.addEventListener('mouseleave', this.onControlsMouseLeave.bind(this));
        DOMElements.videoContainer.addEventListener('click', () => {

            this.hideControlBarOnAction();
        });

        DOMElements.skipButton.addEventListener('click', this.skipIntroOutro.bind(this));
        DOMElements.download.addEventListener('click', this.downloadMovie.bind(this));
        DOMElements.playerContainer.addEventListener('drop', this.onFileDrop.bind(this), false);

        DOMElements.playerContainer.addEventListener("dragenter", (e) => {
            e.stopPropagation();
            e.preventDefault();
        }, false);
        DOMElements.playerContainer.addEventListener("dragover", (e) => {
            e.stopPropagation();
            e.preventDefault();
        }, false);
    }

    async onFileDrop(e) {
        e.stopPropagation();
        e.preventDefault();

        const dt = e.dataTransfer;
        const files = dt.files;
        var captions = [];
        var audioFormats = [
            ".mp3",
            ".wav",
            ".m4a",
            ".m4r"
        ]
        let src = null;
        let mode = PlayerModes.DIRECT;
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            var ext = file.name.substring(file.name.length - 4);

            if (audioFormats.indexOf(ext) !== -1) {
                src = file;
            } else if (ext == "m3u8") {
                src = file;
            } else if (ext == ".mp4" || ext == ".mkv" || ext == ".mov") {
                src = file
             //  mode = PlayerModes.ACCELERATED_MP4;
            } else if (ext == ".vtt" || ext == ".srt") {
                captions.push(window.URL.createObjectURL(file));
            }
        }

        if (src) {
            let source = new VideoSource(src, {}, mode);
            await this.client.setSource(source);
        }

        (await Promise.all(captions.map(async (url) => {
            let track = new SubtitleTrack();
            await track.loadURL(url);
            return track;
        }))).forEach((track) => {
            this.client.loadSubtitleTrack(track);
        });

        this.client.play();
    }
    destroy() {
        if (this.downloadURL) {
            URL.revokeObjectURL(this.downloadURL);
            this.downloadURL = null;
        }
    }

    progressLoop() {
        if (!this.shouldRunProgressLoop) {
            this.isRunningProgressLoop = false;
            return;
        }
        window.requestAnimationFrame(this.progressLoop.bind(this));
        this.client.updateTime(this.client.currentTime);
    }
    durationChanged() {
        let duration = this.persistent.duration;
        if (duration < 5 * 60) {
            if (!this.isRunningProgressLoop) {
                this.isRunningProgressLoop = true;
                this.shouldRunProgressLoop = true;
                this.progressLoop();
            }
        } else {
            this.shouldRunProgressLoop = false;
        }
        this.updateProgress();
    }

    async downloadMovie() {

        if (!this.client.player) {
            return;
        }

        if (this.makingDownload) {
            alert("Already making download!");
            return;
        }

        let player = this.client.player;

        let { canSave, isComplete } = player.canSave();

        if (!canSave) {
            alert("Download is not supported for this video!");
            return;
        }

        if (!isComplete) {
            let res = confirm("Video has not finished downloading yet! Are you sure you want to save it?");
            if (!res) {
                return;
            }
        }

        let name = prompt("Enter a name for the file", "video");

        if (!name) {
            return;
        }

        let url;
        if (this.reuseDownloadURL && this.downloadURL && isComplete) {
            url = this.downloadURL;
        } else {
            this.reuseDownloadURL = isComplete;
            let result;
            this.makingDownload = true;
            DOMElements.downloadStatus.textContent = `Making download...`;
            try {
                result = await player.getSaveBlob({
                    onProgress: (progress) => {
                        DOMElements.downloadStatus.textContent = `Saving ${Math.round(progress * 100)}%`;
                    }
                });
            } catch (e) {
                console.error(e);
                alert("Failed to save video!");
                DOMElements.downloadStatus.textContent = `Save Failed`;
                this.makingDownload = false;
                return;
            }
            DOMElements.downloadStatus.textContent = `Save complete`;
            this.makingDownload = false;
            if (this.downloadURL) {
                URL.revokeObjectURL(this.downloadURL);
                this.downloadURL = null;
            }
            url = URL.createObjectURL(result.blob);
            this.downloadExtension = result.extension;

            setTimeout(() => {
                if (this.downloadURL !== url) return;

                if (DOMElements.downloadStatus.textContent === `Save complete`) {
                    DOMElements.downloadStatus.textContent = `100% Downloaded`;
                }

                if (this.downloadURL) {
                    URL.revokeObjectURL(this.downloadURL);
                    this.downloadURL = null;
                    this.reuseDownloadURL = false;
                }

            }, 20000);
        }

        this.downloadURL = url;

        var link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', name + "." + this.downloadExtension);
        link.setAttribute('target', '_blank');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    updateMarkers() {
        DOMElements.markerContainer.innerHTML = "";
        let seeks = this.client.seeks;
        if (seeks.length) {
            let time = seeks[seeks.length - 1];
            let marker = document.createElement("div");
            marker.classList.add("seek_marker");
            marker.style.left = (time / this.persistent.duration * 100) + "%";
            DOMElements.markerContainer.appendChild(marker);
        }


    }
    skipIntroOutro() {
        let introMatch = this.client.videoAnalyzer.getIntro();
        let outroMatch = this.client.videoAnalyzer.getOutro();
        let time = this.client.currentTime;
        if (introMatch && time >= introMatch.startTime && time < introMatch.endTime) {
            this.client.currentTime = introMatch.endTime;
        } else if (outroMatch && time >= outroMatch.startTime && time < outroMatch.endTime) {
            this.client.currentTime = outroMatch.endTime;
        }
        this.hideControlBarOnAction();
    }
    onControlsMouseEnter() {
        this.showControlBar();
        this.mouseOverControls = true;
    }
    onControlsMouseLeave() {
        this.mouseOverControls = false;
        this.queueControlsHide();
    }
    onPlayerMouseMove() {
        if (Date.now() < this.mouseActivityCooldown) {
            return;
        }
        this.showControlBar();
        this.queueControlsHide();
    }

    queueControlsHide(time) {
        clearTimeout(this.hideControlBarTimeout);
        this.hideControlBarTimeout = setTimeout(() => {
            if (!this.mouseOverControls && DOMElements.playPauseButtonBigCircle.style.display == 'none')
                this.hideControlBar();
        }, time || 2000);
    }

    hideControlBarOnAction(cooldown) {
        if (!this.mouseOverControls) {
            this.mouseActivityCooldown = Date.now() + (cooldown || 500);
            if (DOMElements.playPauseButtonBigCircle.style.display == 'none')
                this.hideControlBar();
        }

    }

    hideControlBar() {
        clearTimeout(this.hideControlBarTimeout);
        DOMElements.playerContainer.style.cursor = 'none';
        DOMElements.controlsContainer.classList.remove('fade_in');
        DOMElements.controlsContainer.classList.add('fade_out');
        DOMElements.progressContainer.classList.remove('freeze');
    }

    showControlBar() {
        DOMElements.playerContainer.style.cursor = '';

        DOMElements.controlsContainer.classList.remove('fade_out');
        DOMElements.controlsContainer.classList.add('fade_in');
    }

    getOffsetLeft(elem) {
        var offsetLeft = 0;
        do {
            if (!isNaN(elem.offsetLeft)) {
                offsetLeft += elem.offsetLeft;
            }
        } while (elem = elem.offsetParent);
        return offsetLeft;
    }

    muteToggle() {
        if (0 !== this.persistent.volume && !this.persistent.muted) {
            this.persistent.volume = 0;
            this.persistent.muted = true;
        } else {
            this.persistent.volume = this.persistent.latestVolume;
            this.persistent.muted = false;
        }
        this.client.volume = this.persistent.volume;
    }

    onProgressbarMouseLeave() {
        this.isMouseOverProgressbar = false;
        if (!this.isSeeking) {
            this.hidePreview();
        }
    }

    onProgressbarMouseEnter() {
        this.isMouseOverProgressbar = true;

        this.showPreview();

    }

    showPreview() {
        DOMElements.seekPreview.style.display = '';
        DOMElements.seekPreviewTip.style.display = '';
    }

    hidePreview() {
        DOMElements.seekPreview.style.display = 'none';
        DOMElements.seekPreviewTip.style.display = 'none';
    }


    onProgressbarMouseMove(event) {
        const currentX = Math.min(Math.max(event.clientX - this.getOffsetLeft(DOMElements.progressContainer), 0), DOMElements.progressContainer.clientWidth);
        const totalWidth = DOMElements.progressContainer.clientWidth;

        const time = this.persistent.duration * currentX / totalWidth;

        DOMElements.seekPreviewText.textContent = this.formatTime(time);

        let maxWidth = Math.max(DOMElements.seekPreviewVideo.clientWidth, DOMElements.seekPreview.clientWidth);


        let nudgeAmount = 0;

        if (currentX < maxWidth / 2) {
            nudgeAmount = maxWidth / 2 - currentX;
        }

        if (currentX > totalWidth - maxWidth / 2) {
            nudgeAmount = (totalWidth - maxWidth / 2 - currentX);
        }

        DOMElements.seekPreview.style.left = (currentX + nudgeAmount) / totalWidth * 100 + '%';
        DOMElements.seekPreviewTip.style.left = currentX / totalWidth * 100 + '%';

        if (nudgeAmount) {
            DOMElements.seekPreviewTip.classList.add("detached");
        } else {
            DOMElements.seekPreviewTip.classList.remove("detached");
        }

        this.client.seekPreview(time);

    }



    onProgressbarMouseDown(event) {
        if (this.persistent.playing) {
            this.client.player.pause();
        }

        this.isSeeking = true;
        this.showPreview();
        this.client.savePosition();
        this.client.setSeekSave(false);

        DOMElements.progressContainer.classList.add('freeze');
        DOMElements.playPauseButtonBigCircle.style.display = 'none';
        // we need an initial position for touchstart events, as mouse up has no offset x for iOS
        let initialPosition = Math.min(Math.max(event.clientX - this.getOffsetLeft(DOMElements.progressContainer), 0), DOMElements.progressContainer.clientWidth);

        const shiftTime = timeBarX => {
            const totalWidth = DOMElements.progressContainer.clientWidth;
            if (totalWidth) {
                this.client.currentTime = this.persistent.duration * timeBarX / totalWidth;
            }
            this.updateProgress();
        };

        const onProgressbarMouseMove = event => {
            const currentX = Math.min(Math.max(event.clientX - this.getOffsetLeft(DOMElements.progressContainer), 0), DOMElements.progressContainer.clientWidth);
            initialPosition = NaN; // mouse up will fire after the move, we don't want to trigger the initial position in the event of iOS
            shiftTime(currentX);
        };

        const onProgressbarMouseUp = event => {

            document.removeEventListener('mousemove', onProgressbarMouseMove);
            document.removeEventListener('touchmove', onProgressbarMouseMove);
            document.removeEventListener('mouseup', onProgressbarMouseUp);
            document.removeEventListener('touchend', onProgressbarMouseUp);
            this.isSeeking = false;

            if (!this.isMouseOverProgressbar) {
                this.hidePreview();
            }

            let clickedX = Math.min(Math.max(event.clientX - this.getOffsetLeft(DOMElements.progressContainer), 0), DOMElements.progressContainer.clientWidth);

            if (isNaN(clickedX) && !isNaN(initialPosition)) {
                clickedX = initialPosition;
            }
            if (!isNaN(clickedX)) {
                shiftTime(clickedX);
            }
            this.client.setSeekSave(true);

            DOMElements.progressContainer.classList.remove('freeze');

            if (this.persistent.playing) {
                this.client.player.play();
            }
        };
        shiftTime(initialPosition);
        document.addEventListener('mouseup', onProgressbarMouseUp);
        document.addEventListener('touchend', onProgressbarMouseUp);
        document.addEventListener('mousemove', onProgressbarMouseMove);
        document.addEventListener('touchmove', onProgressbarMouseMove);
    }

    onVolumeBarMouseDown(event) {
        const shiftVolume = volumeBarX => {
            const totalWidth = DOMElements.volumeControlBar.clientWidth;

            if (totalWidth) {
                let newVolume = volumeBarX / totalWidth;

                if (newVolume < 0.05) {
                    newVolume = 0;
                    this.persistent.muted = true;
                } else if (newVolume > 0.95) {
                    newVolume = 1;
                }

                if (this.persistent.muted && newVolume > 0) {
                    this.persistent.muted = false;
                }
                this.client.volume = newVolume
            }
        }

        const onVolumeBarMouseMove = event => {
            const currentX = event.clientX - this.getOffsetLeft(DOMElements.volumeContainer);
            shiftVolume(currentX);
        }

        const onVolumeBarMouseUp = event => {
            document.removeEventListener('mousemove', onVolumeBarMouseMove);
            document.removeEventListener('touchmove', onVolumeBarMouseMove);
            document.removeEventListener('mouseup', onVolumeBarMouseUp);
            document.removeEventListener('touchend', onVolumeBarMouseUp);

            const currentX = event.clientX - this.getOffsetLeft(DOMElements.volumeContainer);

            if (!isNaN(currentX)) {
                shiftVolume(currentX);
            }
        }

        document.addEventListener('mouseup', onVolumeBarMouseUp);
        document.addEventListener('touchend', onVolumeBarMouseUp);
        document.addEventListener('mousemove', onVolumeBarMouseMove);
        document.addEventListener('touchmove', onVolumeBarMouseMove);

    }

    updatePlaybackRate() {

    }

    updateIntroOutroBar() {
        DOMElements.introOutroContainer.innerHTML = "";

        let introMatch = this.client.videoAnalyzer.getIntro();
        let outroMatch = this.client.videoAnalyzer.getOutro();

        if (introMatch) {
            let introElement = document.createElement("div");
            introElement.style.left = introMatch.startTime / this.persistent.duration * 100 + "%";
            introElement.style.width = (introMatch.endTime - introMatch.startTime) / this.persistent.duration * 100 + "%";
            DOMElements.introOutroContainer.appendChild(introElement);
        }


        if (outroMatch) {
            let outroElement = document.createElement("div");
            outroElement.style.left = outroMatch.startTime / this.persistent.duration * 100 + "%";
            outroElement.style.width = (outroMatch.endTime - outroMatch.startTime) / this.persistent.duration * 100 + "%";
            DOMElements.introOutroContainer.appendChild(outroElement);
        }


        let time = this.client.currentTime;
        if (introMatch && time >= introMatch.startTime && time < introMatch.endTime) {
            DOMElements.skipButton.style.display = "";
            DOMElements.skipButton.textContent = "Skip Intro";
            DOMElements.progressContainer.classList.add('skip_freeze');
        } else if (outroMatch && time >= outroMatch.startTime && time < outroMatch.endTime) {
            DOMElements.skipButton.style.display = "";
            DOMElements.skipButton.textContent = "Skip Outro";
            DOMElements.progressContainer.classList.add('skip_freeze');
        } else {
            DOMElements.progressContainer.classList.remove('skip_freeze');
            DOMElements.skipButton.style.display = "none";
            this.hasShownSkip = false;
        }

        if (DOMElements.skipButton.style.display !== "none") {
            if (!this.hasShownSkip) {
                this.hasShownSkip = true;

                this.showControlBar();
                this.queueControlsHide(5000);
            }
        }

    }
    updateQualityLevels() {
        if (this.persistent.levels.length <= 1) {
            DOMElements.videoSource.style.display = "none";
            return;
        } else {
            DOMElements.videoSource.style.display = "inline-block";
        }

        DOMElements.videoSourceList.innerHTML = "";
        this.persistent.levels.forEach((level, i) => {
            const levelelement = document.createElement("div");

            levelelement.classList.add("fluid_video_source_list_item");
            levelelement.addEventListener("click", () => {
                this.client.currentLevel = i;
                this.updateQualityLevels();
            });

            if (i === this.persistent.currentLevel) {
                levelelement.classList.add("source_active");
            }

            const icon = document.createElement("span");
            icon.classList.add("source_button_icon");

            const text = document.createElement("span");
            const label = level.width + "x" + level.height + " @" + Math.round(level.bitrate / 1000) + "kbps";

            text.textContent = (i === this.persistent.currentLevel) ? label + " (current)" : label;
            //   levelelement.appendChild(icon);
            levelelement.appendChild(text);

            DOMElements.videoSourceList.appendChild(levelelement)
        })

        const current = this.persistent.levels[this.persistent.currentLevel];
        const isHD = current.width >= 1280;

        if (isHD) {
            DOMElements.videoSource.classList.add("hd");
        } else {
            DOMElements.videoSource.classList.remove("hd");
        }
    }

    updateVolumeBar() {
        const currentVolumeTag = DOMElements.currentVolume;
        const volumeposTag = DOMElements.currentVolumePos;
        const volumebarTotalWidth = DOMElements.volumeControlBar.clientWidth;
        const volumeposTagWidth = volumeposTag.clientWidth;
        const muteButtonTag = DOMElements.muteBtn;

        const volume = this.persistent.volume;

        if (0 !== volume) {
            this.persistent.latestVolume = volume;
            this.persistent.muted = false;
        } else {
            this.persistent.muted = true;
        }
        if (this.persistent.muted) {
            muteButtonTag.classList.replace("fluid_button_volume", "fluid_button_mute")
        } else {
            muteButtonTag.classList.replace("fluid_button_mute", "fluid_button_volume")

        }

        currentVolumeTag.style.width = (volume * 100) + '%';
    }
    formatTime(time) {
        var hours = Math.floor(time / 3600);
        time = time - hours * 3600;
        var minutes = Math.floor(time / 60);
        var seconds = Math.floor(time - minutes * 60);

        function str_pad_left(string, pad, length) {
            return (new Array(length + 1).join(pad) + string).slice(-length);
        }

        return (hours ? (hours + ':') : '') + str_pad_left(minutes, '0', 2) + ':' + str_pad_left(seconds, '0', 2);
    }
    updateProgress() {
        DOMElements.currentProgress.style.width = (this.persistent.currentTime / this.persistent.duration) * 100 + '%';
        DOMElements.duration.textContent = this.formatTime(this.persistent.currentTime) + ' / ' + this.formatTime(this.persistent.duration);
    }

    fullscreenToggle() {
        try {
            if (document.fullscreenEnabled) {
                if (!document.fullscreenElement) {
                    DOMElements.playerContainer.requestFullscreen();
                } else if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            } else {
                if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
                    chrome.runtime.sendMessage({
                        type: "fullscreen"
                    });
                }
            }
        } catch (e) {
            console.log("Fullscreen not supported", e)
        }

        this.persistent.fullscreen = document.fullscreen;
        this.updateFullScreenButton();
    }

    updateFullScreenButton() {
        const fullScreenButton = DOMElements.fullscreen;
        if (document.fullscreenElement) {
            fullScreenButton.classList.replace("fluid_button_fullscreen", "fluid_button_fullscreen_exit")
        } else {
            fullScreenButton.classList.replace("fluid_button_fullscreen_exit", "fluid_button_fullscreen")
        }
    }

    playPauseToggle() {
        if (!this.persistent.playing) {
            this.play();
            this.client.player.play();
        } else {
            this.pause();
            this.client.player.pause();
        }
    }

    play() {
        this.persistent.playing = true;
        DOMElements.playPauseButtonBigCircle.style.display = 'none';
        this.updatePlayPauseButton();
        this.playPauseAnimation();
        this.queueControlsHide();
    }

    pause() {
        this.persistent.playing = false;
        this.updatePlayPauseButton();
        this.playPauseAnimation();
    }

    updatePlayPauseButton() {
        const playButton = DOMElements.playPauseButton;
        const playButtonBig = DOMElements.playPauseButtonBig;
        if (this.persistent.playing) {
            playButton.classList.replace("fluid_button_play", "fluid_button_pause")
            playButtonBig.classList.replace("fluid_initial_play_button", "fluid_initial_pause_button")
        } else {
            playButton.classList.replace("fluid_button_pause", "fluid_button_play")
            playButtonBig.classList.replace("fluid_initial_pause_button", "fluid_initial_play_button")
        }
    }
    playPauseAnimation() {
        DOMElements.playPauseButtonBigCircle.classList.remove('transform-active');
        void DOMElements.playPauseButtonBigCircle.offsetWidth;
        DOMElements.playPauseButtonBigCircle.classList.add('transform-active');
        setTimeout(
            function () {
                DOMElements.playPauseButtonBigCircle.classList.remove('transform-active');
            },
            500
        );
    };
}