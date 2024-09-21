export class ColorSpaceConfig {
  constructor({
    primaries,
    transfer,
    matrix,
    fullRange,
    chromaticity,
  }) {
    this.primaries = primaries;
    this.transfer = transfer;
    this.matrix = matrix;
    this.fullRange = fullRange;
    this.chromaticity = chromaticity;
  }
}
