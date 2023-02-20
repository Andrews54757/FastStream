import { head } from "min-document";

const options = {};

const PlayerModes = {
    DIRECT: 0,
    ACCELERATED_MP4: 1,
    ACCELERATED_HLS: 2,
    ACCELERATED_DASH: 3,

    IFRAME: 4,

    YT: 5,
}

var version = chrome.runtime.getManifest().version;
var logging = false;
var playerURL = chrome.runtime.getURL("player.html");
var tabs = {};


chrome.runtime.onInstalled.addListener(function (object) {
    chrome.storage.local.get("welcome", function (result) {
        if (!result || !result.welcome) {
            console.log(result)
            chrome.tabs.create({
                url: chrome.runtime.getURL("welcome.html")
            }, function (tab) {
                chrome.storage.local.set({
                    welcome: true
                });
            });
        }
    });

});

class FrameHolder {

    constructor(frameId, parent, tab) {
        if (parent === undefined) throw new Error("Parent is undefined");
        this.frame = frameId;
        this.parent = parent;
        this.urls = [];

        this.sources = [];
        this.requests = {};

        this.requests = [];
        this.tab = tab;
        this.subtitles = [];

        this.isMain = frameId === 0;


        this.url = '';
    }
}
class TabHolder {
    constructor(tabId) {
        this.tab = tabId
        this.isOn = false;
        this.frames = {};
        this.hostname;
        this.analyzerData = undefined;
    }
    addFrame(frameId, parent) {
        this.frames[frameId] = new FrameHolder(frameId, parent, this);
    }


}

const MatchTypes = {
    MEDIA: "media",
    XHR: "xmlhttprequest",
}

class RuleEntry {
    constructor(id) {
        this.id = id;
        this.expiresAt = Date.now() + 1000 * 5;
    }
}

class RuleManager {
    constructor() {
        this.rules = [];
        this.isLoopRunning = false;
        this.dumpRules();
    }

    getInsertionIndex(id) {
        // use binary search
        let min = 0;
        let max = this.rules.length - 1;
        let mid = 0;
        while (min <= max) {
            mid = Math.floor((min + max) / 2);
            if (this.rules[mid].id < id) {
                min = mid + 1;
            } else if (this.rules[mid].id > id) {
                max = mid - 1;
            } else {
                return -1;
            }
        }
        return min;
    }

    startLoop() {
        if (this.isLoopRunning) return;
        this.isLoopRunning = true;
        this.mainLoop();
    }

    mainLoop() {
        if (this.rules.length === 0) {
            this.isLoopRunning = false;
            return;
        }
        setTimeout(() => this.mainLoop(), 1000);
        this.filterRules();
    }

    async filterRules() {
        let now = Date.now();
        let removed = [];
        this.rules = this.rules.filter((rule) => {
            if (rule.expiresAt < now) {
                removed.push(rule);
                return false;
            }
            return true;
        });

        return chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: removed.map((rule) => rule.id)
        });
    }

    async addHeaderRule(url, tabId, requestHeaderCommands) {
        let rule = new RuleEntry(this.getNextID());
        //   if (logging) console.log("Adding rule", rule.id, url, tabId, requestHeaderCommands)

        // insert rule in order
        let index = this.getInsertionIndex(rule.id);
        if (index === -1) throw new Error("Rule already exists");
        this.rules.splice(index, 0, rule);

        let ruleObj = {
            id: rule.id,
            priority: 1,
            action: {
                type: "modifyHeaders",
                requestHeaders: requestHeaderCommands
            },
            condition: {
                urlFilter: url,
                tabIds: [tabId],
            },
        }
        let result = await chrome.declarativeNetRequest.updateSessionRules({
            addRules: [ruleObj],
        });

        this.startLoop();
        return rule;
    }

    getNextID() {
        let nextRuleID = 1;
        for (let i = 0; i < this.rules.length; i++) {
            let rule = this.rules[i];
            if (rule.id === nextRuleID) {
                nextRuleID++;
            } else {
                break;
            }
        }
        return nextRuleID;
    }

    async dumpRules() {
        let rules = await chrome.declarativeNetRequest.getSessionRules()
        console.log("Dumping " + rules.length + " rules")
        return chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: rules.map((rule) => rule.id)
        });
    }
}


const ruleManager = new RuleManager();
function onClicked(tab) {
    if (!tabs[tab.id]) tabs[tab.id] = new TabHolder(tab.id);

    if (tab.url && tab.url !== "about:newtab" && tab.url !== "chrome://newtab/") {
        tabs[tab.id].isOn = !tabs[tab.id].isOn;


        if (tabs[tab.id].isOn) {
            chrome.action.setBadgeText({
                text: "On",
                tabId: tab.id
            });
            chrome.action.setIcon({
                path: "icon2_128.png",
                tabId: tab.id
            });

            openPlayersWithSources(tab.id);
        } else {
            chrome.action.setBadgeText({
                text: "Off",
                tabId: tab.id
            });
            chrome.action.setIcon({
                path: "icon128.png",
                tabId: tab.id
            });
            setTimeout(function () {
                chrome.action.setBadgeText({
                    text: "",
                    tabId: tab.id
                });
            }, 1000)
        }
    } else {
        if (!tabs[tab.id].frames[0]) tabs[tab.id].addFrame(0, -1)
        //   tabs[tab.id].frames[0].source = "null"
        chrome.tabs.update(tab.id, {
            url: playerURL
        }, () => {


        });
    }
}
chrome.action.onClicked.addListener(function (tab) {
    onClicked(tab)

});



chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type == "welcome") {
        chrome.tabs.create({
            url: chrome.runtime.getURL("welcome.html")
        }, function (tab) {

        });
        return;
    }

    if (!tabs[sender.tab.id]) {
        tabs[sender.tab.id] = new TabHolder(sender.tab.id);
    }
    var tab = tabs[sender.tab.id];

    if (!tabs[sender.tab.id].frames[sender.frameId]) {
        let parentFrameId = -2;
        tabs[sender.tab.id].addFrame(sender.frameId, parentFrameId);
    }

    var frame = tabs[sender.tab.id].frames[sender.frameId];

    if (msg.type === 'header_commands') {
        if (msg.commands.length) {
            ruleManager.addHeaderRule(msg.url, sender.tab.id, msg.commands).then((rule) => {
                sendResponse();
            });
        } else {
            sendResponse();
        }
    } else if (msg.type === 'fullscreen') {
        chrome.tabs.sendMessage(frame.tab.tab, {
            type: "fullscreen",
            frameId: frame.frame
        }, {
            frameId: frame.parent
        });
    } else if (msg.type === "faststream") {
        if (logging) console.log("Found FastStream window", frame)
        frame.isFastStream = true;

        if (frame.parent === -2 && frame.frame != msg.frameId) {
            frame.parent = msg.frameId;
        }

        chrome.tabs.sendMessage(frame.tab.tab, {
            type: "init",
            frameId: frame.frame
        }, {
            frameId: frame.frame
        });

        chrome.tabs.sendMessage(frame.tab.tab, {
            type: "settings",
            options: options
        }, {
            frameId: frame.frame
        });

        chrome.tabs.sendMessage(frame.tab.tab, {
            type: "analyzerData",
            data: tab.analyzerData
        }, {
            frameId: frame.frame
        });
    } else if (msg.type === "analyzerData") {
        if (logging) console.log("Analyzer data", msg.data);
        tab.analyzerData = msg.data;
    } else if (msg.type === "iframe_controls") {
        frame.frame_referer = msg.mode == PlayerModes.IFRAME ? msg.referer : null;
        console.log("Iframe-controls", frame.frame_referer)
    } else if (msg.type === "iframe") {
        frame.url = msg.url;
        if (frame.url.substring(0, playerURL.length) !== playerURL) {
            frame.subtitles.length = 0;
        }

        chrome.tabs.sendMessage(frame.tab.tab, {
            type: "init",
            frameId: frame.frame
        }, {
            frameId: frame.frame
        });

    } else if (msg.type === "ready") {

        if (logging) console.log("Ready")
        frame.ready = true;

        sendSources(frame);
    }

})




function get_url_extension(url) {
    return url.split(/[#?]/)[0].split('.').pop().trim();
}
function handleSubtitles(url, frame, headers) {
    if (frame.subtitles.find((a) => {
        return a.source === url
    })) return;

    if (logging) console.log("Found subtitle", url)
    const u = (new URL(url)).pathname.split("/").pop();

    frame.subtitles.push({
        source: url,
        headers: headers,
        label: u.split('.')[0],
    })
}
function getSourceFromURL(frame, url) {
    return frame.sources.find((a) => {
        return a.url === url
    })
}

function addSource(frame, url, mode, headers) {
    frame.sources.push({
        url, mode, headers
    });
}

function sendSources(frame) {

    let subtitles = [];
    let sources = [];

    let currentFrame = frame;
    while (currentFrame) {
        for (let i = 0; i < currentFrame.subtitles.length; i++) {
            subtitles.push(currentFrame.subtitles[i]);
        }

        for (let i = 0; i < currentFrame.sources.length; i++) {
            sources.push(currentFrame.sources[i]);
        }

        currentFrame.sources.length = 0;
        currentFrame.subtitles.length = 0;

        if (currentFrame.sources.length !== 0) break;
        currentFrame = frame.tab.frames[currentFrame.parent];
    }

    chrome.tabs.sendMessage(frame.tab.tab, {
        type: "sources",
        subtitles: subtitles,
        sources: sources
    }, {
        frameId: frame.frame
    });
}

function getOrCreateFrame(details) {
    if (!tabs[details.tabId]) tabs[details.tabId] = new TabHolder(details.tabId);
    var tab = tabs[details.tabId];

    if (!tab.frames[details.frameId]) tab.addFrame(details.frameId, details.parentFrameId)
    var frame = tab.frames[details.frameId]

    if (details.parentFrameId !== frame.parent) {
        frame.parent = details.parentFrameId;
    }

    return frame;
}
function isSubtitles(ext) {
    return ext == "vtt" || ext == "srt";
}

async function scrapeCaptionsTags(frame) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(frame.tab.tab, {
            type: 'scrape_captions'
        }, {
            frameId: frame.frame
        }, (sub) => {
            resolve(sub);
        });
    })
}

async function getVideoSize(frame) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(frame.tab.tab, {
            type: 'get_video_size'
        }, {
            frameId: frame.frame
        }, (size) => {
            resolve(size);
        });
    });
}

async function openPlayer(frame) {
    return chrome.tabs.sendMessage(frame.tab.tab, {
        type: 'player',
        url: playerURL + "?frame_id=" + frame.frame
    }, {
        frameId: frame.frame
    });
}
let currentTimeout = null;
async function onSourceRecieved(details, frame, mode) {
    const url = details.url;
    if (getSourceFromURL(frame, url)) return;

    addSource(frame, url, mode, frame.requests[details.requestId]);
    await scrapeCaptionsTags(frame).then((sub) => {
        if (sub) {
            sub.forEach((s) => {
                if (frame.subtitles.every((ss, i) => {
                    if (s.source == ss.source) {
                        frame.subtitles[i] = s;
                        return false;
                    }
                    return true;
                })) frame.subtitles.push(s);
            })
        }
    });

    if (frame.tab.isOn) {
        clearTimeout(currentTimeout);
        currentTimeout = setTimeout(() => {
            if (frame.tab.isOn)
                openPlayer(frame);

        }, 2000);
    }

    if (logging) console.log("Found source", details, frame)

    return;
}

async function openPlayersWithSources(tabid) {
    if (!tabs[tabid]) return;
    var tab = tabs[tabid];

    let framesWithSources = [];
    for (var i in tab.frames) {
        var frame = tab.frames[i];
        if (!frame || frameHasPlayer(frame)) continue;
        if (frame.sources.length > 0) {
            framesWithSources.push(frame);
        }
    }

    if (framesWithSources.length > 0) {
        framesWithSources = await Promise.all(framesWithSources.map(async (frame) => {
            return { frame, videoSize: await getVideoSize(frame) };
        }));

        framesWithSources.sort((a, b) => {
            return b.videoSize - a.videoSize;
        });

        for (let i = 0; i < framesWithSources.length; i++) {
            openPlayer(framesWithSources[i].frame);
        }
    }
}
chrome.webRequest.onBeforeSendHeaders.addListener((details) => {
    const frame = getOrCreateFrame(details);
    frame.requests[details.requestId] = details.requestHeaders;
}, {
    urls: ["<all_urls>"]
}, ['requestHeaders', 'extraHeaders']);

function frameHasPlayer(frame) {
    return frame.isFastStream || frame.url.substring(0, playerURL.length) === playerURL
}

chrome.webRequest.onHeadersReceived.addListener(
    function (details) {
        var url = details.url;
        var ext = get_url_extension(url);
        const frame = getOrCreateFrame(details);
        if (frameHasPlayer(frame)) return;

        if (isSubtitles(ext)) {
            return handleSubtitles(url, frame, frame.requests[details.requestId]);
        }
        var mode = PlayerModes.DIRECT;

        if (ext === "m3u8") {
            mode = PlayerModes.ACCELERATED_HLS;
        } else if (ext === "mpd") {
            mode = PlayerModes.ACCELERATED_DASH;
        } else if (details.type === "media") {
            mode = PlayerModes.ACCELERATED_MP4;
        } else {
            return;
        }

        onSourceRecieved(details, frame, mode);

    }, {
    urls: ["<all_urls>"]
}, ["responseHeaders", "extraHeaders"]
);

chrome.webRequest.onHeadersReceived.addListener(deleteHeaderCache, {
    urls: ["<all_urls>"]
})


chrome.webRequest.onErrorOccurred.addListener(deleteHeaderCache, {
    urls: ["<all_urls>"]
});

function deleteHeaderCache(details) {
    const frame = getOrCreateFrame(details);
    const tab = frame.tab;
    delete frame.requests[details.requestId];
}
chrome.tabs.onRemoved.addListener(function (tabid, removed) {

    delete tabs[tabid];
});

chrome.tabs.onUpdated.addListener(function (tabid, changeInfo, tab) {
    if (tabs[tabid]) {

        if (changeInfo.url) {
            const url = new URL(changeInfo.url);
            if (tabs[tabid].hostname && tabs[tabid].hostname !== url.hostname) {
                tabs[tabid].analyzerData = undefined;
            }
            tabs[tabid].hostname = url.hostname
        }
        if (tabs[tabid].isOn) {

            chrome.action.setBadgeText({
                "text": "On",
                "tabId": tabid
            });
            chrome.action.setIcon({
                path: "icon2_128.png",
                tabId: tabid
            });
        }
    }
});

console.log('\n %c %c %cFast%cStream %c-%c ' + version + ' %c By Andrews54757 \n', 'background: url(https://user-images.githubusercontent.com/13282284/57593160-3a4fb080-7508-11e9-9507-33d45c4f9e41.png) no-repeat; background-size: 16px 16px; padding: 2px 6px; margin-right: 4px', 'background: rgb(50,50,50); padding:5px 0;', 'color: rgb(200,200,200); background: rgb(50,50,50); padding:5px 0;', 'color: rgb(200,200,200); background: rgb(50,50,50); padding:5px 0;', 'color: rgb(200,200,200); background: rgb(50,50,50); padding:5px 0;', 'color: #afbc2a; background: rgb(50,50,50); padding:5px 0;', 'color: black; background: #e9e9e9; padding:5px 0;')