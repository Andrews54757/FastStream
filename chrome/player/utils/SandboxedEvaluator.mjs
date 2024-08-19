import {EventEmitter} from '../modules/eventemitter.mjs';
import {EnvUtils} from './EnvUtils.mjs';

// Firefox doesn't support manifest.sandbox, so we need to use a dedicated static page for the runner
const RunnerFrameLocation = (EnvUtils.isChrome() && EnvUtils.isExtension()) ? import.meta.resolve('../../sandbox/runner.html') : 'https://faststream.online/sandbox/runner.html';

export class SandboxedEvaluator extends EventEmitter {
  constructor() {
    super();
    this.runnerFrame = document.createElement('iframe');
    this.runnerFrame.src = RunnerFrameLocation;
    this.runnerFrame.style.display = 'none';
    this.runnerFrame.sandbox = 'allow-scripts';
    document.body.appendChild(this.runnerFrame);

    this.listenerBind = this.listener.bind(this);
    window.addEventListener('message', this.listenerBind);

    this.ready = false;
    this.readyPromise = new Promise((resolve) => {
      this.runnerFrame.addEventListener('load', () => {
        this.ready = true;
        resolve();
        this.emit('ready');
      });
    });

    this.timeout = null;
  }

  async load() {
    return this.readyPromise;
  }

  setTimeout(timeoutDuration) {
    clearTimeout(this.timeout);
    if (!timeoutDuration) {
      return;
    }
    this.timeout = setTimeout(() => {
      this.close();
    }, timeoutDuration);
  }

  listener(event) {
    // Check if the message is from the runner frame
    if (event.source !== this.runnerFrame.contentWindow) {
      return;
    }

    if (event.data.type === 'sandboxResult') {
      this.emit('result', event.data.result);
    } else if (event.data.type === 'sandboxError') {
      this.emit('error', event.data.error);
    }
  }

  close() {
    if (!this.runnerFrame) {
      return;
    }
    this.runnerFrame.remove();
    window.removeEventListener('message', this.listenerBind);
    this.runnerFrame = null;
    clearTimeout(this.timeout);
    this.emit('close');
  }

  async evaluate(fnCode, args) {
    await this.readyPromise;

    this.runnerFrame.contentWindow.postMessage({type: 'sandboxEvaluate', fnCode, args}, '*');

    return new Promise((resolve, reject) => {
      let resultHandler = null;
      let errorHandler = null;
      let closeHandler = null;

      const cleanup = () => {
        this.off('result', resultHandler);
        this.off('error', errorHandler);
        this.off('close', closeHandler);
      };

      resultHandler = (result) => {
        cleanup();
        resolve(result);
      };

      errorHandler = (error) => {
        cleanup();
        reject(error);
      };

      closeHandler = () => {
        cleanup();
        reject(new Error('SandboxedEvaluator closed'));
      };

      this.on('result', resultHandler);
      this.on('error', errorHandler);
      this.on('close', closeHandler);
    });
  }

  static async evaluateOnce(fnCode, args, timeoutDuration = 5000) {
    const evaluator = new SandboxedEvaluator();
    if (timeoutDuration) evaluator.setTimeout(timeoutDuration);

    try {
      const result = await evaluator.evaluate(fnCode, args);
      evaluator.close();
      return result;
    } catch (err) {
      evaluator.close();
      throw err;
    }
  }
}
