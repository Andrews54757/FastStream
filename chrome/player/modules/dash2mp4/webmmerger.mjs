import {EventEmitter} from '../eventemitter.mjs';
import {FSBlob} from '../FSBlob.mjs';
import {BlobManager} from '../../utils/BlobManager.mjs';
import {JsWebm} from './webm.mjs';
import {Muxer, StreamTarget} from './mp4-muxer.mjs';

export class WEBMMerger extends EventEmitter {
  constructor() {
    super();
    this.blobManager = new FSBlob();
  }

  arrayEquals(a, b) {
    let i;

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

  async pushVideoFragment(fragData) {
    const entry = await fragData.getEntry();
    const blob = await entry.getData();
    const data = await BlobManager.getDataFromBlob(blob, 'arraybuffer');
    const demuxer = this.videoDemuxer;

    demuxer.queueData(data);

    let count = 0;
    while (demuxer.demux()) {
      count++;
      if (count > 10000) {
        throw new Error('too many iterations');
      }
    }

    const packets = demuxer.videoPackets;

    for (let i = 0; i < packets.length - 1; i++) {
      const packet = packets[i];
      const nextPacket = packets[i + 1];
      const currentTimestamp = Math.floor(packet.timestamp * 1000000);
      const nextTimestamp = Math.floor(nextPacket.timestamp * 1000000);
      const chunk = new EncodedVideoChunk({
        type: packet.isKeyframe ? 'key' : 'delta',
        timestamp: currentTimestamp,
        duration: nextTimestamp - currentTimestamp,
        data: packet.data,
      });

      this.videoDecoder.decode(chunk);
    }

    // Remove all but the last packet
    packets.splice(0, packets.length - 1);

    this.waitEncodeVideoPromise = new Promise((resolve) => {
      this.resolveWaitEncodeVideoPromise = resolve;
    });

    await this.waitEncodeVideoPromise;

    if (
      this.videoEncoder.state !== 'configured' ||
        this.videoDecoder.state !== 'configured'
    ) {
      throw new Error('Video encoder/decoder has been closed!');
    }
  }

  async pushAudioFragment(fragData) {
    const entry = await fragData.getEntry();
    const blob = await entry.getData();
    const data = await BlobManager.getDataFromBlob(blob, 'arraybuffer');
    const demuxer = this.audioDemuxer;

    demuxer.queueData(data);

    let count = 0;
    while (demuxer.demux()) {
      count++;
      if (count > 10000) {
        throw new Error('too many iterations');
      }
    }

    const packets = demuxer.audioPackets;

    for (let i = 0; i < packets.length - 1; i++) {
      const packet = packets[i];
      const nextPacket = packets[i + 1];
      const currentTimestamp = Math.floor(packet.timestamp * 1000000);
      const nextTimestamp = Math.floor(nextPacket.timestamp * 1000000);
      const chunk = new EncodedAudioChunk({
        type: packet.isKeyframe ? 'key' : 'delta',
        timestamp: currentTimestamp,
        duration: nextTimestamp - currentTimestamp,
        data: packet.data,
      });

      this.audioDecoder.decode(chunk);
    }

    // Remove all but the last packet
    packets.splice(0, packets.length - 1);

    this.waitEncodeAudioPromise = new Promise((resolve) => {
      this.resolveWaitEncodeAudioPromise = resolve;
    });

    await this.waitEncodeAudioPromise;

    if (
      this.audioEncoder.state !== 'configured' ||
        this.audioDecoder.state !== 'configured' ||
        !this.resamplerWorker
    ) {
      throw new Error('Audio encoder/decoder/resampler has been closed!');
    }
  }

  async setup(videoDuration, videoInitSegment, audioDuration, audioInitSegment) {
    if (!videoDuration && !audioDuration) {
      throw new Error('no video or audio');
    }

    let videoOutput;
    let audioOutput;
    if (videoDuration) {
      this.videoDuration = videoDuration;
      const demuxer = this.videoDemuxer = new JsWebm();
      demuxer.queueData(videoInitSegment);

      let count = 0;
      while (demuxer.demux()) {
        count++;
        if (count > 10000) {
          throw new Error('too many iterations');
        }
      }
      demuxer.validateMetadata();

      const videoTrack = demuxer.videoTrack;
      const decoderConfig = {
        codec: demuxer.videoCodec,
        codedWidth: videoTrack.width,
        codedHeight: videoTrack.height,
        displayAspectWidth: videoTrack.displayWidth,
        displayAspectHeight: videoTrack.displayHeight,
      };

      videoOutput = {
        codec: 'avc',
        width: videoTrack.width,
        height: videoTrack.height,
      };

      const encoderConfig = {
        codec: 'avc1.42001f',
        width: videoTrack.width,
        height: videoTrack.height,
        bitrate: 1e6,
      };

      const support = await VideoDecoder.isConfigSupported(decoderConfig);
      if (!support) {
        throw new Error('unsupported input video codec');
      }

      const support2 = await VideoEncoder.isConfigSupported(encoderConfig);
      if (!support2) {
        throw new Error('unsupported output video codec');
      }


      const requeue = (e) => {
        if (this.videoDecoder && this.videoDecoder.decodeQueueSize < 10 && this.videoEncoder.encodeQueueSize < 10 && this.resolveWaitEncodeVideoPromise) {
          this.resolveWaitEncodeVideoPromise();
          this.resolveWaitEncodeVideoPromise = null;
        }
      };

      this.videoEncoder = new VideoEncoder({
        output: (chunk, meta) => {
          this.muxer.addVideoChunk(chunk, meta);
          requeue();
        },
        error: (e) => {
          console.error(e);
          this.videoEncoder.close();
        },
      });
      this.videoEncoder.configure(encoderConfig);


      this.videoDecoder = new VideoDecoder({
        output: (frame) => {
          this.videoEncoder.encode(frame);
          frame.close();
          requeue();
        },
        error: (e) => {
          console.error(e);
          this.videoDecoder.close();
        },
      });


      // this.videoDecoder.addEventListener('dequeue', requeue);
      // this.videoEncoder.addEventListener('dequeue', requeue);

      this.videoDecoder.configure(decoderConfig);
    }

    if (audioDuration) {
      this.audioDuration = audioDuration;
      this.audioDemuxer = new JsWebm();
      this.audioDemuxer.queueData(audioInitSegment);

      let count = 0;
      while (this.audioDemuxer.demux()) {
        count++;
        if (count > 10000) {
          throw new Error('too many iterations');
        }
      }

      this.audioDemuxer.validateMetadata();

      const audioTrack = this.audioDemuxer.audioTrack;

      const decoderConfig = {
        codec: this.audioDemuxer.audioCodec,
        description: audioTrack.codecPrivate,
        sampleRate: audioTrack.rate,
        numberOfChannels: audioTrack.channels,
      };

      audioOutput = {
        codec: 'aac',
        sampleRate: audioTrack.rate,
        numberOfChannels: audioTrack.channels,
      };

      const encoderConfig = {
        codec: 'mp4a.40.2',
        sampleRate: 44100,
        numberOfChannels: audioTrack.channels,
        bitrate: 128000,
      };

      console.log(decoderConfig, encoderConfig);
      const support = await AudioDecoder.isConfigSupported(decoderConfig);
      if (!support) {
        throw new Error('unsupported input audio codec');
      }

      const support2 = await AudioEncoder.isConfigSupported(encoderConfig);
      if (!support2) {
        throw new Error('unsupported output video codec');
      }

      const requeue = (e) => {
        if (!this.audioDecoder) {
          return;
        }
        if (this.audioDecoder.decodeQueueSize >= 5) {
          return;
        }

        if (this.audioEncoder.encodeQueueSize >= 5) {
          return;
        }

        if (this.resamplerWorkerTasks >= 500) {
          return;
        }

        if (this.resolveWaitEncodeAudioPromise) {
          this.resolveWaitEncodeAudioPromise();
          this.resolveWaitEncodeAudioPromise = null;
        }
      };

      this.audioEncoder = new AudioEncoder({
        output: (chunk, meta) => {
          this.muxer.addAudioChunk(chunk, meta);
          requeue();
        },
        error: (e) => {
          console.error(e);
          this.audioEncoder.close();
        },
      });
      this.audioEncoder.configure(encoderConfig);

      const currentScript = import.meta;
      let basePath = '';
      if (currentScript) {
        basePath = currentScript.url
            .replace(/#.*$/, '')
            .replace(/\?.*$/, '')
            .replace(/\/[^\/]+$/, '/');
      }
      this.resamplerWorker = new Worker(basePath + 'resampler-worker.mjs', {
        type: 'module',
      });


      this.resamplerWorkerTasks = 0;
      this.resamplerWorker.postMessage({
        type: 'init',
        oldSampleRate: audioTrack.rate,
        newSampleRate: encoderConfig.sampleRate,
        numChannels: audioTrack.channels,
      });

      this.resamplerWorker.addEventListener('message', (event) => {
        const data = event.data;
        if (data.type === 'resampled') {
          this.resamplerWorkerTasks--;
          this.audioEncoder.encode(data.data);

          requeue();

          if (this.resamplerWorkerTasks === 0 && this.resamplerWorkerPromiseResolve) {
            this.resamplerWorkerPromiseResolve();
            this.resamplerWorkerPromiseResolve = null;
          }
        }
      });

      this.resamplerWorker.addEventListener('error', (e) => {
        console.error(e);
        this.resamplerWorker.terminate();
        this.resamplerWorker = null;
      });

      this.audioDecoder = new AudioDecoder({
        output: (data) => {
          this.resamplerWorkerTasks++;
          this.resamplerWorker.postMessage({
            type: 'pushSample',
            data: data,
          }, [data]);

          requeue();
        },
        error: (e) => {
          console.error(e);
          this.audioDecoder.close();
        },
      });

      // this.audioDecoder.addEventListener('dequeue', requeue);
      // this.audioEncoder.addEventListener('dequeue', requeue);

      this.audioDecoder.configure(decoderConfig);
    }
    this.chunks = [];
    // 16mb
    const chunkSize = 16 * 1024 * 1024;

    this.muxer = new Muxer({
      fastStart: 'fragmented',
      firstTimestampBehavior: 'cross-track-offset',
      video: videoOutput,
      audio: audioOutput,

      // target: new ArrayBufferTarget(),
      //   fastStart: 'in-memory',
      target: new StreamTarget({
        onData: (data, position) => { // Store in memory until full, then write to disk
          const startPos = position;
          const endPos = position + data.byteLength;
          const startChunk = Math.floor(startPos / chunkSize);
          const endChunk = Math.floor((endPos - 1) / chunkSize);

          for (let i = startChunk; i <= endChunk; i++) {
            let chunk = this.chunks[i];
            if (!chunk) {
              chunk = {
                filledRanges: [],
                data: new Uint8Array(chunkSize),
                flushed: false,
              };
              this.chunks[i] = chunk;
            }

            if (chunk.flushed) {
              throw new Error('chunk already flushed');
            }

            const start = Math.max(startPos, i * chunkSize);
            const end = Math.min(endPos, (i + 1) * chunkSize);
            const offset = start - i * chunkSize;
            const length = end - start;

            chunk.data.set(data.subarray(start - startPos, end - startPos), offset);
            chunk.filledRanges.push([offset, offset + length]);

            // Merge filled ranges
            const newFilledRanges = [];
            const ranges = chunk.filledRanges;
            let last;
            ranges.sort(function(a, b) {
              return a[0]-b[0] || a[1]-b[1];
            });
            ranges.forEach(function(r) {
              if (!last || r[0] > last[1]) {
                newFilledRanges.push(last = r);
              } else if (r[1] > last[1]) {
                last[1] = r[1];
              }
            });
            chunk.filledRanges = newFilledRanges;

            // Check if chunk is full
            if (chunk.filledRanges.length === 1 && chunk.filledRanges[0][0] === 0 && chunk.filledRanges[0][1] === chunkSize) {
              chunk.data = this.blobManager.createBlob(chunk.data);
              chunk.flushed = true;
            }
          }
        },
      }),
    });
  }

  async finalize() {
    if (this.audioDecoder) {
      // Process last packet
      const demuxer = this.audioDemuxer;
      const packet = demuxer.audioPackets[0];
      const currentTimestamp = Math.floor(packet.timestamp * 1000000);
      const nextTimestamp = Math.floor(this.audioDuration * 1000000);

      const chunk = new EncodedAudioChunk({
        type: packet.isKeyframe ? 'key' : 'delta',
        timestamp: currentTimestamp,
        duration: nextTimestamp - currentTimestamp,
        data: packet.data,
      });
      this.audioDecoder.decode(chunk);

      await this.audioDecoder.flush();

      this.resamplerWorker.postMessage({
        type: 'finish',
      });

      const resamplerWorkerPromise = new Promise((resolve) => {
        this.resamplerWorkerPromiseResolve = resolve;
      });

      await resamplerWorkerPromise;

      await this.audioEncoder.flush();
    }


    if (this.videoDecoder) {
      // Process last packet
      const demuxer = this.videoDemuxer;
      const packet = demuxer.videoPackets[0];
      const currentTimestamp = Math.floor(packet.timestamp * 1000000);
      const nextTimestamp = Math.floor(this.videoDuration * 1000000);

      const chunk = new EncodedVideoChunk({
        type: packet.isKeyframe ? 'key' : 'delta',
        timestamp: currentTimestamp,
        duration: nextTimestamp - currentTimestamp,
        data: packet.data,
      });
      this.videoDecoder.decode(chunk);

      await this.videoDecoder.flush();
      await this.videoEncoder.flush();
    }

    this.muxer.finalize();

    // Check empty chunks
    for (let i = 0; i < this.chunks.length; i++) {
      if (!this.chunks[i]) {
        throw new Error('empty chunk');
      }
    }

    const dataChunks = await Promise.all(this.chunks.map((chunk, i) => {
      if (chunk.flushed) {
        return this.blobManager.getBlob(chunk.data);
      } else if (i === this.chunks.length - 1) {
        // Last chunk
        // Find size
        const end = chunk.filledRanges[chunk.filledRanges.length - 1][1];
        return chunk.data.slice(0, end);
      } else {
        throw new Error('chunk not flushed');
      }
    }));

    return new Blob(dataChunks, {
      type: 'video/mp4',
    });
  }

  async convert(videoDuration, videoInitSegment, audioDuration, audioInitSegment, zippedFragments) {
    await this.setup(videoDuration, videoInitSegment, audioDuration, audioInitSegment);

    let lastProgress = 0;
    for (let i = 0; i < zippedFragments.length; i++) {
      if (zippedFragments[i].track === 0) {
        await this.pushVideoFragment(zippedFragments[i]);
      } else {
        await this.pushAudioFragment(zippedFragments[i]);
      }
      const newProgress = Math.floor((i + 1) / zippedFragments.length * 100);
      if (newProgress !== lastProgress) {
        lastProgress = newProgress;
        this.emit('progress', newProgress / 100);
      }
    }

    const blob = await this.finalize();
    this.destroy();

    return blob;
  }

  destroy() {
    if (this.videoDecoder) {
      this.videoDecoder.close();
      this.videoDecoder = null;
    }

    if (this.audioDecoder) {
      this.audioDecoder.close();
      this.audioDecoder = null;
    }

    if (this.videoEncoder) {
      this.videoEncoder.close();
      this.videoEncoder = null;
    }

    if (this.audioEncoder) {
      this.audioEncoder.close();
      this.audioEncoder = null;
    }

    if (this.resamplerWorker) {
      this.resamplerWorker.terminate();
      this.resamplerWorker = null;
    }

    this.videoDemuxer = null;
    this.audioDemuxer = null;

    this.muxer = null;
    this.chunks = null;

    setTimeout(() => {
      this.blobManager.close();
      this.blobManager = null;
    }, 120000);
  }
}
