import {YoutubeClients} from '../../enums/YoutubeClients.mjs';
import {EnvUtils} from '../../utils/EnvUtils.mjs';
import {ClickActions} from './ClickActions.mjs';
import {ColorThemes} from './ColorThemes.mjs';
import {DaltonizerTypes} from './DaltonizerTypes.mjs';
import {DefaultKeybinds} from './DefaultKeybinds.mjs';
import {MiniplayerPositions} from './MiniplayerPositions.mjs';
import {VisChangeActions} from './VisChangeActions.mjs';

export const DefaultOptions = {
  dev: false,
  replaceDelay: 500,
  controlsHideDelay: 2000,
  alwaysShowProgressBar: false,
  playMP4URLs: false,
  playStreamURLs: false,
  analyzeVideos: false,
  downloadAll: true,
  previewEnabled: true,
  autoEnableBestSubtitles: false,
  storeProgress: true,
  autoplayYoutube: EnvUtils.isExtension(),
  autoplayNext: false,
  defaultYoutubeClient: YoutubeClients.WEB,
  defaultQuality: `Auto`,
  colorTheme: ColorThemes.DEFAULT,
  autoEnableAllWebsites: true,
  autoEnableURLs: [],
  customSourcePatterns: ``,
  keybinds: DefaultKeybinds,
  videoBrightness: 1,
  videoContrast: 1,
  videoSaturation: 1,
  videoGrayscale: 0,
  videoSepia: 0,
  videoInvert: 0,
  videoHueRotate: 0,
  videoDaltonizerType: DaltonizerTypes.NONE,
  videoDaltonizerStrength: 1,
  videoZoom: 1,
  maxSpeed: -1,
  maxVideoSize: 5000000000, // 5GB max size
  seekStepSize: 5,
  singleClickAction: ClickActions.PLAY_PAUSE,
  doubleClickAction: ClickActions.SEEK,
  tripleClickAction: ClickActions.SEEK,
  visChangeAction: VisChangeActions.NOTHING,
  miniSize: 0.25,
  miniPos: MiniplayerPositions.BOTTOM_RIGHT,
  videoDelay: 0,
  maximumDownloaders: 6,
  youtubePlayerID: '',

  // Per-tool visibility for the player toolbar. Keys match ToolManager tool ids.
  // NOTE: Core controls (play/pause, volume, fullscreen, settings, more) are always forced visible.
  toolbarButtons: {
    previous: true,
    next: true,
    duration: true,
    sources: true,
    audioconfig: true,
    subtitles: true,
    languages: true,
    quality: true,
    playrate: true,
    download: true,
    screenshot: true,
    pip: true,
    windowedfs: true,
    loop: true,
    forward: true,
    backward: true,
  },
};
