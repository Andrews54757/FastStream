import {WebVTT} from '../modules/vtt.mjs';
import {SubtitleTrack} from '../SubtitleTrack.mjs';
import {RequestUtils} from '../utils/RequestUtils.mjs';
import {SubtitleUtils} from '../utils/SubtitleUtils.mjs';
import {Utils} from '../utils/Utils.mjs';
import {WebUtils} from '../utils/WebUtils.mjs';
import {DOMElements} from './DOMElements.mjs';
import {OpenSubtitlesSearch, OpenSubtitlesSearchEvents} from './OpenSubtitlesSearch.mjs';
import {SubtitlesSettingsManager, SubtitlesSettingsManagerEvents} from './SubtitlesSettingsManager.mjs';

export class SubtitlesManager {
  constructor(client) {
    this.client = client;
    this.tracks = [];

    this.activeTracks = [];
    this.isTestSubtitleActive = false;

    this.settingsManager = new SubtitlesSettingsManager();
    this.settingsManager.on(SubtitlesSettingsManagerEvents.SETTINGS_CHANGED, this.onSettingsChanged.bind(this));
    this.settingsManager.loadSettings();

    this.openSubtitlesSearch = new OpenSubtitlesSearch(client.version);
    this.openSubtitlesSearch.on(OpenSubtitlesSearchEvents.TRACK_DOWNLOADED, this.onSubtitleTrackDownloaded.bind(this));

    this.setupUI();
  }

  loadTrackAndActivateBest(subtitleTrack, autoset = false) {
    const returnedTrack = this.addTrack(subtitleTrack);
    if (returnedTrack !== subtitleTrack) {
      return returnedTrack;
    }

    const defLang = this.settingsManager.getSettings()['default-lang'];
    if (autoset && this.client.options.autoEnableBestSubtitles && subtitleTrack.language === defLang && this.activeTracks.length === 0) {
      this.activateTrack(subtitleTrack);
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

  clearTracks() {
    this.tracks.length = 0;
    this.activeTracks.length = 0;
    this.updateTrackList();
    this.client.subtitleSyncer.stop();
  }

  removeTrack(track) {
    let ind = this.tracks.indexOf(track);
    if (ind !== -1) this.tracks.splice(ind, 1);
    ind = this.activeTracks.indexOf(track);
    if (ind !== -1) this.activeTracks.splice(ind, 1);
    this.updateTrackList();
    this.client.subtitleSyncer.toggleTrack(track, true);
  }

  onSettingsChanged(settings) {
    this.openSubtitlesSearch.setLanguageInputValue(settings['default-lang']);
    this.renderSubtitles();
    this.client.subtitleSyncer.onVideoTimeUpdate();
  }

  onSubtitleTrackDownloaded(track) {
    this.activateTrack(this.addTrack(track));
  }

  setupUI() {
    DOMElements.subtitles.addEventListener('click', (e) => {
      if (DOMElements.subtitlesMenu.style.display == 'none') {
        DOMElements.subtitlesMenu.style.display = '';
      } else {
        DOMElements.subtitlesMenu.style.display = 'none';
      }
      e.stopPropagation();
    });

    WebUtils.setupTabIndex(DOMElements.subtitles);

    DOMElements.playerContainer.addEventListener('click', (e) => {
      DOMElements.subtitlesMenu.style.display = 'none';
    });

    DOMElements.subtitlesOptionsTestButton.addEventListener('click', (e) => {
      this.isTestSubtitleActive = !this.isTestSubtitleActive;
      if (this.isTestSubtitleActive) {
        DOMElements.subtitlesOptionsTestButton.textContent = 'Stop Testing';
        DOMElements.playerContainer.style.backgroundImage = 'linear-gradient(to right, black, white)';
      } else {
        DOMElements.subtitlesOptionsTestButton.textContent = 'Test Subtitles';
        DOMElements.playerContainer.style.backgroundImage = '';
      }

      this.renderSubtitles();
      this.client.subtitleSyncer.onVideoTimeUpdate();
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
        //   if (ext == ".srt") dt = srt2webvtt(dt);
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
    filebutton.textContent = 'Upload File';

    filebutton.addEventListener('click', (e) => {
      filechooser.click();
    });
    DOMElements.subtitlesView.appendChild(filebutton);

    const urlbutton = document.createElement('div');
    urlbutton.classList.add('subtitle-menu-option');
    urlbutton.textContent = 'From URL';
    WebUtils.setupTabIndex(urlbutton);
    urlbutton.addEventListener('click', (e) => {
      const url = prompt('Enter URL');

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
    internetbutton.textContent = 'Search OpenSubtitles';
    internetbutton.classList.add('subtitle-menu-option');
    WebUtils.setupTabIndex(internetbutton);
    internetbutton.addEventListener('click', (e) => {
      this.openSubtitlesSearch.openUI();
    });
    DOMElements.subtitlesView.appendChild(internetbutton);

    const clearbutton = document.createElement('div');
    clearbutton.textContent = 'Clear Subtitles';
    WebUtils.setupTabIndex(clearbutton);
    clearbutton.classList.add('subtitle-menu-option');

    clearbutton.addEventListener('click', (e) => {
      this.clearTracks();
    });
    DOMElements.subtitlesView.appendChild(clearbutton);

    const optionsbutton = document.createElement('div');
    optionsbutton.classList.add('subtitle-menu-option');
    optionsbutton.textContent = 'Subtitle Settings';
    WebUtils.setupTabIndex(optionsbutton);

    optionsbutton.addEventListener('click', (e) => {
      this.settingsManager.showUI();
    });

    WebUtils.setupTabIndex(DOMElements.subtitlesOptionsBackButton);

    DOMElements.subtitlesView.appendChild(optionsbutton);

    DOMElements.subtitlesMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
  }

  updateTrackList() {
    DOMElements.subtitlesList.replaceChildren();

    const tracks = this.tracks;
    for (let i = 0; i < tracks.length; i++) {
      ((i) => {
        const track = tracks[i];
        const trackElement = document.createElement('div');
        trackElement.classList.add('subtitle-track-element');
        const activeIndex = this.activeTracks.indexOf(track);
        const name = (track.language ? ('(' + track.language + ') ') : '') + (track.label || `Track ${i + 1}`);

        if (activeIndex !== -1) {
          trackElement.style.color = 'rgba(0,255,0,.6)';

          if (this.activeTracks.length > 1) {
            trackElement.textContent = (activeIndex + 1) + ': ' + name;
          } else {
            trackElement.textContent = name;
          }
        } else {
          trackElement.style.color = 'rgba(255,0,0,.7)';
          trackElement.textContent = name;
        }


        trackElement.addEventListener('click', (e) => {
          const ind = this.activeTracks.indexOf(track);
          if (ind !== -1) {
            this.deactivateTrack(track);
          } else {
            this.activateTrack(track);
          }
          e.stopPropagation();
          e.preventDefault();
        });

        WebUtils.setupTabIndex(trackElement);

        const resyncTool = document.createElement('div');
        resyncTool.title = 'Resync Tool';
        resyncTool.className = 'fluid_button fluid_button_wand subtitle-resync-tool';
        trackElement.appendChild(resyncTool);
        // svg use
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', 'assets/fluidplayer/static/icons.svg#hourglass');
        svg.appendChild(use);
        resyncTool.appendChild(svg);

        resyncTool.addEventListener('click', (e) => {
          this.client.subtitleSyncer.toggleTrack(track);
          e.stopPropagation();
        }, true);


        const downloadTrack = document.createElement('div');
        // border-left: 10px solid transparent; border-right: 10px solid transparent; border-top: 10px solid rgba(200,200,200,.4);
        downloadTrack.title = 'Download subtitle file';
        downloadTrack.className = 'fluid_button fluid_button_download subtitle-download-tool';

        // svg use
        const svg2 = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const use2 = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use2.setAttributeNS('http://www.w3.org/1999/xlink', 'href', 'assets/fluidplayer/static/icons.svg#download');
        svg2.appendChild(use2);
        downloadTrack.appendChild(svg2);


        trackElement.appendChild(downloadTrack);

        downloadTrack.addEventListener('click', (e) => {
          e.stopPropagation();
          const suggestedName = name + '.srt';
          const dlname = chrome?.extension?.inIncognitoContext ? suggestedName : prompt('Enter a name for the subtitle download file', suggestedName);

          if (!dlname) {
            return;
          }


          const srt = SubtitleUtils.cuesToSrt(track.cues);
          const blob = new Blob([srt], {
            type: 'text/plain',
          });
          const url = window.URL.createObjectURL(blob);

          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = dlname;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, true);

        const removeTrack = document.createElement('div');
        removeTrack.classList.add('subtitle-remove-tool');
        removeTrack.title = 'Remove subtitle track';
        trackElement.appendChild(removeTrack);

        removeTrack.addEventListener('click', (e) => {
          this.removeTrack(track);
          e.stopPropagation();
        }, true);


        const shiftLTrack = document.createElement('div');
        shiftLTrack.classList.add('subtitle-shiftl-tool');
        shiftLTrack.title = 'Shift subtitles -0.2s';
        trackElement.appendChild(shiftLTrack);

        shiftLTrack.addEventListener('click', (e) => {
          track.shift(-0.2);
          this.renderSubtitles();
          this.client.subtitleSyncer.onVideoTimeUpdate();
          e.stopPropagation();
        }, true);

        const shiftRTrack = document.createElement('div');
        shiftRTrack.classList.add('subtitle-shiftr-tool');
        shiftRTrack.title = 'Shift subtitles +0.2s';
        trackElement.appendChild(shiftRTrack);

        shiftRTrack.addEventListener('click', (e) => {
          track.shift(0.2);
          this.renderSubtitles();
          this.client.subtitleSyncer.onVideoTimeUpdate();
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
        DOMElements.subtitlesList.appendChild(trackElement);
      })(i);
    }

    this.renderSubtitles();
    this.client.subtitleSyncer.onVideoTimeUpdate();
  }

  applyStyles(trackContainer) {
    const settings = this.settingsManager.getSettings();
    trackContainer.style.color = settings.color;
    trackContainer.style.fontSize = settings['font-size'];
    trackContainer.style.backgroundColor = settings.background;
  }

  renderSubtitles() {
    DOMElements.subtitlesContainer.replaceChildren();

    if (this.isTestSubtitleActive) {
      const trackContainer = document.createElement('div');
      trackContainer.className = 'subtitle-track';
      this.applyStyles(trackContainer);

      const cue = document.createElement('div');
      cue.textContent = 'This is a test subtitle';
      trackContainer.appendChild(cue);

      const wrapper = document.createElement('div');
      wrapper.className = 'subtitle-track-wrapper';
      wrapper.appendChild(trackContainer);
      DOMElements.subtitlesContainer.appendChild(wrapper);
    }
    const tracks = this.activeTracks;
    const currentTime = this.client.persistent.currentTime;
    tracks.forEach((track) => {
      const trackContainer = document.createElement('div');
      trackContainer.className = 'subtitle-track';
      this.applyStyles(trackContainer);
      const cues = track.cues;
      let hasCues = false;

      let cueIndex = Utils.binarySearch(cues, currentTime, (time, cue) => {
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

      const wrapper = document.createElement('div');
      wrapper.className = 'subtitle-track-wrapper';
      wrapper.appendChild(trackContainer);
      DOMElements.subtitlesContainer.appendChild(wrapper);

      if (!hasCues) {
        wrapper.style.opacity = 0;
        const fillerCue = document.createElement('div');
        trackContainer.appendChild(fillerCue);

        fillerCue.textContent = '|';
      }
    });
  }

  mediaNameSet() {
    this.openSubtitlesSearch.setQueryInputValue(this.client.mediaName);
  }
}
