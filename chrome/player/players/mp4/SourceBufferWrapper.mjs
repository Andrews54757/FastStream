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

      // An operation that throws starts no update, so no updateend follows it. Marking the
      // wrapper updating then left every later operation queued for good, and an append that
      // threw stayed at the head and was run again, and threw again, by every later call.
      try {
        if (current.type === 'append') {
          this.sourceBuffer.appendBuffer(current.buffer);
        } else if (current.type === 'remove') {
          this.sourceBuffer.remove(current.start, current.end);
        }
      } catch (e) {
        console.log(e);
        current.reject(e);
        this.toDo.splice(0, 1);
        this.sourceBufferDo();
        return;
      }
      current.resolve();
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
