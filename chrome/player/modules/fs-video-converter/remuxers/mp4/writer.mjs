/* eslint-disable valid-jsdoc */

export class Writer {
  pos = 0;
  helper = new Uint8Array(8);
  helperView = new DataView(this.helper.buffer);

  /**
     * Stores the position from the start of the file to where boxes elements have been written. This is used to
     * rewrite/edit elements that were already added before, and to measure sizes of things.
     */
  offsets = new WeakMap();

  /** Sets the current position for future writes to a new one. */
  seek(newPos) {
    this.pos = newPos;
  }

  writeU32(value) {
    this.helperView.setUint32(0, value, false);
    this.write(this.helper.subarray(0, 4));
  }

  writeU64(value) {
    this.helperView.setUint32(0, Math.floor(value / 2**32), false);
    this.helperView.setUint32(4, value, false);
    this.write(this.helper.subarray(0, 8));
  }

  writeAscii(text) {
    for (let i = 0; i < text.length; i++) {
      this.helperView.setUint8(i % 8, text.charCodeAt(i));
      if (i % 8 === 7) this.write(this.helper);
    }

    if (text.length % 8 !== 0) {
      this.write(this.helper.subarray(0, text.length % 8));
    }
  }

  writeBox(box) {
    this.offsets.set(box, this.pos);

    if (box.contents && !box.children) {
      this.writeBoxHeader(box, box.size ?? box.contents.byteLength + 8);
      this.write(box.contents);
    } else {
      const startPos = this.pos;
      this.writeBoxHeader(box, 0);

      if (box.contents) this.write(box.contents);
      if (box.children) for (const child of box.children) if (child) this.writeBox(child);

      const endPos = this.pos;
      const size = box.size ?? endPos - startPos;
      this.seek(startPos);
      this.writeBoxHeader(box, size);
      this.seek(endPos);
    }
  }

  writeBoxHeader(box, size) {
    this.writeU32(box.largeSize ? 1 : size);
    this.writeAscii(box.type);
    if (box.largeSize) this.writeU64(size);
  }

  measureBoxHeader(box) {
    return 8 + (box.largeSize ? 8 : 0);
  }

  patchBox(box) {
    const endPos = this.pos;
    this.seek(this.offsets.get(box));
    this.writeBox(box);
    this.seek(endPos);
  }

  measureBox(box) {
    if (box.contents && !box.children) {
      const headerSize = this.measureBoxHeader(box);
      return headerSize + box.contents.byteLength;
    } else {
      let result = this.measureBoxHeader(box);
      if (box.contents) result += box.contents.byteLength;
      if (box.children) for (const child of box.children) if (child) result += this.measureBox(child);

      return result;
    }
  }
}

/**
 * Writes to an ArrayBufferTarget. Maintains a growable internal buffer during the muxing process, which will then be
 * written to the ArrayBufferTarget once the muxing finishes.
 */
export class ArrayBufferTargetWriter extends Writer {
  target;
  buffer = new ArrayBuffer(2**16);
  bytes = new Uint8Array(this.buffer);
  maxPos = 0;

  constructor(target) {
    super();

    this.target = target;
  }

  ensureSize(size) {
    let newLength = this.buffer.byteLength;
    while (newLength < size) newLength *= 2;

    if (newLength === this.buffer.byteLength) return;

    const newBuffer = new ArrayBuffer(newLength);
    const newBytes = new Uint8Array(newBuffer);
    newBytes.set(this.bytes, 0);

    this.buffer = newBuffer;
    this.bytes = newBytes;
  }

  write(data) {
    this.ensureSize(this.pos + data.byteLength);

    this.bytes.set(data, this.pos);
    this.pos += data.byteLength;

    this.maxPos = Math.max(this.maxPos, this.pos);
  }

  finalize() {
    this.ensureSize(this.pos);
    this.target.buffer = this.buffer.slice(0, Math.max(this.maxPos, this.pos));
  }
}

/**
 * Writes to a StreamTarget every time it is flushed, sending out all of the new data written since the
 * last flush. This is useful for streaming applications, like piping the output to disk.
 */
export class StreamTargetWriter extends Writer {
  target;
  sections = [];

  constructor(target) {
    super();

    this.target = target;
  }

  write(data) {
    this.sections.push({
      data: data.slice(),
      start: this.pos,
    });
    this.pos += data.byteLength;
  }

  flush() {
    if (this.sections.length === 0) return;

    const chunks = [];
    const sorted = [...this.sections].sort((a, b) => a.start - b.start);

    chunks.push({
      start: sorted[0].start,
      size: sorted[0].data.byteLength,
    });

    // Figure out how many contiguous chunks we have
    for (let i = 1; i < sorted.length; i++) {
      const lastChunk = chunks[chunks.length - 1];
      const section = sorted[i];

      if (section.start <= lastChunk.start + lastChunk.size) {
        lastChunk.size = Math.max(lastChunk.size, section.start + section.data.byteLength - lastChunk.start);
      } else {
        chunks.push({
          start: section.start,
          size: section.data.byteLength,
        });
      }
    }

    for (const chunk of chunks) {
      chunk.data = new Uint8Array(chunk.size);

      // Make sure to write the data in the correct order for correct overwriting
      for (const section of this.sections) {
        // Check if the section is in the chunk
        if (chunk.start <= section.start && section.start < chunk.start + chunk.size) {
          chunk.data.set(section.data, section.start - chunk.start);
        }
      }

      this.target.options.onData?.(chunk.data, chunk.start);
    }

    this.sections.length = 0;
  }

  finalize() {}
}

const DEFAULT_CHUNK_SIZE = 2**24;
const MAX_CHUNKS_AT_ONCE = 2;

// interface Chunk {
//     start: number,
//     written: ChunkSection[],
//     data: Uint8Array,
//     shouldFlush: boolean
// }

// interface ChunkSection {
//     start: number,
//     end: number
// }

/**
 * Writes to a StreamTarget using a chunked approach: Data is first buffered in memory until it reaches a large enough
 * size, which is when it is piped to the StreamTarget. This is helpful for reducing the total amount of writes.
 */
export class ChunkedStreamTargetWriter extends Writer {
  target;
  chunkSize;
  /**
     * The data is divided up into fixed-size chunks, whose contents are first filled in RAM and then flushed out.
     * A chunk is flushed if all of its contents have been written.
     */
  chunks = [];

  constructor(target) {
    super();

    this.target = target;
    this.chunkSize = target.options?.chunkSize ?? DEFAULT_CHUNK_SIZE;

    if (!Number.isInteger(this.chunkSize) || this.chunkSize < 2**10) {
      throw new Error('Invalid StreamTarget options: chunkSize must be an integer not smaller than 1024.');
    }
  }

  write(data) {
    this.writeDataIntoChunks(data, this.pos);
    this.flushChunks();

    this.pos += data.byteLength;
  }

  writeDataIntoChunks(data, position) {
    // First, find the chunk to write the data into, or create one if none exists
    let chunkIndex = this.chunks.findIndex((x) => x.start <= position && position < x.start + this.chunkSize);
    if (chunkIndex === -1) chunkIndex = this.createChunk(position);
    const chunk = this.chunks[chunkIndex];

    // Figure out how much to write to the chunk, and then write to the chunk
    const relativePosition = position - chunk.start;
    const toWrite = data.subarray(0, Math.min(this.chunkSize - relativePosition, data.byteLength));
    chunk.data.set(toWrite, relativePosition);

    // Create a section describing the region of data that was just written to
    const section = {
      start: relativePosition,
      end: relativePosition + toWrite.byteLength,
    };
    this.insertSectionIntoChunk(chunk, section);

    // Queue chunk for flushing to target if it has been fully written to
    if (chunk.written[0].start === 0 && chunk.written[0].end === this.chunkSize) {
      chunk.shouldFlush = true;
    }

    // Make sure we don't hold too many chunks in memory at once to keep memory usage down
    if (this.chunks.length > MAX_CHUNKS_AT_ONCE) {
      // Flush all but the last chunk
      for (let i = 0; i < this.chunks.length-1; i++) {
        this.chunks[i].shouldFlush = true;
      }
      this.flushChunks();
    }

    // If the data didn't fit in one chunk, recurse with the remaining datas
    if (toWrite.byteLength < data.byteLength) {
      this.writeDataIntoChunks(data.subarray(toWrite.byteLength), position + toWrite.byteLength);
    }
  }

  insertSectionIntoChunk(chunk, section) {
    let low = 0;
    let high = chunk.written.length - 1;
    let index = -1;

    // Do a binary search to find the last section with a start not larger than `section`'s start
    while (low <= high) {
      const mid = Math.floor(low + (high - low + 1) / 2);

      if (chunk.written[mid].start <= section.start) {
        low = mid + 1;
        index = mid;
      } else {
        high = mid - 1;
      }
    }

    // Insert the new section
    chunk.written.splice(index + 1, 0, section);
    if (index === -1 || chunk.written[index].end < section.start) index++;

    // Merge overlapping sections
    while (index < chunk.written.length - 1 && chunk.written[index].end >= chunk.written[index + 1].start) {
      chunk.written[index].end = Math.max(chunk.written[index].end, chunk.written[index + 1].end);
      chunk.written.splice(index + 1, 1);
    }
  }

  createChunk(includesPosition) {
    const start = Math.floor(includesPosition / this.chunkSize) * this.chunkSize;
    const chunk = {
      start,
      data: new Uint8Array(this.chunkSize),
      written: [],
      shouldFlush: false,
    };
    this.chunks.push(chunk);
    this.chunks.sort((a, b) => a.start - b.start);

    return this.chunks.indexOf(chunk);
  }

  flushChunks(force = false) {
    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      if (!chunk.shouldFlush && !force) continue;

      for (const section of chunk.written) {
        this.target.options.onData?.(
            chunk.data.subarray(section.start, section.end),
            chunk.start + section.start,
        );
      }
      this.chunks.splice(i--, 1);
    }
  }

  finalize() {
    this.flushChunks(true);
  }
}

/**
 * Essentially a wrapper around ChunkedStreamTargetWriter, writing directly to disk using the File System Access API.
 * This is useful for large files, as available RAM is no longer a bottleneck.
 */
export class FileSystemWritableFileStreamTargetWriter extends ChunkedStreamTargetWriter {
  constructor(target) {
    super(new StreamTarget({
      onData: (data, position) => target.stream.write({
        type: 'write',
        data,
        position,
      }),
      chunkSize: target.options?.chunkSize,
    }));
  }
}
