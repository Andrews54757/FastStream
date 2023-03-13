import { WebVTT } from "../modules/vtt.mjs";
import { SubtitleTrack } from "../SubtitleTrack.mjs";
import { SubtitleUtils } from "../utils/SubtitleUtils.mjs";
import { Utils } from "../utils/Utils.mjs";
import { DOMElements } from "./DOMElements.mjs";

const API_KEY = "jolY3ZCVYguxFxl8CkIKl52zpHJT2eTw";
export class SubtitlesManager {
    constructor(client) {
        this.client = client;
        this.tracks = [];

        this.activeTracks = [];

        this.settings = {
            "font-size": "40px",
            color: "rgba(255,255,255,1)",
            background: "rgba(0,0,0,0)"
        }

        this.isTesting = false;
        this.setupUI();
    }

    addTrack(track) {
        this.tracks.push(track);

        this.updateTrackList();
    }

    activateTrack(track) {
        if (this.activeTracks.indexOf(track) === -1) {
            this.activeTracks.push(track);
            this.updateTrackList();
        }
    }

    deactivateTrack(track) {
        let ind = this.activeTracks.indexOf(track);
        if (ind !== -1) {
            this.activeTracks.splice(ind, 1);
            this.updateTrackList();
        }
    }
    clearTracks() {
        this.tracks.length = 0;
        this.activeTracks.length = 0;
        this.updateTrackList();

    }

    removeTrack(track) {
        let ind = this.tracks.indexOf(track);
        if (ind !== -1) this.tracks.splice(ind, 1);
        ind = this.activeTracks.indexOf(track);
        if (ind !== -1) this.activeTracks.splice(ind, 1);

        this.updateTrackList();
    }

    updateSettings() {
        try {
            chrome.storage.sync.set({
                subtitlesSettings: JSON.stringify(this.settings)
            });
        } catch (e) {
            console.error(e);
        }
        this.renderSubtitles();
    }
    updateSettingsUI() {
        DOMElements.subtitlesOptionsList.innerHTML = "";
        for (let key in this.settings) {
            let option = document.createElement("div");
            option.classList.add("option");

            let label = document.createElement("div");
            label.textContent = key.charAt(0).toUpperCase() + key.substring(1);

            let input = document.createElement("input");
            input.type = "text";
            input.value = this.settings[key];
            let timeout = null;
            input.addEventListener("keyup", () => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    this.settings[key] = input.value;
                    this.updateSettings();
                }, 200);
            });
            input.addEventListener("change", () => {
                this.settings[key] = input.value;
                this.updateSettings();
            });
            option.appendChild(label);
            option.appendChild(input);
            DOMElements.subtitlesOptionsList.appendChild(option);
        }
    }

    loadSettings() {
        try {
            chrome.storage.sync.get("subtitlesSettings", (data) => {
                if (data.subtitlesSettings) {
                    this.settings = { ...this.settings, ...JSON.parse(data.subtitlesSettings) };
                    this.renderSubtitles();
                    this.updateSettingsUI();
                } else {
                    this.updateSettingsUI();
                }
            });
        } catch (e) {
            console.error(e);
            this.updateSettingsUI();
        }
    }
    setupUI() {
        this.loadSettings();

        DOMElements.subtitlesMenu.addEventListener("wheel", (e) => {
            e.stopPropagation();
        });
        DOMElements.subtitlesOptionsList.addEventListener("keydown", (e) => {
            e.stopPropagation();
        });

        DOMElements.subtitles.addEventListener("click", (e) => {

            if (DOMElements.subtitlesMenu.style.display == "none") {
                DOMElements.subtitlesMenu.style.display = "";
            } else {
                DOMElements.subtitlesMenu.style.display = "none"
            }
            e.stopPropagation();
        })

        DOMElements.playerContainer.addEventListener("click", (e) => {
            DOMElements.subtitlesMenu.style.display = "none";
        });

        DOMElements.subtitlesOptionsTestButton.addEventListener("click", (e) => {
            this.isTesting = !this.isTesting;
            if (this.isTesting) {
                DOMElements.subtitlesOptionsTestButton.textContent = "Stop Testing";
            } else {
                DOMElements.subtitlesOptionsTestButton.textContent = "Test Subtitles";
            }

            this.renderSubtitles();
        });
        var filechooser = document.createElement("input");
        filechooser.type = "file";
        filechooser.style = "display: none";
        filechooser.accept = ".vtt, .srt";

        filechooser.addEventListener("change", () => {
            var files = filechooser.files;
            if (!files || !files[0]) return;
            let file = files[0];
            var name = file.name;
            //  var ext = name.substring(name.length - 4);

            var reader = new FileReader();
            reader.onload = () => {
                var dt = reader.result;
                //   if (ext == ".srt") dt = srt2webvtt(dt);
                let track = new SubtitleTrack(name, null);
                track.loadText(dt);

                this.addTrack(track);
            }
            reader.readAsText(file);

        })
        document.body.appendChild(filechooser);

        var filebutton = document.createElement('div');
        filebutton.textContent = "Upload File"
        filebutton.style = "padding: 3px 5px; color: rgba(255,255,255,.8)";

        filebutton.addEventListener("click", (e) => {
            filechooser.click();
        })
        DOMElements.subtitlesView.appendChild(filebutton)

        var urlbutton = document.createElement('div');
        urlbutton.textContent = "From URL"
        urlbutton.style = "border-top: 1px solid rgba(255,255,255,0.4); padding: 3px 5px; color: rgba(255,255,255,.8)";

        urlbutton.addEventListener("click", (e) => {
            var url = prompt("Enter URL")

            var ext = url.split(".").pop();

            if (url) {
                Utils.simpleRequest(url, (err, req, body) => {
                    if (body) {

                        let track = new SubtitleTrack("URL Track", null);
                        track.loadText(body);

                        this.addTrack(track);
                    }
                })
            }

        })


        DOMElements.subtitlesView.appendChild(urlbutton)

        var internetbutton = document.createElement('div');
        internetbutton.textContent = "Search OpenSubtitles"
        internetbutton.style = "border-top: 1px solid rgba(255,255,255,0.4); padding: 3px 5px; color: rgba(255,255,255,.8)";

        internetbutton.addEventListener("click", (e) => {
            this.subui.container.style.display = "";
            this.subui.search.focus()
        })
        DOMElements.subtitlesView.appendChild(internetbutton)


        var optionsbutton = document.createElement('div');
        optionsbutton.textContent = "Subtitle Settings"
        optionsbutton.style = "border-top: 1px solid rgba(255,255,255,0.4); padding: 3px 5px; color: rgba(255,255,255,.8)";

        optionsbutton.addEventListener("click", (e) => {
            DOMElements.subtitlesOptions.style.display = "";
            DOMElements.subtitlesView.style.display = "none";
        });

        DOMElements.subtitlesOptionsBackButton.addEventListener("click", (e) => {
            DOMElements.subtitlesOptions.style.display = "none";
            DOMElements.subtitlesView.style.display = "";
        });

        DOMElements.subtitlesView.appendChild(optionsbutton)

        DOMElements.subtitlesMenu.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
        })
        this.subtitleQueryUI();



    }

    subtitleQueryUI() {
        this.subui = {};
        this.subui.container = document.createElement("div");
        this.subui.container.style = "display: none; padding: 5px; border-radius: 3px; border: 1px solid rgba(0,0,0,.1); position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 50%; height: 80%; background-color: rgba(50,50,50,.8); "
        DOMElements.playerContainer.appendChild(this.subui.container)

        this.subui.container.addEventListener('wheel', (e) => {
            e.stopPropagation();
        })

        this.subui.container.addEventListener('click', (e) => {
            e.stopPropagation();
        })

        this.subui.container.addEventListener('dblclick', (e) => {
            e.stopPropagation();
        })
        this.subui.closeBtn = document.createElement("div");
        this.subui.closeBtn.textContent = "X";
        this.subui.closeBtn.style = "font-family: Arial; font-size: 15px; color: rgba(255,255,255,.8); cursor: pointer; user-select: none; position: absolute; top: 0%; right: 0%"
        this.subui.closeBtn.addEventListener("click", () => {
            this.subui.container.style.display = "none"
        })
        this.subui.container.appendChild(this.subui.closeBtn)

        this.subui.search = document.createElement("div");
        this.subui.search.contentEditable = "true";
        this.subui.search.style = "display: inline-block; margin-top: 15px; font-family: Arial; font-size: 15px; width: calc(100% - 100px); color: rgba(255,255,255,.8); outline: none; padding: 5px; border-radius: 3px; height: 15px; border: 1px solid rgba(255,255,255,.1)"
        this.subui.search.addEventListener("keydown", (e) => {
            if (e.key == "Enter") {
                this.subui.search.blur();
                this.queryOpenSubtitles(this.subui.search.textContent.toLowerCase())
            }
            e.stopPropagation();
        }, true)
        this.subui.search.addEventListener("focus", (e) => {
            this.subui.search.style.borderColor = "rgba(255,255,255,.3)"
        })
        this.subui.search.addEventListener("blur", (e) => {
            this.subui.search.style.borderColor = "rgba(255,255,255,.1)"
        })
        this.subui.container.appendChild(this.subui.search)


        this.subui.searchBtn = document.createElement("div");
        this.subui.searchBtn.textContent = "Search"
        this.subui.searchBtn.style = "cursor: pointer; user-select: none; margin-left: 6px; display: inline-block; padding: 5px 16px; font-family: Arial; font-size: 15px; border-radius: 3px; border: 1px solid rgba(255,255,255,.1); color: rgba(255,255,255,.8); height: 15px;"
        this.subui.container.appendChild(this.subui.searchBtn)
        this.subui.searchBtn.addEventListener("mouseenter", (e) => {
            this.subui.searchBtn.style.borderColor = "rgba(255,255,255,.3)"
        })
        this.subui.searchBtn.addEventListener("mouseleave", (e) => {
            this.subui.searchBtn.style.borderColor = "rgba(255,255,255,.1)"
        })
        this.subui.searchBtn.addEventListener("click", (e) => {
            this.queryOpenSubtitles(this.subui.search.textContent.toLowerCase());
        })

        this.subui.results = document.createElement('div');
        this.subui.results.style = "margin-top: 10px; max-height: calc(100% - 52px); overflow-y: scroll"
        this.subui.container.appendChild(this.subui.results)

    }
    async queryOpenSubtitles(query) {

        let data = (await Utils.request({
            responseType: "json",
            url: "https://api.opensubtitles.com/api/v1/subtitles?order_by=download_count&query=" + encodeURIComponent(query),
            headers: {
                "Api-Key": API_KEY
            }
        })).response.data;


        this.subui.results.innerHTML = "";

        data.forEach((item) => {
            var container = document.createElement("div");
            container.style = "position: relative; overflow-y: scroll; user-select: none; cursor: pointer; font-family: Arial; font-size: 15px; width: 100%; height: 50px; color: rgba(255,255,255,.8); border-top: 1px solid rgba(255,255,255,0.1)"
            this.subui.results.appendChild(container);

            var lang = document.createElement("div");
            lang.style = "position: absolute; top: 50%; transform: translate(0%, -50%); left: 0px; text-align: center; width: 100px;"
            lang.textContent = item.attributes.language;
            container.appendChild(lang)

            var title = document.createElement("div");
            title.style = "position: absolute; left: 100px; width: calc(100% - 300px); top: 50%; padding: 0px 10px; transform: translate(0%, -50%);"
            title.textContent = item.attributes.feature_details.movie_name + " (" + item.attributes.feature_details.year + ")";
            container.appendChild(title)

            var user = document.createElement("div");
            user.style = "position: absolute; right: 60px; width: 100px; top: 50%; padding: 0px 10px; transform: translate(0%, -50%);"
            user.textContent = item.attributes.uploader.name;
            container.appendChild(user)


            var rank = document.createElement("div");
            rank.style = "position: absolute; right: 0px; width: 50px; top: 50%; transform: translate(0%, -50%);"
            rank.textContent = item.attributes.ratings;
            container.appendChild(rank)

            container.addEventListener("mouseenter", (e) => {
                container.style.color = "rgba(255,200,200,.8)"
            })
            container.addEventListener("mouseleave", (e) => {
                container.style.color = "rgba(255,255,255,.8)"
            })
            container.addEventListener("dblclick", async (e) => {
                console.log(item.attributes.files[0].file_id)

                let data = (await Utils.request({
                    type: "POST",
                    url: "https://api.opensubtitles.com/api/v1/download",
                    responseType: "json",
                    headers: {
                        "Api-Key": API_KEY,
                        "Content-Type": "application/json"
                    },

                    data: JSON.stringify({
                        file_id: item.attributes.files[0].file_id,
                        sub_format: "webvtt"
                    })
                })).response;
                console.log(data)
                let body = (await Utils.request({
                    url: data.link
                })).responseText;

                let track = new SubtitleTrack(item.attributes.uploader.name + " - " + item.attributes.feature_details.movie_name, item.attributes.language);
                track.loadText(body);
                this.addTrack(track);

            });
        })
    }

    updateTrackList() {

        DOMElements.subtitlesList.innerHTML = "";

        var tracks = this.tracks;
        for (var i = 0; i < tracks.length; i++) {
            ((i) => {
                var track = tracks[i];
                var trackElement = document.createElement('div');
                trackElement.style = "position: relative; border-bottom: 1px solid rgba(255,255,255,.4); padding: 3px 5px; color: rgba(255,255,255,.8)";

                let activeIndex = this.activeTracks.indexOf(track);
                let name = (track.language ? ("(" + track.language + ") ") : "") + (track.label || `Track ${i + 1}`);

                if (activeIndex !== -1) {
                    trackElement.style.color = "rgba(0,255,0,.6)";

                    if (this.activeTracks.length > 1) {
                        trackElement.textContent = (activeIndex + 1) + ": " + name;
                    } else {
                        trackElement.textContent = name;
                    }
                } else {
                    trackElement.style.color = "rgba(255,0,0,.7)";
                    trackElement.textContent = name;
                }



                trackElement.addEventListener("click", (e) => {
                    let ind = this.activeTracks.indexOf(track);
                    if (ind !== -1) {
                        this.deactivateTrack(track);
                    } else {
                        this.activateTrack(track);
                    }
                    e.stopPropagation();
                    e.preventDefault();
                })

                var downloadTrack = document.createElement("div");
                downloadTrack.style = "display: none; position: absolute; left: 5px; top: 50%; width: 10px; height: 10px; transform: translate(0%,-50%); color: rgba(100,100,100,.5); background-color: rgba(10,10,10,.5); border-radius: 50%;"
                trackElement.appendChild(downloadTrack)

                downloadTrack.addEventListener("click", (e) => {
                    e.stopPropagation();
                }, true)

                downloadTrack.addEventListener("dblclick", (e) => {

                    let srt = SubtitleUtils.cuesToSrt(track.cues);
                    let blob = new Blob([srt], {
                        type: 'text/plain'
                    });
                    let url = window.URL.createObjectURL(blob);

                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = name + '.srt';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    e.stopPropagation();
                }, true)

                var removeTrack = document.createElement("div");
                removeTrack.style = "display: none; position: absolute; right: 5px; top: 50%; width: 10px; height: 10px; transform: translate(0%,-50%); color: rgba(100,100,100,.5); background-color: rgba(255,0,0,.5); border-radius: 50%;"
                trackElement.appendChild(removeTrack)

                removeTrack.addEventListener("click", (e) => {
                    this.removeTrack(track);
                    e.stopPropagation();
                }, true)


                var shiftLTrack = document.createElement("div");
                shiftLTrack.style = "display: none; position: absolute; right: 50px; top: 50%; width: 0px; height: 0px; transform: translate(0%,-50%); border-right: 8px solid rgba(255,255,255,.5); border-bottom: 8px solid transparent; border-top: 8px solid transparent;"
                trackElement.appendChild(shiftLTrack)

                shiftLTrack.addEventListener("click", (e) => {
                    track.shift(-0.2)
                    this.renderSubtitles();
                    e.stopPropagation();
                }, true)

                var shiftLLTrack = document.createElement("div");
                shiftLLTrack.style = "display: none; position: absolute; right: 65px; top: 50%; width: 0px; height: 0px; transform: translate(0%,-50%); border-right: 8px solid rgba(200,200,200,.5); border-bottom: 8px solid transparent; border-top: 8px solid transparent;"
                trackElement.appendChild(shiftLLTrack)

                shiftLLTrack.addEventListener("click", (e) => {
                    track.shift(-2)
                    this.renderSubtitles();
                    e.stopPropagation();
                }, true)

                var shiftRTrack = document.createElement("div");
                shiftRTrack.style = "display: none; position: absolute; right: 35px; top: 50%; width: 0px; height: 0px; transform: translate(0%,-50%); border-left: 8px solid rgba(255,255,255,.5); border-bottom: 8px solid transparent; border-top: 8px solid transparent;"
                trackElement.appendChild(shiftRTrack)

                shiftRTrack.addEventListener("click", (e) => {
                    track.shift(0.2)
                    this.renderSubtitles();
                    e.stopPropagation();
                }, true)


                var shiftRRTrack = document.createElement("div");
                shiftRRTrack.style = "display: none; position: absolute; right: 20px; top: 50%; width: 0px; height: 0px; transform: translate(0%,-50%); border-left: 8px solid rgba(200,200,200,.5); border-bottom: 8px solid transparent; border-top: 8px solid transparent;"
                trackElement.appendChild(shiftRRTrack)

                shiftRRTrack.addEventListener("click", (e) => {
                    track.shift(2)
                    this.renderSubtitles();
                    e.stopPropagation();
                }, true)


                trackElement.addEventListener("mouseenter", () => {
                    downloadTrack.style.display = shiftRRTrack.style.display = shiftRTrack.style.display = shiftLTrack.style.display = shiftLLTrack.style.display = removeTrack.style.display = "block"
                })
                trackElement.addEventListener("mouseleave", () => {
                    downloadTrack.style.display = shiftRRTrack.style.display = shiftRTrack.style.display = shiftLTrack.style.display = shiftLLTrack.style.display = removeTrack.style.display = "none"
                })

                DOMElements.subtitlesList.appendChild(trackElement)
            })(i);
        }

        this.renderSubtitles();

    }


    renderSubtitles() {
        DOMElements.subtitlesContainer.innerHTML = "";
        DOMElements.subtitlesContainer.style.color = this.settings.color;
        DOMElements.subtitlesContainer.style.fontSize = this.settings["font-size"];
        DOMElements.subtitlesContainer.style.backgroundColor = this.settings.background;

        if (this.isTesting) {
            let trackContainer = document.createElement("div");
            trackContainer.className = "subtitle-track";
            DOMElements.subtitlesContainer.appendChild(trackContainer);
            let cue = document.createElement("div");
            cue.textContent = "This is a test subtitle";
            trackContainer.appendChild(cue);
        }
        let tracks = this.activeTracks;
        let currentTime = this.client.persistent.currentTime;
        tracks.forEach((track) => {
            let trackContainer = document.createElement("div");
            trackContainer.className = "subtitle-track";
            DOMElements.subtitlesContainer.appendChild(trackContainer);
            let cues = track.cues;

            let cueIndex = Utils.binarySearch(cues, currentTime, (time, cue) => {
                if (cue.startTime > time) {
                    return -1;
                } else if (cue.endTime < time) {
                    return 1;
                }
                return 0;
            })

            if (cueIndex <= -1) {
                return;
            }


            while (cueIndex > 0 && cues[cueIndex - 1].endTime >= currentTime && cues[cueIndex - 1].startTime <= currentTime) {
                cueIndex--;
            }

            while (cueIndex < cues.length && cues[cueIndex].endTime >= currentTime && cues[cueIndex].startTime <= currentTime) {
                let cue = cues[cueIndex];
                if (!cue.dom) {
                    cue.dom = WebVTT.convertCueToDOMTree(window, cue.text);
                }
                trackContainer.appendChild(cue.dom);
                cueIndex++;
            }
        })
    }
}
