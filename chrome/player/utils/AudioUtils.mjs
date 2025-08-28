import {Utils} from './Utils.mjs';

/**
 * Utility functions for audio processing and conversions.
 */
export class AudioUtils {
  /**
   * Calculates the volume in decibels from an AnalyserNode.
   * @param {AnalyserNode} analyser - The Web Audio analyser node.
   * @return {number} The volume in decibels.
   */
  static getVolume(analyser) {
    const bufferLength = analyser.fftSize;
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(dataArray);
    let rms = 0;
    for (let i = 0; i < bufferLength; i++) {
      rms += dataArray[i] * dataArray[i];
    }
    rms = rms / bufferLength;
    return 10 * Math.log10(rms);
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
    } else if (numberOfChannels >= 6) {
      activeChannels = [0, 1, 2, 3, 4, 5]; // 5.1
    }
    return activeChannels;
  }
}
