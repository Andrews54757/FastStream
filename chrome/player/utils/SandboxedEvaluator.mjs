import {EnvUtils} from './EnvUtils.mjs';

// Firefox doesn't support manifest.sandbox, so we need to use a dedicated static page for the runner
const RunnerFrameLocation = (EnvUtils.isChrome() && EnvUtils.isExtension()) ? import.meta.resolve('../../sandbox/runner.html') : 'https://faststream.online/sandbox/runner.html';

export class SandboxedEvaluator {
  static evaluate(fnCode, args, timeoutDuration = 5000) {
    return new Promise((resolve, reject) => {
      const runnerFrame = document.createElement('iframe');
      runnerFrame.src = RunnerFrameLocation;
      runnerFrame.style.display = 'none';
      runnerFrame.sandbox = 'allow-scripts';
      document.body.appendChild(runnerFrame);

      let listener = null;
      let timeout = null;

      const close = (error, result) => {
        runnerFrame.remove();
        window.removeEventListener('message', listener);
        clearTimeout(timeout);

        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      };

      // Add listener to receive the result from the runner frame
      listener = (event) => {
        // Check if the message is from the runner frame
        if (event.source !== runnerFrame.contentWindow) {
          return;
        }

        if (event.data.type === 'sandboxResult') {
          close(null, event.data.result);
        } else if (event.data.type === 'sandboxError') {
          close(event.data.error);
        }
      };

      timeout = setTimeout(() => {
        close(new Error('Runner frame timed out'));
      }, timeoutDuration);

      window.addEventListener('message', listener);

      runnerFrame.addEventListener('load', () => {
        runnerFrame.contentWindow.postMessage({type: 'sandboxEvaluate', fnCode, args}, '*');
      });
    });
  }
}
