
import { PlayerModes } from "./src/enums/PlayerModes.mjs";
import { FastStreamClient } from "./src/FastStreamClient.mjs";
import { SubtitleTrack } from "./src/SubtitleTrack.mjs";
import { Utils } from "./src/utils/Utils.mjs";
import { VideoSource } from "./src/VideoSource.mjs";


var OPTIONS = null;

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.type == "init") {

            if (window.parent !== window) {
                window.parent.postMessage({
                    type: "frame",
                    id: request.frameId
                }, "*")
            }

        } else if (request.type == "settings") {

            OPTIONS = request.options;
            if (window.fastStream) window.fastStream.setOptions(OPTIONS);
        } if (request.type == "analyzerData") {
            window.fastStream.loadAnalyzerData(request.data)
        } else if (request.type == "sources" && window.fastStream) {
            console.log("Recieved sources", request.sources, request.subtitles)
            var subs = request.subtitles;
            const sources = request.sources;

            if (sources.length === 0) {
                return;
            }

            let source = sources[0];

            if (source.mode === PlayerModes.ACCELERATED_MP4) {
                source = sources.reverse().find((s) => s.mode === PlayerModes.ACCELERATED_MP4);
            }

            window.fastStream.setSource(new VideoSource(source.url, source.headers, source.mode)).then(() => {
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
                        let headers = sub.headers || [];
                        let customHeaderCommands = headers.filter((header)=>{
                            return header.name === "Origin" || header.name === "Referer";
                        }).map(header => {
                            return {
                                operation: "set",
                                header: header.name,
                                value: header.value
                            }
                        });

                            chrome.runtime.sendMessage({
                                type: "header_commands",
                                url: sub.source,
                                commands: customHeaderCommands
                            }).then(()=>{
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
                            })
                        
                     
                    }
                });
                todo = todo - 1;
                if (todo === done) loadondone();

                function loadondone() {

                    subs = subs.filter((sub) => sub.data);

                    let done = 0;
                    let todo = subs.length;
                    subs.forEach((sub) => {
                        chrome.i18n.detectLanguage(sub.data, (result) => {
                            let lang = result.languages.find(lang => lang.language === "en");
                            let score = lang ? lang.percentage : 0;
                            sub.score = score;

                            if (!sub.language && result.languages.length > 0 && result.languages[0].percentage > 50) {
                                sub.language = result.languages[0].language;
                            }
                            done++;
                            if (todo === done) sendSubs();
                        });
                    })

                    function sendSubs() {
                        subs.sort((a, b) => {
                            return b.score - a.score;
                        })

                        try {
                            subs.forEach((sub) => {
                                const track = new SubtitleTrack(sub.label, sub.language);
                                try {
                                    track.loadText(sub.data);
                                    window.fastStream.loadSubtitleTrack(track);
                                } catch (e) {
                                    console.error(e)
                                }
                            })
                        } catch (e) {
                            console.error(e)
                        }
                    }
                }
            }
        }
    });


var head = document.head

var body = document.body


body.style = "position: absolute; margin: 0px; left: 0; right: 0; top: 0; bottom: 0"


if (window.fastStream) {
    var vid = window.fastStream;
} else {
    var vid = new FastStreamClient();
    window.fastStream = vid;
}
if (OPTIONS && window.fastStream) window.fastStream.setOptions(OPTIONS);

const urlParams = new URLSearchParams(window.location.search);
const myParam = urlParams.get('frame_id');

chrome.runtime.sendMessage({
    type: "faststream",
    isExt: true,
    frameId: parseInt(myParam)
})

if (!chrome.extension.inIncognitoContext) {
    window.fastStream.downloadAll();
    //console.log("Download all")
}
chrome.runtime.sendMessage({
    type: "ready"
});


var version = chrome.runtime.getManifest().version;
console.log('\n %c %c %cFast%cStream %c-%c ' + version + ' %c By Andrews54757 \n', 'background: url(https://user-images.githubusercontent.com/13282284/57593160-3a4fb080-7508-11e9-9507-33d45c4f9e41.png) no-repeat; background-size: 16px 16px; padding: 2px 6px; margin-right: 4px', 'background: rgb(50,50,50); padding:5px 0;', 'color: rgb(200,200,200); background: rgb(50,50,50); padding:5px 0;', 'color: rgb(200,200,200); background: rgb(50,50,50); padding:5px 0;', 'color: rgb(200,200,200); background: rgb(50,50,50); padding:5px 0;', 'color: #afbc2a; background: rgb(50,50,50); padding:5px 0;', 'color: black; background: #e9e9e9; padding:5px 0;')


window.addEventListener("beforeunload", () => {
    if (window.fastStream) {
        window.fastStream.destroy();
        delete window.fastStream;
    }
})

