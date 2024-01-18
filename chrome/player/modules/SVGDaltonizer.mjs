/**
 * @file SVGDaltonizer.mjs
 * @description Generate SVG filters for color vision deficiency simulation and correction.
 * @version 0.0.1
 * @author Andrew S (Andrews54757@gmail.com)
 * @license MIT
 *
 * See https://github.com/Andrews54757/SVG-Daltonizer for more information.
 */

/**
 * @typedef {Object} DOMElement - A DOM element.
 */

/**
 * @typedef {Object} SVGFilterResult - An object containing the SVG and filter elements.
 * @property {DOMElement} svg - The SVG element.
 * @property {DOMElement} filter - The filter element.
 */

/**
 * @typedef {0|1|2} DaltonizerType - Type of color vision deficiency.
 */

/**
 * Daltonization is a process that attempts to correct images for color blindness.
 * Three types of color blindness are available: protanomaly, deuteranomaly, and tritanomaly.
 * @readonly
 * @enum {DaltonizerType}
 */
export const DaltonizerTypes = {
  /**
     * Protanomaly is a reduced sensitivity to red light.
     */
  PROTANOMALY: 0,

  /**
     * Deuteranomaly is a reduced sensitivity to green light.
     */
  DEUTERANOMALY: 1,

  /**
     * Tritanomaly is a reduced sensitivity to blue light.
     */
  TRITANOMALY: 2,
};

/**
 * 5x5 matrix for converting RGB to LMS.
 * LMS is a color space that represents the response of the three types of cones of the human eye.
 */
const RGB2LMSMatrix = [
  0.31399022, 0.63951294, 0.04649755, 0, 0,
  0.15537241, 0.75789446, 0.08670142, 0, 0,
  0.01775239, 0.10944209, 0.87255922, 0, 0,
  0, 0, 0, 1, 0,
];


/**
 * 5x5 matrix for converting LMS to RGB.
 */
const LMS2RGBMatrix = [
  5.47221206, -4.6419601, 0.16963708, 0, 0,
  -1.1252419, 2.29317094, -0.1678952, 0, 0,
  0.02980165, -0.19318073, 1.16364789, 0, 0,
  0, 0, 0, 1, 0,
];

/**
 * 5x5 matrix for shifting colors towards the visible spectrum for CVD correction.
 */
const VisibleShiftMatrix = [
  0, 0, 0, 0, 0,
  0.7, 1, 0, 0, 0,
  0.7, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

/**
 * 5x5 matrix for inverting colors. Used for calculating the difference between two colors.
 * Each color component is subtracted from 1 (max).
 * The alpha component is set to 1 (max).
 */
const InversionMatrix = [
  -1, 0, 0, 0, 1,
  0, -1, 0, 0, 1,
  0, 0, -1, 0, 1,
  0, 0, 0, 0, 1,
];

/**
 * Represents the image source.
 */
const SourceGraphic = 'SourceGraphic';

/**
 * SVG namespace.
 */
const SVGStandard = 'http://www.w3.org/2000/svg';

/**
 * Static class containing SVG utility functions.
 */
class SVGUtils {
  /**
   * Creates an SVG element with a filter element.
   * @return {SVGFilterResult} An object containing the SVG and filter elements.
   */
  static makeSVGFilter() {
    const svg = document.createElementNS(SVGStandard, 'svg');
    svg.setAttribute('xmlns', SVGStandard);
    const def = document.createElementNS(SVGStandard, 'defs');
    svg.appendChild(def);
    const filter = document.createElementNS(SVGStandard, 'filter');
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

  /**
   * Creates a feColorMatrix element.
   * @param {Array} matrix - The matrix values.
   * @param {string} input - The input source name.
   * @param {string} result  - The result name.
   * @return {DOMElement} The feColorMatrix element.
   */
  static makeColorMatrix(matrix, input, result) {
    const colorMatrix = document.createElementNS(SVGStandard, 'feColorMatrix');
    colorMatrix.setAttribute('type', 'matrix');
    colorMatrix.setAttribute('values', matrix.join(' '));
    colorMatrix.setAttribute('in', input);
    if (result) colorMatrix.setAttribute('result', result);
    return colorMatrix;
  }

  /**
   * Creates a feComposite element with the arithmetic operator.
   * Each pixel is calculated as follows:
   * result = k1 * input1 * input2 + k2 * input1 + k3 * input2 + k4
   *
   * Note: There is some weirdness with negative values.
   * When subtracting two colors, all channels are zeroed if
   * the alpha component results in zero.
   *
   * @param {string} input1 - The first input source name.
   * @param {string} input2 - The second input source name.
   * @param {string} result - The result name.
   * @param {number} k1 - The first constant.
   * @param {number} k2 - The second constant.
   * @param {number} k3 - The third constant.
   * @param {number} k4 - The fourth constant.
   * @return {DOMElement} The feComposite element.
   */
  static makeArithmetic(input1, input2, result, k1, k2, k3, k4) {
    const arithmetic = document.createElementNS(SVGStandard, 'feComposite');
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
}

/**
 * Main static class for generating SVG filters for color vision deficiency simulation and correction.
 */
export class SVGDaltonizer {
  /**
   * Generates a CVD matrix for color vision deficiency simulation.
   * @param {DaltonizerType} type - The type of color vision deficiency.
   * @param {number} strength - The strength of the color vision deficiency. Higher values are more severe.
   * @return {Array} An array containing the CVD matrix.
   */
  static generateCVDMatrix(type, strength) {
    // List of constant colors for each type of color blindness.
    const constantColors = [
      [1, 1, 1],
    ];

    if (type !== 2) {
      // Protanomaly and deuteranomaly
      // Use blue as the constant color.
      constantColors.push([0.04649755, 0.08670142, 0.87256922]);
    } else {
      // Tritanomaly
      // Use red as the constant color.
      constantColors.push([0.31399022, 0.15537241, 0.01775239]);
    }

    // Calculate the CVD matrix constants.
    const c1 = (type + 1) % 3;
    const c2 = (type + 2) % 3;
    const y00 = constantColors[0][type];
    const y10 = constantColors[1][type];
    const y01 = constantColors[0][c1];
    const y11 = constantColors[1][c1];
    const y02 = constantColors[0][c2];
    const y12 = constantColors[1][c2];
    const c1v = -strength * (y02 * y10 - y00 * y12) / (y01 * y12 - y02 * y11);
    const c2v = -strength * (y01 * y10 - y00 * y11) / (y02 * y11 - y01 * y12);

    // Create the CVD matrix.
    const matrix = [
      1, 0, 0, 0, 0,
      0, 1, 0, 0, 0,
      0, 0, 1, 0, 0,
      0, 0, 0, 1, 0,
    ];

    // Set the CVD matrix constants.
    matrix[type * 5 + c1] = c1v;
    matrix[type * 5 + c2] = c2v;
    matrix[type * 5 + type] = 1 - strength;
    return matrix;
  }

  /**
   * Generates an SVG filter for color vision deficiency simulation.
   * @param {DaltonizerType} type - The type of color vision deficiency.
   * @param {number} strength - The strength of the color vision deficiency. Higher values are more severe.
   * @return {SVGFilterResult} An object containing the SVG and filter elements.
   */
  static makeCVDSimulatorFilter(type, strength) {
    const CVDMatrix = this.generateCVDMatrix(type, strength);
    const {svg, filter} = SVGUtils.makeSVGFilter();

    // Step 1: Convert to LMS
    filter.appendChild(SVGUtils.makeColorMatrix(RGB2LMSMatrix, SourceGraphic, 'lms'));

    // Step 2: Apply CVD
    filter.appendChild(SVGUtils.makeColorMatrix(CVDMatrix, 'lms', 'lms-sim'));

    // Step 3: Convert back to RGB
    filter.appendChild(SVGUtils.makeColorMatrix(LMS2RGBMatrix, 'lms-sim'));

    return {
      svg,
      filter,
    };
  }

  /**
   * Generates an SVG filter for color vision deficiency correction.
   * @param {DaltonizerType} type
   * @param {number} strength
   * @return {SVGFilterResult} An object containing the SVG and filter elements.
   */
  static makeLMSDaltonizerFilter(type, strength) {
    const CVDMatrix = this.generateCVDMatrix(type, strength);
    const {svg, filter} = SVGUtils.makeSVGFilter();

    // Step 1: Convert to LMS
    filter.appendChild(SVGUtils.makeColorMatrix(RGB2LMSMatrix, SourceGraphic, 'lms'));

    // Step 2: Apply CVD
    filter.appendChild(SVGUtils.makeColorMatrix(CVDMatrix, 'lms', 'lms-sim'));

    // Step 3: Convert back to RGB
    filter.appendChild(SVGUtils.makeColorMatrix(LMS2RGBMatrix, 'lms-sim', 'rgb-sim'));

    // Step 4: Calculate difference
    // Because SVG doesn't support negative values, we have to split the difference into two parts.
    // d+' = clamp(-source + sim + 1, 0, 1)
    // d-' = clamp(source - sim + 1, 0, 1)
    filter.appendChild(SVGUtils.makeArithmetic(SourceGraphic, 'rgb-sim', 'diff-pos-inv', 0, -1, 1, 1));
    filter.appendChild(SVGUtils.makeArithmetic(SourceGraphic, 'rgb-sim', 'diff-neg-inv', 0, 1, -1, 1));
    filter.appendChild(SVGUtils.makeColorMatrix(InversionMatrix, 'diff-pos-inv', 'diff-pos'));
    filter.appendChild(SVGUtils.makeColorMatrix(InversionMatrix, 'diff-neg-inv', 'diff-neg'));

    // Step 5: Shift colors towards visible spectrum
    filter.appendChild(SVGUtils.makeColorMatrix(VisibleShiftMatrix, 'diff-pos', 'shifted-pos'));
    filter.appendChild(SVGUtils.makeColorMatrix(VisibleShiftMatrix, 'diff-neg', 'shifted-neg'));

    // Step 6: Combine
    filter.appendChild(SVGUtils.makeArithmetic(SourceGraphic, 'shifted-pos', 'temp1', 0, 1, 1, 0));
    filter.appendChild(SVGUtils.makeColorMatrix(InversionMatrix, 'temp1', 'temp2'));
    filter.appendChild(SVGUtils.makeArithmetic('temp2', 'shifted-neg', 'temp3', 0, 1, 1, 0));
    filter.appendChild(SVGUtils.makeColorMatrix(InversionMatrix, 'temp3'));

    return {
      svg,
      filter,
    };
  }
}
