import {PlayerModes} from '../enums/PlayerModes.mjs';
import {Sortable} from '../modules/sortable.mjs';
import {EnvUtils} from '../utils/EnvUtils.mjs';
import {Utils} from '../utils/Utils.mjs';
import {VideoUtils} from '../utils/VideoUtils.mjs';
import {WebUtils} from '../utils/WebUtils.mjs';
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
      DOMElements.disabledTools.classList.remove('visible');
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
      filter: '.menu_container, .rate_menu_container',
      preventOnFilter: false,
    };
    this.reorderSortEnabled = Sortable.create(DOMElements.toolsContainer, options);
    this.reorderSortDisabled = Sortable.create(DOMElements.disabledTools, options);

    const tools = Array.from(DOMElements.toolsContainer.children).concat(Array.from(DOMElements.disabledTools.children));
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


    const mouseUpHandler = (e) => {
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);
    };

    const mouseMoveHandler = (e) => {
      const currentY = Math.min(Math.max(e.clientY - WebUtils.getOffsetTop(DOMElements.progressContainer), -100), 100);
      const isExpanded = DOMElements.playerContainer.classList.contains('expanded');
      const offset = isExpanded ? 0 : 80;
      if (currentY > 50) {
        this.interfaceController.closeTimeline();
      } else if (currentY <= -5 - offset) {
        this.interfaceController.openTimeline();
      }
    };

    DOMElements.controlsLeft.addEventListener('mousedown', (e) => {
      document.addEventListener('mousemove', mouseMoveHandler);
      document.addEventListener('mouseup', mouseUpHandler);
    });
    this.setupDragDemoTutorial();
  }

  canHideControls() {
    return !this.specialReorderModeEnabled && !this.userIsReordering;
  }

  updateToolVisibility() {
    DOMElements.playinfo.style.display = this.client.player ? 'none' : '';

    if (this.client.player && document.pictureInPictureEnabled) {
      DOMElements.pip.classList.remove('hidden');
    } else {
      DOMElements.pip.classList.add('hidden');
    }

    if (this.client.player) {
      DOMElements.screenshot.classList.remove('hidden');
      DOMElements.loopButton.classList.remove('hidden');
    } else {
      DOMElements.screenshot.classList.add('hidden');
      DOMElements.loopButton.classList.add('hidden');
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

    if (EnvUtils.isSafari() && this.client.player && this.client.player.getSource().mode !== PlayerModes.DIRECT ) {
      DOMElements.audioConfigBtn.classList.add('hidden');
    } else {
      DOMElements.audioConfigBtn.classList.remove('hidden');
    }

    const toolSettings = this.client.options.toolSettings;
    const toolElements = {
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
    };

    if (this.specialReorderModeEnabled) {
      return;
    }

    const enabledToolPairs = [];
    const disabledToolPairs = [];

    for (const [tool, element] of Object.entries(toolElements)) {
      element.dataset.tool = tool;
      if (toolSettings[tool].enabled) {
        enabledToolPairs.push([element, toolSettings[tool]]);
      } else {
        disabledToolPairs.push([element, toolSettings[tool]]);
      }
      element.remove();
    }

    enabledToolPairs.sort((a, b) => a[1].priority - b[1].priority);
    for (const [element] of enabledToolPairs) {
      DOMElements.toolsContainer.appendChild(element);
    }

    disabledToolPairs.sort((a, b) => a[1].priority - b[1].priority);
    for (const [element] of disabledToolPairs) {
      DOMElements.disabledTools.appendChild(element);
    }

    this.checkMoreTool();
  }

  checkMoreTool() {
    if (Array.from(DOMElements.disabledTools.children).some((el) => {
      return !el.classList.contains('hidden');
    })) {
      DOMElements.moreButton.classList.remove('hidden');
    } else {
      DOMElements.moreButton.classList.add('hidden');
      DOMElements.disabledTools.classList.remove('visible');
    }

    if (DOMElements.toolsContainer.children.length === 0) {
      this.moveMoreTool(DOMElements.disabledTools, DOMElements.toolsContainer);
    } else if (DOMElements.disabledTools.children.length === 0) {
      this.moveMoreTool(DOMElements.toolsContainer, DOMElements.disabledTools);
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

    Array.from(DOMElements.toolsContainer.children).forEach((el, i) => {
      const tool = el.dataset.tool;
      this.client.options.toolSettings[tool].priority = (i + 1) * 100;
      this.client.options.toolSettings[tool].enabled = true;
    });

    Array.from(DOMElements.disabledTools.children).forEach((el, i) => {
      const tool = el.dataset.tool;
      this.client.options.toolSettings[tool].priority = (i + 1) * 100;
      this.client.options.toolSettings[tool].enabled = false;
    });

    Utils.setConfig('toolSettings', JSON.stringify(this.client.options.toolSettings));
  }

  startReorderUI() {
    if (this.specialReorderModeEnabled) return;
    this.interfaceController.closeAllMenus();
    this.closeDragDemoTutorial();
    this.specialReorderModeEnabled = true;
    DOMElements.toolsContainer.classList.add('reordering');
    DOMElements.disabledTools.classList.add('reordering');
  }

  stopReorderUI() {
    if (!this.specialReorderModeEnabled) return;
    this.specialReorderModeEnabled = false;
    DOMElements.toolsContainer.classList.remove('reordering');
    DOMElements.disabledTools.classList.remove('reordering');
  }

  setupDragDemoTutorial() {
    Utils.getConfig('dragDemoTutorialSeen').then((seen) => {
      if (!seen) {
        this.showDragDemoTutorial();
      }
    });

    DOMElements.dragDemoTutorial.addEventListener('click', (e) => {
      this.closeDragDemoTutorial();
      e.stopPropagation();
    });
  }

  showDragDemoTutorial() {
    if (DOMElements.dragDemoTutorial.style.display !== 'none' ) return;
    DOMElements.dragDemoTutorial.style.display = '';
    const video = document.createElement('video');
    video.src = './assets/dragdemo.mp4';
    video.muted = true;
    video.autoplay = true;
    video.loop = true;
    DOMElements.dragDemoTutorial.appendChild(video);
    WebUtils.setupTabIndex(DOMElements.dragDemoTutorial);
  }

  closeDragDemoTutorial() {
    if (DOMElements.dragDemoTutorial.style.display !== '') return;
    DOMElements.dragDemoTutorial.style.display = 'none';
    VideoUtils.destroyVideo(DOMElements.dragDemoTutorial.children[0]);
    DOMElements.dragDemoTutorial.replaceChildren();
    Utils.setConfig('dragDemoTutorialSeen', true);
  }
}
