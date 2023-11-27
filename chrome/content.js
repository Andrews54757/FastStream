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

          if (!video || video?.highest?.tagName === 'BODY') {
            window.location = request.url;
            console.log('redirecting to player');
            sendResponse('redirect');
          } else {
          // copy styles
            const iframe = document.createElement('iframe');
            iframe.src = request.url;
            updateIframeStyle(video.highest, iframe);

            iframe.allowFullscreen = true;

            // replace element
            pauseAllWithin(video.highest);

            if (isYt) {
              video.highest.parentElement.insertBefore(iframe, video.highest);
              video.highest.style.setProperty('display', 'none', 'important');
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
        });
        OverridenYTKeys = true;
        return true;
      } else if (request.type === 'remove_players') {
        players.forEach((player) => {
          if (player.isYt) {
            player.old.style.display = '';
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

function updatePlayerStyles() {
  players.forEach((player) => {
    const parent = player.iframe.parentElement;
    player.iframe.style.display = 'none';
    if (player.isYt) {
      player.old.style.display = '';
      updateIframeStyle(player.old, player.iframe);
      player.old.style.setProperty('display', 'none', 'important');
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

function updateIframeStyle(old, iframe) {
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
  iframe.id = old.id;
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

function getParentElementsWithSameBounds(element) {
  const elements = [];
  while (element.parentElement) {
    const parent = element.parentElement;
    const rect = element.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    if (rect.top === parentRect.top && rect.left === parentRect.left && rect.right === parentRect.right && rect.bottom === parentRect.bottom) {
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
  const elements = [];
  for (let i = 0; i < queries.length; i++) {
    const ytplayer = document.querySelectorAll(queries[i]);
    for (let j = 0; j < ytplayer.length; j++) {
      elements.push(ytplayer[j]);
    }
  }
  return elements;
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
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft', 'ArrowRight', // seek
    'KeyF', // fullscreen
    'KeyM', // mute
    'KeyJ', 'KeyL', // seek
    'Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', // seek
    'KeyC', // captions
  ];

  document.addEventListener('keydown', (e) => {
    if (OverridenYTKeys && OverrideList.includes(e.code)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('keyup', (e) => {
    if (OverridenYTKeys && OverrideList.includes(e.code)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('keypress', (e) => {
    if (OverridenYTKeys && OverrideList.includes(e.code)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
}

