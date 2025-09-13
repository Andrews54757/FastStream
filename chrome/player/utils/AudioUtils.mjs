import {Utils} from './Utils.mjs';

// --- ITU-R 468 weighting with per-bin cache, returns dBFS ---

// 468 curve in dB
function ituR468_dB(fHz) {
  if (!Number.isFinite(fHz) || fHz <= 0) return -Infinity;
  const f = fHz;
  const f2 = f * f; const f3 = f2 * f; const f4 = f2 * f2; const f5 = f3 * f2; const f6 = f3 * f3;

  const h1 = -4.737338981378384e-24 * f6 +
           2.043828333606125e-15 * f4 -
           1.363894795463638e-07 * f2 +
           1.0;

  const h2 = 1.306612257412824e-19 * f5 -
           2.118150887518656e-11 * f3 +
           5.559488023498642e-04 * f;

  const R = (1.246332637532143e-4 * f) / Math.sqrt(h1 * h1 + h2 * h2);
  return 18.2 + 20 * Math.log10(R);
}

// Cache of per-bin weights per AnalyserNode
const _weightsCache = new WeakMap(); // analyser -> { fftSize, sampleRate, weights: Float32Array }

// Build or reuse weights. Normalize so the peak bin weight equals 1.0
function get468WeightsForAnalyser(analyser) {
  const fftSize = analyser.fftSize;
  const sampleRate = analyser.context.sampleRate;
  const bufferLength = analyser.frequencyBinCount;

  let entry = _weightsCache.get(analyser);
  if (entry && entry.fftSize === fftSize && entry.sampleRate === sampleRate) {
    return entry.weights;
  }

  const weights = new Float32Array(bufferLength);
  const binHz = sampleRate / fftSize;

  // First pass: compute unnormalized linear weights and track the max
  let maxW = 0;
  weights[0] = 0; // DC
  for (let i = 1; i < bufferLength; i++) {
    const dB = ituR468_dB(i * binHz);
    const w = dB === -Infinity ? 0 : Math.pow(10, dB / 20);
    weights[i] = w;
    if (w > maxW) maxW = w;
  }

  // Second pass: normalize to peak 1.0
  const invMax = maxW > 0 ? 1 / maxW : 1;
  for (let i = 1; i < bufferLength; i++) {
    weights[i] *= invMax;
  }

  entry = {fftSize, sampleRate, weights};
  _weightsCache.set(analyser, entry);
  return weights;
}

/**
 * Utility functions for audio processing and conversions.
 */
export class AudioUtils {
  static isClipping(analyser) {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(dataArray);

    for (let i = 0; i < bufferLength; i++) {
      if (dataArray[i] > 1.05 || dataArray[i] < -1.05) {
        return true;
      }
    }
    return false;
  }
  /**
   * Calculates the volume in decibels from an AnalyserNode.
   * @param {AnalyserNode} analyser - The Web Audio analyser node.
   * @return {number} The volume in decibels.
   */
  static getVolume(analyser) {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    const minDb = analyser.minDecibels;
    const maxDb = analyser.maxDecibels;
    const minLinear = Math.pow(10, minDb / 20);

    const weights = get468WeightsForAnalyser(analyser);

    // Combine bins in linear power, rank by power
    let sum = 0;
    for (let i = 1; i < dataArray.length; i++) {
      const byteVal = dataArray[i];
      if (byteVal === 0) continue; // at or below minDb

      // Map byte [0..255] back to dB in [minDb..maxDb]
      const dB = (byteVal / 255) * (maxDb - minDb) + minDb;

      // Convert to linear amplitude, apply cached 468 weight
      const amp = Math.pow(10, dB / 20);
      const w = weights[i];
      const power = (amp * w) * (amp * w);
      sum += power;
    }

    const meanPower = sum / (bufferLength - 1);
    const rms = Math.sqrt(meanPower);

    // Convert to dB, between minDb and maxDb
    const volumeDb = rms <= minLinear ? minDb : 20 * Math.log10(rms);
    return volumeDb;
  }

  /**
   * Converts decibels to gain value.
   * @param {number} db - Decibel value.
   * @return {number} Gain value.
   */
  static dbToGain(db) {
    return Math.pow(10, db / 20);
  }

  /**
   * Converts gain value to decibels.
   * @param {number} gain - Gain value.
   * @return {number} Decibel value.
   */
  static gainToDB(gain) {
    return 20 * Math.log10(gain);
  }

  /**
   * Applies a symmetrical logarithmic scale to a value (Y axis).
   * @param {number} x - Input value.
   * @param {number} c - Center value.
   * @param {number} p - Power.
   * @return {number} Scaled value.
   */
  static symmetricalLogScaleY(x, c, p) {
    return Math.sign(x) * (Math.log10(Math.pow(Math.abs(x / c), p) + 1));
  }

  /**
   * Applies a symmetrical logarithmic scale to a value (X axis).
   * @param {number} y - Input value.
   * @param {number} c - Center value.
   * @param {number} p - Power.
   * @return {number} Scaled value.
   */
  static symmetricalLogScaleX(y, c, p) {
    return Math.sign(y) * c * Math.pow(Math.pow(10, Math.abs(y)) - 1, 1/p);
  }

  /**
   * Converts mixer decibel value to position ratio for UI.
   * @param {number} db - Decibel value.
   * @return {number} Position ratio.
   */
  static mixerDBToPositionRatio(db) {
    if (db <= -40) {
      return 1;
    }

    const c = 2;
    const maxY = this.symmetricalLogScaleY(10, c, 4);
    const minY = this.symmetricalLogScaleY(-40, c, 4);
    const y = this.symmetricalLogScaleY(db, c, 4);
    return Utils.clamp((maxY - y) / (maxY - minY), 0, 1);
  }

  /**
   * Converts a position ratio to mixer decibel value for UI.
   * @param {number} ratio - Position ratio.
   * @return {number} Decibel value.
   */
  static mixerPositionRatioToDB(ratio) {
    if (ratio >= 1) {
      return -Infinity;
    }

    const c = 2;
    const maxY = this.symmetricalLogScaleY(10, c, 4);
    const minY = this.symmetricalLogScaleY(-40, c, 4);
    const y = maxY - ratio * (maxY - minY);
    return Utils.clamp(this.symmetricalLogScaleX(y, c, 4), -40, 10);
  }

  static getActiveChannelsForChannelCount(numberOfChannels) {
    let activeChannels = [];
    // 0 = Left, 1 = Right, 2 = Center, 3 = Bass (LFE), 4 = Left Surround, 5 = Right Surround, 6 = Side Left, 7 = Side Right
    if (numberOfChannels <= 1) {
      activeChannels = [0]; // Mono
    } else if (numberOfChannels === 2) {
      activeChannels = [0, 1]; // Stereo
    } else if (numberOfChannels === 3) {
      activeChannels = [0, 1, 2]; // 2.1
    } else if (numberOfChannels === 4) {
      activeChannels = [0, 1, 4, 5]; // Quad
    } else if (numberOfChannels === 5) {
      activeChannels = [0, 1, 2, 4, 5]; // 5.0
    } else if (numberOfChannels === 6) {
      activeChannels = [0, 1, 2, 3, 4, 5]; // 5.1
    } else if (numberOfChannels === 7) {
      activeChannels = [0, 1, 2, 3, 4, 5, 6]; // 6.1
    } else if (numberOfChannels >= 8) {
      activeChannels = [0, 1, 2, 3, 4, 5, 6, 7]; // 7.1
    }

    return activeChannels;
  }
}
