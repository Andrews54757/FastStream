import {Utils} from './Utils.mjs';

export class AudioUtils {
  static getVolume(analyser) {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    return sum / bufferLength / 255;
  }

  static dbToGain(db) {
    return Math.pow(10, db / 20);
  }

  static gainToDB(gain) {
    return 20 * Math.log10(gain);
  }

  static symmetricalLogScaleY(x, c) {
    return Math.sign(x) * (Math.log10(Math.abs(x / c) + 1));
  }

  static symmetricalLogScaleX(y, c) {
    return Math.sign(y) * c * (Math.pow(10, Math.abs(y)) - 1);
  }

  static symmetricalLogScaleY(x, c) {
    return Math.sign(x) * (Math.log10(Math.abs(x / c) + 1));
  }

  static symmetricalLogScaleX(y, c) {
    return Math.sign(y) * c * (Math.pow(10, Math.abs(y)) - 1);
  }

  static mixerDBToPositionRatio(db) {
    if (db <= -50) {
      return 1;
    }

    const c = 40 / Math.log(10);
    const maxY = this.symmetricalLogScaleY(10, c);
    const minY = this.symmetricalLogScaleY(-50, c);
    const y = this.symmetricalLogScaleY(db, c);
    return Utils.clamp((maxY - y) / (maxY - minY), 0, 1);
  }

  static mixerPositionRatioToDB(ratio) {
    if (ratio >= 1) {
      return -Infinity;
    }

    const c = 40 / Math.log(10);
    const maxY = this.symmetricalLogScaleY(10, c);
    const minY = this.symmetricalLogScaleY(-50, c);
    const y = maxY - ratio * (maxY - minY);
    return Utils.clamp(this.symmetricalLogScaleX(y, c), -50, 10);
  }
}
