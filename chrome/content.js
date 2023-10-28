let lastPlayerNode = null;
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
      } else if (request.type === 'init') {
        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'frame',
            id: request.frameId,
          }, '*');
        }
        sendResponse('ok');
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

            setTimeout(() => {
              pauseAllWithin(video.highest);
            }, 5000);

            video.highest.parentElement.replaceChild(iframe, video.highest);
            players.push({
              iframe,
              old: video.highest,
            });
            console.log('replacing video with iframe');
            sendResponse('replace');
          }
        });
        return true;
      } else if (request.type === 'remove_players') {
        players.forEach((player) => {
          player.iframe.parentElement.replaceChild(player.old, player.iframe);
        });
        players.length = 0;
        lastPlayerNode = null;
        sendResponse('ok');
      } else if (request.type === 'get_video_size') {
        getVideo().then((video) => {
          sendResponse(video ? video.size : 0);
        });
        return true;
      }
    });

document.addEventListener('fullscreenchange', ()=>{
  chrome.runtime.sendMessage({
    type: 'fullscreen_change',
    fullscreen: document.fullscreenElement ? true : false,
  });
});

window.addEventListener('resize', ()=>{
  updatePlayerStyles();
});

function updatePlayerStyles() {
  players.forEach((player) => {
    const parent = player.iframe.parentElement;
    player.iframe.style.display = 'none';
    parent.insertBefore(player.old, player.iframe);
    updateIframeStyle(player.old, player.iframe);
    parent.removeChild(player.old);
  });
}

function pauseAllWithin(element) {
  const videos = querySelectorAllIncludingShadows('video', element);
  videos.forEach((video) => {
    try {
      video.pause();
    } catch (e) {
      console.error(e);
    }
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


  iframe.style.position = styles.position;
  iframe.id = old.id;
  iframe.style.zIndex = styles.zIndex;
  iframe.style.border = styles.border;
  iframe.style.borderRadius = styles.borderRadius;
  iframe.style.boxShadow = styles.boxShadow;
}

function httpRequest( ...args ) {
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
    let ytplayer = document.querySelectorAll('#ytd-player.ytd-watch-flexy > #container > div')[0];
    if (!ytplayer) {
      ytplayer = document.querySelectorAll('body > #player')[0];
    }
    if (ytplayer) {
      const visibleRatio = await isVisible(ytplayer);
      const rect = ytplayer.getBoundingClientRect();
      if (rect.width * rect.height * visibleRatio < 1000) {
        return null;
      }

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

if (is_url_yt(window.location.href)) {
  const observer = new MutationObserver((mutations)=> {
    let pnode = document.querySelectorAll('#ytd-player.ytd-watch-flexy > #container > div')[0];
    if (!pnode) {
      pnode = document.querySelectorAll('body > #player')[0];
    }
    const isWatch = is_url_yt_watch(window.location.href);
    const isEmbed = is_url_yt_embed(window.location.href);
    if (pnode && (isWatch || isEmbed)) {
      const rect = pnode.getBoundingClientRect();
      if ((isEmbed || rect.x !== 0) && rect.width * rect.height > 0 && lastPlayerNode !== pnode) {
        lastPlayerNode = pnode;
        chrome.runtime.sendMessage({
          type: 'yt_loaded',
          url: window.location.href,
        });
      }
    }
  });
  observer.observe(document, {attributes: false, childList: true, characterData: false, subtree: true});
}
