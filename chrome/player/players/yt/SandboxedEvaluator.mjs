export class SandboxedEvaluator {
  constructor(runnerFrameLocation) {
    this.runnerFrameLocation = runnerFrameLocation;
    this.runnerFrame = null;
    this.timeout = null;
  }

  close() {
    if (this.runnerFrame) {
      this.runnerFrame.remove();
      this.runnerFrame = null;
    }

    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.resultReject) {
      this.resultReject(new Error('SandboxedEvaluator closed'));
      this.resultResolve = null;
      this.resultReject = null;
    }
  }

  async load() {
    if (this.runnerFrame) {
      this.close();
    }
    this.runnerFrame = document.createElement('iframe');
    this.runnerFrame.credentialless = true;
    this.runnerFrame.src = this.runnerFrameLocation;
    this.runnerFrame.style.display = 'none';
    document.body.appendChild(this.runnerFrame);
    window.addEventListener('message', this.listener.bind(this));

    return new Promise((resolve) => {
      this.runnerFrame.addEventListener('load', () => {
        resolve();
      });
    });
  }

  listener(event) {
    if (event.source !== this.runnerFrame?.contentWindow) {
      return;
    }

    if (event.data.type === 'sandboxResult') {
      if (this.resultResolve) {
        this.resultResolve(event.data.result);
        this.resultResolve = null;
        this.resultReject = null;
      }
    } else if (event.data.type === 'sandboxError') {
      if (this.resultReject) {
        this.resultReject(event.data.error);
        this.resultResolve = null;
        this.resultReject = null;
      }
    }
  }

  async evaluate(body, argNames = [], argValues = []) {
    if (!this.runnerFrame) {
      throw new Error('SandboxedEvaluator is not loaded');
    }

    this.runnerFrame.contentWindow?.postMessage({type: 'sandboxEvaluate', body, argNames, argValues}, '*');

    return new Promise((resolve, reject) => {
      this.resultResolve = resolve;
      this.resultReject = reject;
    });
  }

  setTimeout(timeoutDuration) {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    if (!timeoutDuration) {
      return;
    }
    this.timeout = window.setTimeout(() => {
      this.close();
    }, timeoutDuration);
  }
}
