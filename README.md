![logotext1](https://github.com/Andrews54757/FastStream/assets/13282284/cf344807-ff49-4db2-b806-4be5458fd767)

# FastStream

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

Please see the [wiki](https://github.com/Andrews54757/FastStream/wiki/Technical-Details) for more information on the technical details!
  
## Disclaimer

(I'm not a lawyer, don't take this as legal advice but do pay attention)

While it may be possible for FastStream to save videos from any website as long as there is no DRM, that doesn't mean you have the legal right to do so if you don't own the content. Please be mindful of how you use this tool. FastStream should not be used to infringe copyright.
