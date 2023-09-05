import { EventEmitter } from "../modules/eventemitter.mjs";
import { DOMElements } from "./DOMElements.mjs";

export class KeybindManager extends EventEmitter {
    constructor(client) {
        super();
        this.client = client;
        this.hidden = false;
        this.keybindMap = {
            "HidePlayer": "AltLeft",
            "PlayPause": "Space",
            "Fullscreen": "KeyF",
            "VolumeUp": "ArrowUp",
            "VolumeDown": "ArrowDown",
            "SeekForward": "ArrowRight",
            "SeekBackward": "ArrowLeft",
            "SeekForwardSmall": "Shift+ArrowRight",
            "SeekBackwardSmall": "Shift+ArrowLeft",
            "SeekForwardLarge": "Period",
            "SeekBackwardLarge": "Comma",
            "UndoSeek": "KeyZ",
            "ResetFailed": "Backquote",
            "RemoveDownloader": "Equal",
            "AddDownloader": "Minus",
            "SkipIntroOutro": "KeyS",
            "GoToStart": "Digit0"
        }
        this.setup();
    }
    setup() {
        document.addEventListener('keydown', (e) => {

            this.onKeyDown(e);
        })

        this.on("HidePlayer", (e) => {
            if (this.hidden) {
                DOMElements.videoContainer.style.display = "";
                DOMElements.controlsContainer.style.display = "";
                DOMElements.playPauseButtonBigCircle.style.opacity = 1;
                DOMElements.playerContainer.style.cursor = '';
                DOMElements.subtitlesContainer.style.display = "";
                this.hidden = false;
                if (this.client.persistent.playing) {
                    this.client.player.play();
                }
            } else {
                DOMElements.videoContainer.style.display = "none";
                DOMElements.controlsContainer.style.display = "none";
                DOMElements.playPauseButtonBigCircle.style.opacity = 0;
                DOMElements.playerContainer.style.cursor = 'none';
                DOMElements.subtitlesContainer.style.display = "none";

                this.hidden = true;
                this.client.player.pause();
            }
        });

        this.on("GoToStart", (e) => {
            this.client.currentTime = 0;
        });

        this.on("VolumeUp", (e) => {
            this.client.volume = Math.min(this.client.volume + 0.10, 1);
        });

        this.on("VolumeDown", (e) => {
            this.client.volume = Math.max(this.client.volume - 0.10, 0);
        });

        this.on("SeekForward", (e) => {
            this.client.setSeekSave(false);
            this.client.currentTime += 2;
            this.client.setSeekSave(true);
        });

        this.on("SeekBackward", (e) => {
            this.client.setSeekSave(false);
            this.client.currentTime += -2;
            this.client.setSeekSave(true);
        });

        this.on("SeekForwardSmall", (e) => {
            this.client.setSeekSave(false);
            this.client.currentTime += 0.2;
            this.client.setSeekSave(true);
        });

        this.on("SeekBackwardSmall", (e) => {
            this.client.setSeekSave(false);
            this.client.currentTime += -0.2;
            this.client.setSeekSave(true);
        });

        this.on("PlayPause", (e) => {
            this.client.interfaceController.playPauseToggle();
        });

        this.on("Fullscreen", (e) => {
            this.client.interfaceController.fullscreenToggle();
            this.client.interfaceController.hideControlBarOnAction(2000);
        });

        this.on("SeekForwardLarge", (e) => {
            this.client.setSeekSave(false);
            this.client.currentTime += 10;
            this.client.setSeekSave(true);
        });

        this.on("SeekBackwardLarge", (e) => {
            this.client.setSeekSave(false);
            this.client.currentTime += -10;
            this.client.setSeekSave(true);
        });

        this.on("UndoSeek", (e) => {
            this.client.undoSeek();
        });

        this.on("ResetFailed", (e) => {
            this.client.resetFailed();
        });

        this.on("RemoveDownloader", (e) => {
            if (this.client.downloadManager.downloaders.length > 0) {
                this.client.downloadManager.removeDownloader();
                this.client.interfaceController.updateFragmentsLoaded()
            }
        });

        this.on("AddDownloader", (e) => {
            if (this.client.downloadManager.downloaders.length < 6) {
                this.client.downloadManager.addDownloader();
                this.client.interfaceController.updateFragmentsLoaded()
            }
        });

        this.on("SkipIntroOutro", (e) => {
            this.client.interfaceController.skipIntroOutro();
        });

        this.on("keybind", (keybind, e) => {
            // console.log("Keybind", keybind);
        });
    }

    setKeybinds(keybinds) {
        for (const keybind in keybinds) {
            if (this.keybindMap.hasOwnProperty(keybind)) {
                this.keybindMap[keybind] = keybinds[keybind];
            }
        }
    }
    getKeyString(e) {
        const metaPressed = e.metaKey && e.key !== "Meta";
        const ctrlPressed = e.ctrlKey && e.key !== "Control";
        const altPressed = e.altKey && e.key !== "Alt";
        const shiftPressed = e.shiftKey && e.key !== "Shift";
        const key = e.key === " " ? "Space" : e.code;

        return (metaPressed ? "Meta+" : "") + (ctrlPressed ? "Control+" : "") + (altPressed ? "Alt+" : "") + (shiftPressed ? "Shift+" : "") + key;
    }
    onKeyDown(e) {
        const keyString = this.getKeyString(e);
        const keybind = Object.keys(this.keybindMap).find((key) => this.keybindMap[key] === keyString);
        if (keybind) {
            this.emit("keybind", keybind, e);
            this.emit(keybind, e)
            e.preventDefault();
        }
    }
}
