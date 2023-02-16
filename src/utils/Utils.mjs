import { DefaultPlayerEvents } from "../enums/DefaultPlayerEvents.mjs";

export class Utils {

    /**
     * Sends an AJAX request for the given options.
     * @param {object} options 
     * @returns 
     */
    static request(options) {
        return new Promise((resolve, reject) => {

            var xmlHttp = new XMLHttpRequest();
            options.xmlHttp = xmlHttp;
            if (options.responseType !== undefined) xmlHttp.responseType = options.responseType;
            var sent = false;
            xmlHttp.addEventListener('load', function () {
                if (sent) return;
                sent = true;
                resolve(xmlHttp);
            })
            xmlHttp.addEventListener("error", () => {
                if (sent) return;
                sent = true;
                resolve(xmlHttp);
            });
            xmlHttp.addEventListener("timeout", () => {
                if (sent) return;
                sent = true;
                resolve(xmlHttp);
            });
            xmlHttp.addEventListener("abort", () => {
                if (sent) return;
                sent = true;
                resolve(xmlHttp);
            });

            xmlHttp.addEventListener("progress", (e) => {
                if (options.onProgress) options.onProgress(e)
            })

            xmlHttp.open(options.type === undefined ? "GET" : options.type, options.url, true); // true for asynchronous 
            if (options.range !== undefined) {
                xmlHttp.setRequestHeader('Range', 'bytes=' + options.range.start + '-' + options.range.end)
            }

            //xmlHttp.setRequestHeader('Origin', '');

            if (options.headers) {
                for (var name in options.headers) {
                    xmlHttp.setRequestHeader(name, options.headers[name]);
                }
            }



            xmlHttp.send(options.data);

        })

    }

    static simpleRequest( /**/) {
        var url = arguments[0],
            post = undefined,
            callback,
            bust = false;

        if (arguments[2]) { // post
            post = arguments[1];
            callback = arguments[2];
            bust = arguments[3];
        } else {
            callback = arguments[1];
            bust = arguments[2];
        }
        try {
            var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP"); // IE support
            xhr.open(post ? 'POST' : 'GET', url + (bust ? ("?" + Date.now()) : ""));
            xhr.onreadystatechange = function () {
                if (xhr.readyState == 4) {
                    if (xhr.status === 200) {
                        callback(undefined, xhr, xhr.responseText);
                    } else {
                        callback(true, xhr, false);
                    }

                    var body = xhr.responseText;
                    var res = xhr
                }
            };
            if (post) {
                xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');

                var toPost = [];
                for (var i in post) {
                    toPost.push(encodeURIComponent(i) + '=' + encodeURIComponent(post[i]))
                }

                post = toPost.join("&")
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
     * @param {function} compare_fn 
     * @returns {*}
     */
    static binarySearch(array, el, compare_fn) {
        var lower = 0;
        var upper = array.length - 1;
        while (lower <= upper) {
            var middle = (upper + lower) >> 1;
            var cmp = compare_fn(el, array[middle]);
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
     * @returns {string}
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
        var sent = false;
        var timeout = setTimeout(() => {
            if (sent) return;
            sent = true;
            call()
        }, time)
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
                }, min)
            }
        }
    }

    static addPassthroughEventListenersToVideo(video, emitter) {


        video.addEventListener(DefaultPlayerEvents.ABORT, (event) => {
            emitter.emit(DefaultPlayerEvents.ABORT);
        })

        video.addEventListener(DefaultPlayerEvents.CANPLAY, (event) => {
            emitter.emit(DefaultPlayerEvents.CANPLAY);
        })

        video.addEventListener(DefaultPlayerEvents.CANPLAYTHROUGH, (event) => {
            emitter.emit(DefaultPlayerEvents.CANPLAYTHROUGH);
        })

        video.addEventListener(DefaultPlayerEvents.COMPLETE, (event) => {
            emitter.emit(DefaultPlayerEvents.COMPLETE);
        })

        video.addEventListener(DefaultPlayerEvents.DURATIONCHANGE, (event) => {
            emitter.emit(DefaultPlayerEvents.DURATIONCHANGE);
        })

        video.addEventListener(DefaultPlayerEvents.EMPTIED, (event) => {
            emitter.emit(DefaultPlayerEvents.EMPTIED);
        })


        video.addEventListener(DefaultPlayerEvents.ENDED, (event) => {
            emitter.emit(DefaultPlayerEvents.ENDED);
        })


        video.addEventListener(DefaultPlayerEvents.LOADEDDATA, (event) => {
            emitter.emit(DefaultPlayerEvents.LOADEDDATA);
        })


        video.addEventListener(DefaultPlayerEvents.LOADEDMETADATA, (event) => {
            emitter.emit(DefaultPlayerEvents.LOADEDMETADATA);

        })


        video.addEventListener(DefaultPlayerEvents.PAUSE, (event) => {
            emitter.emit(DefaultPlayerEvents.PAUSE);
        })


        video.addEventListener(DefaultPlayerEvents.PLAY, (event) => {
            emitter.emit(DefaultPlayerEvents.PLAY);
        })


        video.addEventListener(DefaultPlayerEvents.PLAYING, (event) => {
            emitter.emit(DefaultPlayerEvents.PLAYING);
        })


        video.addEventListener(DefaultPlayerEvents.PROGRESS, (event) => {
            emitter.emit(DefaultPlayerEvents.PROGRESS);
        })


        video.addEventListener(DefaultPlayerEvents.RATECHANGE, (event) => {
            emitter.emit(DefaultPlayerEvents.RATECHANGE);
        })


        video.addEventListener(DefaultPlayerEvents.SEEKED, (event) => {
            emitter.emit(DefaultPlayerEvents.SEEKED);
        })


        video.addEventListener(DefaultPlayerEvents.SEEKING, (event) => {
            emitter.emit(DefaultPlayerEvents.SEEKING);
        })


        video.addEventListener(DefaultPlayerEvents.STALLED, (event) => {
            emitter.emit(DefaultPlayerEvents.STALLED);
        })


        video.addEventListener(DefaultPlayerEvents.SUSPEND, (event) => {
            emitter.emit(DefaultPlayerEvents.SUSPEND);
        })


        video.addEventListener(DefaultPlayerEvents.TIMEUPDATE, (event) => {
            emitter.emit(DefaultPlayerEvents.TIMEUPDATE);
        })


        video.addEventListener(DefaultPlayerEvents.VOLUMECHANGE, (event) => {
            emitter.emit(DefaultPlayerEvents.VOLUMECHANGE);
        })

        video.addEventListener(DefaultPlayerEvents.WAITING, (event) => {
            emitter.emit(DefaultPlayerEvents.WAITING);
        })
    }
    static levenshteinDistance(s, t) {
        if (s === t) {
            return 0;
        }
        var n = s.length, m = t.length;
        if (n === 0 || m === 0) {
            return n + m;
        }
        var x = 0, y, a, b, c, d, g, h;
        var p = new Uint16Array(n);
        var u = new Uint32Array(n);
        for (y = 0; y < n;) {
            u[y] = s.charCodeAt(y);
            p[y] = ++y;
        }

        for (; (x + 3) < m; x += 4) {
            var e1 = t.charCodeAt(x);
            var e2 = t.charCodeAt(x + 1);
            var e3 = t.charCodeAt(x + 2);
            var e4 = t.charCodeAt(x + 3);
            c = x;
            b = x + 1;
            d = x + 2;
            g = x + 3;
            h = x + 4;
            for (y = 0; y < n; y++) {
                a = p[y];
                if (a < c || b < c) {
                    c = (a > b ? b + 1 : a + 1);
                }
                else {
                    if (e1 !== u[y]) {
                        c++;
                    }
                }

                if (c < b || d < b) {
                    b = (c > d ? d + 1 : c + 1);
                }
                else {
                    if (e2 !== u[y]) {
                        b++;
                    }
                }

                if (b < d || g < d) {
                    d = (b > g ? g + 1 : b + 1);
                }
                else {
                    if (e3 !== u[y]) {
                        d++;
                    }
                }

                if (d < g || h < g) {
                    g = (d > h ? h + 1 : d + 1);
                }
                else {
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
            var e = t.charCodeAt(x);
            c = x;
            d = ++x;
            for (y = 0; y < n; y++) {
                a = p[y];
                if (a < c || d < c) {
                    d = (a > d ? d + 1 : a + 1);
                }
                else {
                    if (e !== u[y]) {
                        d = c + 1;
                    }
                    else {
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