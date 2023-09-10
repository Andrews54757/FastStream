export class dHash {
  static getHash(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    return this.computeHash(this.convertToGrayscale(imageData.data), width, height);
  }

  static computeHash(data, width, height) {
    let hash = '';
    for (let y = 1; y < height; y += 2) {
      for (let x = 1; x < width; x += 2) {
        if (data[y * width + x] > data[y * width + x - 1]) {
          hash += '1';
        } else {
          hash += '0';
        }

        if (data[y * width + x] > data[(y - 1) * width + x]) {
          hash += '1';
        } else {
          hash += '0';
        }
      }
    }
    return hash;
  }

  static convertToGrayscale(data) {
    const newArr = new Uint8ClampedArray(data.length / 4);
    for (let i = 0; i < data.length; i += 4) {
      // Grayscale = 0.299R + 0.587G + 0.114B
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      newArr[i / 4] = gray;
    }
    return newArr;
  }

  static splitRGB(data) {
    const r = new Uint8ClampedArray(data.length / 4);
    const g = new Uint8ClampedArray(data.length / 4);
    const b = new Uint8ClampedArray(data.length / 4);
    for (let i = 0; i < data.length; i += 4) {
      // Grayscale = 0.299R + 0.587G + 0.114B
      r[i / 4] = data[i];
      g[i / 4] = data[i + 1];
      b[i / 4] = data[i + 2];
    }
    return [r, g, b];
  }
}
