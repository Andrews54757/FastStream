import {EventEmitter} from '../../modules/eventemitter.mjs';
import {Localize} from '../../modules/Localize.mjs';
import {WebVTT} from '../../modules/vtt.mjs';
import {SubtitleTrack} from '../../SubtitleTrack.mjs';
import {RequestUtils} from '../../utils/RequestUtils.mjs';
import {SubtitleUtils} from '../../utils/SubtitleUtils.mjs';
import {Utils} from '../../utils/Utils.mjs';
import {WebUtils} from '../../utils/WebUtils.mjs';
import {DOMElements} from '../DOMElements.mjs';
import {OpenSubtitlesSearch, OpenSubtitlesSearchEvents} from './OpenSubtitlesSearch.mjs';
import {SubtitlesSettingsManager, SubtitlesSettingsManagerEvents} from './SubtitlesSettingsManager.mjs';
import {SubtitleSyncer} from './SubtitleSyncer.mjs';

export class SubtitlesManager extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;

    this.tracks = [];
    this.activeTracks = [];
    this.isTestSubtitleActive = false;

    this.subtitleTrackListElements = [];
    this.subtitleTrackDisplayElements = [];

    this.settingsManager = new SubtitlesSettingsManager();
    this.settingsManager.on(SubtitlesSettingsManagerEvents.SETTINGS_CHANGED, this.onSettingsChanged.bind(this));
    this.settingsManager.loadSettings();

    this.openSubtitlesSearch = new OpenSubtitlesSearch(client.version);
    this.openSubtitlesSearch.on(OpenSubtitlesSearchEvents.TRACK_DOWNLOADED, this.onSubtitleTrackDownloaded.bind(this));

    this.subtitleSyncer = new SubtitleSyncer(client);

    this.setupUI();
  }

  loadTrackAndActivateBest(subtitleTrack, autoset = false) {
    const returnedTrack = this.addTrack(subtitleTrack);
    if (returnedTrack !== subtitleTrack) {
      return returnedTrack;
    }

    const defLang = this.settingsManager.getSettings().defaultLanguage;
    if (autoset && this.activeTracks.length === 0 && this.client.options.autoEnableBestSubtitles) {
      if (subtitleTrack.language && subtitleTrack.language.substring(0, defLang.length) === defLang) {
        this.activateTrack(subtitleTrack);
      }
    }

    return returnedTrack;
  }

  addTrack(track) {
    const existing = this.tracks.find((t) => t.equals(track));
    if (existing) {
      return existing;
    }

    this.tracks.push(track);

    this.updateTrackList();
    this.client.interfaceController.showControlBar();
    this.client.interfaceController.queueControlsHide(1000);

    return track;
  }

  activateTrack(track) {
    if (this.tracks.indexOf(track) === -1) {
      console.error('Cannot activate track that is not loaded', track);
      return;
    }

    if (this.activeTracks.indexOf(track) === -1) {
      this.activeTracks.push(track);
      this.updateTrackList();
    }
  }

  deactivateTrack(track) {
    const ind = this.activeTracks.indexOf(track);
    if (ind !== -1) {
      this.activeTracks.splice(ind, 1);
      this.updateTrackList();
    }
  }

  toggleSubtitles() {
    if (this.activeTracks.length === 0) {
      if (this.lastActiveTracks) {
        this.lastActiveTracks.forEach((track) => {
          this.activateTrack(track);
        });
        this.lastActiveTracks = null;
      } else {
        this.activateTrack(this.tracks[0]);
      }
    } else {
      this.lastActiveTracks = this.activeTracks.slice();
      this.activeTracks.length = 0;
      this.updateTrackList();
    }
  }

  clearTracks() {
    this.tracks.length = 0;
    this.activeTracks.length = 0;
    this.updateTrackList();
    this.subtitleSyncer.stop();
  }

  removeTrack(track) {
    let ind = this.tracks.indexOf(track);
    if (ind !== -1) this.tracks.splice(ind, 1);
    ind = this.activeTracks.indexOf(track);
    if (ind !== -1) this.activeTracks.splice(ind, 1);
    this.updateTrackList();
    this.subtitleSyncer.toggleTrack(track, true);
  }

  onSettingsChanged(settings) {
    this.openSubtitlesSearch.setLanguageInputValue(settings.defaultLanguage);
    this.refreshSubtitleStyles();
    this.renderSubtitles();
  }

  onSubtitleTrackDownloaded(track) {
    this.activateTrack(this.addTrack(track));
  }

  onCaptionsButtonInteract(e) {
    if (e.shiftKey) {
      this.openSubtitlesSearch.toggleUI();
      e.stopPropagation();
      return;
    }

    if (DOMElements.subtitlesMenu.style.display === 'none') {
      this.openUI();
    } else {
      this.closeUI();
    }
    e.stopPropagation();
  }

  closeUI() {
    DOMElements.subtitlesMenu.style.display = 'none';
  }

  openUI() {
    this.emit('open', {
      target: DOMElements.subtitles,
    });
    DOMElements.subtitlesMenu.style.display = '';
  }

  setupUI() {
    DOMElements.subtitles.addEventListener('click', this.onCaptionsButtonInteract.bind(this));
    DOMElements.subtitles.tabIndex = 0;

    DOMElements.subtitles.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeUI();
        e.stopPropagation();
        e.preventDefault();
      } else if (e.key === 'Enter') {
        this.onCaptionsButtonInteract(e);
      }
    });


    DOMElements.playerContainer.addEventListener('click', (e) => {
      this.closeUI();
    });

    DOMElements.subtitlesOptionsTestButton.addEventListener('click', (e) => {
      this.isTestSubtitleActive = !this.isTestSubtitleActive;
      if (this.isTestSubtitleActive) {
        DOMElements.subtitlesOptionsTestButton.textContent = Localize.getMessage('player_subtitlesmenu_testbtn_stop');
        DOMElements.playerContainer.style.backgroundImage = 'linear-gradient(to right, black, white)';
      } else {
        DOMElements.subtitlesOptionsTestButton.textContent = Localize.getMessage('player_subtitlesmenu_testbtn');
        DOMElements.playerContainer.style.backgroundImage = '';
      }

      this.renderSubtitles();
    });
    WebUtils.setupTabIndex(DOMElements.subtitlesOptionsTestButton);

    const filechooser = document.createElement('input');
    filechooser.type = 'file';
    filechooser.style.display = 'none';
    filechooser.accept = '.vtt, .srt';

    filechooser.addEventListener('change', () => {
      const files = filechooser.files;
      if (!files || !files[0]) return;
      const file = files[0];
      const name = file.name;
      //  var ext = name.substring(name.length - 4);

      const reader = new FileReader();
      reader.onload = () => {
        const dt = reader.result;
        const track = new SubtitleTrack(name, null);
        track.loadText(dt);

        this.addTrack(track);
      };
      reader.readAsText(file);
    });
    document.body.appendChild(filechooser);

    const filebutton = document.createElement('div');
    filebutton.classList.add('subtitle-menu-option');
    WebUtils.setupTabIndex(filebutton);
    filebutton.textContent = Localize.getMessage('player_subtitlesmenu_uploadbtn');

    filebutton.addEventListener('click', (e) => {
      filechooser.click();
    });
    DOMElements.subtitlesView.appendChild(filebutton);

    const urlbutton = document.createElement('div');
    urlbutton.classList.add('subtitle-menu-option');
    urlbutton.textContent = Localize.getMessage('player_subtitlesmenu_urlbtn');
    WebUtils.setupTabIndex(urlbutton);
    urlbutton.addEventListener('click', (e) => {
      const url = prompt(Localize.getMessage('player_subtitlesmenu_urlprompt'));

      if (url) {
        RequestUtils.requestSimple(url, (err, req, body) => {
          if (body) {
            const track = new SubtitleTrack('URL Track', null);
            track.loadText(body);

            this.addTrack(track);
          }
        });
      }
    });

    DOMElements.subtitlesView.appendChild(urlbutton);

    const internetbutton = document.createElement('div');
    internetbutton.textContent = Localize.getMessage('player_subtitlesmenu_searchbtn');
    internetbutton.classList.add('subtitle-menu-option');
    internetbutton.classList.add('disable-when-mini');
    WebUtils.setupTabIndex(internetbutton);
    internetbutton.addEventListener('click', (e) => {
      this.openSubtitlesSearch.toggleUI();
    });
    DOMElements.subtitlesView.appendChild(internetbutton);

    const clearbutton = document.createElement('div');
    clearbutton.textContent = Localize.getMessage('player_subtitlesmenu_clearbtn');
    WebUtils.setupTabIndex(clearbutton);
    clearbutton.classList.add('subtitle-menu-option');

    clearbutton.addEventListener('click', (e) => {
      this.clearTracks();
    });
    DOMElements.subtitlesView.appendChild(clearbutton);

    const optionsbutton = document.createElement('div');
    optionsbutton.classList.add('subtitle-menu-option');
    optionsbutton.textContent = Localize.getMessage('player_subtitlesmenu_settingsbtn');
    WebUtils.setupTabIndex(optionsbutton);

    optionsbutton.addEventListener('click', (e) => {
      this.settingsManager.openUI();
    });

    WebUtils.setupTabIndex(DOMElements.subtitlesOptionsBackButton);

    DOMElements.subtitlesView.appendChild(optionsbutton);

    DOMElements.subtitlesMenu.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    window.addEventListener('resize', () => {
      this.checkTrackBounds();
    });

    DOMElements.subtitlesMenu.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    DOMElements.subtitlesMenu.addEventListener('mouseup', (e) => {
      e.stopPropagation();
    });
  }

  createTrackEntryElements(i) {
    const trackElement = document.createElement('div');
    trackElement.classList.add('subtitle-track-element');

    trackElement.addEventListener('click', (e) => {
      const track = this.tracks[i];
      const ind = this.activeTracks.indexOf(track);
      if (ind !== -1) {
        this.deactivateTrack(track);
      } else {
        this.activateTrack(track);
      }
      e.stopPropagation();
    });

    WebUtils.setupTabIndex(trackElement);

    const trackName = document.createElement('div');
    trackElement.appendChild(trackName);
    trackName.classList.add('subtitle-track-name');

    const resyncTool = document.createElement('div');
    resyncTool.title = Localize.getMessage('player_subtitlesmenu_resynctool_label');
    resyncTool.className = 'fluid_button fluid_button_wand subtitle-resync-tool subtitle-tool';
    trackElement.appendChild(resyncTool);
    // svg use
    const svgIconHourglass = WebUtils.createSVGIcon('assets/fluidplayer/static/icons.svg#hourglass');
    resyncTool.appendChild(svgIconHourglass);

    resyncTool.addEventListener('click', (e) => {
      this.subtitleSyncer.toggleTrack(this.tracks[i]);
      e.stopPropagation();
    }, true);

    const downloadTrack = document.createElement('div');
    downloadTrack.title = Localize.getMessage('player_subtitlesmenu_savetool_label');
    downloadTrack.className = 'fluid_button fluid_button_download subtitle-download-tool subtitle-tool';

    // svg use
    const svgIconDownload = WebUtils.createSVGIcon('assets/fluidplayer/static/icons.svg#download');
    downloadTrack.appendChild(svgIconDownload);

    trackElement.appendChild(downloadTrack);

    downloadTrack.addEventListener('click', (e) => {
      e.stopPropagation();
      const suggestedName = trackElement.textContent.replaceAll(' ', '_');
      const dlname = chrome?.extension?.inIncognitoContext ? suggestedName : prompt(Localize.getMessage('player_filename_prompt'), suggestedName);

      if (!dlname) {
        return;
      }

      const srt = SubtitleUtils.cuesToSrt(this.tracks[i].cues);
      const blob = new Blob([srt], {
        type: 'text/plain',
      });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = dlname + '.srt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, true);

    const removeTrack = document.createElement('div');
    removeTrack.classList.add('subtitle-remove-tool');
    removeTrack.classList.add('subtitle-tool');
    removeTrack.title = Localize.getMessage('player_subtitlesmenu_removetool_label');
    trackElement.appendChild(removeTrack);

    removeTrack.addEventListener('click', (e) => {
      this.removeTrack(this.tracks[i]);
      e.stopPropagation();
    }, true);


    const shiftLTrack = document.createElement('div');
    shiftLTrack.classList.add('subtitle-shiftl-tool');
    shiftLTrack.classList.add('subtitle-tool');
    shiftLTrack.title = Localize.getMessage('player_subtitlesmenu_shifttool_label', ['-0.2']);
    trackElement.appendChild(shiftLTrack);

    shiftLTrack.addEventListener('click', (e) => {
      this.tracks[i].shift(-0.2);
      this.renderSubtitles();
      this.client.interfaceController.setStatusMessage('subtitles', Localize.getMessage('player_subtitlesmenu_shifttool_message', ['-0.2']), 'info', 700);
      e.stopPropagation();
    }, true);

    const shiftRTrack = document.createElement('div');
    shiftRTrack.classList.add('subtitle-shiftr-tool');
    shiftRTrack.classList.add('subtitle-tool');
    shiftRTrack.title = Localize.getMessage('player_subtitlesmenu_shifttool_label', ['+0.2']);
    trackElement.appendChild(shiftRTrack);

    shiftRTrack.addEventListener('click', (e) => {
      this.tracks[i].shift(0.2);
      this.renderSubtitles();
      this.client.interfaceController.setStatusMessage('subtitles', Localize.getMessage('player_subtitlesmenu_shifttool_message', ['+0.2']), 'info', 700);
      e.stopPropagation();
    }, true);


    trackElement.addEventListener('mouseenter', () => {
      trackElement.focus();
    });

    trackElement.addEventListener('mouseleave', () => {
      trackElement.blur();
    });


    trackElement.addEventListener('keydown', (e) => {
      const keybind = this.client.keybindManager.eventToKeybind(e);
      if (keybind === 'SubtrackDelete') {
        e.stopPropagation();
        removeTrack.click();
      } else if (keybind === 'SubtrackShiftRight') {
        e.stopPropagation();
        shiftRTrack.click();
      } else if (keybind === 'SubtrackShiftLeft') {
        e.stopPropagation();
        shiftLTrack.click();
      } else if (keybind === 'SubtrackDownload') {
        e.stopPropagation();
        downloadTrack.click();
      } else if (keybind === 'SubtrackToggleResync') {
        e.stopPropagation();
        resyncTool.click();
      }
    });

    return {
      trackElement,
      update: () => {
        const track = this.tracks[i];
        const activeIndex = this.activeTracks.indexOf(track);
        const nameCandidate = (track.language ? ('(' + track.language + ') ') : '') + (track.label || `Track ${i + 1}`);
        let name = nameCandidate;
        // limit to 30 chars
        if (name.length > 30) {
          name = name.substring(0, 30) + '...';
        }

        if (activeIndex !== -1) {
          trackElement.classList.add('subtitle-track-active');

          if (this.activeTracks.length > 1) {
            trackName.textContent = (activeIndex + 1) + ': ' + name;
          } else {
            trackName.textContent = name;
          }
        } else {
          trackElement.classList.remove('subtitle-track-active');
          trackName.textContent = name;
        }

        trackName.title = nameCandidate;
      },
    };
  }

  updateTrackList() {
    const cachedElements = this.subtitleTrackListElements;
    const tracks = this.tracks;

    // Remove extra elements
    for (let i = cachedElements.length - 1; i >= tracks.length; i--) {
      const el = cachedElements[i];
      el.trackElement.remove();
      cachedElements.splice(i, 1);
    }

    // Add new elements
    for (let i = cachedElements.length; i < tracks.length; i++) {
      const elements = this.createTrackEntryElements(i);
      cachedElements.push(elements);
      DOMElements.subtitlesList.appendChild(elements.trackElement);
    }

    // Update elements
    for (let i = 0; i < tracks.length; i++) {
      cachedElements[i].update();
    }

    this.renderSubtitles();
  }

  applyStyles(trackContainer) {
    return this.settingsManager.applyStyles(trackContainer);
  }

  refreshSubtitleStyles() {
    this.subtitleTrackDisplayElements.forEach((el) => {
      this.applyStyles(el);
    });
  }

  createSubtitleDisplayElements(i) {
    const trackContainer = document.createElement('div');
    trackContainer.className = 'subtitle-track';
    this.applyStyles(trackContainer);

    const wrapper = document.createElement('div');
    wrapper.className = 'subtitle-track-wrapper';
    wrapper.appendChild(trackContainer);

    wrapper.style.marginBottom = '5px';


    let yStart = 0;

    const mouseup = (e) => {
      document.removeEventListener('mousemove', mousemove);
      document.removeEventListener('mouseup', mouseup);
      e.stopPropagation();
    };

    const mousemove = (e) => {
      // drag by adjusting margin-bottom
      const oldDiff = yStart - e.clientY;
      let diff = oldDiff;
      let current = wrapper;
      do {
        const marginBottom = parseInt(current.style.marginBottom) || 0;
        const newMarginBottom = Math.max(marginBottom + diff, 5);
        current.style.marginBottom = newMarginBottom + 'px';
        diff -= (newMarginBottom - marginBottom);
        current = current.nextElementSibling;
      } while (current && diff < 0);

      const adjustedDiff = oldDiff - diff;

      const previousSibling = wrapper.previousElementSibling;
      if (previousSibling) {
        const previousMarginBottom = parseInt(previousSibling.style.marginBottom) || 0;
        const newPreviousMarginBottom = Math.max(previousMarginBottom - adjustedDiff, 5);
        previousSibling.style.marginBottom = newPreviousMarginBottom + 'px';
      }

      yStart = e.clientY;
      this.checkTrackBounds();
      e.stopPropagation();
    };

    wrapper.addEventListener('mousedown', (e) => {
      yStart = e.clientY;
      document.addEventListener('mousemove', mousemove);
      document.addEventListener('mouseup', mouseup);
      e.stopPropagation();
    });


    return {
      trackContainer,
      wrapper,
    };
  }

  // Make sure subtitles are not outside of the video
  checkTrackBounds() {
    const trackElements = this.subtitleTrackDisplayElements;
    const playerHeight = DOMElements.playerContainer.offsetHeight - parseInt(window.getComputedStyle(DOMElements.subtitlesContainer).bottom);

    let totalTrackHeight = 0;
    for (let i = 0; i < trackElements.length; i++) {
      const trackWrapper = trackElements[i].parentElement;
      const marginBottom = parseInt(trackWrapper.style.marginBottom);
      totalTrackHeight += trackWrapper.offsetHeight + marginBottom;
    }

    let shrinkAmount = Math.max(totalTrackHeight - playerHeight, 0);
    // shrink margin-bottom from topmost track downwards
    for (let i = 0; i < trackElements.length && shrinkAmount > 0; i++) {
      const trackWrapper = trackElements[i].parentElement;
      const marginBottom = parseInt(trackWrapper.style.marginBottom) || 0;
      const newMarginBottom = Math.max(marginBottom - shrinkAmount, 5);
      trackWrapper.style.marginBottom = newMarginBottom + 'px';
      shrinkAmount -= (marginBottom - newMarginBottom);
    }
  }

  getSubtitlesVisibleNow() {
    const cachedElements = this.subtitleTrackDisplayElements;
    return cachedElements.map((el, i) => {
      return {
        track: this.activeTracks[i],
        visible: el.style.opacity !== '0',
        text: el.textContent,
        marginBottom: parseInt(el.parentElement.style.marginBottom),
      };
    });
  }

  renderSubtitles() {
    const cachedElements = this.subtitleTrackDisplayElements;
    const tracks = this.activeTracks;
    let trackLen = tracks.length;

    if (this.isTestSubtitleActive) {
      trackLen++;
    }

    // Remove extra elements
    for (let i = cachedElements.length - 1; i >= trackLen; i--) {
      const el = cachedElements[i];
      el.parentElement.remove();
      cachedElements.splice(i, 1);
    }

    // Add new elements
    for (let i = cachedElements.length; i < trackLen; i++) {
      const {trackContainer, wrapper} = this.createSubtitleDisplayElements(i);

      cachedElements.push(trackContainer);
      DOMElements.subtitlesContainer.appendChild(wrapper);
    }

    // Update elements
    const currentTime = this.client.persistent.currentTime;

    for (let i = 0; i < tracks.length; i++) {
      const trackContainer = cachedElements[i];
      trackContainer.replaceChildren();
      const cues = tracks[i].cues;
      let hasCues = false;

      let cueIndex = Utils.binarySearch(cues, this.client.persistent.currentTime, (time, cue) => {
        if (cue.startTime > time) {
          return -1;
        } else if (cue.endTime < time) {
          return 1;
        }
        return 0;
      });

      if (cueIndex > -1) {
        while (cueIndex > 0 && cues[cueIndex - 1].endTime >= currentTime && cues[cueIndex - 1].startTime <= currentTime) {
          cueIndex--;
        }

        while (cueIndex < cues.length && cues[cueIndex].endTime >= currentTime && cues[cueIndex].startTime <= currentTime) {
          const cue = cues[cueIndex];
          if (!cue.dom) {
            cue.dom = WebVTT.convertCueToDOMTree(window, cue.text);
          }
          hasCues = true;
          trackContainer.appendChild(cue.dom);
          cueIndex++;
        }
      }

      if (!hasCues) {
        trackContainer.style.opacity = 0;
        const fillerCue = document.createElement('div');
        trackContainer.appendChild(fillerCue);

        fillerCue.textContent = '|';
      } else {
        trackContainer.style.opacity = '';
      }
    }


    if (this.isTestSubtitleActive) {
      const trackContainer = cachedElements[trackLen - 1];
      trackContainer.replaceChildren();
      trackContainer.style.opacity = '';

      const cue = document.createElement('div');
      cue.textContent = Localize.getMessage('player_testsubtitle');
      trackContainer.appendChild(cue);
    }

    this.checkTrackBounds();
  }

  mediaNameSet() {
    this.openSubtitlesSearch.setQueryInputValue(this.client.mediaName);
  }
}
