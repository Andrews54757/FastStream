export class LevelManager {
  constructor(client) {
    this.client = client;

    this.currentVideoLevelID = null;
    this.currentAudioLevelID = null;
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

  getVideoLanguage() {
    return 'en-US'; // Placeholder implementation
  }

  getAudioLanguage() {
    return 'en-US'; // Placeholder implementation
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

  matchQuality(levels) {
    const desiredHeight = this.getDesiredVideoHeight();
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
        return a.level.bitrate - b.level.bitrate;
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

  isLevelMP4(level) {
    return (level.mimeType === 'video/mp4' || level.mimeType === 'audio/mp4');
  }

  pickVideoLevel(availableLevels) {
    // Check if current level is still valid
    if (this.currentVideoLevelID !== null) {
      const currentLevel = availableLevels.find((level) => level.id === this.currentVideoLevelID);
      if (currentLevel) {
        return currentLevel;
      }
    }

    // First, filter out incompatible levels
    availableLevels = availableLevels.filter((level) => {
      return (!level.videoCodec || MediaSource.isTypeSupported(level.videoCodec)) &&
             (!level.audioCodec || MediaSource.isTypeSupported(level.audioCodec));
    });

    // Next, pick language
    const lang = this.getVideoLanguage();
    const prioritizedLevels = availableLevels.filter((level) => {
      return !level.language || this.doLanguagesMatch(level.language, lang);
    });
    if (prioritizedLevels.length > 0) {
      availableLevels = prioritizedLevels;
    }

    // Sort by quality match
    availableLevels = this.matchQuality(availableLevels);

    // Prioritize mp4 levels
    const mp4Levels = availableLevels.filter((level) => {
      return this.isLevelMP4(level);
    });

    if (mp4Levels.length > 0 && mp4Levels[0].height === availableLevels[0].height) {
      availableLevels = mp4Levels;
    }

    return availableLevels[0] || null;
  }

  pickAudioLevel(availableLevels) {
    // Check if current level is still valid
    if (this.currentAudioLevelID !== null) {
      const currentLevel = availableLevels.find((level) => level.id === this.currentAudioLevelID);
      if (currentLevel) {
        return currentLevel;
      }
    }

    // First, filter out incompatible levels
    availableLevels = availableLevels.filter((level) => {
      return (!level.audioCodec || MediaSource.isTypeSupported(level.audioCodec));
    });

    // Next, pick language
    const lang = this.getAudioLanguage();
    const prioritizedLevels = availableLevels.filter((level) => {
      return !level.language || this.doLanguagesMatch(level.language, lang);
    });
    if (prioritizedLevels.length > 0) {
      availableLevels = prioritizedLevels;
    }

    // Prioritize mp4 levels
    const mp4Levels = availableLevels.filter((level) => {
      return this.isLevelMP4(level);
    });

    if (mp4Levels.length > 0) {
      availableLevels = mp4Levels;
    }

    return availableLevels[0] || null;
  }
}
