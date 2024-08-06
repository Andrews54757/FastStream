import {SubtitleTrack} from '../SubtitleTrack.mjs';
import {VideoSource} from '../VideoSource.mjs';
import {PlayerModes} from '../enums/PlayerModes.mjs';
import {Localize} from '../modules/Localize.mjs';
import {streamSaver} from '../modules/StreamSaver.mjs';
import {EnvUtils} from '../utils/EnvUtils.mjs';
import {FastStreamArchiveUtils} from '../utils/FastStreamArchiveUtils.mjs';
import {RequestUtils} from '../utils/RequestUtils.mjs';
import {StringUtils} from '../utils/StringUtils.mjs';
import {URLUtils} from '../utils/URLUtils.mjs';
import {WebUtils} from '../utils/WebUtils.mjs';
import {DOMElements} from './DOMElements.mjs';

export class SaveManager {
  constructor(client) {
    this.client = client;
    this.downloadURL = null;
    this.reuseDownloadURL = false;
  }

  setupUI() {
    DOMElements.playerContainer.addEventListener('drop', this.onFileDrop.bind(this), false);

    DOMElements.download.addEventListener('click', this.saveVideo.bind(this));
    WebUtils.setupTabIndex(DOMElements.download);

    DOMElements.screenshot.addEventListener('click', this.saveScreenshot.bind(this));
    WebUtils.setupTabIndex(DOMElements.screenshot);
  }

  setStatusMessage(key, message, type, expiry) {
    this.client.interfaceController.setStatusMessage(key, message, type, expiry);
  }

  async saveScreenshot() {
    if (!this.client.player) {
      alert(Localize.getMessage('player_nosource_alert'));
      return;
    }

    const suggestedName = (this.client.mediaName || 'video').replaceAll(' ', '_') + '@' + StringUtils.formatTime(this.client.currentTime);
    const name = EnvUtils.isIncognito() ? suggestedName : prompt(Localize.getMessage('player_filename_prompt'), suggestedName);

    if (!name) {
      return;
    }

    this.setStatusMessage('save-screenshot', Localize.getMessage('player_screenshot_saving'), 'info');
    try {
      const video = this.client.player.getVideo();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const url = canvas.toDataURL('image/png'); // For some reason this is faster than async toBlob
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', name + '.png');
      link.setAttribute('target', '_blank');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      this.setStatusMessage('save-screenshot', Localize.getMessage('player_screenshot_saved'), 'info', 1000);
    } catch (e) {
      console.error(e);
      this.setStatusMessage('save-screenshot', Localize.getMessage('player_screenshot_fail'), 'error', 2000);
    }
  }

  async saveVideo(e) {
    if (!this.client.player) {
      alert(Localize.getMessage('player_nosource_alert'));
      return;
    }

    if (this.makingDownload) {
      if (this.downloadCancel) {
        this.downloadCancel();
        DOMElements.saveNotifBanner.style.color = 'gold';
        this.setStatusMessage('save-video', Localize.getMessage('player_savevideo_cancelling'), 'info');
      } else {
        alert(Localize.getMessage('player_savevideo_inprogress_alert'));
      }
      return;
    }

    const doPartial = e.altKey;
    const doDump = e.shiftKey;
    const player = this.client.player;

    const {canSave, isComplete, canStream} = player.canSave();

    if (!canSave && !doDump) {
      alert(Localize.getMessage('player_savevideo_unsupported'));
      return;
    }

    if (doPartial && !isComplete) {
      const res = confirm(Localize.getMessage('player_savevideo_partial_confirm'));
      if (!res) {
        return;
      }
    }

    if (!doPartial && !isComplete && EnvUtils.isIncognito()) {
      const res = confirm(Localize.getMessage('player_savevideo_incognito_confirm'));
      if (!res) {
        return;
      }
    }

    const suggestedName = (this.client.mediaName || 'video').replaceAll(' ', '_');
    const name = EnvUtils.isIncognito() ? suggestedName : prompt(Localize.getMessage('player_filename_prompt'), suggestedName);

    if (!name) {
      return;
    }

    if (doDump) {
      this.dumpBuffer(name);
      return;
    }

    let url;
    let filestream;
    if (canStream) {
      filestream = streamSaver.createWriteStream(name + '.mp4');
    }

    if (this.reuseDownloadURL && this.downloadURL && isComplete) {
      url = this.downloadURL;
    } else {
      this.reuseDownloadURL = isComplete;
      let result;
      this.makingDownload = true;
      this.setStatusMessage('save-video', Localize.getMessage('player_savevideo_start'), 'info');
      DOMElements.saveNotifBanner.style.display = '';
      DOMElements.saveNotifBanner.style.color = '';
      try {
        const start = performance.now();
        result = await player.saveVideo({
          onProgress: (progress) => {
            this.setStatusMessage('save-video', Localize.getMessage('player_savevideo_progress', [Math.floor(progress * 100)]), 'info');
          },
          registerCancel: (cancel) => {
            this.downloadCancel = cancel;
          },
          filestream,
          partialSave: doPartial,
        });
        const end = performance.now();
        console.log('Save took ' + (end - start) / 1000 + 's');
      } catch (e) {
        console.error(e);
        this.setStatusMessage('save-video', Localize.getMessage('player_savevideo_fail'), 'error', 2000);
        this.makingDownload = false;
        this.downloadCancel = null;
        DOMElements.saveNotifBanner.style.display = 'none';

        if (confirm(Localize.getMessage('player_savevideo_failed_ask_archive'))) {
          this.dumpBuffer(name);
        }
        return;
      }

      DOMElements.saveNotifBanner.style.display = 'none';
      this.downloadCancel = null;
      this.makingDownload = false;

      if (this.downloadURL) {
        URL.revokeObjectURL(this.downloadURL);
        this.downloadURL = null;
      }

      if (!result || result.cancelled) {
        this.setStatusMessage('save-video', Localize.getMessage('player_savevideo_cancelled'), 'info', 2000);
        return;
      }

      this.setStatusMessage('save-video', Localize.getMessage('player_savevideo_complete'), 'info', 2000);

      if (!canStream) {
        url = URL.createObjectURL(result.blob);
      }

      setTimeout(() => {
        if (this.downloadURL !== url) return;

        if (this.downloadURL) {
          URL.revokeObjectURL(this.downloadURL);
          this.downloadURL = null;
          this.reuseDownloadURL = false;
        }
      }, 10000);
    }

    if (!canStream) {
      this.downloadURL = url;

      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', name + '.mp4');
      link.setAttribute('target', '_blank');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  async dumpBuffer(name) {
    const entries = this.client.downloadManager.getCompletedEntries();
    const filestream = streamSaver.createWriteStream(name + '.fsa');
    try {
      await FastStreamArchiveUtils.writeFSAToStream(filestream, this.client.player, entries, (progress)=>{
        this.setStatusMessage('save-video', Localize.getMessage('player_archiver_progress', [Math.floor(progress * 100)]), 'info');
      });

      this.setStatusMessage('save-video', Localize.getMessage('player_archiver_saved'), 'info', 2000);
    } catch (e) {
      console.error(e);
      this.setStatusMessage('save-video', 'Unreachable Error', 'error', 2000);
    }
  }

  async onFileDrop(e) {
    e.stopPropagation();
    e.preventDefault();

    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length === 0) {
      return;
    }
    const captions = [];
    const audioFormats = [
      'mp3',
      'wav',
      'm4a',
      'm4r',
      'mkv',
      'webm',
    ];

    const subtitleFormats = [
      'vtt',
      'srt',
      'xml',
    ];

    let newSource = null;
    let newEntries = null;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = URLUtils.get_url_extension(file.name);

      if (ext === 'json') {
        const fsprofile = await file.text();
        const data = JSON.parse(fsprofile);

        if (data?.type === 'audioProfile') {
          this.client.audioConfigManager.loadProfileFile(data);
        }
      } else if (subtitleFormats.includes(ext)) {
        captions.push({
          url: window.URL.createObjectURL(file),
          name: file.name.substring(0, file.name.length - 4),
        });
      } else if (audioFormats.includes(ext)) {
        newSource = new VideoSource(window.URL.createObjectURL(file), {}, PlayerModes.DIRECT);
        newSource.identifier = file.name + 'size' + file.size;
      } else if (URLUtils.getModeFromExtension(ext)) {
        let mode = URLUtils.getModeFromExtension(ext);
        if (mode === PlayerModes.ACCELERATED_MP4) {
          mode = PlayerModes.DIRECT;
        }
        newSource = new VideoSource(window.URL.createObjectURL(file), {}, mode);
        newSource.identifier = file.name + 'size' + file.size;
      } else if (ext === 'fsa') {
        const buffer = await RequestUtils.httpGetLarge(window.URL.createObjectURL(file));
        try {
          const {source, entries, currentLevel, currentAudioLevel} = await FastStreamArchiveUtils.parseFSA(buffer, (progress)=>{
            this.setStatusMessage('save-video', Localize.getMessage('player_archive_loading', [Math.floor(progress * 100)]), 'info');
          }, this.client.downloadManager);

          newEntries = entries;

          newSource = new VideoSource(source.url, null, source.mode);
          newSource.identifier = source.identifier;
          newSource.headers = source.headers;
          newSource.defaultLevelInfo = {
            level: currentLevel,
            audioLevel: currentAudioLevel,
          };

          this.setStatusMessage('save-video', Localize.getMessage('player_archive_loaded'), 'info', 2000);
        } catch (e) {
          console.error(e);
          this.setStatusMessage('save-video', Localize.getMessage('player_archive_fail'), 'error', 2000);
        }
      }
    }

    if (newSource) {
      if (newEntries) {
        this.client.downloadManager.resetOverride(true);
        this.client.downloadManager.setEntries(newEntries);
      }

      try {
        await this.client.addSource(newSource, true);
      } catch (e) {
        console.error(e);
      }

      if (newEntries) {
        this.client.downloadManager.resetOverride(false);
      }
    }

    (await Promise.all(captions.map(async (file) => {
      const track = new SubtitleTrack(file.name);
      await track.loadURL(file.url);
      return track;
    }))).forEach((track) => {
      const returnedTrack = this.client.loadSubtitleTrack(track);
      this.client.interfaceController.subtitlesManager.activateTrack(returnedTrack);
    });

    this.client.play();
  }

  reset() {
    this.reuseDownloadURL = false;
    if (this.downloadURL) {
      URL.revokeObjectURL(this.downloadURL);
    }
    this.downloadURL = null;
  }

  destroy() {
    if (this.downloadURL) {
      URL.revokeObjectURL(this.downloadURL);
      this.downloadURL = null;
    }
  }
}
