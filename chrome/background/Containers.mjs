export class FrameHolder {
  constructor(frameId, parent, tab) {
    if (parent === undefined) throw new Error('Parent is undefined');
    this.frame = frameId;
    this.parent = parent;
    this.urls = [];

    this.sources = [];
    this.requests = {};

    this.requests = [];
    this.tab = tab;
    this.subtitles = [];

    this.isMain = frameId === 0;


    this.url = '';
  }
}

export class TabHolder {
  constructor(tabId) {
    this.tab = tabId;
    this.isOn = false;
    this.complete = false;
    this.regexMatched = false;
    this.frames = {};
    this.hostname;
    this.analyzerData = undefined;
  }
  addFrame(frameId, parent) {
    this.frames[frameId] = new FrameHolder(frameId, parent, this);
  }
}

