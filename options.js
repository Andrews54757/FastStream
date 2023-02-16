var activeEl = document.getElementById("active")
var options = {};
var adult = document.getElementById('adult');
var anime = document.getElementById('anime');
var drama = document.getElementById('drama');
var mouse = document.getElementById('mouse');
var sidebar = document.getElementById('sidebar');
chrome.storage.local.get({
    options: ''
}, (results) => {
    options = JSON.parse(results.options);



})

document.getElementById("welcome").addEventListener("click", () => {
    chrome.runtime.sendMessage({
        type: "welcome"
    })

})


function optionChanged() {
    chrome.storage.local.set({
        options: JSON.stringify(options)
    }, (results) => {
        chrome.runtime.sendMessage({
            type: "options"
        })
    });
}