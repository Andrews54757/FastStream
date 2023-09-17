import {SubtitleTrack} from '../SubtitleTrack.mjs';
import {EventEmitter} from '../modules/eventemitter.mjs';
import {InterfaceUtils} from '../utils/InterfaceUtils.mjs';
import {RequestUtils} from '../utils/RequestUtils.mjs';
import {WebUtils} from '../utils/WebUtils.mjs';
import {DOMElements} from './DOMElements.mjs';

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

  setupUI() {
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

    DOMElements.playerContainer.addEventListener('click', (e) => {
      this.closeUI();
    });

    const closeBtn = DOMElements.subuiContainer.getElementsByClassName('close_button')[0];
    closeBtn.addEventListener('click', (e) => {
      this.closeUI();
    });

    WebUtils.setupTabIndex(closeBtn);

    this.subui.searchContainer = document.createElement('div');
    this.subui.searchContainer.classList.add('subtitle-search-container');

    DOMElements.subuiContainer.appendChild(this.subui.searchContainer);

    const searchInput = WebUtils.create('input', null, 'text_input');
    searchInput.placeholder = 'Search by title, filename, etc...';
    searchInput.classList.add('subtitle-search-input');
    this.subui.searchContainer.appendChild(searchInput);

    this.subui.search = searchInput;

    const searchBtn = WebUtils.create('div', 'Search', 'subtitle-search-btn');
    searchBtn.textContent = 'Search';
    WebUtils.setupTabIndex(searchBtn);
    this.subui.searchContainer.appendChild(searchBtn);


    const seasonInput = WebUtils.create('input', null, 'text_input');
    seasonInput.placeholder = 'Season #';
    seasonInput.classList.add('subtitle-season-input');
    seasonInput.style.display = 'none';

    const episodeInput = WebUtils.create('input', null, 'text_input');
    episodeInput.placeholder = 'Episode #';
    episodeInput.classList.add('subtitle-episode-input');
    episodeInput.style.display = 'none';

    const typeSelector = WebUtils.createDropdown('all',
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


    const languageInput = WebUtils.create('input', null, 'text_input');
    languageInput.placeholder = 'Language';
    languageInput.classList.add('subtitle-language-input');
    this.subui.searchContainer.appendChild(languageInput);
    this.subui.languageInput = languageInput;

    const yearInput = WebUtils.create('input', null, 'text_input');
    yearInput.placeholder = 'Year';
    yearInput.classList.add('subtitle-year-input');
    this.subui.searchContainer.appendChild(yearInput);


    const sortSelector = WebUtils.createDropdown('download_count',
        'Sort By', {
          'download_count': 'Downloads',
          'upload_date': 'Upload Date',
          'rating': 'Rating',
          'votes': 'Votes',
        },
    );
    sortSelector.classList.add('subtitle-sort-selector');
    this.subui.searchContainer.appendChild(sortSelector);


    const sortDirectionSelector = WebUtils.createDropdown('desc',
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

    this.subui.pages = document.createElement('div');
    this.subui.pages.classList.add('subtitle-pages');
    DOMElements.subuiContainer.appendChild(this.subui.pages);
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

    this.subui.results.replaceChildren();
    const container = document.createElement('div');
    container.textContent = 'Searching...';
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
        container.textContent = 'Error: ' + response.errors.join(', ');
        return;
      }
    } catch (e) {
      console.log(e);
      container.textContent = 'OpenSubtitles is down!';
      return;
    }


    this.subui.results.replaceChildren();
    this.subui.pages.replaceChildren();

    if (response.data.length === 0) {
      const container = document.createElement('div');
      container.textContent = 'No results found';
      this.subui.results.appendChild(container);
      return;
    }

    if (response.total_pages > 1) {
      const responseBar = WebUtils.createPagesBar(response.page, response.total_pages, (page) => {
        query.page = page;
        this.subui.pages.replaceChildren();
        this.subui.pages.appendChild(WebUtils.createPagesBar(page, response.total_pages, ()=>{
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

        this.emit(OpenSubtitlesSearchEvents.TRACK_DOWNLOADED, track);
      });
    });
  }

  setQueryInputValue(value) {
    this.subui.search.value = value;
  }

  setLanguageInputValue(value) {
    this.subui.languageInput.value = value;
  }
}
