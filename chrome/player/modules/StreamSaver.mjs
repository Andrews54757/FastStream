import {EnvUtils} from '../utils/EnvUtils.mjs';
import {FSBlob} from './FSBlob.mjs';

/* ! streamsaver. MIT License. Jimmy Wärting <https://jimmy.warting.se/opensource> */
export const streamSaver = {
  createWriteStream,
};

const useBlobFallback = !EnvUtils.isExtension() || navigator.serviceWorker === undefined;

function getServiceWorker() {
  return navigator.serviceWorker.getRegistration('./').then((swReg) => {
    const swRegTmp = swReg.installing || swReg.waiting;

    return swReg.active || new Promise((resolve) => {
      swRegTmp.addEventListener('statechange', fn = () => {
        if (swRegTmp.state === 'activated') {
          swRegTmp.removeEventListener('statechange', fn);
          sw = swReg.active;
          resolve();
        }
      });
    });
  });
};

function makeIframe(src) {
  if (!src) throw new Error('meh');
  const iframe = document.createElement('iframe');
  iframe.hidden = true;
  iframe.src = src;
  iframe.loaded = false;
  iframe.name = 'iframe';
  iframe.isIframe = true;
  iframe.postMessage = (...args) => iframe.contentWindow.postMessage(...args);
  iframe.addEventListener('load', () => {
    iframe.loaded = true;
  }, {once: true});
  document.body.appendChild(iframe);
  return iframe;
}

function createWriteStreamBlob(filename, opts, size) {
  const blobManager = new FSBlob();
  const blobs = [];
  return new WritableStream({
    write(chunk) {
      blobs.push(blobManager.createBlob(chunk));
    },
    async close() {
      const chunks = await Promise.all(blobs.map((blob) => blobManager.getBlob(blob)));
      const blob = new Blob(chunks, {type: 'application/octet-stream'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setTimeout(() => {
        blobManager.close();
      }, 120000);
    },
    abort() {
      chunks = [];
    },
  }, opts.writableStrategy);
}

/**
     * @param  {string} filename filename that should be used
     * @param  {object} options  [description]
     * @param  {number} size     deprecated
     * @return {WritableStream<Uint8Array>}
     */
function createWriteStream(filename, options, size) {
  const opts = options || {};
  if (useBlobFallback) {
    return createWriteStreamBlob(filename, opts, size);
  }

  let channel = null;
  let ts = null;

  channel = new MessageChannel();

  // Make filename RFC5987 compatible
  filename = encodeURIComponent(filename.replace(/\//g, ':'))
      .replace(/['()]/g, escape)
      .replace(/\*/g, '%2A');

  const response = {
    filename: filename,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename*=UTF-8\'\'' + filename,
    },
  };

  if (opts.size) {
    response.headers['Content-Length'] = opts.size;
  }

  const args = [response, [channel.port2]];

  const transformer = undefined;
  ts = new TransformStream(
      transformer,
      opts.writableStrategy,
      opts.readableStrategy,
  );
  const readableStream = ts.readable;

  channel.port1.postMessage({readableStream}, [readableStream]);


  channel.port1.onmessage = (evt) => {
    // Service worker sent us a link that we should open.
    if (evt.data.download) {
      makeIframe(evt.data.download);
    } else if (evt.data.abort) {
      channel.port1.postMessage('abort'); // send back so controller is aborted
      channel.port1.onmessage = null;
      channel.port1.close();
      channel.port2.close();
      channel = null;
    } else if (evt.data.close) {
      channel.port1.onmessage = null;
      channel.port1.close();
      channel.port2.close();
      channel = null;
    }
  };

  getServiceWorker().then((sw)=>{
    sw.postMessage(...args);
  });
  return ts.writable;
}
