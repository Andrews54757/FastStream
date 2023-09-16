

const iframeMap = new Map();
window.addEventListener('message', (e) => {
  if (typeof e.data !== 'object') {
    return;
  }
  const dt = e.data;
  const src = e.source;

  switch (dt.type) {
    case 'frame':
      console.log('Frame info', dt);
      const iframes = querySelectorAllIncludingShadows('iframe');
      for (let i = 0; i < iframes.length; i++) {
        if (iframes[i].contentWindow == src) {
          iframeMap.set(dt.id, iframes[i]);
          break;
        }
      }
      break;
  }

  // console.log(e, frameId)
});

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      if (request.type === 'fullscreen') {
        const element = iframeMap.get(request.frameId);
        if (!element) {
          throw new Error('No element found for frame id ' + request.frameId);
        }
        if (document.fullscreenElement === element) {
          document.exitFullscreen();
        } else {
          element.requestFullscreen();
        }
      } else if (request.type == 'init') {
        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'frame',
            id: request.frameId,
          }, '*');
        }
      } else if (request.type == 'scrape_captions') {
        const trackElements = querySelectorAllIncludingShadows('track');
        let done = 0;
        const tracks = [];
        for (let i = 0; i < trackElements.length; i++) {
          const track = trackElements[i];
          if (track.src && track.kind == 'captions') {
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
              if (done == tracks.length) sendResponse(tracks);
            });
          }
        }
        if (done == tracks.length) sendResponse(tracks);

        return true;
      } else if (request.type == 'player') {
        getVideo().then((video) => {
          if (!video || video.highest && video.highest.tagName === 'BODY') {
            window.location = request.url;
            console.log('redirecting to player');
            sendResponse('redirect');
          } else {
            // copy styles
            const styles = window.getComputedStyle(video.highest);
            const rect = video.highest.getBoundingClientRect();

            const iframe = document.createElement('iframe');
            iframe.src = request.url;
            iframe.setAttribute('style', video.highest.getAttribute('style'));
            iframe.classList = video.highest.classList;
            iframe.style.width = (rect.width || 100) + 'px';
            iframe.style.height = (rect.height || 100) + 'px';

            iframe.style.position = styles.position;
            iframe.id = video.highest.id;
            // iframe.style.top = styles.top;
            // iframe.style.left = styles.left;
            iframe.style.zIndex = styles.zIndex;
            iframe.style.border = styles.border;
            iframe.style.borderRadius = styles.borderRadius;
            iframe.style.boxShadow = styles.boxShadow;
            // iframe.style.margin = styles.margin;
            // iframe.style.padding = styles.padding;

            iframe.allowFullscreen = true;
            // replace element

            video.highest.parentElement.replaceChild(iframe, video.highest);

            console.log('replacing video with iframe');
            sendResponse('replace');
          }
        });
        return true;
      } else if (request.type === 'get_video_size') {
        getVideo().then((video) => {
          sendResponse(video ? video.size : 0);
        });
        return true;
      }
    });

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
      if (xhr.readyState == 4) {
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

function querySelectorAllIncludingShadows(tagName, currentElement = document.body, results = []) {
  Array.from(currentElement.querySelectorAll(tagName)).forEach((el) => results.push(el));

  const allElements = currentElement.querySelectorAll('*');
  Array.from(allElements).forEach((el) => {
    if (el.shadowRoot) {
      querySelectorAllIncludingShadows(tagName, el.shadowRoot, results);
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
  // SPLICER:REMOVE_START
  if (is_url_yt(window.location.href)) {
    const ytplayer = querySelectorAllIncludingShadows('#ytd-player.ytd-watch-flexy > #container > div');
    if (ytplayer.length) {
      const element = ytplayer[0];
      return {
        size: element.clientWidth * element.clientHeight,
        highest: element,
      };
    }
  }
  // SPLICER:REMOVE_END

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

// SPLICER:REMOVE_START
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

let lastPlayerNode = null;
if (is_url_yt(window.location.href)) {
  const observer = new MutationObserver((mutations)=> {
    const pnode = document.querySelectorAll('#ytd-player.ytd-watch-flexy > #container > div')[0];
    if (pnode && is_url_yt_watch(window.location.href)) {
      const rect = pnode.getBoundingClientRect();
      if (rect.width * rect.height > 0 && lastPlayerNode !== pnode) {
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
// SPLICER:REMOVE_END

