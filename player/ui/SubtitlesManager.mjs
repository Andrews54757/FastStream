import {Coloris} from '../modules/coloris.mjs';
import {WebVTT} from '../modules/vtt.mjs';
import {SubtitleTrack} from '../SubtitleTrack.mjs';
import {SubtitleUtils} from '../utils/SubtitleUtils.mjs';
import {Utils} from '../utils/Utils.mjs';
import {DOMElements} from './DOMElements.mjs';

const API_KEY = 'jolY3ZCVYguxFxl8CkIKl52zpHJT2eTw';
const COLOR_SETTINGS = ['color', 'background'];
export class SubtitlesManager {
  constructor(client) {
    this.client = client;
    this.tracks = [];

    this.activeTracks = [];

    this.settings = {
      'font-size': '40px',
      'color': 'rgba(255,255,255,1)',
      'background': 'rgba(10,10,10,0.3)',
      'default-lang': 'en',
    };

    this.isTesting = false;
    this.setupUI();
  }

  addTrack(track) {
    this.tracks.push(track);

    this.updateTrackList();
    this.client.interfaceController.showControlBar();
    this.client.interfaceController.queueControlsHide(1000);
  }

  activateTrack(track) {
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

  updateSettings() {
    try {
      chrome.storage.sync.set({
        subtitlesSettings: JSON.stringify(this.settings),
      });
    } catch (e) {
      console.error(e);
    }
    this.renderSubtitles();
    this.client.subtitleSyncer.onVideoTimeUpdate();
  }
  updateSettingsUI() {
    DOMElements.subtitlesOptionsList.innerHTML = '';
    for (const key in this.settings) {
      if (!Object.hasOwn(this.settings, key)) continue;
      const option = document.createElement('div');
      option.classList.add('option');

      const label = document.createElement('div');
      label.textContent = key.charAt(0).toUpperCase() + key.substring(1);

      const input = document.createElement('input');
      input.name = key;
      input.type = 'text';
      input.value = this.settings[key];
      if (COLOR_SETTINGS.includes(key)) {
        Coloris.bindElement(input);
        input.addEventListener('keydown', (e)=>{
          if (e.key === 'Enter') {
            e.stopPropagation();
            input.click();
          }
        });
      }

      let timeout = null;
      input.addEventListener('keyup', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          this.settings[key] = input.value;
          this.updateSettings();
        }, 200);
      });

      input.addEventListener('input', () => {
        this.settings[key] = input.value;
        this.updateSettings();
      });
      option.appendChild(label);
      option.appendChild(input);
      DOMElements.subtitlesOptionsList.appendChild(option);
    }
  }

  loadSettings() {
    try {
      chrome.storage.sync.get('subtitlesSettings', (data) => {
        if (data.subtitlesSettings) {
          const settings = JSON.parse(data.subtitlesSettings);
          for (const key in this.settings) {
            if (settings[key]) {
              this.settings[key] = settings[key];
            }
          }
          this.renderSubtitles();
          this.client.subtitleSyncer.onVideoTimeUpdate();
          this.updateSettingsUI();
        } else {
          this.updateSettingsUI();
        }
      });
    } catch (e) {
      console.error(e);
      this.updateSettingsUI();
    }
  }
  setupUI() {
    this.loadSettings();

    DOMElements.subtitlesOptionsList.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    DOMElements.subtitlesOptionsList.addEventListener('keyup', (e) => {
      e.stopPropagation();
    });


    DOMElements.subtitles.addEventListener('click', (e) => {
      if (DOMElements.subtitlesMenu.style.display == 'none') {
        DOMElements.subtitlesMenu.style.display = '';
      } else {
        DOMElements.subtitlesMenu.style.display = 'none';
      }
      e.stopPropagation();
    });

    Utils.setupTabIndex(DOMElements.subtitles);

    DOMElements.playerContainer.addEventListener('click', (e) => {
      DOMElements.subtitlesMenu.style.display = 'none';
      DOMElements.subuiContainer.style.display = 'none';
    });

    DOMElements.subtitlesOptionsTestButton.addEventListener('click', (e) => {
      this.isTesting = !this.isTesting;
      if (this.isTesting) {
        DOMElements.subtitlesOptionsTestButton.textContent = 'Stop Testing';
        DOMElements.playerContainer.style.backgroundImage = 'linear-gradient(to right, black, white)';
      } else {
        DOMElements.subtitlesOptionsTestButton.textContent = 'Test Subtitles';
        DOMElements.playerContainer.style.backgroundImage = '';
      }

      this.renderSubtitles();
      this.client.subtitleSyncer.onVideoTimeUpdate();
    });
    Utils.setupTabIndex(DOMElements.subtitlesOptionsTestButton);

    const filechooser = document.createElement('input');
    filechooser.type = 'file';
    filechooser.style = 'display: none';
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
    Utils.setupTabIndex(filebutton);
    filebutton.textContent = 'Upload File';
    filebutton.style = 'padding: 3px 5px; color: rgba(255,255,255,.8)';

    filebutton.addEventListener('click', (e) => {
      filechooser.click();
    });
    DOMElements.subtitlesView.appendChild(filebutton);

    const urlbutton = document.createElement('div');
    urlbutton.textContent = 'From URL';
    Utils.setupTabIndex(urlbutton);
    urlbutton.style = 'border-top: 1px solid rgba(255,255,255,0.4); padding: 3px 5px; color: rgba(255,255,255,.8)';

    urlbutton.addEventListener('click', (e) => {
      const url = prompt('Enter URL');

      if (url) {
        Utils.simpleRequest(url, (err, req, body) => {
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
    Utils.setupTabIndex(internetbutton);
    internetbutton.style = 'border-top: 1px solid rgba(255,255,255,0.4); padding: 3px 5px; color: rgba(255,255,255,.8)';

    internetbutton.addEventListener('click', (e) => {
      DOMElements.subuiContainer.style.display = '';
      DOMElements.linkuiContainer.style.display = 'none';
      this.subui.search.focus();
    });
    DOMElements.subtitlesView.appendChild(internetbutton);

    const clearbutton = document.createElement('div');
    clearbutton.textContent = 'Clear Subtitles';
    Utils.setupTabIndex(clearbutton);
    clearbutton.style = 'border-top: 1px solid rgba(255,255,255,0.4); padding: 3px 5px; color: rgba(255,255,255,.8)';

    clearbutton.addEventListener('click', (e) => {
      this.clearTracks();
    });
    DOMElements.subtitlesView.appendChild(clearbutton);

    const optionsbutton = document.createElement('div');
    optionsbutton.textContent = 'Subtitle Settings';
    Utils.setupTabIndex(optionsbutton);
    optionsbutton.style = 'border-top: 1px solid rgba(255,255,255,0.4); padding: 3px 5px; color: rgba(255,255,255,.8)';

    optionsbutton.addEventListener('click', (e) => {
      DOMElements.subtitlesOptions.style.display = '';
      DOMElements.subtitlesView.style.display = 'none';
    });

    DOMElements.subtitlesOptionsBackButton.addEventListener('click', (e) => {
      DOMElements.subtitlesOptions.style.display = 'none';
      DOMElements.subtitlesView.style.display = '';
    });
    Utils.setupTabIndex(DOMElements.subtitlesOptionsBackButton);

    DOMElements.subtitlesView.appendChild(optionsbutton);

    DOMElements.subtitlesMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
    this.subtitleQueryUI();
  }

  subtitleQueryUI() {
    DOMElements.subuiContainer.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    DOMElements.subuiContainer.addEventListener('dblclick', (e) => {
      e.stopPropagation();
    });

    DOMElements.subuiContainer.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    DOMElements.subuiContainer.addEventListener('keyup', (e) => {
      e.stopPropagation();
    });

    const closeBtn = DOMElements.subuiContainer.getElementsByClassName('close_button')[0];
    closeBtn.addEventListener('click', (e) => {
      DOMElements.subuiContainer.style.display = 'none';
    });
    Utils.setupTabIndex(closeBtn);

    this.subui = {};
    this.subui.searchContainer = document.createElement('div');
    this.subui.searchContainer.classList.add('subtitle-search-container');

    DOMElements.subuiContainer.appendChild(this.subui.searchContainer);


    const searchInput = Utils.create('input', null, 'text_input');
    searchInput.placeholder = 'Search by title, filename, etc...';
    searchInput.classList.add('subtitle-search-input');
    this.subui.searchContainer.appendChild(searchInput);

    this.subui.search = searchInput;

    const searchBtn = Utils.create('div', 'Search', 'subtitle-search-btn');
    searchBtn.textContent = 'Search';
    Utils.setupTabIndex(searchBtn);
    this.subui.searchContainer.appendChild(searchBtn);


    const seasonInput = Utils.create('input', null, 'text_input');
    seasonInput.placeholder = 'Season #';
    seasonInput.classList.add('subtitle-season-input');
    seasonInput.style.display = 'none';

    const episodeInput = Utils.create('input', null, 'text_input');
    episodeInput.placeholder = 'Episode #';
    episodeInput.classList.add('subtitle-episode-input');
    episodeInput.style.display = 'none';

    const typeSelector = Utils.createDropdown('all',
        'Type', {
          'all': 'All',
          'movie': 'Movie',
          'episode': 'Episode',
        }, (val) => {
          if (val == 'episode') {
            seasonInput.style.display = '';
            episodeInput.style.display = '';
          } else {
            seasonInput.style.display = 'none';
            episodeInput.style.display = 'none';
          }
        },
    );

    typeSelector.classList.add('subtitle-type-selector');

    this.subui.searchContainer.appendChild(typeSelector);
    this.subui.searchContainer.appendChild(seasonInput);
    this.subui.searchContainer.appendChild(episodeInput);


    const languageInput = Utils.create('input', null, 'text_input');
    languageInput.placeholder = 'Language';
    languageInput.classList.add('subtitle-language-input');
    languageInput.value = this.settings['default-lang'];
    this.subui.searchContainer.appendChild(languageInput);

    const yearInput = Utils.create('input', null, 'text_input');
    yearInput.placeholder = 'Year';
    yearInput.classList.add('subtitle-year-input');
    this.subui.searchContainer.appendChild(yearInput);


    const sortSelector = Utils.createDropdown('download_count',
        'Sort By', {
          'download_count': 'Downloads',
          'upload_date': 'Upload Date',
          'rating': 'Rating',
          'votes': 'Votes',
        },
    );
    sortSelector.classList.add('subtitle-sort-selector');
    this.subui.searchContainer.appendChild(sortSelector);


    const sortDirectionSelector = Utils.createDropdown('desc',
        'Sort', {
          'desc': 'Descending',
          'asc': 'Ascending',
        },
    );

    sortDirectionSelector.classList.add('subtitle-sort-direction-selector');
    this.subui.searchContainer.appendChild(sortDirectionSelector);


    const searchOnEnter = (e) => {
      if (e.key == 'Enter') {
        e.stopPropagation();
        this.subui.search.blur();
        this.queryOpenSubtitles({
          query: this.subui.search.value,
          type: typeSelector.dataset.val,
          season: seasonInput.value,
          episode: episodeInput.value,
          language: languageInput.value,
          year: yearInput.value,
          sortBy: sortSelector.dataset.val,
          sortDirection: sortDirectionSelector.dataset.val,
          page: 1,
        });
      }
    };

    this.subui.search.addEventListener('keydown', searchOnEnter, true);
    languageInput.addEventListener('keydown', searchOnEnter, true);
    yearInput.addEventListener('keydown', searchOnEnter, true);
    seasonInput.addEventListener('keydown', searchOnEnter, true);
    episodeInput.addEventListener('keydown', searchOnEnter, true);
    typeSelector.addEventListener('keydown', searchOnEnter, true);
    sortSelector.addEventListener('keydown', searchOnEnter, true);
    sortDirectionSelector.addEventListener('keydown', searchOnEnter, true);

    searchBtn.addEventListener('click', (e) => {
      this.queryOpenSubtitles({
        query: this.subui.search.value,
        type: typeSelector.dataset.val,
        season: seasonInput.value,
        episode: episodeInput.value,
        language: languageInput.value,
        year: yearInput.value,
        sortBy: sortSelector.dataset.val,
        sortDirection: sortDirectionSelector.dataset.val,
        page: 1,
      });
    });

    this.subui.results = document.createElement('div');
    this.subui.results.classList.add('subtitle-results');
    DOMElements.subuiContainer.appendChild(this.subui.results);
  }
  async queryOpenSubtitles(query) {
    const defaulQuery = {
      page: '1',
      type: 'all',
    };
    const translatedQuery = {
      query: '' + query.query,
      type: '' + query.type,
      languages: '' + query.language,
      year: '' + query.year,
      order_by: '' + query.sortBy,
      sort_direction: '' + query.sortDirection,
      page: '' + query.page,
    };

    if (query.type === 'episode') {
      translatedQuery.season_number = '' + query.season;
      translatedQuery.episode_number = '' + query.episode;
    }
    console.log(translatedQuery);

    // sort query alphabetically
    const sortedQuery = {};
    Object.keys(translatedQuery).sort().forEach(function(key) {
      if (translatedQuery[key].length > 0 && translatedQuery[key] !== defaulQuery[key]) {
        sortedQuery[key] = translatedQuery[key];
      }
    });

    this.subui.results.innerHTML = '';
    const container = document.createElement('div');
    container.textContent = 'Searching...';
    this.subui.results.appendChild(container);


    let data;
    try {
      const response = (await Utils.request({
        usePlusForSpaces: true,
        responseType: 'json',
        url: 'https://api.opensubtitles.com/api/v1/subtitles',
        query: sortedQuery,
        headers: {
          'Api-Key': API_KEY,
        },
        header_commands: [
          {
            operation: 'set',
            header: 'User-Agent',
            value: 'FastStream V' + this.client.version,
          },
        ],
      })).response;

      if (response.errors) {
        container.textContent = 'Error: ' + response.errors.join(', ');
        return;
      }

      data = response.data || [];
    } catch (e) {
      console.log(e);
      container.textContent = 'OpenSubtitles is down!';
      return;
    }


    this.subui.results.innerHTML = '';

    if (data.length === 0) {
      const container = document.createElement('div');
      container.textContent = 'No results found';
      this.subui.results.appendChild(container);
      return;
    }

    data.forEach((item) => {
      const container = document.createElement('div');
      container.style = 'position: relative; overflow-y: scroll; user-select: none; cursor: pointer; font-family: Arial; font-size: 15px; width: 100%; height: 50px; color: rgba(255,255,255,.8); border-top: 1px solid rgba(255,255,255,0.1)';
      this.subui.results.appendChild(container);

      const lang = document.createElement('div');
      lang.style = 'position: absolute; top: 50%; transform: translate(0%, -50%); left: 0px; text-align: center; width: 100px;';
      lang.textContent = item.attributes.language;
      container.appendChild(lang);

      const title = document.createElement('div');
      title.style = 'position: absolute; left: 100px; width: calc(100% - 300px); top: 50%; padding: 0px 10px; transform: translate(0%, -50%);';
      title.textContent = item.attributes.feature_details.movie_name + ' (' + item.attributes.feature_details.year + ')';
      container.appendChild(title);

      const user = document.createElement('div');
      user.style = 'position: absolute; right: 60px; width: 100px; top: 50%; padding: 0px 10px; transform: translate(0%, -50%);';
      user.textContent = item.attributes.uploader.name;
      container.appendChild(user);


      const rank = document.createElement('div');
      rank.style = 'position: absolute; right: 0px; width: 50px; top: 50%; transform: translate(0%, -50%);';
      rank.textContent = item.attributes.ratings;
      container.appendChild(rank);

      Utils.setupTabIndex(container);
      container.addEventListener('mouseenter', (e) => {
        container.style.color = 'rgba(255,200,200,.8)';
      });
      container.addEventListener('mouseleave', (e) => {
        container.style.color = 'rgba(255,255,255,.8)';
      });
      container.addEventListener('click', async (e) => {
        console.log(item.attributes.files[0].file_id);
        let body;
        if (item.downloading) {
          alert('Already downloading!');
          return;
        }

        item.downloading = true;

        try {
          let link = item.cached_download_link;
          if (!link) {
            const data = (await Utils.request({
              type: 'POST',
              url: 'https://api.opensubtitles.com/api/v1/download',
              responseType: 'json',
              headers: {
                'Api-Key': API_KEY,
                'Content-Type': 'application/json',
              },

              header_commands: [
                {
                  operation: 'set',
                  header: 'User-Agent',
                  value: 'FastStream V' + this.client.version,
                },
              ],

              data: JSON.stringify({
                file_id: item.attributes.files[0].file_id,
                sub_format: 'webvtt',
              }),
            })).response;

            if (!data.link && data.remaining <= 0) {
              item.downloading = false;
              alert(`OpenSubtitles limits subtitle downloads! You have no more downloads left! Your quota resets in ` + data.reset_time);
              if (confirm('Would you like to open the OpenSubtitles website to download the subtitle file manually?')) {
                window.open(item.attributes.url);
              }
              return;
            }

            if (!data.link) {
              throw new Error('No link');
            }

            item.cached_download_link = data.link;
            link = data.link;
          }

          body = (await Utils.request({
            url: link,

            header_commands: [
              {
                operation: 'set',
                header: 'User-Agent',
                value: 'FastStream V' + this.client.version,
              },
            ],
          }));

          if (body.status < 200 || body.status >= 300) {
            throw new Error('Bad status code');
          }

          body = body.responseText;

          if (!body) {
            throw new Error('No body');
          }
        } catch (e) {
          console.log(e);
          if (DOMElements.subuiContainer.style.display == 'none') return;
          item.downloading = false;
          alert(`OpenSubtitles download failed! Their servers are probably down!`);
          if (confirm('Would you like to open the OpenSubtitles website to download the subtitle file manually?')) {
            window.open(item.attributes.url);
          }
          return;
        }

        item.downloading = false;
        const track = new SubtitleTrack(item.attributes.uploader.name + ' - ' + item.attributes.feature_details.movie_name, item.attributes.language);
        track.loadText(body);
        this.addTrack(track);
        this.activateTrack(track);
      });
    });
  }

  updateTrackList() {
    DOMElements.subtitlesList.innerHTML = '';

    const tracks = this.tracks;
    for (let i = 0; i < tracks.length; i++) {
      ((i) => {
        const track = tracks[i];
        const trackElement = document.createElement('div');
        trackElement.style = 'position: relative; border-bottom: 1px solid rgba(255,255,255,.4); padding: 3px 5px; color: rgba(255,255,255,.8)';

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

        Utils.setupTabIndex(trackElement);

        const resyncTool = document.createElement('div');
        resyncTool.style = 'display: none; position: absolute; right: 60px; top: 50%; transform: translate(0%,-50%); opacity: 0.7';
        resyncTool.title = 'Resync Tool';
        resyncTool.className = 'fluid_button fluid_button_wand';
        trackElement.appendChild(resyncTool);

        resyncTool.addEventListener('click', (e) => {
          this.client.subtitleSyncer.toggleTrack(track);
          e.stopPropagation();
        }, true);


        const downloadTrack = document.createElement('div');
        // border-left: 10px solid transparent; border-right: 10px solid transparent; border-top: 10px solid rgba(200,200,200,.4);
        downloadTrack.style = 'display: none; position: absolute; right: 10px; top: 50%; transform: translate(0%,-50%); opacity: 0.7';
        downloadTrack.title = 'Download subtitle file';
        downloadTrack.className = 'fluid_button fluid_button_download';
        trackElement.appendChild(downloadTrack);

        downloadTrack.addEventListener('click', (e) => {
          e.stopPropagation();
          const dlname = prompt('Enter a name for the subtitle download file', name + '.srt');

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
        removeTrack.style = 'display: none; position: absolute; right: 5px; top: 50%; width: 10px; height: 10px; transform: translate(0%,-50%); color: rgba(100,100,100,.5); background-color: rgba(255,0,0,.5); border-radius: 50%;';
        removeTrack.title = 'Remove subtitle track';
        trackElement.appendChild(removeTrack);

        removeTrack.addEventListener('click', (e) => {
          this.removeTrack(track);
          e.stopPropagation();
        }, true);


        const shiftLTrack = document.createElement('div');
        shiftLTrack.style = 'display: none; position: absolute; right: 55px; top: 50%; width: 0px; height: 0px; transform: translate(0%,-50%); border-right: 8px solid rgba(255,255,255,.5); border-bottom: 8px solid transparent; border-top: 8px solid transparent;';
        shiftLTrack.title = 'Shift subtitles -0.2s';
        trackElement.appendChild(shiftLTrack);

        shiftLTrack.addEventListener('click', (e) => {
          track.shift(-0.2);
          this.renderSubtitles();
          this.client.subtitleSyncer.onVideoTimeUpdate();
          e.stopPropagation();
        }, true);

        const shiftRTrack = document.createElement('div');
        shiftRTrack.style = 'display: none; position: absolute; right: 40px; top: 50%; width: 0px; height: 0px; transform: translate(0%,-50%); border-left: 8px solid rgba(255,255,255,.5); border-bottom: 8px solid transparent; border-top: 8px solid transparent;';
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

        trackElement.addEventListener('focus', () => {
          downloadTrack.style.display = shiftRTrack.style.display = shiftLTrack.style.display = removeTrack.style.display = resyncTool.style.display = 'block';
        });
        trackElement.addEventListener('mouseleave', () => {
          trackElement.blur();
        });

        trackElement.addEventListener('blur', () => {
          downloadTrack.style.display = shiftRTrack.style.display = shiftLTrack.style.display = removeTrack.style.display = resyncTool.style.display = 'none';
        });

        trackElement.addEventListener('keydown', (e)=>{
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
    trackContainer.style.color = this.settings.color;
    trackContainer.style.fontSize = this.settings['font-size'];
    trackContainer.style.backgroundColor = this.settings.background;
  }
  renderSubtitles() {
    DOMElements.subtitlesContainer.innerHTML = '';

    if (this.isTesting) {
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
    this.subui.search.value = this.client.mediaName;
  }
}
