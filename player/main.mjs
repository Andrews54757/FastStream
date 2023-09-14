
import {PlayerModes} from './enums/PlayerModes.mjs';
import {FastStreamClient} from './FastStreamClient.mjs';
import {SubtitleTrack} from './SubtitleTrack.mjs';
import {Utils} from './utils/Utils.mjs';
import {VideoSource} from './VideoSource.mjs';


let OPTIONS = null;
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
  chrome.runtime.onMessage.addListener(
      function(request, sender, sendResponse) {
        if (request.type == 'init') {
          if (window.parent !== window) {
            window.parent.postMessage({
              type: 'frame',
              id: request.frameId,
            }, '*');
          }
        } else if (request.type == 'settings') {
          OPTIONS = request.options;
          if (window.fastStream) window.fastStream.setOptions(OPTIONS);
        } if (request.type == 'analyzerData') {
          window.fastStream.loadAnalyzerData(request.data);
        } else if (request.type === 'media_name') {
          const name = request.name;
          if (name) {
            if (window.fastStream) window.fastStream.setMediaName(name);
          }
        } else if (request.type === 'sources' && window.fastStream) {
          console.log('Recieved sources', request.sources, request.subtitles);
          let subs = request.subtitles;
          const sources = request.sources;

          if (sources.length === 0) {
            return;
          }

          let source = sources[0];

          sources.find((s) => {
            if (s.mode === PlayerModes.ACCELERATED_YT) {
              source = s;
              return true;
            }
            return false;
          });

          if (source.mode === PlayerModes.ACCELERATED_MP4) {
            source = sources.reverse().find((s) => s.mode === PlayerModes.ACCELERATED_MP4);
          }

          sources.forEach((s) => {
            if (s !== source) {
              window.fastStream.addSource(new VideoSource(s.url, s.headers, s.mode), false);
            }
          });

          window.fastStream.addSource(new VideoSource(source.url, source.headers, source.mode), true).then(() => {
            window.fastStream.play();
          });


          window.fastStream.clearSubtitles();
          if (subs) {
            subs = subs.filter((sub) => sub);
            let todo = 1;
            let done = 0;
            subs.forEach((sub) => {
              if (!sub.data && sub.source) {
                todo++;
                const headers = sub.headers || [];
                const customHeaderCommands = headers.filter((header) => {
                  return header.name === 'Origin' || header.name === 'Referer';
                }).map((header) => {
                  return {
                    operation: 'set',
                    header: header.name,
                    value: header.value,
                  };
                });

                chrome.runtime.sendMessage({
                  type: 'header_commands',
                  url: sub.source,
                  commands: customHeaderCommands,
                }).then(() => {
                  Utils.simpleRequest(sub.source, (err, req, body) => {
                    if (!err && body) {
                      sub.data = body;
                    }
                    if (err) {
                      console.warn(err);
                    }

                    done++;
                    if (todo === done) loadondone();
                  });
                });
              }
            });
            todo = todo - 1;
            if (todo === done) loadondone();

            function loadondone() {
              chrome.storage.sync.get('subtitlesSettings', (data) => {
                let defLang = 'en';
                if (data.subtitlesSettings) {
                  try {
                    const settings = JSON.parse(data.subtitlesSettings);
                    if (settings['default-lang']) {
                      defLang = settings['default-lang'];
                    }
                  } catch (e) {
                    console.log(e);
                  }
                }

                subs = subs.filter((sub) => sub.data);

                let done = 0;
                const todo = subs.length;
                subs.forEach((sub) => {
                  chrome.i18n.detectLanguage(sub.data, (result) => {
                    const lang = result.languages.find((lang) => lang.language === defLang);
                    const score = lang ? lang.percentage : 0;
                    sub.score = score;

                    if (!sub.language && result.languages.length > 0 && result.languages[0].percentage > 50) {
                      sub.language = result.languages[0].language;
                    }
                    done++;
                    if (todo === done) sendSubs();
                  });
                });

                function sendSubs() {
                  subs.sort((a, b) => {
                    return b.score - a.score;
                  });

                  try {
                    subs.forEach((sub, i) => {
                      const track = new SubtitleTrack(sub.label, sub.language);
                      try {
                        track.loadText(sub.data);
                        window.fastStream.loadSubtitleTrack(track);
                      } catch (e) {
                        console.error(e);
                      }
                    });
                  } catch (e) {
                    console.error(e);
                  }
                }
              });
            }
          }
        }
      });

  setInterval(() => {
    chrome.runtime.sendMessage({
      type: 'ping',
    });
  }, 10000);
}

if (!window.fastStream) {
  window.fastStream = new FastStreamClient();
}
if (OPTIONS && window.fastStream) window.fastStream.setOptions(OPTIONS);

const urlParams = new URLSearchParams(window.location.search);
const myParam = urlParams.get('frame_id');

if (typeof chrome !== 'undefined') {
  chrome?.runtime?.sendMessage({
    type: 'faststream',
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
  const ext = Utils.get_url_extension(url);
  let mode = PlayerModes.DIRECT;
  if (Utils.is_url_yt(url) && Utils.is_url_yt_watch(url)) {
    mode = PlayerModes.ACCELERATED_YT;
  } else if (Utils.getModeFromExtension(ext)) {
    mode = Utils.getModeFromExtension(ext);
  }

  if (url.startsWith('file://') && mode === PlayerModes.ACCELERATED_MP4) {
    mode = PlayerModes.DIRECT;
  }

  window.fastStream.addSource(new VideoSource(url, {}, mode), true).then(() => {
    console.log('play');
    window.fastStream.play();
  });
}
