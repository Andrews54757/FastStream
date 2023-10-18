export class LargeBuffer {
  constructor() {
    this.buffers = [];
    this.reset();
  }
  reset() {
    this.buffers.length = 0;
    this.offset = 0;
    this.index = 0;
    this.bufferIndex = 0;
    this.byteLength = 0;
  }
  getViews(length) {
    const views = [];
    this.offset += length;
    while (length > 0) {
      if (this.index >= this.buffers[this.bufferIndex].byteLength) {
        this.index = 0;
        this.buffers[this.bufferIndex] = null;
        this.bufferIndex++;
      }

      if (!this.buffers[this.bufferIndex]) {
        throw new Error('Index ' + this.index + ' out of range');
      }
      // console.log(this.buffers[this.bufferIndex])

      const newlen = Math.min(this.buffers[this.bufferIndex].byteLength - this.index, length);
      views.push(new DataView(this.buffers[this.bufferIndex].buffer, this.index, newlen));

      this.index += newlen;
      length = length - newlen;
    }
    return views;
  }
  uint8() {
    if (this.index >= this.buffers[this.bufferIndex].byteLength) {
      this.index = 0;
      this.buffers[this.bufferIndex] = null;
      this.bufferIndex++;
    }
    if (!this.buffers[this.bufferIndex]) {
      throw new Error('Index ' + this.index + ' out of range');
    }
    this.offset++;
    return this.buffers[this.bufferIndex][this.index++];
  }
  uint16() {
    return (this.uint8() << 8) | this.uint8();
  }
  uint32() {
    return ((this.uint8() << 24) | (this.uint8() << 16) | (this.uint8() << 8) | this.uint8()) >>> 0;
  }

  read(size) {
    const uint8 = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      uint8[i] = this.uint8();
    }
    return uint8;
  }

  append(buffer, index) {
    this.byteLength += buffer.byteLength;
    if (index === undefined) index = this.buffers.length;
    this.buffers[index] = new Uint8Array(buffer);
  }
}
