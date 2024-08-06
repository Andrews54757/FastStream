import {Utils} from '../../utils/Utils.mjs';

export class TrackFilter {
  static getTracksWithHighestSelectionPriority(trackArr) {
    let max = 0;
    let result = [];
    trackArr.forEach(function(track) {
      if (!isNaN(track.selectionPriority)) {
        if (track.selectionPriority > max) {
          max = track.selectionPriority;
          result = [track];
        } else if (track.selectionPriority === max) {
          result.push(track);
        }
      }
    });
    return result;
  }

  static getTracksWithHighestBitrate(trackArr) {
    let max = 0;
    let result = [];
    let tmp;
    trackArr.forEach((track) => {
      tmp = Math.max(...track.bitrateList.map((obj) => {
        return obj.bandwidth;
      }));

      if (tmp > max) {
        max = tmp;
        result = [track];
      } else if (tmp === max) {
        result.push(track);
      }
    });
    return result;
  }


  static getTracksWithWidestRange(trackArr) {
    let max = 0;
    let result = [];
    let tmp;
    trackArr.forEach(function(track) {
      tmp = track.representationCount;

      if (tmp > max) {
        max = tmp;
        result = [track];
      } else if (tmp === max) {
        result.push(track);
      }
    });
    return result;
  }

  static trackSelectionModeHighestSelectionPriority(tracks) {
    let tmpArr = this.getTracksWithHighestSelectionPriority(tracks);

    if (tmpArr.length > 1) {
      tmpArr = this.getTracksWithHighestBitrate(tmpArr);
    }

    if (tmpArr.length > 1) {
      tmpArr = this.getTracksWithWidestRange(tmpArr);
    }

    return tmpArr;
  }

  static prioritizeMP4Tracks(tracks) {
    const mp4Tracks = tracks.filter((track) => {
      return this.isTrackMP4(track);
    });

    if (mp4Tracks.length > 0) {
      return mp4Tracks;
    } else {
      return tracks;
    }
  }

  static isTrackMP4(track) {
    return track.mimeType === 'video/mp4' || track.mimeType === 'audio/mp4';
  }

  static prioritizeLang(tracks, lang) {
    if (lang.length === 0) {
      return tracks;
    }

    // lang format: en-US
    const langArr = lang.split('-');
    const langTracks = tracks.filter((track) => {
      const langArrTrack = track.lang.split('-');
      return langArrTrack[0] === langArr[0];
    });

    if (langTracks.length > 0) {
      tracks = langTracks;
    }

    if (langArr.length > 1) {
      const langTracks = tracks.filter((track) => {
        const langArrTrack = track.lang.split('-');
        return langArrTrack[1] === langArr[1];
      });

      if (langTracks.length > 0) {
        tracks = langTracks;
      }
    }
    return tracks;
  }

  static filterByRole(tracks, role) {
    const filtered = tracks.filter((track) => {
      return track.roles.includes(role);
    });

    if (filtered.length > 0) {
      return filtered;
    } else {
      return tracks;
    }
  }

  static filterTracksByCodec(tracks) {
    // check if can play codec
    return tracks.filter((track) => {
      return MediaSource.isTypeSupported(track.codec);
    });
  }

  static uniqueLanguages(tracks, defaultQuality) {
    tracks = this.filterTracksByCodec(tracks);

    const languageMap = new Map();
    tracks.forEach((track) => {
      let languageMapItem = languageMap.get(track.lang);
      if (!languageMapItem) {
        languageMapItem = [];
        languageMap.set(track.lang, languageMapItem);
      }
      languageMapItem.push(track);
    });

    const result = [];
    languageMap.forEach((langTracks) => {
      if (langTracks.length > 1) {
        langTracks = this.filterByRole(langTracks, 'main');
      }

      if (langTracks.length > 1) {
        if (langTracks[0].type === 'video') {
          const levelList = this.getLevelList(langTracks, langTracks[0].lang);
          const chosenQuality = Utils.selectQuality(levelList, defaultQuality);
          langTracks = [levelList.get(chosenQuality).track];
        } else {
          langTracks = this.prioritizeMP4Tracks(langTracks);
        }
      }

      if (langTracks.length > 1) {
        langTracks = this.trackSelectionModeHighestSelectionPriority(langTracks);
      }
      result.push(langTracks[0]);
    });

    return result;
  }

  static prioritizeMP4WithQuality(tracks) {
    const byQualityLevel = new Map();
    tracks.forEach((track) => {
      track.bitrateList.forEach((data, qualityIndex) => {
        const key = (data.width || 0) + 'x' + (data.height || 0);
        let arr = byQualityLevel.get(key);
        if (!arr) {
          arr = [];
          byQualityLevel.set(key, arr);
        }
        arr.push({
          level: data.id,
          bitrate: data.bandwidth,
          width: data.width,
          height: data.height,
          isMP4: this.isTrackMP4(track),
          track,
        });
      });
    });

    const result = [];
    byQualityLevel.forEach((arr, key) => {
      const mp4Arr = arr.filter((o) => o.isMP4);
      if (mp4Arr.length > 0) {
        arr = mp4Arr;
      }

      arr.sort((a, b) => {
        return a.bitrate - b.bitrate;
      });

      if (key === '0x0') {
        arr.forEach((data) => {
          result.push(data);
        });
      } else {
        result.push(arr[0]);
      }
    });

    // sort by bitrate
    result.sort((a, b) => {
      return a.bitrate - b.bitrate;
    });

    return result;
  }

  static getLevelList(tracks, lang) {
    tracks = this.prioritizeLang(tracks, lang);
    tracks = this.filterTracksByCodec(tracks);
    const result = this.prioritizeMP4WithQuality(tracks);
    // make into map
    const map = new Map();
    result.forEach((data) => {
      map.set(data.level, data);
    });
    return map;
  }

  static filterTracks(tracks, lang, defaultQuality) {
    if (tracks.length > 1) {
      tracks = this.filterTracksByCodec(tracks);
    }

    if (tracks.length > 1) {
      tracks = this.prioritizeLang(tracks, lang);
    }

    if (tracks.length > 1) {
      tracks = this.filterByRole(tracks, 'main');
    }

    if (tracks.length > 1) {
      if (tracks[0].type === 'video') {
        const levelList = this.getLevelList(tracks, lang);
        const chosenQuality = Utils.selectQuality(levelList, defaultQuality);
        tracks = [levelList.get(chosenQuality).track];
      } else {
        tracks = this.prioritizeMP4Tracks(tracks);
      }
    }

    if (tracks.length > 1) {
      tracks = this.trackSelectionModeHighestSelectionPriority(tracks);
    }

    return tracks;
  }
}

