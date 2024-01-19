/**
 * @file SVGDaltonizer.mjs
 * @description Generate SVG filters for color vision deficiency simulation and correction.
 * @version 0.0.1
 * @author Andrew S (Andrews54757@gmail.com)
 * @license MIT
 */

/**
 * @typedef {Object} DOMElement - A DOM element.
 */

/**
 * @typedef {Matrix} Matrix - A 5x4 matrix representing the color transformation.
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
 * 5x5 matrix for shifting colors towards the visible spectrum for CVD correction for trianomaly.
 */
const VisibleShiftMatrix2 = [
  0, 0, 0, 0, 0,
  0.7, 1, 0, 0, 0,
  0.7, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

/**
 * 5x5 identity matrix.
 */
const IdentityMatrix = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

/**
 * Machado's matrices for color vision deficiency simulation.
 * https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
 */
const MachadoMatrices = [
  [
    [
      0.856167, 0.182038, -0.038205,
      0.029342, 0.955115, 0.015544,
      -0.002880, -0.001563, 1.004443,
    ],
    [
      0.734766, 0.334872, -0.069637,
      0.051840, 0.919198, 0.028963,
      -0.004928, -0.004209, 1.009137,
    ],
    [
      0.630323, 0.465641, -0.095964,
      0.069181, 0.890046, 0.040773,
      -0.006308, -0.007724, 1.014032,
    ],
    [
      0.539009, 0.579343, -0.118352,
      0.082546, 0.866121, 0.051332,
      -0.007136, -0.011959, 1.019095,
    ],
    [
      0.458064, 0.679578, -0.137642,
      0.092785, 0.846313, 0.060902,
      -0.007494, -0.016807, 1.024301,
    ],
    [
      0.385450, 0.769005, -0.154455,
      0.100526, 0.829802, 0.069673,
      -0.007442, -0.022190, 1.029632,
    ],
    [
      0.319627, 0.849633, -0.169261,
      0.106241, 0.815969, 0.077790,
      -0.007025, -0.028051, 1.035076,
    ],
    [
      0.259411, 0.923008, -0.182420,
      0.110296, 0.804340, 0.085364,
      -0.006276, -0.034346, 1.040622,
    ],
    [
      0.203876, 0.990338, -0.194214,
      0.112975, 0.794542, 0.092483,
      -0.005222, -0.041043, 1.046265,
    ],
    [
      0.152286, 1.052583, -0.204868,
      0.114503, 0.786281, 0.099216,
      -0.003882, -0.048116, 1.051998,
    ],
  ],
  [
    [
      0.866435, 0.177704, -0.044139,
      0.049567, 0.939063, 0.011370,
      -0.003453, 0.007233, 0.996220,
    ],
    [
      0.760729, 0.319078, -0.079807,
      0.090568, 0.889315, 0.020117,
      -0.006027, 0.013325, 0.992702,
    ],
    [
      0.675425, 0.433850, -0.109275,
      0.125303, 0.847755, 0.026942,
      -0.007950, 0.018572, 0.989378,
    ],
    [
      0.605511, 0.528560, -0.134071,
      0.155318, 0.812366, 0.032316,
      -0.009376, 0.023176, 0.986200,
    ],
    [
      0.547494, 0.607765, -0.155259,
      0.181692, 0.781742, 0.036566,
      -0.010410, 0.027275, 0.983136,
    ],
    [
      0.498864, 0.674741, -0.173604,
      0.205199, 0.754872, 0.039929,
      -0.011131, 0.030969, 0.980162,
    ],
    [
      0.457771, 0.731899, -0.189670,
      0.226409, 0.731012, 0.042579,
      -0.011595, 0.034333, 0.977261,
    ],
    [
      0.422823, 0.781057, -0.203881,
      0.245752, 0.709602, 0.044646,
      -0.011843, 0.037423, 0.974421,
    ],
    [
      0.392952, 0.823610, -0.216562,
      0.263559, 0.690210, 0.046232,
      -0.011910, 0.040281, 0.971630,
    ],
    [
      0.367322, 0.860646, -0.227968,
      0.280085, 0.672501, 0.047413,
      -0.011820, 0.042940, 0.968881,
    ],
  ],
  [
    [
      0.926670, 0.092514, -0.019184,
      0.021191, 0.964503, 0.014306,
      0.008437, 0.054813, 0.936750,
    ],
    [
      0.895720, 0.133330, -0.029050,
      0.029997, 0.945400, 0.024603,
      0.013027, 0.104707, 0.882266,
    ],
    [
      0.905871, 0.127791, -0.033662,
      0.026856, 0.941251, 0.031893,
      0.013410, 0.148296, 0.838294,
    ],
    [
      0.948035, 0.089490, -0.037526,
      0.014364, 0.946792, 0.038844,
      0.010853, 0.193991, 0.795156,
    ],
    [
      1.017277, 0.027029, -0.044306,
      -0.006113, 0.958479, 0.047634,
      0.006379, 0.248708, 0.744913,
    ],
    [
      1.104996, -0.046633, -0.058363,
      -0.032137, 0.971635, 0.060503,
      0.001336, 0.317922, 0.680742,
    ],
    [
      1.193214, -0.109812, -0.083402,
      -0.058496, 0.979410, 0.079086,
      -0.002346, 0.403492, 0.598854,
    ],
    [
      1.257728, -0.139648, -0.118081,
      -0.078003, 0.975409, 0.102594,
      -0.003316, 0.501214, 0.502102,
    ],
    [
      1.278864, -0.125333, -0.153531,
      -0.084748, 0.957674, 0.127074,
      -0.000989, 0.601151, 0.399838,
    ],
    [
      1.255528, -0.076749, -0.178779,
      -0.078411, 0.930809, 0.147602,
      0.004733, 0.691367, 0.303900,
    ],
  ],
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
   * @param {Matrix} matrix - The matrix values.
   * @param {string} input - The input source name.
   * @param {string} result  - The result name.
   * @return {DOMElement} The feColorMatrix element.
   */
  static makeColorMatrix(matrix, input, result) {
    const colorMatrix = document.createElementNS(SVGStandard, 'feColorMatrix');
    colorMatrix.setAttribute('type', 'matrix');
    colorMatrix.setAttribute('values', matrix.map((a)=>Math.round(a * 1E4) / 1E4).join(' '));
    colorMatrix.setAttribute('in', input);
    if (result) colorMatrix.setAttribute('result', result);
    return colorMatrix;
  }
}

/**
 * Static class containing matrix utility functions.
 */
class MatrixUtils {
  /**
   * Multiplies two 3x3 matrices.
   * @param {Matrix} matrix1
   * @param {Matrix} matrix2
   * @return {Matrix} The resulting matrix.
   */
  static multiplyMatrix(matrix1, matrix2) {
    const newMatrix = IdentityMatrix.slice();
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let sum = 0;
        for (let k = 0; k < 3; k++) {
          sum += matrix1[i * 5 + k] * matrix2[k * 5 + j];
        }
        newMatrix[i * 5 + j] = sum;
      }
    }
    return newMatrix;
  }

  /**
   * Adds two 3x3 matrices.
   * @param {Matrix} matrix1
   * @param {Matrix} matrix2
   * @return {Matrix} The resulting matrix.
   */
  static addMatrix(matrix1, matrix2) {
    const newMatrix = matrix1.slice();
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        newMatrix[i * 5 + j] += matrix2[i * 5 + j];
      }
    }
    return newMatrix;
  }

  /**
   * Subtracts two 3x3 matrices.
   * @param {Matrix} matrix1
   * @param {Matrix} matrix2
   * @return {Matrix} The resulting matrix.
   */
  static subtractMatrix(matrix1, matrix2) {
    const newMatrix = matrix1.slice();
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        newMatrix[i * 5 + j] -= matrix2[i * 5 + j];
      }
    }
    return newMatrix;
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
   * @param {boolean} useMachado - Whether to use Machado's method.
   * @return {Matrix} An array containing the CVD matrix.
   */
  static generateCVDMatrix(type, strength, useMachado = false) {
    // Create identity matrix
    const matrix = IdentityMatrix.slice();

    if (strength <= 0) {
      return matrix;
    }

    if (strength > 1) {
      strength = 1;
    }

    if (useMachado) {
      const indexBelow = Math.floor(strength * 10) - 1;
      const indexAbove = Math.ceil(strength * 10) - 1;
      const machadoMatrixBelow = indexBelow === -1 ? [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1,
      ] : MachadoMatrices[type][indexBelow];
      const machadoMatrixAbove = MachadoMatrices[type][indexAbove];
      const weight = (strength * 10) % 1;

      // Interpolate between the two matrices.
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          matrix[i * 5 + j] = machadoMatrixBelow[i * 3 + j] * (1 - weight) + machadoMatrixAbove[i * 3 + j] * weight;
        }
      }

      return matrix;
    } else {
      // List of constant colors for each type of color blindness.
      const constantColors = [
        [1, 1, 1],
      ];

      if (type === DaltonizerTypes.TRITANOMALY) {
        // Tritanomaly
        // Use red as the constant color.
        constantColors.push([0.31399022, 0.15537241, 0.01775239]);
      } else {
        // Protanomaly and deuteranomaly
        // Use blue as the constant color.
        constantColors.push([0.04649755, 0.08670142, 0.87256922]);
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

      // Set the CVD matrix constants.
      matrix[type * 5 + c1] = c1v;
      matrix[type * 5 + c2] = c2v;
      matrix[type * 5 + type] = 1 - strength;
      return MatrixUtils.multiplyMatrix(MatrixUtils.multiplyMatrix(LMS2RGBMatrix, matrix), RGB2LMSMatrix);
    }
  }

  /**
   * Generates an effective matrix for color vision deficiency correction.
   * @param {DaltonizerType} type
   * @param {number} strength
   * @param {boolean} useMachado
   * @return {Matrix} An array containing the effective matrix.
   */
  static getCorrectiveMatrix(type, strength, useMachado = false) {
    // Derivation of the filter:
    // Shift x (Source - CVD x Source) + Source
    // (Shift x (I - CVD) + I) x Source
    // (Shift x I - Shift x CVD + I) x Source
    // ((Shift + I) - Shift x CVD) x Source
    const CVDMatrix = this.generateCVDMatrix(type, strength, useMachado);
    const ShiftMatrix = type === DaltonizerTypes.TRITANOMALY ? VisibleShiftMatrix2 : VisibleShiftMatrix;

    // Calculate the effective matrix.
    const ShiftXCVD = MatrixUtils.multiplyMatrix(ShiftMatrix, CVDMatrix);
    const ShiftPlusI = MatrixUtils.addMatrix(ShiftMatrix, IdentityMatrix);
    return MatrixUtils.subtractMatrix(ShiftPlusI, ShiftXCVD);
  }

  /**
   * Generates an SVG filter for color vision deficiency simulation.
   * @param {DaltonizerType} type - The type of color vision deficiency.
   * @param {number} strength - The strength of the color vision deficiency. Higher values are more severe.
   * @param {boolean} useMachado - Whether to use Machado's method.
   * @return {SVGFilterResult} An object containing the SVG and filter elements.
   */
  static makeCVDSimulatorFilter(type, strength, useMachado = false) {
    const CVDMatrix = this.generateCVDMatrix(type, strength, useMachado);
    const {svg, filter} = SVGUtils.makeSVGFilter();
    filter.appendChild(SVGUtils.makeColorMatrix(CVDMatrix, SourceGraphic));

    return {
      svg,
      filter,
    };
  }

  /**
   * Generates an SVG filter for color vision deficiency correction.
   * @param {DaltonizerType} type
   * @param {number} strength
   * @param {boolean} useMachado - Whether to use Machado's method.
   * @return {SVGFilterResult} An object containing the SVG and filter elements.
   */
  static makeLMSDaltonizerFilter(type, strength, useMachado = false) {
    const {svg, filter} = SVGUtils.makeSVGFilter();
    const effectiveMatrix = this.getCorrectiveMatrix(type, strength, useMachado);

    // Add the color matrix to the filter.
    filter.appendChild(SVGUtils.makeColorMatrix(effectiveMatrix, SourceGraphic));

    return {
      svg,
      filter,
    };
  }
}
