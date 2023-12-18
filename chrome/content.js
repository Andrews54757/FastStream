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
          iframeMap.set(dt.id, iframes[i]);
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
      } else if (request.type === 'fullscreen') {
        const element = iframeMap.get(request.frameId);
        if (!element) {
          sendResponse('no_element');
          throw new Error('No element found for frame id ' + request.frameId);
        }

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

          if (!video || (video?.highest?.tagName === 'BODY' && !request.noRedirect)) {
            window.location = request.url;
            console.log('redirecting to player');
            sendResponse('redirect');
          } else {
          // copy styles
            const iframe = document.createElement('iframe');
            iframe.src = request.url;
            updateIframeStyle(video.highest, iframe, isYt);

            iframe.allowFullscreen = true;
            iframe.allow = 'autoplay; fullscreen; picture-in-picture';

            // replace element
            pauseAllWithin(video.highest);

            if (isYt) {
              video.highest.parentElement.insertBefore(iframe, video.highest);
              hideYT(video.highest);
            } else {
              video.highest.parentElement.replaceChild(iframe, video.highest);
            }

            players.push({
              iframe,
              old: video.highest,
              isYt,
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
        players.forEach((player) => {
          if (player.isYt) {
            showYT(player.old);
            player.iframe.parentElement.removeChild(player.iframe);
          } else {
            player.iframe.parentElement.replaceChild(player.old, player.iframe);
          }

          removePauseListeners(player.old);
        });
        players.length = 0;
        FoundYTPlayer = null;
        OverridenYTKeys = false;
        sendResponse('ok');
      } else if (request.type === 'get_video_size') {
        getVideo().then((video) => {
          sendResponse(video ? video.size : 0);
        });
        return true;
      }
    });

document.addEventListener('fullscreenchange', () => {
  chrome.runtime.sendMessage({
    type: 'fullscreen_change',
    fullscreen: document.fullscreenElement ? true : false,
  });
});

window.addEventListener('resize', () => {
  updatePlayerStyles();
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
    const parent = player.iframe.parentElement;
    player.iframe.style.display = 'none';
    if (player.isYt) {
      showYT(player.old);
      updateIframeStyle(player.old, player.iframe, true);
      hideYT(player.old);
    } else {
      parent.insertBefore(player.old, player.iframe);
      updateIframeStyle(player.old, player.iframe);
      parent.removeChild(player.old);
    }
  });
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

function updateIframeStyle(old, iframe, isYt) {
  const styles = window.getComputedStyle(old);
  const rect = old.getBoundingClientRect();

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
    iframe.id = old.id;
  }
  iframe.style.zIndex = styles.zIndex;
  iframe.style.border = styles.border;
  iframe.style.borderRadius = styles.borderRadius;
  iframe.style.boxShadow = styles.boxShadow;
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

function parentHasSimilarBounds(element) {
  const parent = element.parentElement;
  const rect = element.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();
  const tolerance = 4;
  if ( // First check
    Math.abs(rect.x - parentRect.x) < tolerance &&
    Math.abs(rect.y - parentRect.y) < tolerance &&
    Math.abs(rect.width - parentRect.width) < tolerance &&
    Math.abs(rect.height - parentRect.height) < tolerance
  ) {
    return true;
  }

  // Check if parent element is overflow hidden and child element can cover the parent element
  const parentStyle = window.getComputedStyle(parent);
  if (parentStyle.overflow === 'hidden') {
    if (rect.x <= parentRect.x &&
      rect.y <= parentRect.y &&
      rect.x + rect.width >= parentRect.x + parentRect.width &&
      rect.y + rect.height >= parentRect.y + parentRect.height) {
      return true;
    }
  }

  return false;
}

function getParentElementsWithSameBounds(element) {
  const elements = [];

  while (element.parentElement) {
    const parent = element.parentElement;
    if (parentHasSimilarBounds(element)) {
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

