import {AnalyzerEvents} from '../enums/AnalyzerEvents.mjs';
import {EventEmitter} from '../modules/eventemitter.mjs';
import Pako from '../modules/pako.mjs';
import {Utils} from '../utils/Utils.mjs';
import {dHash} from './dHash.mjs';

const WIDTH = 16;
const HEIGHT = 8;
const HASH_BITS = WIDTH * HEIGHT / 2;
const HASH_LENGTH = Math.ceil(HASH_BITS / 32);
const ALIGN_CUTOFF = 14;
export class VideoAligner extends EventEmitter {
  constructor() {
    super();
    this.canvas = document.createElement('canvas');
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.ctx = this.canvas.getContext('2d', {willReadFrequently: true});

    this.currentSequence = [];

    this.currentIdentifier = '';
    this.found = false;
    this.lastMatched = null;
    this.memory = new Map();


    this.hasMemoryChanges = false;
  }

  setRange(start, end) {
    this.scanStart = start;
    this.scanEnd = end;
  }

  prepare(identifier) {
    //   identifier += Math.random();
    this.detectedStartTime = -1;
    this.detectedEndTime = -1;
    this.lastMatched = null;
    this.currentIdentifier = identifier;
    this.scanStart = -Infinity;
    this.scanEnd = Infinity;

    if (this.currentSequence) {
      this.currentSequence.forEach((value) => {
        delete value.entries;
        delete value.timeSet;
      });
    }
    this.currentSequence = [];
    this.memory.set(identifier, {
      sequence: this.currentSequence,
      identifier: identifier,
      deleteIn: 3,
      matchStart: -1,
      matchEnd: -1,
    });
    this.cleanMemory();

    if (this.found) {
      this.found = false;
      this.emit(AnalyzerEvents.MATCH, this);
    }
  }

  hashEquals(a, b) {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  hashDistance(a, b) {
    let distance = 0;
    for (let i = 0; i < a.length; i++) {
      distance += this.linearBitDistance(a[i], b[i]);
    }
    return distance;
  }
  cleanMemory() {
    this.memory.forEach((value, key) => {
      if (value.deleteIn <= 0) {
        this.memory.delete(key);
      } else if (key !== this.currentIdentifier) {
        value.deleteIn--;
      }
    });
    this.hasMemoryChanges = true;
  }

  getCurrentMemory() {
    return this.memory.get(this.currentIdentifier);
  }

  pushVideoFrame(video) {
    const data = this.extractData(video);

    const hs = dHash.getHash(data.data);
    const hash = new Uint32Array(HASH_LENGTH);

    for (let i = 0; i < HASH_LENGTH; i++) {
      hash[i] = parseInt(hs.substring(i * 32, (i + 1) * 32), 2);
    }

    const time = Math.round(data.time);
    const index = Utils.binarySearch(this.currentSequence, time, (time, item) => {
      if (time > item.time) {
        return 1;
      }

      if (time < item.time) {
        return -1;
      }

      return 0;
    });

    let entry = null;
    if (index < 0) {
      entry = {
        time,
        hash: null,
        entries: [],
        timeSet: new Set(),
      };
      this.currentSequence.splice(-index - 1, 0, entry);
      this.hasMemoryChanges = true;
    } else {
      entry = this.currentSequence[index];
    }

    if (entry.timeSet.has(data.time)) return;

    entry.timeSet.add(data.time);

    const entries = entry.entries;
    let found = false;
    for (let i = 0; i < entries.length; i++) {
      const distance = this.hashDistance(entries[i].hash, hash);
      entries[i].score += HASH_LENGTH * 32 - distance;
      if (distance === 0) {
        found = true;
      }
    }

    entry.entries.sort((a, b) => b.score - a.score);

    if (!found) {
      entry.entries.push({
        hash,
        score: 0,
      });
    }

    if (!entry.hash || !this.hashEquals(entry.hash, entry.entries[0].hash)) {
      this.hasMemoryChanges = true;
      entry.hash = entry.entries[0].hash;
    }
  }

  getClosestIndex(sequence, time) {
    let index = Utils.binarySearch(sequence, time, (time, item) => {
      if (time > item.time) {
        return 1;
      }

      if (time < item.time) {
        return -1;
      }

      return 0;
    });

    if (index >= 0) {
      return index;
    }

    index = -index - 1;
    if (index <= 0) {
      return 0;
    }

    if (index >= sequence.length) {
      return sequence.length - 1;
    }

    const timeA = sequence[index - 1].time;
    const timeB = sequence[index].time;

    if (Math.abs(timeA - time) < Math.abs(timeB - time)) {
      return index - 1;
    }

    return index;
  }

  clampTime(time) {
    return Math.max(this.scanStart, Math.min(this.scanEnd, time));
  }

  calculate() {
    const matches = [];
    this.memory.forEach((memoryEntry, identifier) => {
      if (identifier === this.currentIdentifier) return;

      const sequence = memoryEntry.sequence;
      const aligned = this.hackyAlignment(this.currentSequence, sequence);

      if (aligned && aligned.count > 4 && aligned.score > (ALIGN_CUTOFF * 30)) {
        const offsetStart = this.currentSequence[aligned.startA].time - sequence[aligned.startB].time;
        const offsetEnd = this.currentSequence[aligned.endA].time - sequence[aligned.endB].time;


        if (memoryEntry.matchStart === -1) {
          memoryEntry.matchStart = aligned.startB;
          this.hasMemoryChanges = true;
        }


        if (memoryEntry.matchEnd === -1) {
          memoryEntry.matchEnd = aligned.endB;
          this.hasMemoryChanges = true;
        }

        const timeStart = this.clampTime(sequence[memoryEntry.matchStart].time + offsetStart);
        const timeEnd = this.clampTime(sequence[memoryEntry.matchEnd].time + offsetStart);
        const indexBStart = this.getClosestIndex(sequence, timeStart - offsetStart);
        const indexBEnd = this.getClosestIndex(sequence, timeEnd - offsetEnd);

        let indexStart = this.getClosestIndex(this.currentSequence, timeStart);

        if (this.currentSequence[indexStart].time < timeStart) {
          // get closest one that is bigger
          while (indexStart < this.currentSequence.length && this.currentSequence[indexStart].time < timeStart) {
            indexStart++;
          }
        }

        let indexEnd = this.getClosestIndex(this.currentSequence, timeEnd);

        if (this.currentSequence[indexEnd].time > timeEnd) {
          // get closest one that is smaller
          while (indexEnd > 0 && this.currentSequence[indexEnd].time > timeEnd) {
            indexEnd--;
          }
        }

        let filled = (indexEnd - indexStart) / (indexBEnd - indexBStart);
        if (timeEnd === timeStart) {
          filled = 1;
        }

        if (aligned.startB < memoryEntry.matchStart) {
          // If the match start is before the stored start, we need to move the stored start earlier
          // But only do it if we have 50% of the match filled
          if (filled > 0.5) {
            memoryEntry.matchStart = aligned.startB;
            this.hasMemoryChanges = true;
          }
        } else if (aligned.startB > memoryEntry.matchStart) {
          // If the match start is after the stored start, we need to move the stored start later
          // But only do it if we have 75% of the match filled
          if (filled > 0.75) {
            memoryEntry.matchStart = aligned.startB;
            this.hasMemoryChanges = true;
          }
        }

        if (aligned.endB < memoryEntry.matchEnd) {
          // If the match end is before the stored end, we need to move the stored end earlier
          // But only do it if we have 75% of the match filled
          if (filled > 0.75) {
            memoryEntry.matchEnd = aligned.endB;
            this.hasMemoryChanges = true;
          }
        } else if (aligned.endB > memoryEntry.matchEnd) {
          // If the match end is after the stored end, we need to move the stored end later
          // But only do it if we have 50% of the match filled
          if (filled > 0.5) {
            memoryEntry.matchEnd = aligned.endB;
            this.hasMemoryChanges = true;
          }
        }

        if (aligned.endB >= memoryEntry.matchStart && aligned.startB <= memoryEntry.matchEnd) {
          matches.push({
            identifier,
            startTime: sequence[memoryEntry.matchStart].time + offsetStart,
            endTime: sequence[memoryEntry.matchEnd].time + offsetEnd,
            count: memoryEntry.matchEnd - memoryEntry.matchStart,
          });
        }
      };
    });

    this.found = false;

    if (matches.length > 0) {
      let maxCountIndex = 0;
      for (let i = 1; i < matches.length; i++) {
        if (matches[i].count > matches[maxCountIndex].count) {
          maxCountIndex = i;
        }
      }

      this.found = true;

      const hasChanged = this.detectedStartTime !== matches[maxCountIndex].startTime || this.detectedEndTime !== matches[maxCountIndex].endTime;

      this.detectedStartTime = matches[maxCountIndex].startTime;
      this.detectedEndTime = matches[maxCountIndex].endTime;

      if (this.lastMatched !== matches[maxCountIndex].identifier) {
        if (this.lastMatched) {
          const item = this.memory.get(this.lastMatched);
          item.deleteIn += -2;
          this.hasMemoryChanges = true;
        }

        this.lastMatched = matches[maxCountIndex].identifier;
        const item = this.memory.get(matches[maxCountIndex].identifier);
        if (item.deleteIn < 3) {
          item.deleteIn += 2;
          this.hasMemoryChanges = true;
        }
      }


      if (hasChanged) {
        this.emit(AnalyzerEvents.MATCH, this);
      }
    }
  }

  stringifyBuffer(buffer) {
    const result = [];
    for (let i = 0; i < buffer.length; i++) {
      result.push(String.fromCharCode(buffer[i]));
    }
    return btoa(result.join(''));
  }
  getMemoryForSave() {
    const memory = {};

    this.memory.forEach((item, identifier) => {
      if (!item.sequence.length) return;

      const timeBuffer = new Uint16Array(item.sequence.length);
      const hashBuffer = new Uint32Array(item.sequence.length * HASH_LENGTH);

      let startTime = item.sequence[0].time;
      item.sequence.forEach((item, index) => {
        timeBuffer[index] = item.time - startTime;
        startTime = item.time;
        for (let i = 0; i < HASH_LENGTH; i++) {
          hashBuffer[index * HASH_LENGTH + i] = item.hash[i];
        }
      });

      memory[identifier] = {
        hashBuffer: this.stringifyBuffer(Pako.deflate(hashBuffer.buffer)),
        timeBuffer: this.stringifyBuffer(Pako.deflate(timeBuffer.buffer)),
        deleteIn: item.deleteIn,
        matchStart: item.matchStart,
        matchEnd: item.matchEnd,
        startTime: item.sequence[0].time,
      };
    });

    return memory;
  }

  unsetChangesFlag() {
    this.hasMemoryChanges = false;
  }

  hashToDebugString(hash) {
    const str = [];
    for (let i = 0; i < hash.length; i++) {
      str.push(hash[i].toString(2).padStart(32, '0'));
    }
    return str.join('|');
  }

  loadMemoryFromSave(saved) {
    //  console.log("Load")
    const memory = this.memory;
    for (const identifier in saved) {
      if (!Object.hasOwn(saved, identifier)) continue;
      const hashBuffer = new Uint32Array(Pako.inflate(Uint8Array.from(atob(saved[identifier].hashBuffer), (c) => c.charCodeAt(0))).buffer);
      const timeBuffer = new Uint16Array(Pako.inflate(Uint8Array.from(atob(saved[identifier].timeBuffer), (c) => c.charCodeAt(0))).buffer);

      const sequence = [];
      let startTime = saved[identifier].startTime;
      for (let i = 0; i < timeBuffer.length; i++) {
        startTime = timeBuffer[i] + startTime;
        const hash = hashBuffer.slice(i * HASH_LENGTH, (i + 1) * HASH_LENGTH);
        sequence.push({
          time: startTime,
          hash: hash,
        });
      }

      if (identifier === this.currentIdentifier) {
        sequence.forEach((item) => {
          item.entries = [];
          item.timeSet = new Set();
        });
        this.currentSequence = sequence;
      }

      memory.set(identifier, {
        identifier,
        sequence,
        deleteIn: saved[identifier].deleteIn,
        matchStart: saved[identifier].matchStart,
        matchEnd: saved[identifier].matchEnd,
      });
    }
  }

  getMatch() {
    if (!this.found) return null;
    return {
      startTime: this.clampTime(this.detectedStartTime),
      endTime: this.clampTime(this.detectedEndTime),
    };
  }

  extractData(video) {
    const time = video.currentTime;
    this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);

    const data = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

    return {
      data: data,
      time: time,
    };
  }

  linearBitDistance(a, b) {
    let xor = a ^ b;
    let count = 0;
    while (xor) {
      xor = xor & (xor - 1);
      count++;
    }
    return count;
  }

  printMatrix() {
    this.calculate();
    if (!this.lastMatched) return;
    const memoryEntry = this.memory.get(this.lastMatched);
    const sequenceA = this.currentSequence;
    const sequenceB = memoryEntry.sequence;

    const aligned = this.hackyAlignment(sequenceA, sequenceB);
    console.log(aligned.matrix.map((row) => row.map((val) => val.value.toString()).join('\t')).join('\n'));
    console.log(aligned);
  }

  printComparison() {
    this.calculate();
    if (!this.lastMatched) return;
    const memoryEntry = this.memory.get(this.lastMatched);
    const sequenceA = this.currentSequence;
    const sequenceB = memoryEntry.sequence;
    const aligned = this.hackyAlignment(sequenceA, sequenceB);

    const offsetTime = sequenceA[aligned.startA].time - sequenceB[aligned.startB].time;
    const start = Math.min(sequenceA[0].time, sequenceB[0].time + offsetTime);
    const end = Math.max(sequenceA[sequenceA.length - 1].time, sequenceB[sequenceB.length - 1].time + offsetTime);

    const arr = [];
    for (let i = start; i <= end; i++) {
      const a = sequenceA.find((item) => item.time === i);
      const b = sequenceB.find((item) => (item.time + offsetTime) === i);
      if (a && b) {
        arr.push(`T+${i}:${this.hashDistance(a.hash, b.hash)}\n${this.debugHashString(a.hash)}\n${this.debugHashString(b.hash)}`);
      } else if (a) {
        arr.push(`T+${i}\n${this.debugHashString(a.hash)}\n`);
      } else if (b) {
        arr.push(`T+${i}\n\n${this.debugHashString(b.hash)}`);
      }
    }

    console.log(arr.join('\n\n'));
  }

  debugHashString(hash) {
    const str = [];
    for (let i = 0; i < hash.length; i++) {
      str.push(hash[i].toString(2).padStart(32, '0'));
    }
    return str.join('');
  }

  hackyAlignment(sequenceA, sequenceB) {
    let matrixMax = null;

    const matrix = new Array(sequenceA.length);
    for (let a = 0; a < matrix.length; a++) {
      matrix[a] = new Array(sequenceB.length);
      for (let b = 0; b < matrix[a].length; b++) {
        const dist = this.hashDistance(sequenceA[a].hash, sequenceB[b].hash);
        matrix[a][b] = {
          a, b,
          value: Math.max(0, ALIGN_CUTOFF - dist),
          prev: null,
        };

        if (matrix[a][b].value > 0) {
          matrix[a][b].value += ALIGN_CUTOFF * 5;
          let ai = a - 1;
          let bi = b - 1;
          const timeA = sequenceA[a].time;
          const timeB = sequenceB[b].time;

          let max = 0;
          let maxCell = null;

          while (ai >= 0 && bi >= 0) {
            const durationA = timeA - sequenceA[ai].time;
            const durationB = timeB - sequenceB[bi].time;
            if (durationA > 8 || durationB > 8) {
              break;
            }
            const diff = Math.abs(durationA - durationB);
            if (diff <= 2) {
              const val = matrix[ai][bi].value - diff * Math.ceil(ALIGN_CUTOFF / 4);
              if (val > max) {
                max = val;
                maxCell = matrix[ai][bi];
              }
            }

            if (durationB > durationA) {
              ai--;
            } else {
              bi--;
            }
          }
          matrix[a][b].value += max;
          matrix[a][b].prev = maxCell;

          if (!matrixMax || matrix[a][b].value > matrixMax.value) {
            matrixMax = matrix[a][b];
          }
        }
      }
    }


    if (matrixMax) {
      let count = 0;

      let start = matrixMax;

      while (start.prev) {
        count++;
        start = start.prev;
      }

      return {
        count: count,
        score: matrixMax.value,
        startA: start.a,
        startB: start.b,
        endA: matrixMax.a,
        endB: matrixMax.b,
        matrix: matrix,
      };
    } else {
      return null;
    }
  }
}
