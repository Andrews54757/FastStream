const MessageTypes = {
  PING: 'PING',
  PONG: 'PONG',
  LOAD_OPTIONS: 'LOAD_OPTIONS',
  UPDATE_OPTIONS: 'UPDATE_OPTIONS',
  FRAME_LOADED: 'FRAME_LOADED',
  PLAYER_LOADED: 'PLAYER_LOADED',
  REQUEST_FRAMEID: 'REQUEST_FRAMEID',
  FRAMEID: 'FRAMEID',
  REQUEST_SOURCES: 'REQUEST_SOURCES',
  SOURCES: 'SOURCES',
  PING_TAB: 'PING_TAB',
  PONG_TAB: 'PONG_TAB',
  OPEN_PLAYER: 'OPEN_PLAYER',
  SET_HEADERS: 'SET_HEADERS',
  SEND_TEST_REQUEST: 'SEND_TEST_REQUEST',
  GET_VIDEO_SIZE: 'GET_VIDEO_SIZE',
  FRAME_ADDED: 'FRAME_ADDED',
  REMOVE_PLAYERS: 'REMOVE_PLAYERS',
  IS_FULL: 'IS_FULL',
  SCRAPE_CAPTIONS: 'SCRAPE_CAPTIONS',
  DETECTED_SOURCE: 'DETECTED_SOURCE',
  YT_LOADED: 'YT_LOADED',
  FRAME_LINK_SENDER: 'FRAME_LINK_SENDER',
  FRAME_LINK_RECEIVER: 'FRAME_LINK_RECEIVER',
  STORE_ANALYZER_DATA: 'STORE_ANALYZER_DATA',
  SEND_TO_PLAYER: 'SEND_TO_PLAYER',
  MESSAGE_FROM_PAGE: 'MESSAGE_FROM_PAGE',
  SEND_TO_PAGE: 'SEND_TO_PAGE',
  MESSAGE_FROM_PLAYER: 'MESSAGE_FROM_PLAYER',
  TOGGLE_MINIPLAYER: 'TOGGLE_MINIPLAYER',
  TOGGLE_FULLSCREEN: 'TOGGLE_FULLSCREEN',
  TOGGLE_WINDOWED_FULLSCREEN: 'TOGGLE_WINDOWED_FULLSCREEN',
  REQUEST_FULLSCREEN: 'REQUEST_FULLSCREEN',
  REQUEST_WINDOWED_FULLSCREEN: 'REQUEST_WINDOWED_FULLSCREEN',
  REQUEST_MINIPLAYER: 'REQUEST_MINIPLAYER',
  REQUEST_PLAYLIST_NAVIGATION: 'REQUEST_PLAYLIST_NAVIGATION',
  PLAYLIST_NAVIGATION: 'PLAYLIST_NAVIGATION',
  REQUEST_PLAYLIST_POLL: 'REQUEST_PLAYLIST_POLL',
  PLAYLIST_POLL: 'PLAYLIST_POLL',
  SPONSORBLOCK_SCRAPE: 'SPONSORBLOCK_SCRAPE',
  REQUEST_SPONSORBLOCK_SCRAPE: 'REQUEST_SPONSORBLOCK_SCRAPE',
  FRAME_REMOVED: 'FRAME_REMOVED',
};

const iframeMap = new Map();
const replacedPlayerQueue = [];
const elementsHiddenByFillscreen = [];
const linkRequests = new Map();
let MiniplayerCooldown = 0;
let FoundYTPlayer = null;
let OverridenYTKeys = false;


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === MessageTypes.IS_FULL) {
    const frameId = request.frameId;
    const iframeObj = iframeMap.get(frameId);
    if (!iframeObj) {
      console.error('no element found');
      sendResponse(false);
      return;
    }

    const parents = getParentElementsWithSameBounds(iframeObj.iframe);
    if (parents.length > 0 && parents[parents.length - 1].tagName === 'BODY') {
      sendResponse(true);
    } else {
      sendResponse(false);
    }
    return;
  } else if (request.type === MessageTypes.FRAME_LINK_RECEIVER) {
    linkRequests.set(request.key, {
      frameId: request.frameId,
    });
    sendResponse('ok');
    return;
  } else if (request.type === MessageTypes.FRAME_LINK_SENDER) {
    window.parent.postMessage(request.key, '*');
    sendResponse('ok');
    return;
  } else if (request.type === MessageTypes.PING_TAB) {
    sendResponse(MessageTypes.PONG_TAB);
  } else if (request.type === MessageTypes.OPEN_PLAYER) {
    return handlePlayerOpen(request, sender, sendResponse);
  } else if (request.type === MessageTypes.REMOVE_PLAYERS) {
    removePlayers();
    sendResponse('ok');
  } else if (request.type === MessageTypes.GET_VIDEO_SIZE) {
    getVideo().then((video) => {
      sendResponse(video ? video.size : 0);
    });
    return true;
  } else if (request.type === MessageTypes.SCRAPE_CAPTIONS) {
    return handleCaptionsScrape(request, sender, sendResponse);
  } else if (request.type === MessageTypes.TOGGLE_MINIPLAYER) {
    return handleMiniplayer(request, sender, sendResponse);
  } else if (request.type === MessageTypes.TOGGLE_FULLSCREEN) {
    return handleFullscreen(request, sender, sendResponse);
  } else if (request.type === MessageTypes.TOGGLE_WINDOWED_FULLSCREEN) {
    return handleWindowedFullscreen(request, sender, sendResponse);
  } else if (request.type === MessageTypes.PLAYLIST_NAVIGATION) {
    return handlePlaylistNavigation(request, sender, sendResponse);
  } else if (request.type === MessageTypes.PLAYLIST_POLL) {
    return pollPlaylistButtons(request, sender, sendResponse);
  } else if (request.type === MessageTypes.SPONSORBLOCK_SCRAPE) {
    return handleSponsorBlockScrape(request, sender, sendResponse);
  }
});

window.addEventListener('message', (e) => {
  if (typeof e.data !== 'string') {
    return;
  }

  const request = linkRequests.get(e.data);
  if (request) {
    linkRequests.delete(e.data);
    const iframeElement = findIframeWithWindow(e.source);
    if (!iframeElement) {
      console.error('no iframe found');
      return;
    }

    // Find matched in replaced players
    const replacedIndex = replacedPlayerQueue.findIndex((player) => player.iframe === iframeElement);
    let replacedData = null;
    if (replacedIndex !== -1) {
      replacedData = replacedPlayerQueue[replacedIndex];
      replacedPlayerQueue.splice(replacedIndex, 1);
    }

    const newFrameObj = {
      iframe: iframeElement,
      frameId: request.frameId,
      replacedData,
      miniplayerState: {},
      fullscreenState: {},
      windowedFullscreenState: {},
    };

    iframeMap.set(request.frameId, newFrameObj);

    updateReplacedPlayers();
  }
});

function findIframeWithWindow(win) {
  const iframes = querySelectorAllIncludingShadows('iframe');
  for (let i = 0; i < iframes.length; i++) {
    if (iframes[i].contentWindow === win) {
      return iframes[i];
    }
  }
  return null;
}


function handlePlaylistNavigation(request, sender, sendResponse) {
  const button = getNextOrPreviousButton(request.direction === 'next');
  if (!button) {
    sendResponse('no_button');
    return;
  }

  button.click();
  sendResponse('clicked');
}

function pollPlaylistButtons(request, sender, sendResponse) {
  try {
    const nextButton = getNextOrPreviousButton(true);
    const previousButton = getNextOrPreviousButton(false);
    sendResponse({
      next: nextButton !== null,
      previous: previousButton !== null,
    });
  } catch (e) {
    sendResponse({
      error: e.message,
    });
  }
}

function handlePlayerOpen(request, sender, sendResponse) {
  getVideo().then((video) => {
    if (!video && !request.force) {
      console.log('no video found');
      sendResponse('no_video');
      return;
    }

    const playerFillsScreen = video?.highest?.tagName === 'BODY';
    if (!video || (playerFillsScreen && !request.noRedirect)) {
      if (!document.fullscreenEnabled) {
        window.location = request.url;
        console.log('redirecting to player');
        sendResponse('redirect');
      } else {
        const iframe = document.createElement('iframe');
        iframe.src = request.url;
        iframe.allowFullscreen = true;
        iframe.allow = 'autoplay; fullscreen; picture-in-picture';
        pauseAllWithin(document.body);
        // Remove everything from the document
        document.body.appendChild(iframe);
        fillScreenIframe(iframe);
        console.log('Overlaying iframe');
        sendResponse('replaceall');
      }
    } else {
      const softReplace = request.softReplace || is_url_yt(window.location.href) || false;
      // copy styles
      const iframe = document.createElement('iframe');
      iframe.allowFullscreen = true;
      iframe.allow = 'autoplay; fullscreen; picture-in-picture';
      iframe.style.display = 'none';
      iframe.src = request.url;

      if (softReplace) {
        video.highest.parentNode.insertBefore(iframe, video.highest);
      } else {
        video.highest.parentNode.replaceChild(iframe, video.highest);
      }

      // updateIframeStyle(video.highest, iframe, isYt, playerFillsScreen);
      const watcher = pauseAllWithin(video.highest);

      replacedPlayerQueue.push({
        iframe,
        watcher,
        old: video.highest,
        softReplace,
        fillScreen: playerFillsScreen,
      });
      console.log('replacing video with iframe');
      sendResponse('replace');
    }

    OverridenYTKeys = true;
  });
  return true;
}

function handleWindowedFullscreen(request, sender, sendResponse) {
  const iframeObj = iframeMap.get(request.frameId);
  if (!iframeObj) {
    sendResponse('no_element');
    throw new Error('No element found for frame id ' + request.frameId);
  }

  const windowedFullscreenState = iframeObj.windowedFullscreenState;

  if (request.force === undefined || request.force !== windowedFullscreenState.active) {
    windowedFullscreenToggle(iframeObj);
  }

  if (windowedFullscreenState.active) {
    sendResponse('enter');
  } else {
    sendResponse('exit');
  }
}

function handleMiniplayer(request, sender, sendResponse) {
  if (Date.now() < MiniplayerCooldown) {
    sendResponse('cooldown');
    return;
  }

  const iframeObj = iframeMap.get(request.frameId);
  if (!iframeObj) {
    sendResponse('no_element');
    console.error('No element found for frame id ' + request.frameId);
    return;
  }

  const miniplayerState = iframeObj.miniplayerState;

  miniplayerState.size = request.size;
  miniplayerState.styles = request.styles;
  miniplayerState.playerFrameId = request.playerFrameId;

  if (miniplayerState.closeObserver) {
    miniplayerState.closeObserver.disconnect();
    miniplayerState.closeObserver = null;
  }

  if ((request.force !== undefined && request.force === miniplayerState.active) || iframeObj.windowedFullscreenState.active || document.fullscreenElement) {
    updateMiniPlayer(iframeObj);
  } else {
    toggleMiniPlayer(iframeObj);
  }

  if (miniplayerState.active && request.autoExit) {
    // if placeholder is visible again
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.intersectionRatio > 0.3 && miniplayerState.active) {
      //  unmakeMiniPlayer(iframeObj);
        observer.disconnect();

        chrome.runtime.sendMessage({
          type: MessageTypes.SEND_TO_PLAYER,
          frameId: miniplayerState.playerFrameId,
          data: {
            type: 'miniplayer-state',
            value: false,
          },
        });
        // updateReplacedPlayers();
      }
    }, {
      threshold: [0, 0.25, 0.5],
    });
    observer.observe(miniplayerState.placeholder);
    miniplayerState.closeObserver = observer;
  }

  if (miniplayerState.active) {
    sendResponse('enter');
  } else {
    sendResponse('exit');
  }
}

function handleFullscreen(request, sender, sendResponse) {
  if (request.queryPermissions) {
    sendResponse(!!document.fullscreenEnabled);
    return;
  }

  const iframeObj = iframeMap.get(request.frameId);
  if (!iframeObj) {
    sendResponse('no_element');
    throw new Error('No element found for frame id ' + request.frameId);
  }

  const fullscreenState = iframeObj.fullscreenState;
  fullscreenState.playerFrameId = request.playerFrameId;

  const element = iframeObj.iframe;
  const force = request.force;

  const newValue = force === undefined ? document.fullscreenElement !== element : force;
  fullscreenState.active = newValue;
  if (newValue) {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    sendResponse('exit');
  } else {
    element.requestFullscreen().then(() => {
      sendResponse('enter');
    }).catch((e) => {
      sendResponse('error');
      throw e;
    });
  }
  return true;
}

function handleCaptionsScrape(request, sender, sendResponse) {
  const trackElements = querySelectorAllIncludingShadows('track');
  let done = 0;
  const tracks = [];
  for (let i = 0; i < trackElements.length; i++) {
    const track = trackElements[i];
    if (track.src && track.kind === 'captions') {
      const source = track.src;
      httpRequest(source, (err, req, body) => {
        done++;
        if (body) {
          tracks.push({
            data: body,
            source: source,
            label: track.label,
            language: track.srclang,
          });
        }
        if (done === tracks.length) sendResponse(tracks);
      });
    }
  }
  if (done === tracks.length) sendResponse(tracks);

  return true;
}

function removePlayers() {
  MiniplayerCooldown = Date.now() + 1000;
  iframeMap.forEach((iframeObj) => {
    unmakeMiniPlayer(iframeObj);
    if (iframeObj.replacedData) {
      const replacedData = iframeObj.replacedData;
      if (replacedData.softReplace) {
        showSoft(replacedData.old);
        replacedData.iframe.parentNode.removeChild(replacedData.iframe);
      } else {
        replacedData.iframe.parentNode.replaceChild(replacedData.old, replacedData.iframe);
      }
      removePauseListeners(replacedData.old, replacedData.watcher);
      iframeObj.replacedData = null;

      chrome.runtime.sendMessage({
        type: MessageTypes.FRAME_REMOVED,
        frameId: iframeObj.frameId,
      });
    }
  });

  undoFillScreenIframe();

  replacedPlayerQueue.forEach((replacedData) => {
    if (replacedData.softReplace) {
      showSoft(replacedData.old);
      replacedData.iframe.parentNode.removeChild(replacedData.iframe);
    } else {
      replacedData.iframe.parentNode.replaceChild(replacedData.old, replacedData.iframe);
    }
    removePauseListeners(replacedData.old, replacedData.watcher);
  });

  replacedPlayerQueue.length = 0;
  FoundYTPlayer = null;
  OverridenYTKeys = false;
}

function updateMiniPlayer(iframeObj) {
  const miniplayerState = iframeObj.miniplayerState;
  if (miniplayerState.active) {
    const element = miniplayerState.placeholder;
    const aspectRatio = element.clientWidth / element.clientHeight;
    const newWidth = Math.min(Math.max(window.screen.width, window.screen.height * aspectRatio) * miniplayerState.size, document.body.clientWidth);
    const newHeight = newWidth / aspectRatio;
    iframeObj.iframe.style.setProperty('width', newWidth + 'px', 'important');
    iframeObj.iframe.style.setProperty('height', newHeight + 'px', 'important');

    for (const key in miniplayerState.styles) {
      if (Object.hasOwn(miniplayerState.styles, key)) {
        iframeObj.iframe.style.setProperty(key, miniplayerState.styles[key], 'important');
      }
    }
  }
}

function resizeMiniPlayers() {
  iframeMap.forEach((iframeObj) => {
    updateMiniPlayer(iframeObj);
  });
}

function makeMiniPlayer(iframeObj) {
  const miniplayerState = iframeObj.miniplayerState;
  if (miniplayerState.active) {
    return;
  }

  miniplayerState.active = true;

  const element = iframeObj.iframe;
  const placeholder = document.createElement(element.tagName);

  transferId(element, placeholder);

  miniplayerState.placeholder = placeholder;
  miniplayerState.oldStyle = element.getAttribute('style') || '';
  placeholder.setAttribute('style', miniplayerState.oldStyle);
  placeholder.style.setProperty('background-color', 'black', 'important');
  placeholder.classList = element.classList;

  element.parentNode.insertBefore(placeholder, element);

  element.setAttribute('style', `
    position: fixed !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    padding: 0px !important;
    z-index: 2147483647 !important;
    border: 1px solid rgba(0, 0, 0, 0.2) !important;
    outline: none !important;
    top: auto !important;
    left: auto !important;
    right: auto !important;
    bottom: auto !important;
  `);
  updateMiniPlayer(iframeObj);
}

function unmakeMiniPlayer(iframeObj) {
  const miniplayerState = iframeObj.miniplayerState;
  if (!miniplayerState.active) {
    return;
  }

  if (miniplayerState.closeObserver) {
    miniplayerState.closeObserver.disconnect();
    miniplayerState.closeObserver = null;
  }

  const element = iframeObj.iframe;

  miniplayerState.active = false;

  element.setAttribute('style', miniplayerState.oldStyle);

  transferId(miniplayerState.placeholder, element);

  miniplayerState.placeholder.remove();
  miniplayerState.placeholder = null;
}

function toggleMiniPlayer(iframeObj) {
  const miniplayerState = iframeObj.miniplayerState;
  if (miniplayerState.active) {
    unmakeMiniPlayer(iframeObj);
    return false;
  } else {
    makeMiniPlayer(iframeObj);
    return true;
  }
}

function windowedFullscreenToggle(iframeObj) {
  const windowedFullscreenState = iframeObj.windowedFullscreenState;

  if (!windowedFullscreenState.active) {
    if (iframeObj.miniplayerState.active) {
      unmakeMiniPlayer(iframeObj);
    }

    windowedFullscreenState.active = true;
    windowedFullscreenState.oldStyle = iframeObj.iframe.getAttribute('style') || '';
    fillScreenIframe(iframeObj.iframe, iframeObj.softReplace);
  } else {
    windowedFullscreenState.active = false;
    iframeObj.iframe.setAttribute('style', windowedFullscreenState.oldStyle);
    undoFillScreenIframe();
    setTimeout(() => {
      updateReplacedPlayers();
    }, 1000);
  }
}

function undoFillScreenIframe() {
  elementsHiddenByFillscreen.forEach(([element, old]) => {
    element.style.display = old;
  });
  elementsHiddenByFillscreen.length = 0;
}

function fillScreenIframe(iframe, skipHide = false) {
  if (!skipHide) {
    const elementsToHide = [];

    // Gather all elements not parents of the iframe
    const elements = document.querySelectorAll('*');
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      if (element === iframe) {
        continue;
      }

      if (element.contains(iframe) ||
      element.tagName === 'BODY' ||
      element.tagName === 'HTML' ||
      element.tagName === 'HEAD'
      ) {
        continue;
      }

      elementsToHide.push(element);
    }

    elementsToHide.forEach((element) => {
      if (element === iframe) {
        return;
      }
      const found = elementsHiddenByFillscreen.find((e) => e[0] === element);
      if (found) {
        return;
      }
      const olddisplay = element.style.display;
      element.style.setProperty('display', 'none', 'important');
      elementsHiddenByFillscreen.push([element, olddisplay]);
    });
  }

  iframe.setAttribute('style', `
    position: fixed !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    padding: 0px !important;
    z-index: 2147483647 !important;
    border: none !important;
    outline: none !important;
    top: 0px !important;
    left: 0px !important;
    width: 100% !important;
    height: 100% !important;
    bottom: 0px !important;
    right: 0px !important;
  `);
}

function hideSoft(player) {
  player.style.setProperty('display', 'none', 'important');
}

function showSoft(player) {
  player.style.display = '';
}

function updateReplacedPlayers() {
  iframeMap.forEach((iframeObj) => {
    if (iframeObj.replacedData) {
      const {iframe, old, softReplace} = iframeObj.replacedData;
      if (iframeObj.miniplayerState.active) {
        const placeholder = iframeObj.miniplayerState.placeholder;
        updateReplacedPlayer(old, placeholder, softReplace);
        placeholder.style.setProperty('background-color', 'black', 'important');
      } else {
        updateReplacedPlayer(old, iframe, softReplace);
      }
    }
  });
}

function updateReplacedPlayer(old, iframe, softReplace) {
  const parent = iframe.parentNode;
  iframe.style.display = 'none';
  if (softReplace) {
    showSoft(old);
    transferStyles(old, iframe, true);
    hideSoft(old);
  } else {
    parent.insertBefore(old, iframe);
    transferId(iframe, old);
    transferStyles(old, iframe, false);
    parent.removeChild(old);
  }
}

function pauseOnPlay() {
  // eslint-disable-next-line no-invalid-this
  this.pause();
}

function pauseAllWithin(element) {
  const videos = querySelectorAllIncludingShadows('video', element);
  videos.forEach((video) => {
    try {
      video.pause();
    } catch (e) {
      console.error(e);
    }

    video.addEventListener('play', pauseOnPlay);
  });

  // Add mutation observer to pause videos added later
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        const addedNodes = Array.from(mutation.addedNodes);
        addedNodes.forEach((node) => {
          if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
            node.pause();
            node.addEventListener('play', pauseOnPlay);
          }
        });
      }
    });
  });
  observer.observe(element, {childList: true, subtree: true});

  return {
    observer,
  };
}

function removePauseListeners(element, watcher) {
  const videos = querySelectorAllIncludingShadows('video', element);
  videos.forEach((video) => {
    video.removeEventListener('play', pauseOnPlay);
  });

  watcher.observer.disconnect();
}

function transferStyles(old, iframe, softReplace) {
  const rect = old.getBoundingClientRect();
  const styles = window.getComputedStyle(old);

  iframe.setAttribute('style', old.getAttribute('style'));
  iframe.classList = old.classList;

  const width = Math.max(rect.width, 100) + 'px';
  const height = Math.max(rect.height, 100) + 'px';

  iframe.style.setProperty('width', width, 'important');
  iframe.style.setProperty('height', height, 'important');
  iframe.style.setProperty('padding', '0px', 'important');
  iframe.style.setProperty('opacity', '1', 'important');
  iframe.style.setProperty('visibility', 'visible', 'important');
  if (styles.display === 'none' || softReplace) {
    iframe.style.setProperty('display', 'block', 'important');
  }

  if (styles.position !== 'static') {
    iframe.style.position = styles.position;
  } else {
    iframe.style.position = 'relative';
  }

  if (!softReplace) {
    transferId(old, iframe);
  } else {
    iframe.id = 'player';
  }

  iframe.style.zIndex = styles.zIndex;
  iframe.style.border = styles.border;
  iframe.style.borderRadius = styles.borderRadius;
  iframe.style.boxShadow = styles.boxShadow;
}

function transferId(from, to) {
  const fromId = from.id;
  if (fromId) {
    from.id = '';
    to.id = fromId;
  }
}

function httpRequest(...args) {
  const url = args[0];
  let post = undefined;
  let callback;
  let bust = false;

  if (args[2]) { // post
    post = args[1];
    callback = args[2];
    bust = args[3];
  } else {
    callback = args[1];
    bust = args[2];
  }
  try {
    const xhr = new XMLHttpRequest();
    xhr.open(post ? 'POST' : 'GET', url + (bust ? ('?' + Date.now()) : ''));
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          callback(undefined, xhr, xhr.responseText);
        } else {
          callback(true, xhr, false);
        }
      }
    };
    if (post) {
      xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');

      const toPost = [];
      for (const i in post) {
        if (Object.hasOwn(post, i)) {
          toPost.push(encodeURIComponent(i) + '=' + encodeURIComponent(post[i]));
        }
      }

      post = toPost.join('&');
    }

    xhr.send(post);
  } catch (e) {
    callback(e);
  }
}

function querySelectorAllIncludingShadows(query, currentElement = document.body, results = []) {
  if (!currentElement) {
    return results;
  }

  Array.from(currentElement.querySelectorAll(query)).forEach((el) => results.push(el));

  const allElements = currentElement.querySelectorAll('*');
  Array.from(allElements).forEach((el) => {
    if (el.shadowRoot) {
      querySelectorAllIncludingShadows(query, el.shadowRoot, results);
    }
  });

  return results;
}

function isVisible(domElement) {
  return new Promise((resolve) => {
    const o = new IntersectionObserver(([entry]) => {
      resolve(entry.intersectionRatio);
      o.disconnect();
    });
    o.observe(domElement);
  });
}

function getNextParentElement(element) {
  if (element.parentElement) {
    return element.parentElement;
  }
  if (element.parentNode?.host) {
    return element.parentNode.host;
  }
  return null;
}

function testSimilarity(originalElement, childElement, parentElement) {
  const parentRect = parentElement.getBoundingClientRect();
  if (parentRect.width === 0 || parentRect.height === 0) {
    return true;
  }

  const originalRect = originalElement.getBoundingClientRect();
  const tolerance = Math.max(Math.min(originalRect.width, originalRect.height, 5000), 100) * 0.1;
  if (
    Math.abs(originalRect.x - parentRect.x) < tolerance &&
    Math.abs(originalRect.y - parentRect.y) < tolerance &&
    Math.abs(originalRect.width - parentRect.width) < tolerance &&
    Math.abs(originalRect.height - parentRect.height) < tolerance
  ) {
    return true;
  }

  // Check if parent element is overflow hidden and child element can cover the parent element
  const parentStyle = window.getComputedStyle(parentElement);
  const childRect = childElement.getBoundingClientRect();
  if (parentStyle.overflow === 'hidden') {
    if (childRect.x <= parentRect.x &&
      childRect.y <= parentRect.y &&
      childRect.x + childRect.width >= parentRect.x + parentRect.width &&
      childRect.y + childRect.height >= parentRect.y + parentRect.height) {
      return true;
    }
  }

  return false;
}

function getParentElementsWithSameBounds(element) {
  const elements = [];
  const originalElement = element;

  while (getNextParentElement(element)) {
    const parent = getNextParentElement(element);
    if (testSimilarity(originalElement, element, parent)) {
      elements.push(parent);
    } else {
      break;
    }

    element = parent;

    if (element.tagName === 'BODY') {
      break;
    }
  }

  return elements;
}

async function getVideo() {
  if (is_url_yt(window.location.href)) {
    const ytplayer = FoundYTPlayer;
    if (ytplayer) {
      return {
        size: ytplayer.clientWidth * ytplayer.clientHeight,
        highest: ytplayer,
      };
    }
    return null;
  }

  const videos = Array.from(querySelectorAllIncludingShadows('video'));

  let visibleVideos = await Promise.all(videos.map(async (video) => {
    const visibleRatio = await isVisible(video);
    const rect = video.getBoundingClientRect();
    return {
      video: video,
      visibleArea: rect.width * rect.height * visibleRatio,
    };
  }));

  visibleVideos = visibleVideos.filter((v) => v.visibleArea > 0);

  const largestVideo = visibleVideos.reduce((prev, current) => {
    return (prev && prev.visibleArea > current.visibleArea) ? prev : current;
  }, null);

  if (!largestVideo) {
    return null;
  }

  const parentElementsWithSameBounds = getParentElementsWithSameBounds(largestVideo.video);
  return {
    video: largestVideo.video,
    size: largestVideo.visibleArea,
    parents: parentElementsWithSameBounds,
    highest: parentElementsWithSameBounds.length > 0 ? parentElementsWithSameBounds[parentElementsWithSameBounds.length - 1] : largestVideo.video,
  };
}

// eslint-disable-next-line camelcase
function is_url_yt(urlStr) {
  const url = new URL(urlStr);
  const hostname = url.hostname;
  if (hostname === 'www.youtube.com' || hostname === 'youtube.com' || hostname === 'm.youtube.com' || hostname === 'music.youtube.com') {
    return true;
  }
  return false;
}

// eslint-disable-next-line camelcase
function url_to_absolute(urlStr) {
  const url = new URL(urlStr, document.baseURI);
  return url.href;
}

function isLinkToDifferentPageOnWebsite(url) {
  try {
    url = new URL(url, window.location.href);
  } catch (e) {
    return false;
  }

  if (url.origin !== window.location.origin) {
    return false;
  }

  if (url.pathname !== window.location.pathname) {
    return true;
  }

  if (url.search !== window.location.search) {
    return true;
  }

  return false;
}


function isSimilar(element, child) {
  const style = window.getComputedStyle(element);
  const width = parseInt(style.width) || 0;
  const height = parseInt(style.height) || 0;

  const cstyle = window.getComputedStyle(child);
  const cwidth = parseInt(cstyle.width) || 0;
  const cheight = parseInt(cstyle.height) || 0;
  if (child.tagName == element.tagName && (cwidth == width || cheight == height) && cstyle.display == style.display && cstyle.position == style.position) {
    return true;
  }
  return false;
}


function getSimilar(element) {
  if (!element) return [];
  const parent = element.parentElement;
  if (!parent) return [];
  const children = parent.children;
  if (element.tagName === 'BODY' || !children) return [];


  const found = [];
  const potential = [];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (isSimilar(element, child)) {
      let count = 0;

      if ((element.children && child.children)) {
        const threshold = Math.ceil(Math.max(element.children.length, child.children.length) * 0.6);

        for (let k = 0; k < element.children.length; k++) {
          const el2 = element.children[k];
          for (let j = 0; j < child.children.length; j++) {
            const ch2 = child.children[j];
            if (isSimilar(el2, ch2)) {
              count++;
              break;
            }
          }
          if (count >= threshold) {
            break;
          }
        }
        if (count >= threshold) {
          found.push(child);
        } else {
          potential.push(child);
        }
      } else if (!element.children && !child.children) {
        found.push(child);
      }
    }
  }

  if (found.length > 1) {
    potential.forEach((item) => {
      found.push(item);
    });
    return found;
  } else {
    return getSimilar(parent);
  }
}

function getNextOrPreviousButton(isNext = false) {
  if (is_url_yt(window.location.href)) {
    return getNextOrPreviousButtonYT(isNext);
  }

  const aElements = querySelectorAllIncludingShadows('a');
  const currentURL = window.location.href;
  let matchedElements = aElements.filter((a) => {
    if (!a.href) {
      return false;
    }
    try {
      const url = url_to_absolute(a.href);
      return url === currentURL;
    } catch (e) {
      return false;
    }
  });

  if (matchedElements.length === 0) {
    matchedElements = aElements.filter((a) => {
      const textContent = a.textContent.trim();
      // Check if it containes Episode # or similar
      if (textContent.match(/episode\s*\d+/i)) {
        return true;
      }
    });
  }

  if (matchedElements.length === 0) {
    return null;
  }

  for (let i = 0; i < matchedElements.length; i++) {
    const element = matchedElements[i];
    const similar = getSimilar(element);
    if (similar.length > 0) {
      // Find index of element with match
      const index = similar.findIndex((el) => {
        if (el === element) {
          return true;
        }

        if (el.contains(element)) {
          return true;
        }

        return false;
      });

      if (index === -1) {
        continue;
      }

      // Find next element
      const nextIndex = isNext ? index + 1 : index - 1;

      if (nextIndex < 0 || nextIndex >= similar.length) {
        continue;
      }

      // Check if a element
      if (similar[nextIndex].tagName === 'A') {
        return similar[nextIndex];
      }

      return similar[nextIndex].querySelector('a');
    }
  }
  return null;
}


// eslint-disable-next-line camelcase
function get_yt_identifier(urlStr) {
  try {
    const url = new URL(urlStr);
    let identifier = url.searchParams.get('v');
    if (!identifier) {
      identifier = url.pathname.split('/').pop();
    }
    return identifier;
  } catch (e) {
    return '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.runtime.sendMessage({
    type: MessageTypes.FRAME_LOADED,
  });
});


document.addEventListener('click', (e) => {
  let current = e.target;
  while (current) {
    if (current.tagName === 'A') {
      break;
    }
    current = current.parentElement;
  }

  if (!current || !current.href) {
    return;
  }

  // check if href leads to different page and origin
  const url = current.href;
  if (is_url_yt(window.location.href)) {
    try {
      const parsed = new URL(url);
      const searchParams = parsed.searchParams;
      // check if it has v
      if (searchParams.has('v')) {
      // check if it matches current video
        const videoID = searchParams.get('v');
        const currentID = get_yt_identifier(window.location.href);
        if (videoID !== currentID) {
          return;
        }
      }
      if (searchParams.has('t')) {
        const time = searchParams.get('t');
        if (time.match(/^[0-9]+s$/)) {
          chrome.runtime.sendMessage({
            type: 'seek_to',
            time: parseInt(time),
          });
          if (OverridenYTKeys) {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
        }
      }
    } catch (e) {
      console.error(e);
      return;
    }
  } else if (isLinkToDifferentPageOnWebsite(url)) {
    removePlayers();
  }
}, true);


document.addEventListener('fullscreenchange', () => {
  const changedFor = [];
  iframeMap.forEach((iframeObj) => {
    const fullscreenState = iframeObj.fullscreenState;
    const element = iframeObj.iframe;
    const active = document.fullscreenElement === element;
    if (active !== fullscreenState.active) {
      fullscreenState.active = active;
      changedFor.push(iframeObj);
    }
  });

  changedFor.forEach((iframeObj) => {
    chrome.runtime.sendMessage({
      type: MessageTypes.SEND_TO_PLAYER,
      frameId: iframeObj.fullscreenState.playerFrameId,
      data: {
        type: 'fullscreen-state',
        value: iframeObj.fullscreenState.active,
      },
    });
  });
});

window.addEventListener('resize', () => {
  updateReplacedPlayers();
  resizeMiniPlayers();
});

window.addEventListener('beforeunload', () => {
  chrome.runtime.sendMessage({
    type: MessageTypes.FRAME_REMOVED,
  });
});


chrome.runtime.sendMessage({
  type: MessageTypes.FRAME_ADDED,
  url: window.location.href,
});

// eslint-disable-next-line camelcase
function is_url_yt_watch(urlStr) {
  const url = new URL(urlStr);
  const pathname = url.pathname;
  return pathname.startsWith('/watch');
}

// eslint-disable-next-line camelcase
function is_url_yt_embed(urlStr) {
  const url = new URL(urlStr);
  const pathname = url.pathname;
  return pathname.startsWith('/embed');
}

// eslint-disable-next-line camelcase
function get_yt_video_elements() {
  const queries = [
    'body #player',
    'body #player-full-bleed-container',
  ];

  const classBlacklist = [
    'skeleton',
  ];

  const elements = [];
  for (let i = 0; i < queries.length; i++) {
    const ytplayer = document.querySelectorAll(queries[i]);
    for (let j = 0; j < ytplayer.length; j++) {
      if (classBlacklist.some((c) => ytplayer[j].classList.contains(c))) {
        continue;
      }
      elements.push(ytplayer[j]);
    }
  }
  return elements;
}

function getKeyString(e) {
  const metaPressed = e.metaKey && e.key !== 'Meta';
  const ctrlPressed = e.ctrlKey && e.key !== 'Control';
  const altPressed = e.altKey && e.key !== 'Alt';
  const shiftPressed = e.shiftKey && e.key !== 'Shift';
  const key = e.key === ' ' ? 'Space' : e.code;

  return (metaPressed ? 'Meta+' : '') + (ctrlPressed ? 'Control+' : '') + (altPressed ? 'Alt+' : '') + (shiftPressed ? 'Shift+' : '') + key;
}

function isActiveElementEditable() {
  const activeElement = document.activeElement;
  if (!activeElement) {
    return false;
  }
  if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable) {
    return true;
  }
  return false;
}

// eslint-disable-next-line camelcase
function is_live() {
  // meta isLiveBroadcast
  const meta = document.querySelector('meta[itemprop="isLiveBroadcast"]');
  if (!meta) {
    return false;
  }

  if (meta.content !== 'True') {
    return false;
  }

  const parent = meta.parentElement;
  // Check if has endDate meta
  const endDate = parent.querySelector('meta[itemprop="endDate"]');
  if (endDate) {
    return false;
  }

  return true;
}


async function scrapeSponsorBlock() {
  const progressBar = document.querySelector('.ytp-progress-bar');
  if (!progressBar) {
    throw new Error('Could not find progress bar');
  }


  const result = getSponsorSegments(progressBar);
  if (result.length > 0) {
    return result;
  }
  return new Promise((resolve, reject) => {
    let debounceTimeout = null;
    let timeoutTimeout = null;
    const observer = new MutationObserver((mutations) => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      debounceTimeout = setTimeout(() => {
        const segments = getSponsorSegments(progressBar);
        if (segments.length > 0) {
          clearTimeout(timeoutTimeout);
          observer.disconnect();
          resolve(segments);
        }
      }, 100);

      timeoutTimeout = setTimeout(() => {
        observer.disconnect();
        reject(new Error('Timed out'));
      }, 5000);
    });
    observer.observe(progressBar, {attributes: false, childList: true, characterData: false, subtree: true});
  });
}

function getSponsorSegments(progressBar) {
  const max = parseFloat(progressBar.getAttribute('aria-valuemax'));
  const min = parseFloat(progressBar.getAttribute('aria-valuemin'));
  const duration = max - min;

  if (isNaN(duration) || duration <= 0) {
    return [];
  }


  const sponsorBlockSegments = document.querySelectorAll('#previewbar .previewbar');
  const segments = [];

  for (const segment of sponsorBlockSegments) {
    const category = segment.getAttribute('sponsorblock-category') || 'unknown';
    if (category === 'chapter') {
      continue;
    }
    const start = parseFloat(segment.style.left) / 100 * duration;
    if (isNaN(start)) {
      continue;
    }

    const end = parseFloat(segment.style.right) / 100 * duration;
    let segDuration = 1;
    if (segment.style.right !== '') {
      segDuration = (duration - end) - start;
    }

    const startTime = start;
    const endTime = start + segDuration;
    const color = window.getComputedStyle(segment).backgroundColor;

    segments.push({
      segment: [startTime, endTime],
      category: category,
      autoSkip: false,
      color,
    });
  }

  return segments;
}

function handleSponsorBlockScrape(request, sender, sendResponse) {
  if (!FoundYTPlayer) {
    console.error('no player found');
    sendResponse({
      error: 'no_player',
    });
    return;
  }

  const playerID = get_yt_identifier(window.location.href);
  if (playerID !== request.videoId) {
    console.error('ID mismatch', playerID, request.videoId);
    sendResponse({
      error: 'id_mismatch',
    });
    return;
  }

  try {
    scrapeSponsorBlock().then((segments) => {
      sendResponse({segments});
    }).catch((e) => {
      console.error(e);
      sendResponse({error: e.message});
    });
    return true;
  } catch (e) {
    console.error(e);
    sendResponse({error: e.message});
  }
}

function getNextOrPreviousButtonYT(isNext = false) {
  if (!FoundYTPlayer) {
    return null;
  }
  const btnclass = isNext ? 'ytp-next-button' : 'ytp-prev-button';

  const button = FoundYTPlayer.querySelector(`.${btnclass}`);

  if (!button) {
    return null;
  }

  if (button.style.display === 'none') {
    return null;
  }

  return button;
}

if (is_url_yt(window.location.href)) {
  const observer = new MutationObserver((mutations) => {
    const isWatch = is_url_yt_watch(window.location.href);
    const isEmbed = is_url_yt_embed(window.location.href);
    if (isWatch || isEmbed) {
      const playerNodes = get_yt_video_elements();
      if (playerNodes.length === 0) {
        return;
      }

      playerNodes.find((playerNode) => {
        const rect = playerNode.getBoundingClientRect();
        if ((isEmbed || rect.x !== 0 || playerNode.id !== 'player') && rect.width * rect.height > 0 && !FoundYTPlayer) {
          FoundYTPlayer = playerNode;
          if (!is_live()) {
            document.querySelector('.ytp-progress-bar')?.classList.add('vjs-progress-holder');
            chrome.runtime.sendMessage({
              type: MessageTypes.YT_LOADED,
              url: window.location.href,
            });
          }
          return true;
        }
        return false;
      });
    }
  });
  observer.observe(document, {attributes: false, childList: true, characterData: false, subtree: true});

  const OverrideList = [
    'Space', 'KeyP', // play/pause
    'ArrowLeft', 'ArrowRight', // seek
    'KeyF', // fullscreen
    'KeyM', // mute
    'KeyJ', 'KeyL', // seek
    'KeyT', // theater mode
    'Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', // seek
    'KeyC', // captions
  ];

  const TransmitBlacklist = [
    'ArrowUp', 'ArrowDown', // Scroll
  ];

  document.addEventListener('keydown', (e) => {
    if (isActiveElementEditable()) {
      return;
    }

    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) {
      return;
    }

    if (TransmitBlacklist.includes(e.code)) {
      return;
    }

    chrome.runtime.sendMessage({
      type: '',
      key: getKeyString(e),
    });

    if (OverridenYTKeys && OverrideList.includes(e.code)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('keyup', (e) => {
    if (isActiveElementEditable()) {
      return;
    }

    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) {
      return;
    }

    if (OverridenYTKeys && OverrideList.includes(e.code)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('keypress', (e) => {
    if (isActiveElementEditable()) {
      return;
    }

    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) {
      return;
    }

    if (OverridenYTKeys && OverrideList.includes(e.code)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
}
