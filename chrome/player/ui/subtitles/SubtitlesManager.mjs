import {EventEmitter} from '../../modules/eventemitter.mjs';
import {Localize} from '../../modules/Localize.mjs';
import {WebVTT} from '../../modules/vtt.mjs';
import {SubtitleTrack} from '../../SubtitleTrack.mjs';
import {AlertPolyfill} from '../../utils/AlertPolyfill.mjs';
import {RequestUtils} from '../../utils/RequestUtils.mjs';
import {SubtitleUtils} from '../../utils/SubtitleUtils.mjs';
import {Utils} from '../../utils/Utils.mjs';
import {WebUtils} from '../../utils/WebUtils.mjs';
import {OptionsStore} from '../../options/OptionsStore.mjs';
import {DefaultLanguages} from '../../options/defaults/DefaultLanguages.mjs';
import {DOMElements} from '../DOMElements.mjs';
import {OpenSubtitlesSearch, OpenSubtitlesSearchEvents} from './OpenSubtitlesSearch.mjs';
import {SubtitlesSettingsManager, SubtitlesSettingsManagerEvents} from './SubtitlesSettingsManager.mjs';
import {SubtitleSyncer} from './SubtitleSyncer.mjs';

// NOTE: Removed top-level SubtitleTranslator import to prevent player crash if file missing

export class SubtitlesManager extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.tracks = [];
    this.activeTracks = [];
    this.isTestSubtitleActive = false;
    this.subtitleTrackListElements = [];
    this.subtitleTrackDisplayElements = [];
    
    // Initialize the store so we listen for changes from the Options Page!
    OptionsStore.init();
    
    this.settingsManager = new SubtitlesSettingsManager();
    this.settingsManager.on(SubtitlesSettingsManagerEvents.SETTINGS_CHANGED, this.onSettingsChanged.bind(this));
    this.settingsManager.loadSettings();
    this.openSubtitlesSearch = new OpenSubtitlesSearch(client.version);
    this.openSubtitlesSearch.on(OpenSubtitlesSearchEvents.TRACK_DOWNLOADED, this.onSubtitleTrackDownloaded.bind(this));
    this.subtitleSyncer = new SubtitleSyncer(client);
    
    this.setupUI();
  }

  loadTrackAndActivateBest(t,a=false){const r=this.addTrack(t);if(r!==t)return r;const d=this.settingsManager.getSettings().defaultLanguage;if(a&&this.activeTracks.length<=1&&this.client.options.autoEnableBestSubtitles){if(Localize.getLanguageMatchLevel(t.language,d)>0){const e=this.activeTracks.find(k=>k.language&&t.language&&k.language.substring(0,d.length)===d);if(!e)this.activateTrack(t);else if(e.label&&e.label.toLowerCase().includes('auto')&&t.label&&!t.label.toLowerCase().includes('auto')){this.deactivateTrack(e);this.activateTrack(t)}}}return r}
  addTrack(t){const e=this.tracks.find(k=>k.equals(t));if(e)return e;this.tracks.push(t);this.updateTrackList();this.client.interfaceController.showControlBar();this.client.interfaceController.queueControlsHide(1e3);return t}
  activateTrack(t){if(this.tracks.indexOf(t)===-1)return;if(this.activeTracks.indexOf(t)===-1){this.activeTracks.push(t);this.updateTrackList()}}
  deactivateTrack(t){const i=this.activeTracks.indexOf(t);if(i!==-1){this.activeTracks.splice(i,1);this.updateTrackList()}}
  toggleSubtitles(){if(this.activeTracks.length===0){if(this.lastActiveTracks){this.lastActiveTracks.forEach(t=>this.activateTrack(t));this.lastActiveTracks=null}else this.activateTrack(this.tracks[0])}else{this.lastActiveTracks=this.activeTracks.slice();this.activeTracks.length=0;this.updateTrackList()}}
  clearTracks(){this.tracks.length=0;this.activeTracks.length=0;this.updateTrackList();this.subtitleSyncer.stop()}
  removeTrack(t){let i=this.tracks.indexOf(t);if(i!==-1)this.tracks.splice(i,1);i=this.activeTracks.indexOf(t);if(i!==-1)this.activeTracks.splice(i,1);this.updateTrackList();this.subtitleSyncer.toggleTrack(t,true)}
  onSettingsChanged(s){this.openSubtitlesSearch.setLanguageInputValue(s.defaultLanguage);this.refreshSubtitleStyles();this.renderSubtitles()}
  onSubtitleTrackDownloaded(t){this.activateTrack(this.addTrack(t))}
  onCaptionsButtonInteract(e){if(e.shiftKey){this.openSubtitlesSearch.toggleUI();e.stopPropagation();return}if(!this.isOpen())this.openUI();else this.closeUI();e.stopPropagation()}
  closeUI(){if(DOMElements.subtitlesMenu.style.display==='none')return false;DOMElements.subtitlesMenu.style.display='none';WebUtils.setLabels(DOMElements.subtitles,Localize.getMessage('player_subtitlesmenu_open_label'));return true}
  openUI(){this.emit('open',{target:DOMElements.subtitles});DOMElements.subtitlesMenu.style.display='';WebUtils.setLabels(DOMElements.subtitles,Localize.getMessage('player_subtitlesmenu_close_label'))}
  isOpen(){return DOMElements.subtitlesMenu.style.display!=='none'}

  setupUI() {
    try {
        DOMElements.subtitles.addEventListener('click', this.onCaptionsButtonInteract.bind(this));
        DOMElements.subtitles.tabIndex = 0;
        DOMElements.subtitles.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.onCaptionsButtonInteract(e);
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
        filechooser.ariaHidden = true;
        filechooser.ariaLabel = 'Upload subtitle file';
        filechooser.addEventListener('change', () => {
            const files = filechooser.files;
            if (!files || !files[0]) return;
            const file = files[0];
            const name = file.name;
            const reader = new FileReader();
            reader.onload = () => {
                const dt = reader.result;
                const track = new SubtitleTrack(name, null);
                track.loadText(dt);
                this.addTrack(track);
            };
            reader.readAsText(file);
        });
        DOMElements.playerContainer.appendChild(filechooser);

        const filebutton = document.createElement('div');
        filebutton.classList.add('subtitle-menu-option');
        WebUtils.setupTabIndex(filebutton);
        filebutton.textContent = Localize.getMessage('player_subtitlesmenu_uploadbtn');
        filebutton.addEventListener('click', () => filechooser.click());
        DOMElements.subtitlesView.appendChild(filebutton);

        const urlbutton = document.createElement('div');
        urlbutton.classList.add('subtitle-menu-option');
        urlbutton.textContent = Localize.getMessage('player_subtitlesmenu_urlbtn');
        WebUtils.setupTabIndex(urlbutton);
        urlbutton.addEventListener('click', async () => {
            const url = await AlertPolyfill.prompt(Localize.getMessage('player_subtitlesmenu_urlprompt'), '', undefined, 'url');
            if (url) {
                AlertPolyfill.toast('info', Localize.getMessage('player_subtitles_addtrack_downloading'));
                RequestUtils.requestSimple(url, (err, req, body) => {
                    if (!err && body) {
                        try {
                            const track = new SubtitleTrack('URL Track', null);
                            track.loadText(body);
                            this.addTrack(track);
                            AlertPolyfill.toast('success', Localize.getMessage('player_subtitles_addtrack_success'));
                        } catch (e) {
                            AlertPolyfill.toast('error', Localize.getMessage('player_subtitles_addtrack_error'), e?.message);
                        }
                    } else {
                        AlertPolyfill.toast('error', Localize.getMessage('player_subtitles_addtrack_error'), err?.message);
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
        internetbutton.addEventListener('click', () => this.openSubtitlesSearch.toggleUI());
        DOMElements.subtitlesView.appendChild(internetbutton);

        // --- TRANSLATOR UI WITH COMPACT LAYOUT (No Scroll) ---
        try {
            const translateContainer = document.createElement('div');
            translateContainer.className = 'subtitle-menu-option';
            
            // STYLE: Basic container setup
            translateContainer.style.justifyContent = 'space-between';
            translateContainer.style.alignItems = 'center';
            translateContainer.style.padding = '8px 8px'; 
            translateContainer.style.cursor = 'default';
            translateContainer.style.borderBottom = '1px solid rgba(255,255,255,0.1)';

            // LABEL
            const translateLabel = document.createElement('span');
            translateLabel.textContent = "Trans:"; 
            translateLabel.style.marginRight = '5px';
            translateLabel.style.fontSize = '13px';
            translateLabel.style.color = '#ccc'; 
            translateContainer.appendChild(translateLabel);

            // DROPDOWN
            const langSelect = document.createElement('select');
            langSelect.style.flex = '1';
            langSelect.style.width = '0'; 
            langSelect.style.marginRight = '5px';
            langSelect.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            langSelect.style.color = 'white';
            langSelect.style.border = '1px solid #555';
            langSelect.style.borderRadius = '3px';
            langSelect.style.padding = '2px 2px';
            langSelect.style.fontSize = '12px';
            langSelect.style.outline = 'none';
            
            // Populate Dropdown
            Object.keys(DefaultLanguages).forEach(code => {
                const option = document.createElement('option');
                option.value = code;
                option.textContent = DefaultLanguages[code];
                option.style.backgroundColor = '#222'; 
                option.style.color = 'white';
                langSelect.appendChild(option);
            });

            // LOGIC: Handle Visibility & Language Selection
            const updateUIFromOptions = (options) => {
                // 1. Show/Hide based on setting
                translateContainer.style.display = options.autoTranslate ? 'flex' : 'none';
                
                // 2. Select the saved language (if valid)
                if (options.defaultTranslateLanguage && DefaultLanguages[options.defaultTranslateLanguage]) {
                    langSelect.value = options.defaultTranslateLanguage;
                } else {
                    langSelect.value = 'en'; // Default fallback
                }
            };

            // 1. Initial Render (Might be defaults)
            updateUIFromOptions(OptionsStore.get());

            // 2. FORCE UPDATE after storage is ready (Fixes "Off by default" bug)
            OptionsStore.init().then(() => {
                const loadedOptions = OptionsStore.get();
                updateUIFromOptions(loadedOptions);
                
                // CRITICAL FIX: If enabled in saved settings, make sure we really show it
                if (loadedOptions.autoTranslate) {
                   translateContainer.style.display = 'flex';
                }
            });
            
            // C. Listen for live changes (e.g. from Options Page)
            OptionsStore.subscribe((options) => {
                updateUIFromOptions(options);
            });

            // D. Save changes when user picks a language (Fixes "Not Saved")
            langSelect.addEventListener('change', (e) => {
                const newLang = e.target.value;
                OptionsStore.set({ defaultTranslateLanguage: newLang });
            });
            
            langSelect.addEventListener('click', (e) => e.stopPropagation());
            langSelect.addEventListener('mousedown', (e) => e.stopPropagation());
            translateContainer.appendChild(langSelect);

            // GO BUTTON
            const goBtn = document.createElement('button');
            goBtn.textContent = "Go";
            goBtn.className = "fs-control-button"; 
            goBtn.style.cursor = 'pointer';
            goBtn.style.color = 'white';
            goBtn.style.backgroundColor = 'transparent';
            goBtn.style.border = '1px solid #777';
            goBtn.style.borderRadius = '3px';
            goBtn.style.padding = '2px 8px';
            goBtn.style.fontSize = '12px';
            goBtn.style.fontWeight = 'bold';
            
            goBtn.onmouseover = () => { goBtn.style.borderColor = '#fff'; goBtn.style.backgroundColor = 'rgba(255,255,255,0.1)'; };
            goBtn.onmouseout = () => { goBtn.style.borderColor = '#777'; goBtn.style.backgroundColor = 'transparent'; };
            
            goBtn.addEventListener('click', async (e) => {
                e.stopPropagation(); 
                if (this.activeTracks.length === 0) {
                    AlertPolyfill.toast('error', 'No active subtitles to translate.');
                    return;
                }
                
                const targetLang = langSelect.value;
                const targetName = DefaultLanguages[targetLang];
                AlertPolyfill.toast('info', `Translation Started: ${targetName}`);

                const sourceCues = this.activeTracks[0].cues;
                const totalCues = sourceCues.length;
                let processedCount = 0;
                
                // --- CREATE STATUS BADGE WITH AUTO-HIDE ---
                const statusEl = document.createElement('div');
                statusEl.id = 'fs-translation-status';
                statusEl.style.cssText = `
                    position: absolute; 
                    top: 20px; 
                    right: 20px; 
                    z-index: 2147483647; 
                    background-color: rgba(20, 20, 20, 0.9); 
                    color: white; 
                    padding: 10px 15px; 
                    border-radius: 6px; 
                    font-family: sans-serif; 
                    font-size: 14px; 
                    border: 1px solid rgba(255,255,255,0.2);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    pointer-events: none;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                    transition: opacity 0.5s ease-in-out; 
                    opacity: 1;
                `;
                statusEl.innerHTML = `<span>Translating...</span> <span style="color: #4caf50; font-weight: bold;">0%</span>`;
                
                if (DOMElements.playerContainer) {
                    DOMElements.playerContainer.appendChild(statusEl);
                }

                // --- AUTO-HIDE LOGIC ---
                let hideTimeout;
                const resetHideTimer = () => {
                    statusEl.style.opacity = '1';
                    clearTimeout(hideTimeout);
                    hideTimeout = setTimeout(() => {
                        statusEl.style.opacity = '0';
                    }, 2500);
                };

                DOMElements.playerContainer.addEventListener('mousemove', resetHideTimer);
                DOMElements.playerContainer.addEventListener('mouseenter', resetHideTimer);
                resetHideTimer();

                const removeStatus = () => {
                    DOMElements.playerContainer.removeEventListener('mousemove', resetHideTimer);
                    DOMElements.playerContainer.removeEventListener('mouseenter', resetHideTimer);
                    clearTimeout(hideTimeout);
                    statusEl.remove();
                };

                if (!this.translator) {
                    try {
                        const { SubtitleTranslator } = await import('../../modules/SubtitleTranslator.mjs');
                        this.translator = new SubtitleTranslator();
                    } catch (err) {
                        console.error(err);
                        AlertPolyfill.toast('error', 'Missing "SubtitleTranslator.mjs" in modules folder!');
                        statusEl.remove();
                        return;
                    }
                }

                const newTrack = new SubtitleTrack(`Auto (${targetLang})`, targetLang);
                newTrack.loadText("WEBVTT\n\n"); 
                newTrack.cues = []; 
                
                const tracksToDisable = [...this.activeTracks];
                tracksToDisable.forEach(track => {
                    this.deactivateTrack(track);
                });

                this.addTrack(newTrack);
                this.activateTrack(newTrack);
                this.closeUI();

                try {
                    await this.translator.translateStream(sourceCues, targetLang, (newSegmentCues, statusMsg) => {
                        if (statusMsg) {
                            statusEl.innerHTML = `<span style="color:#ffcc00">${statusMsg}</span>`;
                            return;
                        }
                        
                        newSegmentCues.forEach(c => {
                            if (!c.dom) {
                                c.dom = WebVTT.convertCueToDOMTree(window, c.text);
                            }
                            newTrack.cues.push(c);
                        });

                        newTrack.cues.sort((a, b) => a.startTime - b.startTime);
                        this.renderSubtitles();
                        
                        processedCount += newSegmentCues.length;
                        const percent = Math.min(100, Math.floor((processedCount / totalCues) * 100));
                        statusEl.innerHTML = `<span>Translating...</span> <span style="color: #4caf50; font-weight: bold;">${percent}%</span>`;
                    });

                    statusEl.innerHTML = `<span style="color:#4caf50">✔ Complete</span>`;
                    setTimeout(() => removeStatus(), 3000);

                } catch (err) {
                    console.error(err);
                    statusEl.innerHTML = `<span style="color: #ff5252;">Error: ${err.message}</span>`;
                    setTimeout(() => removeStatus(), 5000);
                }
            });
            translateContainer.appendChild(goBtn);

            DOMElements.subtitlesView.appendChild(translateContainer);
        } catch (uiErr) {
            console.error("Failed to add Translate UI", uiErr);
        }

        const clearBtn = document.createElement('div'); clearBtn.className='subtitle-menu-option'; clearBtn.textContent=Localize.getMessage('player_subtitlesmenu_clearbtn');
        clearBtn.onclick = () => this.clearTracks(); DOMElements.subtitlesView.appendChild(clearBtn);

        const optBtn = document.createElement('div'); optBtn.className='subtitle-menu-option'; optBtn.textContent=Localize.getMessage('player_subtitlesmenu_settingsbtn');
        optBtn.onclick = () => this.settingsManager.openUI(); DOMElements.subtitlesView.appendChild(optBtn);

    } catch (err) { console.error("UI Setup Error", err); }
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
    const svgIconHourglass = WebUtils.createSVGIcon('assets/fluidplayer/static/icons.svg#hourglass');
    resyncTool.appendChild(svgIconHourglass);

    resyncTool.addEventListener('click', (e) => {
      this.subtitleSyncer.toggleTrack(this.tracks[i]);
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

    const downloadTrack = document.createElement('div');
    downloadTrack.title = Localize.getMessage('player_subtitlesmenu_savetool_label');
    downloadTrack.className = 'fluid_button fluid_button_download subtitle-download-tool subtitle-tool';
    const svgIconDownload = WebUtils.createSVGIcon('assets/fluidplayer/static/icons.svg#download');
    downloadTrack.appendChild(svgIconDownload);
    trackElement.appendChild(downloadTrack);

    downloadTrack.addEventListener('click', async (e) => {
      e.stopPropagation();
      const suggestedName = trackElement.textContent.replaceAll(' ', '_');
      const dlname = chrome?.extension?.inIncognitoContext ? suggestedName : await AlertPolyfill.prompt(Localize.getMessage('player_filename_prompt'), suggestedName);
      if (!dlname) return;
      const srt = SubtitleUtils.cuesToSrt(this.tracks[i].cues);
      const blob = new Blob([srt], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      await Utils.downloadURL(url, dlname + '.srt');
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

    trackElement.addEventListener('mouseenter', () => trackElement.focus());
    trackElement.addEventListener('mouseleave', () => trackElement.blur());

    trackElement.addEventListener('keydown', (e) => {
      if (e.code === 'Delete' || e.code === 'Backspace') { e.stopPropagation(); removeTrack.click(); } 
      else if (e.code === 'BracketRight') { e.stopPropagation(); shiftRTrack.click(); } 
      else if (e.code === 'BracketLeft') { e.stopPropagation(); shiftLTrack.click(); } 
      else if (e.code === 'KeyD') { e.stopPropagation(); downloadTrack.click(); } 
      else if (e.code === 'KeyR') { e.stopPropagation(); resyncTool.click(); }
    });

    return {
      trackElement,
      update: () => {
        const track = this.tracks[i];
        const activeIndex = this.activeTracks.indexOf(track);
        const nameCandidate = (track.language ? ('(' + track.language + ') ') : '') + (track.label || `Track ${i + 1}`);
        let name = nameCandidate;
        if (name.length > 30) name = name.substring(0, 30) + '...';

        if (activeIndex !== -1) {
          trackElement.classList.add('subtitle-track-active');
          trackName.textContent = (this.activeTracks.length > 1) ? (activeIndex + 1) + ': ' + name : name;
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
    for (let i = cachedElements.length - 1; i >= tracks.length; i--) {
      const el = cachedElements[i];
      el.trackElement.remove();
      cachedElements.splice(i, 1);
    }
    for (let i = cachedElements.length; i < tracks.length; i++) {
      const elements = this.createTrackEntryElements(i);
      cachedElements.push(elements);
      DOMElements.subtitlesList.appendChild(elements.trackElement);
    }
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
      DOMElements.playerContainer.removeEventListener('mousemove', mousemove);
      DOMElements.playerContainer.removeEventListener('mouseup', mouseup);
      e.stopPropagation();
    };
    const mousemove = (e) => {
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
      DOMElements.playerContainer.addEventListener('mousemove', mousemove);
      DOMElements.playerContainer.addEventListener('mouseup', mouseup);
      e.stopPropagation();
    });
    return { trackContainer, wrapper };
  }

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
    if (this.isTestSubtitleActive) trackLen++;

    for (let i = cachedElements.length - 1; i >= trackLen; i--) {
      const el = cachedElements[i];
      el.parentElement.remove();
      cachedElements.splice(i, 1);
    }
    for (let i = cachedElements.length; i < trackLen; i++) {
      const {trackContainer, wrapper} = this.createSubtitleDisplayElements(i);
      cachedElements.push(trackContainer);
      DOMElements.subtitlesContainer.appendChild(wrapper);
    }

    const currentTime = this.client.state.currentTime;
    let subtitlesVisible = 0;

    for (let i = 0; i < tracks.length; i++) {
      const trackContainer = cachedElements[i];
      const cues = tracks[i].cues;
      let cueIndex = Utils.binarySearch(cues, this.client.state.currentTime, (time, cue) => {
        if (cue.startTime > time) return -1; else if (cue.startTime < time) return 1; return 0;
      });
      const toAdd = [];
      if (cueIndex < -1) cueIndex = -cueIndex - 2;
      while (cueIndex > 0 && cues[cueIndex - 1].endTime >= currentTime && cues[cueIndex - 1].startTime <= currentTime) cueIndex--;
      while (cueIndex >= 0 &&cueIndex < cues.length && cues[cueIndex].endTime >= currentTime && cues[cueIndex].startTime <= currentTime) {
        const cue = cues[cueIndex];
        if (!cue.dom) cue.dom = WebVTT.convertCueToDOMTree(window, cue.text);
        toAdd.push(cue.dom);
        cueIndex++;
      }
      if (!toAdd.length) {
        trackContainer.style.opacity = 0;
        const fillerCue = trackContainer.children[0] || document.createElement('div');
        WebUtils.replaceChildrenPerformant(trackContainer, [fillerCue]);
        if (!fillerCue.textContent) fillerCue.textContent = '|';
      } else {
        trackContainer.style.opacity = '';
        WebUtils.replaceChildrenPerformant(trackContainer, toAdd);
        subtitlesVisible++;
      }
    }

    if (this.isTestSubtitleActive) {
      const trackContainer = cachedElements[trackLen - 1];
      trackContainer.style.opacity = '';
      if (!this.testCue) {
        const cue = document.createElement('div');
        cue.textContent = Localize.getMessage('player_testsubtitle');
        this.testCue = cue;
      }
      WebUtils.replaceChildrenPerformant(trackContainer, [this.testCue]);
      subtitlesVisible++;
    }

    if (subtitlesVisible) {
      DOMElements.subtitlesContainer.style.display = '';
      const margin = this.settingsManager.getSettings().bottomMargin;
      DOMElements.subtitlesContainer.style.bottom = margin === '40px' ? '' : this.settingsManager.getSettings().bottomMargin;
    } else {
      DOMElements.subtitlesContainer.style.display = 'none';
    }
    this.checkTrackBounds();
  }

  mediaInfoSet() {
    this.openSubtitlesSearch.setMediaInfo(this.client.mediaInfo);
  }
}