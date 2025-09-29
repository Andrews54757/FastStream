import {SubtitleTrack} from '../../SubtitleTrack.mjs';
import {Localize} from '../../modules/Localize.mjs';
import {EventEmitter} from '../../modules/eventemitter.mjs';
import {AlertPolyfill} from '../../utils/AlertPolyfill.mjs';
import {InterfaceUtils} from '../../utils/InterfaceUtils.mjs';
import {RequestUtils} from '../../utils/RequestUtils.mjs';
import {WebUtils} from '../../utils/WebUtils.mjs';
import {DOMElements} from '../DOMElements.mjs';
import {createDropdown} from '../components/Dropdown.mjs';
import {createPagesBar} from '../components/PagesBar.mjs';

const API_KEY = 'jolY3ZCVYguxFxl8CkIKl52zpHJT2eTw';

export const OpenSubtitlesSearchEvents = {
  TRACK_DOWNLOADED: 'trackDownloaded',
};

export class OpenSubtitlesSearch extends EventEmitter {
  constructor(version) {
    super();
    this.subui = {};
    this.verison = version;
    this.setupUI();
  }

  openUI() {
    InterfaceUtils.closeWindows();
    DOMElements.subuiContainer.style.display = '';
    this.subui.search.focus();
  }

  closeUI() {
    DOMElements.subuiContainer.style.display = 'none';
  }

  isOpen() {
    return DOMElements.subuiContainer.style.display !== 'none';
  }

  toggleUI() {
    if (!this.isOpen()) {
      this.openUI();
    } else {
      this.closeUI();
    }
  }

  setupUI() {
    DOMElements.subuiContainer.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    DOMElements.subuiContainer.addEventListener('dblclick', (e) => {
      e.stopPropagation();
    });

    DOMElements.subuiContainer.addEventListener('keyup', (e) => {
      e.stopPropagation();
    });

    const closeBtn = DOMElements.subuiContainer.getElementsByClassName('close_button')[0];
    closeBtn.addEventListener('click', (e) => {
      this.closeUI();
    });

    WebUtils.setupTabIndex(closeBtn);
    const contentContainer = DOMElements.subuiContainer.getElementsByClassName('content_container')[0];

    this.subui.searchContainer = document.createElement('div');
    this.subui.searchContainer.classList.add('subtitle-search-container');

    contentContainer.appendChild(this.subui.searchContainer);

    const searchInput = WebUtils.create('input', null, 'text_input');
    searchInput.placeholder = Localize.getMessage('player_opensubtitles_search_placeholder');
    searchInput.classList.add('subtitle-search-input');
    searchInput.ariaLabel = searchInput.placeholder;
    searchInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    this.subui.searchContainer.appendChild(searchInput);

    this.subui.search = searchInput;

    const searchBtn = WebUtils.create('div', null, 'textbutton subtitle-search-btn');
    searchBtn.textContent = Localize.getMessage('player_opensubtitles_searchbtn');
    WebUtils.setupTabIndex(searchBtn);
    this.subui.searchContainer.appendChild(searchBtn);


    const seasonInput = WebUtils.create('input', null, 'text_input');
    seasonInput.placeholder = Localize.getMessage('player_opensubtitles_seasonnum');
    seasonInput.classList.add('subtitle-season-input');
    seasonInput.style.display = 'none';
    seasonInput.ariaLabel = seasonInput.placeholder;
    seasonInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });
    this.subui.seasonInput = seasonInput;

    const episodeInput = WebUtils.create('input', null, 'text_input');
    episodeInput.placeholder = Localize.getMessage('player_opensubtitles_episodenum');
    episodeInput.classList.add('subtitle-episode-input');
    episodeInput.style.display = 'none';
    episodeInput.ariaLabel = episodeInput.placeholder;
    episodeInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });
    this.subui.episodeInput = episodeInput;

    const typeSelector = createDropdown('all',
        'Type', {
          'all': Localize.getMessage('player_opensubtitles_type_all'),
          'movie': Localize.getMessage('player_opensubtitles_type_movie'),
          'episode': Localize.getMessage('player_opensubtitles_type_episode'),
        }, (val) => {
          if (val === 'episode') {
            seasonInput.style.display = '';
            episodeInput.style.display = '';
          } else {
            seasonInput.style.display = 'none';
            episodeInput.style.display = 'none';
          }
        },
    );

    this.subui.typeSelector = typeSelector;

    typeSelector.classList.add('subtitle-type-selector');

    this.subui.searchContainer.appendChild(typeSelector);
    this.subui.searchContainer.appendChild(seasonInput);
    this.subui.searchContainer.appendChild(episodeInput);


    const languageInput = WebUtils.create('input', null, 'text_input');
    languageInput.placeholder = Localize.getMessage('player_opensubtitles_language');
    languageInput.classList.add('subtitle-language-input');
    languageInput.ariaLabel = languageInput.placeholder;
    this.subui.searchContainer.appendChild(languageInput);
    this.subui.languageInput = languageInput;
    languageInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    const yearInput = WebUtils.create('input', null, 'text_input');
    yearInput.placeholder = Localize.getMessage('player_opensubtitles_year');
    yearInput.classList.add('subtitle-year-input');
    yearInput.ariaLabel = yearInput.placeholder;
    this.subui.searchContainer.appendChild(yearInput);
    this.subui.yearInput = yearInput;
    yearInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    const sortSelector = createDropdown('download_count',
        Localize.getMessage('player_opensubtitles_sortby'), {
          'download_count': Localize.getMessage('player_opensubtitles_sortby_downloads'),
          'upload_date': Localize.getMessage('player_opensubtitles_sortby_date'),
          'rating': Localize.getMessage('player_opensubtitles_sortby_rating'),
          'votes': Localize.getMessage('player_opensubtitles_sortby_votes'),
        },
    );
    sortSelector.classList.add('subtitle-sort-selector');
    this.subui.searchContainer.appendChild(sortSelector);


    const sortDirectionSelector = createDropdown('desc',
        Localize.getMessage('player_opensubtitles_sort'), {
          'desc': Localize.getMessage('player_opensubtitles_sort_desc'),
          'asc': Localize.getMessage('player_opensubtitles_sort_asc'),
        },
    );

    sortDirectionSelector.classList.add('subtitle-sort-direction-selector');
    this.subui.searchContainer.appendChild(sortDirectionSelector);


    const searchOnEnter = (e) => {
      if (e.key === 'Enter') {
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
        this.saveToSession();
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
      this.saveToSession();
    });

    this.subui.results = document.createElement('div');
    this.subui.results.classList.add('subtitle-results');
    contentContainer.appendChild(this.subui.results);

    this.subui.pages = document.createElement('div');
    this.subui.pages.classList.add('subtitle-pages');
    contentContainer.appendChild(this.subui.pages);

    this.loadFromSession();
  }

  loadFromSession() {
    const inputDataStr = sessionStorage.getItem('subtitleSearch');
    if (!inputDataStr) {
      return;
    }

    const inputData = JSON.parse(inputDataStr);

    this.subui.search.value = inputData.query;
    this.subui.languageInput.value = inputData.language;
    Array.from(this.subui.typeSelector.children[1].children).find((el) => el.dataset.val === inputData.type)?.click();
    this.subui.yearInput.value = inputData.year;
    this.subui.seasonInput.value = inputData.season;
    this.subui.episodeInput.value = inputData.episode;
  }

  saveToSession() {
    const inputData = {
      query: this.subui.search.value,
      language: this.subui.languageInput.value,
      type: this.subui.typeSelector.dataset.val,
      year: this.subui.yearInput.value,
      season: this.subui.seasonInput.value,
      episode: this.subui.episodeInput.value,
    };

    sessionStorage.setItem('subtitleSearch', JSON.stringify(inputData));
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
      order_direction: '' + query.sortDirection,
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

    this.subui.results.replaceChildren();
    const container = document.createElement('div');
    container.textContent = Localize.getMessage('player_opensubtitles_searching');
    this.subui.results.appendChild(container);

    let response;
    try {
      response = (await RequestUtils.request({
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
            value: 'FastStream V' + this.version,
          },
        ],
      })).response;

      if (response.errors) {
        container.textContent = Localize.getMessage('player_opensubtitles_error', [response.errors.join(', ')]);
        return;
      }
    } catch (e) {
      console.log(e);
      if (!chrome?.extension) {
        container.textContent = Localize.getMessage('player_opensubtitles_disabled');
      } else {
        container.textContent = Localize.getMessage('player_opensubtitles_error_down');
      }
      return;
    }


    this.subui.results.replaceChildren();
    this.subui.pages.replaceChildren();

    if (response.data.length === 0) {
      const container = document.createElement('div');
      container.textContent = Localize.getMessage('player_opensubtitles_noresults');
      this.subui.results.appendChild(container);
      return;
    }

    if (response.total_pages > 1) {
      const responseBar = createPagesBar(response.page, response.total_pages, (page) => {
        query.page = page;
        this.subui.pages.replaceChildren();
        this.subui.pages.appendChild(createPagesBar(page, response.total_pages, ()=>{
          this.queryOpenSubtitles(query);
        }));
        this.queryOpenSubtitles(query);
      });
      this.subui.pages.appendChild(responseBar);
    }

    response.data.forEach((item) => {
      const container = document.createElement('div');
      container.classList.add('subtitle-result-container');
      this.subui.results.appendChild(container);

      const lang = document.createElement('div');
      lang.classList.add('subtitle-result-lang');
      lang.textContent = item.attributes.language;
      container.appendChild(lang);

      const title = document.createElement('div');
      title.classList.add('subtitle-result-title');
      title.textContent = item.attributes.feature_details.movie_name + ' (' + item.attributes.feature_details.year + ')';
      container.appendChild(title);

      const user = document.createElement('div');
      user.classList.add('subtitle-result-user');
      user.textContent = item.attributes.uploader.name;
      container.appendChild(user);


      const rank = document.createElement('div');
      rank.classList.add('subtitle-result-rank');
      rank.textContent = item.attributes.ratings;
      container.appendChild(rank);

      WebUtils.setupTabIndex(container);
      container.addEventListener('click', async (e) => {
        console.log(item.attributes.files[0].file_id);
        let body;
        if (item.downloading) {
          return;
        }

        item.downloading = true;

        AlertPolyfill.toast('info', Localize.getMessage('player_subtitles_addtrack_downloading'));

        try {
          let link = item.cached_download_link;
          if (!link) {
            const data = (await RequestUtils.request({
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
                  value: 'FastStream V' + this.version,
                },
              ],

              data: JSON.stringify({
                file_id: item.attributes.files[0].file_id,
                sub_format: 'webvtt',
              }),
            })).response;

            if (!data.link && data.remaining <= 0) {
              item.downloading = false;
              await AlertPolyfill.alert(Localize.getMessage('player_opensubtitles_quota', [data.reset_time]), 'warning');
              if (await AlertPolyfill.confirm(Localize.getMessage('player_opensubtitles_askopen'), 'question')) {
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

          body = (await RequestUtils.request({
            url: link,

            header_commands: [
              {
                operation: 'set',
                header: 'User-Agent',
                value: 'FastStream V' + this.version,
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
          if (DOMElements.subuiContainer.style.display === 'none') return;
          item.downloading = false;
          await AlertPolyfill.alert(Localize.getMessage('player_opensubtitles_down_alert'), 'error');
          if (await AlertPolyfill.confirm(Localize.getMessage('player_opensubtitles_askopen'), 'question')) {
            window.open(item.attributes.url);
          }
          return;
        }

        item.downloading = false;
        try {
          const track = new SubtitleTrack(item.attributes.uploader.name + ' - ' + item.attributes.feature_details.movie_name, item.attributes.language);
          track.loadText(body);
          this.emit(OpenSubtitlesSearchEvents.TRACK_DOWNLOADED, track);
          AlertPolyfill.toast('success', Localize.getMessage('player_subtitles_addtrack_success'));
        } catch (e) {
          AlertPolyfill.toast('error', Localize.getMessage('player_subtitles_addtrack_error'), e?.message);
        }
      });
    });
  }

  setMediaInfo(info) {
    if (!info) {
      return;
    }

    if (info.name) {
      this.subui.search.value = info.name;
    }

    if (info.season) {
      this.subui.seasonInput.value = info.season;
    }

    if (info.episode) {
      this.subui.episodeInput.value = info.episode;
    }
  }

  setLanguageInputValue(value) {
    this.subui.languageInput.value = value;
  }
}
