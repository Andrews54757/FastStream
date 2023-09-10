import {DefaultKeybinds} from '../options/defaults/DefaultKeybinds.mjs';

let options = {};
const analyzeVideos = document.getElementById('analyzevideos');
const playStreamURLs = document.getElementById('playstreamurls');
const playMP4URLs = document.getElementById('playmp4urls');
const downloadAll = document.getElementById('downloadall');
const keybindsList = document.getElementById('keybindslist');
const autoEnableURLSInput = document.getElementById('autoEnableURLs');
const autoSub = document.getElementById('autosub');
autoEnableURLSInput.setAttribute('autocapitalize', 'off');
autoEnableURLSInput.setAttribute('autocomplete', 'off');
autoEnableURLSInput.setAttribute('autocorrect', 'off');
autoEnableURLSInput.setAttribute('spellcheck', false);
autoEnableURLSInput.placeholder = '^https:\\/\\/example\\.com\\/movie\\/';
chrome.storage.local.get({
  options: '{}',
}, (results) => {
  options = JSON.parse(results.options) || {};

  downloadAll.checked = !!options.downloadAll;
  analyzeVideos.checked = !!options.analyzeVideos;
  playStreamURLs.checked = !!options.playStreamURLs;
  playMP4URLs.checked = !!options.playMP4URLs;
  autosub.checked = !!options.autoEnableBestSubtitles;
  if (options.keybinds) {
    keybindsList.innerHTML = '';
    for (const keybind in options.keybinds) {
      createKeybindElement(keybind);
    }
  }

  autoEnableURLSInput.value = options.autoEnableURLs.join('\n');
});

function getKeyString(e) {
  const metaPressed = e.metaKey && e.key !== 'Meta';
  const ctrlPressed = e.ctrlKey && e.key !== 'Control';
  const altPressed = e.altKey && e.key !== 'Alt';
  const shiftPressed = e.shiftKey && e.key !== 'Shift';
  const key = e.code;

  return (metaPressed ? 'Meta+' : '') + (ctrlPressed ? 'Control+' : '') + (altPressed ? 'Alt+' : '') + (shiftPressed ? 'Shift+' : '') + key;
}

function createKeybindElement(keybind) {
  const containerElement = document.createElement('div');
  containerElement.classList.add('keybind-container');

  const keybindNameElement = document.createElement('div');
  keybindNameElement.classList.add('keybind-name');
  keybindNameElement.textContent = keybind;
  containerElement.appendChild(keybindNameElement);

  const keybindInput = document.createElement('div');
  keybindInput.classList.add('keybind-input');
  keybindInput.tabIndex = 0;
  keybindInput.name = keybind;
  keybindInput.textContent = options.keybinds[keybind];

  keybindInput.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      return;
    } else if (e.key === 'Escape') {
      keybindInput.textContent = options.keybinds[keybind] = 'None';
      optionChanged();
      keybindInput.blur();
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    keybindInput.textContent = getKeyString(e);
    options.keybinds[keybind] = keybindInput.textContent;
    optionChanged();
  });

  keybindInput.addEventListener('keyup', (e) => {
    e.stopPropagation();
    e.preventDefault();
  });

  keybindInput.addEventListener('click', (e) => {
    keybindInput.textContent = 'Press a key';
  });

  keybindInput.addEventListener('blur', (e) => {
    keybindInput.textContent = options.keybinds[keybind];
  });

  containerElement.appendChild(keybindInput);

  keybindsList.appendChild(containerElement);
}

document.getElementById('welcome').addEventListener('click', () => {
  chrome.runtime.sendMessage({
    type: 'welcome',
  });
});


playMP4URLs.addEventListener('change', () => {
  options.playMP4URLs = playMP4URLs.checked;
  optionChanged();
});

autosub.addEventListener('change', () => {
  options.autoEnableBestSubtitles = autoSub.checked;
  optionChanged();
});

playStreamURLs.addEventListener('change', () => {
  options.playStreamURLs = playStreamURLs.checked;
  optionChanged();
});

analyzeVideos.addEventListener('change', () => {
  options.analyzeVideos = analyzeVideos.checked;
  optionChanged();
});

downloadAll.addEventListener('change', () => {
  options.downloadAll = downloadAll.checked;
  optionChanged();
});

document.getElementById('resetdefault').addEventListener('click', () => {
  options.keybinds = JSON.parse(JSON.stringify(DefaultKeybinds));
  keybindsList.innerHTML = '';
  for (const keybind in options.keybinds) {
    createKeybindElement(keybind);
  }
  optionChanged();
});

autoEnableURLSInput.addEventListener('input', (e) => {
  options.autoEnableURLs = autoEnableURLSInput.value.split('\n').map((o)=>o.trim()).filter((o)=>o.length);
  optionChanged();
});

function optionChanged() {
  const optstr = JSON.stringify(options);
  chrome.storage.local.set({
    options: optstr,
  }, (results) => {
    chrome.runtime.sendMessage({
      type: 'options',
      optstr: optstr,
    });
  });
}

