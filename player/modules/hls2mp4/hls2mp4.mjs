import { EventEmitter } from "../eventemitter.mjs";
import { MP4 } from "./MP4Generator.mjs";
import Transmuxer from "./transmuxer.mjs";



export class HLS2MP4 extends EventEmitter {
    constructor() {
        super()
    }

    arrayEquals(a, b) {
        var i;

        if (a.length !== b.length) {
            return false;
        } // compare the value of each element in the array


        for (i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
                return false;
            }
        }

        return true;
    }

    async pushFragment(fragData) {
        let data = await fragData.entry.getDataFromBlob();
        let fragment = fragData.fragment;
        let isDiscontinuity = !this.prevFrag || fragment.sn !== this.prevFrag.fragment.sn + 1 || fragment.cc !== this.prevFrag.fragment.cc;

        if (isDiscontinuity) {
            console.log("discontinuity");
        }
        this.prevFrag = fragData;
        let result = this.transmuxer.pushData(new Uint8Array(data), isDiscontinuity);
        let headerLen = 8;

        if (result.video) {
            if (!this.videoTrack) {
                this.videoTrack = {
                    ...result.videoTrack,
                    samples: [],
                    chunks: [],
                    use64Offsets: false,
                    nextChunkId: 1,
                    elst: []
                }
            }

            result.videoTrack.pps.forEach((pps) => {
                if (!this.videoTrack.pps.find((p) => {
                    return this.arrayEquals(p, pps);
                })) {
                    this.videoTrack.pps.push(pps);
                }
            });

            result.videoTrack.sps.forEach((sps) => {
                if (!this.videoTrack.sps.find((s) => {
                    return this.arrayEquals(s, sps);
                })) {
                    this.videoTrack.sps.push(sps);
                }
            });

            this.videoTrack.chunks.push({
                id: this.videoTrack.nextChunkId++,
                samples: result.video.outputSamples,
                offset: this.datasOffset + headerLen,
                originalOffset: this.datasOffset + headerLen,
                startDTS: result.video.startDTS,
                endDTS: result.video.endDTS,
                startPTS: result.video.startPTS,
                endPTS: result.video.endPTS,
            });
            let blob = new Blob([result.video.data2], {
                type: "video/mp4"
            })
            this.datas.push(blob);
            this.datasOffset += result.video.data2.byteLength;
        }

        if (result.audio) {
            if (!this.audioTrack) {
                this.audioTrack = {
                    ...result.audioTrack,
                    samples: [],
                    chunks: [],
                    use64Offsets: false,
                    nextChunkId: 1,
                    elst: []
                }
            }

            this.audioTrack.chunks.push({
                id: this.audioTrack.nextChunkId++,
                samples: result.audio.outputSamples,
                offset: this.datasOffset + headerLen,
                originalOffset: this.datasOffset + headerLen,
                startDTS: result.audio.startDTS,
                endDTS: result.audio.endDTS,
                startPTS: result.audio.startPTS,
                endPTS: result.audio.endPTS,
            });
            let blob = new Blob([result.audio.data2], {
                type: "video/mp4"
            })
            this.datas.push(blob);
            this.datasOffset += result.audio.data2.byteLength;

        }
    }

    async pushFragmentAudio(fragData) {
        let data = await fragData.entry.getDataFromBlob();
        let fragment = fragData.fragment;
        let isDiscontinuity = !this.prevFragAudio || fragment.sn !== this.prevFragAudio.fragment.sn + 1 || fragment.cc !== this.prevFragAudio.fragment.cc;

        if (isDiscontinuity) {
            console.log("discontinuity");
        }
        this.prevFragAudio = fragData;
        let result = this.transmuxerAudio.pushData(new Uint8Array(data), isDiscontinuity);
        let headerLen = 8;
        if (result.audio) {
            if (!this.audioTrack) {
                this.audioTrack = {
                    ...result.audioTrack,
                    samples: [],
                    chunks: [],
                    use64Offsets: false,
                    nextChunkId: 1,
                    elst: []
                }
            }

            this.audioTrack.chunks.push({
                id: this.audioTrack.nextChunkId++,
                samples: result.audio.outputSamples,
                offset: this.datasOffset + headerLen,
                originalOffset: this.datasOffset + headerLen,
                startDTS: result.audio.startDTS,
                endDTS: result.audio.endDTS,
                startPTS: result.audio.startPTS,
                endPTS: result.audio.endPTS,
            });
            let blob = new Blob([result.audio.data2], {
                type: "video/mp4"
            })
            this.datas.push(blob);
            this.datasOffset += result.audio.data2.byteLength;
        }
    }

    setup(level, audioLevel) {
        if (!level.details) {
            throw new Error("level.details is null");
        }

        if (audioLevel && !audioLevel.details) {
            throw new Error("audioLevel.details is null");
        }


        this.transmuxer = new Transmuxer({
            audioCodec: level.audioCodec,
            videoCodec: level.videoCodec,
            initSegmentData: [],
            duration: level.details.totalduration,
            defaultInitPts: 0,
        });

        if (audioLevel) {

            this.transmuxerAudio = new Transmuxer({
                videoCodec: "",
                audioCodec: audioLevel.audioCodec,
                initSegmentData: [],
                duration: level.details.totalduration,
                defaultInitPts: 0,
            });
        }

        this.prevFrag = null;
        this.prevFragAudio = null;
        this.datas = [];
        this.datasOffset = 0;
    }

    finalize() {
        let tracks = [];
        let videoTrack = this.videoTrack;
        let audioTrack = this.audioTrack;
        if (videoTrack) tracks.push(videoTrack);
        if (audioTrack) {
            tracks.push(audioTrack);

        }

        let len = tracks[0].chunks.length;
        let minPts = tracks[0].chunks[0].startPTS;

        for (let i = 0; i < tracks.length; i++) {
            if (tracks[i].chunks.length !== len) {
                console.log("WARNING: chunk length is not equal", tracks[i].chunks.length, len);
            }

            if (tracks[i].chunks[0].startPTS < minPts) {
                minPts = tracks[i].chunks[0].startPTS;
            }
        }
        let movieTimescale = tracks[0].timescale;
        tracks.forEach((track) => {
            track.elst.push({
                media_time: (track.chunks[0].startPTS - minPts) * movieTimescale,
                segment_duration: (track.chunks[track.chunks.length - 1].endPTS - track.chunks[0].startPTS) * movieTimescale,
            })

            track.samples = [];
            track.chunks.forEach((chunk) => {
                track.samples.push(...chunk.samples);
            });
        })
        let initSeg;
        try {
            let initSegCount = MP4.initSegment(tracks);
            let len = initSegCount.byteLength;

            tracks.forEach((track) => {
                track.chunks.forEach((chunk) => {
                    chunk.offset = chunk.originalOffset + len;
                });
            });

            initSeg = MP4.initSegment(tracks);
        } catch (e) {
            tracks.forEach((track) => {
                track.use64Offsets = true;
            });

            let initSegCount = MP4.initSegment(tracks);
            let len = initSegCount.byteLength;

            tracks.forEach((track) => {
                track.chunks.forEach((chunk) => {
                    chunk.offset = chunk.originalOffset + len;
                });
            });

            initSeg = MP4.initSegment(tracks);
        }

        return new Blob([initSeg, ...this.datas], {
            type: "video/mp4"
        });
    }
    async convert(level, audioLevel, fragDatas) {


        this.setup(level, audioLevel);

        for (let i = 0; i < fragDatas.length; i++) {
            if (fragDatas[i].type === 0) {
                await this.pushFragment(fragDatas[i]);
            } else {
                await this.pushFragmentAudio(fragDatas[i]);
            }
            this.emit("progress", (i + 1) / fragDatas.length);
        }

        let blob = this.finalize();
        this.destroy();

        return blob;
    }

    destroy() {
        if (this.transmuxer) this.transmuxer.destroy();
        if (this.transmuxerAudio) this.transmuxerAudio.destroy();
        this.transmuxerAudio = null;
        this.transmuxer = null;
        this.videoTrack = null;
        this.audioTrack = null;
        this.prevFrag = null;
        this.datas = null;
        this.datasOffset = 0;

    }

}