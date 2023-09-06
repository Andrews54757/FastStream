import { WebVTT } from "./modules/vtt.mjs";
import { SubtitleUtils } from "./utils/SubtitleUtils.mjs";

export class SubtitleTrack {
    constructor(label, language) {
        this.label = label;
        this.language = language;
        this.cues = [];
        this.regions = [];

    }

    loadURL(url) {
        return fetch(url).then((response) => {
            return response.text();
        }).then((text) => {
            this.loadText(text);
        });
    }

    shift(time) {
        this.cues.forEach((cue) => {
            cue.startTime += time;
            cue.endTime += time;
        });
    }

    loadText(text) {
        if (text.trim().split("\n")[0].trim().substr(0, 6) !== "WEBVTT") text = SubtitleUtils.srt2webvtt(text);
        const parser = new WebVTT.Parser(window, WebVTT.StringDecoder());
        parser.onRegion = (region) => {
            this.regions.push(region);
        }

        parser.oncue = (cue) => {
            this.cues.push(cue);
        }

        parser.onflush = () => {
            this.cues.sort((a, b) => {
                return a.startTime - b.startTime;
            });
        }
        parser.onparsingerror = (error) => {
            throw error;
        }

        parser.parse(text);
        parser.flush();


    }

}