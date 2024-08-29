import {PlayerModes} from '../player/enums/PlayerModes.mjs';
import {EnvUtils} from '../player/utils/EnvUtils.mjs';
import {StringUtils} from '../player/utils/StringUtils.mjs';
import {URLUtils} from '../player/utils/URLUtils.mjs';
import {Utils} from '../player/utils/Utils.mjs';
import {BackgroundUtils} from './BackgroundUtils.mjs';
import {TabHolder} from './Containers.mjs';
import {MultiRegexMatcher} from './MultiRegexMatcher.mjs';
import {RuleManager} from './NetRequestRuleManager.mjs';
import {SponsorBlockIntegration} from './SponsorBlockIntegration.mjs';
import {StreamSaverBackend} from './StreamSaverBackend.mjs';

let Options = {};
const OptionsCache = {};

const AutoEnableList = [];
const ExtensionVersion = chrome.runtime.getManifest().version;
const Logging = false;
const PlayerURL = chrome.runtime.getURL('player/index.html');
const CachedTabs = {};

let CustomSourcePatternsMatcher = new MultiRegexMatcher();

const sponsorBlockBackend = new SponsorBlockIntegration();
sponsorBlockBackend.setup();
try {
  sponsorBlockBackend.setup(self);
} catch (e) {
  console.error(e);
}

chrome.runtime.onInstalled.addListener((object) => {
  chrome.storage.local.get('welcome', (result) => {
    if (!result || !result.welcome) {
      if (Logging) console.log(result);
      chrome.tabs.create({
        url: chrome.runtime.getURL('welcome.html'),
      }, (tab) => {
        chrome.storage.local.set({
          welcome: true,
        });
      });
    }
  });
});

chrome.tabs.query({url: '*://*/*'}).then((ctabs) => {
  ctabs.forEach((tab) => {
    if (!CachedTabs[tab.id]) CachedTabs[tab.id] = new TabHolder(tab.id);
    try {
      updateTabIcon(tab.id, true);
    } catch (e) {
      console.error(e);
    }
  });
});

const ruleManager = new RuleManager();

let tabIconTimeout = null;
function updateTabIcon(tab, skipNotify) {
  clearTimeout(tabIconTimeout);
  if (tab.isOn) {
    chrome.action.setBadgeText({
      text: 'On',
      tabId: tab.tabId,
    });
    chrome.action.setIcon({
      path: '/icon2_128.png',
      tabId: tab.tabId,
    });
  } else {
    chrome.action.setIcon({
      path: '/icon128.png',
      tabId: tab.tabId,
    });
    if (skipNotify) {
      chrome.action.setBadgeText({
        text: '',
        tabId: tab.tabId,
      });
    } else {
      chrome.action.setBadgeText({
        text: 'Off',
        tabId: tab.tabId,
      });
      tabIconTimeout = setTimeout(() => {
        chrome.action.setBadgeText({
          text: '',
          tabId: tab.tabId,
        });
      }, 1000);
    }
  }
}

async function onClicked(tab) {
  if (!CachedTabs[tab.id]) CachedTabs[tab.id] = new TabHolder(tab.id);

  // check permissions
  const hasPerms = await BackgroundUtils.checkPermissions();
  if (!hasPerms) {
    chrome.tabs.create({
      url: chrome.runtime.getURL('perms.html'),
    });
    return;
  }

  const emptyTabURLS = ['about:blank', 'about:home', 'about:newtab', 'about:privatebrowsing', 'chrome://newtab/'];
  if (tab.url && !emptyTabURLS.includes(tab.url)) {
    if (tab.url.substring(0, PlayerURL.length) !== PlayerURL) {
      CachedTabs[tab.id].isOn = !CachedTabs[tab.id].isOn;

      updateTabIcon(CachedTabs[tab.id]);
      if (CachedTabs[tab.id].isOn) {
        openPlayersWithSources(tab.id);
      } else {
        let hasPlayer = false;
        for (const i in CachedTabs[tab.id].frames) {
          if (Object.hasOwn(CachedTabs[tab.id].frames, i)) {
            const frame = CachedTabs[tab.id].frames[i];
            if (frame && frameHasPlayer(frame)) {
              hasPlayer = true;
              break;
            }
          }
        }

        if (hasPlayer) {
          CachedTabs[tab.id].frames = {};
          CachedTabs[tab.id].playerCount = 0;
          chrome.tabs.reload(tab.id);
        }
      }
    } else {
      CachedTabs[tab.id].isOn = !CachedTabs[tab.id].isOn;
      updateTabIcon(CachedTabs[tab.id]);
    }
  } else {
    if (!CachedTabs[tab.id].frames[0]) CachedTabs[tab.id].addFrame(0, -1);
    //   tabs[tab.id].frames[0].source = "null"
    CachedTabs[tab.id].frames[0].isMainPlayer = true;
    chrome.tabs.update(tab.id, {
      url: PlayerURL,
    }, () => {


    });
  }
}

chrome.action.onClicked.addListener((tab) => {
  onClicked(tab);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ping') {
    sendResponse('pong');
    return;
  }

  if (msg.type === 'options_init') {
    loadOptions();
    // sent to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (CachedTabs[tab.id]) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'options',
            time: msg.time,
          }, (response) => {
            BackgroundUtils.checkMessageError('options', true);
          });
        }
      });
    });
    return;
  }

  if (!CachedTabs[sender.tab.id]) {
    CachedTabs[sender.tab.id] = new TabHolder(sender.tab.id);
  }
  const tab = CachedTabs[sender.tab.id];

  if (!CachedTabs[sender.tab.id].frames[sender.frameId]) {
    const parentFrameId = -2;
    CachedTabs[sender.tab.id].addFrame(sender.frameId, parentFrameId);
  }

  const frame = CachedTabs[sender.tab.id].frames[sender.frameId];

  if (msg.type === 'request_prevnext_video_poll') {
    sendToParent(frame, {
      type: 'prevnext_video_poll',
    }).then((result) => {
      sendResponse(result);
    });
    return true;
  } else if (msg.type === 'request_next_video' || msg.type === 'request_previous_video') {
    if (frame.replacedAll) {
      const parent = tab.frames[frame.parentId];
      if (parent) {
        const parentparent = tab.frames[parent.parentId];
        if (parentparent) {
          parentparent.continuationOptions = msg.continuationOptions;
        }
      }
    } else {
      const parent = tab.frames[frame.parentId];
      if (parent) {
        parent.continuationOptions = msg.continuationOptions;
      }
    }

    sendToParent(frame, {
      type: msg.type === 'request_next_video' ? 'next_video' : 'previous_video',
      continuationOptions: msg.continuationOptions,
    }).then((result) => {
      sendResponse(result);
    });
    return true;
  } else if (msg.type === 'seek_to') {
    // send to children
    for (const i in tab.frames) {
      if (Object.hasOwn(tab.frames, i)) {
        const frame = tab.frames[i];
        if (frame.parentId === sender.frameId) {
          chrome.tabs.sendMessage(frame.tab.tabId, {
            type: 'seek',
            time: msg.time,
          }, {
            frameId: frame.frameId,
          }, ()=>{
            BackgroundUtils.checkMessageError('seek');
          });
        }
      }
    }
  } else if (msg.type === 'transmit_key') {
    // send to children
    for (const i in tab.frames) {
      if (Object.hasOwn(tab.frames, i)) {
        const frame = tab.frames[i];
        if (frame.parentId === sender.frameId) {
          chrome.tabs.sendMessage(frame.tab.tabId, {
            type: 'keypress',
            key: msg.key,
          }, {
            frameId: frame.frameId,
          }, ()=>{
            BackgroundUtils.checkMessageError('keypress');
          });
        }
      }
    }
  } else if (msg.type === 'sponsor_block') {
    if (msg.action === 'getSkipSegments' && frame.frameId !== 0) {
      // send message to parent frame
      chrome.tabs.sendMessage(frame.tab.tabId, {
        type: 'scrape_sponsorblock',
        videoId: msg.videoId,
      }, {
        frameId: frame.parentId,
      }, (response) => {
        if (!response || response.error) {
          sendResponse(null);
          return;
        } else {
          sendResponse(response.segments);
        }
      });
      return true;
    }

    return sponsorBlockBackend.onPlayerMessage(msg, sendResponse);
  } else if (msg.type === 'header_commands') {
    if (msg.commands.length) {
      ruleManager.addHeaderRule(msg.url, sender.tab.id, msg.commands).then((rule) => {
        if (Logging) console.log('Added rule', msg, rule);
        sendResponse();
      });
      return true;
    }
  } else if (msg.type === 'request_fullscreen') {
    sendToParent(frame, {
      type: 'fullscreen',
      force: msg.force,
    }).then((result) => {
      sendResponse(result);
    });
    return true;
  } else if (msg.type === 'request_windowed_fullscreen') {
    sendToParent(frame, {
      type: 'windowed_fullscreen',
      force: msg.force,
    }).then((result) => {
      sendResponse(result);
    });
    return true;
  } else if (msg.type === 'request_miniplayer') {
    sendToParent(frame, {
      type: 'miniplayer',
      size: msg.size,
      force: msg.force,
      autoExit: msg.autoExit,
      styles: msg.styles,
    }).then((result) => {
      sendResponse(result);
    });
    return true;
  } else if (msg.type ==='miniplayer_change_init') {
    const frame = tab.frames[msg.frameId];
    if (!frame) {
      return;
    }

    if (frame.parentId !== sender.frameId) {
      return;
    }

    let sendTo = msg.frameId;
    if (frame.replacedAll && frame.replacedBy) {
      sendTo = frame.replacedBy;
    }

    // send to msg.frameId
    chrome.tabs.sendMessage(frame.tab.tabId, {
      type: 'miniplayer_change',
      miniplayer: msg.miniplayer,
    }, {
      frameId: sendTo,
    }, ()=>{
      BackgroundUtils.checkMessageError('miniplayer_change');
    });
  } else if (msg.type ==='fullscreen_change_init') {
    // send to children
    for (const i in tab.frames) {
      if (Object.hasOwn(tab.frames, i)) {
        const frame = tab.frames[i];
        if (frame.parentId === sender.frameId) {
          let sendID = frame.frameId;
          if (frame.replacedAll && frame.replacedBy) {
            sendID = frame.replacedBy;
          }
          chrome.tabs.sendMessage(frame.tab.tabId, {
            type: 'fullscreen_change',
            fullscreen: msg.fullscreen,
          }, {
            frameId: sendID,
          }, ()=>{
            BackgroundUtils.checkMessageError('fullscreen_change');
          });
        }
      }
    }
  } else if (msg.type === 'faststream') {
    if (Logging) console.log('Found FastStream window', frame);
    frame.isFastStream = true;
    frame.url = msg.url;

    let isMainPlayer = frame.isMainPlayer;
    if (frame.parentId === -2 && frame.frameId != msg.frameId) {
      frame.parentId = msg.frameId;
    }

    if (!isMainPlayer && frame.parentId > -1) {
      const parentFrame = tab.frames[frame.parentId];
      if (parentFrame) {
        isMainPlayer = parentFrame.isMainPlayer;
      }
    }

    if (frame.parentId > -1) {
      const parentFrame = tab.frames[frame.parentId];
      if (parentFrame.replacedAll) {
        frame.replacedAll = true;
        parentFrame.replacedBy = frame.frameId;
      }
    }

    const response = {
      mediaInfo: getMediaInfoFromTab(sender?.tab),
      analyzerData: tab.analyzerData,
      isMainPlayer: isMainPlayer,
    };

    sendResponse(response);
    return;
  } else if (msg.type === 'analyzerData') {
    if (Logging) console.log('Analyzer data', msg.data);
    tab.analyzerData = msg.data;
  } else if (msg.type === 'iframe_controls') {
    frame.frame_referer = msg.mode === PlayerModes.IFRAME ? msg.referer : null;
    if (Logging) console.log('Iframe-controls', frame.frame_referer);
  } else if (msg.type === 'iframe') {
    frame.url = msg.url;
    frame.continuationOptions = null;
    if (frame.url.substring(0, PlayerURL.length) !== PlayerURL) {
      //  console.log("reset frame sources")
      frame.subtitles.length = 0;
      frame.sources.length = 0;
      frame.isFastStream = false;
      frame.replacedAll = false;
      frame.replacedBy = false;
      frame.playerOpening = false;
      frame.hasSentFrameId = false;
    }

    if (frame.frameId === 0) {
      // clear all other frames
      for (const i in tab.frames) {
        if (Object.hasOwn(tab.frames, i)) {
          const frame = tab.frames[i];
          if (!frame || frame.frameId !== 0) {
            delete tab.frames[i];
          }
        }
      }
    }

    checkURLMatch(frame);
  } else if (msg.type === 'loaded') {
    chrome.tabs.sendMessage(frame.tab.tabId, {
      type: 'init',
      frameId: frame.frameId,
    }, {
      frameId: frame.frameId,
    }, ()=>{
      BackgroundUtils.checkMessageError('init');
    });
  } else if (msg.type === 'yt_loaded') {
    frame.url = msg.url;
    checkYTURL(frame);
  } else if (msg.type === 'ready') {
    if (Logging) console.log('Ready');
    frame.ready = true;

    sendSources(frame);
  } else if (msg.type === 'detected_source') {
    const mode = URLUtils.getModeFromExtension(msg.ext);
    const headers = msg.headers || {};
    onSourceRecieved({
      url: msg.url,
      requestId: -1,
      customHeaders: headers,
    }, frame, mode);
  } else {
    return;
  }

  sendResponse('ok');
});

async function sendToParent(frame, message) {
  if (frame.replacedAll) {
    frame = frame.tab.frames[frame.parentId];
  }

  if (frame.parentId < 0) {
    return 'invalid';
  }

  const needsToSendFrameId = !frame.hasSentFrameId;
  if (needsToSendFrameId) {
    frame.hasSentFrameId = true;
    await (new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(frame.tab.tabId, {
        type: 'sendFrameId',
        frameId: frame.frameId,
      }, {
        frameId: frame.frameId,
      }, ()=>{
        BackgroundUtils.checkMessageError('sendFrameId');
        setTimeout(()=>{
          resolve();
        }, 100);
      });
    }));
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(frame.tab.tabId, {
      frameId: frame.frameId,
      ...message,
    }, {
      frameId: frame.parentId,
    }, (response) => {
      BackgroundUtils.checkMessageError('sendParent');
      resolve(response);
    });
  });
}

function checkYTURL(frame) {
  const url = frame.url;
  // Check if url is youtube

  if (url.substring(0, PlayerURL.length) === PlayerURL) {
    return;
  }

  if (URLUtils.is_url_yt(url) && URLUtils.is_url_yt_watch(url)) {
    onSourceRecieved({
      url: url,
      requestId: -1,
    }, frame, PlayerModes.ACCELERATED_YT);
  }
}

function checkURLMatch(frame) {
  const url = frame.url;
  const ext = CustomSourcePatternsMatcher.match(url);
  if (ext) {
    const mode = URLUtils.getModeFromExtension(ext);
    if (!mode) return;
    onSourceRecieved({
      url: url,
      requestId: -1,
    }, frame, mode);
  }
}

function getMediaInfoFromTab(tab) {
  if (!tab || tab.url === PlayerURL) return;
  // Get name of website through tab url
  const url = new URL(tab.url);
  const hostname = url.hostname;
  let name = hostname.split('.');
  name = name[name.length - 2];

  if (!name) return;

  let title = tab.title || '';

  // First, remove any special characters
  title = title.replace(/[^a-zA-Z0-9 ]/g, '');

  // Remove any words too similar to the website name
  const words = title.split(' ').filter((word) => word.length > 0);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word.length <= 3) {
      continue;
    }

    if (StringUtils.levenshteinDistance(word.toLowerCase(), name.toLowerCase()) < Math.ceil(name.length * 0.4)) {
      words.splice(i, 1);
      i--;

      // Check if previous word is "the" or "a" or etc...
      if (i > 0) {
        const prewordList = ['the', 'a', 'an', 'of', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from'];
        if (prewordList.includes(words[i].toLowerCase())) {
          words.splice(i, 1);
          i--;
        }
      }
    }
  }

  title = words.join(' ');

  let season = null;
  let episode = null;
  // Remove season #, episode #, s#, e#
  title = title.replace(/(s|\bseason)\s*([0-9]+)/gi, (match, p1, p2) => {
    season = parseInt(p2);
    return '';
  });

  title = title.replace(/(e|\bepisode)\s*([0-9]+)/gi, (match, p1, p2) => {
    episode = parseInt(p2);
    return '';
  });

  // Remove year
  title = title.replace(/\b[0-9]{4}\b/g, '');

  // Remove words like TV, Movie, HD, etc...
  // List generated by AI
  const wordsToExclude = ['tv', 'movie', 'hd', 'full', 'free', 'online', 'stream', 'streaming', 'watch', 'now', 'watching', 'series', 'episode', 'season', 'anime', 'show', 'shows', 'episodes', 'seasons', 'part', 'parts', 'sub', 'dub', 'subdub', 'subbed', 'dubbed', 'english', 'subtitles', 'subtitle'];
  title = title.replace(new RegExp('\\b(' + wordsToExclude.join('|') + ')\\b', 'gi'), '');

  return {
    name: title.replace(/\s\s+/g, ' ').trim(),
    season: season,
    episode: episode,
  };
}

async function loadOptions(newOptions) {
  newOptions = newOptions || await Utils.getOptionsFromStorage();
  Options = newOptions;

  if (Options.playMP4URLs) {
    setupRedirectRule(1, ['mp4']);
  } else {
    removeRule(1);
  }

  if (Options.playStreamURLs) {
    setupRedirectRule(2, ['m3u8', 'mpd']);
  } else {
    removeRule(2);
  }

  AutoEnableList.length = 0;
  Options.autoEnableURLs.forEach((urlStr) => {
    if (urlStr.length === 0) {
      return;
    }

    if (urlStr[0] === '~') {
      try {
        AutoEnableList.push(new RegExp(urlStr.substring(1)));
      } catch (e) {
      }
    } else {
      AutoEnableList.push(urlStr);
    }
  });

  loadCustomPatterns();
}

async function loadCustomPatterns() {
  const customSourcePatterns = Options.customSourcePatterns;
  if (OptionsCache.customSourcePatterns !== customSourcePatterns) {
    OptionsCache.customSourcePatterns = customSourcePatterns;

    const matcher = new MultiRegexMatcher();
    await loadCustomPatternsFile(matcher, Options.customSourcePatterns, true);

    if (OptionsCache.customSourcePatterns !== customSourcePatterns) return;

    matcher.compile();
    CustomSourcePatternsMatcher = matcher;
  }
}

async function loadCustomPatternsFile(matcher, fileStr, isPrimary = false) {
  const lines = fileStr.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.length === 0) continue;

    if (line.startsWith('#') || line.startsWith('//')) continue; // comment

    if (line.startsWith('@')) { // command, do nothing for now. Future use
      // line = line.substring(1);
      // const command = line.substring(0, line.indexOf(' '));
      // const body = line.substring(line.indexOf(' ') + 1);
      continue;
    }

    const args = line.split(' ');
    const extStr = args[0];
    const regexStr = args.slice(1).join(' ');

    // parse regex and flags
    const regex = regexStr.substring(1, regexStr.lastIndexOf('/'));
    const flags = regexStr.substring(regexStr.lastIndexOf('/') + 1);

    try {
      matcher.addRegex(regex, flags, extStr);
    } catch (e) {
      console.warn(e);
    }
  }
}

async function setupRedirectRule(ruleID, filetypes) {
  const rule = {
    id: ruleID,
    action: {
      type: 'redirect',
      redirect: {regexSubstitution: PlayerURL + '#\\0'},
    },
    condition: {
      // exclude self
      excludedRequestDomains: [(new URL(PlayerURL)).hostname],
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

  if (Logging) console.log('Found subtitle', url);
  const u = (new URL(url)).pathname.split('/').pop();

  frame.subtitles.push({
    source: url,
    headers: headers,
    label: u.split('.')[0],
    time: Date.now(),
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
    time: Date.now(),
  });
}

function collectSources(frame, remove = false) {
  const subtitles = [];
  const sources = [];
  const tab = frame.tab;

  let currentFrame = frame;
  let removed = false;
  let depth = 0;
  while (currentFrame) {
    for (let i = 0; i < currentFrame.subtitles.length; i++) {
      subtitles.push({
        ...currentFrame.subtitles[i],
        depth,
      });
    }

    for (let i = 0; i < currentFrame.sources.length; i++) {
      sources.push({
        ...currentFrame.sources[i],
        depth,
      });
    }

    if (!removed && remove) {
      if (currentFrame.sources.length !== 0) {
        removed = true;
      }
      currentFrame.sources.length = 0;
      currentFrame.subtitles.length = 0;
    }

    if (currentFrame.sources.length !== 0) break;
    currentFrame = tab.frames[currentFrame.parentId];
    depth++;
  }

  // Sort by time, oldest first
  sources.sort((a, b) => {
    return a.time - b.time;
  });

  return {subtitles, sources};
}

function sendSources(frame) {
  let collectFrame = frame;
  if (frame.replacedAll) {
    collectFrame = frame.tab.frames[frame.parentId];
  }

  const {subtitles, sources} = collectSources(collectFrame, true);

  const parent = frame.tab.frames[collectFrame.parentId];
  const continuationOptions = parent?.continuationOptions || null;

  if (continuationOptions) {
    parent.continuationOptions = null;
  }

  chrome.tabs.sendMessage(frame.tab.tabId, {
    type: 'sources',
    subtitles: subtitles,
    sources: sources,
    autoSetSource: true,
    continuationOptions: continuationOptions,
  }, {
    frameId: frame.frameId,
  }, ()=>{
    BackgroundUtils.checkMessageError('sources');
  });
}

function getOrCreateFrame(details) {
  const tabId = details.tabId;
  const frameId = details.frameId;
  const parentFrameId = details.parentFrameId;

  if (!CachedTabs[tabId]) CachedTabs[tabId] = new TabHolder(tabId);
  const tab = CachedTabs[tabId];

  if (!tab.frames[frameId]) tab.addFrame(frameId, parentFrameId);
  const frame = tab.frames[frameId];

  if (parentFrameId !== undefined) {
    frame.parentId = parentFrameId;
  }

  return frame;
}
function isSubtitles(ext) {
  return ext ==='vtt' || ext === 'srt';
}

async function scrapeCaptionsTags(frame) {
  const tabId = frame.tab.tabId;
  const frameId = frame.frameId;
  if (tabId < 0) return null;

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, {
      type: 'scrape_captions',
    }, {
      frameId: frameId,
    }, (sub) => {
      BackgroundUtils.checkMessageError('scrape_captions');
      resolve(sub);
    });
  });
}

async function getVideoSize(frame) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(frame.tab.tabId, {
      type: 'get_video_size',
    }, {
      frameId: frame.frameId,
    }, (size) => {
      BackgroundUtils.checkMessageError('get_video_size');
      resolve(size);
    });
  });
}

async function pingContentScript() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({}, (tabs) => {
      const message = {
        type: 'ping',
      };

      // try one tab at a time. If it fails, try the next one
      let i = 0;
      const tryTab = () => {
        if (i >= tabs.length) {
          resolve(false);
          return;
        }

        try {
          chrome.tabs.sendMessage(tabs[i].id, message, (returnMessage) => {
            if (chrome.runtime.lastError || returnMessage !== 'pong') {
              i++;
              tryTab();
            } else {
              resolve(true);
            }
          });
        } catch (e) {
          i++;
          tryTab();
        }
      };

      tryTab();
    });
  });
}

async function openPlayer(frame) {
  if (frame.playerOpening || frameHasPlayer(frame) || frame.replacedAll) {
    return;
  }

  frame.playerOpening = true;
  frame.replacedAll = false;
  frame.isMainPlayer = frame.tab.playerCount === 0;
  frame.tab.playerCount += 1;
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(frame.tab.tabId, {
      type: 'player',
      url: PlayerURL + '?frame_id=' + frame.frameId,
      noRedirect: frame.frameId === 0,
    }, {
      frameId: frame.frameId,
    }, (response) => {
      frame.playerOpening = false;
      if (response === 'replaceall') {
        frame.replacedAll = true;
      }
      BackgroundUtils.checkMessageError('player');
      resolve(response);
    });
  });
}

function sendSourcesToMainFramePlayers(frame) {
  // query all tabs
  chrome.tabs.query({}, (tabs) => {
    // for each tab
    for (let i = 0; i < tabs.length; i++) {
      const tab = CachedTabs[tabs[i].id];
      if (!tab || !tab.isOn) continue;
      // if the tab is a faststream tab
      if (tab.url.substring(0, PlayerURL.length) === PlayerURL && tab.frames?.[0]?.isFastStream) {
        const fastStreamFrame = tab.frames[0];
        if (fastStreamFrame.ready) {
          // send the source to the tab
          chrome.tabs.sendMessage(tab.tabId, {
            type: 'sources',
            subtitles: frame.subtitles,
            sources: frame.sources,
            autoSetSource: false,
          }, ()=>{
            BackgroundUtils.checkMessageError('sources');
          });
        }
      }
    }
  });
}

let currentTimeout = null;
async function onSourceRecieved(details, frame, mode) {
  if ((URLUtils.is_url_yt(frame.url) || URLUtils.is_url_yt(frame.tab.url)) && mode !== PlayerModes.ACCELERATED_YT) {
    return;
  }

  const url = details.url;
  const customHeaders = details.customHeaders || frame.requestHeaders[details.requestId];

  if (getSourceFromURL(frame, url)) return;

  // Check if service worker
  if (frame.tab.tabId < 0 && details.initiator) {
    // get current frame
    const currentFrame = await new Promise((resolve, reject) => {
      chrome.tabs.query({url: '*://*/*'}).then((ctabs) => {
        ctabs.every((tab) => {
          const tabObj = CachedTabs[tab.id];
          if (!tabObj) return true;
          for (const i in tabObj.frames) {
            if (!Object.hasOwn(tabObj.frames, i)) continue;
            const f = tabObj.frames[i];
            if (!f?.url) continue;
            const furl = f.url;
            if (furl.length >= details.initiator.length && furl.substring(0, details.initiator.length) === details.initiator) {
              resolve(f);
              return false;
            }
          }
          return true;
        });
      }).catch((e) => {
        resolve(null);
      });
    });

    if (currentFrame) {
      frame = currentFrame;
    }
  }

  addSource(frame, url, mode, customHeaders);

  await scrapeCaptionsTags(frame).then((sub) => {
    if (sub) {
      sub.forEach((s) => {
        if (frame.subtitles.every((ss, i) => {
          if (s.source === ss.source) {
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
    }, Options.replaceDelay);
  }

  sendSourcesToMainFramePlayers(frame);

  if (Logging) console.log('Found source', details, frame);

  return;
}

async function openPlayersWithSources(tabid) {
  if (!CachedTabs[tabid]) return;
  const tab = CachedTabs[tabid];

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

const webRequestPerms = ['requestHeaders'];
const webRequestPerms2 = [];

if (EnvUtils.isChrome()) {
  webRequestPerms.push('extraHeaders');
  webRequestPerms2.push('extraHeaders');
}

chrome.webRequest.onBeforeSendHeaders.addListener((details) => {
  const frame = getOrCreateFrame(details);
  frame.requestHeaders[details.requestId] = details.requestHeaders;
}, {
  urls: ['<all_urls>'],
}, webRequestPerms);

function frameHasPlayer(frame) {
  return frame.isFastStream || frame.url.substring(0, PlayerURL.length) === PlayerURL;
}

chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
      const url = details.url;
      let ext = URLUtils.get_url_extension(url);
      const frame = getOrCreateFrame(details);
      if (frameHasPlayer(frame)) return;

      if ((details.statusCode >= 400 && details.statusCode < 600) || details.statusCode === 204) {
        return; // Client or server error. Ignore it
      }

      // Exclude urls from facebook.
      const initiatorBlacklist = [
        'https://www.facebook.com',
        'https://www.instagram.com',
      ];
      if (details.initiator &&
        initiatorBlacklist.some((a) => {
          return details.initiator.startsWith(a);
        })) {
        return;
      }

      const output = CustomSourcePatternsMatcher.match(url);
      if (output) {
        ext = output;
      }

      if (isSubtitles(ext)) {
        return handleSubtitles(url, frame, frame.requestHeaders[details.requestId]);
      } else if (ext === 'json') {
        // Vimeo. Check if filename is master.json
        const filename = URLUtils.get_file_name(url);
        if (filename === 'master.json' && url.includes('/video/')) {
          ext = 'mpd';
          details.url = URLUtils.strip_queryhash(url).replace('master.json', 'master.mpd');
        }
      }
      let mode = URLUtils.getModeFromExtension(ext);
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
    }, webRequestPerms2,
);

chrome.webRequest.onHeadersReceived.addListener(deleteHeaderCache, {
  urls: ['<all_urls>'],
});


chrome.webRequest.onErrorOccurred.addListener(deleteHeaderCache, {
  urls: ['<all_urls>'],
});

function deleteHeaderCache(details) {
  const frame = getOrCreateFrame(details);
  delete frame.requestHeaders[details.requestId];
}

chrome.tabs.onRemoved.addListener((tabid, removed) => {
  delete CachedTabs[tabid];
});

chrome.tabs.onUpdated.addListener((tabid, changeInfo, tab) => {
  if (CachedTabs[tabid]) {
    if (changeInfo.url) {
      const url = new URL(changeInfo.url);
      if (CachedTabs[tabid].hostname && CachedTabs[tabid].hostname !== url.hostname) {
        CachedTabs[tabid].analyzerData = undefined;
        CachedTabs[tabid].frames = {};
      }

      CachedTabs[tabid].playerCount = 0;

      CachedTabs[tabid].url = changeInfo.url;
      CachedTabs[tabid].hostname = url.hostname;

      chrome.tabs.sendMessage(tabid, {
        type: 'remove_players',
      }, {
        frameId: 0,
      }, () => {
        BackgroundUtils.checkMessageError('remove_players');
      });

      const urlIsInAutoList = AutoEnableList.some((regex) => {
        try {
          if (typeof regex === 'string') {
            return changeInfo.url.substring(0, regex.length) === regex;
          } else {
            return regex.test(changeInfo.url);
          }
        } catch (e) {

        }
        return false;
      });


      if (tab.url.substring(0, PlayerURL.length) === PlayerURL) {
        CachedTabs[tabid].isOn = true;
        CachedTabs[tabid].regexMatched = true;
      } else if (urlIsInAutoList && !CachedTabs[tabid].regexMatched) {
        CachedTabs[tabid].regexMatched = true;
        CachedTabs[tabid].isOn = true;
        openPlayersWithSources(tab.id);
      } else if (!urlIsInAutoList && CachedTabs[tabid].regexMatched) {
        CachedTabs[tabid].isOn = false;
        CachedTabs[tabid].regexMatched = false;
      }
    }
    if (changeInfo.status === 'complete') {
      CachedTabs[tabid].complete = true;
    } else if (changeInfo.status === 'loading') {
      CachedTabs[tabid].complete = false;
    }

    updateTabIcon(CachedTabs[tabid], true);
  }
});

loadOptions().catch(console.error);

setInterval(async ()=>{
  await chrome.runtime.getPlatformInfo();
  await pingContentScript();
}, 10e3);

const streamSaverBackend = new StreamSaverBackend();
try {
  streamSaverBackend.setup(self);
} catch (e) {

}

if (EnvUtils.isChrome()) {
  chrome.action.setBadgeBackgroundColor(
      {
        color: [56, 114, 223, 255],
      },
  );
}

// Link to a form to report bugs
chrome.runtime.setUninstallURL('https://docs.google.com/forms/d/e/1FAIpQLSfldLYAi0xAW9tYKMcUsfYYk8KyOQDZlLFjqwwz1LajchpBvA/viewform?usp=sf_link');

Utils.printWelcome(ExtensionVersion);
