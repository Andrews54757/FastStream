import {PlayerModes} from '../player/enums/PlayerModes.mjs';
import {EnvUtils} from '../player/utils/EnvUtils.mjs';
import {StringUtils} from '../player/utils/StringUtils.mjs';
import {URLUtils} from '../player/utils/URLUtils.mjs';
import {Utils} from '../player/utils/Utils.mjs';
import {BackgroundUtils} from './BackgroundUtils.mjs';
import {MessageTypes} from '../player/enums/MessageTypes.mjs';
import {MultiRegexMatcher} from './MultiRegexMatcher.mjs';
import {RuleManager} from './NetRequestRuleManager.mjs';
import {SponsorBlockIntegration} from './SponsorBlockIntegration.mjs';
import {StreamSaverBackend} from './StreamSaverBackend.mjs';
import {TabTracker} from './TabTracker.mjs';

let Options = {};
const OptionsCache = {};

const AutoEnableList = [];
const ExtensionVersion = chrome.runtime.getManifest().version;
const Logging = false;
const Tabs = new TabTracker();
const ruleManager = new RuleManager();


let CustomSourcePatternsMatcher = new MultiRegexMatcher();

const sponsorBlockBackend = new SponsorBlockIntegration();
sponsorBlockBackend.setup();
try {
  sponsorBlockBackend.setup(self);
} catch (e) {
  console.error(e);
}

BackgroundUtils.openWelcomePageOnInstall();

BackgroundUtils.queryTabs().then((ctabs) => {
  ctabs.forEach((tabobj) => {
    const tab = Tabs.getTabOrCreate(tabobj.id);
    try {
      BackgroundUtils.updateTabIcon(tab, true);
    } catch (e) {
      console.error(e);
    }
  });
});

async function onClicked(tabobj) {
  const tab = Tabs.getTabOrCreate(tabobj.id);

  // check permissions
  const hasPerms = await BackgroundUtils.checkPermissions();
  if (!hasPerms) {
    chrome.tabs.create({
      url: chrome.runtime.getURL('perms.html'),
    });
    return;
  }

  if (tabobj.url) {
    tab.url = tabobj.url;
  }

  const emptyTabURLS = ['about:blank', 'about:home', 'about:newtab', 'about:privatebrowsing', 'chrome://newtab/'];
  if (tab.url && !emptyTabURLS.includes(tab.url)) {
    if (!BackgroundUtils.isUrlPlayerUrl(tab.url)) {
      tab.isOn = !tab.isOn;

      BackgroundUtils.updateTabIcon(tab);

      if (tab.isOn) {
        openPlayersWithSources(tab);
      } else {
        let hasPlayer = false;
        for (const frame of tab.getFrames()) {
          if (frame.isPlayer) {
            hasPlayer = true;
            break;
          }
        }

        if (hasPlayer) {
          tab.reset();
          chrome.tabs.reload(tab.tabId);
        }
      }
    } else {
      tab.isOn = !tab.isOn;
      BackgroundUtils.updateTabIcon(tab);
    }
  } else {
    chrome.tabs.update(tab.tabId, {
      url: BackgroundUtils.getPlayerUrl(),
    }, () => {

    });
  }
}

chrome.action.onClicked.addListener(onClicked);


chrome.tabs.onRemoved.addListener((tabid, removed) => {
  Tabs.removeTab(tabid);
});

chrome.tabs.onUpdated.addListener((tabid, changeInfo, tabobj) => {
  const tab = Tabs.getTabOrCreate(tabid);

  if (changeInfo.url) {
    const url = new URL(changeInfo.url);
    const oldURL = tab.url ? new URL(tab.url) : null;
    if (oldURL && oldURL.hostname !== url.hostname) {
      tab.reset();
    }

    tab.url = changeInfo.url;

    chrome.tabs.sendMessage(tabid, {
      type: MessageTypes.REMOVE_PLAYERS,
    }, {
      frameId: 0,
    }, () => {
      BackgroundUtils.checkMessageError('remove_players');
    });

    const match = AutoEnableList.find((item) => {
      try {
        if (!item.regex) {
          return changeInfo.url.substring(0, item.match.length) === item.match;
        } else if (item.exclude_domain) {
          return item.domain === url.hostname;
        } else {
          return item.match.test(changeInfo.url);
        }
      } catch (e) {

      }
      return false;
    });

    const shouldAutoEnable = match && !match.negative;


    if (BackgroundUtils.isUrlPlayerUrl(tab.url)) {
      tab.isOn = true;
      tab.regexMatched = true;
    } else if (shouldAutoEnable && !tab.regexMatched) {
      tab.regexMatched = true;
      tab.isOn = true;
      openPlayersWithSources(tab);
    } else if (!shouldAutoEnable && tab.regexMatched) {
      tab.isOn = false;
      tab.regexMatched = false;
    }
  }

  BackgroundUtils.updateTabIcon(tab, true);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === MessageTypes.PING) {
    sendResponse(MessageTypes.PONG);
    return;
  } else if (msg.type === MessageTypes.LOAD_OPTIONS) {
    loadOptions();
    // sent to all tabs
    BackgroundUtils.queryTabs().then((tabs) => {
      tabs.forEach((tab) => {
        if (Tabs.getTab(tab.id)) {
          chrome.tabs.sendMessage(tab.id, {
            type: MessageTypes.UPDATE_OPTIONS,
            time: msg.time,
          }, (response) => {
            BackgroundUtils.checkMessageError('options', true);
          });
        }
      });
    });
    return;
  }

  const tab = Tabs.getTabOrCreate(sender.tab.id);
  const frame = tab.getFrameOrCreate(sender.frameId);

  if (msg.type === MessageTypes.PLAYER_LOADED) {
    if (Logging) console.log('Found FastStream window', frame);
    frame.isPlayer = true;

    if (tab.downloadInfo) {
      chrome.tabs.sendMessage(frame.tab.tabId, {
        type: MessageTypes.HANDLE_DOWNLOAD,
        url: tab.downloadInfo.url,
        filename: tab.downloadInfo.filename,
      }, {
        frameId: frame.frameId,
      }, (response) => {
        BackgroundUtils.checkMessageError('download');
        tab.downloadInfo.resolve(response);
        tab.downloadInfo = null;

        // Close tab
        chrome.tabs.remove(frame.tab.tabId);
      });
      sendResponse(null);
      return;
    }

    if (!frame.parent && msg.parentFrameId !== undefined) {
      const parentFrame = tab.getFrameOrCreate(msg.parentFrameId);
      frame.setParentFrame(parentFrame);
    }

    if (frame.playerOpening) {
      frame.playerOpening = false;
    } else if (frame.parent) {
      frame.parent.playerOpening = false;
    }
    tab.playerCount++;
    const isMainPlayer = tab.playerCount === 1;

    getPageFrame(frame).then((pageFrame) => {
      if (pageFrame) {
        frame.pageFrame = pageFrame;
      } else {
        frame.pageFrame = tab.getFrameOrCreate(0);
      }

      const response = {
        mediaInfo: getMediaInfoFromTab(sender?.tab),
        analyzerData: tab.analyzerData,
        isMainPlayer,
      };

      sendResponse(response);
    });
    return true;
  } else if (msg.type === MessageTypes.FRAME_ADDED) {
    const playerCount = frame.resetSelfAndChildren();
    frame.url = msg.url;
    tab.playerCount -= playerCount;
    tab.playerCount = Math.max(0, tab.playerCount);
    checkURLMatch(frame);

    frame.loadedCallbacks.forEach((callback) => {
      try {
        callback('loaded');
      } catch (e) {
        console.error(e);
      }
    });
    frame.loadedCallbacks.clear();
  } else if (msg.type === MessageTypes.FRAME_REMOVED) {
    const toRemove = msg.frameId !== undefined ? tab.getFrame(msg.frameId) : frame;
    const playerCount = toRemove.resetSelfAndChildren();
    tab.playerCount -= playerCount;
    tab.playerCount = Math.max(0, tab.playerCount);

    if (toRemove.parent) {
      toRemove.parent.removeChildFrame(toRemove);
    }

    tab.removeFrame(toRemove.frameId);
  } else if (msg.type === MessageTypes.WAIT_UNTIL_MAIN_LOADED) {
    frame.loadedCallbacks.add(sendResponse);

    // Try to ping tab
    chrome.tabs.sendMessage(tab.tabId, {
      type: MessageTypes.PING_TAB,
    }, (response) => {
      BackgroundUtils.checkMessageError('ping_tab');
      if (response === MessageTypes.PONG_TAB) {
        if (frame.loadedCallbacks.has(sendResponse)) {
          frame.loadedCallbacks.delete(sendResponse);
          sendResponse('loaded');
        }
      }
    });
    return true;
  } else if (msg.type === MessageTypes.SEND_TO_CONTENT) {
    chrome.tabs.sendMessage(tab.tabId, {
      type: MessageTypes.MESSAGE_FROM_CONTENT,
      data: msg.data,
      destination: msg.destination,
    }, {
      frameId: frame.frameId,
    }, (response) => {
      BackgroundUtils.checkMessageError('message_from_content');
    });
  } else if (msg.type === MessageTypes.REQUEST_SOURCES) {
    sendSources(frame);
  } else if (msg.type === MessageTypes.SET_HEADERS) {
    if (msg.commands.length) {
      ruleManager.addHeaderRule(msg.url, sender.tab.id, msg.commands).then((rule) => {
        if (Logging) console.log('Added rule', msg, rule);
        sendResponse();
      });
      return true;
    }
  } else if (msg.type === MessageTypes.DETECTED_SOURCE) {
    const mode = URLUtils.getModeFromExtension(msg.ext);
    const headers = msg.headers || {};
    onSourceRecieved({
      url: msg.url,
      requestId: -1,
      customHeaders: headers,
    }, frame, mode);
  } else if (msg.type === MessageTypes.YT_LOADED) {
    frame.url = msg.url;
    checkYTURL(frame);
  } else if (msg.type === MessageTypes.DOWNLOAD) {
    const url = msg.url;
    const filename = msg.filename;
    // Check if cookieStoreId is set
    if (sender.tab.cookieStoreId && sender.tab.cookieStoreId !== 'firefox-default') {
      chrome.tabs.create({
        url: BackgroundUtils.getPlayerUrl(),
        cookieStoreId: sender.tab.cookieStoreId,
        active: false,
      }, (tabobj2) => {
        if (!tabobj2) {
          sendResponse(null);
          return;
        }
        const tab2 = Tabs.getTabOrCreate(tabobj2.id);
        tab2.downloadInfo = {
          url: url,
          filename: filename,
          resolve: sendResponse,
        };
      });
    } else {
      chrome.downloads.download({
        url: url,
        filename: filename,
      }).then((downloadId) => {
        sendResponse(downloadId);
      });
    }
    return true;
  } else if (msg.type === MessageTypes.STORE_ANALYZER_DATA) {
    if (Logging) console.log('Analyzer data', msg.data);
    tab.analyzerData = msg.data;
  } else if (msg.type === MessageTypes.SEND_TO_PLAYER) {
    const pframe = tab.getFrame(msg.frameId);
    if (!pframe || !pframe.isPlayer) {
      sendResponse(null);
      return;
    }

    chrome.tabs.sendMessage(pframe.tab.tabId, {
      type: MessageTypes.MESSAGE_FROM_PAGE,
      data: msg.data,
    }, {
      frameId: pframe.frameId,
    }, (response) => {
      BackgroundUtils.checkMessageError('message_from_page');

      sendResponse(response);
    });
    return true;
  } else if (msg.type === MessageTypes.REQUEST_FULLSCREEN) {
    return handleFullscreenRequest(frame, msg, sendResponse);
  } else if (msg.type === MessageTypes.REQUEST_WINDOWED_FULLSCREEN) {
    return handleWindowedFullscreenRequest(frame, msg, sendResponse);
  } else if (msg.type === MessageTypes.REQUEST_MINIPLAYER) {
    return handleMiniplayerRequest(frame, msg, sendResponse);
  } else if (msg.type === MessageTypes.REQUEST_PLAYLIST_NAVIGATION) {
    const pageFrame = frame.pageFrame;
    if (!pageFrame) {
      sendResponse('error');
      return;
    }

    chrome.tabs.sendMessage(pageFrame.tab.tabId, {
      type: MessageTypes.PLAYLIST_NAVIGATION,
      direction: msg.direction,
    }, {
      frameId: pageFrame.frameId,
    }, (response) => {
      BackgroundUtils.checkMessageError('playlist_navigation');
      if (response === 'clicked') {
        tab.continuationOptions = msg.continuationOptions;
      }
      sendResponse(response);
    });
    return true;
  } else if (msg.type === MessageTypes.REQUEST_PLAYLIST_POLL) {
    const pageFrame = frame.pageFrame;
    if (!pageFrame || frame.frameId === 0) {
      sendResponse('error');
      return;
    }

    chrome.tabs.sendMessage(pageFrame.tab.tabId, {
      type: MessageTypes.PLAYLIST_POLL,
    }, {
      frameId: pageFrame.frameId,
    }, (response) => {
      BackgroundUtils.checkMessageError('playlist_poll');
      sendResponse(response);
    });
    return true;
  } else if (msg.type === MessageTypes.REQUEST_SPONSORBLOCK) {
    if (msg.action === 'getSkipSegments' && frame.frameId !== 0) {
      // send message to parent frame
      chrome.tabs.sendMessage(frame.tab.tabId, {
        type: MessageTypes.SPONSORBLOCK_SCRAPE,
        videoId: msg.videoId,
      }, {
        frameId: frame.parent.frameId,
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
  } else if (msg.type === MessageTypes.REQUEST_YT_DATA) {
    const pageFrame = frame.pageFrame;
    if (!pageFrame) {
      sendResponse('error');
      return;
    }

    chrome.tabs.sendMessage(pageFrame.tab.tabId, {
      type: MessageTypes.EXTRACT_YT_DATA,
    }, {
      frameId: pageFrame.frameId,
    }, (response) => {
      BackgroundUtils.checkMessageError('extract_yt_data');
      sendResponse(response);
    });
    return true;
  } else {
    return;
  }

  sendResponse('ok');
});

async function cascadedFullscreen(playerFrame, finalFrame, data) {
  const trace = traceFrames(playerFrame, finalFrame);
  if (trace.length < 2) {
    return 'error';
  }

  const result = await new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(playerFrame.tab.tabId, {
      ...data,
      frameId: trace[trace.length - 2].frameId,
      playerFrameId: playerFrame.frameId,
    }, {
      frameId: finalFrame.frameId,
    }, (response) => {
      BackgroundUtils.checkMessageError('cascade_fullscreen_' + data.type);
      resolve(response);
    });
  });

  if (result !== 'enter' && result !== 'exit') {
    return result;
  }

  const newValue = result === 'enter';
  const promises = [];
  for (let i = 1; i < trace.length - 1; i++) {
    const currentFrame = trace[i];
    const lastFrame = trace[i - 1];
    promises.push(new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(currentFrame.tab.tabId, {
        type: MessageTypes.TOGGLE_WINDOWED_FULLSCREEN,
        force: newValue,
        frameId: lastFrame.frameId,
      }, {
        frameId: currentFrame.frameId,
      }, (response) => {
        BackgroundUtils.checkMessageError('toggle_fullscreen_windowed');
        resolve(response);
      });
    }));
  }

  await Promise.all(promises);

  return result;
}

function handleFullscreenRequest(frame, msg, sendResponse) {
  if (frame.frameId === 0) {
    sendResponse('error');
    return;
  }

  const fn = async () => {
    const fullScreenAllowedFrame = await getFrameWithFullscreenPermission(frame);

    if (!fullScreenAllowedFrame) {
      sendResponse('error');
      return;
    }

    const result = await cascadedFullscreen(frame, fullScreenAllowedFrame, {
      type: MessageTypes.TOGGLE_FULLSCREEN,
      force: msg.force,
    });

    sendResponse(result);
  };
  fn();
  return true;
}

function handleWindowedFullscreenRequest(frame, msg, sendResponse) {
  if (frame.frameId === 0) {
    sendResponse('error');
    return;
  }

  const fn = async () => {
    const mainFrame = frame.tab.getFrameOrCreate(0);

    const result = await cascadedFullscreen(frame, mainFrame, {
      type: MessageTypes.TOGGLE_WINDOWED_FULLSCREEN,
      force: msg.force,
    });

    sendResponse(result);
  };
  fn();
  return true;
}

function handleMiniplayerRequest(frame, msg, sendResponse) {
  if (frame.frameId === 0) {
    sendResponse('error');
    return;
  }

  const fn = async () => {
    const pageFrame = frame.pageFrame;
    if (!pageFrame) {
      sendResponse('error');
      return;
    }

    const result = await cascadedFullscreen(frame, pageFrame, {
      type: MessageTypes.TOGGLE_MINIPLAYER,
      force: msg.force,
      size: msg.size,
      styles: msg.styles,
      autoExit: msg.autoExit,
    });

    sendResponse(result);
  };
  fn();
  return true;
}

async function getFrameWithFullscreenPermission(frame) {
  let currentFrame = frame.parent;
  while (currentFrame) {
    const isFullscreenAllowed = await checkIsFullscreenAllowed(currentFrame);
    if (isFullscreenAllowed) {
      return currentFrame;
    }
    currentFrame = currentFrame.parent;
  }

  return null;
}

function traceFrames(frame, toFrame) {
  if (frame === toFrame) {
    return [frame];
  }
  const frames = [];
  let currentFrame = frame;
  while (currentFrame && currentFrame !== toFrame) {
    frames.push(currentFrame);
    currentFrame = currentFrame.parent;
  }

  frames.push(toFrame);

  return frames;
}

async function checkIsFullscreenAllowed(frame) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(frame.tab.tabId, {
      type: MessageTypes.TOGGLE_FULLSCREEN,
      queryPermissions: true,
    }, {
      frameId: frame.frameId,
    }, (response) => {
      BackgroundUtils.checkMessageError('check_fullscreen');
      resolve(response);
    });
  });
}

function checkYTURL(frame) {
  const url = frame.url;
  // Check if url is youtube
  if (BackgroundUtils.isUrlPlayerUrl(url)) {
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


async function getPageFrame(frame) {
  let currentFrame = frame;
  while (currentFrame && currentFrame.parent) {
    if (!currentFrame.linkPromise) {
      currentFrame.linkPromise = linkToParentFrame(currentFrame);
    }

    await currentFrame.linkPromise;

    const isFull = await checkIsFull(currentFrame);
    if (!isFull) {
      return currentFrame.parent;
    }
    currentFrame = currentFrame.parent;
  }

  return null;
}

async function checkIsFull(frame) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(frame.tab.tabId, {
      type: MessageTypes.IS_FULL,
      frameId: frame.frameId,
    }, {
      frameId: frame.parent.frameId,
    }, (response) => {
      BackgroundUtils.checkMessageError('is_full');
      resolve(response);
    });
  });
}

async function linkToParentFrame(frame) {
  if (!frame.parent) return;

  // Generate random string
  const key = crypto.randomUUID();

  return await new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(frame.tab.tabId, {
      type: MessageTypes.FRAME_LINK_RECEIVER,
      frameId: frame.frameId,
      key,
    }, {
      frameId: frame.parent.frameId,
    }, (response) => {
      BackgroundUtils.checkMessageError('link_frame_reciever');
      chrome.tabs.sendMessage(frame.tab.tabId, {
        type: MessageTypes.FRAME_LINK_SENDER,
        key,
      }, {
        frameId: frame.frameId,
      }, (response) => {
        BackgroundUtils.checkMessageError('link_frame_sender');
        resolve();
      });
    });
  });
}

function getMediaInfoFromTab(tab) {
  if (!tab || BackgroundUtils.isUrlPlayerUrl(tab.url)) return;
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
  title = title.replace(/\bseason\s*([0-9]+)/gi, (match, p1) => {
    season = parseInt(p1);
    return '';
  });

  title = title.replace(/\bepisode\s*([0-9]+)/gi, (match, p1) => {
    episode = parseInt(p1);
    return '';
  });

  if (season === null) {
    title = title.replace(/\bs([0-9]+)/gi, (match, p1) => {
      season = parseInt(p1);
      return '';
    });
  }

  if (episode === null) {
    title = title.replace(/\be([0-9]+)/gi, (match, p1) => {
      episode = parseInt(p1);
      return '';
    });
  }

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

  AutoEnableList.length = 0;
  Options.autoEnableURLs.forEach((urlStr) => {
    if (urlStr.length === 0) {
      return;
    }

    const obj = {
      exclude_domain: false,
      negative: false,
      regex: false,
      match: null,
    };

    while (urlStr.length > 0) {
      if (urlStr[0] === '!') {
        obj.negative = true;
        urlStr = urlStr.substring(1);
      } else if (urlStr[0] === '~') {
        obj.regex = true;
        urlStr = urlStr.substring(1);
      } else if (urlStr[0] === '-') {
        obj.exclude_domain = true;
        urlStr = urlStr.substring(1);
      } else {
        break;
      }
    }

    if (obj.exclude_domain) {
      try {
        // Check if starts with http or https, add it if not
        if (!urlStr.startsWith('http')) {
          urlStr = 'http://' + urlStr;
        }

        obj.domain = new URL(urlStr).hostname;
      } catch (e) {
      }
    } else if (obj.regex) {
      try {
        obj.match = new RegExp(urlStr);
      } catch (e) {

      }
    } else {
      obj.match = urlStr;
    }

    if (obj.match) {
      AutoEnableList.push(obj);
    }
  });

  // Reverse auto enable list
  AutoEnableList.reverse();

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

  loadCustomPatterns();
}


async function setupRedirectRule(ruleID, filetypes) {
  const excludedRequestDomains = [(new URL(BackgroundUtils.getPlayerUrl())).hostname];

  AutoEnableList.forEach((item) => {
    if (item.exclude_domain && item.domain && !excludedRequestDomains.includes(item.domain)) {
      excludedRequestDomains.push(item.domain);
    }
  });

  const rule = {
    id: ruleID,
    action: {
      type: 'redirect',
      redirect: {regexSubstitution: BackgroundUtils.getPlayerUrl() + '#\\0'},
    },
    condition: {
      // exclude self
      excludedRequestDomains,
      // only match m3u8 or mpds
      regexFilter: '^.+\\.(' + filetypes.join('|') + ')([\\?|#].*)?$',
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

function handleSubtitles(url, frame, headers) {
  const subtitles = frame.getSubtitles();
  if (subtitles.find((a) => {
    return a.source === url;
  })) return;

  if (Logging) console.log('Found subtitle', url);
  const u = (new URL(url)).pathname.split('/').pop();

  subtitles.push({
    source: url,
    headers: headers,
    label: u.split('.')[0],
    time: Date.now(),
  });
}

function getSourceFromURL(frame, url) {
  return frame.getSources().find((a) => {
    return a.url === url;
  });
}

function addSource(frame, url, mode, headers) {
  frame.getSources().push({
    url, mode, headers,
    time: Date.now(),
  });
}

function collectSources(frame, remove = false) {
  const subtitles = [];
  const sources = [];

  let currentFrame = frame;
  let removed = false;
  let depth = 0;

  while (currentFrame) {
    const currentSubtitles = currentFrame.getSubtitles();
    for (const sub of currentSubtitles) {
      subtitles.push({
        ...sub,
        depth,
        frameId: currentFrame.frameId,
      });
    }

    const currentSources = currentFrame.getSources();
    for (const source of currentSources) {
      sources.push({
        ...source,
        depth,
        frameId: currentFrame.frameId,
      });
    }

    if (!removed && remove) {
      if (currentSources.length !== 0) {
        removed = true;
      }
      currentSources.length = 0;
      currentSubtitles.length = 0;
    }

    if (sources.length !== 0) break;

    currentFrame = currentFrame.parent;
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

  const continuationOptions = frame.tab.continuationOptions;
  frame.tab.continuationOptions = null;

  chrome.tabs.sendMessage(frame.tab.tabId, {
    type: MessageTypes.SOURCES,
    subtitles: subtitles,
    sources: sources,
    autoSetSource: true,
    continuationOptions: continuationOptions,
  }, {
    frameId: frame.frameId,
  }, () => {
    BackgroundUtils.checkMessageError('sources');
  });
}

async function scrapeCaptionsTags(frame) {
  const tabId = frame.tab.tabId;
  const frameId = frame.frameId;
  if (tabId < 0) return null;

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, {
      type: MessageTypes.SCRAPE_CAPTIONS,
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
      type: MessageTypes.GET_VIDEO_SIZE,
    }, {
      frameId: frame.frameId,
    }, (size) => {
      BackgroundUtils.checkMessageError('get_video_size');
      resolve(size);
    });
  });
}

async function pingContentScript() {
  return new Promise(async (resolve, reject) => {
    const tabs = await BackgroundUtils.queryTabs();
    const message = {
      type: MessageTypes.PING_TAB,
    };

    // try one tab at a time. If it fails, try the next one
    for (const tab of tabs) {
      const result = await new Promise((resolve, reject) => {
        try {
          chrome.tabs.sendMessage(tab.id, message, (returnMessage) => {
            if (chrome.runtime.lastError || returnMessage !== MessageTypes.PONG_TAB) {
              resolve(false);
            } else {
              resolve(true);
            }
          });
        } catch (e) {
          resolve(false);
        }
      });

      if (result) {
        resolve(true);
        return;
      }
    }
    resolve(false);
  });
}

async function openPlayer(frame) {
  if (frame.playerOpening || frame.hasPlayer()) {
    return;
  }

  frame.playerOpening = true;

  if (Logging) console.log('Opening player', frame);

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(frame.tab.tabId, {
      type: MessageTypes.OPEN_PLAYER,
      url: BackgroundUtils.getPlayerUrl(),
      noRedirect: frame.frameId === 0,
      frameId: frame.frameId,
      parentFrameId: frame.parent ? frame.parent.frameId : -1,
    }, {
      frameId: frame.frameId,
    }, (response) => {
      BackgroundUtils.checkMessageError('player');

      if (response === 'no_video') {
        frame.playerOpening = false;
      }

      resolve(response);
    });
  });
}

async function sendSourcesToMainFramePlayers(frame) {
  // query all tabs
  const tabs = await BackgroundUtils.queryTabs();

  // for each tab
  for (let i = 0; i < tabs.length; i++) {
    const tab = Tabs.getTab(tabs[i].id);
    if (!tab || !tab.isOn) continue;
    // if the tab is a faststream tab
    const mainPlayerFrame = tab.getMainPlayer();
    if (mainPlayerFrame) {
      // send the source to the tab
      chrome.tabs.sendMessage(tab.tabId, {
        type: MessageTypes.SOURCES,
        subtitles: frame.getSubtitles(),
        sources: frame.getSources(),
        autoSetSource: false,
      }, () => {
        BackgroundUtils.checkMessageError('sources');
      });
    }
  }
}

async function onSourceRecieved(details, frame, mode) {
  if ((URLUtils.is_url_yt(frame.url) || URLUtils.is_url_yt(frame.tab.url)) && mode !== PlayerModes.ACCELERATED_YT) {
    return;
  }

  const url = details.url;
  const customHeaders = details.customHeaders || frame.requestHeaders.get(details.requestId);

  if (getSourceFromURL(frame, url)) return;

  // Check if service worker
  if (frame.tab.tabId < 0 && details.initiator) {
    // get current frame
    const currentFrame = await new Promise(async (resolve, reject) => {
      try {
        const ctabs = await BackgroundUtils.queryTabs();
        ctabs.every((ctab) => {
          const tab = Tabs.getTab(ctab.id);
          if (!tab) return true;

          for (const frame of tab.getFrames()) {
            const furl = frame.url;
            if (furl && furl.length >= details.initiator.length && furl.substring(0, details.initiator.length) === details.initiator) {
              resolve(frame);
              return false;
            }
          }
          return true;
        });
      } catch (e) {
        resolve(null);
        return;
      }
    });

    if (currentFrame) {
      frame = currentFrame;
    }
  }

  addSource(frame, url, mode, customHeaders);

  const subs = await scrapeCaptionsTags(frame);
  if (subs) {
    subs.forEach((s) => {
      if (frame.subtitles.every((ss, i) => {
        if (s.source === ss.source) {
          frame.subtitles[i] = s;
          return false;
        }
        return true;
      })) frame.subtitles.push(s);
    });
  }

  if (frame.tab.isOn) {
    clearTimeout(frame.openTimeout);
    frame.openTimeout = setTimeout(() => {
      if (frame.tab.isOn) {
        openPlayer(frame);
      }
    }, Options.replaceDelay);
  }

  sendSourcesToMainFramePlayers(frame);

  if (Logging) console.log('Found source', details, frame);

  return;
}

async function openPlayersWithSources(tab) {
  let framesWithSources = [];
  for (const frame of tab.getFrames()) {
    if (!frame.isPlayer && frame.getSources().length > 0) {
      framesWithSources.push(frame);
    }
  }

  if (framesWithSources.length > 0) {
    framesWithSources = await Promise.all(framesWithSources.map(async (frame) => {
      return {frame, videoSize: await getVideoSize(frame)};
    }));

    framesWithSources.sort((a, b) => {
      return b.videoSize - a.videoSize;
    });

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

chrome.webRequest.onBeforeRequest.addListener((details) => {
  const tab = Tabs.getTabOrCreate(details.tabId);
  const frame = tab.getFrameOrCreate(details.frameId);
  if (!frame.parent && details.parentFrameId !== -1) {
    const parentFrame = tab.getFrameOrCreate(details.parentFrameId);
    frame.setParentFrame(parentFrame);
  }
}, {
  urls: ['<all_urls>'],
});

chrome.webRequest.onBeforeSendHeaders.addListener((details) => {
  const tab = Tabs.getTabOrCreate(details.tabId);
  const frame = tab.getFrameOrCreate(details.frameId);
  frame.requestHeaders.set(details.requestId, details.requestHeaders);
}, {
  urls: ['<all_urls>'],
}, webRequestPerms);

// Exclude urls from facebook and vimeo.
const initiatorBlacklist = [
  'https://www.facebook.com',
  'https://www.instagram.com',
  'https://vimeo.com',
];

chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
      const url = details.url;
      let ext = URLUtils.get_url_extension(url);
      const tab = Tabs.getTabOrCreate(details.tabId);
      const frame = tab.getFrameOrCreate(details.frameId);
      if (frame.hasPlayer()) return;

      if ((details.statusCode >= 400 && details.statusCode < 600) || details.statusCode === 204) {
        return; // Client or server error. Ignore it
      }

      if (details.initiator &&
      initiatorBlacklist.some((a) => {
        return details.initiator.startsWith(a);
      })) {
        if (url.startsWith('https://vod-adaptive') && url.includes('playlist.json')) {
          ext = 'vmpatch';
          // chrome.tabs.sendMessage(details.tabId, {
          //   type: 'vmurl',
          //   url: url,
          //   headers: frame.requestHeaders.get(details.requestId),
          // }, {
          //   frameId: details.frameId,
          // }, () => {
          //   BackgroundUtils.checkMessageError('vmurl');
          // });
          // return;
        } else if (ext === 'json') {

        } else {
          return;
        }
      }

      const output = CustomSourcePatternsMatcher.match(url);
      if (output) {
        ext = output;
      }

      if (BackgroundUtils.isSubtitles(ext)) {
        return handleSubtitles(url, frame, frame.requestHeaders.get(details.requestId));
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
          // Check url query parameters
          const urlParams = URLUtils.get_url_params(url).values();
          for (const value of urlParams) {
            if (!URLUtils.is_url(value)) continue;
            let ext2 = URLUtils.get_url_extension(value);

            const output = CustomSourcePatternsMatcher.match(value);
            if (output) {
              ext2 = output;
            }

            mode = URLUtils.getModeFromExtension(ext2);
            if (mode) {
              break;
            }
          }
          if (!mode) {
            return;
          }
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
  const tab = Tabs.getTabOrCreate(details.tabId);
  const frame = tab.getFrameOrCreate(details.frameId);
  frame.requestHeaders.delete(details.requestId);
}

loadOptions().catch(console.error);

setInterval(async () => {
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
