import {WebVTT} from './modules/vtt.mjs';
import {SubtitleUtils} from './utils/SubtitleUtils.mjs';

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
    if (text.substring(0, 5) === '<?xml') {
      text = SubtitleUtils.xml2vtt(text);
    } else if (text.trim().split('\n')[0].trim().substr(0, 6) !== 'WEBVTT') {
      text = SubtitleUtils.srt2webvtt(text);
    }

    // sometimes formatting in subtitles are not properly 
    // converted into webvtt, so we need to convert them manually
    text = SubtitleUtils.convertSubtitleFormatting(text)

    // eslint-disable-next-line new-cap
    const parser = new WebVTT.Parser(window, WebVTT.StringDecoder());
    parser.onRegion = (region) => {
      this.regions.push(region);
    };

    parser.oncue = (cue) => {
      this.cues.push(cue);
    };

    parser.onflush = () => {
      this.cues.sort((a, b) => {
        return a.startTime - b.startTime;
      });
    };

    parser.onparsingerror = (error) => {
      console.error(error);
    };

    parser.parse(text);
    parser.flush();
  }

  equals(otherTrack) {
    if (this.label !== otherTrack.label && this.language !== otherTrack.language) {
      return false;
    }

    if (this.cues.length !== otherTrack.cues.length) {
      return false;
    }

    for (let i = 0; i < this.cues.length; i++) {
      const cue = this.cues[i];
      const otherCue = otherTrack.cues[i];

      if (cue.startTime !== otherCue.startTime || cue.endTime !== otherCue.endTime || cue.text !== otherCue.text) {
        return false;
      }
    }

    return true;
  }
}
