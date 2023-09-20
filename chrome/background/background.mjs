import {DefaultOptions} from '../options/defaults/DefaultOptions.mjs';
import {PlayerModes} from '../player/enums/PlayerModes.mjs';
import {StringUtils} from '../player/utils/StringUtils.mjs';
import {URLUtils} from '../player/utils/URLUtils.mjs';
import {Utils} from '../player/utils/Utils.mjs';
import {BackgroundUtils} from './BackgroundUtils.mjs';
import {TabHolder} from './Containers.mjs';
import {RuleManager} from './NetRequestRuleManager.mjs';

let options = {};

const autoEnableList = [];

const version = chrome.runtime.getManifest().version;
const logging = false;
const playerURL = chrome.runtime.getURL('player/player.html');
const tabs = {};

chrome.runtime.onInstalled.addListener((object) => {
  chrome.storage.local.get('welcome', (result) => {
    if (!result || !result.welcome) {
      if (logging) console.log(result);
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
    if (!tabs[tab.id]) tabs[tab.id] = new TabHolder(tab.id);
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
      tabIconTimeout = setTimeout(() => {
        chrome.action.setBadgeText({
          text: '',
          tabId: tab.tab,
        });
      }, 1000);
    }
  }
}

async function onClicked(tab) {
  if (!tabs[tab.id]) tabs[tab.id] = new TabHolder(tab.id);

  // check permissions
  const hasPerms = await BackgroundUtils.checkPermissions();
  if (!hasPerms) {
    chrome.tabs.create({
      url: chrome.runtime.getURL('perms.html'),
    });
    return;
  }

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

chrome.action.onClicked.addListener((tab) => {
  onClicked(tab);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ping') {
    sendResponse('pong');
    return;
  }

  if (msg.type === 'options') {
    loadOptions(msg.options);
    sendResponse('ok');
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
    }
  } else if (msg.type === 'fullscreen') {
    chrome.tabs.sendMessage(frame.tab.tab, {
      type: 'fullscreen',
      frameId: frame.frame,
    }, {
      frameId: frame.parent,
    }, () => {
      BackgroundUtils.checkMessageError('fullscreen');
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
    }, ()=>{
      BackgroundUtils.checkMessageError('init');
    });


    chrome.tabs.sendMessage(frame.tab.tab, {
      type: 'media_name',
      name: getMediaNameFromTab(sender?.tab),
    }, {
      frameId: frame.frame,
    }, ()=>{
      BackgroundUtils.checkMessageError('media_name');
    });

    chrome.tabs.sendMessage(frame.tab.tab, {
      type: 'options',
      options: JSON.stringify(options),
    }, {
      frameId: frame.frame,
    }, ()=>{
      BackgroundUtils.checkMessageError('settings');
    });

    chrome.tabs.sendMessage(frame.tab.tab, {
      type: 'analyzerData',
      data: tab.analyzerData,
    }, {
      frameId: frame.frame,
    }, ()=>{
      BackgroundUtils.checkMessageError('analyzerData');
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
    }, ()=>{
      BackgroundUtils.checkMessageError('init');
    });

    // SPLICER:CENSORYT:REMOVE_START
  } else if (msg.type === 'yt_loaded') {
    frame.url = msg.url;
    checkYTURL(frame);
    // SPLICER:CENSORYT:REMOVE_END
  } else if (msg.type === 'ready') {
    if (logging) console.log('Ready');
    frame.ready = true;

    sendSources(frame);
  } else {
    sendResponse('unknown');
    return;
  }

  sendResponse('ok');
});

// SPLICER:CENSORYT:REMOVE_START
function checkYTURL(frame) {
  const url = frame.url;
  // Check if url is youtube

  if (url.substring(0, playerURL.length) === playerURL) {
    return;
  }

  if (URLUtils.is_url_yt(url) && URLUtils.is_url_yt_watch(url)) {
    onSourceRecieved({
      url: url,
      requestId: -1,
    }, frame, PlayerModes.ACCELERATED_YT);
  }
}
// SPLICER:CENSORYT:REMOVE_END

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
    return word.length > 0 && (word.length <= 3 || StringUtils.levenshteinDistance(word.toLowerCase(), name.toLowerCase()) >= Math.ceil(name.length * 0.4));
  });

  // Remove words like TV, Movie, HD, etc...
  // List generated by AI
  const wordsToExclude = ['tv', 'movie', 'hd', 'full', 'free', 'online', 'stream', 'streaming', 'watch', 'now', 'watching', 'episode', 'season', 'series', 'anime', 'show', 'shows', 'episodes', 'seasons', 'part', 'parts', 'sub', 'dub', 'subdub', 'subbed', 'dubbed', 'english', 'subtitles', 'subtitle'];

  words = words.filter((word) => {
    return !wordsToExclude.includes(word.toLowerCase());
  });

  return words.join(' ');
}

async function loadOptions(newOptions) {
  newOptions = newOptions || await BackgroundUtils.getOptionsFromStorage();
  newOptions = JSON.parse(newOptions) || {};

  options = Utils.mergeOptions(DefaultOptions, newOptions);

  chrome.storage.local.set({
    options: JSON.stringify(options),
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

  autoEnableList.length = 0;
  options.autoEnableURLs.forEach((urlStr) => {
    if (urlStr.length === 0) {
      return;
    }

    if (urlStr[0] === '~') {
      autoEnableList.push(new RegExp(urlStr.substring(1)));
    } else {
      autoEnableList.push(urlStr);
    }
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
  }, ()=>{
    BackgroundUtils.checkMessageError('sources');
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
      BackgroundUtils.checkMessageError('scrape_captions');
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

  return chrome.tabs.sendMessage(frame.tab.tab, {
    type: 'player',
    url: playerURL + '?frame_id=' + frame.frame,
  }, {
    frameId: frame.frame,
  }, (response) => {
    if (response === 'no_video') {
      frame.playerOpening = false;
    }
  });
}
let currentTimeout = null;
async function onSourceRecieved(details, frame, mode) {
  if (((frame.url && URLUtils.is_url_yt(frame.url)) || (frame.tab.url && URLUtils.is_url_yt(frame.tab.url))) && mode !== PlayerModes.ACCELERATED_YT) {
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

const webRequestPerms = ['requestHeaders'];
const webRequestPerms2 = [];

// SPLICER:FIREFOX:REMOVE_START
webRequestPerms.push('extraHeaders');
webRequestPerms2.push('extraHeaders');
// SPLICER:FIREFOX:REMOVE_END

chrome.webRequest.onBeforeSendHeaders.addListener((details) => {
  const frame = getOrCreateFrame(details);
  frame.requests[details.requestId] = details.requestHeaders;
}, {
  urls: ['<all_urls>'],
}, webRequestPerms);

function frameHasPlayer(frame) {
  return frame.isFastStream || frame.url.substring(0, playerURL.length) === playerURL;
}

chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
      const url = details.url;
      const ext = URLUtils.get_url_extension(url);
      const frame = getOrCreateFrame(details);
      if (frameHasPlayer(frame)) return;

      if (isSubtitles(ext)) {
        return handleSubtitles(url, frame, frame.requests[details.requestId]);
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
  delete frame.requests[details.requestId];
}

chrome.tabs.onRemoved.addListener((tabid, removed) => {
  delete tabs[tabid];
});

chrome.tabs.onUpdated.addListener((tabid, changeInfo, tab) => {
  if (tabs[tabid]) {
    if (changeInfo.url) {
      const url = new URL(changeInfo.url);
      if (tabs[tabid].hostname && tabs[tabid].hostname !== url.hostname) {
        tabs[tabid].analyzerData = undefined;
      }
      tabs[tabid].hostname = url.hostname;

      const urlIsInAutoList = autoEnableList.some((regex) => {
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

      if (urlIsInAutoList && !tabs[tabid].regexMatched) {
        tabs[tabid].regexMatched = true;
        tabs[tabid].isOn = true;
        openPlayersWithSources(tab.id);
      } else if (!urlIsInAutoList && tabs[tabid].regexMatched) {
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

loadOptions().catch(console.error);

setInterval(async ()=>{
  await chrome.runtime.getPlatformInfo();
  await pingContentScript();
}, 10e3);

console.log('\n %c %c %cFast%cStream %c-%c ' + version + ' %c By Andrews54757 \n', 'background: url(https://user-images.githubusercontent.com/13282284/57593160-3a4fb080-7508-11e9-9507-33d45c4f9e41.png) no-repeat; background-size: 16px 16px; padding: 2px 6px; margin-right: 4px', 'background: rgb(50,50,50); padding:5px 0;', 'color: rgb(200,200,200); background: rgb(50,50,50); padding:5px 0;', 'color: rgb(200,200,200); background: rgb(50,50,50); padding:5px 0;', 'color: rgb(200,200,200); background: rgb(50,50,50); padding:5px 0;', 'color: #afbc2a; background: rgb(50,50,50); padding:5px 0;', 'color: black; background: #e9e9e9; padding:5px 0;');
