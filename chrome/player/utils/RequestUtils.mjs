export class RequestUtils {
  static request(options) {
    return new Promise(async (resolve, reject) => {
      const xmlHttp = new XMLHttpRequest();
      options.xmlHttp = xmlHttp;
      if (options.responseType !== undefined) xmlHttp.responseType = options.responseType;
      let sent = false;
      xmlHttp.addEventListener('load', function() {
        if (sent) return;
        sent = true;
        resolve(xmlHttp);
      });
      xmlHttp.addEventListener('error', () => {
        if (sent) return;
        sent = true;
        resolve(xmlHttp);
      });
      xmlHttp.addEventListener('timeout', () => {
        if (sent) return;
        sent = true;
        resolve(xmlHttp);
      });
      xmlHttp.addEventListener('abort', () => {
        if (sent) return;
        sent = true;
        resolve(xmlHttp);
      });

      xmlHttp.addEventListener('progress', (e) => {
        if (options.onProgress) options.onProgress(e);
      });

      let query = '';
      if (options.query) {
        query = '?' + Object.keys(options.query).filter((key) => {
          return options.query[key] !== undefined && options.query[key] !== null && options.query[key] !== '';
        }).map((key) => {
          if (options.usePlusForSpaces) {
            return encodeURIComponent(key) + '=' + encodeURIComponent(options.query[key]).replace(/%20/g, '+');
          }
          return encodeURIComponent(key) + '=' + encodeURIComponent(options.query[key]);
        }).join('&');
      }

      xmlHttp.open(options.type === undefined ? 'GET' : options.type, options.url + query, true); // true for asynchronous
      if (options.range !== undefined) {
        xmlHttp.setRequestHeader('Range', 'bytes=' + options.range.start + '-' + options.range.end);
      }

      // xmlHttp.setRequestHeader('Origin', '');
      if (options.headers) {
        for (const name in options.headers) {
          if (Object.hasOwn(options.headers, name)) {
            xmlHttp.setRequestHeader(name, options.headers[name]);
          }
        }
      }

      if (options.header_commands) {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          await chrome.runtime.sendMessage({
            type: 'header_commands',
            url: options.url,
            commands: options.header_commands,
          });
        }
      }


      xmlHttp.send(options.data);
    });
  }

  static simpleRequest(...args) {
    const url = args[0];
    let post = undefined;
    let callback;
    let bust = false;

    if (args[2]) { // post
      post = args[1];
      callback = args[2];
      bust = args[3];
    } else {
      callback = args[1];
      bust = args[2];
    }
    try {
      const xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP'); // IE support
      xhr.open(post ? 'POST' : 'GET', url + (bust ? ('?' + Date.now()) : ''));
      xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
          if (xhr.status === 200) {
            callback(undefined, xhr, xhr.responseText);
          } else {
            callback(true, xhr, false);
          }
        }
      };
      if (post) {
        xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');

        const toPost = [];
        for (const i in post) {
          if (Object.hasOwn(post, i)) {
            toPost.push(encodeURIComponent(i) + '=' + encodeURIComponent(post[i]));
          }
        }

        post = toPost.join('&');
      }

      xhr.send(post);
    } catch (e) {
      callback(e);
    }
  }
}
