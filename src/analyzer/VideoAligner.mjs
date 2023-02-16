import { AnalyzerEvents } from "../enums/AnalyzerEvents.mjs";
import { EventEmitter } from "../modules/eventemitter.mjs";
import { Pako } from "../modules/pako.mjs";
import { Utils } from "../utils/Utils.mjs";
import { dHash } from "./dHash.mjs";

const WIDTH = 16;
const HEIGHT = 8;
const HASH_BITS = WIDTH * HEIGHT / 2;
const HASH_LENGTH = Math.ceil(HASH_BITS / 32);
const ALIGN_CUTOFF = 16;
export class VideoAligner extends EventEmitter {
    constructor() {
        super();
        this.canvas = document.createElement("canvas");
        this.canvas.width = WIDTH;
        this.canvas.height = HEIGHT;
        this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });

        this.currentSequence = [];

        this.currentIdentifier = '';
        this.found = false;
        this.lastMatched = null;
        this.memory = new Map();


        this.hasMemoryChanges = false;
    }


    prepare(identifier) {
        //   identifier += Math.random();
        this.detectedStartTime = -1;
        this.detectedEndTime = -1;
        this.lastMatched = null;
        this.currentIdentifier = identifier;

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

        var data = this.extractData(video);

        let hs = dHash.getHash(data.data);
        var hash = new Uint32Array(HASH_LENGTH);

        for (let i = 0; i < HASH_LENGTH; i++) {
            hash[i] = parseInt(hs.substring(i * 32, (i + 1) * 32), 2);
        }

        let time = Math.round(data.time);
        let index = Utils.binarySearch(this.currentSequence, time, (time, item) => {
            if (time > item.time)
                return 1;

            if (time < item.time)
                return -1;

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

        let entries = entry.entries;
        let found = false;
        for (let i = 0; i < entries.length; i++) {
            let distance = this.hashDistance(entries[i].hash, hash);
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
            if (time > item.time)
                return 1;

            if (time < item.time)
                return -1;

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

        let timeA = sequence[index - 1].time;
        let timeB = sequence[index].time;

        if (Math.abs(timeA - time) < Math.abs(timeB - time)) {
            return index - 1;
        }

        return index;
    }

    calculate() {


        let matches = [];
        this.memory.forEach((memoryEntry, identifier) => {
            if (identifier === this.currentIdentifier) return;

            let sequence = memoryEntry.sequence;
            let aligned = this.hackyAlignment(this.currentSequence, sequence);

            if (aligned && aligned.count > 4 && aligned.score > (ALIGN_CUTOFF * 5)) {

                let offsetStart = this.currentSequence[aligned.startA].time - sequence[aligned.startB].time;
                let offsetEnd = this.currentSequence[aligned.endA].time - sequence[aligned.endB].time;



                if (memoryEntry.matchStart === -1 || aligned.startB <= memoryEntry.matchStart) {
                    memoryEntry.matchStart = aligned.startB;
                    this.hasMemoryChanges = true;
                } else {
                    let time = sequence[memoryEntry.matchStart].time + offsetStart;
                    let indexA = this.getClosestIndex(this.currentSequence, time);
                    let indexB = memoryEntry.matchStart

                    if (Math.abs(this.currentSequence[indexA].time - time) <= 2) {
                        let filled = (aligned.startA - indexA) / (aligned.startB - indexB);

                        if (filled > 0.8) {
                            // console.log("filled start", filled, memoryEntry.matchStart, aligned.startB, aligned)
                            memoryEntry.matchStart = aligned.startB;
                            this.hasMemoryChanges = true;
                        }
                    }
                }

                if (memoryEntry.matchEnd === -1 || aligned.endB >= memoryEntry.matchEnd) {
                    memoryEntry.matchEnd = aligned.endB;
                    this.hasMemoryChanges = true;
                } else {
                    let time = sequence[memoryEntry.matchEnd].time + offsetEnd;
                    let indexA = this.getClosestIndex(this.currentSequence, time);
                    let indexB = memoryEntry.matchEnd

                    if (Math.abs(this.currentSequence[indexA].time - time) <= 2) {
                        let filled = (indexA - aligned.endA) / (indexB - aligned.endB);

                        if (filled > 0.8) {
                            // console.log("filled end", filled, memoryEntry.matchEnd, aligned.endB, aligned)
                            memoryEntry.matchEnd = aligned.endB;
                            this.hasMemoryChanges = true;
                        }
                    }

                }

                matches.push({
                    identifier,
                    startTime: sequence[memoryEntry.matchStart].time + offsetStart,
                    endTime: sequence[memoryEntry.matchEnd].time + offsetEnd,
                    count: aligned.count,
                });
            };
        });

        this.found = false;

        if (matches.length > 0) {

            let maxCountIndex = 0;
            for (var i = 1; i < matches.length; i++) {
                if (matches[i].count > matches[maxCountIndex].count) {
                    maxCountIndex = i;
                }
            }

            this.found = true;

            let hasChanged = this.detectedStartTime !== matches[maxCountIndex].startTime || this.detectedEndTime !== matches[maxCountIndex].endTime;

            this.detectedStartTime = matches[maxCountIndex].startTime;
            this.detectedEndTime = matches[maxCountIndex].endTime;

            if (this.lastMatched !== matches[maxCountIndex].identifier) {
                if (this.lastMatched) {
                    let item = this.memory.get(this.lastMatched);
                    item.deleteIn += -2;
                    this.hasMemoryChanges = true;
                }

                this.lastMatched = matches[maxCountIndex].identifier;
                let item = this.memory.get(matches[maxCountIndex].identifier);
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
        let result = [];
        for (let i = 0; i < buffer.length; i++) {
            result.push(String.fromCharCode(buffer[i]));
        }
        return btoa(result.join(""));
    }
    getMemoryForSave() {
        let memory = {};

        this.memory.forEach((item, identifier) => {

            if (!item.sequence.length) return;

            let timeBuffer = new Uint16Array(item.sequence.length);
            let hashBuffer = new Uint32Array(item.sequence.length * HASH_LENGTH);

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
                startTime: item.sequence[0].time
            }
        });

        return memory;
    }

    unsetChangesFlag() {
        this.hasMemoryChanges = false;
    }

    hashToDebugString(hash) {
        let str = [];
        for (let i = 0; i < hash.length; i++) {
            str.push(hash[i].toString(2).padStart(32, "0"));
        }
        return str.join("|");
    }

    loadMemoryFromSave(saved) {
        //  console.log("Load")
        let memory = this.memory;
        for (let identifier in saved) {

            let hashBuffer = new Uint32Array(Pako.inflate(Uint8Array.from(atob(saved[identifier].hashBuffer), c => c.charCodeAt(0))).buffer);
            let timeBuffer = new Uint16Array(Pako.inflate(Uint8Array.from(atob(saved[identifier].timeBuffer), c => c.charCodeAt(0))).buffer);

            let sequence = [];
            let startTime = saved[identifier].startTime;
            for (var i = 0; i < timeBuffer.length; i++) {
                startTime = timeBuffer[i] + startTime;
                let hash = hashBuffer.slice(i * HASH_LENGTH, (i + 1) * HASH_LENGTH);
                sequence.push({
                    time: startTime,
                    hash: hash
                });

            }

            if (identifier === this.currentIdentifier) {
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
            startTime: this.detectedStartTime,
            endTime: this.detectedEndTime,
        }
    }

    extractData(video) {
        var time = video.currentTime;
        this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height)

        var data = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

        return {
            data: data,
            time: time
        }
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
        let memoryEntry = this.memory.get(this.lastMatched);
        let sequenceA = this.currentSequence;
        let sequenceB = memoryEntry.sequence;

        let aligned = this.hackyAlignment(sequenceA, sequenceB);
        console.log(aligned.matrix.map((row) => row.map(val => val.value.toString().padStart(4, " ")).join(",")).join("\n"));
        console.log(aligned)
    }

    printComparison() {
        this.calculate();
        if (!this.lastMatched) return;
        let memoryEntry = this.memory.get(this.lastMatched);
        let sequenceA = this.currentSequence;
        let sequenceB = memoryEntry.sequence;
        let aligned = this.hackyAlignment(sequenceA, sequenceB);

        let offsetTime = sequenceA[aligned.startA].time - sequenceB[aligned.startB].time;
        let start = Math.min(sequenceA[0].time, sequenceB[0].time + offsetTime);
        let end = Math.max(sequenceA[sequenceA.length - 1].time, sequenceB[sequenceB.length - 1].time + offsetTime);

        let arr = []
        for (let i = start; i <= end; i++) {
            let a = sequenceA.find(item => item.time === i);
            let b = sequenceB.find(item => (item.time + offsetTime) === i);
            if (a && b) {
                arr.push(`T+${i}:${this.hashDistance(a.hash, b.hash)}\n${a.debugHash}\n${b.debugHash}`);
            } else if (a) {
                arr.push(`T+${i}\n${a.debugHash}\n`);
            } else if (b) {
                arr.push(`T+${i}\n\n${b.debugHash}`);
            }
        }

        console.log(arr.join("\n\n"))

    }

    hackyAlignment(sequenceA, sequenceB) {
        let matrixMax = null;

        var matrix = new Array(sequenceA.length);
        for (var a = 0; a < matrix.length; a++) {
            matrix[a] = new Array(sequenceB.length);
            for (var b = 0; b < matrix[a].length; b++) {
                let dist = this.hashDistance(sequenceA[a].hash, sequenceB[b].hash);
                matrix[a][b] = {
                    a, b,
                    value: Math.max(0, ALIGN_CUTOFF - dist),
                    prev: null
                }

                if (matrix[a][b].value > 0) {

                    let ai = a - 1;
                    let bi = b - 1;
                    let timeA = sequenceA[a].time;
                    let timeB = sequenceB[b].time;

                    let max = 0;
                    let maxCell = null;

                    while (ai >= 0 && bi >= 0) {
                        let durationA = timeA - sequenceA[ai].time;
                        let durationB = timeB - sequenceB[bi].time;
                        if (durationA > 10 || durationB > 10) {
                            break;
                        }
                        let diff = Math.abs(durationA - durationB) * 2;
                        if (diff <= 3) {
                            let val = matrix[ai][bi].value - diff * Math.ceil(ALIGN_CUTOFF / 4);
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
                matrix: matrix
            }
        } else {
            return null;
        }

    }
}