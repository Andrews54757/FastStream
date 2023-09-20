export class FrameHolder {
  constructor(frameId, parentId, tab) {
    if (parentId === undefined) throw new Error('Parent is undefined');
    this.frameId = frameId;
    this.parentId = parentId;
    this.sources = [];
    this.subtitles = [];
    this.requestHeaders = [];
    this.tab = tab;
    this.url = '';
    this.playerOpening = false;
    this.isFastStream = false;
    this.ready = false;
  }
}

export class TabHolder {
  constructor(tabId) {
    this.tabId = tabId;
    this.isOn = false;
    this.complete = false;
    this.regexMatched = false;
    this.frames = {};
    this.hostname;
    this.analyzerData = undefined;
    this.url = '';
  }
  addFrame(frameId, parent) {
    this.frames[frameId] = new FrameHolder(frameId, parent, this);
  }
}

