import {Utils} from './Utils.mjs';

export class AudioUtils {
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

  static dbToGain(db) {
    return Math.pow(10, db / 20);
  }

  static gainToDB(gain) {
    return 20 * Math.log10(gain);
  }

  static symmetricalLogScaleY(x, c, p) {
    return Math.sign(x) * (Math.log10(Math.pow(Math.abs(x / c), p) + 1));
  }

  static symmetricalLogScaleX(y, c, p) {
    return Math.sign(y) * c * Math.pow(Math.pow(10, Math.abs(y)) - 1, 1/p);
  }

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
}
