import {DOMElements} from './DOMElements.mjs';

export const StatusTypes = {
  WELCOME: 'welcome',
  DOWNLOAD: 'download',
  INFO: 'info',
  ERROR: 'error',
  SAVE_VIDEO: 'save-video',
  SAVE_SCREENSHOT: 'save-screenshot',
  SAVE_GIF: 'save-gif',
  SUBTITLES: 'subtitles',
  CHAPTER: 'chapter',
};

export class StatusManager {
  constructor() {
    this.statusMessages = new Map();

    this.registerStatusLevel(StatusTypes.WELCOME);
    this.registerStatusLevel(StatusTypes.DOWNLOAD);
    this.registerStatusLevel(StatusTypes.INFO);
    this.registerStatusLevel(StatusTypes.ERROR);

    this.registerStatusLevel(StatusTypes.SAVE_VIDEO, 1);
    this.registerStatusLevel(StatusTypes.SAVE_SCREENSHOT, 1);
    this.registerStatusLevel(StatusTypes.SAVE_GIF, 1);
    this.registerStatusLevel(StatusTypes.SUBTITLES, 1);

    this.registerStatusLevel(StatusTypes.CHAPTER, 2);
  }

  registerStatusLevel(key, channel) {
    const level = {
      key,
      message: '',
      type: 'info',
      expiry: 0,
      channel: channel || 0,
      maxWidth: 0,
    };
    this.statusMessages.set(key, level);
  }

  setStatusMessage(key, message, type, expiry) {
    const level = this.statusMessages.get(key);
    if (!level) {
      throw new Error(`Unknown status level ${key}`);
    }

    level.message = message;
    level.type = type || 'info';
    level.expiry = expiry ? (Date.now() + expiry) : 0;
    this.updateStatusMessage();
  }

  getStatusMessage(key) {
    const level = this.statusMessages.get(key);
    if (!level) {
      throw new Error(`Unknown status level ${key}`);
    }

    return level.message;
  }

  updateStatusMessage() {
    const elements = DOMElements.statusMessages;
    const toDisplayList = new Array(elements.length).fill(null);
    this.statusMessages.forEach((level) => {
      if (level.expiry && Date.now() > level.expiry) {
        level.message = '';
      }
      if (level.message) {
        toDisplayList[level.channel] = level;
      }
    });

    let displayCount = 0;
    toDisplayList.forEach((toDisplay, index) => {
      const element = elements[index];
      if (!toDisplay) {
        element.style.display = 'none';
        return;
      }

      displayCount++;

      element.style.width = '';
      element.style.display = '';
      element.textContent = toDisplay.message;
      element.title = toDisplay.message;
      element.className = `status_message ${toDisplay.type}`;
    });

    if (displayCount > 1) {
      // Fix the widths of the earlier status messages
      let lastFound = false;
      for (let i = toDisplayList.length - 1; i >= 0; i--) {
        const toDisplay = toDisplayList[i];
        if (!toDisplay) {
          continue;
        }

        if (!lastFound) {
          lastFound = true;
          continue;
        }

        const element = elements[i];
        const width = element.offsetWidth + 5;

        toDisplay.maxWidth = Math.max(toDisplay.maxWidth, width);
        element.style.width = toDisplay.maxWidth + 'px';
      }
    } else {
      this.statusMessages.forEach((level) => {
        level.maxWidth = 0;
      });
    }
  }
}
