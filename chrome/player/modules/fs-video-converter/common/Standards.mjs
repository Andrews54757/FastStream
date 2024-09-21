const ColourPrimariesMap = new Map();

ColourPrimariesMap.set(1, {
  name: 'ITU-R BT.709-5',
  x: [0.3, 0.15, 0.64, 0.3127],
  y: [0.6, 0.06, 0.33, 0.329],
  webName: 'bt709',
});

ColourPrimariesMap.set(4, {
  name: 'ITU-R BT.470-6 System M',
  x: [0.21, 0.14, 0.67, 0.31],
  y: [0.71, 0.08, 0.33, 0.316],
});

ColourPrimariesMap.set(5, {
  name: 'ITU-R BT.470-6 System B, G',
  x: [0.29, 0.15, 0.64, 0.3127],
  y: [0.6, 0.06, 0.33, 0.329],
  webName: 'bt470bg',
});

ColourPrimariesMap.set(6, {
  name: 'SMPTE 170M',
  x: [0.31, 0.155, 0.630, 0.3127],
  y: [0.595, 0.07, 0.34, 0.329],
  equivalents: [7],
  webName: 'smpte170m',
});

ColourPrimariesMap.set(7, {
  name: 'SMPTE 240M',
  x: [0.31, 0.155, 0.630, 0.3127],
  y: [0.595, 0.07, 0.34, 0.329],
  equivalents: [6],
});

ColourPrimariesMap.set(8, {
  name: 'Generic film',
  x: [0.243, 0.145, 0.681, 0.310],
  y: [0.692, 0.049, 0.319, 0.316],
});

ColourPrimariesMap.set(9, {
  name: 'ITU-R BT.2020',
  x: [0.170, 0.131, 0.708, 0.3127],
  y: [0.797, 0.046, 0.292, 0.329],
  webName: 'bt2020',
});

ColourPrimariesMap.set(10, {
  name: 'SMPTE ST 428-1',
  x: [0.0, 0.0, 1.0, 1 / 3],
  y: [1.0, 0.0, 0.0, 1 / 3],
});

ColourPrimariesMap.set(11, {
  name: 'SMPTE RP 431-2',
  x: [0.265, 0.15, 0.68, 0.314],
  y: [0.69, 0.06, 0.32, 0.351],
});

ColourPrimariesMap.set(12, {
  name: 'SMPTE EG 432-1',
  x: [0.265, 0.15, 0.68, 0.3127],
  y: [0.69, 0.06, 0.32, 0.329],
  webName: 'smpte432',
});

ColourPrimariesMap.set(22, {
  name: 'EBU Tech 3213-E',
  x: [0.295, 0.155, 0.63, 0.3127],
  y: [0.605, 0.077, 0.34, 0.329],
});

const TransferCharacteristicsMap = new Map();
TransferCharacteristicsMap.set(1, {
  name: 'ITU-R BT.709-6',
  equivalents: [6, 14, 15],
  webName: 'bt709',
});

TransferCharacteristicsMap.set(4, {
  name: 'ITU-R BT.470-6 System M',
});

TransferCharacteristicsMap.set(5, {
  name: 'ITU-R BT.470-6 System B, G',
});

TransferCharacteristicsMap.set(6, {
  name: 'SMPTE 170M',
  equivalents: [1, 14, 15],
  webName: 'smpte170m',
});

TransferCharacteristicsMap.set(7, {
  name: 'SMPTE 240M',
});

TransferCharacteristicsMap.set(8, {
  name: 'Linear',
  webName: 'linear',
});

TransferCharacteristicsMap.set(9, {
  name: 'Log',
});

TransferCharacteristicsMap.set(10, {
  name: 'Log Sqrt',
});

TransferCharacteristicsMap.set(11, {
  name: 'IEC 61966-2-4',
});

TransferCharacteristicsMap.set(12, {
  name: 'ITU-R BT.1361 Extended Colour Gamut',
});

TransferCharacteristicsMap.set(13, {
  name: 'IEC 61966-2-1',
  webName: 'iec61966-2-1',
});

TransferCharacteristicsMap.set(14, {
  name: 'ITU-R BT.2020 10 bit',
  equivalents: [1, 6, 15],
});

TransferCharacteristicsMap.set(15, {
  name: 'ITU-R BT.2020-2 12 bit',
  equivalents: [1, 6, 14],
});

TransferCharacteristicsMap.set(16, {
  name: 'ITU-R BT.2100 Perceptual Quantization',
  webName: 'pq',
});

TransferCharacteristicsMap.set(17, {
  name: 'SMPTE ST 428-1',
});

TransferCharacteristicsMap.set(18, {
  name: 'ARIB STD-B67 (HLG)',
  webName: 'hlg',
});

const MatrixCoefficientsMap = new Map();
MatrixCoefficientsMap.set(0, {
  name: 'Identity',
  webName: 'identity',
});

MatrixCoefficientsMap.set(1, {
  name: 'ITU-R BT.709',
  webName: 'bt709',
});

MatrixCoefficientsMap.set(4, {
  name: 'US FCC 73.682',
});

MatrixCoefficientsMap.set(5, {
  name: 'ITU-R BT.470BG',
  webName: 'bt470bg',
});

MatrixCoefficientsMap.set(6, {
  name: 'SMPTE 170M',
  webName: 'smpte170m',
});

MatrixCoefficientsMap.set(7, {
  name: 'SMPTE 240M',
});

MatrixCoefficientsMap.set(8, {
  name: 'YCoCg',
});

MatrixCoefficientsMap.set(9, {
  name: 'BT2020 Non-constant Luminance',
  webName: 'bt2020-ncl',
});

MatrixCoefficientsMap.set(10, {
  name: 'BT2020 Constant Luminance',
});

MatrixCoefficientsMap.set(11, {
  name: 'SMPTE ST 2085',
});

MatrixCoefficientsMap.set(12, {
  name: 'Chroma-derived Non-constant Luminance',
});

MatrixCoefficientsMap.set(13, {
  name: 'Chroma-derived Constant Luminance',
});

MatrixCoefficientsMap.set(14, {
  name: 'ITU-R BT.2100-0',
});

export class Standards {
  static getColourPrimaries(primaries) {
    return ColourPrimariesMap.get(primaries);
  }
  static getTransferCharacteristics(transfer) {
    return TransferCharacteristicsMap.get(transfer);
  }
  static getMatrixCoefficients(matrix) {
    return MatrixCoefficientsMap.get(matrix);
  }
  static getWebName(map, key) {
    const entry = map.get(key);
    if (entry.webName) {
      return entry.webName;
    }

    if (entry.equivalents) {
      for (const equivalent of entry.equivalents) {
        const equivalentEntry = map.get(equivalent);
        if (equivalentEntry.webName) {
          return equivalentEntry.webName;
        }
      }
    }
    return null;
  }

  static getColourPrimariesWebName(primaries) {
    return Standards.getWebName(ColourPrimariesMap, primaries);
  }

  static getTransferCharacteristicsWebName(transfer) {
    return Standards.getWebName(TransferCharacteristicsMap, transfer);
  }

  static getMatrixCoefficientsWebName(matrix) {
    return Standards.getWebName(MatrixCoefficientsMap, matrix);
  }

  static getIdFromName(map, name) {
    for (const [key, value] of map) {
      if (value.name === name) {
        return key;
      }
    }
    return null;
  }

  static getColourPrimariesId(name) {
    return Standards.getIdFromName(ColourPrimariesMap, name);
  }

  static getTransferCharacteristicsId(name) {
    return Standards.getIdFromName(TransferCharacteristicsMap, name);
  }

  static getMatrixCoefficientsId(name) {
    return Standards.getIdFromName(MatrixCoefficientsMap, name);
  }
}
