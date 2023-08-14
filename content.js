
var Request = function ( /**/) {
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

var iframeMap = new Map();
window.addEventListener("message", (e) => {
    if (typeof e.data !== "object") {
        return;
    }
    var dt = e.data;
    var src = e.source;

    switch (dt.type) {
        case "frame":
            console.log("Frame info", dt)
            var iframes = getAllElementsByTagNameIncludingShadows("iframe")
            for (var i = 0; i < iframes.length; i++) {
                if (iframes[i].contentWindow == src) {

                    iframeMap.set(dt.id, iframes[i])
                    break;
                }
            }
            break;
    }

    // console.log(e, frameId)
})

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {

        if (request.type === "fullscreen") {
            var element = iframeMap.get(request.frameId);
            if (!element) {
                throw new Error("No element found for frame id " + request.frameId)
            }
            if (document.fullscreenElement === element) {
                document.exitFullscreen();
            } else {
                element.requestFullscreen();
            }
        } else if (request.type == "init") {

            if (window.parent !== window) {
                window.parent.postMessage({
                    type: "frame",
                    id: request.frameId
                }, "*")
            }

        } else if (request.type == "scrape_captions") {
            var tracks = getAllElementsByTagNameIncludingShadows("track");
            var done = 0;
            var tracks = [];
            for (var i = 0; i < tracks.length; i++) {
                var track = tracks[i];
                if (track.src && track.kind == "captions") {
                    var source = track.src;
                    Request(source, (err, req, body) => {
                        done++;
                        if (body)
                            tracks.push({
                                data: body,
                                source: source,
                                label: track.label,
                                language: track.srclang
                            });
                        if (done == tracks.length) sendResponse(tracks);
                    })
                }
            }
            if (done == tracks.length) sendResponse(tracks);

            return true;
        } else if (request.type == "player") {
            getVideo().then(video => {
                if (!video || video.highest && video.highest.tagName === "BODY") {
                    window.location = request.url;
                    console.log("redirecting to player")
                    sendResponse("redirect");
                } else {

                    // copy styles
                    var styles = window.getComputedStyle(video.highest);
                    let rect = video.highest.getBoundingClientRect();

                    let iframe = document.createElement("iframe");
                    iframe.src = request.url;
                    iframe.setAttribute("style", video.highest.getAttribute("style"));
                    iframe.classList = video.highest.classList;
                    iframe.style.width = rect.width + "px";
                    iframe.style.height = rect.height + "px";

                    iframe.style.position = styles.position;
                    // iframe.style.top = styles.top;
                    // iframe.style.left = styles.left;
                    iframe.style.zIndex = styles.zIndex;
                    iframe.style.border = styles.border;
                    iframe.style.borderRadius = styles.borderRadius;
                    iframe.style.boxShadow = styles.boxShadow;
                    // iframe.style.margin = styles.margin;
                    // iframe.style.padding = styles.padding;

                    iframe.allowFullscreen = true;
                    // replace element

                    video.highest.parentElement.replaceChild(iframe, video.highest);

                    console.log("replacing video with iframe")
                    sendResponse("replace");

                }
            });
            return true;
        } else if (request.type === "get_video_size") {
            getVideo().then(video => {
                sendResponse(video ? video.size : 0);
            });
            return true;
        }
    });


function getAllElementsByTagNameIncludingShadows(tagName, currentElement = document.body, results = []) {

    Array.from(currentElement.getElementsByTagName(tagName)).forEach(el => results.push(el));

    const allElements = currentElement.querySelectorAll('*');
    Array.from(allElements).forEach(el => {
        if (el.shadowRoot) {
            getAllElementsByTagNameIncludingShadows(tagName, el.shadowRoot, results);
        }
    });

    return results;
}


function isVisible(domElement) {
    return new Promise(resolve => {
        const o = new IntersectionObserver(([entry]) => {
            resolve(entry.intersectionRatio === 1);
            o.disconnect();
        });
        o.observe(domElement);
    });
}

function getParentElementsWithSameBounds(element) {
    let elements = [];
    while (element.parentElement) {
        let parent = element.parentElement;
        let rect = element.getBoundingClientRect();
        let parentRect = parent.getBoundingClientRect();

        if (rect.top === parentRect.top && rect.left === parentRect.left && rect.width === parentRect.width && rect.height === parentRect.height) {
            elements.push(parent);
        } else {
            break;
        }

        element = parent;

        if (element.tagName === "BODY") {
            break;
        }
    }

    return elements;
}


async function getVideo() {
    var videos = Array.from(getAllElementsByTagNameIncludingShadows("video"));

    let visibleVideos = [];
    for (let i = 0; i < videos.length; i++) {
        //   if (await isVisible(videos[i])) {
        let rect = videos[i].getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0)
            visibleVideos.push(videos[i]);
        //  }
    }

    // get largest video
    let largestVideo = null;
    let largestVideoArea = 0;
    for (let i = 0; i < visibleVideos.length; i++) {
        let video = visibleVideos[i];
        let rect = video.getBoundingClientRect();
        let area = rect.width * rect.height;
        if (area > largestVideoArea) {
            largestVideo = video;
            largestVideoArea = area;
        }
    }

    if (!largestVideo) {
        return null;
    }

    let parentElementsWithSameBounds = getParentElementsWithSameBounds(largestVideo);
    return {
        video: largestVideo,
        size: largestVideoArea,
        parents: parentElementsWithSameBounds,
        highest: parentElementsWithSameBounds.length > 0 ? parentElementsWithSameBounds[parentElementsWithSameBounds.length - 1] : largestVideo
    }
}

chrome.runtime.sendMessage({
    type: "iframe",
    url: window.location.href
});