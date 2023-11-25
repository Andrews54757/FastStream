
import {PlayerModes} from './enums/PlayerModes.mjs';
import {FastStreamClient} from './FastStreamClient.mjs';
import {SubtitleTrack} from './SubtitleTrack.mjs';
import {EnvUtils} from './utils/EnvUtils.mjs';
import {RequestUtils} from './utils/RequestUtils.mjs';
import {URLUtils} from './utils/URLUtils.mjs';
import {Utils} from './utils/Utils.mjs';
import {VideoSource} from './VideoSource.mjs';


let OPTIONS = null;
if (EnvUtils.isExtension()) {
  chrome.runtime.onMessage.addListener(
      (request, sender, sendResponse) => {
        if (request.type === 'sendFrameId') {
          if (window.parent !== window) {
            window.parent.postMessage({
              type: 'frame',
              id: request.frameId,
            }, '*');
          }
        } else if (request.type === 'options') {
          OPTIONS = JSON.parse(request.options);
          if (window.fastStream) window.fastStream.setOptions(OPTIONS);
        } if (request.type === 'analyzerData') {
          window.fastStream.loadAnalyzerData(request.data);
        } else if (request.type === 'media_name') {
          const name = request.name;
          if (name) {
            if (window.fastStream) window.fastStream.setMediaName(name);
          }
        } else if (request.type === 'fullscreen_change' && window.fastStream) {
          window.fastStream.interfaceController.setFullscreenStatus(request.fullscreen);
        } else if (request.type === 'sources' && window.fastStream) {
          recieveSources(request, sendResponse);
          return true;
        } else {
          sendResponse('unknown');
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
  let autoPlaySource = sources.reduce((result, curr) => {
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
  if (autoPlaySource.mode === PlayerModes.ACCELERATED_MP4) {
    const mp4SourceCandidates = sources.filter((item) => {
      return item !== autoPlaySource && item.mode === PlayerModes.ACCELERATED_MP4;
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
      autoPlaySource = mp4SourceCandidates[0];
    }
  }

  if (window.fastStream.source || !request.autoSetSource) {
    autoPlaySource = null;
  }

  if (autoPlaySource) {
    window.fastStream.clearSubtitles();
  }

  sources.forEach((s) => {
    window.fastStream.addSource(new VideoSource(s.url, s.headers, s.mode), s === autoPlaySource);
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
  const subtitlesSettings = await Utils.getConfig('subtitlesSettings');
  try {
    const settings = JSON.parse(subtitlesSettings);
    if (settings['default-lang']) {
      defLang = settings['default-lang'];
    }
  } catch (e) {
    console.log(e);
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

async function setup() {
  if (!window.fastStream) {
    window.fastStream = new FastStreamClient();
    await window.fastStream.setup();
  }

  if (EnvUtils.isExtension()) {
    try {
      OPTIONS = await Utils.getOptionsFromStorage();
      window.fastStream.setOptions(OPTIONS);
    } catch (e) {
      console.error(e);
    }
  }

  const urlParams = new URLSearchParams(window.location.search);
  const myParam = urlParams.get('frame_id');

  if (EnvUtils.isExtension()) {
    chrome?.runtime?.sendMessage({
      type: 'faststream',
      url: window.location.href,
      isExt: true,
      frameId: parseInt(myParam) || 0,
    }).then((data) => {
      chrome.runtime.sendMessage({
        type: 'ready',
      });
    });
  }

  const version = window.fastStream.version;
  console.log('\n %c %c %cFast%cStream %c-%c ' + version + ' %c By Andrews54757 \n', 'background: url(https://user-images.githubusercontent.com/13282284/57593160-3a4fb080-7508-11e9-9507-33d45c4f9e41.png) no-repeat; background-size: 16px 16px; padding: 2px 6px; margin-right: 4px', 'background: rgb(50,50,50); padding:5px 0;', 'color: rgb(200,200,200); background: rgb(50,50,50); padding:5px 0;', 'color: rgb(200,200,200); background: rgb(50,50,50); padding:5px 0;', 'color: rgb(200,200,200); background: rgb(50,50,50); padding:5px 0;', 'color: #afbc2a; background: rgb(50,50,50); padding:5px 0;', 'color: black; background: #e9e9e9; padding:5px 0;');


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

    window.fastStream.addSource(new VideoSource(url, {}, mode), true).then(() => {

    });
  }

  if (!EnvUtils.isExtension()) {
    window.fastStream.setOptions(await Utils.getOptionsFromStorage());

    // if not extension context then use iframe messager
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'options') {
        window.fastStream.setOptions(JSON.parse(e.data.options));
      } else if (e.data?.type === 'sources') {
        recieveSources(e.data, () => {});
      }
    });
  }
}

setup().catch((e)=>{
  console.error(e);
});
