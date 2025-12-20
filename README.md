[![logotext1](https://github.com/user-attachments/assets/cefd20ba-606a-482c-a522-36b3419e93c7)](https://faststream.online)

# FastStream

Tired of having videos buffer with slow internet speeds? Frustrated by a website's lack of accessibility features? This extension will replace videos on websites with a video player designed for your convenience. Say goodbye to buffering and hello to a more accessible video experience!

1. Watch videos without interruptions by pre-buffering the video in the background. Automatic fragmentation and parallel requests for up to 6x faster download speeds.
2. Advanced subtitling features include: customizable subtitle appearance, built-in OpenSubtitles support to find subtitles on the internet, and an intuitive subtitle syncing tool to adjust subtitle timings on the fly.
3. Adjustable audio dynamics (equalizer, compressor, mixer, mono mode, volume booster), and video settings (brightness, contrast, hue, LMS daltonization for color blindness) for your unique audiovisual preferences.
4. 20+ remappable keybinds and accessible tool buttons for easy control of the player.
5. Available in multiple languages! Translated into Spanish, Japanese, Russian, Malay, and Italian by the FastStream community. Support for more languages is coming soon!

The player currently supports:
- MP4 videos (.mp4)
- HLS streams (.m3u8)
- DASH streams (.mpd)
- Youtube (download not supported on Chrome unless manually installed due to Web Store policy)

To use the player, simply:
1. Go to any website you want with a video and toggle the extension on. Any video it detects will be automatically replaced with the FastStream player.
2. Alternatively, you can also simply click on or navigate to a stream manifest file (m3u8/mpd) to begin playing.
3. Navigate to a new tab and press the extension icon to go to the player. Play sources detected on other tabs through the Sources Browser. You can also drag and drop video files from your computer. 

Notes:
- Livestreams are not supported. They will not be supported in the near future.
- This player will not function with DRM protected content. This is intended. Please be mindful of how you use this tool. FastStream should not be used to infringe copyright.
- This player is still a work-in-progress. Please report any bugs to the Github issue tracker here: https://github.com/Andrews54757/FastStream/issues
- For your privacy, this extension **does not collect telemetry**. Nor does it require additional resources from the internet to function. It will work fully offline. Feel free to browse the codebase on Github.
- **We take accessibility concerns seriously**. If you need accommodations not available in the latest version, please contact us and we will work on it ASAP. Also, please feel free to submit feature requests or suggestions on the Github issue tracker!
- The default maximum size for pre-buffering is 5GB. This can be changed in the settings page. Please be mindful of your computer's storage space when changing this setting. Browsers will offload data in the RAM to the SSD if the video is too large. Frequently pre-buffering large videos can reduce the lifespan of your SSD.

## Demo

See the player in action without installing the extension! Tested on Chrome and Firefox. Note: Some features (OpenSubtitles/header override) are not available without installation.

[Web Version + Big Buck Bunny](https://faststream.online/player/#https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8)

## Youtube issues
We've been seeing issues with Youtube not working for some people using FastStream. This is because of an ongoing effort by Google to thwart third-party clients and adblockers. If you are having trouble with Youtube, please let us know in the issue tracker!

### Troubleshooting Youtube issues
1. Make sure you are using the latest version of FastStream.
2. Try clearing your browser cache and reinstalling the extension.
3. Search the issue tracker to see if your issue has already been reported. If it has, please add any relevant information to the existing issue. If it hasn't, please create a new issue with as much detail as possible.

## Browser compatibility
Tested using Chrome and Firefox. Other chromium based browsers (such as Edge) will also likely work.

Please note that there are no plans to make FastStream mobile compatible any time soon. Developing FastStream for Chrome and Firefox for the desktop is already an exhausting endeavor. Supporting mobile on top of all that is too much work for a mere college-student programming hobbyist like me. That said, if you find a way to make it work on more browsers or devices, please feel free to share and make a pull request!

## Installation For Chrome and Firefox

You can find the extension on the [Chrome extension store](https://chrome.google.com/webstore/detail/faststream/kkeakohpadmbldjaiggikmnldlfkdfog)

It is also available for [Firefox](https://addons.mozilla.org/en-US/firefox/addon/faststream/)

## Manual Installation For Chrome
The Chrome extension store policies do not allow extensions that can download videos from Youtube (anti-trust anybody?). As a result, FastStream cannot save Youtube videos if installed from the official store. To get restricted features, please do the following steps:

1. Go to `chrome://extensions`
2. Turn on developer mode
3. Drag and drop the `chrome` directory of this repository, or the prebuilt ZIP found on the [Releases page](https://github.com/Andrews54757/FastStream/releases)

**THERE IS NO BUILT-IN AUTOMATIC UPDATE SYSTEM. If you go this route, please make sure to check back often for updates because I will often fix bugs as I encounter them. FastStream will remind you in the settings page, but you will have to update it manually.**

## Manual Installation For Firefox
The extension is, by default, configured to work on Chrome. You can either use a prebuilt version from the [Releases page](https://github.com/Andrews54757/FastStream/releases) or build the extension yourself using the build instructions below.

You can then install the extension on Firefox Developer Edition by going to `about:config` and setting `xpinstall.signatures.required` to `false`. You must then also disable extension auto-updates or the extension will be removed when you close the browser. To do this, go to `about:addons`, click on the gear icon, and uncheck `Update Add-ons Automatically`. You can then click "Install Add-on From File" and select the `firefox-libre-*.zip` file to install the extension.

**THERE IS NO BUILT-IN AUTOMATIC UPDATE SYSTEM. See above.**

## Build Instructions
In order to create bundles for Chrome and Firefox, you need to build FastStream by following these steps:

1. Install NodeJS and NPM
2. Run `npm install --only=dev` to install dev dependencies
3. Run `npm run build`
4. Firefox bundle is available in the `built` directory

Files with `dist` in the name are for Chrome & Firefox's stores. Files with `libre` are for manual installation. The `dist` versions will have reduced featuresets to comply with store policies.

## Credits

Many thanks to the contributors of this project.

#### Developers
- Andrews54757: Lead developer
- ChromiaCat: Update notify icon (PR #142)
- frenicohansen: SRT/ASS subtitles to WebVTT (PR #323)
- Mesoon5642: Options search (PR #459)

#### Translators
- Dael (dael_io): Fixed Spanish translations
- reindex-ot: Japanese translations
- elfriob: Russian translations
- Justryuz: Malay translations
- CommandLeo: Italian translations
- andercard0: Portuguese translations
- MrMysterius: German translations

#### Open Source Libraries

- [hls.js](https://github.com/video-dev/hls.js): Used for HLS playback
- [dash.js](https://github.com/Dash-Industry-Forum/dash.js): Used for DASH playback
- [mp4box.js](https://github.com/gpac/mp4box.js): Used for automatic fragmentation of mp4 files
- [youtube.js](https://github.com/LuanRT/YouTube.js): Used for Youtube playback
- [vtt.js](https://github.com/mozilla/vtt.js): Used for parsing VTT subtitles
- [jswebm](https://github.com/jscodec/jswebm): Used for demuxing webm files
- And some more! Check the `chrome/player/modules` directory for more information.

## Funding & Donation Policy

FastStream does not accept donations for the project as a whole. Please see the [wiki](https://github.com/Andrews54757/FastStream/wiki/Funding) for more details.

## Technical Details

Please see the [wiki](https://github.com/Andrews54757/FastStream/wiki/Technical-Details) for more information on the technical details!
  
## Disclaimer

While it may be possible for FastStream to save videos from any website as long as there is no DRM, that doesn't mean you have the legal right to do so if you don't own the content. Please be mindful of how you use this tool. FastStream should not be used to infringe copyright.
