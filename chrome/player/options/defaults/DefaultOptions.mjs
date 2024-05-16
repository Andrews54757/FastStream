import {EnvUtils} from '../../utils/EnvUtils.mjs';
import {ClickActions} from './ClickActions.mjs';
import {DaltonizerTypes} from './DaltonizerTypes.mjs';
import {DefaultKeybinds} from './DefaultKeybinds.mjs';
import {MiniplayerPositions} from './MiniplayerPositions.mjs';
import {VisChangeActions} from './VisChangeActions.mjs';

export const DefaultOptions = {
  playMP4URLs: false,
  playStreamURLs: false,
  analyzeVideos: false,
  downloadAll: true,
  previewEnabled: true,
  autoEnableBestSubtitles: false,
  storeProgress: true,
  autoplayYoutube: EnvUtils.isExtension(),
  defaultQuality: `Auto`,
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
  maxSpeed: -1,
  maxVideoSize: 5000000000, // 5GB max size
  seekStepSize: 2,
  singleClickAction: ClickActions.HIDE_CONTROLS,
  doubleClickAction: ClickActions.PLAY_PAUSE,
  tripleClickAction: ClickActions.FULLSCREEN,
  visChangeAction: VisChangeActions.NOTHING,
  miniSize: 0.25,
  miniPos: MiniplayerPositions.BOTTOM_RIGHT,
};
