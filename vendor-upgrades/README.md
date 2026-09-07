# Vendored library upgrade recipes

This directory contains the measured, minimized patches that let FastStream
upgrade its vendored libraries to current releases — plus the full analysis
document behind each one.

They were produced by diffing the vendored `chrome/player/modules/*` files
against every published npm release of each library, taking the smallest
diff as the true base version, and then re-deriving FastStream's own changes
against the **latest** release. Where a change had already landed upstream,
it was dropped from the patch.

## Why this exists

The vendored files have no recorded version and no recorded diff against
upstream, so upgrading them has historically meant eyeballing a 1.3–3.5 MB
blob. These patches make the actual divergence explicit and small: hls.js's
is 62 lines where the old diff was 466.

## How to use a recipe

Each `.patch` applies to the named npm release. Example for hls.js:

```sh
# fetch the exact release the patch is against
npm pack hls.js@1.7.2            # or download from unpkg: dist/hls.mjs

# apply FastStream's changes
patch dist/hls.mjs < vendor-upgrades/patches/hls.js@1.7.2.patch

# dist/hls.mjs is now the vendored hls.mjs, at the new version
```

The same shape applies to `dist/hls.js` (the worker bundle), sweetalert2's
UMD build, mp4box's `mp4box.all.js`, gif.js's UMD build, and jswebm's
`src/` files. See `docs/vendored-libraries.md` for the per-library details:
which file inside the package, which transform follows the patch, and what
each hunk does.

## What each patch contains

| Patch | Against | Contents |
|---|---|---|
| `hls.js@1.7.2.patch` | hls.js 1.7.2 | 4 hunks: extra demuxer/remuxer exports (the six classes `hls2mp4/transmuxer.mjs` imports), `outputSamples` on the remux result, and the subtitle part-loading guard (upstream issue #7460) |
| `sweetalert2@11.26.25.patch` | sweetalert2 11.26.25 | removes the locale-triggered payload block, retargets `document.body` to the player container, and replaces the dead `new Function` template-config path with an explanatory throw |
| `mp4box@0.5.3.patch` | mp4box 0.5.3 | five changes: `getSampleList` (FastStream addition), `buildTrakSampleLists` (the one MP4 playback depends on), `getSample`, `writeHeader`, `flattenItemInfo` |
| `jswebm@0.1.2.patch` | jswebm 0.1.2 | colour metadata parsing, VP9 codec string derivation, the `keyframe`→`keyFrame` fix (upstream writes one and reads the other, so every chunk was marked delta), `demux()` return, header handling |
| `gif.js@0.2.0.patch` | gif.js 0.2.0 | worker URL resolved from `import.meta.url` (the document-relative default 404s in the extension) + a local-variable rename |

`docs/hls.js-1.6.9-faststream.patch` is the historical raw diff against
1.6.9 — kept for reference; the 1.7.2 patch supersedes it and is much
smaller because most of it landed upstream between the two releases.

## Libraries that need no patch at all

Measured, not assumed — these vendored copies are AST-identical to the
published npm builds once `eslint --fix` noise is normalized away, so the
stock release can simply be vendored:

- **pako** 3.0.1 (2.x needed a wrapper; 3.x ships real ESM)
- **fuse.js** 7.5.0
- **sortablejs** 1.15.7 (complete build already mounts all plugins)
- **mp4-muxer** 4.3.3

## dash.js: measured, deliberately not upgraded

`dashjs@5.1.0` is the base, and the divergence is real (68 of dash.js's own
source modules are customized). A three-way comparison of stock 5.1.0, the
patched bundle, and stock 5.2.1 found **0 of 68 customized modules landed
upstream** in the 5.1.0→5.2.1 window, so there is no shortcut there. The
module-by-module inventory is in `docs/vendored-libraries.md`.

## Verification performed

Every recipe here was validated by an end-to-end playback suite: real HLS,
DASH and MP4 streams played in Firefox with `currentTime` asserted to
advance — the failure mode of a bad library swap is a stream that loads and
then never decodes, which no unit test catches. The mp4box patch in
particular was bisected against that suite (`buildTrakSampleLists` is the
hunk playback depends on).