import {PlayerModes} from '../player/enums/PlayerModes.mjs';
import {EnvUtils} from '../player/utils/EnvUtils.mjs';
import {StringUtils} from '../player/utils/StringUtils.mjs';
import {URLUtils} from '../player/utils/URLUtils.mjs';
import {Utils} from '../player/utils/Utils.mjs';
import {BackgroundUtils} from './BackgroundUtils.mjs';
import {TabHolder} from './Containers.mjs';
import {RuleManager} from './NetRequestRuleManager.mjs';
import {SponsorBlockIntegration} from './SponsorBlockIntegration.mjs';
import {StreamSaverBackend} from './StreamSaverBackend.mjs';

let Options = {};

const AutoEnableList = [];
const CustomSourcePatterns = [];
const ExtensionVersion = chrome.runtime.getManifest().version;
const Logging = false;
const PlayerURL = chrome.runtime.getURL('player/index.html');
const CachedTabs = {};

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
          chrome.tabs.reload(tab.id);
        }
      }
    } else {
      // chrome.tabs.remove(tab.id);
    }
  } else {
    if (!CachedTabs[tab.id].frames[0]) CachedTabs[tab.id].addFrame(0, -1);
    //   tabs[tab.id].frames[0].source = "null"
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
            BackgroundUtils.checkMessageError('options');
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
  if (msg.type === 'transmit_key') {
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
    handleFullScreenRequest(frame, {
      type: 'fullscreen',
    }).then((result) => {
      sendResponse(result);
    });
    return true;
  } else if (msg.type === 'request_miniplayer') {
    handleFullScreenRequest(frame, {
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
    // send to msg.frameId
    chrome.tabs.sendMessage(frame.tab.tabId, {
      type: 'miniplayer_change',
      miniplayer: msg.miniplayer,
    }, {
      frameId: msg.frameId,
    }, ()=>{
      BackgroundUtils.checkMessageError('miniplayer_change');
    });
  } else if (msg.type ==='fullscreen_change_init') {
    // send to children
    for (const i in tab.frames) {
      if (Object.hasOwn(tab.frames, i)) {
        const frame = tab.frames[i];
        if (frame.parentId === sender.frameId) {
          chrome.tabs.sendMessage(frame.tab.tabId, {
            type: 'fullscreen_change',
            fullscreen: msg.fullscreen,
          }, {
            frameId: frame.frameId,
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

    if (frame.parentId === -2 && frame.frameId != msg.frameId) {
      frame.parentId = msg.frameId;
    }

    chrome.tabs.sendMessage(frame.tab.tabId, {
      type: 'media_name',
      name: getMediaNameFromTab(sender?.tab),
    }, {
      frameId: frame.frameId,
    }, ()=>{
      BackgroundUtils.checkMessageError('media_name');
    });

    chrome.tabs.sendMessage(frame.tab.tabId, {
      type: 'analyzerData',
      data: tab.analyzerData,
    }, {
      frameId: frame.frameId,
    }, ()=>{
      BackgroundUtils.checkMessageError('analyzerData');
    });
  } else if (msg.type === 'analyzerData') {
    if (Logging) console.log('Analyzer data', msg.data);
    tab.analyzerData = msg.data;
  } else if (msg.type === 'iframe_controls') {
    frame.frame_referer = msg.mode === PlayerModes.IFRAME ? msg.referer : null;
    if (Logging) console.log('Iframe-controls', frame.frame_referer);
  } else if (msg.type === 'iframe') {
    frame.url = msg.url;
    if (frame.url.substring(0, PlayerURL.length) !== PlayerURL) {
      //  console.log("reset frame sources")
      frame.subtitles.length = 0;
      frame.sources.length = 0;
      frame.isFastStream = false;
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
  } else {
    sendResponse('unknown');
    return;
  }

  sendResponse('ok');
});

async function handleFullScreenRequest(frame, message) {
  if (frame.parentId === -1) {
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
      BackgroundUtils.checkMessageError('fullscreen');
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

function getMediaNameFromTab(tab) {
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
  title = title.split(' ').filter((word) => {
    return word.length > 0 && (word.length <= 3 || StringUtils.levenshteinDistance(word.toLowerCase(), name.toLowerCase()) >= Math.ceil(name.length * 0.4));
  }).join(' ');

  // Remove season #, episode #, s#, e#
  title = title.replace(/\b(s|e|season|episode)\s*[0-9]+\b/gi, '');

  // Remove year
  title = title.replace(/\b[0-9]{4}\b/g, '');

  // Remove words like TV, Movie, HD, etc...
  // List generated by AI
  const wordsToExclude = ['tv', 'movie', 'hd', 'full', 'free', 'online', 'stream', 'streaming', 'watch', 'now', 'watching', 'series', 'episode', 'season', 'anime', 'show', 'shows', 'episodes', 'seasons', 'part', 'parts', 'sub', 'dub', 'subdub', 'subbed', 'dubbed', 'english', 'subtitles', 'subtitle'];
  title = title.replace(new RegExp('\\b(' + wordsToExclude.join('|') + ')\\b', 'gi'), '');

  return title.replace(/\s\s+/g, ' ').trim();
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

  CustomSourcePatterns.length = 0;
  Options.customSourcePatterns.split('\n') .forEach((line)=>{
    line = line.trim();
    if (line.length === 0) return;
    if (line.startsWith('#') || line.startsWith('//')) return;

    const args = line.split(' ');
    const extStr = args[0];
    const regexStr = args.slice(1).join(' ');

    // parse regex and flags
    const regex = regexStr.substring(1, regexStr.lastIndexOf('/'));
    const flags = regexStr.substring(regexStr.lastIndexOf('/') + 1);
    try {
      CustomSourcePatterns.push({
        regex: new RegExp(regex, flags),
        ext: extStr,
      });
    } catch (e) {

    }
  });
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

  sendSourcesToMainFramePlayers(frame);
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
  const {subtitles, sources} = collectSources(frame, true);

  chrome.tabs.sendMessage(frame.tab.tabId, {
    type: 'sources',
    subtitles: subtitles,
    sources: sources,
    autoSetSource: true,
  }, {
    frameId: frame.frameId,
  }, ()=>{
    BackgroundUtils.checkMessageError('sources');
  });
}

function getOrCreateFrame(details) {
  if (!CachedTabs[details.tabId]) CachedTabs[details.tabId] = new TabHolder(details.tabId);
  const tab = CachedTabs[details.tabId];

  if (!tab.frames[details.frameId]) tab.addFrame(details.frameId, details.parentFrameId);
  const frame = tab.frames[details.frameId];

  if (details.parentFrameId !== frame.parentId) {
    frame.parentId = details.parentFrameId;
  }

  return frame;
}
function isSubtitles(ext) {
  return ext ==='vtt' || ext === 'srt';
}

async function scrapeCaptionsTags(frame) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(frame.tab.tabId, {
      type: 'scrape_captions',
    }, {
      frameId: frame.frameId,
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
  if (frame.playerOpening || frameHasPlayer(frame)) {
    return;
  }

  frame.playerOpening = true;

  return chrome.tabs.sendMessage(frame.tab.tabId, {
    type: 'player',
    url: PlayerURL + '?frame_id=' + frame.frameId,
    noRedirect: frame.frameId === 0,
  }, {
    frameId: frame.frameId,
  }, (response) => {
    frame.playerOpening = false;
  });
}

function sendSourcesToMainFramePlayers(frame) {
  // query all tabs
  chrome.tabs.query({}, (tabs) => {
    // for each tab
    for (let i = 0; i < tabs.length; i++) {
      const tab = CachedTabs[tabs[i].id];
      if (!tab) continue;
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
  if (getSourceFromURL(frame, url)) return;
  addSource(frame, url, mode, frame.requestHeaders[details.requestId]);
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
    }, mode === PlayerModes.ACCELERATED_MP4 ? 1500 : 200);
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

// SPLICER:FIREFOX:REMOVE_START
webRequestPerms.push('extraHeaders');
webRequestPerms2.push('extraHeaders');
// SPLICER:FIREFOX:REMOVE_END

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

      const customSourcePattern = CustomSourcePatterns.find((item)=>{
        return item.regex.test(url);
      });
      if (customSourcePattern) {
        ext = customSourcePattern.ext;
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

chrome.runtime.setUninstallURL('https://github.com/Andrews54757/FastStream/blob/main/UNINSTALL.md');

console.log('\n %c %c %cFast%cStream %c-%c ' + ExtensionVersion + ' %c By Andrews54757 \n', 'background: url(https://user-images.githubusercontent.com/13282284/57593160-3a4fb080-7508-11e9-9507-33d45c4f9e41.png) no-repeat; background-size: 16px 16px; padding: 2px 6px; margin-right: 4px', 'background: rgb(50,50,50); padding:5px 0;', 'color: rgb(200,200,200); background: rgb(50,50,50); padding:5px 0;', 'color: rgb(200,200,200); background: rgb(50,50,50); padding:5px 0;', 'color: rgb(200,200,200); background: rgb(50,50,50); padding:5px 0;', 'color: #afbc2a; background: rgb(50,50,50); padding:5px 0;', 'color: black; background: #e9e9e9; padding:5px 0;');
