import {BackgroundUtils} from '../background/BackgroundUtils.mjs';
import {DefaultKeybinds} from '../options/defaults/DefaultKeybinds.mjs';
import {WebUtils} from '../player/utils/WebUtils.mjs';

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
autoEnableURLSInput.placeholder = 'https://example.com/movie/\n~^https:\\/\\/example\\.com\\/(movie|othermovie)\\/';

loadOptions();

async function loadOptions(newOptions) {
  newOptions = newOptions || await BackgroundUtils.getOptionsFromStorage();
  options = JSON.parse(newOptions) || {};

  downloadAll.checked = !!options.downloadAll;
  analyzeVideos.checked = !!options.analyzeVideos;
  playStreamURLs.checked = !!options.playStreamURLs;
  playMP4URLs.checked = !!options.playMP4URLs;
  autosub.checked = !!options.autoEnableBestSubtitles;
  if (options.keybinds) {
    keybindsList.replaceChildren();
    for (const keybind in options.keybinds) {
      if (Object.hasOwn(options.keybinds, keybind)) {
        createKeybindElement(keybind);
      }
    }
  }

  document.querySelectorAll('.video-option').forEach((option) => {
    const numberInput = option.querySelector('input.number');
    const rangeInput = option.querySelector('input.range');
    const unit = option.dataset.unit || '%';
    const unitMultiplier = parseInt(option.dataset.multiplier || 100);
    const optionKey = option.dataset.option;
    const val = Math.round(options[optionKey] * unitMultiplier);
    rangeInput.value = val;
    numberInput.value = val + unit;
  });

  autoEnableURLSInput.value = options.autoEnableURLs.join('\n');
}

function getKeyString(e) {
  const metaPressed = e.metaKey && e.key !== 'Meta';
  const ctrlPressed = e.ctrlKey && e.key !== 'Control';
  const altPressed = e.altKey && e.key !== 'Alt';
  const shiftPressed = e.shiftKey && e.key !== 'Shift';
  const key = e.code;

  return (metaPressed ? 'Meta+' : '') + (ctrlPressed ? 'Control+' : '') + (altPressed ? 'Alt+' : '') + (shiftPressed ? 'Shift+' : '') + key;
}

document.querySelectorAll('.option').forEach((option) => {
  option.addEventListener('click', (e) => {
    if (e.target.tagName !== 'INPUT') {
      const input = option.querySelector('input');
      input.click();
    }
  });

  WebUtils.setupTabIndex(option.querySelector('input'));
});

document.querySelectorAll('.video-option').forEach((option) => {
  const numberInput = option.querySelector('input.number');
  const rangeInput = option.querySelector('input.range');
  const unit = option.dataset.unit || '%';
  const unitMultiplier = parseInt(option.dataset.multiplier || 100);

  const optionKey = option.dataset.option;

  function numberInputChanged() {
    rangeInput.value = parseInt(numberInput.value.replace(unit, '')) || 0;
    options[optionKey] = parseInt(rangeInput.value) / unitMultiplier;
    optionChanged();
  }

  function rangeInputChanged() {
    numberInput.value = rangeInput.value + unit;
    options[optionKey] = parseInt(rangeInput.value) / unitMultiplier;
    optionChanged();
  }

  numberInput.addEventListener('change', numberInputChanged);
  numberInput.addEventListener('input', numberInputChanged);
  rangeInput.addEventListener('change', rangeInputChanged);
  rangeInput.addEventListener('input', rangeInputChanged);
});

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

document.getElementById('welcome').href = chrome.runtime.getURL('welcome.html');

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
  keybindsList.replaceChildren();
  for (const keybind in options.keybinds) {
    if (Object.hasOwn(options.keybinds, keybind)) {
      createKeybindElement(keybind);
    }
  }
  optionChanged();
});

WebUtils.setupTabIndex(document.getElementById('resetdefault'));

autoEnableURLSInput.addEventListener('input', (e) => {
  options.autoEnableURLs = autoEnableURLSInput.value.split('\n').map((o)=>o.trim()).filter((o)=>o.length);
  optionChanged();
});

function optionChanged() {
  chrome.runtime.sendMessage({
    type: 'options',
    options: JSON.stringify(options),
  });
}

// Load options on options event
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'options') {
    loadOptions(request.options);
  }
});
