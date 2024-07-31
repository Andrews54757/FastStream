import {VideoSource} from '../VideoSource.mjs';
import {PlayerModes} from '../enums/PlayerModes.mjs';
import {Localize} from '../modules/Localize.mjs';
import {EnvUtils} from '../utils/EnvUtils.mjs';
import {InterfaceUtils} from '../utils/InterfaceUtils.mjs';
import {URLUtils} from '../utils/URLUtils.mjs';
import {WebUtils} from '../utils/WebUtils.mjs';
import {DOMElements} from './DOMElements.mjs';
import {createDropdown} from './components/Dropdown.mjs';

export class SourcesBrowser {
  constructor(client) {
    this.client = client;

    this.sources = [];
    this.setupUI();
    this.addSource(new VideoSource('', null, PlayerModes.AUTO), true);
  }

  addSource(source, force = false) {
    const existing = this.sources.find((s) => s.equals(source));
    if (existing && !force) {
      return existing;
    }

    this.sources.push(source);

    this.setupSourceListing(source);
    this.updateSources();

    return source;
  }

  setupSourceListing(source) {
    // eslint-disable-next-line prefer-const
    let headersInput;
    const sourceContainer = WebUtils.create('div', null, 'linkui-source');
    this.linkui.sourcesList.insertBefore(sourceContainer, this.linkui.sourcesList.firstChild);

    const sourceURL = WebUtils.create('input', null, 'text_input linkui-source-url');
    sourceURL.value = source.url;
    sourceURL.placeholder = Localize.getMessage('player_source_url_placeholder');
    sourceURL.addEventListener('input', (e) => {
      source.url = sourceURL.value;
      this.updateSources();
    });
    sourceContainer.appendChild(sourceURL);

    const modes = {};

    if (source.mode === PlayerModes.AUTO) {
      modes[PlayerModes.AUTO] = Localize.getMessage('player_source_autodetect');
    }

    modes[PlayerModes.DIRECT] = Localize.getMessage('player_source_direct');
    modes[PlayerModes.ACCELERATED_MP4] = Localize.getMessage('player_source_accelmp4');
    modes[PlayerModes.ACCELERATED_HLS] = Localize.getMessage('player_source_accelhls');
    modes[PlayerModes.ACCELERATED_DASH] = Localize.getMessage('player_source_acceldash');
    if (EnvUtils.isExtension()) {
      modes[PlayerModes.ACCELERATED_YT] = Localize.getMessage('player_source_accelyt');
    }

    const sourceMode = createDropdown(source.mode, Localize.getMessage('player_source_mode'), modes, (val) => {
      source.mode = val;
      this.updateSources();
    });

    sourceMode.classList.add('linkui-source-mode');
    sourceContainer.appendChild(sourceMode);

    sourceURL.addEventListener('change', (e) => {
      if (source.mode === PlayerModes.AUTO) {
        try {
          const mode = URLUtils.getModeFromURL(sourceURL.value);
          Array.from(sourceMode.children[1].children).find((el) => el.dataset.val === mode)?.click();
          Array.from(sourceMode.children[1].children).find((el) => el.dataset.val === PlayerModes.AUTO)?.remove();
        } catch (e) {
          console.error(e);
        }
      }

      source.parseHeadersParam();
      sourceHeadersBtn.textContent = Localize.getMessage('player_source_headerbtn', [Object.keys(source.headers).length]);
      headersInput.value = URLUtils.objToHeadersString(source.headers);
      Array.from(sourceMode.children[1].children).find((el) => el.dataset.val === source.mode)?.click();
      sourceURL.value = source.url;
    });

    sourceURL.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    const sourceHeadersBtn = WebUtils.create('div', null, 'linkui-source-headers-button');
    sourceHeadersBtn.textContent = Localize.getMessage('player_source_headerbtn', [Object.keys(source.headers).length]);
    sourceHeadersBtn.title = Localize.getMessage('player_source_headerbtn_label');

    if (EnvUtils.isExtension()) {
      sourceHeadersBtn.addEventListener('click', (e) => {
        if (headersInput.style.display === 'none') {
          headersInput.style.display = '';
          sourceHeadersBtn.classList.add('active');
        } else {
          headersInput.style.display = 'none';
          sourceHeadersBtn.classList.remove('active');
        }
      });
    } else {
      sourceHeadersBtn.textContent = Localize.getMessage('player_source_headerbtn_disabled');
    }

    WebUtils.setupTabIndex(sourceHeadersBtn);
    sourceContainer.appendChild(sourceHeadersBtn);

    const sourceCopyBtn = WebUtils.create('div', null, 'linkui-source-copy-button');
    sourceCopyBtn.textContent = Localize.getMessage('player_source_copybtn');
    sourceCopyBtn.title = Localize.getMessage('player_source_copybtn_label');
    sourceCopyBtn.addEventListener('click', (e) => {
      let copyURL = '';
      if (source.mode === PlayerModes.ACCELERATED_YT) {
        copyURL = `https://youtu.be/${URLUtils.get_yt_identifier(source.url)}`;
      } else {
        try {
          const url = new URL(source.url);
          if (source.countHeaders() > 0) {
            const headers = JSON.stringify(source.headers);
            url.searchParams.set('faststream-headers', headers);
          }
          url.searchParams.set('faststream-mode', source.mode);
          copyURL = url.toString();
        } catch (e) {
        }
      }

      const input = document.createElement('input');
      input.value = copyURL;
      document.body.appendChild(input);
      input.focus();
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);

      sourceCopyBtn.textContent = Localize.getMessage('player_source_copybtn_copied');
      setTimeout(() => {
        sourceCopyBtn.textContent = Localize.getMessage('player_source_copybtn');
      }, 1000);
    });
    WebUtils.setupTabIndex(sourceCopyBtn);
    sourceContainer.appendChild(sourceCopyBtn);


    const sourceSetBtn = WebUtils.create('div', null, 'linkui-source-set-button');
    sourceSetBtn.textContent = 'Play';
    sourceSetBtn.addEventListener('click', async (e) => {
      if (sourceSetBtn.classList.contains('loading')) return;
      sourceSetBtn.classList.add('loading');
      sourceSetBtn.textContent = Localize.getMessage('player_source_playbtn_loading');
      await this.client.setSource(source);
      this.updateSources();
      this.client.play();
    });
    WebUtils.setupTabIndex(sourceSetBtn);
    sourceContainer.appendChild(sourceSetBtn);

    const sourceDeleteBtn = WebUtils.create('div', null, 'linkui-source-delete-button');
    sourceDeleteBtn.textContent = Localize.getMessage('player_source_deletebtn');
    sourceDeleteBtn.addEventListener('click', (e) => {
      sourceContainer.remove();
      const ind = this.sources.indexOf(source);
      if (ind === -1) return;
      this.sources.splice(ind, 1);
      this.updateSources();
    });
    WebUtils.setupTabIndex(sourceDeleteBtn);
    sourceContainer.appendChild(sourceDeleteBtn);

    headersInput = WebUtils.create('textarea', null, 'text_input linkui-source-headers');
    headersInput.setAttribute('autocapitalize', 'off');
    headersInput.setAttribute('autocomplete', 'off');
    headersInput.setAttribute('autocorrect', 'off');
    headersInput.setAttribute('spellcheck', false);
    headersInput.name = Localize.getMessage('player_source_headers_label');
    headersInput.placeholder = Localize.getMessage('player_source_headers_placeholder');
    headersInput.value = URLUtils.objToHeadersString(source.headers);
    headersInput.addEventListener('input', (e) => {
      if (URLUtils.validateHeadersString(headersInput.value)) {
        headersInput.classList.remove('invalid');
      } else {
        headersInput.classList.add('invalid');
      }

      source.headers = URLUtils.headersStringToObj(headersInput.value);
      sourceHeadersBtn.textContent = Localize.getMessage('player_source_headerbtn', [Object.keys(source.headers).length]);
      this.updateSources();
    });

    headersInput.addEventListener('change', (e) => {
      if (URLUtils.validateHeadersString(headersInput.value)) {
        source.headers = URLUtils.headersStringToObj(headersInput.value);
        headersInput.value = URLUtils.objToHeadersString(source.headers);
      }
    });

    headersInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    headersInput.style.display = 'none';
    sourceContainer.appendChild(headersInput);

    source.sourceBrowserElements = {
      container: sourceContainer,
      url: sourceURL,
      mode: sourceMode,
      headersBtn: sourceHeadersBtn,
      setBtn: sourceSetBtn,
      deleteBtn: sourceDeleteBtn,
    };
  }

  updateSources() {
    let sourceLen = 0;
    this.sources.forEach((source) => {
      if (source.url) {
        sourceLen++;
      }
    });

    if (sourceLen === 0) {
      this.linkui.sourcesFound.textContent = Localize.getMessage('player_source_nonelisted');
    } else if (sourceLen === 1) {
      this.linkui.sourcesFound.textContent = Localize.getMessage('player_source_onelisted');
    } else {
      this.linkui.sourcesFound.textContent = Localize.getMessage('player_source_multilisted', [sourceLen]);
    }
    this.sources.forEach((source) => {
      source.sourceBrowserElements.setBtn.classList.remove('loading');
      if (this.client.source && this.client.source.equals(source)) {
        source.sourceBrowserElements.container.classList.add('active');
        source.sourceBrowserElements.setBtn.textContent = Localize.getMessage('player_source_playbtn_playing');
      } else {
        source.sourceBrowserElements.container.classList.remove('active');
        source.sourceBrowserElements.setBtn.textContent = Localize.getMessage('player_source_playbtn');
      }
    });
  }

  openUI() {
    InterfaceUtils.closeWindows();
    DOMElements.linkuiContainer.style.display = '';
  }

  closeUI() {
    DOMElements.linkuiContainer.style.display = 'none';
  }

  setupUI() {
    DOMElements.linkButton.addEventListener('click', (e) => {
      if (DOMElements.linkuiContainer.style.display === 'none') {
        this.openUI();
      } else {
        this.closeUI();
      }
      e.stopPropagation();
    });

    WebUtils.setupTabIndex(DOMElements.linkButton);

    DOMElements.linkuiContainer.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    DOMElements.linkuiContainer.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeUI();
        e.preventDefault();
        e.stopPropagation();
      }
    });

    DOMElements.linkuiContainer.addEventListener('keyup', (e) => {
      e.stopPropagation();
    });

    DOMElements.playerContainer.addEventListener('click', (e) => {
      this.closeUI();
    });

    const closeBtn = DOMElements.linkuiContainer.getElementsByClassName('close_button')[0];
    closeBtn.addEventListener('click', (e) => {
      this.closeUI();
    });
    WebUtils.setupTabIndex(closeBtn);

    this.linkui = {};

    const contentContainer = DOMElements.linkuiContainer.getElementsByClassName('content_container')[0];

    this.linkui.sourcesFound = WebUtils.create('div', null, 'linkui-sources-found');
    this.linkui.sourcesFound.textContent = Localize.getMessage('player_source_nonelisted');
    contentContainer.appendChild(this.linkui.sourcesFound);

    this.linkui.addNewButton = WebUtils.create('div', null, 'linkui-addnew-button');
    this.linkui.addNewButton.textContent = Localize.getMessage('player_source_addbtn');
    WebUtils.setupTabIndex(this.linkui.addNewButton);
    contentContainer.appendChild(this.linkui.addNewButton);


    this.linkui.addNewButton.addEventListener('click', (e) => {
      this.addSource(new VideoSource('', null, PlayerModes.AUTO), true);
    });


    this.linkui.clearButton = WebUtils.create('div', null, 'linkui-clear-button');
    this.linkui.clearButton.textContent = Localize.getMessage('player_source_clearbtn');
    WebUtils.setupTabIndex(this.linkui.clearButton);
    contentContainer.appendChild(this.linkui.clearButton);

    this.linkui.clearButton.addEventListener('click', (e) => {
      this.sources.length = 0;
      this.linkui.sourcesList.replaceChildren();
      this.updateSources();
    });

    this.linkui.sourcesList = WebUtils.create('div', null, 'linkui-sources-list');
    contentContainer.appendChild(this.linkui.sourcesList);
  }
}
