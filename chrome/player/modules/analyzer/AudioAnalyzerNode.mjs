/* eslint-disable new-cap */
import {EventEmitter} from '../eventemitter.mjs';
import {VadJS} from '../vad/vad.mjs';

export class AudioAnalyzerNode extends EventEmitter {
  constructor() {
    super();
    this.vadOptions = {
      onFrameProcessed: this.onVadFrameProcessed.bind(this),
      positiveSpeechThreshold: 1,
      negativeSpeechThreshold: 1,
      frameSamples: 1024,
    };

    this.loopHandle = this.volumeLoop.bind(this);
    this.volumeLoopRunning = false;
    this.volumeLoopShouldRun = false;
  }

  onVadFrameProcessed(probs) {
    const isSpeechProb = Math.round(probs.isSpeech * 255);
    const audioElement = this.audioElement;
    if (!audioElement || audioElement.readyState < 4 || audioElement.paused) return;
    const time = audioElement.currentTime;
    this.emit('vad', time, isSpeechProb);
  }

  recordVolume() {
    const audioElement = this.audioElement;
    if (!this.volumeAnalyserNode || !audioElement || audioElement.readyState < 4 || audioElement.paused) return;
    const time = audioElement.currentTime;
    this.emit('volume', time, this.getVolume());
  }

  getVolume() {
    const analyser = this.volumeAnalyserNode;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    let volume = 0;
    for (let i = 0; i < bufferLength; i++) {
      volume += dataArray[i];
    }

    return Math.min(Math.round(volume / bufferLength * 2), 255);
  }

  startRecordingVolume() {
    if (this.volumeLoopShouldRun) return;
    this.volumeLoopShouldRun = true;
    const analyser = this.audioContext.createAnalyser();
    this.volumeAnalyserNode = analyser;
    analyser.fftSize = 32;
    analyser.maxDecibels = -20;
    analyser.smoothingTimeConstant = 0.5;
    this.audioSource.connect(analyser);

    if (this.volumeLoopRunning) return;
    this.volumeLoopRunning = true;
    this.volumeLoop();
  }

  stopRecordingVolume() {
    if (!this.volumeLoopShouldRun) return;
    this.volumeLoopShouldRun = false;
    this.audioSource.disconnect(this.volumeAnalyserNode);
    this.volumeAnalyserNode = null;
  }

  async startRecordingVad() {
    if (this.vadShouldRun) return;
    this.vadShouldRun = true;

    if (this.vadNode) return;
    this.vadNode = await VadJS.AudioNodeVAD.new(this.audioContext, this.vadOptions);
    if (this.vadShouldRun) {
      this.audioSource.connect(this.vadNode.getNode());
      this.vadNode.start();
    } else {
      this.vadNode.destroy();
      this.vadNode = null;
    }
  }

  stopRecordingVad() {
    if (!this.vadShouldRun) return;
    this.vadShouldRun = false;

    if (this.vadNode) {
      this.audioSource.disconnect(this.vadNode.getNode());
      this.vadNode.destroy();
      this.vadNode = null;
    }
  }

  volumeLoop() {
    this.recordVolume();

    if (!this.volumeLoopShouldRun) {
      this.volumeLoopRunning = false;
      return;
    }

    setTimeout(this.loopHandle, Math.floor(1000 / 12 / this.audioElement.playbackRate));
  }

  destroy() {
    this.stopRecordingVolume();
    this.stopRecordingVad();

    if (this.audioSource) {
      this.audioSource = null;
    }
  }

  attach(audioElement, audioSource, audioContext) {
    this.audioElement = audioElement;
    this.audioContext = audioContext;
    this.audioSource = audioSource;
  }

  configure({vad, volume}) {
    if (volume) {
      this.startRecordingVolume();
    } else {
      this.stopRecordingVolume();
    }

    if (vad) {
      this.startRecordingVad();
    } else {
      this.stopRecordingVad();
    }
  }
}
