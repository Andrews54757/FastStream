/* eslint-disable new-cap */
import {IndexedDBManager} from '../../network/IndexedDBManager.mjs';
import PreModule from './libstream.js';
const currentScript = import.meta;
let basePath = '';
if (currentScript) {
  basePath = currentScript.url
      .replace(/#.*$/, '')
      .replace(/\?.*$/, '')
      .replace(/\/[^\/]+$/, '/');
}

const assetPath = (file) => {
  return basePath + file;
};

const WhisperModels = {
  'tiny-en-q5_1': 'https://faststream.online/models/whisper-tiny.en-q5_1.bin',
};

async function fetchModel(url) {
  const indexedDBSupported = await IndexedDBManager.isSupportedAndAvailable();
  let db;
  if (indexedDBSupported) {
    db = new IndexedDBManager('fs-whisper-models');
    await db.setup();

    const model = await db.getFile(url);
    if (model) {
      return model;
    }
  }

  const response = await fetch(url);
  const model = new Uint8Array(await response.arrayBuffer());

  if (indexedDBSupported) {
    await db.setFile(url, model);
  }

  return model;
}

export class AudioNodeTTS {
  constructor(ctx, options) {
    this.ctx = ctx;
    this.options = options;
    this.lastData = null;
  }


  async init() {
    console.log('Loading whisper...');
    const model = await fetchModel(WhisperModels['tiny-en-q5_1']);
    const Module = await PreModule();
    this.Module = Module;

    try {
      Module.FS_unlink('whisper.bin');
    } catch (e) {

    }
    Module.FS_createDataFile('/', 'whisper.bin', model, true, true);
    this.instance = Module.init('whisper.bin');
    Module.set_status('');

    await this.ctx.audioWorklet.addModule(assetPath('tts.worklet.mjs'));

    const ttsNode = new AudioWorkletNode(this.ctx, 'tts-helper-worklet', {
      processorOptions: {
        frameSamples: this.options.frameSamples,
      },
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    ttsNode.channelCountMode = 'explicit';
    ttsNode.channelCount = 1;

    this.entryNode = ttsNode;
    ttsNode.port.onmessage = async (ev) => {
      switch (ev.data?.message) {
        case 1:
          const buffer = ev.data.data;
          const frame = new Float32Array(buffer);
          await this.processFrame(frame);
          break;
        default:
          break;
      }
    };

    console.log('Loaded whisper!');
  }

  getNode() {
    return this.entryNode;
  }

  destroy() {
    this.entryNode.disconnect();
    this.entryNode.port.postMessage({type: 'close'});
    this.entryNode = undefined;

    try {
      this.Module.PThread.terminateAllThreads();
    } catch (e) {
      console.error(e);
    }

    this.Module = undefined;
  }

  async processFrame(frame) {
    let data = frame;
    if (this.lastData) {
      // shift by 1/4th
      const prependLen = Math.floor(this.lastData.length / 8);
      data = new Float32Array(frame.length + prependLen);
      data.set(this.lastData.subarray(prependLen), 0);
      data.set(frame, prependLen);
    }
    this.lastData = frame;
    const transcribed = this.Module.get_transcribed();
    if (transcribed) console.log(transcribed);

    this.Module.set_audio(this.instance, data);
  }
}

