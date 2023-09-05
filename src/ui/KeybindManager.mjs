import { DOMElements } from "./DOMElements.mjs";

export class KeybindManager {
    constructor(client) {
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
    }

    setKeybinds(keybinds) {
        for (const keybind in keybinds) {
            if (this.keybindMap.hasOwnProperty(keybind)) {
                this.keybindMap[keybind] = keybinds[keybind];
            }
        }
    }

    onKeybind(keybind, e) {
       // console.log("Keybind: " + keybind);
        switch (keybind) {
            case "HidePlayer":
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
                break;
            case "GoToStart":
                this.client.currentTime = 0;
                break;
            case "VolumeUp":
                this.client.volume = Math.min(this.client.volume + 0.10, 1);
                break;
            case "VolumeDown":
                this.client.volume = Math.max(this.client.volume - 0.10, 0);
                break;
            case "SeekForward":
                this.client.setSeekSave(false);
                this.client.currentTime += 2;
                this.client.setSeekSave(true);
                break;
            case "SeekBackward":
                this.client.setSeekSave(false);
                this.client.currentTime += -2;
                this.client.setSeekSave(true);
                break;
            case "SeekForwardSmall":
                this.client.setSeekSave(false);
                this.client.currentTime += 0.2;
                this.client.setSeekSave(true);
                break;
            case "SeekBackwardSmall":
                this.client.setSeekSave(false);
                this.client.currentTime += -0.2;
                this.client.setSeekSave(true);
                break;
            case "PlayPause":
                this.client.interfaceController.playPauseToggle();
                break;
            case "Fullscreen":
                this.client.interfaceController.fullscreenToggle();
                this.client.interfaceController.hideControlBarOnAction(2000);
                break;
            case "SeekForwardLarge":
                this.client.setSeekSave(false);
                this.client.currentTime += 10;
                this.client.setSeekSave(true);
                break;
            case "SeekBackwardLarge":
                this.client.setSeekSave(false);
                this.client.currentTime += -10;
                this.client.setSeekSave(true);
                break;
            case "UndoSeek":
                this.client.undoSeek();
                break;
            case "ResetFailed":
                this.client.resetFailed();
                break;
            case "RemoveDownloader":
                if (this.client.downloadManager.downloaders.length > 0) {
                    this.client.downloadManager.removeDownloader();
                    this.client.interfaceController.updateFragmentsLoaded()
                }
                break;
            case "AddDownloader":
                if (this.client.downloadManager.downloaders.length < 6) {
                    this.client.downloadManager.addDownloader();
                    this.client.interfaceController.updateFragmentsLoaded()
                }
                break;
            case "SkipIntroOutro":
                this.client.interfaceController.skipIntroOutro();
                break;
            default:
                console.log("Unknown keybind: " + keybind);
        }
        e.preventDefault();
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
            this.onKeybind(keybind, e);
        }
    }
}
