import {DefaultKeybinds} from './defaults/DefaultKeybinds.mjs';
import {EnvUtils} from '../utils/EnvUtils.mjs';
import {StringUtils} from '../utils/StringUtils.mjs';
import {Utils} from '../utils/Utils.mjs';
import {WebUtils} from '../utils/WebUtils.mjs';
import {DefaultOptions} from './defaults/DefaultOptions.mjs';
import {Localize} from '../modules/Localize.mjs';

import {UpdateChecker} from '../utils/UpdateChecker.mjs'; // SPLICER:NO_UPDATE_CHECKER:REMOVE_LINE
import {ClickActions} from './defaults/ClickActions.mjs';
import {VisChangeActions} from './defaults/VisChangeActions.mjs';
import {MiniplayerPositions} from './defaults/MiniplayerPositions.mjs';
import {DefaultSubtitlesSettings} from './defaults/DefaultSubtitlesSettings.mjs';
import {DaltonizerTypes} from './defaults/DaltonizerTypes.mjs';
import {DefaultToolSettings} from './defaults/ToolSettings.mjs';
import {DefaultQualities} from './defaults/DefaultQualities.mjs';

let Options = {};
const analyzeVideos = document.getElementById('analyzevideos');
const playStreamURLs = document.getElementById('playstreamurls');
const playMP4URLs = document.getElementById('playmp4urls');
const downloadAll = document.getElementById('downloadall');
const keybindsList = document.getElementById('keybindslist');
const autoEnableURLSInput = document.getElementById('autoEnableURLs');
const autoSub = document.getElementById('autosub');
const maxSpeed = document.getElementById('maxspeed');
const maxSize = document.getElementById('maxsize');
const seekStepSize = document.getElementById('seekstepsize');
const autoplayYoutube = document.getElementById('autoplayyt');
const qualityMenu = document.getElementById('quality');
const importButton = document.getElementById('import');
const exportButton = document.getElementById('export');
const clickAction = document.getElementById('clickaction');
const dblclickAction = document.getElementById('dblclickaction');
const tplclickAction = document.getElementById('tplclickaction');
const visChangeAction = document.getElementById('vischangeaction');
const customSourcePatterns = document.getElementById('customSourcePatterns');
const showWhenMiniSelected = document.getElementById('showWhenMiniSelected');
const storeProgress = document.getElementById('storeprogress');
const miniSize = document.getElementById('minisize');
const miniPos = document.getElementById('minipos');
const daltonizerType = document.getElementById('daltonizerType');
const daltonizerStrength = document.getElementById('daltonizerStrength');
const previewEnabled = document.getElementById('previewenabled');
autoEnableURLSInput.setAttribute('autocapitalize', 'off');
autoEnableURLSInput.setAttribute('autocomplete', 'off');
autoEnableURLSInput.setAttribute('autocorrect', 'off');
autoEnableURLSInput.setAttribute('spellcheck', false);
autoEnableURLSInput.placeholder = 'https://example.com/movie/\n~^https:\\/\\/example\\.com\\/(movie|othermovie)\\/';

customSourcePatterns.setAttribute('autocapitalize', 'off');
customSourcePatterns.setAttribute('autocomplete', 'off');
customSourcePatterns.setAttribute('autocorrect', 'off');
customSourcePatterns.setAttribute('spellcheck', false);
customSourcePatterns.placeholder = '# This is a comment. Use the following format.\n[file extension] /[regex]/[flags]';

loadOptions();


if (!EnvUtils.isExtension()) {
  analyzeVideos.disabled = true;
  playStreamURLs.disabled = true;
  playMP4URLs.disabled = true;
  autoSub.disabled = true;
  autoplayYoutube.disabled = true;
  autoEnableURLSInput.disabled = true;
  customSourcePatterns.disabled = true;
  miniSize.disabled = true;
}

if (EnvUtils.isSafari()) {
  daltonizerType.disabled = true;
  daltonizerStrength.disabled = true;
}

async function loadOptions(newOptions) {
  newOptions = newOptions || await Utils.getOptionsFromStorage();
  Options = newOptions;

  downloadAll.checked = !!Options.downloadAll;
  analyzeVideos.checked = !!Options.analyzeVideos;
  playStreamURLs.checked = !!Options.playStreamURLs;
  playMP4URLs.checked = !!Options.playMP4URLs;
  previewEnabled.checked = !!Options.previewEnabled;
  autoSub.checked = !!Options.autoEnableBestSubtitles;
  autoplayYoutube.checked = !!Options.autoplayYoutube;
  maxSpeed.value = StringUtils.getSpeedString(Options.maxSpeed, true);
  maxSize.value = StringUtils.getSizeString(Options.maxVideoSize);
  seekStepSize.value = Math.round(Options.seekStepSize * 100) / 100;
  customSourcePatterns.value = Options.customSourcePatterns || '';
  miniSize.value = Options.miniSize;
  storeProgress.checked = !!Options.storeProgress;

  setSelectMenuValue(daltonizerType, Options.videoDaltonizerType);
  setSelectMenuValue(clickAction, Options.singleClickAction);
  setSelectMenuValue(dblclickAction, Options.doubleClickAction);
  setSelectMenuValue(tplclickAction, Options.tripleClickAction);
  setSelectMenuValue(visChangeAction, Options.visChangeAction);
  setSelectMenuValue(miniPos, Options.miniPos);
  setSelectMenuValue(qualityMenu, Options.defaultQuality);

  if (Options.visChangeAction === VisChangeActions.MINI_PLAYER) {
    showWhenMiniSelected.style.display = '';
  } else {
    showWhenMiniSelected.style.display = 'none';
  }

  if (Options.videoDaltonizerType === DaltonizerTypes.NONE) {
    daltonizerStrength.style.display = 'none';
  } else {
    daltonizerStrength.style.display = '';
  }

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

function createSelectMenu(container, options, selected, localPrefix, callback) {
  container.replaceChildren();
  const select = document.createElement('select');
  for (const option of options) {
    const optionElement = document.createElement('option');
    optionElement.value = option;
    optionElement.textContent = localPrefix !== null ? Localize.getMessage(localPrefix + '_' + option) : option;
    if (option === selected) {
      optionElement.selected = true;
    }
    select.appendChild(optionElement);
  }
  select.addEventListener('change', callback);
  container.appendChild(select);
}

function setSelectMenuValue(container, value) {
  const select = container.querySelector('select');
  if (!select) {
    return;
  }
  select.value = value;
}

createSelectMenu(daltonizerType, Object.values(DaltonizerTypes), Options.videoDaltonizerType, 'options_video_daltonizer', (e) => {
  Options.videoDaltonizerType = e.target.value;
  if (Options.videoDaltonizerType === DaltonizerTypes.NONE) {
    daltonizerStrength.style.display = 'none';
  } else {
    daltonizerStrength.style.display = '';
  }
  optionChanged();
});

createSelectMenu(clickAction, Object.values(ClickActions), Options.singleClickAction, 'options_general_clickaction', (e) => {
  Options.singleClickAction = e.target.value;
  optionChanged();
});

createSelectMenu(dblclickAction, Object.values(ClickActions), Options.doubleClickAction, 'options_general_clickaction', (e) => {
  Options.doubleClickAction = e.target.value;
  optionChanged();
});

createSelectMenu(tplclickAction, Object.values(ClickActions), Options.tripleClickAction, 'options_general_clickaction', (e) => {
  Options.tripleClickAction = e.target.value;
  optionChanged();
});

createSelectMenu(visChangeAction, Object.values(VisChangeActions), Options.visChangeAction, 'options_general_vischangeaction', (e) => {
  Options.visChangeAction = e.target.value;
  if (Options.visChangeAction === VisChangeActions.MINI_PLAYER) {
    showWhenMiniSelected.style.display = '';
  } else {
    showWhenMiniSelected.style.display = 'none';
  }
  optionChanged();
});

createSelectMenu(miniPos, Object.values(MiniplayerPositions), Options.miniPos, 'options_general_minipos', (e) => {
  Options.miniPos = e.target.value;
  optionChanged();
});

createSelectMenu(qualityMenu, Object.values(DefaultQualities), Options.defaultQuality, null, (e) => {
  Options.defaultQuality = e.target.value;
  optionChanged();
});

document.querySelectorAll('.option').forEach((option) => {
  option.addEventListener('click', (e) => {
    if (e.target.tagName !== 'INPUT') {
      const input = option.querySelector('input');
      if (input) {
        if (input.type === 'checkbox') {
          input.click();
        } else {
          input.focus();
        }
      } else {
        const select = option.querySelector('select');
        if (select) {
          select.focus();
        }
      }
    }
  });

  const input = option.querySelector('input');
  if (input) {
    WebUtils.setupTabIndex(input);
  }
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

previewEnabled.addEventListener('change', () => {
  Options.previewEnabled = previewEnabled.checked;
  optionChanged();
});

storeProgress.addEventListener('change', () => {
  Options.storeProgress = storeProgress.checked;
  optionChanged();
});

autoplayYoutube.addEventListener('change', () => {
  Options.autoplayYoutube = autoplayYoutube.checked;
  optionChanged();
});

maxSpeed.addEventListener('change', () => {
  // parse value, number unit/s
  Options.maxSpeed = StringUtils.getSpeedValue(maxSpeed.value);
  maxSpeed.value = StringUtils.getSpeedString(Options.maxSpeed, true);
  optionChanged();
});

maxSize.addEventListener('change', () => {
  // parse value, number unit
  Options.maxVideoSize = StringUtils.getSizeValue(maxSize.value);
  maxSize.value = StringUtils.getSizeString(Options.maxVideoSize);
  optionChanged();
});

seekStepSize.addEventListener('change', () => {
  Options.seekStepSize = parseFloat(seekStepSize.value);
  optionChanged();
});

miniSize.addEventListener('change', () => {
  Options.miniSize = Math.min(Math.max(parseFloat(miniSize.value) || 0.25, 0.01), 1);
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

customSourcePatterns.addEventListener('input', (e) => {
  Options.customSourcePatterns = customSourcePatterns.value;
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
      const newOptionsObj = JSON.parse(text);
      const newOptions = Utils.mergeOptions(DefaultOptions, newOptionsObj);
      const subtitlesSettings = Utils.mergeOptions(DefaultSubtitlesSettings, newOptionsObj.subtitlesSettings || {});
      const toolSettings = Utils.mergeOptions(DefaultToolSettings, newOptionsObj.toolSettings || {});
      loadOptions(newOptions);
      optionChanged();

      Utils.setConfig('subtitlesSettings', JSON.stringify(subtitlesSettings));
      Utils.setConfig('toolSettings', JSON.stringify(toolSettings));
    };
    reader.readAsText(file);
  });
  document.body.appendChild(picker);
  picker.click();
  picker.remove();
});

exportButton.addEventListener('click', async () => {
  const blob = new Blob([JSON.stringify({
    ...(await Utils.getOptionsFromStorage()),
    subtitlesSettings: await Utils.getSubtitlesSettingsFromStorage(),
    toolSettings: await Utils.loadAndParseOptions('toolSettings', DefaultToolSettings),
  }, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'faststream-options.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

let optionSendTime = null;
function optionChanged() {
  if (EnvUtils.isExtension()) {
    chrome.storage.local.set({
      options: JSON.stringify(Options),
    }, ()=>{
      optionSendTime = Date.now();
      chrome.runtime.sendMessage({
        type: 'options_init',
        time: optionSendTime,
      });
    });
  } else {
    localStorage.setItem('options', JSON.stringify(Options));
    const postWindow = window.opener || window.parent || window;
    postWindow.postMessage({
      type: 'options',
    }, '/');
  }
}

const versionDiv = document.getElementById('version');
versionDiv.textContent = `FastStream v${EnvUtils.getVersion()}`;

if (EnvUtils.isExtension()) {
  // Load options on options event
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'options' || request.type === 'options_init') {
      if (request.time !== optionSendTime) {
        optionSendTime = request.time;
        loadOptions();
      }
    }
  });

  // Load options on visibility change
  const o = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      loadOptions();
    }
  });

  o.observe(document.body);

  const ratebox = document.getElementById('ratebox');
  document.getElementById('rate').addEventListener('click', (e) => {
    chrome?.storage?.local?.set({
      rateus: 'yes',
    });
    ratebox.style.display = 'none';

    let url;

    if (EnvUtils.isChrome()) {
      url = 'https://chromewebstore.google.com/u/1/detail/faststream-video-player/kkeakohpadmbldjaiggikmnldlfkdfog/reviews';
    } else {
      url = 'https://addons.mozilla.org/en-US/firefox/addon/faststream/reviews/';
    }

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

  // SPLICER:NO_UPDATE_CHECKER:REMOVE_START
  const updatebox = document.getElementById('updatebox');
  const updatetext = document.getElementById('updatetext');

  chrome.storage.local.get({
    updateData: '{}',
  }, async (result) => {
    const data = result?.updateData ? JSON.parse(result.updateData) : {};
    const now = Date.now();
    if (!data.latestVersion || now - data.lastUpdateCheck > 1000 * 60 * 60 * 12) {
      data.latestVersion = await UpdateChecker.getLatestVersion();
      data.lastUpdateCheck = now;
    }

    chrome.storage.local.set({
      updateData: JSON.stringify(data),
    });

    const currentVersion = EnvUtils.getVersion();
    const latestVersion = data.latestVersion;
    const ignoreVersion = data.ignoreVersion;
    if (latestVersion && UpdateChecker.compareVersions(currentVersion, latestVersion) && latestVersion !== ignoreVersion) {
      updatetext.textContent = Localize.getMessage('options_update_body', [latestVersion, currentVersion]);
      updatebox.style.display = 'block';
    }
  });

  document.getElementById('update').addEventListener('click', (e) => {
    chrome.tabs.create({
      url: 'https://github.com/Andrews54757/FastStream',
    });
  });

  document.getElementById('noupdate').addEventListener('click', (e) => {
    updatebox.style.display = 'none';
    chrome.storage.local.get('updateData', (result) => {
      const data = result?.updateData ? JSON.parse(result.updateData) : {};
      data.ignoreVersion = data.latestVersion;
      chrome.storage.local.set({
        updateData: JSON.stringify(data),
      });
    });
  });
  // SPLICER:NO_UPDATE_CHECKER:REMOVE_END
}

// Utils.printWelcome(EnvUtils.getVersion());
