const MessageTypes = {
  WAIT_UNTIL_MAIN_LOADED: 'WAIT_UNTIL_MAIN_LOADED',
  MESSAGE_FROM_CONTENT: 'MESSAGE_FROM_CONTENT',
  SEND_TO_CONTENT: 'SEND_TO_CONTENT',
  SPONSORBLOCK_SCRAPE: 'SPONSORBLOCK_SCRAPE',
  PLAYLIST_NAVIGATION: 'PLAYLIST_NAVIGATION',
  PLAYLIST_POLL: 'PLAYLIST_POLL',
  YT_LOADED: 'YT_LOADED',
  EXTRACT_YT_DATA: 'EXTRACT_YT_DATA',
};

const mainLoadedPromise = new Promise((resolve)=>{
  chrome.runtime.sendMessage({
    type: MessageTypes.WAIT_UNTIL_MAIN_LOADED,
  }, (response) => {
    if (response !== 'loaded') {
      console.error('Didnt get loaded response');
    }
    resolve();
  });
});

let FoundYTPlayer = null;
let FoundYTPlayerIdentifier = null;
let Activated = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === MessageTypes.MESSAGE_FROM_CONTENT && request.destination === 'custom') {
    return handleContentMessage(request, sender, sendResponse);
  } else if (request.type === MessageTypes.SPONSORBLOCK_SCRAPE) {
    return handleSponsorBlockScrape(request, sender, sendResponse);
  } else if (request.type === MessageTypes.PLAYLIST_NAVIGATION) {
    return handlePlaylistNavigation(request, sender, sendResponse);
  } else if (request.type === MessageTypes.PLAYLIST_POLL) {
    return pollPlaylistButtons(request, sender, sendResponse);
  } else if (request.type === MessageTypes.EXTRACT_YT_DATA) {
    const data = get_yt_data_objs();
    sendResponse(data);
  }
});

function handleContentMessage(request, sender, sendResponse) {
  const data = request.data;
  if (data.type === 'active-state') {
    Activated = data.value;
    if (!Activated && FoundYTPlayer) {
      if (FoundYTPlayer.dataset['faststreamytplayer']) {
        delete FoundYTPlayer.dataset['faststreamytplayer'];
      }
      FoundYTPlayer = null;
    }
  }

  sendResponse('ok');
}

function handlePlaylistNavigation(request, sender, sendResponse) {
  const button = getNextOrPreviousButtonYT(request.direction === 'next');
  if (!button) {
    sendResponse('no_button');
    return;
  }

  button.click();
  sendResponse('clicked');
}

function pollPlaylistButtons(request, sender, sendResponse) {
  try {
    const nextButton = getNextOrPreviousButtonYT(true);
    const previousButton = getNextOrPreviousButtonYT(false);
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


async function sendToOtherContents(message) {
  await mainLoadedPromise;
  chrome.runtime.sendMessage({
    type: MessageTypes.SEND_TO_CONTENT,
    data: message,
    destination: 'main',
  });
}

function sendToPlayer(frameId, data) {
  sendToOtherContents({
    type: 'send-to-player',
    frameId,
    data,
  });
}


function is_url_yt_watch(urlStr) {
  const url = new URL(urlStr);
  const pathname = url.pathname;
  return pathname.startsWith('/watch');
}

function is_url_yt_embed(urlStr) {
  const url = new URL(urlStr);
  const pathname = url.pathname;
  return pathname.startsWith('/embed');
}

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

function json_parse_loose(json) {
  // replace single quotes with double quotes, remove trailing commas, etc. Careful for escaping
  const newstr = [];
  let inDoubleQuotes = false;
  let inSingleQuotes = false;
  let isEscaped = false;
  for (let i = 0; i < json.length; i++) {
    const char = json.charAt(i);
    if (isEscaped) {
      newstr.push(char);
      isEscaped = false;
      continue;
    }

    if (char === '\\') {
      isEscaped = true;
      newstr.push(char);
      continue;
    }

    if (!inSingleQuotes && char === '"') {
      inDoubleQuotes = !inDoubleQuotes;
      newstr.push(char);
      continue;
    }

    if (!inDoubleQuotes && char === '\'') {
      inSingleQuotes = !inSingleQuotes;
      newstr.push('"');
      continue;
    }

    if (!inDoubleQuotes && !inSingleQuotes && char === ',') {
      // Check if next non-whitespace character is a closing bracket
      let nextChar = i + 1;
      while (nextChar < json.length && /\s/.test(json[nextChar])) {
        nextChar++;
      }
      if (nextChar < json.length && (json[nextChar] === '}' || json[nextChar] === ']')) {
        continue; // Skip this comma
      }
    }

    newstr.push(char);
  }

  return JSON.parse(newstr.join(''));
}

function get_yt_data_objs() {
  const scripts = document.querySelectorAll('script');
  const data = [];
  for (const script of scripts) {
    const scriptText = script.innerHTML;
    // Check `ytcfg.set({ ... code ... })`
    const match = scriptText.match(/ytcfg\.set\((\{.*\})\)/);
    if (match) {
      try {
        const obj = json_parse_loose(match[1]);
        data.push({ytcfg: obj});
      } catch (e) {
        console.error(e);
      }
      continue;
    }

    // check `var ytInitialData = {...};`
    const match2 = scriptText.match(/var ytInitialData = (\{.*\});/);
    if (match2) {
      try {
        const obj = json_parse_loose(match2[1]);
        data.push({ytInitialData: obj});
      } catch (e) {
        console.error(e);
      }
      continue;
    }

    // check `var ytInitialPlayerResponse = {...};`
    const match3 = scriptText.match(/var ytInitialPlayerResponse = (\{.*\});/);
    if (match3) {
      try {
        const obj = json_parse_loose(match3[1]);
        data.push({ytInitialPlayerResponse: obj});
      } catch (e) {
        console.error(e);
      }
      continue;
    }
  }
  return data;
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

const observer = new MutationObserver((mutations) => {
  const isWatch = is_url_yt_watch(window.location.href);
  const isEmbed = is_url_yt_embed(window.location.href);
  if (isWatch || isEmbed) {
    const playerNodes = get_yt_video_elements();
    if (playerNodes.length === 0) {
      return;
    }

    const identifier = get_yt_identifier(window.location.href);

    playerNodes.find((playerNode) => {
      const rect = playerNode.getBoundingClientRect();
      if ((isEmbed || rect.x !== 0 || playerNode.id !== 'player') && rect.width * rect.height > 0 && (!FoundYTPlayer || FoundYTPlayerIdentifier !== identifier)) {
        // check if element contains the ytd-player element
        const ytdPlayer = playerNode.querySelector('ytd-player');
        if (!ytdPlayer) {
          return false;
        }

        FoundYTPlayer = playerNode;
        FoundYTPlayerIdentifier = identifier;
        if (!is_live()) {
          FoundYTPlayer.dataset['faststreamytplayer'] = 'true';
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

function getKeyString(e) {
  const metaPressed = e.metaKey && e.key !== 'Meta';
  const ctrlPressed = e.ctrlKey && e.key !== 'Control';
  const altPressed = e.altKey && e.key !== 'Alt';
  const shiftPressed = e.shiftKey && e.key !== 'Shift';
  const key = e.key === ' ' ? 'Space' : e.code;

  return (metaPressed ? 'Meta+' : '') + (ctrlPressed ? 'Control+' : '') + (altPressed ? 'Alt+' : '') + (shiftPressed ? 'Shift+' : '') + key;
}

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

  sendToPlayer('all', {
    type: 'key_down',
    key: getKeyString(e),
  });

  if (Activated && OverrideList.includes(e.code)) {
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

  if (Activated && OverrideList.includes(e.code)) {
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

  if (Activated && OverrideList.includes(e.code)) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}, true);


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
        sendToPlayer('all', {
          type: 'seek_to',
          time: parseInt(time),
        });
        if (Activated) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      }
    }
  } catch (e) {
    console.error(e);
    return;
  }
}, true);


sendToOtherContents({
  type: 'config',
  config: {
    softReplaceByDefault: true,
    hasCustomPlaylist: true,
    hasCustomLinkHandler: true,
    customVideoQuery: '[data-faststreamytplayer="true"]',
    customIframeId: 'player',
  },
});
