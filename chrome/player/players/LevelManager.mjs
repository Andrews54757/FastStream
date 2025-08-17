export class LevelManager {
  constructor(client) {
    this.client = client;

    this.currentVideoLevelID = null;
    this.currentAudioLevelID = null;

    this.currentVideoLanguage = null;
    this.currentAudioLanguage = null;

    this.prioritizedVideoContainer = 'mp4';
    this.prioritizedAudioContainer = 'mp4';

    this.prioritizedVideoCodec = null;
    this.prioritizedAudioCodec = null;

    this.shouldPreferDRCAudio = false;

    this.loadPreferences();
  }

  savePreferences() {
    clearTimeout(this.savePrefsTimeout);
    this.savePrefsTimeout = setTimeout(() => {
      this.savePreferencesInternal();
    }, 200);
  }

  savePreferencesInternal() {
    const savedPrefs = {
      videoLanguage: this.currentVideoLanguage,
      audioLanguage: this.currentAudioLanguage,
      prioritizedVideoContainer: this.prioritizedVideoContainer,
      prioritizedAudioContainer: this.prioritizedAudioContainer,
      prioritizedVideoCodec: this.prioritizedVideoCodec,
      prioritizedAudioCodec: this.prioritizedAudioCodec,
      shouldPreferDRCAudio: this.shouldPreferDRCAudio,
    };
    localStorage.setItem('level_manager_prefs', JSON.stringify(savedPrefs));
  }

  loadPreferences() {
    const prefsStr = localStorage.getItem('level_manager_prefs');
    if (!prefsStr) {
      return;
    }
    try {
      const prefs = JSON.parse(prefsStr);
      this.currentVideoLanguage = prefs.videoLanguage || null;
      this.currentAudioLanguage = prefs.audioLanguage || null;
      this.prioritizedVideoContainer = prefs.prioritizedVideoContainer || 'mp4';
      this.prioritizedAudioContainer = prefs.prioritizedAudioContainer || 'mp4';
      this.prioritizedVideoCodec = prefs.prioritizedVideoCodec || null;
      this.prioritizedAudioCodec = prefs.prioritizedAudioCodec || null;
      this.shouldPreferDRCAudio = prefs.shouldPreferDRCAudio || false;
    } catch (e) {
      console.warn('Failed to load level manager preferences:', e);
    }
  }

  reset() {
    this.currentVideoLevelID = null;
    this.currentAudioLevelID = null;
  }

  setCurrentVideoLevelID(levelID) {
    this.currentVideoLevelID = levelID;
  }

  setCurrentAudioLevelID(levelID) {
    this.currentAudioLevelID = levelID;
  }

  setCurrentVideoLanguage(language) {
    this.currentVideoLanguage = language;
    this.savePreferences();
  }

  setCurrentAudioLanguage(language) {
    this.currentAudioLanguage = language;
    this.savePreferences();
  }

  setPrioritizedVideoContainer(container) {
    this.prioritizedVideoContainer = container;
    this.savePreferences();
  }

  setPrioritizedAudioContainer(container) {
    this.prioritizedAudioContainer = container;
    this.savePreferences();
  }

  setPrioritizedVideoCodec(codec) {
    this.prioritizedVideoCodec = codec;
    this.savePreferences();
  }

  setPrioritizedAudioCodec(codec) {
    this.prioritizedAudioCodec = codec;
    this.savePreferences();
  }

  setShouldPreferDRCAudio(prefer) {
    this.shouldPreferDRCAudio = prefer;
    this.savePreferences();
  }

  getCurrentVideoLevelID() {
    return this.currentVideoLevelID;
  }

  getCurrentAudioLevelID() {
    return this.currentAudioLevelID;
  }

  getVideoLanguage() {
    return this.currentVideoLanguage || navigator.language || navigator.userLanguage || null;
  }

  getAudioLanguage() {
    return this.currentAudioLanguage || navigator.language || navigator.userLanguage || null;
  }

  getDesiredVideoHeight() {
    const defaultQuality = 'Auto'; // Placeholder, should be fetched from config
    if (defaultQuality === 'Auto') {
      const qualityMultiplier = 1.1;
      return window.innerHeight * window.devicePixelRatio * qualityMultiplier;
    } else {
      return parseInt(defaultQuality.replace('p', ''));
    }
  }

  matchQuality(levels, desiredHeight) {
    const list = [];
    levels.forEach((level) => {
      list.push({
        level,
        diff: Math.abs(level.height - desiredHeight),
      });
    });

    // Sort by height difference and then by bitrate. Choose highest bitrate if multiple have the same height difference
    list.sort((a, b) => {
      if (a.diff === b.diff) {
        return b.level.bitrate - a.level.bitrate;
      }
      return a.diff - b.diff;
    });

    return list.map((item) => item.level);
  }

  doLanguagesMatch(lang1, lang2) {
    if (!lang1 || !lang2) {
      return false;
    }

    const langArr1 = lang1.split('-');
    const langArr2 = lang2.split('-');

    if (langArr1[0] !== langArr2[0]) {
      return false;
    }

    if (langArr1.length > 1 && langArr2.length > 1) {
      return langArr1[1] === langArr2[1];
    }

    return true;
  }

  isLevelContainerPrioritized(level) {
    if (!level || !level.mimeType) {
      return false;
    }

    // split
    const mimeParts = level.mimeType.split('/');
    if (mimeParts.length < 2) {
      return false;
    }

    const container = mimeParts[1].toLowerCase();
    if (level.videoCodec) {
      return container.includes(this.prioritizedVideoContainer);
    } else if (level.audioCodec) {
      return container.includes(this.prioritizedAudioContainer);
    } else {
      return false;
    }
  }

  isCodecSupported(codec) {
    return true;
  }

  pickVideoLevel(availableLevels, desiredHeight = null, ignoreCurrent = false) {
    // Check if current level is still valid
    if (!ignoreCurrent && this.currentVideoLevelID !== null) {
      const currentLevel = availableLevels.find((level) => level.id === this.currentVideoLevelID);
      if (currentLevel) {
        return currentLevel;
      }
    }

    // First, filter out incompatible levels
    availableLevels = availableLevels.filter((level) => {
      return (!level.videoCodec || this.isCodecSupported(level.videoCodec)) &&
                (!level.audioCodec || this.isCodecSupported(level.audioCodec));
    });

    // Next, pick language
    availableLevels = this.filterVideoLevelsByLanguage(availableLevels);


    // Sort by quality match
    desiredHeight = desiredHeight || this.getDesiredVideoHeight();
    availableLevels = this.matchQuality(availableLevels, desiredHeight);

    // Prioritize mp4 levels
    const containerLevels = availableLevels.filter((level) => {
      return this.isLevelContainerPrioritized(level);
    });

    if (containerLevels.length > 0 && containerLevels[0].height === availableLevels[0].height) {
      availableLevels = containerLevels;
    }

    // Prioritize codec
    const codecLevels = availableLevels.filter((level) => {
      return level.videoCodec && this.prioritizedVideoCodec && level.videoCodec === this.prioritizedVideoCodec;
    });
    if (codecLevels.length > 0 && codecLevels[0].height === availableLevels[0].height) {
      availableLevels = codecLevels;
    }

    return availableLevels[0] || null;
  }

  pickAudioLevel(availableLevels, ignoreCurrent = false) {
    // Check if current level is still valid
    if (!ignoreCurrent && this.currentAudioLevelID !== null) {
      const currentLevel = availableLevels.find((level) => level.id === this.currentAudioLevelID);
      if (currentLevel) {
        return currentLevel;
      }
    }

    // First, filter out incompatible levels
    availableLevels = availableLevels.filter((level) => {
      return (!level.audioCodec || this.isCodecSupported(level.audioCodec));
    });

    // Next, pick language
    availableLevels = this.filterAudioLevelsByLanguage(availableLevels);

    // Prioritize DRC levels if enabled
    if (this.shouldPreferDRCAudio) {
      const drcLevels = availableLevels.filter((level) => {
        return level.id.includes('-drc');
      });
      if (drcLevels.length > 0) {
        availableLevels = drcLevels;
      }
    }

    // Prioritize mp4 levels
    const containerLevels = availableLevels.filter((level) => {
      return this.isLevelContainerPrioritized(level);
    });

    if (containerLevels.length > 0) {
      availableLevels = containerLevels;
    }

    // Prioritize codec
    const codecLevels = availableLevels.filter((level) => {
      return level.audioCodec && this.prioritizedAudioCodec && level.audioCodec === this.prioritizedAudioCodec;
    });
    if (codecLevels.length > 0) {
      availableLevels = codecLevels;
    }

    // Sort by bitrate descending
    availableLevels.sort((a, b) => {
      return b.bitrate - a.bitrate;
    });

    return availableLevels[0] || null;
  }

  filterVideoLevelsByLanguage(availableLevels) {
    const lang = this.getAudioLanguage();
    const filtered = availableLevels.filter((level) => {
      return !level.language || this.doLanguagesMatch(level.language, lang);
    });
    if (filtered.length === 0) {
      return availableLevels;
    }
    return filtered;
  }

  filterAudioLevelsByLanguage(availableLevels) {
    const lang = this.getAudioLanguage();
    const filtered = availableLevels.filter((level) => {
      return !level.language || this.doLanguagesMatch(level.language, lang);
    });
    if (filtered.length === 0) {
      return availableLevels;
    }
    return filtered;
  }
}
