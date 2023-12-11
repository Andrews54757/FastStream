import {DefaultKeybinds} from './defaults/DefaultKeybinds.mjs';
import {EnvUtils} from '../utils/EnvUtils.mjs';
import {StringUtils} from '../utils/StringUtils.mjs';
import {Utils} from '../utils/Utils.mjs';
import {WebUtils} from '../utils/WebUtils.mjs';
import {DefaultOptions} from './defaults/DefaultOptions.mjs';

let Options = {};
const analyzeVideos = document.getElementById('analyzevideos');
const playStreamURLs = document.getElementById('playstreamurls');
const playMP4URLs = document.getElementById('playmp4urls');
const downloadAll = document.getElementById('downloadall');
const freeUnusedChannels = document.getElementById('freeunusedchannels');
const keybindsList = document.getElementById('keybindslist');
const autoEnableURLSInput = document.getElementById('autoEnableURLs');
const autoSub = document.getElementById('autosub');
const maxSpeed = document.getElementById('maxspeed');
const seekStepSize = document.getElementById('seekstepsize');
const playbackRate = document.getElementById('playbackrate');
const clickToPause = document.getElementById('clicktopause');
const autoplayYoutube = document.getElementById('autoplayyt');
const qualityMultiplier = document.getElementById('qualitymultiplier');
const importButton = document.getElementById('import');
const exportButton = document.getElementById('export');
autoEnableURLSInput.setAttribute('autocapitalize', 'off');
autoEnableURLSInput.setAttribute('autocomplete', 'off');
autoEnableURLSInput.setAttribute('autocorrect', 'off');
autoEnableURLSInput.setAttribute('spellcheck', false);
autoEnableURLSInput.placeholder = 'https://example.com/movie/\n~^https:\\/\\/example\\.com\\/(movie|othermovie)\\/';

loadOptions();


if (!EnvUtils.isExtension()) {
  analyzeVideos.disabled = true;
  playStreamURLs.disabled = true;
  playMP4URLs.disabled = true;
  autoSub.disabled = true;
  autoEnableURLSInput.disabled = true;
}

async function loadOptions(newOptions) {
  newOptions = newOptions || await Utils.getOptionsFromStorage();
  Options = newOptions;

  downloadAll.checked = !!Options.downloadAll;
  freeUnusedChannels.checked = !!Options.freeUnusedChannels;
  analyzeVideos.checked = !!Options.analyzeVideos;
  playStreamURLs.checked = !!Options.playStreamURLs;
  playMP4URLs.checked = !!Options.playMP4URLs;
  autoSub.checked = !!Options.autoEnableBestSubtitles;
  clickToPause.checked = !!Options.clickToPause;
  autoplayYoutube.checked = !!Options.autoplayYoutube;
  maxSpeed.value = StringUtils.getSpeedString(Options.maxSpeed);
  seekStepSize.value = Math.round(Options.seekStepSize * 100) / 100;
  playbackRate.value = Options.playbackRate;
  qualityMultiplier.value = Options.qualityMultiplier;

  if (Options.keybinds) {
    keybindsList.replaceChildren();
    for (const keybind in Options.keybinds) {
      if (Object.hasOwn(Options.keybinds, keybind)) {
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
    const val = Math.round(Options[optionKey] * unitMultiplier);
    rangeInput.value = val;
    numberInput.value = val + unit;
  });

  autoEnableURLSInput.value = Options.autoEnableURLs.join('\n');
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
    Options[optionKey] = parseInt(rangeInput.value) / unitMultiplier;
    optionChanged();
  }

  function rangeInputChanged() {
    numberInput.value = rangeInput.value + unit;
    Options[optionKey] = parseInt(rangeInput.value) / unitMultiplier;
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
  const keybindName = keybind.replace(/([A-Z])/g, ' $1').trim();
  keybindNameElement.textContent = keybindName;
  containerElement.appendChild(keybindNameElement);

  const keybindInput = document.createElement('div');
  keybindInput.classList.add('keybind-input');
  keybindInput.tabIndex = 0;
  keybindInput.title = keybindName;
  keybindInput.textContent = Options.keybinds[keybind];

  keybindInput.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      return;
    } else if (e.key === 'Escape') {
      keybindInput.textContent = Options.keybinds[keybind] = 'None';
      optionChanged();
      keybindInput.blur();
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    keybindInput.textContent = WebUtils.getKeyString(e);
    Options.keybinds[keybind] = keybindInput.textContent;
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
    keybindInput.textContent = Options.keybinds[keybind];
  });

  containerElement.appendChild(keybindInput);

  keybindsList.appendChild(containerElement);
}

document.getElementById('welcome').href = EnvUtils.isExtension() ? chrome?.runtime?.getURL('welcome.html') : './../welcome.html';

playMP4URLs.addEventListener('change', () => {
  Options.playMP4URLs = playMP4URLs.checked;
  optionChanged();
});

autoSub.addEventListener('change', () => {
  Options.autoEnableBestSubtitles = autoSub.checked;
  optionChanged();
});

playStreamURLs.addEventListener('change', () => {
  Options.playStreamURLs = playStreamURLs.checked;
  optionChanged();
});

analyzeVideos.addEventListener('change', () => {
  Options.analyzeVideos = analyzeVideos.checked;
  optionChanged();
});

downloadAll.addEventListener('change', () => {
  Options.downloadAll = downloadAll.checked;
  optionChanged();
});

freeUnusedChannels.addEventListener('change', () => {
  Options.freeUnusedChannels = freeUnusedChannels.checked;
  optionChanged();
});

autoplayYoutube.addEventListener('change', () => {
  Options.autoplayYoutube = autoplayYoutube.checked;
  optionChanged();
});

clickToPause.addEventListener('change', () => {
  Options.clickToPause = clickToPause.checked;
  optionChanged();
});

maxSpeed.addEventListener('change', () => {
  // parse value, number unit/s
  Options.maxSpeed = StringUtils.getSpeedValue(maxSpeed.value);
  maxSpeed.value = StringUtils.getSpeedString(Options.maxSpeed);
  optionChanged();
});

seekStepSize.addEventListener('change', () => {
  Options.seekStepSize = parseFloat(seekStepSize.value);
  optionChanged();
});

playbackRate.addEventListener('change', () => {
  Options.playbackRate = parseFloat(playbackRate.value) || 1;
  optionChanged();
});

qualityMultiplier.addEventListener('change', () => {
  Options.qualityMultiplier = Math.max(parseFloat(qualityMultiplier.value) || 1, 0.01);
  optionChanged();
});

document.getElementById('resetdefault').addEventListener('click', () => {
  Options.keybinds = JSON.parse(JSON.stringify(DefaultKeybinds));
  keybindsList.replaceChildren();
  for (const keybind in Options.keybinds) {
    if (Object.hasOwn(Options.keybinds, keybind)) {
      createKeybindElement(keybind);
    }
  }
  optionChanged();
});

WebUtils.setupTabIndex(document.getElementById('resetdefault'));

autoEnableURLSInput.addEventListener('input', (e) => {
  Options.autoEnableURLs = autoEnableURLSInput.value.split('\n').map((o)=>o.trim()).filter((o)=>o.length);
  optionChanged();
});

importButton.addEventListener('click', () => {
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.json';
  picker.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const newOptions = Utils.mergeOptions(DefaultOptions, JSON.parse(text));
      loadOptions(newOptions);
      optionChanged();
    };
    reader.readAsText(file);
  });
  document.body.appendChild(picker);
  picker.click();
  picker.remove();
});

exportButton.addEventListener('click', async () => {
  const blob = new Blob([JSON.stringify(Options, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'faststream-options.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

function optionChanged() {
  if (EnvUtils.isExtension()) {
    chrome?.runtime?.sendMessage({
      type: 'options',
      options: JSON.stringify(Options),
    });
  } else {
    const postWindow = window.opener || window.parent || window;
    postWindow.postMessage({
      type: 'options',
      options: JSON.stringify(Options),
    }, '/');
    localStorage.setItem('options', JSON.stringify(Options));
  }
}
if (EnvUtils.isExtension()) {
// Load options on options event
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'options') {
      loadOptions(JSON.parse(request.options));
    }
  });

  const ratebox = document.getElementById('ratebox');
  document.getElementById('rate').addEventListener('click', (e) => {
    chrome?.storage?.local?.set({
      rateus: 'yes',
    });
    ratebox.style.display = 'none';

    let url = 'https://addons.mozilla.org/en-US/firefox/addon/faststream/reviews/';

    // SPLICER:FIREFOX:REMOVE_START
    url = 'https://chromewebstore.google.com/u/1/detail/faststream-video-player/kkeakohpadmbldjaiggikmnldlfkdfog/reviews';
    // SPLICER:FIREFOX:REMOVE_END

    chrome?.tabs?.create({
      url,
    });
  });

  document.getElementById('norate').addEventListener('click', (e) => {
    chrome.storage.local.set({
      rateus: 'no',
    });
    ratebox.style.display = 'none';
  });

  chrome.storage.local.get('rateus', (result) => {
    if (!result || !result.rateus) {
      ratebox.style.display = 'block';
    }
  });
}
