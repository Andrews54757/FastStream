import {DefaultOptions} from './options/defaults/DefaultOptions.mjs';
import {PlayerModes} from './player/enums/PlayerModes.mjs';
import {Utils} from './player/utils/Utils.mjs';

let options = {};

const autoEnableRegexes = [];

const version = chrome.runtime.getManifest().version;
const logging = false;
const playerURL = chrome.runtime.getURL('player/player.html');
const tabs = {};


chrome.runtime.onInstalled.addListener(function(object) {
  chrome.storage.local.get('welcome', function(result) {
    if (!result || !result.welcome) {
      if (logging) console.log(result);
      chrome.tabs.create({
        url: chrome.runtime.getURL('welcome.html'),
      }, function(tab) {
        chrome.storage.local.set({
          welcome: true,
        });
      });
    }
  });
});

chrome.tabs.query({url: '*://*/*'}).then((ctabs) => {
  ctabs.forEach((tab) => {
    if (!tabs[tab.id]) tabs[tab.id] = new TabHolder(tab.id);
    updateTabIcon(tab.id, true);
  });
});

class FrameHolder {
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
class TabHolder {
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

class RuleEntry {
  constructor(id) {
    this.id = id;
    this.expiresAt = Date.now() + 1000 * 5;
  }
}

class RuleManager {
  constructor() {
    this.rules = [];
    this.isLoopRunning = false;
    this.dumpRules();
  }

  getInsertionIndex(id) {
    // use binary search
    let min = 0;
    let max = this.rules.length - 1;
    let mid = 0;
    while (min <= max) {
      mid = Math.floor((min + max) / 2);
      if (this.rules[mid].id < id) {
        min = mid + 1;
      } else if (this.rules[mid].id > id) {
        max = mid - 1;
      } else {
        return -1;
      }
    }
    return min;
  }

  startLoop() {
    if (this.isLoopRunning) return;
    this.isLoopRunning = true;
    this.mainLoop();
  }

  mainLoop() {
    if (this.rules.length === 0) {
      this.isLoopRunning = false;
      return;
    }
    setTimeout(() => this.mainLoop(), 1000);
    this.filterRules();
  }

  async filterRules() {
    const now = Date.now();
    const removed = [];
    this.rules = this.rules.filter((rule) => {
      if (rule.expiresAt < now) {
        removed.push(rule);
        return false;
      }
      return true;
    });

    return chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: removed.map((rule) => rule.id),
    });
  }

  async addHeaderRule(url, tabId, requestHeaderCommands) {
    const rule = new RuleEntry(this.getNextID());
    //   if (logging) console.log("Adding rule", rule.id, url, tabId, requestHeaderCommands)

    // insert rule in order
    const index = this.getInsertionIndex(rule.id);
    if (index === -1) throw new Error('Rule already exists');
    this.rules.splice(index, 0, rule);

    const ruleObj = {
      id: rule.id,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: requestHeaderCommands,
      },
      condition: {
        urlFilter: '||' + url.replace('https://', '').replace('http://', ''),
        tabIds: [tabId],
      },
    };

    await chrome.declarativeNetRequest.updateSessionRules({
      addRules: [ruleObj],
    });

    this.startLoop();
    return rule;
  }

  getNextID() {
    let nextRuleID = 10;
    for (let i = 0; i < this.rules.length; i++) {
      const rule = this.rules[i];
      if (rule.id === nextRuleID) {
        nextRuleID++;
      } else {
        break;
      }
    }
    return nextRuleID;
  }

  async dumpRules() {
    const rules = await chrome.declarativeNetRequest.getSessionRules();
    if (logging) console.log('Dumping ' + rules.length + ' rules');
    return chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: rules.map((rule) => rule.id),
    });
  }
}


const ruleManager = new RuleManager();

let tabIconTimeout = null;
function updateTabIcon(tab, skipNotify) {
  clearTimeout(tabIconTimeout);
  if (tab.isOn) {
    chrome.action.setBadgeText({
      text: 'On',
      tabId: tab.tab,
    });
    chrome.action.setIcon({
      path: '/icon2_128.png',
      tabId: tab.tab,
    });
  } else {
    chrome.action.setIcon({
      path: '/icon128.png',
      tabId: tab.tab,
    });
    if (skipNotify) {
      chrome.action.setBadgeText({
        text: '',
        tabId: tab.tab,
      });
    } else {
      chrome.action.setBadgeText({
        text: 'Off',
        tabId: tab.tab,
      });
      tabIconTimeout = setTimeout(function() {
        chrome.action.setBadgeText({
          text: '',
          tabId: tab.tab,
        });
      }, 1000);
    }
  }
}
function onClicked(tab) {
  if (!tabs[tab.id]) tabs[tab.id] = new TabHolder(tab.id);

  if (tab.url && tab.url !== 'about:newtab' && tab.url !== 'chrome://newtab/') {
    tabs[tab.id].isOn = !tabs[tab.id].isOn;

    updateTabIcon(tabs[tab.id]);
    if (tabs[tab.id].isOn) {
      openPlayersWithSources(tab.id);
    }
  } else {
    if (!tabs[tab.id].frames[0]) tabs[tab.id].addFrame(0, -1);
    //   tabs[tab.id].frames[0].source = "null"
    chrome.tabs.update(tab.id, {
      url: playerURL,
    }, () => {


    });
  }
}
chrome.action.onClicked.addListener(function(tab) {
  onClicked(tab);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ping') {
    sendResponse('pong');
    return;
  }

  if (msg.type === 'welcome') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('welcome.html'),
    }, function(tab) {

    });
    return;
  }

  if (msg.type === 'options') {
    loadOptions();
    return;
  }

  if (!tabs[sender.tab.id]) {
    tabs[sender.tab.id] = new TabHolder(sender.tab.id);
  }
  const tab = tabs[sender.tab.id];

  if (!tabs[sender.tab.id].frames[sender.frameId]) {
    const parentFrameId = -2;
    tabs[sender.tab.id].addFrame(sender.frameId, parentFrameId);
  }

  const frame = tabs[sender.tab.id].frames[sender.frameId];

  if (msg.type === 'header_commands') {
    if (msg.commands.length) {
      ruleManager.addHeaderRule(msg.url, sender.tab.id, msg.commands).then((rule) => {
        if (logging) console.log('Added rule', msg, rule);
        sendResponse();
      });
      return true;
    } else {
      sendResponse();
    }
  } else if (msg.type === 'fullscreen') {
    chrome.tabs.sendMessage(frame.tab.tab, {
      type: 'fullscreen',
      frameId: frame.frame,
    }, {
      frameId: frame.parent,
    });
  } else if (msg.type === 'faststream') {
    if (logging) console.log('Found FastStream window', frame);
    frame.isFastStream = true;
    frame.playerOpening = false;

    if (frame.parent === -2 && frame.frame != msg.frameId) {
      frame.parent = msg.frameId;
    }

    chrome.tabs.sendMessage(frame.tab.tab, {
      type: 'init',
      frameId: frame.frame,
    }, {
      frameId: frame.frame,
    });


    chrome.tabs.sendMessage(frame.tab.tab, {
      type: 'media_name',
      name: getMediaNameFromTab(sender?.tab),
    }, {
      frameId: frame.frame,
    });

    chrome.tabs.sendMessage(frame.tab.tab, {
      type: 'settings',
      options: options,
    }, {
      frameId: frame.frame,
    });

    chrome.tabs.sendMessage(frame.tab.tab, {
      type: 'analyzerData',
      data: tab.analyzerData,
    }, {
      frameId: frame.frame,
    });
  } else if (msg.type === 'analyzerData') {
    if (logging) console.log('Analyzer data', msg.data);
    tab.analyzerData = msg.data;
  } else if (msg.type === 'iframe_controls') {
    frame.frame_referer = msg.mode == PlayerModes.IFRAME ? msg.referer : null;
    if (logging) console.log('Iframe-controls', frame.frame_referer);
  } else if (msg.type === 'iframe') {
    frame.url = msg.url;
    if (frame.url.substring(0, playerURL.length) !== playerURL) {
      //  console.log("reset frame sources")
      frame.subtitles.length = 0;
      frame.sources.length = 0;
      frame.isFastStream = false;
      frame.playerOpening = false;
    }
  } else if (msg.type === 'loaded') {
    chrome.tabs.sendMessage(frame.tab.tab, {
      type: 'init',
      frameId: frame.frame,
    }, {
      frameId: frame.frame,
    });
  } else if (msg.type === 'yt_loaded') {
    frame.url = msg.url;
    checkYTURL(frame);
  } else if (msg.type === 'ready') {
    if (logging) console.log('Ready');
    frame.ready = true;

    sendSources(frame);
  }
});

function checkYTURL(frame) {
  const url = frame.url;
  // Check if url is youtube

  if (url.substring(0, playerURL.length) === playerURL) {
    return;
  }

  if (Utils.is_url_yt(url) && Utils.is_url_yt_watch(url)) {
    onSourceRecieved({
      url: url,
      requestId: -1,
    }, frame, PlayerModes.ACCELERATED_YT);
  }
}
function getMediaNameFromTab(tab) {
  if (!tab || tab.url === playerURL) return;
  // Get name of website through tab url
  const url = new URL(tab.url);
  const hostname = url.hostname;
  let name = hostname.split('.');
  name = name[name.length - 2];

  if (!name) return;

  let title = tab.title || '';

  // First, remove any special characters
  title = title.replace(/[^a-zA-Z0-9 ]/g, '');

  // Split the title into words
  let words = title.split(' ');

  // Remove any words too similar to the website name
  words = words.filter((word) => {
    return word.length > 0 && (word.length <= 3 || Utils.levenshteinDistance(word.toLowerCase(), name.toLowerCase()) >= Math.ceil(name.length * 0.4));
  });

  // Remove words like TV, Movie, HD, etc...
  // List generated by AI
  const wordsToExclude = ['tv', 'movie', 'hd', 'full', 'free', 'online', 'stream', 'streaming', 'watch', 'now', 'watching', 'episode', 'season', 'series', 'anime', 'show', 'shows', 'episodes', 'seasons', 'part', 'parts', 'sub', 'dub', 'subdub', 'subbed', 'dubbed', 'english', 'subtitles', 'subtitle'];

  words = words.filter((word) => {
    return !wordsToExclude.includes(word.toLowerCase());
  });

  return words.join(' ');
}
function mergeOptions(defaultOptions, newOptions) {
  const options = {};
  for (const prop in defaultOptions) {
    if (Object.hasOwn(defaultOptions, prop)) {
      const opt = defaultOptions[prop];
      if (typeof opt === 'object' && !Array.isArray(opt)) {
        options[prop] = mergeOptions(opt, newOptions[prop] || {});
      } else {
        options[prop] = (Object.hasOwn(newOptions, prop) && typeof newOptions[prop] === typeof opt) ? newOptions[prop] : opt;
      }
    }
  }
  return options;
}

function loadOptions() {
  chrome.storage.local.get({
    options: '{}',
  }, (results) => {
    const newOptions = JSON.parse(results.options) || {};

    options = mergeOptions(DefaultOptions, newOptions);

    chrome.storage.local.set({
      options: JSON.stringify(options),
    });


    chrome.tabs.query({}, function(tabs) {
      const message = {
        type: 'settings',
        options: options,
      };
      for (let i = 0; i < tabs.length; ++i) {
        chrome.tabs.sendMessage(tabs[i].id, message);
      }
    });


    if (options.playMP4URLs) {
      setupRedirectRule(1, ['mp4']);
    } else {
      removeRule(1);
    }

    if (options.playStreamURLs) {
      setupRedirectRule(2, ['m3u8', 'mpd']);
    } else {
      removeRule(2);
    }

    autoEnableRegexes.length = 0;
    options.autoEnableURLs.forEach((regexStr)=>{
      autoEnableRegexes.push(new RegExp(regexStr));
    });
  });
}

async function setupRedirectRule(ruleID, filetypes) {
  const rule = {
    id: ruleID,
    action: {
      type: 'redirect',
      redirect: {regexSubstitution: playerURL + '#\\0'},
    },
    condition: {
      // exclude self
      excludedRequestDomains: [(new URL(playerURL)).hostname],
      // only match m3u8 or mpds
      regexFilter: '^.+\\.(' + filetypes.join('|') + ')$',
      resourceTypes: ['main_frame'],
    },
  };
  return chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [rule.id],
    addRules: [rule],
  });
}

async function removeRule(ruleID) {
  return chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [ruleID],
  });
}

function handleSubtitles(url, frame, headers) {
  if (frame.subtitles.find((a) => {
    return a.source === url;
  })) return;

  if (logging) console.log('Found subtitle', url);
  const u = (new URL(url)).pathname.split('/').pop();

  frame.subtitles.push({
    source: url,
    headers: headers,
    label: u.split('.')[0],
  });
}
function getSourceFromURL(frame, url) {
  return frame.sources.find((a) => {
    return a.url === url;
  });
}

function addSource(frame, url, mode, headers) {
  frame.sources.push({
    url, mode, headers,
  });
}

function sendSources(frame) {
  const subtitles = [];
  const sources = [];

  let currentFrame = frame;
  while (currentFrame) {
    for (let i = 0; i < currentFrame.subtitles.length; i++) {
      subtitles.push(currentFrame.subtitles[i]);
    }

    for (let i = 0; i < currentFrame.sources.length; i++) {
      sources.push(currentFrame.sources[i]);
    }

    if (currentFrame === frame) {
      currentFrame.sources.length = 0;
      currentFrame.subtitles.length = 0;
    }

    if (currentFrame.sources.length !== 0) break;
    currentFrame = frame.tab.frames[currentFrame.parent];
  }

  chrome.tabs.sendMessage(frame.tab.tab, {
    type: 'sources',
    subtitles: subtitles,
    sources: sources,
  }, {
    frameId: frame.frame,
  });
}

function getOrCreateFrame(details) {
  if (!tabs[details.tabId]) tabs[details.tabId] = new TabHolder(details.tabId);
  const tab = tabs[details.tabId];

  if (!tab.frames[details.frameId]) tab.addFrame(details.frameId, details.parentFrameId);
  const frame = tab.frames[details.frameId];

  if (details.parentFrameId !== frame.parent) {
    frame.parent = details.parentFrameId;
  }

  return frame;
}
function isSubtitles(ext) {
  return ext == 'vtt' || ext == 'srt';
}

async function scrapeCaptionsTags(frame) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(frame.tab.tab, {
      type: 'scrape_captions',
    }, {
      frameId: frame.frame,
    }, (sub) => {
      resolve(sub);
    });
  });
}

async function getVideoSize(frame) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(frame.tab.tab, {
      type: 'get_video_size',
    }, {
      frameId: frame.frame,
    }, (size) => {
      resolve(size);
    });
  });
}

async function openPlayer(frame) {
  if (frame.playerOpening || frameHasPlayer(frame)) {
    return;
  }

  frame.playerOpening = true;

  return chrome.tabs.sendMessage(frame.tab.tab, {
    type: 'player',
    url: playerURL + '?frame_id=' + frame.frame,
  }, {
    frameId: frame.frame,
  });
}
let currentTimeout = null;
async function onSourceRecieved(details, frame, mode) {
  if (((frame.url && Utils.is_url_yt(frame.url)) || (frame.tab.url && Utils.is_url_yt(frame.tab.url))) && mode !== PlayerModes.ACCELERATED_YT) {
    return;
  }
  const url = details.url;
  if (getSourceFromURL(frame, url)) return;

  addSource(frame, url, mode, frame.requests[details.requestId]);
  await scrapeCaptionsTags(frame).then((sub) => {
    if (sub) {
      sub.forEach((s) => {
        if (frame.subtitles.every((ss, i) => {
          if (s.source == ss.source) {
            frame.subtitles[i] = s;
            return false;
          }
          return true;
        })) frame.subtitles.push(s);
      });
    }
  });

  if (frame.tab.isOn) {
    clearTimeout(currentTimeout);
    currentTimeout = setTimeout(() => {
      if (frame.tab.isOn) {
        openPlayer(frame);
      }
    }, mode === PlayerModes.ACCELERATED_MP4 ? 1500 : 200);
  }

  if (logging) console.log('Found source', details, frame);

  return;
}

async function openPlayersWithSources(tabid) {
  if (!tabs[tabid]) return;
  const tab = tabs[tabid];

  let framesWithSources = [];
  for (const i in tab.frames) {
    if (Object.hasOwn(tab.frames, i)) {
      const frame = tab.frames[i];
      if (!frame || frameHasPlayer(frame)) continue;
      if (frame.sources.length > 0) {
        framesWithSources.push(frame);
      }
    }
  }

  if (framesWithSources.length > 0) {
    framesWithSources = await Promise.all(framesWithSources.map(async (frame) => {
      return {frame, videoSize: await getVideoSize(frame)};
    }));

    framesWithSources.sort((a, b) => {
      return b.videoSize - a.videoSize;
    });

    // console.log("Opening player from source recieved2", framesWithSources)
    for (let i = 0; i < framesWithSources.length; i++) {
      openPlayer(framesWithSources[i].frame);
    }
  }
}
chrome.webRequest.onBeforeSendHeaders.addListener((details) => {
  const frame = getOrCreateFrame(details);
  frame.requests[details.requestId] = details.requestHeaders;
}, {
  urls: ['<all_urls>'],
}, ['requestHeaders', 'extraHeaders']);

function frameHasPlayer(frame) {
  return frame.isFastStream || frame.url.substring(0, playerURL.length) === playerURL;
}

chrome.webRequest.onHeadersReceived.addListener(
    function(details) {
      const url = details.url;
      const ext = Utils.get_url_extension(url);
      const frame = getOrCreateFrame(details);
      if (frameHasPlayer(frame)) return;

      if (isSubtitles(ext)) {
        return handleSubtitles(url, frame, frame.requests[details.requestId]);
      }
      let mode = Utils.getModeFromExtension(ext);
      if (!mode) {
        if (details.type === 'media') {
          mode = PlayerModes.ACCELERATED_MP4;
        } else {
          return;
        }
      }

      onSourceRecieved(details, frame, mode);
    }, {
      urls: ['<all_urls>'],
    }, ['responseHeaders', 'extraHeaders'],
);

chrome.webRequest.onHeadersReceived.addListener(deleteHeaderCache, {
  urls: ['<all_urls>'],
});


chrome.webRequest.onErrorOccurred.addListener(deleteHeaderCache, {
  urls: ['<all_urls>'],
});

function deleteHeaderCache(details) {
  const frame = getOrCreateFrame(details);
  delete frame.requests[details.requestId];
}
chrome.tabs.onRemoved.addListener(function(tabid, removed) {
  delete tabs[tabid];
});

chrome.tabs.onUpdated.addListener(function(tabid, changeInfo, tab) {
  if (tabs[tabid]) {
    if (changeInfo.url) {
      const url = new URL(changeInfo.url);
      if (tabs[tabid].hostname && tabs[tabid].hostname !== url.hostname) {
        tabs[tabid].analyzerData = undefined;
      }
      tabs[tabid].hostname = url.hostname;

      const foundRegex = autoEnableRegexes.some((regex)=>{
        try {
          return regex.test(changeInfo.url);
        } catch (e) {

        }
        return false;
      });

      if (foundRegex && !tabs[tabid].regexMatched) {
        tabs[tabid].regexMatched = true;
        tabs[tabid].isOn = true;
        openPlayersWithSources(tab.id);
      } else if (!foundRegex && tabs[tabid].regexMatched) {
        tabs[tabid].isOn = false;
        tabs[tabid].regexMatched = false;
      }
    }
    if (changeInfo.status === 'complete') {
      tabs[tabid].complete = true;
    } else if (changeInfo.status === 'loading') {
      tabs[tabid].complete = false;
    }

    updateTabIcon(tabs[tabid], true);
  }
});

loadOptions();
setInterval(chrome.runtime.getPlatformInfo, 20e3);

console.log('\n %c %c %cFast%cStream %c-%c ' + version + ' %c By Andrews54757 \n', 'background: url(https://user-images.githubusercontent.com/13282284/57593160-3a4fb080-7508-11e9-9507-33d45c4f9e41.png) no-repeat; background-size: 16px 16px; padding: 2px 6px; margin-right: 4px', 'background: rgb(50,50,50); padding:5px 0;', 'color: rgb(200,200,200); background: rgb(50,50,50); padding:5px 0;', 'color: rgb(200,200,200); background: rgb(50,50,50); padding:5px 0;', 'color: rgb(200,200,200); background: rgb(50,50,50); padding:5px 0;', 'color: #afbc2a; background: rgb(50,50,50); padding:5px 0;', 'color: black; background: #e9e9e9; padding:5px 0;');
