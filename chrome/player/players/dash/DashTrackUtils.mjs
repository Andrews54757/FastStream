import {AudioLevel, VideoLevel} from '../Levels.mjs';

export class DashTrackUtils {
  static getLevelFromRepresentation(rep) {
    const type = rep.adaptation.type;
    const id = rep.id;
    return `${type}-${id}`;
  }

  static deconstructLevel(levelId) {
    const parts = levelId.split('-');
    if (parts.length < 2) {
      return levelId;
    }
    const type = parts[0];
    const id = parts.slice(1).join('-');
    return {type, id};
  }

  static getVideoLevelList(tracks) {
    // make into map
    const map = new Map();

    tracks.forEach((track) => {
      track.bitrateList.forEach((data) => {
        const levelId = 'video-' + data.id;
        const existing = map.get(levelId);
        if (existing) {
          console.warn('Duplicate level id found in getVideoLevelList:', levelId, track, existing.track);
          return;
        }

        map.set(levelId, new VideoLevel({
          id: levelId,
          width: data.width,
          height: data.height,
          bitrate: data.bandwidth,
          mimeType: track.mimeType,
          language: track.lang,
          videoCodec: this.mimeCodecToCodec(track.codec),
          track: track,
        }));
      });
    });
    return map;
  }

  static mimeCodecToCodec(mimeCodec) {
    // mimeCodec format: video/mp4; codecs="avc1.42E01E, mp4a.40.2"
    const parts = mimeCodec.split(';');
    if (parts.length < 2) {
      return null;
    }
    const codecPart = parts[1].trim();
    if (!codecPart.startsWith('codecs=')) {
      return null;
    }
    let codecStr = codecPart.substring(7).trim();
    if (codecStr.startsWith('"') && codecStr.endsWith('"')) {
      codecStr = codecStr.substring(1, codecStr.length - 1);
    }
    return codecStr;
  }

  static getAudioLevelList(tracks) {
    // make into map
    const map = new Map();

    tracks.forEach((track) => {
      track.bitrateList.forEach((data) => {
        const levelId = 'audio-' + data.id;
        const existing = map.get(levelId);
        if (existing) {
          console.warn('Duplicate level id found in getAudioLevelList:', levelId, track, existing.track);
          return;
        }

        map.set(levelId, new AudioLevel({
          id: levelId,
          bitrate: data.bandwidth,
          mimeType: track.mimeType,
          language: track.lang,
          audioCodec: this.mimeCodecToCodec(track.codec),
          track: track,
        }));
      });
    });

    return map;
  }
}

