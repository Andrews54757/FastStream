import {EventEmitter} from '../../modules/eventemitter.mjs';

export class SourceBufferWrapper extends EventEmitter {
  constructor(mediaSource, codec) {
    super();
    if (!MediaSource.isTypeSupported(codec)) {
      throw new Error('Codec not supported: ' + codec);
    }
    this.sourceBuffer = mediaSource.addSourceBuffer(codec);
    this.updating = false;
    this.toDo = [];
    this.sourceBuffer.addEventListener('updateend', () => {
      this.updating = false;
      this.emit('updateend');
      this.sourceBufferDo();
    });
  }
  abort() {
    this.sourceBuffer.abort();
  }

  appendBuffer(buffer) {
    return new Promise((resolve, reject) => {
      this.do({
        type: 'append',
        buffer: buffer,
        resolve,
        reject,
      });
    });
  }

  remove(start, end) {
    return new Promise((resolve, reject) => {
      this.do({
        type: 'remove',
        start,
        end,
        resolve,
        reject,
      });
    });
  }

  sourceBufferDo() {
    if (this.updating) return;
    if (this.toDo.length) {
      const current = this.toDo[0];

      if (current.type === 'append') {
        this.sourceBuffer.appendBuffer(current.buffer);
        current.resolve();
      } else if (current.type === 'remove') {
        try {
          this.sourceBuffer.remove(current.start, current.end);
          current.resolve();
        } catch (e) {
          console.log(e);
          current.reject(e);
        }
      }
      this.updating = true;
      this.toDo.splice(0, 1);
    }
  }
  do(obj) {
    this.toDo.push(obj);
    if (!this.updating) this.sourceBufferDo();
  }

  get buffered() {
    return this.sourceBuffer.buffered;
  }
}
