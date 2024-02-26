let FoundYTPlayer = null;
let OverridenYTKeys = false;
const iframeMap = new Map();
const players = [];
window.addEventListener('message', (e) => {
  if (typeof e.data !== 'object') {
    return;
  }
  const dt = e.data;
  const src = e.source;

  switch (dt.type) {
    case 'frame':
      const iframes = querySelectorAllIncludingShadows('iframe');
      for (let i = 0; i < iframes.length; i++) {
        if (iframes[i].contentWindow === src) {
          iframeMap.set(dt.id, {
            id: dt.id,
            iframe: iframes[i],
            isMini: false,
            isFullscreen: false,
            placeholder: null,
            oldStyle: '',
          });
          break;
        }
      }
      break;
  }
});

chrome.runtime.onMessage.addListener(
    (request, sender, sendResponse) => {
      if (request.type === 'ping') {
        sendResponse('pong');
      } else if (request.type === 'miniplayer') {
        const iframeObj = iframeMap.get(request.frameId);
        if (!iframeObj) {
          sendResponse('no_element');
          throw new Error('No element found for frame id ' + request.frameId);
        }

        iframeObj.miniSize = request.size;
        iframeObj.miniStyles = request.styles;

        if (document.fullscreenElement || (request.force !== undefined && request.force === iframeObj.isMini)) {
          updateMiniPlayer(iframeObj);
        } else {
          toggleMiniPlayer(iframeObj, request.size);
          if (iframeObj.isMini && request.autoExit) {
            // if placeholder is visible again
            const observer = new IntersectionObserver(([entry]) => {
              if (entry.intersectionRatio > 0.25) {
                unmakeMiniPlayer(iframeObj);
                observer.disconnect();

                chrome.runtime.sendMessage({
                  type: 'miniplayer_change_init',
                  miniplayer: false,
                  frameId: iframeObj.id,
                });
                updatePlayerStyles();
              }
            }, {
              threshold: [0, 0.25, 0.5],
            });
            observer.observe(iframeObj.placeholder);
          }
        }

        if (iframeObj.isMini) {
          sendResponse('enter');
        } else {
          sendResponse('exit');
        }

        chrome.runtime.sendMessage({
          type: 'miniplayer_change_init',
          miniplayer: iframeObj.isMini,
          frameId: iframeObj.id,
        });
        return;
      } else if (request.type === 'fullscreen') {
        const iframeObj = iframeMap.get(request.frameId);
        if (!iframeObj) {
          sendResponse('no_element');
          throw new Error('No element found for frame id ' + request.frameId);
        }

        const element = iframeObj.iframe;

        if (document.fullscreenElement === element) {
          document.exitFullscreen();
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
      } else if (request.type === 'scrape_sponsorblock') {
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
        return;
      } else if (request.type === 'scrape_captions') {
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
      } else if (request.type === 'player') {
        const isYt = is_url_yt(window.location.href);
        getVideo().then((video) => {
          if (!video && !request.force) {
            console.log('no video found');
            sendResponse('no_video');
            return;
          }

          const playerFillsScreen = video?.highest?.tagName === 'BODY';
          if (!video || (playerFillsScreen && !request.noRedirect)) {
            window.location = request.url;
            console.log('redirecting to player');
            sendResponse('redirect');
          } else {
          // copy styles
            const iframe = document.createElement('iframe');
            iframe.src = request.url;
            updateIframeStyle(video.highest, iframe, isYt, playerFillsScreen);

            iframe.allowFullscreen = true;
            iframe.allow = 'autoplay; fullscreen; picture-in-picture';

            // replace element
            pauseAllWithin(video.highest);

            if (isYt) {
              video.highest.parentNode.insertBefore(iframe, video.highest);
              hideYT(video.highest);
            } else {
              video.highest.parentNode.replaceChild(iframe, video.highest);
            }

            players.push({
              iframe,
              old: video.highest,
              isYt,
              fillScreen: playerFillsScreen,
            });
            console.log('replacing video with iframe');
            sendResponse('replace');
          }


          if (isYt) {
            for (let i = 1; i <= 4; i++) {
              setTimeout(() => {
                updatePlayerStyles();
              }, i * 100);
            }
          }
        });
        OverridenYTKeys = true;
        return true;
      } else if (request.type === 'remove_players') {
        removePlayers();
        sendResponse('ok');
      } else if (request.type === 'get_video_size') {
        getVideo().then((video) => {
          sendResponse(video ? video.size : 0);
        });
        return true;
      }
    });

function removePlayers() {
  iframeMap.forEach((iframeObj) => {
    unmakeMiniPlayer(iframeObj);
  });

  players.forEach((player) => {
    if (player.isYt) {
      showYT(player.old);
      player.iframe.parentNode.removeChild(player.iframe);
    } else {
      player.iframe.parentNode.replaceChild(player.old, player.iframe);
    }

    removePauseListeners(player.old);
  });

  players.length = 0;
  FoundYTPlayer = null;
  OverridenYTKeys = false;
}

function updateMiniPlayer(iframeObj) {
  if (iframeObj.isMini) {
    const element = iframeObj.placeholder;
    const aspectRatio = element.clientWidth / element.clientHeight;
    const newWidth = Math.min(Math.max(window.screen.width, window.screen.height * aspectRatio) * iframeObj.miniSize, document.body.clientWidth);
    const newHeight = newWidth / aspectRatio;
    iframeObj.iframe.style.setProperty('width', newWidth + 'px', 'important');
    iframeObj.iframe.style.setProperty('height', newHeight + 'px', 'important');

    for (const key in iframeObj.miniStyles) {
      if (Object.hasOwn(iframeObj.miniStyles, key)) {
        iframeObj.iframe.style.setProperty(key, iframeObj.miniStyles[key], 'important');
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
  if (iframeObj.isMini) {
    return;
  }

  iframeObj.isMini = true;

  const element = iframeObj.iframe;
  const placeholder = document.createElement(element.tagName);

  transferId(element, placeholder);

  iframeObj.placeholder = placeholder;
  iframeObj.oldStyle = element.getAttribute('style') || '';
  placeholder.setAttribute('style', iframeObj.oldStyle);
  placeholder.style.setProperty('background-color', 'black', 'important');
  placeholder.classList = element.classList;

  element.parentNode.insertBefore(placeholder, element);

  players.forEach((player) => {
    if (player.iframe === element) {
      player.iframe = placeholder;
      player.isPlaceholder = true;
    }
  });

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
  if (!iframeObj.isMini) {
    return;
  }

  const element = iframeObj.iframe;
  iframeObj.isMini = false;
  element.setAttribute('style', iframeObj.oldStyle);
  players.forEach((player) => {
    if (player.iframe === iframeObj.placeholder) {
      player.iframe = element;
      player.isPlaceholder = false;
    }
  });

  transferId(iframeObj.placeholder, element);

  iframeObj.placeholder.remove();
  iframeObj.placeholder = null;
}

function toggleMiniPlayer(iframeObj) {
  if (iframeObj.isMini) {
    unmakeMiniPlayer(iframeObj);
    return false;
  } else {
    makeMiniPlayer(iframeObj);
    return true;
  }
}

document.addEventListener('fullscreenchange', () => {
  chrome.runtime.sendMessage({
    type: 'fullscreen_change_init',
    fullscreen: document.fullscreenElement ? true : false,
  });
});

window.addEventListener('resize', () => {
  updatePlayerStyles();
  resizeMiniPlayers();
});

function hideYT(player) {
  player.style.setProperty('display', 'none', 'important');
  document.querySelector('.ytp-progress-bar')?.classList.add('vjs-progress-holder');
}

function showYT(player) {
  player.style.display = '';
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

function updatePlayerStyles() {
  players.forEach((player) => {
    if (player.fillScreen) return;

    updatePlayerStyle(player.old, player.iframe, player.isYt);
    if (player.isPlaceholder) {
      player.iframe.style.setProperty('background-color', 'black', 'important');
    }
  });
}

function updatePlayerStyle(old, iframe, isYt) {
  const parent = iframe.parentNode;
  iframe.style.display = 'none';
  if (isYt) {
    showYT(old);
    updateIframeStyle(old, iframe, isYt);
    hideYT(old);
  } else {
    parent.insertBefore(old, iframe);
    transferId(iframe, old);
    updateIframeStyle(old, iframe, isYt);
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
}

function removePauseListeners(element) {
  const videos = querySelectorAllIncludingShadows('video', element);
  videos.forEach((video) => {
    video.removeEventListener('play', pauseOnPlay);
  });
}

function updateIframeStyle(old, iframe, isYt, fillScreen) {
  if (fillScreen) {
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
    `);
    return;
  }

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
  if (styles.display === 'none') {
    iframe.style.setProperty('display', 'block', 'important');
  }

  iframe.style.position = styles.position;
  if (!isYt) {
    transferId(old, iframe);
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

async function getVideo() {
  if (is_url_yt(window.location.href)) {
    const ytplayer = FoundYTPlayer;

    if (ytplayer) {
      return {
        size: ytplayer.clientWidth * ytplayer.clientHeight,
        highest: ytplayer,
      };
    }
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

chrome.runtime.sendMessage({
  type: 'iframe',
  url: window.location.href,
});

document.addEventListener('DOMContentLoaded', () => {
  chrome.runtime.sendMessage({
    type: 'loaded',
  });
});

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

  return false;
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
          chrome.runtime.sendMessage({
            type: 'yt_loaded',
            url: window.location.href,
          });
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

  document.addEventListener('keydown', (e) => {
    if (isActiveElementEditable()) {
      return;
    }

    chrome.runtime.sendMessage({
      type: 'transmit_key',
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

    if (OverridenYTKeys && OverrideList.includes(e.code)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('keypress', (e) => {
    if (isActiveElementEditable()) {
      return;
    }

    if (OverridenYTKeys && OverrideList.includes(e.code)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
}
document.addEventListener('click', (e) => {
  if (!e.isTrusted) {
    return;
  }

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
  } else {
    if (isLinkToDifferentPageOnWebsite(url)) {
      removePlayers();
    }
  }
}, true);


