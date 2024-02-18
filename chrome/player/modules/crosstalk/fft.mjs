/**
 * Copyright Fedor Indutny, 2017.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

export class FFT {
  constructor(size) {
    this.size = size | 0;
    if (this.size <= 1 || (this.size & (this.size - 1)) !== 0) {
      throw new Error('FFT size must be a power of two and bigger than 1');
    }

    this._csize = size << 1;

    // NOTE: Use of `var` is intentional for old V8 versions
    const table = new Array(this.size * 2);
    for (let i = 0; i < table.length; i += 2) {
      const angle = Math.PI * i / this.size;
      table[i] = Math.cos(angle);
      table[i + 1] = -Math.sin(angle);
    }
    this.table = table;

    // Find size's power of two
    let power = 0;
    for (let t = 1; this.size > t; t <<= 1) {
      power++;
    }

    // Calculate initial step's width:
    //   * If we are full radix-4 - it is 2x smaller to give inital len=8
    //   * Otherwise it is the same as `power` to give len=4
    this._width = power % 2 === 0 ? power - 1 : power;

    // Pre-compute bit-reversal patterns
    this._bitrev = new Array(1 << this._width);
    for (let j = 0; j < this._bitrev.length; j++) {
      this._bitrev[j] = 0;
      for (let shift = 0; shift < this._width; shift += 2) {
        const revShift = this._width - shift - 2;
        this._bitrev[j] |= ((j >>> shift) & 3) << revShift;
      }
    }

    this._out = null;
    this._data = null;
    this._inv = 0;
  }

  fromComplexArray(complex, storage) {
    const res = storage || new Array(complex.length >>> 1);
    for (let i = 0; i < complex.length; i += 2) {
      res[i >>> 1] = complex[i];
    }
    return res;
  }

  createComplexArray() {
    const res = new Array(this._csize);
    for (let i = 0; i < res.length; i++) {
      res[i] = 0;
    }
    return res;
  }

  toComplexArray(input, storage) {
    const res = storage || this.createComplexArray();
    for (let i = 0; i < res.length; i += 2) {
      res[i] = input[i >>> 1];
      res[i + 1] = 0;
    }
    return res;
  }

  completeSpectrum(spectrum) {
    const size = this._csize;
    const half = size >>> 1;
    for (let i = 2; i < half; i += 2) {
      spectrum[size - i] = spectrum[i];
      spectrum[size - i + 1] = -spectrum[i + 1];
    }
  }

  transform(out, data) {
    if (out === data) {
      throw new Error('Input and output buffers must be different');
    }

    this._out = out;
    this._data = data;
    this._inv = 0;
    this._transform4();
    this._out = null;
    this._data = null;
  }

  realTransform(out, data) {
    if (out === data) {
      throw new Error('Input and output buffers must be different');
    }

    this._out = out;
    this._data = data;
    this._inv = 0;
    this._realTransform4();
    this._out = null;
    this._data = null;
  }

  inverseTransform(out, data) {
    if (out === data) {
      throw new Error('Input and output buffers must be different');
    }

    this._out = out;
    this._data = data;
    this._inv = 1;
    this._transform4();
    for (let i = 0; i < out.length; i++) {
      out[i] /= this.size;
    }
    this._out = null;
    this._data = null;
  }

  // radix-4 implementation
  //
  // NOTE: Uses of `var` are intentional for older V8 version that do not
  // support both `let compound assignments` and `const phi`
  _transform4() {
    const out = this._out;
    const size = this._csize;

    // Initial step (permute and transform)
    const width = this._width;
    let step = 1 << width;
    let len = (size / step) << 1;

    let outOff;
    let t;
    const bitrev = this._bitrev;
    if (len === 4) {
      for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
        const off = bitrev[t];
        this._singleTransform2(outOff, off, step);
      }
    } else {
    // len === 8
      for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
        const off = bitrev[t];
        this._singleTransform4(outOff, off, step);
      }
    }

    // Loop through steps in decreasing order
    const inv = this._inv ? -1 : 1;
    const table = this.table;
    for (step >>= 2; step >= 2; step >>= 2) {
      len = (size / step) << 1;
      const quarterLen = len >>> 2;

      // Loop through offsets in the data
      for (outOff = 0; outOff < size; outOff += len) {
      // Full case
        const limit = outOff + quarterLen;
        for (let i = outOff, k = 0; i < limit; i += 2, k += step) {
          const A = i;
          const B = A + quarterLen;
          const C = B + quarterLen;
          const D = C + quarterLen;

          // Original values
          const Ar = out[A];
          const Ai = out[A + 1];
          const Br = out[B];
          const Bi = out[B + 1];
          const Cr = out[C];
          const Ci = out[C + 1];
          const Dr = out[D];
          const Di = out[D + 1];

          // Middle values
          const MAr = Ar;
          const MAi = Ai;

          const tableBr = table[k];
          const tableBi = inv * table[k + 1];
          const MBr = Br * tableBr - Bi * tableBi;
          const MBi = Br * tableBi + Bi * tableBr;

          const tableCr = table[2 * k];
          const tableCi = inv * table[2 * k + 1];
          const MCr = Cr * tableCr - Ci * tableCi;
          const MCi = Cr * tableCi + Ci * tableCr;

          const tableDr = table[3 * k];
          const tableDi = inv * table[3 * k + 1];
          const MDr = Dr * tableDr - Di * tableDi;
          const MDi = Dr * tableDi + Di * tableDr;

          // Pre-Final values
          const T0r = MAr + MCr;
          const T0i = MAi + MCi;
          const T1r = MAr - MCr;
          const T1i = MAi - MCi;
          const T2r = MBr + MDr;
          const T2i = MBi + MDi;
          const T3r = inv * (MBr - MDr);
          const T3i = inv * (MBi - MDi);

          // Final values
          const FAr = T0r + T2r;
          const FAi = T0i + T2i;

          const FCr = T0r - T2r;
          const FCi = T0i - T2i;

          const FBr = T1r + T3i;
          const FBi = T1i - T3r;

          const FDr = T1r - T3i;
          const FDi = T1i + T3r;

          out[A] = FAr;
          out[A + 1] = FAi;
          out[B] = FBr;
          out[B + 1] = FBi;
          out[C] = FCr;
          out[C + 1] = FCi;
          out[D] = FDr;
          out[D + 1] = FDi;
        }
      }
    }
  }

  // radix-2 implementation
  //
  // NOTE: Only called for len=4
  _singleTransform2(outOff, off,
      step) {
    const out = this._out;
    const data = this._data;

    const evenR = data[off];
    const evenI = data[off + 1];
    const oddR = data[off + step];
    const oddI = data[off + step + 1];

    const leftR = evenR + oddR;
    const leftI = evenI + oddI;
    const rightR = evenR - oddR;
    const rightI = evenI - oddI;

    out[outOff] = leftR;
    out[outOff + 1] = leftI;
    out[outOff + 2] = rightR;
    out[outOff + 3] = rightI;
  }

  // radix-4
  //
  // NOTE: Only called for len=8
  _singleTransform4(outOff, off,
      step) {
    const out = this._out;
    const data = this._data;
    const inv = this._inv ? -1 : 1;
    const step2 = step * 2;
    const step3 = step * 3;

    // Original values
    const Ar = data[off];
    const Ai = data[off + 1];
    const Br = data[off + step];
    const Bi = data[off + step + 1];
    const Cr = data[off + step2];
    const Ci = data[off + step2 + 1];
    const Dr = data[off + step3];
    const Di = data[off + step3 + 1];

    // Pre-Final values
    const T0r = Ar + Cr;
    const T0i = Ai + Ci;
    const T1r = Ar - Cr;
    const T1i = Ai - Ci;
    const T2r = Br + Dr;
    const T2i = Bi + Di;
    const T3r = inv * (Br - Dr);
    const T3i = inv * (Bi - Di);

    // Final values
    const FAr = T0r + T2r;
    const FAi = T0i + T2i;

    const FBr = T1r + T3i;
    const FBi = T1i - T3r;

    const FCr = T0r - T2r;
    const FCi = T0i - T2i;

    const FDr = T1r - T3i;
    const FDi = T1i + T3r;

    out[outOff] = FAr;
    out[outOff + 1] = FAi;
    out[outOff + 2] = FBr;
    out[outOff + 3] = FBi;
    out[outOff + 4] = FCr;
    out[outOff + 5] = FCi;
    out[outOff + 6] = FDr;
    out[outOff + 7] = FDi;
  }

  // Real input radix-4 implementation
  _realTransform4() {
    const out = this._out;
    const size = this._csize;

    // Initial step (permute and transform)
    const width = this._width;
    let step = 1 << width;
    let len = (size / step) << 1;

    let outOff;
    let t;
    const bitrev = this._bitrev;
    if (len === 4) {
      for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
        const off = bitrev[t];
        this._singleRealTransform2(outOff, off >>> 1, step >>> 1);
      }
    } else {
    // len === 8
      for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
        const off = bitrev[t];
        this._singleRealTransform4(outOff, off >>> 1, step >>> 1);
      }
    }

    // Loop through steps in decreasing order
    const inv = this._inv ? -1 : 1;
    const table = this.table;
    for (step >>= 2; step >= 2; step >>= 2) {
      len = (size / step) << 1;
      const halfLen = len >>> 1;
      const quarterLen = halfLen >>> 1;
      const hquarterLen = quarterLen >>> 1;

      // Loop through offsets in the data
      for (outOff = 0; outOff < size; outOff += len) {
        for (let i = 0, k = 0; i <= hquarterLen; i += 2, k += step) {
          const A = outOff + i;
          const B = A + quarterLen;
          const C = B + quarterLen;
          const D = C + quarterLen;

          // Original values
          const Ar = out[A];
          const Ai = out[A + 1];
          const Br = out[B];
          const Bi = out[B + 1];
          const Cr = out[C];
          const Ci = out[C + 1];
          const Dr = out[D];
          const Di = out[D + 1];

          // Middle values
          const MAr = Ar;
          const MAi = Ai;

          const tableBr = table[k];
          const tableBi = inv * table[k + 1];
          const MBr = Br * tableBr - Bi * tableBi;
          const MBi = Br * tableBi + Bi * tableBr;

          const tableCr = table[2 * k];
          const tableCi = inv * table[2 * k + 1];
          const MCr = Cr * tableCr - Ci * tableCi;
          const MCi = Cr * tableCi + Ci * tableCr;

          const tableDr = table[3 * k];
          const tableDi = inv * table[3 * k + 1];
          const MDr = Dr * tableDr - Di * tableDi;
          const MDi = Dr * tableDi + Di * tableDr;

          // Pre-Final values
          const T0r = MAr + MCr;
          const T0i = MAi + MCi;
          const T1r = MAr - MCr;
          const T1i = MAi - MCi;
          const T2r = MBr + MDr;
          const T2i = MBi + MDi;
          const T3r = inv * (MBr - MDr);
          const T3i = inv * (MBi - MDi);

          // Final values
          const FAr = T0r + T2r;
          const FAi = T0i + T2i;

          const FBr = T1r + T3i;
          const FBi = T1i - T3r;

          out[A] = FAr;
          out[A + 1] = FAi;
          out[B] = FBr;
          out[B + 1] = FBi;

          // Output final middle point
          if (i === 0) {
            const FCr = T0r - T2r;
            const FCi = T0i - T2i;
            out[C] = FCr;
            out[C + 1] = FCi;
            continue;
          }

          // Do not overwrite ourselves
          if (i === hquarterLen) {
            continue;
          }

          // In the flipped case:
          // MAi = -MAi
          // MBr=-MBi, MBi=-MBr
          // MCr=-MCr
          // MDr=MDi, MDi=MDr
          const ST0r = T1r;
          const ST0i = -T1i;
          const ST1r = T0r;
          const ST1i = -T0i;
          const ST2r = -inv * T3i;
          const ST2i = -inv * T3r;
          const ST3r = -inv * T2i;
          const ST3i = -inv * T2r;

          const SFAr = ST0r + ST2r;
          const SFAi = ST0i + ST2i;

          const SFBr = ST1r + ST3i;
          const SFBi = ST1i - ST3r;

          const SA = outOff + quarterLen - i;
          const SB = outOff + halfLen - i;

          out[SA] = SFAr;
          out[SA + 1] = SFAi;
          out[SB] = SFBr;
          out[SB + 1] = SFBi;
        }
      }
    }
  }

  // radix-2 implementation
  //
  // NOTE: Only called for len=4
  _singleRealTransform2(outOff,
      off,
      step) {
    const out = this._out;
    const data = this._data;

    const evenR = data[off];
    const oddR = data[off + step];

    const leftR = evenR + oddR;
    const rightR = evenR - oddR;

    out[outOff] = leftR;
    out[outOff + 1] = 0;
    out[outOff + 2] = rightR;
    out[outOff + 3] = 0;
  }

  // radix-4
  //
  // NOTE: Only called for len=8
  _singleRealTransform4(outOff,
      off,
      step) {
    const out = this._out;
    const data = this._data;
    const inv = this._inv ? -1 : 1;
    const step2 = step * 2;
    const step3 = step * 3;

    // Original values
    const Ar = data[off];
    const Br = data[off + step];
    const Cr = data[off + step2];
    const Dr = data[off + step3];

    // Pre-Final values
    const T0r = Ar + Cr;
    const T1r = Ar - Cr;
    const T2r = Br + Dr;
    const T3r = inv * (Br - Dr);

    // Final values
    const FAr = T0r + T2r;

    const FBr = T1r;
    const FBi = -T3r;

    const FCr = T0r - T2r;

    const FDr = T1r;
    const FDi = T3r;

    out[outOff] = FAr;
    out[outOff + 1] = 0;
    out[outOff + 2] = FBr;
    out[outOff + 3] = FBi;
    out[outOff + 4] = FCr;
    out[outOff + 5] = 0;
    out[outOff + 6] = FDr;
    out[outOff + 7] = FDi;
  }
}
