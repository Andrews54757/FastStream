
export class StreamSaverBackend {
  constructor() {
    this.map = new Map();
    this.basePath;
  }

  onMessage(event) {
    const data = event.data;
    const downloadUrl = this.basePath + Date.now() + Math.floor(Math.random() * 1000000) + '/' + data.filename;
    const port = event.ports[0];
    const metadata = new Array(4); // [stream, data, port, timestamp]

    metadata[1] = data;
    metadata[2] = port;
    metadata[3] = Date.now();

    this.map.set(downloadUrl, metadata);
    port.onmessage = (evt) => {
      port.onmessage = null;
      metadata[0] = evt.data.readableStream;
      port.postMessage({download: downloadUrl});
    };
  }

  onFetch(event) {
    const url = event.request.url;
    const override = this.map.get(url);

    if (!override) return null;

    const [stream, data, port] = override;

    this.map.delete(url);

    // Not comfortable letting any user control all headers
    // so we only copy over the length & disposition
    const responseHeaders = new Headers({
      'Content-Type': 'application/octet-stream; charset=utf-8',

      // To be on the safe side, The link can be opened in a iframe.
      // but octet-stream should stop it.
      'Content-Security-Policy': 'default-src \'none\'',
      'X-Content-Security-Policy': 'default-src \'none\'',
      'X-WebKit-CSP': 'default-src \'none\'',
      'X-XSS-Protection': '1; mode=block',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    });

    const headers = new Headers(data.headers || {});

    if (headers.has('Content-Length')) {
      responseHeaders.set('Content-Length', headers.get('Content-Length'));
    }

    if (headers.has('Content-Disposition')) {
      responseHeaders.set('Content-Disposition', headers.get('Content-Disposition'));
    }

    event.respondWith(new Response(stream, {headers: responseHeaders}));
    port.postMessage({close: true});
    port.close();
  }

  setup(self) {
    this.basePath = self.registration.scope + 'temp/';

    self.addEventListener('install', () => {
      self.skipWaiting();
    });

    self.addEventListener('activate', (event) => {
      event.waitUntil(self.clients.claim());
    });

    // This should be called once per download
    // Each event has a dataChannel that the data will be piped through
    self.onmessage = this.onMessage.bind(this);
    self.onfetch = this.onFetch.bind(this);

    setInterval(this.pruneStale.bind(this), 5000);
  }

  pruneStale() {
    const now = Date.now();
    const keys = this.map.keys();

    for (const key of keys) {
      const metadata = this.map.get(key);

      if (now - metadata[3] > 20000) {
        this.map.delete(key);
        try {
          metadata[2].postMessage({close: true});
          metadata[2].close();
        } catch (e) {
          console.error(e);
        }
      }
    }
  }
}
