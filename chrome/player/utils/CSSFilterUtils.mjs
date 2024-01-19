import {SVGDaltonizer} from '../modules/SVGDaltonizer.mjs';
import {DaltonizerTypes} from '../options/defaults/DaltonizerTypes.mjs';

const DaltonizerTypeMap = new Map();
DaltonizerTypeMap.set(DaltonizerTypes.NONE, -1);
DaltonizerTypeMap.set(DaltonizerTypes.PROTANOMALY, 0);
DaltonizerTypeMap.set(DaltonizerTypes.DEUTERANOMALY, 1);
DaltonizerTypeMap.set(DaltonizerTypes.TRITANOMALY, 2);

export class CSSFilterUtils {
  static getFilterString(options) {
    const filters = [];
    if (options.videoDaltonizerType !== DaltonizerTypes.NONE && options.videoDaltonizerStrength > 0) {
      filters.push(`url(#daltonizer-${options.videoDaltonizerType}-${options.videoDaltonizerStrength})`);
    }

    if (options.videoBrightness !== 1) {
      filters.push(`brightness(${options.videoBrightness})`);
    }

    if (options.videoContrast !== 1) {
      filters.push(`contrast(${toptions.videoContrast})`);
    }

    if (options.videoSaturation !== 1) {
      filters.push(`saturate(${options.videoSaturation})`);
    }

    if (options.videoGrayscale !== 0) {
      filters.push(`grayscale(${options.videoGrayscale})`);
    }

    if (options.videoSepia !== 0) {
      filters.push(`sepia(${options.videoSepia})`);
    }

    if (options.videoInvert !== 0) {
      filters.push(`invert(${options.videoInvert})`);
    }

    if (options.videoHueRotate !== 0) {
      filters.push(`hue-rotate(${options.videoHueRotate}deg)`);
    }

    return filters.join(' ');
  }

  static makeLMSDaltonizerFilter(type, strength) {
    return SVGDaltonizer.makeLMSDaltonizerFilter(DaltonizerTypeMap.get(type), strength, true);
  }
}
