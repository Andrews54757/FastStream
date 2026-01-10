import {PlayerModes} from '../enums/PlayerModes.mjs';
import {Sortable} from '../modules/sortable.mjs';
import {EnvUtils} from '../utils/EnvUtils.mjs';
import {Utils} from '../utils/Utils.mjs';
import {DOMElements} from './DOMElements.mjs';
export class ToolManager {
  constructor(client, interfaceController) {
    this.interfaceController = interfaceController;
    this.client = client;
    this.userIsReordering = false;
    this.specialReorderModeEnabled = false;
  }
  setupUI() {
    this.updateToolVisibility();
    DOMElements.playerContainer.addEventListener('click', (e) => {
      this.stopReorderUI();
      DOMElements.extraTools.classList.remove('visible');
    });
    const options = {
      animation: 100,
      group: 'reorder',
      onStart: ()=>{
        this.userIsReordering = true;
        clearTimeout(this.reorderTimeout);
      },
      onEnd: (evt)=>{
        this.userIsReordering = false;
        this.checkToolsAndSave();
      },
      filter: '.menu_container, .rate_menu_container, .fluid_control_volume_container',
      preventOnFilter: false,
    };
    this.sortableRight = Sortable.create(DOMElements.rightToolsContainer, options);
    this.sortableLeft = Sortable.create(DOMElements.leftToolsContainer, options);
    this.sortableExtra = Sortable.create(DOMElements.extraTools, options);
    if (EnvUtils.isMobile()) {
      this.sortableRight.option('disabled', true);
      this.sortableLeft.option('disabled', true);
      this.sortableExtra.option('disabled', true);
    }
    const tools = Array.from(DOMElements.leftToolsContainer.children).concat(Array.from(DOMElements.rightToolsContainer.children), Array.from(DOMElements.extraTools.children));
    tools.forEach((el) => {
      let skipClick = false;
      const reorderMouseDown = (e) => {
        // check if left mouse button was pressed
        if (e.button !== 0) return;
        if (this.specialReorderModeEnabled) return;
        clearTimeout(this.reorderTimeout);
        this.reorderTimeout = setTimeout(() => {
          skipClick = true;
          this.startReorderUI();
        }, 800);
      };
      el.addEventListener('mousedown', (e) => {
        reorderMouseDown(e);
      });
      DOMElements.playerContainer.addEventListener('mouseup', (e)=>{
        clearTimeout(this.reorderTimeout);
        if (skipClick) {
          setTimeout(() => {
            skipClick = false;
          }, 100);
        }
      });
      el.addEventListener('click', (e) => {
        if (this.specialReorderModeEnabled) {
          if (!skipClick) this.stopReorderUI();
          e.stopPropagation();
        }
      }, true);
      el.addEventListener('focus', (e)=>{
        if (this.specialReorderModeEnabled) {
          e.stopPropagation();
        }
      }, true);
    });
  }
  canHideControls() {
    return !this.specialReorderModeEnabled && !this.userIsReordering;
  }
  updateToolVisibility() {
    DOMElements.playinfo.style.display = this.client.player ? 'none' : '';
    if ((this.client.player && document.pictureInPictureEnabled) || this.interfaceController.shouldDoDocumentPip()) {
      DOMElements.pip.classList.remove('hidden');
    } else {
      DOMElements.pip.classList.add('hidden');
    }
    if (this.client.player) {
      DOMElements.screenshot.classList.remove('hidden');
      DOMElements.loopButton.classList.remove('hidden');
      DOMElements.skipForwardButton.classList.remove('hidden');
      DOMElements.skipBackwardButton.classList.remove('hidden');
    } else {
      DOMElements.screenshot.classList.add('hidden');
      DOMElements.loopButton.classList.add('hidden');
      DOMElements.skipForwardButton.classList.add('hidden');
      DOMElements.skipBackwardButton.classList.add('hidden');
    }
    if (this.client.player && !this.client.player.canSave().cantSave) {
      DOMElements.download.classList.remove('hidden');
    } else {
      DOMElements.download.classList.add('hidden');
    }
    if (this.client.player && window.self !== window.top) {
      DOMElements.windowedFullscreen.classList.remove('hidden');
    } else {
      DOMElements.windowedFullscreen.classList.add('hidden');
    }
    if (this.client.hasPreviousVideo()) {
      DOMElements.previousVideo.classList.remove('hidden');
    } else {
      DOMElements.previousVideo.classList.add('hidden');
    }
    if (this.client.hasNextVideo()) {
      DOMElements.nextVideo.classList.remove('hidden');
    } else {
      DOMElements.nextVideo.classList.add('hidden');
    }
    // Safari doesn't allow webaudio unless the video itself is playing from the same origin
    if ((EnvUtils.isSafari() && this.client.player && this.client.player.getSource().mode !== PlayerModes.DIRECT) || !EnvUtils.isWebAudioSupported()) {
      DOMElements.audioConfigBtn.classList.add('hidden');
    } else {
      DOMElements.audioConfigBtn.classList.remove('hidden');
    }
    const toolSettings = this.client.options.toolSettings;
    const toolElements = {
      playpause: DOMElements.playPauseButton,
      volume: DOMElements.volumeBlock,
      duration: DOMElements.duration,
      next: DOMElements.nextVideo,
      previous: DOMElements.previousVideo,
      pip: DOMElements.pip,
      screenshot: DOMElements.screenshot,
      download: DOMElements.download,
      playrate: DOMElements.playbackRate,
      fullscreen: DOMElements.fullscreen,
      windowedfs: DOMElements.windowedFullscreen,
      subtitles: DOMElements.subtitles,
      audioconfig: DOMElements.audioConfigBtn,
      sources: DOMElements.linkButton,
      settings: DOMElements.settingsButton,
      quality: DOMElements.videoSource,
      languages: DOMElements.languageButton,
      loop: DOMElements.loopButton,
      more: DOMElements.moreButton,
      forward: DOMElements.skipForwardButton,
      backward: DOMElements.skipBackwardButton,
    };
    // Apply user visibility preferences without interfering with contextual visibility (.hidden).
    // Core controls are always forced visible.
    const userButtons = this.client?.options?.toolbarButtons || {};
    const forcedVisible = new Set(['playpause', 'volume', 'fullscreen', 'settings', 'more']);
    for (const [tool, element] of Object.entries(toolElements)) {
      if (!element) continue;
      if (forcedVisible.has(tool)) {
        element.classList.remove('user_hidden');
        continue;
      }
      if (userButtons[tool] === false) {
        element.classList.add('user_hidden');
      } else {
        element.classList.remove('user_hidden');
      }
    }
    if (this.specialReorderModeEnabled) {
      return;
    }
    const leftToolPairs = [];
    const rightToolPairs = [];
    const extraToolPairs = [];
    for (const [tool, element] of Object.entries(toolElements)) {
      element.dataset.tool = tool;
      const location = toolSettings[tool].location;
      if (location === 'left') {
        leftToolPairs.push([element, toolSettings[tool]]);
      } else if (location === 'right') {
        rightToolPairs.push([element, toolSettings[tool]]);
      } else if (location === 'extra') {
        extraToolPairs.push([element, toolSettings[tool]]);
      } else { // Legacy
        if (toolSettings[tool].enabled) {
          rightToolPairs.push([element, toolSettings[tool]]);
        } else {
          extraToolPairs.push([element, toolSettings[tool]]);
        }
      }
      element.remove();
    }
    leftToolPairs.sort((a, b) => a[1].priority - b[1].priority);
    for (const [element] of leftToolPairs) {
      DOMElements.leftToolsContainer.appendChild(element);
    }
    rightToolPairs.sort((a, b) => a[1].priority - b[1].priority);
    for (const [element] of rightToolPairs) {
      DOMElements.rightToolsContainer.appendChild(element);
    }
    extraToolPairs.sort((a, b) => a[1].priority - b[1].priority);
    for (const [element] of extraToolPairs) {
      DOMElements.extraTools.appendChild(element);
    }
    this.checkMoreTool();
  }
  checkMoreTool() {
    if (Array.from(DOMElements.extraTools.children).some((el) => {
      return !el.classList.contains('hidden') && !el.classList.contains('user_hidden');
    })) {
      DOMElements.moreButton.classList.remove('hidden');
    } else {
      DOMElements.moreButton.classList.add('hidden');
      DOMElements.extraTools.classList.remove('visible');
    }
    if (DOMElements.leftToolsContainer.children.length === 0 && DOMElements.rightToolsContainer.children.length === 0) {
      this.moveMoreTool(DOMElements.extraTools, DOMElements.rightToolsContainer);
    } else if (DOMElements.extraTools.children.length === 0) {
      this.moveMoreTool(DOMElements.rightToolsContainer, DOMElements.extraTools);
      this.moveMoreTool(DOMElements.leftToolsContainer, DOMElements.extraTools);
    }
  }
  moveMoreTool(source, dest) {
    const more = Array.from(source.children).find((el) => el.dataset.tool === 'more');
    if (more) {
      more.remove();
      dest.appendChild(more);
    }
  }
  checkToolsAndSave() {
    this.checkMoreTool();
    Array.from(DOMElements.leftToolsContainer.children).forEach((el, i) => {
      const tool = el.dataset.tool;
      this.client.options.toolSettings[tool].priority = (i + 1) * 100;
      this.client.options.toolSettings[tool].location = 'left';
    });
    Array.from(DOMElements.rightToolsContainer.children).forEach((el, i) => {
      const tool = el.dataset.tool;
      this.client.options.toolSettings[tool].priority = (i + 1) * 100;
      this.client.options.toolSettings[tool].location = 'right';
    });
    Array.from(DOMElements.extraTools.children).forEach((el, i) => {
      const tool = el.dataset.tool;
      this.client.options.toolSettings[tool].priority = (i + 1) * 100;
      this.client.options.toolSettings[tool].location = 'extra';
    });
    Utils.setConfig('toolSettings', JSON.stringify(this.client.options.toolSettings));
  }
  startReorderUI() {
    if (this.specialReorderModeEnabled) return;
    this.interfaceController.closeAllMenus();
    this.specialReorderModeEnabled = true;
    DOMElements.rightToolsContainer.classList.add('reordering');
    DOMElements.leftToolsContainer.classList.add('reordering');
    DOMElements.extraTools.classList.add('reordering');
    if (EnvUtils.isMobile()) {
      this.sortableRight.option('disabled', false);
      this.sortableLeft.option('disabled', false);
      this.sortableExtra.option('disabled', false);
    }
  }
  stopReorderUI() {
    if (!this.specialReorderModeEnabled) return;
    this.specialReorderModeEnabled = false;
    DOMElements.rightToolsContainer.classList.remove('reordering');
    DOMElements.leftToolsContainer.classList.remove('reordering');
    DOMElements.extraTools.classList.remove('reordering');
    if (EnvUtils.isMobile()) {
      this.sortableRight.option('disabled', true);
      this.sortableLeft.option('disabled', true);
      this.sortableExtra.option('disabled', true);
    }
  }
}
