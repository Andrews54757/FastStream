import {EnvUtils} from '../../utils/EnvUtils.mjs';
import {ClickActions} from './ClickActions.mjs';
import {DefaultKeybinds} from './DefaultKeybinds.mjs';

export const DefaultOptions = {
  playMP4URLs: false,
  playStreamURLs: EnvUtils.isExtension(),
  analyzeVideos: EnvUtils.isExtension() && EnvUtils.hasComputationalResources(),
  downloadAll: true,
  freeUnusedChannels: true,
  autoEnableBestSubtitles: false,
  autoplayYoutube: true,
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
  maxSpeed: 300 * 1000 * 1000,
  seekStepSize: 2,
  playbackRate: 1,
  qualityMultiplier: 1.1,
  singleClickAction: ClickActions.HIDE_CONTROLS,
  doubleClickAction: ClickActions.PLAY_PAUSE,
  tripleClickAction: ClickActions.FULLSCREEN,
};
