import {DefaultPlayerEvents} from '../enums/DefaultPlayerEvents.mjs';

export class Utils {
  static is_url_yt(urlStr) {
    const url = new URL(urlStr);
    const hostname = url.hostname;
    if (hostname === 'www.youtube.com' || hostname === 'youtube.com' || hostname === 'm.youtube.com' || hostname === 'music.youtube.com') {
      return true;
    }
    return false;
  }

  static is_url_yt_watch(urlStr) {
    const url = new URL(urlStr);
    const pathname = url.pathname;
    return pathname.startsWith('/watch');
  }

  static get_url_extension(url) {
    return url.split(/[#?]/)[0].split('.').pop().trim();
  }

  static validateHeadersString(str) {
    const lines = str.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const split = line.split(':');
      if (line.trim() == '') continue;

      if (split.length > 1) {
        const name = split[0].trim();
        const value = split.slice(1).join(':').trim();
        if (name.length == 0 || value.length == 0) {
          return false;
        }
      } else {
        return false;
      }
    }
    return true;
  }

  static formatTime(time) {
    const hours = Math.floor(time / 3600);
    time = time - hours * 3600;
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time - minutes * 60);

    function strPadLeft(string, pad, length) {
      return (new Array(length + 1).join(pad) + string).slice(-length);
    }

    return (hours ? (hours + ':') : '') + strPadLeft(minutes, '0', 2) + ':' + strPadLeft(seconds, '0', 2);
  }


  static objToHeadersString(obj) {
    let str = '';
    for (const name in obj) {
      if (Object.hasOwn(obj, name)) {
        str += `${name}: ${obj[name]}\n`;
      }
    }
    return str;
  }

  static headersStringToObj(str) {
    const obj = {};
    const lines = str.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const split = line.split(':');
      if (split.length > 1) {
        obj[split[0].trim()] = split.slice(1).join(':').trim();
      }
    }
    return obj;
  }

  static create(type, style, cl) {
    const el = document.createElement(type || 'div');
    if (style) el.style = style;
    if (cl) el.className = cl;
    return el;
  }

  static setupTabIndex(element) {
    element.tabIndex = 0;
    element.addEventListener('keydown', (e) => {
      if (e.key == 'Enter') {
        element.click();
        e.stopPropagation();
      }
    });
  }

  static createPagesBar(page, totalPages, callback) {
    const create = this.create;
    const total = Math.min(totalPages, 1000);
    let start = Math.max(page - 5, 1);

    if (start + 10 > total) {
      start = Math.max(total - 10, 1);
    }

    const max = Math.min(start + 10, total);
    const list = create('div', null, 'page-bar');
    if (start > 1) {
      const el = create('div', null, 'page-marker');
      el.textContent = 1;
      el.addEventListener('click', () => {
        callback(1);
      });
      this.setupTabIndex(el);
      list.appendChild(el);

      if (start > 2) {
        const el = create('div', null, 'page-marker');
        el.textContent = '...';
        list.appendChild(el);
      }
    }
    for (let i = start; i <= max; i++) {
      ((i) => {
        const el = create('div', null, 'page-marker');
        el.textContent = i;
        if (i === page) {
          el.classList.add('selected');
          el.contentEditable = true;
          el.addEventListener('blur', () => {
            el.textContent = i;
            window.getSelection().empty();
          });
          el.addEventListener('focus', () => {
            window.getSelection().selectAllChildren(el);
          });
          el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              const page = parseInt(el.textContent);
              if (page > 0 && page <= total) {
                callback(parseInt(el.textContent));
              } else {
                el.textContent = i;
              }
            }
            e.stopPropagation();
          });
        } else {
          el.addEventListener('click', () => {
            callback(i);
          });
        }
        this.setupTabIndex(el);
        list.appendChild(el);
      })(i);
    }

    if (max < total) {
      if (max + 1 < total) {
        const el = create('div', null, 'page-marker');
        el.textContent = '...';
        list.appendChild(el);
      }

      const el = create('div', null, 'page-marker');
      el.textContent = total;
      el.addEventListener('click', () => {
        callback(total);
      });
      this.setupTabIndex(el);
      list.appendChild(el);
    }
    return list;
  }

  static setupDropdown(itemListElement, text, container, call) {
    container.addEventListener('click', (e) => {
      for (let j = 0; j < itemListElement.children.length; j++) {
        const element = itemListElement.children[j];
        if (element.dataset.val == container.dataset.val) {
          element.style.backgroundColor = '';
          const nextElement = (j < itemListElement.children.length - 1) ? itemListElement.children[j + 1] : itemListElement.children[0];
          nextElement.style.backgroundColor = 'rgb(20,20,20)';
          text.children[0].textContent = nextElement.textContent;
          container.dataset.val = nextElement.dataset.val;
          if (call) call(container.dataset.val);
          break;
        }
      }
      e.stopPropagation();
    });
    container.addEventListener('mouseleave', (e) => {
      container.blur();
    });

    container.addEventListener('keydown', (e) => {
      if (e.key == 'ArrowDown' ) {
        for (let j = 0; j < itemListElement.children.length; j++) {
          const element = itemListElement.children[j];
          if (element.dataset.val == container.dataset.val) {
            element.style.backgroundColor = '';
            const nextElement = (j < itemListElement.children.length - 1) ? itemListElement.children[j + 1] : itemListElement.children[0];
            nextElement.style.backgroundColor = 'rgb(20,20,20)';
            text.children[0].textContent = nextElement.textContent;
            container.dataset.val = nextElement.dataset.val;
            if (call) call(container.dataset.val);
            break;
          }
        }
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key == 'ArrowUp') {
        for (let j = 0; j < itemListElement.children.length; j++) {
          const element = itemListElement.children[j];
          if (element.dataset.val == container.dataset.val) {
            element.style.backgroundColor = '';
            const nextElement = (j > 0) ? itemListElement.children[j - 1] : itemListElement.children[itemListElement.children.length - 1];
            nextElement.style.backgroundColor = 'rgb(20,20,20)';
            text.children[0].textContent = nextElement.textContent;
            container.dataset.val = nextElement.dataset.val;
            if (call) call(container.dataset.val);
            break;
          }
        }
        e.preventDefault();
        e.stopPropagation();
      }
    });
    for (let i = 0; i < itemListElement.children.length; i++) {
      ((i) => {
        const el = itemListElement.children[i];

        el.addEventListener('click', (e) => {
          text.children[0].textContent = el.textContent;
          container.dataset.val = el.dataset.val;

          for (let j = 0; j < itemListElement.children.length; j++) {
            if (j == i) {
              itemListElement.children[j].style.backgroundColor = 'rgb(20,20,20)';
            } else {
              itemListElement.children[j].style.backgroundColor = '';
            }
          }
          e.stopPropagation();
          if (call) call(container.dataset.val);
        });
      })(i);
    }
  }

  static createDropdown(defaultChoice, title, items, call) {
    const create = Utils.create;
    const container = create('div', ``, 'dropdown');

    const text = create('div', ``);
    text.innerHTML = `${title}: <span style='color: rgb(200,200,200)'>${items[defaultChoice]}</span> ˅`;
    container.dataset.val = defaultChoice;
    container.tabIndex = 0;
    container.appendChild(text);
    const itemListElement = create('div', `position: absolute; top: 100%; left: 0px; right: 0px;`, 'items');
    for (const name in items) {
      if (Object.hasOwn(items, name)) {
        const div = create('div');
        div.dataset.val = name;
        div.textContent = items[name];

        if (defaultChoice == name) {
          div.style.backgroundColor = 'rgb(20,20,20)';
        }
        itemListElement.appendChild(div);
      }
    }
    container.appendChild(itemListElement);
    this.setupDropdown(itemListElement, text, container, call);
    return container;
  }

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

  /**
     * Binary search utility.
     * @param {array} array
     * @param {*} el
     * @param {function} compareFn
     * @return {*}
     */
  static binarySearch(array, el, compareFn) {
    let lower = 0;
    let upper = array.length - 1;
    while (lower <= upper) {
      const middle = (upper + lower) >> 1;
      const cmp = compareFn(el, array[middle]);
      if (cmp > 0) {
        lower = middle + 1;
      } else if (cmp < 0) {
        upper = middle - 1;
      } else {
        return middle;
      }
    }
    return -lower - 1;
  }

  /**
     * Gets the file extension from a url.
     * @param {string} urlStr
     * @return {string}
     */
  static getFileExtensionFromUrl(urlStr) {
    const url = new URL(urlStr);
    const path = url.pathname;
    const ext = path.split('.').pop();
    return ext;
  }

  static isInBuffer(buffer, time) {
    const bufferedPos = Utils.binarySearch(buffer, time, (time, middle) => {
      const start = middle[0];
      const end = middle[1];
      if (start > time) return -1;
      if (end < time) return 1;
      return 0;
    });


    if (bufferedPos >= 0) {
      const bufferedRange = buffer[bufferedPos];
      const bufferedStart = bufferedRange[0];
      const bufferedEnd = bufferedRange[1];

      if (time >= bufferedStart && time <= bufferedEnd) {
        return true;
      }
    }

    return false;
  }

  static timeoutableCallback(call, time, min) {
    let sent = false;
    const timeout = setTimeout(() => {
      if (sent) return;
      sent = true;
      call();
    }, time);
    return () => {
      if (sent) {
        clearTimeout(timeout);
        return;
      }
      sent = true;
      if (!min) {
        call();
      } else {
        setTimeout(() => {
          call();
        }, min);
      }
    };
  }

  static addPassthroughEventListenersToVideo(video, emitter) {
    video.addEventListener(DefaultPlayerEvents.ABORT, (event) => {
      emitter.emit(DefaultPlayerEvents.ABORT);
    });

    video.addEventListener(DefaultPlayerEvents.CANPLAY, (event) => {
      emitter.emit(DefaultPlayerEvents.CANPLAY);
    });

    video.addEventListener(DefaultPlayerEvents.CANPLAYTHROUGH, (event) => {
      emitter.emit(DefaultPlayerEvents.CANPLAYTHROUGH);
    });

    video.addEventListener(DefaultPlayerEvents.COMPLETE, (event) => {
      emitter.emit(DefaultPlayerEvents.COMPLETE);
    });

    video.addEventListener(DefaultPlayerEvents.DURATIONCHANGE, (event) => {
      emitter.emit(DefaultPlayerEvents.DURATIONCHANGE);
    });

    video.addEventListener(DefaultPlayerEvents.EMPTIED, (event) => {
      emitter.emit(DefaultPlayerEvents.EMPTIED);
    });


    video.addEventListener(DefaultPlayerEvents.ENDED, (event) => {
      emitter.emit(DefaultPlayerEvents.ENDED);
    });


    video.addEventListener(DefaultPlayerEvents.ERROR, (event) => {
      emitter.emit(DefaultPlayerEvents.ERROR);
    });


    video.addEventListener(DefaultPlayerEvents.LOADEDDATA, (event) => {
      emitter.emit(DefaultPlayerEvents.LOADEDDATA);
    });


    video.addEventListener(DefaultPlayerEvents.LOADEDMETADATA, (event) => {
      emitter.emit(DefaultPlayerEvents.LOADEDMETADATA);
    });


    video.addEventListener(DefaultPlayerEvents.PAUSE, (event) => {
      emitter.emit(DefaultPlayerEvents.PAUSE);
    });


    video.addEventListener(DefaultPlayerEvents.PLAY, (event) => {
      emitter.emit(DefaultPlayerEvents.PLAY);
    });


    video.addEventListener(DefaultPlayerEvents.PLAYING, (event) => {
      emitter.emit(DefaultPlayerEvents.PLAYING);
    });


    video.addEventListener(DefaultPlayerEvents.PROGRESS, (event) => {
      emitter.emit(DefaultPlayerEvents.PROGRESS);
    });


    video.addEventListener(DefaultPlayerEvents.RATECHANGE, (event) => {
      emitter.emit(DefaultPlayerEvents.RATECHANGE);
    });


    video.addEventListener(DefaultPlayerEvents.SEEKED, (event) => {
      emitter.emit(DefaultPlayerEvents.SEEKED);
    });


    video.addEventListener(DefaultPlayerEvents.SEEKING, (event) => {
      emitter.emit(DefaultPlayerEvents.SEEKING);
    });


    video.addEventListener(DefaultPlayerEvents.STALLED, (event) => {
      emitter.emit(DefaultPlayerEvents.STALLED);
    });


    video.addEventListener(DefaultPlayerEvents.SUSPEND, (event) => {
      emitter.emit(DefaultPlayerEvents.SUSPEND);
    });


    video.addEventListener(DefaultPlayerEvents.TIMEUPDATE, (event) => {
      emitter.emit(DefaultPlayerEvents.TIMEUPDATE);
    });


    video.addEventListener(DefaultPlayerEvents.VOLUMECHANGE, (event) => {
      emitter.emit(DefaultPlayerEvents.VOLUMECHANGE);
    });

    video.addEventListener(DefaultPlayerEvents.WAITING, (event) => {
      emitter.emit(DefaultPlayerEvents.WAITING);
    });
  }
  static levenshteinDistance(s, t) {
    if (s === t) {
      return 0;
    }
    const n = s.length; const m = t.length;
    if (n === 0 || m === 0) {
      return n + m;
    }
    let x = 0; let y; let a; let b; let c; let d; let g; let h;
    const p = new Uint16Array(n);
    const u = new Uint32Array(n);
    for (y = 0; y < n;) {
      u[y] = s.charCodeAt(y);
      p[y] = ++y;
    }

    for (; (x + 3) < m; x += 4) {
      const e1 = t.charCodeAt(x);
      const e2 = t.charCodeAt(x + 1);
      const e3 = t.charCodeAt(x + 2);
      const e4 = t.charCodeAt(x + 3);
      c = x;
      b = x + 1;
      d = x + 2;
      g = x + 3;
      h = x + 4;
      for (y = 0; y < n; y++) {
        a = p[y];
        if (a < c || b < c) {
          c = (a > b ? b + 1 : a + 1);
        } else {
          if (e1 !== u[y]) {
            c++;
          }
        }

        if (c < b || d < b) {
          b = (c > d ? d + 1 : c + 1);
        } else {
          if (e2 !== u[y]) {
            b++;
          }
        }

        if (b < d || g < d) {
          d = (b > g ? g + 1 : b + 1);
        } else {
          if (e3 !== u[y]) {
            d++;
          }
        }

        if (d < g || h < g) {
          g = (d > h ? h + 1 : d + 1);
        } else {
          if (e4 !== u[y]) {
            g++;
          }
        }
        p[y] = h = g;
        g = d;
        d = b;
        b = c;
        c = a;
      }
    }

    for (; x < m;) {
      const e = t.charCodeAt(x);
      c = x;
      d = ++x;
      for (y = 0; y < n; y++) {
        a = p[y];
        if (a < c || d < c) {
          d = (a > d ? d + 1 : a + 1);
        } else {
          if (e !== u[y]) {
            d = c + 1;
          } else {
            d = c;
          }
        }
        p[y] = d;
        c = a;
      }
      h = d;
    }

    return h;
  }
}
