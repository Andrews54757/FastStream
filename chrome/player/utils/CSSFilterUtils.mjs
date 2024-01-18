import {DaltonizerTypes} from '../options/defaults/DaltonizerTypes.mjs';

const DaltonizerTypeMap = new Map();
DaltonizerTypeMap.set(DaltonizerTypes.NONE, -1);
DaltonizerTypeMap.set(DaltonizerTypes.PROTANOMALY, 0);
DaltonizerTypeMap.set(DaltonizerTypes.DEUTERANOMALY, 1);
DaltonizerTypeMap.set(DaltonizerTypes.TRITANOMALY, 2);

const RGB2LMS = [
  0.31399022, 0.63951294, 0.04649755, 0, 0,
  0.15537241, 0.75789446, 0.08670142, 0, 0,
  0.01775239, 0.10944209, 0.87255922, 0, 0,
  0, 0, 0, 1, 0,
];

const LMS2RGB = [
  5.47221206, -4.6419601, 0.16963708, 0, 0,
  -1.1252419, 2.29317094, -0.1678952, 0, 0,
  0.02980165, -0.19318073, 1.16364789, 0, 0,
  0, 0, 0, 1, 0,
];

const VisibleShift = [
  0, 0, 0, 0, 0,
  0.7, 1, 0, 0, 0,
  0.7, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

const Inversion = [
  -1, 0, 0, 0, 1,
  0, -1, 0, 0, 1,
  0, 0, -1, 0, 1,
  0, 0, 0, 0, 1,
];

const SourceGraphic = 'SourceGraphic';

export class CSSFilterUtils {
  static generateCVDMatrix(type, loss) {
    const constantColors = [
      [1, 1, 1],
    ];
    if (type !== 2) {
      constantColors.push([0.04649755, 0.08670142, 0.87256922]);
    } else {
      constantColors.push([0.31399022, 0.15537241, 0.01775239]);
    }

    const c1 = (type + 1) % 3;
    const c2 = (type + 2) % 3;
    const y00 = constantColors[0][type];
    const y10 = constantColors[1][type];
    const y01 = constantColors[0][c1];
    const y11 = constantColors[1][c1];
    const y02 = constantColors[0][c2];
    const y12 = constantColors[1][c2];

    const c1v = -loss * (y02 * y10 - y00 * y12) / (y01 * y12 - y02 * y11);
    const c2v = -loss * (y01 * y10 - y00 * y11) / (y02 * y11 - y01 * y12);

    const matrix = [
      1, 0, 0, 0, 0,
      0, 1, 0, 0, 0,
      0, 0, 1, 0, 0,
      0, 0, 0, 1, 0,
    ];
    matrix[type * 5 + c1] = c1v;
    matrix[type * 5 + c2] = c2v;
    matrix[type * 5 + type] = 1 - loss;
    return matrix;
  }

  static getFilterString(options) {
    const filters = [];
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

    if (options.videoDaltonizerType !== DaltonizerTypes.NONE && options.videoDaltonizerStrength > 0) {
      filters.push(`url(#daltonizer)`);
    }

    return filters.join(' ');
  }

  static makeSVGFilter() {
    const standard = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(standard, 'svg');
    svg.setAttribute('xmlns', standard);
    const def = document.createElementNS(standard, 'defs');
    svg.appendChild(def);
    const filter = document.createElementNS(standard, 'filter');
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    filter.setAttribute('x', '0%');
    filter.setAttribute('y', '0%');
    filter.setAttribute('width', '100%');
    filter.setAttribute('height', '100%');
    def.appendChild(filter);
    return {
      svg,
      filter,
    };
  }

  static makeColorMatrix(matrix, input, result) {
    const colorMatrix = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
    colorMatrix.setAttribute('type', 'matrix');
    colorMatrix.setAttribute('values', matrix.join(' '));
    colorMatrix.setAttribute('in', input);
    if (result) colorMatrix.setAttribute('result', result);
    return colorMatrix;
  }

  static makeArithmetic(input1, input2, result, k1, k2, k3, k4) {
    const arithmetic = document.createElementNS('http://www.w3.org/2000/svg', 'feComposite');
    arithmetic.setAttribute('operator', 'arithmetic');
    arithmetic.setAttribute('k1', k1);
    arithmetic.setAttribute('k2', k2);
    arithmetic.setAttribute('k3', k3);
    arithmetic.setAttribute('k4', k4);
    arithmetic.setAttribute('in', input1);
    arithmetic.setAttribute('in2', input2);
    if (result) arithmetic.setAttribute('result', result);
    return arithmetic;
  }

  static makeLMSDaltonizerFilter(type, loss) {
    const CVD = this.generateCVDMatrix(DaltonizerTypeMap.get(type), loss);

    const {svg, filter} = this.makeSVGFilter();
    // Step 1: Convert to LMS
    filter.appendChild(this.makeColorMatrix(RGB2LMS, SourceGraphic, 'lms'));

    // Step 2: Apply CVD
    filter.appendChild(this.makeColorMatrix(CVD, 'lms', 'lms-sim'));

    // Step 3: Convert back to RGB
    filter.appendChild(this.makeColorMatrix(LMS2RGB, 'lms-sim', 'rgb-sim'));

    // Step 4: Calculate difference
    // d+' = clamp(-source + sim + 1, 0, 1)
    // d-' = clamp(source - sim + 1, 0, 1)
    filter.appendChild(this.makeArithmetic(SourceGraphic, 'rgb-sim', 'diff-pos-inv', 0, -1, 1, 1));
    filter.appendChild(this.makeArithmetic(SourceGraphic, 'rgb-sim', 'diff-neg-inv', 0, 1, -1, 1));
    filter.appendChild(this.makeColorMatrix(Inversion, 'diff-pos-inv', 'diff-pos'));
    filter.appendChild(this.makeColorMatrix(Inversion, 'diff-neg-inv', 'diff-neg'));

    // Step 5: Shift colors towards visible spectrum
    filter.appendChild(this.makeColorMatrix(VisibleShift, 'diff-pos', 'shifted-pos'));
    filter.appendChild(this.makeColorMatrix(VisibleShift, 'diff-neg', 'shifted-neg'));

    // Step 6: Combine
    filter.appendChild(this.makeArithmetic(SourceGraphic, 'shifted-pos', 'temp1', 0, 1, 1, 0));
    filter.appendChild(this.makeColorMatrix(Inversion, 'temp1', 'temp2'));
    filter.appendChild(this.makeArithmetic('temp2', 'shifted-neg', 'temp3', 0, 1, 1, 0));
    filter.appendChild(this.makeColorMatrix(Inversion, 'temp3'));

    return {
      svg,
      filter,
    };
  }
}
