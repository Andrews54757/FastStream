import { DOMElements } from "./DOMElements.mjs";

export class KeybindManager {
    constructor(client) {
        this.client = client;
        this.hidden = false;
        this.setup();
    }
    setup() {
        document.addEventListener('keydown', (e) => {

            this.onKeyDown(e);
        })
    }

    onKeyDown(e) {

        // console.log("key", e)

        if (e.metaKey || e.ctrlKey) {
            return;
        }

        if (e.key === "Alt") {

            if (this.hidden) {
                DOMElements.videoContainer.style.display = "";
                DOMElements.controlsContainer.style.display = "";
                DOMElements.playPauseButtonBigCircle.style.opacity = 1;
                DOMElements.playerContainer.style.cursor = '';
                DOMElements.subtitlesContainer.style.display = "";
                this.hidden = false;
                if (this.client.persistent.playing) {
                    this.client.play();
                }
            } else {

                DOMElements.videoContainer.style.display = "none";
                DOMElements.controlsContainer.style.display = "none";
                DOMElements.playPauseButtonBigCircle.style.opacity = 0;
                DOMElements.playerContainer.style.cursor = 'none';
                DOMElements.subtitlesContainer.style.display = "none";


                this.hidden = true;
                this.client.pause();
            }
        } else if (e.key === "ArrowUp") {
            var volume = this.client.volume;
            this.client.volume = Math.min(volume + 0.10, 1);
        } else if (e.key === "ArrowDown") {
            var volume = this.client.volume;
            this.client.volume = Math.max(volume - 0.10, 0);
        } else if (e.key === "ArrowLeft") {
            var step = e.shiftKey ? 0.02 : 2;
            this.client.setSeekSave(false);
            this.client.currentTime += -step;
            this.client.setSeekSave(true);
        } else if (e.key === "ArrowRight") {
            var step = e.shiftKey ? 0.02 : 2;
            this.client.setSeekSave(false);
            this.client.currentTime += step;
            this.client.setSeekSave(true);
        } else if (e.key === " ") {
            this.client.interfaceController.playPauseToggle();
        } else if (e.key === "f") {
            this.client.interfaceController.fullscreenToggle();
            this.client.interfaceController.hideControlBarOnAction(2000);
        } else if (e.key === "j" || e.key === ",") {
            this.client.setSeekSave(false);
            this.client.currentTime += -10;
            this.client.setSeekSave(true);
        } else if (e.key === "l" || e.key === ".") {
            this.client.setSeekSave(false);
            this.client.currentTime += 10;
            this.client.setSeekSave(true);
        } else if (e.key == "z") {
            this.client.undoSeek();
        } else if (e.key == '`') {
            this.client.resetFailed();
        } else if (e.key == '-') {
            let downloaders = this.client.downloadManager.downloaders.length;
            if (downloaders > 0) {
                this.client.downloadManager.removeDownloader();
                this.client.interfaceController.updateFragmentsLoaded()
            }
        } else if (e.key === "=") {
            let downloaders = this.client.downloadManager.downloaders.length;
            if (downloaders < 6) {
                this.client.downloadManager.addDownloader();
                this.client.interfaceController.updateFragmentsLoaded()
            }
        } else if (e.key === "s") {
            this.client.interfaceController.skipIntroOutro();
        } else {
            return;
        }
        e.preventDefault();

    }
}
