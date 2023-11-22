# FastStream 2

Tired of having to wait while videos buffer? This extension will replace videos on websites with a custom player that is designed to play with minimal buffering.

1. Take advantage of automatic fragmentation and parallel requests for up to 6x faster download speeds.
2. As you watch, pre-download the video to instantly save the video (and subtitles) as an mp4 file at the push of a button.

The player currently supports:
- MP4 videos
- HLS streams
- DASH streams
- Youtube (download not supported on Chrome unless manually installed)

Player features:
- OpenSubtitles support so you can search for subtitles directly from the player.
- Subtitle offset controls to correct bad subtitle timings within the player
- Precise video previews when hovering over the timeline.
- Helpful (remappable) keybinds such as: Right Alt to hide player, Z to undo seek, <> to skip 2 seconds.
- Adjustable video brightness, contrast, saturation, hue, and more
- Adjustable volume, up to 300% volume boost
- Configurable audio dynamics: Has audio mixer, equalizer, and compressor tool built in

Should you like binging shows, the player also comes equipped with a custom video analysis system that runs in the background to identify intro/outro sequences based on repetitive scenes. Once they have been identified, you can skip them easily by pressing S.

To use the player, simply:
1. Go to any website you want with a video and toggle the extension on. Any video it detects will be automatically replaced with the new player.
2. Alternatively, you can also simply click on or navigate to a stream manifest file (m3u8/mpd) to begin playing.
3. Drag and drop files to the player to begin playing. Navigate to a new tab and press the extension icon to go to the player.

Notes:
- This player will not function with DRM protected content. This is intended.
- This player is still a work-in-progress. Please report any bugs to the Github issue tracker here: https://github.com/Andrews54757/FastStream/issues
- This extension does not collect telemetry of any kind. Nor does it require additional resources from the internet to function. It will work fully offline. Feel free to browse the codebase on Github.

## Installation For Chrome and Firefox

You can find the extension on the [Chrome extension store](https://chrome.google.com/webstore/detail/faststream/kkeakohpadmbldjaiggikmnldlfkdfog)

It is also available for [Firefox](https://addons.mozilla.org/en-US/firefox/addon/faststream/)

## Demo

See the player in action without installing the extension! Tested in Chrome, Firefox, and Safari. Note: Some features (OpenSubtitles/header override) are not available without installation. Settings doesn't update live. Additionally, audio configuration doesn't work in Safari.

[Web Version + Big Buck Bunny](https://andrews54757.github.io/FastStream/built/web/player/player.html#https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8)

## Manual Installation For Chrome

The Chrome extension store policies do not allow extensions that can download videos from Youtube (anti-trust anybody?). As a result, FastStream cannot save Youtube videos if installed from the official store. To get restricted features, please do the following steps:

1. Go to `chrome://extensions`
2. Turn on developer mode
3. Drag and drop the `chrome` directory of this repository

### THERE IS NO BUILT-IN AUTOMATIC UPDATE SYSTEM. If you go this route, please make sure to check back often for updates because I will often fix bugs as I encounter them.

## Manual Installation For Firefox

The extension is, by default, configured to work on Chrome. In order to create a firefox extension bundle, you need to build FastStream by following these steps:

1. Install NodeJS and NPM
2. Run `npm install --only=dev` to install dev dependencies
3. Run `npm run build`
4. Firefox bundle is available in the `built` directory

You can then install the extension temporarily on Firefox Developer Edition by going to `about:debugging`. Unfortunately, you will have to re-install after each restart because firefox doesn't allow you to permenantly install unsigned extensions.

## Contributors

Many thanks to the contributors of this project.

- Dael (dael_io): Fixed Spanish translations
- reindex-ot: Japanese translations


## Technical Details

### FastStream Archive Files (.fsa)

In some select cases, it is not feasible to convert the contents of a buffer into an MP4 on the browser (not without ffmpeg). Moreover, the buffer's required metadata varies depending on the media type. For this reason, we propose a new file format to store arbitrary information with ultrafast writing/parsing speeds for the browser environment.

#### Structure
Using example stream `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`. Numerical values use Big Endian representation.

- `00 00 01 00`:  4 byte header size (256)
- `FSA Header`: JSON header encoded as utf8 (see below)
```json
{
    "version": 1,
    "number_of_entries": 66,
    "source": {
        "url": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
        "identifier": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
        "mode": "accelerated_hls",
        "headers": {}
    },
    "currentLevel": "0:4",
    "currentAudioLevel": "1:-1"
}
```

This header is followed by the entries. Each entry has the following format:

- `00 00 01 C8`: 4 byte entry header size (456)
- JSON entry header encoded as utf8 (See below). Only whitelisted response headers are included (eg: content-range).
```json
{
    "url": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    "responseType": "text",
    "stats": {
        "aborted": false,
        "timedout": false,
        "loaded": 752,
        "total": 752,
        "retry": 0,
        "chunkCount": 0,
        "bwEstimate": 0,
        "loading": {
            "start": 112.39999997615814,
            "first": 115.79999995231628,
            "end": 116
        },
        "parsing": {
            "start": 1083.2000000476837,
            "end": 0
        },
        "buffering": {
            "start": 0,
            "first": 0,
            "end": 0
        }
    },
    "responseURL": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    "responseHeaders": {},
    "dataSize": 752
}
```
- `Entry data`: `dataSize` bytes containing the data (example below)
```m3u8
#EXTM3U
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=2149280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=1280x720,NAME="720"
url_0/193039199_mp4_h264_aac_hd_7.m3u8
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=246440,CODECS="mp4a.40.5,avc1.42000d",RESOLUTION=320x184,NAME="240"
url_2/193039199_mp4_h264_aac_ld_7.m3u8
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=460560,CODECS="mp4a.40.5,avc1.420016",RESOLUTION=512x288,NAME="380"
url_4/193039199_mp4_h264_aac_7.m3u8
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=848x480,NAME="480"
url_6/193039199_mp4_h264_aac_hq_7.m3u8
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=6221600,CODECS="mp4a.40.2,avc1.640028",RESOLUTION=1920x1080,NAME="1080"
url_8/193039199_mp4_h264_aac_fhd_7.m3u8
```
  
## Disclaimer

(I'm not a lawyer, don't take this as legal advice but do pay attention)

While it may be possible for FastStream to save videos from any website as long as there is no DRM, that doesn't mean you have the legal right to do so if you don't own the content. Please be mindful of how you use this tool. FastStream should not be used to infringe copyright.
