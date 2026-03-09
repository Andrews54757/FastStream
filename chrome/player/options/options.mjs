import {DefaultKeybinds} from './defaults/DefaultKeybinds.mjs';
import {EnvUtils} from '../utils/EnvUtils.mjs';
import {StringUtils} from '../utils/StringUtils.mjs';
import {Utils} from '../utils/Utils.mjs';
import {WebUtils} from '../utils/WebUtils.mjs';
import {DefaultOptions} from './defaults/DefaultOptions.mjs';
import {Localize} from '../modules/Localize.mjs';
import {OptionsStore} from './OptionsStore.mjs';
import {resetSearch, searchWithQuery, initsearch} from '../utils/SearchUtils.mjs';
import {MessageTypes} from '../enums/MessageTypes.mjs';

import {UpdateChecker} from '../utils/UpdateChecker.mjs'; // SPLICER:NO_UPDATE_CHECKER:REMOVE_LINE
import {ClickActions} from './defaults/ClickActions.mjs';
import {VisChangeActions} from './defaults/VisChangeActions.mjs';
import {MiniplayerPositions} from './defaults/MiniplayerPositions.mjs';
import {DefaultSubtitlesSettings} from './defaults/DefaultSubtitlesSettings.mjs';
import {DaltonizerTypes} from './defaults/DaltonizerTypes.mjs';
import {DefaultToolSettings} from './defaults/ToolSettings.mjs';
import {DefaultQualities} from './defaults/DefaultQualities.mjs';
import {ColorThemes} from './defaults/ColorThemes.mjs';

let Options = {};
let keybindsCollapsed = null;
let keybindsCollapseUIReady = false;
let toolbarCollapsed = null;
let toolbarCollapseUIReady = false;
let videoCollapsed = null;
let videoCollapseUIReady = false;
let generalCollapsed = null;
let generalCollapseUIReady = false;

function cloneDefaultValue(value) {
  if (value && typeof value === 'object') {
    return JSON.parse(JSON.stringify(value));
  }
  return value;
}

function resetOptionsKeysToDefault(keys) {
  for (const key of keys) {
    Options[key] = cloneDefaultValue(DefaultOptions[key]);
  }
  loadOptions(Options);
  optionChanged();
}

function getKeybindsCollapseEls() {
  const section = document.querySelector('.options-section[data-search-section="keybinds"]');
  const toggle = section?.querySelector?.('.keybinds-toggle');
  const content = document.getElementById('keybindsContent');
  return {section, toggle, content};
}

function ensureKeybindsCollapseUI() {
  if (!EnvUtils.isMobile()) return;
  if (keybindsCollapseUIReady) return;

  const {section, toggle, content} = getKeybindsCollapseEls();
  if (!section || !toggle || !content) return;

  keybindsCollapseUIReady = true;
  if (keybindsCollapsed === null) keybindsCollapsed = true;

  toggle.addEventListener('click', () => {
    keybindsCollapsed = !keybindsCollapsed;
    applyKeybindsCollapsedState();
  });

  // Default to collapsed on mobile as soon as the UI exists.
  applyKeybindsCollapsedState();
}

function applyKeybindsCollapsedState() {
  if (!EnvUtils.isMobile()) return;
  ensureKeybindsCollapseUI();
  const {section, toggle} = getKeybindsCollapseEls();
  if (!section || !toggle) return;

  const shouldCollapse = !!keybindsCollapsed && !document.body.classList.contains('search-active');
  section.classList.toggle('collapsed', shouldCollapse);
  toggle.setAttribute('aria-expanded', String(!shouldCollapse));
  toggle.textContent = shouldCollapse ? 'Show' : 'Hide';
}

function expandKeybindsForSearchInit() {
  if (!EnvUtils.isMobile()) return;
  ensureKeybindsCollapseUI();
  const {section} = getKeybindsCollapseEls();
  if (!section) return;
  section.classList.remove('collapsed');
}

function getToolbarCollapseEls() {
  const section = document.querySelector('.options-section[data-search-section="toolbar"]');
  const toggle = section?.querySelector?.('.toolbar-toggle');
  const content = document.getElementById('toolbarContent');
  return {section, toggle, content};
}

function ensureToolbarCollapseUI() {
  if (!EnvUtils.isMobile()) return;
  if (toolbarCollapseUIReady) return;

  const {section, toggle, content} = getToolbarCollapseEls();
  if (!section || !toggle || !content) return;

  toolbarCollapseUIReady = true;
  if (toolbarCollapsed === null) toolbarCollapsed = true;

  toggle.addEventListener('click', () => {
    toolbarCollapsed = !toolbarCollapsed;
    applyToolbarCollapsedState();
  });

  // Default to collapsed on mobile as soon as the UI exists.
  applyToolbarCollapsedState();
}

function applyToolbarCollapsedState() {
  if (!EnvUtils.isMobile()) return;
  ensureToolbarCollapseUI();
  const {section, toggle} = getToolbarCollapseEls();
  if (!section || !toggle) return;

  const shouldCollapse = !!toolbarCollapsed && !document.body.classList.contains('search-active');
  section.classList.toggle('collapsed', shouldCollapse);
  toggle.setAttribute('aria-expanded', String(!shouldCollapse));
  toggle.textContent = shouldCollapse ? 'Show' : 'Hide';
}

function expandToolbarForSearchInit() {
  if (!EnvUtils.isMobile()) return;
  ensureToolbarCollapseUI();
  const {section} = getToolbarCollapseEls();
  if (!section) return;
  section.classList.remove('collapsed');
}

function getVideoCollapseEls() {
  const section = document.querySelector('.options-section[data-search-section="video"]');
  const toggle = section?.querySelector?.('.video-toggle');
  const content = document.getElementById('videoContent');
  return {section, toggle, content};
}

function ensureVideoCollapseUI() {
  if (!EnvUtils.isMobile()) return;
  if (videoCollapseUIReady) return;

  const {section, toggle, content} = getVideoCollapseEls();
  if (!section || !toggle || !content) return;

  videoCollapseUIReady = true;
  if (videoCollapsed === null) videoCollapsed = true;

  toggle.addEventListener('click', () => {
    videoCollapsed = !videoCollapsed;
    applyVideoCollapsedState();
  });

  // Default to collapsed on mobile as soon as the UI exists.
  applyVideoCollapsedState();
}

function applyVideoCollapsedState() {
  if (!EnvUtils.isMobile()) return;
  ensureVideoCollapseUI();
  const {section, toggle} = getVideoCollapseEls();
  if (!section || !toggle) return;

  const shouldCollapse = !!videoCollapsed && !document.body.classList.contains('search-active');
  section.classList.toggle('collapsed', shouldCollapse);
  toggle.setAttribute('aria-expanded', String(!shouldCollapse));
  toggle.textContent = shouldCollapse ? 'Show' : 'Hide';
}

function expandVideoForSearchInit() {
  if (!EnvUtils.isMobile()) return;
  ensureVideoCollapseUI();
  const {section} = getVideoCollapseEls();
  if (!section) return;
  section.classList.remove('collapsed');
}

function getGeneralCollapseEls() {
  const section = document.querySelector('.options-section[data-search-section="general"]');
  const toggle = section?.querySelector?.('.general-toggle');
  const content = document.getElementById('generalContent');
  return {section, toggle, content};
}

function ensureGeneralCollapseUI() {
  if (!EnvUtils.isMobile()) return;
  if (generalCollapseUIReady) return;

  const {section, toggle, content} = getGeneralCollapseEls();
  if (!section || !toggle || !content) return;

  generalCollapseUIReady = true;
  if (generalCollapsed === null) generalCollapsed = true;

  toggle.addEventListener('click', () => {
    generalCollapsed = !generalCollapsed;
    applyGeneralCollapsedState();
  });

  // Default to collapsed on mobile as soon as the UI exists.
  applyGeneralCollapsedState();
}

function applyGeneralCollapsedState() {
  if (!EnvUtils.isMobile()) return;
  ensureGeneralCollapseUI();
  const {section, toggle} = getGeneralCollapseEls();
  if (!section || !toggle) return;

  const shouldCollapse = !!generalCollapsed && !document.body.classList.contains('search-active');
  section.classList.toggle('collapsed', shouldCollapse);
  toggle.setAttribute('aria-expanded', String(!shouldCollapse));
  toggle.textContent = shouldCollapse ? 'Show' : 'Hide';
}

function expandGeneralForSearchInit() {
  if (!EnvUtils.isMobile()) return;
  ensureGeneralCollapseUI();
  const {section} = getGeneralCollapseEls();
  if (!section) return;
  section.classList.remove('collapsed');
}
const analyzeVideos = document.getElementById('analyzevideos');
const playStreamURLs = document.getElementById('playstreamurls');
const playMP4URLs = document.getElementById('playmp4urls');
const downloadAll = document.getElementById('downloadall');
const keybindsList = document.getElementById('keybindslist');
const autoEnableURLSInput = document.getElementById('autoEnableURLs');
const applyToAllWebsites = document.getElementById('applytoallwebsites');
const autoSub = document.getElementById('autosub');
const maxSpeed = document.getElementById('maxspeed');
const maxSize = document.getElementById('maxsize');
const seekStepSize = document.getElementById('seekstepsize');
const autoplayYoutube = document.getElementById('autoplayyt');
const autoplayNext = document.getElementById('autoplaynext');
const qualityMenu = document.getElementById('quality');
const importButton = document.getElementById('import');
const exportButton = document.getElementById('export');
const videoResetButton = document.getElementById('videoreset');
const generalResetButton = document.getElementById('generalreset');
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
const copyTimestampURL = document.getElementById('copytimestampurl');
const replaceDelay = document.getElementById('replacedelay');
const controlsHideDelay = document.getElementById('controlshidedelay');
const colorTheme = document.getElementById('colortheme');
const ytPlayerID = document.getElementById('ytplayerid');
const optionsSearchBar = document.getElementById('searchbar');
const optionsResetButton = document.getElementById('resetsearch');
const toolbarButtonsContainer = document.getElementById('toolbarButtons');
const toolbarResetButton = document.getElementById('toolbarreset');
// const ytclient = document.getElementById('ytclient');
const maxdownloaders = document.getElementById('maxdownloaders');
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

// Initialize store and then load page controls
OptionsStore.init().then(async () => {
  loadOptions(OptionsStore.get());
  await refreshToolbarButtonsUI();
});


if (!EnvUtils.isExtension()) {
  analyzeVideos.disabled = true;
  playStreamURLs.disabled = true;
  playMP4URLs.disabled = true;
  autoSub.disabled = true;
  autoplayYoutube.disabled = true;
  autoEnableURLSInput.disabled = true;
  applyToAllWebsites.disabled = true;
  customSourcePatterns.disabled = true;
  miniSize.disabled = true;
  // ytclient.disabled = true;
  autoplayNext.disabled = true;
}

if (EnvUtils.isSafari()) {
  daltonizerType.disabled = true;
  daltonizerStrength.disabled = true;
}

async function loadOptions(newOptions) {
  newOptions = newOptions || OptionsStore.get();
  Options = newOptions;

  ensureVideoCollapseUI();
  ensureGeneralCollapseUI();
  ensureKeybindsCollapseUI();

  downloadAll.checked = !!Options.downloadAll;
  analyzeVideos.checked = !!Options.analyzeVideos;
  playStreamURLs.checked = !!Options.playStreamURLs;
  playMP4URLs.checked = !!Options.playMP4URLs;
  previewEnabled.checked = !!Options.previewEnabled;
  copyTimestampURL.checked = Options.copyTimestampURL !== false;
  autoSub.checked = !!Options.autoEnableBestSubtitles;
  autoplayYoutube.checked = !!Options.autoplayYoutube;
  autoplayNext.checked = !!Options.autoplayNext;
  applyToAllWebsites.checked = !!Options.applyToAllWebsites;
  maxSpeed.value = StringUtils.getSpeedString(Options.maxSpeed, true);
  maxSize.value = StringUtils.getSizeString(Options.maxVideoSize);
  seekStepSize.value = Math.round(Options.seekStepSize * 100) / 100;
  customSourcePatterns.value = Options.customSourcePatterns || '';
  miniSize.value = Options.miniSize;
  storeProgress.checked = !!Options.storeProgress;
  replaceDelay.value = Options.replaceDelay;
  controlsHideDelay.value = Number.isFinite(Options.controlsHideDelay) ? Options.controlsHideDelay : DefaultOptions.controlsHideDelay;
  maxdownloaders.value = Options.maximumDownloaders;
  ytPlayerID.value = Options.youtubePlayerID;

  setSelectMenuValue(daltonizerType, Options.videoDaltonizerType);
  setSelectMenuValue(clickAction, Options.singleClickAction);
  setSelectMenuValue(dblclickAction, Options.doubleClickAction);
  setSelectMenuValue(tplclickAction, Options.tripleClickAction);
  setSelectMenuValue(visChangeAction, Options.visChangeAction);
  setSelectMenuValue(colorTheme, Options.colorTheme);
  setSelectMenuValue(miniPos, Options.miniPos);
  setSelectMenuValue(qualityMenu, Options.defaultQuality);
  // setSelectMenuValue(ytclient, Options.defaultYoutubeClient);

  document.body.dataset.theme = Options.colorTheme;

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

  if (Options.dev) {
    document.getElementById('dev').style.display = '';
  }

  // Make sure keybind items are visible during search indexing.
  expandVideoForSearchInit();
  expandGeneralForSearchInit();
  expandKeybindsForSearchInit();
  expandToolbarForSearchInit();
  initsearch();
  applyVideoCollapsedState();
  applyGeneralCollapsedState();
  applyKeybindsCollapsedState();
  applyToolbarCollapsedState();
}

const TOOLBAR_TOOL_LABEL_KEYS = {
  playpause: 'options_general_clickaction_playpause',
  previous: 'player_previous_video_label',
  next: 'player_next_video_label',
  volume: 'player_volume_label',
  duration: 'player_timestamp_label',
  sources: 'player_sourcesbrowser_open_label',
  audioconfig: 'player_audioconfig_open_label',
  subtitles: 'player_subtitlesmenu_open_label',
  languages: 'player_languagemenu_label',
  quality: 'player_qualitymenu_label',
  playrate: 'player_playbackrate_label',
  more: 'player_more_label',
  download: 'player_savevideo_label',
  screenshot: 'player_screenshot_label',
  fullscreen: 'player_fullscreen_label',
  loop: 'player_loop_label',
  pip: 'player_pip_label',
  windowedfs: 'player_windowed_fullscreen_label',
  rotate: 'player_rotate_label',
  forward: 'player_skip_forward_label',
  backward: 'player_skip_backward_label',
};

const TOOLBAR_TOOL_ICON_HREFS = {
  playpause: '../assets/fluidplayer/static/icons.svg#play',
  previous: '../assets/fluidplayer/static/icons.svg#previous',
  next: '../assets/fluidplayer/static/icons.svg#next',
  volume: '../assets/fluidplayer/static/icons.svg#speaker',
  duration: '../assets/fluidplayer/static/icons.svg#timer',
  sources: '../assets/fluidplayer/static/icons.svg#link',
  audioconfig: '../assets/fluidplayer/static/icons.svg#soundwave',
  subtitles: '../assets/fluidplayer/static/icons.svg#captions',
  languages: '../assets/fluidplayer/static/icons.svg#language',
  quality: '../assets/fluidplayer/static/icons2.svg#quality-hd',
  playrate: '../assets/fluidplayer/static/icons.svg#timer',
  settings: '../assets/fluidplayer/static/icons.svg#gear',
  download: '../assets/fluidplayer/static/icons.svg#download',
  screenshot: '../assets/fluidplayer/static/icons.svg#photo',
  pip: '../assets/fluidplayer/static/icons.svg#pip',
  more: '../assets/fluidplayer/static/icons2.svg#more',
  loop: '../assets/fluidplayer/static/icons2.svg#loop',
  fullscreen: '../assets/fluidplayer/static/icons.svg#fullscreen',
  windowedfs: '../assets/fluidplayer/static/icons2.svg#windowed-fs',
  rotate: '../assets/fluidplayer/static/icons2.svg#rotate',
  forward: '../assets/fluidplayer/static/icons2.svg#skip-forward',
  backward: '../assets/fluidplayer/static/icons2.svg#skip-backward',
};

const REQUIRED_TOOLBAR_TOOLS = new Set(['settings']);

let ToolbarToolSettings = null;

function broadcastOptionsReload() {
  if (EnvUtils.isExtension()) {
    chrome.runtime?.sendMessage?.({
      type: MessageTypes.LOAD_OPTIONS,
      time: Date.now(),
    });
  } else {
    const postWindow = window.opener || window.parent || window;
    postWindow.postMessage({type: 'options'}, '/');
  }
}

async function loadToolbarToolSettings() {
  ToolbarToolSettings = await Utils.loadAndParseOptions('toolSettings', DefaultToolSettings);
  return ToolbarToolSettings;
}

async function persistToolbarToolSettings(settings) {
  await Utils.setConfig('toolSettings', JSON.stringify(settings));
  broadcastOptionsReload();
}

function renderToolbarButtons(settings) {
  if (!toolbarButtonsContainer) return;

  toolbarButtonsContainer.replaceChildren();

  const mergedToolSettings = {};
  for (const tool of Object.keys(DefaultToolSettings)) {
    mergedToolSettings[tool] = Utils.mergeOptions(DefaultToolSettings[tool], settings?.[tool] || {});
  }

  const locationOrder = {
    left: 0,
    right: 1,
    extra: 2,
  };

  // Match the actual toolbar's left-to-right presentation:
  // left container (ascending priority), then right container (ascending priority),
  // then extra tools (shown behind "More") (ascending priority).
  const tools = Object.keys(DefaultToolSettings)
      .filter((tool) => !REQUIRED_TOOLBAR_TOOLS.has(tool))
      .sort((a, b) => {
        const sa = mergedToolSettings[a] || DefaultToolSettings[a] || {};
        const sb = mergedToolSettings[b] || DefaultToolSettings[b] || {};
        const la = locationOrder[sa.location] ?? 99;
        const lb = locationOrder[sb.location] ?? 99;
        if (la !== lb) return la - lb;

        const pa = sa.priority ?? 0;
        const pb = sb.priority ?? 0;
        if (pa !== pb) return pa - pb;

        return a.localeCompare(b);
      });

  for (const tool of tools) {
    const row = document.createElement('div');
    row.className = 'option toolbar-tool-row search-target-remove grid1';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.tool = tool;
    checkbox.id = `tool_visible_${tool}`;
    checkbox.setAttribute('aria-label', tool);

    const visible = settings?.[tool]?.visible !== false;
    checkbox.checked = !!visible;

    const iconHref = TOOLBAR_TOOL_ICON_HREFS[tool];
    let icon = null;
    if (iconHref) {
      icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.classList.add('toolbar-tool-icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.setAttribute('focusable', 'false');

      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', iconHref);
      use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', iconHref);
      icon.appendChild(use);
    }

    const label = document.createElement('div');
    label.className = 'label search-target-text';
    const labelKey = TOOLBAR_TOOL_LABEL_KEYS[tool];
    label.textContent = labelKey ? Localize.getMessage(labelKey) : tool;

    checkbox.addEventListener('change', async () => {
      const current = ToolbarToolSettings || await loadToolbarToolSettings();
      if (!current[tool]) current[tool] = Utils.mergeOptions(DefaultToolSettings[tool], {});
      current[tool].visible = checkbox.checked;
      await persistToolbarToolSettings(current);
    });

    row.appendChild(checkbox);
    if (icon) row.appendChild(icon);
    row.appendChild(label);
    toolbarButtonsContainer.appendChild(row);
  }
}

async function refreshToolbarButtonsUI() {
  if (!toolbarButtonsContainer) return;
  const settings = await loadToolbarToolSettings();
  renderToolbarButtons(settings);
}

if (toolbarResetButton) {
  toolbarResetButton.addEventListener('click', async () => {
    const defaults = Utils.mergeOptions(DefaultToolSettings, {});
    // Make sure required tools can't be reset into a hidden state.
    for (const tool of REQUIRED_TOOLBAR_TOOLS) {
      if (defaults?.[tool]) defaults[tool].visible = true;
    }
    ToolbarToolSettings = defaults;
    await persistToolbarToolSettings(defaults);
    await refreshToolbarButtonsUI();
  });
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

createSelectMenu(colorTheme, Object.values(ColorThemes), Options.colorTheme, 'options_general_color_theme', (e) => {
  Options.colorTheme = e.target.value;
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

// createSelectMenu(ytclient, Object.values(YoutubeClients), Options.defaultYoutubeClient, null, (e) => {
//   Options.defaultYoutubeClient = e.target.value;
//   optionChanged();
// });

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
    const value = parseInt(numberInput.value.replace(unit, '')) || 0;
    rangeInput.value = value;
    Options[optionKey] = (option.dataset.nolimits ? value : parseInt(rangeInput.value)) / unitMultiplier;
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
  rangeInput.addEventListener('dblclick', (e) => {
    Options[optionKey] = DefaultOptions[optionKey];
    rangeInput.value = Math.round(Options[optionKey] * unitMultiplier);
    numberInput.value = rangeInput.value + unit;
    optionChanged();
  });
});

function createKeybindElement(keybind) {
  const containerElement = document.createElement('div');
  containerElement.classList.add('keybind-container');
  containerElement.classList.add('search-target-remove-keybind');

  const keybindNameElement = document.createElement('div');
  keybindNameElement.classList.add('keybind-name');
  keybindNameElement.classList.add('search-target-keybind');
  const keybindName = keybind.replace(/([A-Z])/g, ' $1').trim();
  keybindNameElement.textContent = keybindName;
  containerElement.appendChild(keybindNameElement);

  const keybindInput = document.createElement('div');
  keybindInput.classList.add('keybind-input');
  keybindInput.classList.add('search-target-keybind');
  keybindInput.tabIndex = 0;
  keybindInput.title = keybindName;
  keybindInput.role = 'button';
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

copyTimestampURL.addEventListener('change', () => {
  Options.copyTimestampURL = copyTimestampURL.checked;
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

autoplayNext.addEventListener('change', () => {
  Options.autoplayNext = autoplayNext.checked;
  sessionStorage.removeItem('autoplayNext');
  optionChanged();
});

ytPlayerID.addEventListener('change', () => {
  Options.youtubePlayerID = ytPlayerID.value.trim();
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

replaceDelay.addEventListener('change', () => {
  Options.replaceDelay = parseInt(replaceDelay.value);
  optionChanged();
});

controlsHideDelay.addEventListener('change', () => {
  const value = parseInt(controlsHideDelay.value);
  Options.controlsHideDelay = Number.isFinite(value) ? value : DefaultOptions.controlsHideDelay;
  controlsHideDelay.value = Options.controlsHideDelay;
  optionChanged();
});

miniSize.addEventListener('change', () => {
  Options.miniSize = Math.min(Math.max(parseFloat(miniSize.value) || 0.25, 0.01), 1);
  optionChanged();
});

maxdownloaders.addEventListener('change', () => {
  Options.maximumDownloaders = parseInt(maxdownloaders.value) || 0;
  optionChanged();
});

optionsSearchBar.placeholder = Localize.getMessage('options_search_placeholder');


optionsSearchBar.addEventListener('keyup', () => {
  if (optionsSearchBar.value == '') {
    console.log('Reset search called from searchbar keyup');
    resetSearch();
  } else {
    const searchVal = optionsSearchBar.value;
    console.log(searchWithQuery(searchVal));
  }
});

optionsSearchBar.addEventListener('keydown', () => {
  if (optionsSearchBar.value == '') {
    console.log('Reset search called from searchbar keydown');
    resetSearch();
  } else {
    const searchVal = optionsSearchBar.value;
    console.log(searchWithQuery(searchVal));
  }
});

optionsResetButton.addEventListener('click', () => {
  optionsSearchBar.value = '';
  resetSearch();
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

autoEnableURLSInput.addEventListener('change', (e) => {
  Options.autoEnableURLs = autoEnableURLSInput.value.split('\n').map((o)=>o.trim()).filter((o)=>o.length);
  optionChanged();
});

applyToAllWebsites.addEventListener('change', (e) => {
  Options.applyToAllWebsites = applyToAllWebsites.checked;
  optionChanged();
});

customSourcePatterns.addEventListener('change', (e) => {
  Options.customSourcePatterns = customSourcePatterns.value;
  optionChanged();
});

if (videoResetButton) {
  videoResetButton.addEventListener('click', () => {
    resetOptionsKeysToDefault([
      'videoZoom',
      'videoDelay',
      'videoBrightness',
      'videoContrast',
      'videoSaturation',
      'videoGrayscale',
      'videoSepia',
      'videoInvert',
      'videoHueRotate',
      'videoDaltonizerType',
      'videoDaltonizerStrength',
    ]);
  });
}

if (generalResetButton) {
  generalResetButton.addEventListener('click', () => {
    resetOptionsKeysToDefault([
      'downloadAll',
      'maxSpeed',
      'maxVideoSize',
      'autoplayNext',
      'autoplayYoutube',
      'storeProgress',
      'previewEnabled',
      'copyTimestampURL',
      'autoEnableBestSubtitles',
      'analyzeVideos',
      'playStreamURLs',
      'playMP4URLs',
      'defaultQuality',
      'visChangeAction',
      'miniPos',
      'miniSize',
      'singleClickAction',
      'doubleClickAction',
      'tripleClickAction',
      'seekStepSize',
      'replaceDelay',
      'controlsHideDelay',
      'colorTheme',
      'maximumDownloaders',
      'youtubePlayerID',
    ]);
  });
}

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
  Utils.downloadURL(url, 'faststream-options.json', true);
  URL.revokeObjectURL(url);
});

function optionChanged() {
  // Centralized save/broadcast
  OptionsStore.replace(Options);
}

const versionDiv = document.getElementById('version');
versionDiv.textContent = `FastStream v${EnvUtils.getVersion()}`;

// if in iframe, add the frame class to body
if (parent !== window) {
  document.body.classList.add('frame');
}

if (EnvUtils.isMobile()) {
  document.body.classList.add('mobile');
} else {
  document.body.classList.remove('mobile');
}

// React to external changes via OptionsStore
OptionsStore.subscribe(async () => {
  loadOptions(OptionsStore.get());
  await refreshToolbarButtonsUI();
});

if (EnvUtils.isExtension()) {
  // Also refresh when becoming visible to catch recent changes
  const o = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      loadOptions(OptionsStore.get());
      refreshToolbarButtonsUI();
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


  const feedbackbox = document.getElementById('feedbackbox');
  const feedbackyes = document.getElementById('feedback-yes');
  const feedbackno = document.getElementById('feedback-no');

  feedbackyes.addEventListener('click', (e) => {
    chrome.storage.local.set({
      feedback: 'yes',
    });
    feedbackbox.style.display = 'none';
    chrome.tabs.create({
      url: 'https://docs.google.com/forms/d/e/1FAIpQLSfA3T8lmhKO_ih028cP0m67vhH-FaGNkeHE0EsQoyBWztpctA/viewform?usp=sf_link',
    });
  });

  feedbackno.addEventListener('click', (e) => {
    chrome.storage.local.set({
      feedback: 'no',
    });
    feedbackbox.style.display = 'none';
  });

  chrome.storage.local.get('firstuse', (result) => {
    if (!result || !result.firstuse) {
      chrome.storage.local.set({
        firstuse: Date.now(),
      });
    } else {
      // const now = Date.now();
      // const diff = now - result.firstuse;
      // if (diff > 1000 * 60 * 60 * 24 * 3) { // 3 days, ask for feedback
      //   chrome.storage.local.get('feedback', (result) => {
      //     if (!result || !result.feedback) {
      //       feedbackbox.style.display = 'block';
      //     }
      //   });
      // }
    }
  });

  // Don't ask for rating for manual installs
  // SPLICER:NO_PROMO:REMOVE_START
  chrome.storage.local.get('rateus', (result) => {
    if (!result || !result.rateus) {
      ratebox.style.display = 'block';
    }
  });
  // SPLICER:NO_PROMO:REMOVE_END

  // SPLICER:NO_UPDATE_CHECKER:REMOVE_START
  const updatebox = document.getElementById('updatebox');
  const updatetext = document.getElementById('updatetext');
  const updatenotif = parent.document ? parent.document.getElementById('update_notif_banner') : null;

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
      if (updatenotif) updatenotif.style.display = 'block';
    }
  });

  document.getElementById('update').addEventListener('click', (e) => {
    chrome.tabs.create({
      url: 'https://github.com/Andrews54757/FastStream',
    });
  });

  document.getElementById('noupdate').addEventListener('click', (e) => {
    updatebox.style.display = 'none';
    if (updatenotif) updatenotif.style.display = 'none';
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

