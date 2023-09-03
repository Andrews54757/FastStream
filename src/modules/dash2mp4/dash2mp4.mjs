import { EventEmitter } from "../eventemitter.mjs";
import { MP4Box } from "../mp4box.mjs";
import { MP4 } from "../hls2mp4/MP4Generator.mjs";



export class DASH2MP4 extends EventEmitter {
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
        let blob = await fragData.entry.getData();
        let data = await fragData.entry.getDataFromBlob()
        data.fileStart = 0;
        var mp4boxfile = MP4Box.createFile(false);
        mp4boxfile.onError = function (e) {
            console.log("mp4box error", e);
        }

        mp4boxfile.appendBuffer(data);
        mp4boxfile.flush();

        const mdats = mp4boxfile.mdats;
        mdats.forEach((mdat) => {
            this.datas.push(blob.slice(mdat.start, mdat.start + mdat.size));
        });

        console.log(fragData, mp4boxfile)
    }



    async pushFragmentAudio(fragData) {
        let data = await fragData.entry.getDataFromBlob();

    }

    setup(videoProcessor, videoInitSegment, audioProcessor, audioInitSegment) {
        if (!videoProcessor && !audioProcessor) {
            throw new Error("no processor");
        }



        if (videoProcessor) {

            let file = MP4Box.createFile(false);
            videoInitSegment.fileStart = 0;
            file.appendBuffer(videoInitSegment);
            file.flush();

            file.moov.mvhd
            

            const movieTimescale = file.moov.mvhd.timescale;
            const mediaInfo = videoProcessor.getMediaInfo();
            const trak = file.moov.traks[0];
            const timescale = trak.mdia.mdhd.timescale;
            this.videoTrack = {
                type: "video",
                id: 1,
                timescale: timescale,
                movieTimescale: movieTimescale,
                duration: mediaInfo.streamInfo.duration,
                width: trak.tkhd.width >> 16,
                height: trak.tkhd.height >> 16,
                pixelRatio: [1, 1],
                sps: [],
                pps: [],
                // segmentCodec: null,
                // codec: null,
                // config: null,
                // channelCount: null,
                // sampleRate: null,
                samples: [],
                chunks: [],
                use64Offsets: false,
                nextChunkId: 1,
                elst: []
            }

            const avcC = trak.mdia.minf.stbl.stsd.entries.find((e)=>e.type === "avc1").avcC;
            avcC.PPS.forEach((pps) => {
                this.videoTrack.pps.push(pps.nalu);
            });
            avcC.SPS.forEach((sps) => {
                this.videoTrack.sps.push(sps.nalu);
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

        tracks.forEach((track) => {
            track.elst.push({
                media_time: track.chunks[0].startPTS - minPts,
                segment_duration: track.chunks[track.chunks.length - 1].endPTS - track.chunks[0].startPTS,
            })

            track.samples = [];
            track.chunks.forEach((chunk) => {
                track.samples.push(...chunk.samples);
            });
        })
        console.log(tracks)
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
    async convert(videoProcessor, videoInitSegment, audioProcessor, audioInitSegment, fragDatas) {


        this.setup(videoProcessor, videoInitSegment, audioProcessor, audioInitSegment);

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
        this.videoTrack = null;
        this.audioTrack = null;
        this.prevFrag = null;
        this.datas = null;
        this.datasOffset = 0;

    }

}