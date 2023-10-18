export class LargeBuffer {
  constructor(byteLength, bufferLength) {
    this.byteLength = byteLength;
    this.bufferLength = bufferLength;
    this.currentBuffer = null;
    this.nextPreloadedBuffer = null;
    this.offset = 0;
    this.index = 0;
    this.bufferIndex = 0;
  }

  async initialize(getBufferFn) {
    this.getBuffer = getBufferFn;
    this.nextPreloadedBuffer = this.getBuffer(this.bufferIndex);
    return this.nextBuffer();
  }

  async nextBuffer() {
    this.index = 0;
    this.bufferIndex++;
    const preloaded = this.nextPreloadedBuffer;
    if (this.bufferIndex < this.bufferLength) {
      this.nextPreloadedBuffer = this.getBuffer(this.bufferIndex);
    }
    this.currentBuffer = await preloaded;
  }

  async getViews(length) {
    const views = [];
    this.offset += length;
    if (this.offset > this.byteLength) {
      throw new Error('Index ' + this.offset + ' out of range');
    }

    while (length > 0) {
      if (this.index >= this.currentBuffer.byteLength) {
        await this.nextBuffer();
      }

      if (!this.currentBuffer) {
        throw new Error('Buffer ' + this.bufferIndex + ' not found');
      }

      const newlen = Math.min(this.currentBuffer.byteLength - this.index, length);
      views.push(new DataView(this.currentBuffer.buffer, this.index, newlen));

      this.index += newlen;
      length = length - newlen;
    }
    return views;
  }

  async read(length) {
    const uint8 = new Uint8Array(length);
    let offset = 0;
    this.offset += length;
    if (this.offset > this.byteLength) {
      throw new Error('Index ' + this.offset + ' out of range');
    }

    while (length > 0) {
      if (this.index >= this.currentBuffer.byteLength) {
        await this.nextBuffer();
      }

      if (!this.currentBuffer) {
        throw new Error('Buffer ' + this.bufferIndex + ' not found');
      }

      const newlen = Math.min(this.currentBuffer.byteLength - this.index, length);
      for (let i = 0; i < newlen; i++) {
        uint8[offset++] = this.currentBuffer[this.index++];
      }
      length = length - newlen;
    }

    return uint8;
  }

  async uint8() {
    return (await this.read(1))[0];
  }

  async uint16() {
    const arr = await this.read(2);
    return (arr[0] << 8) | arr[1];
  }

  async uint32() {
    const arr = await this.read(4);
    return (arr[0] << 24) | (arr[1] << 16) | (arr[2] << 8) | arr[3];
  }
}
