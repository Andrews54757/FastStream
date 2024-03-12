/* eslint-disable new-cap */
import {AudioUtils} from '../../utils/AudioUtils.mjs';
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
    const time = audioElement.currentTime - audioElement.playbackRate * (this.audioContext.outputLatency - this.audioContext.baseLatency);
    this.emit('vad', time, isSpeechProb);
  }

  recordVolume() {
    const audioElement = this.audioElement;
    if (!this.volumeAnalyserNode || !audioElement || audioElement.readyState < 4 || audioElement.paused) return;
    const volume = Math.floor(AudioUtils.getVolume(this.volumeAnalyserNode) * 255);
    const time = audioElement.currentTime - audioElement.playbackRate * (this.audioContext.outputLatency - this.audioContext.baseLatency) * 0.75;
    this.emit('volume', time, volume);
  }

  startRecordingVolume() {
    if (this.volumeLoopShouldRun) return;
    this.volumeLoopShouldRun = true;
    const analyser = this.audioContext.createAnalyser();
    this.volumeAnalyserNode = analyser;
    analyser.fftSize = 32;
    analyser.maxDecibels = -20;
    analyser.minDecibels = -100;
    analyser.smoothingTimeConstant = 0.2;
    this.audioSource.connect(analyser);

    if (this.volumeLoopRunning) return;
    this.volumeLoopRunning = true;
    this.volumeLoop();
  }

  stopRecordingVolume() {
    if (!this.volumeLoopShouldRun) return;
    this.volumeLoopShouldRun = false;
    try {
      this.audioSource.disconnect(this.volumeAnalyserNode);
    } catch (e) {

    }
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
      try {
        this.audioSource.disconnect(this.vadNode.getNode());
      } catch (e) {

      }
      this.vadNode.destroy();
      this.vadNode = null;
    }
  }

  volumeLoop() {
    if (!this.volumeLoopShouldRun) {
      this.volumeLoopRunning = false;
      return;
    }

    this.volumeLoopTimeout = setTimeout(this.loopHandle, Math.floor(64 / this.audioElement.playbackRate));

    this.recordVolume();
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
