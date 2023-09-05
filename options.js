const default_options = {
    playMP4URLs: false,
    playStreamURLs: true,
    analyzeVideos: true,
    downloadAll: true,
    keybinds: {
        "HidePlayer": "Alt",
        "PlayPause": "Space",
        "Fullscreen": "f",
        "VolumeUp": "ArrowUp",
        "VolumeDown": "ArrowDown",
        "SeekForward": "ArrowRight",
        "SeekBackward": "ArrowLeft",
        "SeekForwardSmall": "Shift+ArrowRight",
        "SeekBackwardSmall": "Shift+ArrowLeft",
        "SeekForwardLarge": ".",
        "SeekBackwardLarge": ",",
        "UndoSeek": "z",
        "ResetFailed": "`",
        "RemoveDownloader": "-",
        "AddDownloader": "=",
        "SkipIntroOutro": "s",
        "GoToStart": "0"
    }
}

var activeEl = document.getElementById("active")
var options = {};
var analyzeVideos = document.getElementById('analyzevideos');
var playStreamURLs = document.getElementById('playstreamurls');
var playMP4URLs = document.getElementById('playmp4urls');
var downloadAll = document.getElementById('downloadall');
var keybindsList = document.getElementById('keybindslist');

chrome.storage.local.get({
    options: '{}'
}, (results) => {
    options = JSON.parse(results.options) || {};

    downloadAll.checked = !!options.downloadAll;
    analyzeVideos.checked = !!options.analyzeVideos;
    playStreamURLs.checked = !!options.playStreamURLs;
    playMP4URLs.checked = !!options.playMP4URLs;
    if (options.keybinds) {
        keybindsList.innerHTML = "";
        for (const keybind in options.keybinds) {
            createKeybindElement(keybind);
        }
    }
})

function getKeyString(e) {
    const metaPressed = e.metaKey && e.key !== "Meta";
    const ctrlPressed = e.ctrlKey && e.key !== "Control";
    const altPressed = e.altKey && e.key !== "Alt";
    const shiftPressed = e.shiftKey && e.key !== "Shift";
    const key = e.code;

    return (metaPressed ? "Meta+" : "") + (ctrlPressed ? "Control+" : "") + (altPressed ? "Alt+" : "") + (shiftPressed ? "Shift+" : "") + key;
}

function createKeybindElement(keybind) {
    const containerElement = document.createElement("div");
    containerElement.classList.add("keybind-container");

    const keybindNameElement = document.createElement("div");
    keybindNameElement.classList.add("keybind-name");
    keybindNameElement.textContent = keybind;
    containerElement.appendChild(keybindNameElement);

    const keybindInput = document.createElement("div");
    keybindInput.classList.add("keybind-input");
    keybindInput.tabIndex = 0;
    keybindInput.textContent = options.keybinds[keybind];

    keybindInput.addEventListener("keydown", (e) => {
        e.stopPropagation();
        e.preventDefault();
        keybindInput.textContent = getKeyString(e);
        options.keybinds[keybind] = keybindInput.textContent;
        optionChanged();
    });

    keybindInput.addEventListener("keyup", (e) => {
        e.stopPropagation();
        e.preventDefault();
    });

    keybindInput.addEventListener("focus", (e) => {
        keybindInput.textContent = "Press a key";
    });

    keybindInput.addEventListener("blur", (e) => {
        keybindInput.textContent = options.keybinds[keybind];
    });

    containerElement.appendChild(keybindInput);

    keybindsList.appendChild(containerElement);
}

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

document.getElementById("resetdefault").addEventListener("click", () => {
    options.keybinds = JSON.parse(JSON.stringify(default_options.keybinds));
    keybindsList.innerHTML = "";
    for (const keybind in options.keybinds) {
        createKeybindElement(keybind);
    }
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
