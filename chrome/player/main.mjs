
import {PlayerModes} from './enums/PlayerModes.mjs';
import {FastStreamClient} from './FastStreamClient.mjs';
import {SubtitleTrack} from './SubtitleTrack.mjs';
import {EnvUtils} from './utils/EnvUtils.mjs';
import {RequestUtils} from './utils/RequestUtils.mjs';
import {URLUtils} from './utils/URLUtils.mjs';
import {Utils} from './utils/Utils.mjs';
import {VideoSource} from './VideoSource.mjs';


let OPTIONS = null;
let optionSendTime = null;
if (EnvUtils.isExtension()) {
  chrome.runtime.onMessage.addListener(
      (request, sender, sendResponse) => {
        if (request.type === 'seek') {
          if (window.fastStream) window.fastStream.currentTime = request.time;
        } else if (request.type === 'sendFrameId') {
          if (window.parent !== window) {
            window.parent.postMessage({
              type: 'frame',
              id: request.frameId,
            }, '*');
          }
        } else if (request.type === 'keypress') {
          if (window.fastStream) {
            window.fastStream.keybindManager.handleKeyString(request.key);
            window.fastStream.userInteracted();
          }
        } else if (request.type === 'options' || request.type === 'options_init') {
          if (request.time !== optionSendTime) {
            optionSendTime = request.time;
            loadOptions();
          }
        } if (request.type === 'miniplayer_change' && window.fastStream) {
          window.fastStream.interfaceController.setMiniplayerStatus(request.miniplayer);
        } else if (request.type === 'fullscreen_change' && window.fastStream) {
          window.fastStream.interfaceController.setFullscreenStatus(request.fullscreen);
        } else if (request.type === 'sources' && window.fastStream) {
          recieveSources(request, sendResponse);
          return true;
        } else {
          return;
        }

        sendResponse('ok');
      });

  setInterval(() => {
    chrome.runtime.sendMessage({
      type: 'ping',
    });
  }, 10000);
}

async function recieveSources(request, sendResponse) {
  console.log('Recieved sources', request.sources, request.subtitles);
  let subs = request.subtitles;
  const sources = request.sources;

  if (sources.length === 0) {
    sendResponse('no_sources');
    return;
  }

  // Sources are ordered by time, so we can just choose the first one and it will be the oldest.
  // But we also want to minimize depth
  let autoSetSource = sources.reduce((result, curr) => {
    // Choose lower depth
    if (result.depth > curr.depth) {
      return curr;
    }

    // Always choose the newest yt source if it exists
    if (curr.mode === PlayerModes.ACCELERATED_YT) {
      return curr;
    }

    // If result isn't using streaming technologies, try to find one that does
    const streamingModes = [PlayerModes.ACCELERATED_HLS, PlayerModes.ACCELERATED_DASH, PlayerModes.ACCELERATED_YT];
    if (!streamingModes.includes(result.mode) && streamingModes.includes(curr.mode)) {
      return curr;
    }

    return result;
  }, sources[0]);

  // Play the newest source at lowest depth if it is mp4
  if (autoSetSource.mode === PlayerModes.ACCELERATED_MP4) {
    const mp4SourceCandidates = sources.filter((item) => {
      return item !== autoSetSource && item.mode === PlayerModes.ACCELERATED_MP4;
    });

    mp4SourceCandidates.sort((a, b) => {
      // Lower depth is better
      if (a.depth !== b.depth) {
        return a.depth - b.depth;
      }

      // Newer is better
      return b.time - a.time;
    });

    if (mp4SourceCandidates.length > 0) {
      autoSetSource = mp4SourceCandidates[0];
    }
  }

  if (window.fastStream.source || !request.autoSetSource) {
    autoSetSource = null;
  }

  if (autoSetSource) {
    window.fastStream.clearSubtitles();
  }

  if (
    (autoSetSource && autoSetSource.mode === PlayerModes.ACCELERATED_YT &&
    !URLUtils.is_url_yt_embed(autoSetSource.url) &&
    OPTIONS.autoplayYoutube) || (autoSetSource && request.forceAutoplay)
  ) {
    window.fastStream.setAutoPlay(true); // Enable autoplay for yt only. Not embeds.
  }

  sources.forEach((s) => {
    window.fastStream.addSource(new VideoSource(s.url, s.headers, s.mode), s === autoSetSource);
  });

  if (subs) {
    subs = await loadSubtitles(subs);
    subs = await sortSubtitles(subs);

    try {
      subs.forEach((sub, i) => {
        const track = new SubtitleTrack(sub.label, sub.language);
        try {
          track.loadText(sub.data);
          window.fastStream.loadSubtitleTrack(track, request.autoSetSource);
        } catch (e) {
          console.error(e);
        }
      });
    } catch (e) {
      console.error(e);
    }
  }

  if (request.requestFullscreen === 'fullscreen') {
    window.fastStream.interfaceController.fullscreenToggle(true).catch((e) => {
      console.error(e);
      window.fastStream.interfaceController.toggleWindowedFullscreen(true);
    });
  } else if (request.requestFullscreen === 'pip') {
    window.fastStream.interfaceController.pipToggle(true);
  } else if (request.requestFullscreen === 'windowed') {
    window.fastStream.interfaceController.toggleWindowedFullscreen(true);
  }

  sendResponse('sources_recieved');
}

async function loadSubtitles(subs) {
  await Promise.all(subs.map(async (sub) => {
    if (sub && !sub.data && sub.source) {
      const headers = sub.headers || [];
      const customHeaderCommands = headers.filter((header) => {
        return header.name.toLowerCase() === 'origin' || header.name.toLowerCase() === 'referer';
      }).map((header) => {
        return {
          operation: 'set',
          header: header.name.toLowerCase(),
          value: header.value,
        };
      });

      await chrome.runtime.sendMessage({
        type: 'header_commands',
        url: sub.source,
        commands: customHeaderCommands,
      });
      const xhr = await RequestUtils.requestSimple(sub.source);
      const body = xhr.responseText;
      if ((xhr.status === 200 || xhr.status === 206) && body) {
        sub.data = body;
      }
    }
  }));
  return subs.filter((sub) => sub.data);
}

async function sortSubtitles(subs) {
  if (!EnvUtils.isExtension() || !chrome?.i18n?.detectLanguage) {
    return subs;
  }

  let defLang = 'en';
  const subtitlesSettings = await Utils.getSubtitlesSettingsFromStorage();
  if (subtitlesSettings.defaultLanguage) {
    defLang = subtitlesSettings.defaultLanguage;
  }

  await Promise.all(subs.map((sub) => {
    return new Promise((resolve, reject)=>{
      chrome.i18n.detectLanguage(sub.data, (result) => {
        const lang = result.languages.find((lang) => lang.language === defLang);
        const score = lang ? lang.percentage : 0;
        sub.score = score;

        if (!sub.language && result.languages.length > 0 && result.languages[0].percentage > 50) {
          sub.language = result.languages[0].language;
        }

        resolve();
      });
    });
  }));

  subs.sort((a, b) => {
    return b.score - a.score;
  });

  return subs;
}

async function loadOptions() {
  try {
    OPTIONS = await Utils.getOptionsFromStorage();
    window.fastStream.setOptions(OPTIONS);
  } catch (e) {
    console.error(e);
  }
}

async function setup() {
  if (!window.fastStream) {
    window.fastStream = new FastStreamClient();
    await window.fastStream.setup();
  }

  await loadOptions();

  const urlParams = new URLSearchParams(window.location.search);
  const myParam = urlParams.get('frame_id');

  if (EnvUtils.isExtension()) {
    chrome?.runtime?.sendMessage({
      type: 'faststream',
      url: window.location.href,
      isExt: true,
      frameId: parseInt(myParam) || 0,
    }).then((data) => {
      window.fastStream.loadAnalyzerData(data.analyzerData);
      window.fastStream.setMediaName(data.mediaName);
      window.fastStream.setNeedsUserInteraction(!data.isMainPlayer);

      console.log('Recieved data', data);

      chrome.runtime.sendMessage({
        type: 'ready',
      });

      window.fastStream.setupPoll();
    });
  }

  const version = window.fastStream.version;
  Utils.printWelcome(version);

  window.addEventListener('beforeunload', () => {
    if (window.fastStream) {
      window.fastStream.destroy();
      delete window.fastStream;
    }
  });

  if (window.location.hash) {
    const url = window.location.hash.substring(1);
    const ext = URLUtils.get_url_extension(url);
    let mode = PlayerModes.DIRECT;

    if (URLUtils.is_url_yt(url) && URLUtils.is_url_yt_watch(url)) {
      mode = PlayerModes.ACCELERATED_YT;
    }

    if (mode === PlayerModes.DIRECT && URLUtils.getModeFromExtension(ext)) {
      mode = URLUtils.getModeFromExtension(ext);
    }

    if (url.startsWith('file://') && mode === PlayerModes.ACCELERATED_MP4) {
      mode = PlayerModes.DIRECT;
    }

    const source = new VideoSource(url, {}, mode);
    source.parseHeadersParam();

    window.fastStream.addSource(source, true).then(() => {

    });
  }

  if (!EnvUtils.isExtension()) {
    // if not extension context then use iframe messager
    window.addEventListener('message', (e) => {
      if (e.origin !== window.location.origin) return;

      if (e.data?.type === 'options') {
        loadOptions();
      } else if (e.data?.type === 'sources') {
        recieveSources(e.data, () => {});
      }
    });
  }
}

setup().catch((e)=>{
  console.error(e);
});

// SPLICER:EXTENSION:REMOVE_START
// Detect wave extension and fix positioning so it works
// Watch for an iframe element added to body with an id wave_sidebar_container
// When it is added, move the player to the right
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.id === 'wave_sidebar_container' || node.id === 'waveordercontainer') {
        doWaveFix();
      }
    });

    mutation.removedNodes.forEach((node) => {
      if (node.id === 'wave_sidebar_container') {
        undoWaveFix();
      }
    });
  });
});

observer.observe(document.body, {
  childList: true,
});

let lastObserver = null;

function doWaveFix() {
  const player = document.querySelector('.mainplayer');
  if (player) {
    player.style.left = '380px';
    player.style.width = 'calc(100% - 380px)';
  }

  const waveordercontainer = document.querySelector('#waveordercontainer');
  if (waveordercontainer) {
    waveordercontainer.style.left = '380px';
  }

  const waveTopbar = document.querySelector('#wave5topbar');
  if (waveTopbar) {
    const topbarHeight = waveTopbar.clientHeight;
    player.style.height = `calc(100% - ${topbarHeight}px)`;

    const observer = new ResizeObserver((entries) => {
      const topbarHeight = waveTopbar.clientHeight;
      player.style.height = `calc(100% - ${topbarHeight}px)`;
    });

    observer.observe(waveTopbar);
    if (lastObserver) {
      lastObserver.disconnect();
    }
    lastObserver = observer;
  }
}

function undoWaveFix() {
  const player = document.querySelector('.mainplayer');
  if (player) {
    player.style.left = '';
    player.style.width = '';
    player.style.height = '';
  }

  if (lastObserver) {
    lastObserver.disconnect();
    lastObserver = null;
  }
}
// SPLICER:EXTENSION:REMOVE_END
