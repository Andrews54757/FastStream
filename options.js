var activeEl = document.getElementById("active")
var options = {};
var analyzeVideos = document.getElementById('analyzevideos');
var playStreamURLs = document.getElementById('playstreamurls');
var playMP4URLs = document.getElementById('playmp4urls');
var downloadAll = document.getElementById('downloadall');

chrome.storage.local.get({
    options: '{}'
}, (results) => {
    options = JSON.parse(results.options) || {};

    downloadAll.checked = !!options.downloadAll;
    analyzeVideos.checked = !!options.analyzeVideos;
    playStreamURLs.checked = !!options.playStreamURLs;
    playMP4URLs.checked = !!options.playMP4URLs;
})

document.getElementById("welcome").addEventListener("click", () => {
    chrome.runtime.sendMessage({
        type: "welcome"
    })

});


playMP4URLs.addEventListener("change", () => {
    options.playMP4URLs = playMP4URLs.checked;
    optionChanged();
});

playStreamURLs.addEventListener("change", () => {
    options.playStreamURLs = playStreamURLs.checked;
    optionChanged();
});

analyzeVideos.addEventListener("change", () => {
    options.analyzeVideos = analyzeVideos.checked;
    optionChanged();
});

downloadAll.addEventListener("change", () => {
    options.downloadAll = downloadAll.checked;
    optionChanged();
});

function optionChanged() {
    var optstr = JSON.stringify(options);
    chrome.storage.local.set({
        options: optstr
    }, (results) => {
        chrome.runtime.sendMessage({
            type: "options",
            optstr: optstr
        })
    });
}