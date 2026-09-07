# Vendored libraries: what was actually changed

Mozilla's stated objection to FastStream on AMO is that it ships "heavily
customized" copies of hls.js, dash.js and youtube.js rather than official
releases. This file measures that claim rather than assuming it.

Method: fetch every candidate npm release, diff each against the in-tree
copy, and take the smallest diff as the base version. Reproduce with
`docs/hls.js-1.6.9-faststream.patch`.

## hls.js

**Base version: 1.7.2** (upgraded 2026-09-06 from 1.6.9). `patches/hls.js@1.7.2.patch`
is now **4 hunks, 62 lines** — down from the original 22 hunks / 466 lines
against 1.6.9. The reduction plan below (originally written against a
1.7.1 target) was carried out one version further, re-verifying every claim
against the actual 1.7.2 npm release rather than trusting the old table.

### What's still patched

**Extra exports (1 hunk).** The export list is widened to include
`AACDemuxer`, `MP3Demuxer`, `MP4Demuxer`, `TSDemuxer`, `MP4Remuxer` and
`PassThroughRemuxer` — exactly the six names
`chrome/player/modules/hls2mp4/transmuxer.mjs:1` imports to convert HLS to
MP4 for the save-to-disk feature (the original patch's list also included
`AvcVideoParser` and `ExpGolomb`, which nothing in this tree imports, so
those two were dropped). Confirmed still absent from 1.7.2's export
statement, and the package's `exports` map still only exposes `.`,
`./light` and `./dist/*`, so there is still no deep-import escape hatch.

**`outputSamples` on the remux result (2 hunks, in both `dist/hls.mjs` and
the UMD `dist/hls.js` that becomes `hls.worker.js`).** The muxer's returned
object gains `outputSamples` alongside `nb`. hls2mp4 needs the samples
themselves, not just the count. Confirmed still not returned by 1.7.2's
`MP4Remuxer`.

**VTT subtitle part-loading guard, upstream issue #7460 (1 hunk).**
`BaseStreamController.shouldLoadParts` still has no fragment-type check, so
without this guard `SubtitleStreamController` (which does not implement
part loading) could be told to load parts anyway. Confirmed still missing
in 1.7.2.

### What moved out of the patch entirely

**ABR abandon-rules disabled.** `AbrController._abandonRulesCheck` used to
be commented out wholesale in the patch. hls.js normally watches for a
fragment loading too slowly and drops quality; that heuristic fights
FastStream's whole premise of pre-buffering far ahead at up to 6x. This is
now a `FastStreamAbrController` subclass in `HLSPlayer.mjs`, passed via
hls.js's public `abrController` config option — no patch needed. Because
`_abandonRulesCheck` is assigned as an *instance* property inside
`AbrController`'s constructor rather than declared on the prototype, the
subclass has to reassign it after calling `super()`; a same-named subclass
method would be shadowed by the parent's instance property and never run.

### What was dropped as already landed or superseded upstream

Checked directly against the 1.7.2 npm release (not assumed from the 1.7.1
table, which turned out to be wrong on two rows below):

| Patch hunk | Status at 1.7.2 |
|---|---|
| `notEqualAfterStrippingQueries` (CDN token rotation tolerance) | **landed**, byte-identical |
| `mapDateRanges` PDT fallback | **landed**, byte-identical |
| `mergeDateRanges` early-return restructure | **landed**, byte-identical |
| `details.fragmentEnd` instead of `frag.end` for part selection | **landed**, byte-identical |
| `ExpGolomb`/NAL start-code scan-loop optimisation | **superseded** — `BaseVideoParser.parseNALu` was rewritten entirely to use `array.indexOf`, faster than the patched version and not the same code to diff against |
| `userAgent` config threaded through `getAudioConfig`/`initTrackConfig` | **dead in the original patch** — added to both signatures and to `hlsDefaultConfig`, but never actually read anywhere in the diff. Not present in 1.7.2's signatures either; dropped, no behavioural loss |
| `httpStatus !== 0` guard before treating a fragment as a gap | **superseded** — `onFragmentOrKeyLoadError` was rewritten around a `live && frag.sn < levelDetails.endSN` condition that only applies to live streams at all, which is strictly more precise than the old guard |

Andrew has evidently been upstreaming; the README's "I work with the
original developers" is accurate.

### Verification performed for the 1.7.2 upgrade

- `pnpm run lint`, `pnpm run typecheck`, `pnpm test` — all pass.
- `pnpm run build:keep` — all four targets build.
- `pnpm run lint:amo` / `lint:github` — 0 errors, the same pre-existing 3
  warnings (vtt.js, ort.wasm.mjs, dash.mjs), nothing new from hls.js.
- `pnpm run test:e2e` — real HLS playback via `hls.js` + `hls.worker.js`
  against a live stream (`readyState` reaches 4, `currentTime` advances, no
  `error`), alongside the DASH and MP4 paths in the same spec.
- `pnpm run test:ext` — extension-loaded checks (WASM under extension CSP,
  no YouTube surface, VAD/ONNX Runtime) unaffected.

## Recommended approach: `pnpm patch`, not wrappers

Do **not** try to reimplement these through wrapper classes. The exports and
`outputSamples` changes have no public-API equivalent, and reimplementing a
demuxer to avoid a one-line export change would add far more risk than it
removes.

Ship the **official npm release plus a committed patch file**, via
`pnpm patch`. This is what pnpm's patching exists for and it satisfies what
AMO actually wants — a verifiable upstream base and an auditable,
human-sized diff:

- before this project existed: a 1.3 MB file with no stated version and no
  provenance
- now: `hls.js@1.7.2` from npm, hash-verifiable, plus a 62-line patch a
  reviewer reads in a couple of minutes

Next step if this is revisited again: offer the export change upstream.
"Please export the demuxers" is a small ask, and if accepted the patch
shrinks to 3 hunks.

Re-run the playback checklist in `CLAUDE.md` after each step. The HLS entry
covers this library.

## hls.worker.js

`HLSPlayer.mjs:29` sets hls.js's `workerPath` config option (official API,
default `null`) to `modules/hls.worker.js`. That file is **required**: hls.js
normally builds its worker at runtime from a `blob:` URL, and Manifest V3's
extension CSP blocks blob workers, so the worker has to be a real file inside
the package.

The old in-tree file was 325 KB with no recorded version. It was **built from
hls.js source with minification off** — not beautified from npm's minified
`dist/hls.worker.js`, since it retains meaningful names
(`requireEventemitter3`, `getDefaultExportFromCjs`) that minification destroys
and beautifying cannot restore.

It is now generated by `tools/sync-vendor.mjs` from npm's **unminified UMD**
build, `node_modules/hls.js/dist/hls.js`, applying the same transform hls.js
applies to itself: that bundle is wrapped in a
`__HLS_WORKER_BUNDLE__(__IN_WORKER__)` function which self-invokes with
`false`, and hls.js's own blob path re-invokes it with `true` behind a small
CommonJS/AMD shim. So the generator prepends that shim, flips the trailing
`(false)` to `(true)`, and drops the sourcemap reference.

Trade-off: the worker grows from 325 KB to ~1.42 MB, because the UMD bundle is
all of hls.js rather than a worker-only bundle. This is the same bundle hls.js
would use for its own blob worker. In exchange the file has a verifiable npm
base, keeps its real `version = "1.6.9"` string, and stays readable.

### Only three hunks were needed in the UMD

Of the 22 hunks patched into `dist/hls.mjs`, only code that actually executes
in the worker matters — the demuxers, remuxers and parsers. The UMD build is
ES5-transpiled, so hunks had to be ported by hand rather than reused. Three
were real:

- the `BaseVideoParser` NAL scan-loop optimisation (labelled `l1:` loop)
- `MP4Remuxer` video: `outputSamples` added to the remux result
- `MP4Remuxer` audio: the same

The rest are main-thread only (`AbrController`, `M3U8Parser`,
`BaseStreamController`, `defaultLoadPolicy`, the widened export list) and are
dead code inside a worker.

### The `userAgent` plumbing is dead code

Four of the hunks thread a `userAgent` parameter through `getAudioConfig`,
`initTrackConfig`, `AACDemuxer` and `TSDemuxer`. **It is never read.**
`userAgent` appears exactly once in `getAudioConfig`'s 71-line body — the
signature — and `initTrackConfig` accepts the parameter but calls
`getAudioConfig(observer, data, offset, audioCodec)` without passing it on.

Andrew appears to have started backporting an upstream change and stopped
half way. These hunks were therefore **not** ported to the UMD, and they
should simply be dropped when the base moves to 1.7.1, where the real version
of this change already exists.

## dash.js

**Base version: 5.1.0**, confirmed rather than assumed. The npm package is
`dashjs`, not `dash.js`, and the artifact is
`dist/modern/esm/dash.all.debug.js`. Diff sizes against candidates:

| Release | Diff lines |
|---|---|
| **5.1.0** | **3887** |
| 5.0.3 | 4286 |
| 5.1.1 | 14511 |
| 5.2.0 | 35824 |

The `dash.mediaplayer.debug.js` variant is much further away (11571), so
`dash.all.debug.js` is the right artifact.

### The divergence is real, and much larger than hls.js's

The bundle is webpack output, so every module carries its source path and can
be compared individually. That gives an exact answer instead of a line count:

| | Count |
|---|---|
| Modules in npm 5.1.0 | 432 |
| Modules in-tree | 415 |
| **Byte-identical** | **331** |
| Differing | 79 |
| Only in npm | 22 |
| Only in-tree | 5 |

Of dash.js's **own** 251 source modules, **188 are byte-identical** and 60
differ. That 75% identical figure is the important control: if the in-tree
bundle had been built with a different toolchain, *every* module would differ.
It did not, so the 60 differing modules are genuine FastStream modifications,
not build noise.

Most-modified modules, by removed lines: `MediaController` (203),
`DashManifestModel` (192), `AbrController` (183), `TimelineSegmentsGetter`
(167), `SegmentsUtils` (166), `StreamProcessor` (98), `HTTPLoader` (90),
`DashHandler` (88), `StreamController` (83), `ScheduleController` (76).
`HTTPLoader._internalLoad` is rewritten wholesale to hook FastStream's own
downloader, in the same spirit as the hls.js loader change.

The 22 modules present only in npm and 5 only in-tree are **not** FastStream
changes: they are a different version of the transitive dependency
`@svta/common-media-library`. npm's 5.1.0 bundles CMCD v2
(`CMCD_COMMON_KEYS`); the in-tree build has the older `CmcdFormatters`. That
is dependency drift baked into a bundle, and it is left alone - npm's newer
copy is kept.

### Status: migrated, provably inert

`chrome/player/modules/dash.mjs` is no longer in git. It is generated from
`dashjs@5.1.0` plus `patches/dashjs@5.1.0.patch`. A clean install reproduces
the previously vendored file **byte for byte**, and the file does not appear
in a build-output diff against the upstream baseline at all.

The patch is 354 KB, against hls.js's 31 KB. That is honest about the size of
the divergence rather than hiding it, and it still gives AMO what today's tree
does not: a hash-verifiable upstream base and a diff a reviewer can read.

**5.2.1 upgrade measured (2026-09-06): shelved, not attempted.** Before
touching anything, ran the same module-boundary comparison hls.js's upgrade
used, but three-way: stock 5.1.0 vs. the in-tree patched bundle vs. stock
5.2.1. That isolates exactly which of dash.js's own `src/` modules FastStream
actually customized (68, close to the 60 estimated by line-count above) from
modules that merely drifted between releases for unrelated reasons - then
checks, per customized module, whether 5.2.1 already contains the fix.

**Result: 0 of 68 have landed.** Every customized module still differs from
5.2.1 exactly as it differs from 5.1.0. That is a materially different
finding than hls.js's upgrade, where most hunks turned out to already be
upstream and the patch shrank by 90%. There is no shortcut here - dash.js
apparently hasn't absorbed any of these fixes in the 5.1.0->5.2.1 window, so
"upgrade the base and drop what landed" does not apply. What would remain is
reconciling all 68 modules by hand against a new base, and most of them are
the core streaming engine, not peripheral code: `AbrController`,
`StreamController`, `MediaController`, `BufferController`,
`ScheduleController`, `GapController`, `ThroughputController`, `HTTPLoader`,
`DashHandler`, `DashManifestModel`, `DashParser` among them. That is
realistically comparable in size to redoing most of the original vendoring
analysis, not a version bump - shelved as its own dedicated effort rather
than attempted under session time pressure. 5.1.0 stays pinned + patched,
which already satisfies AMO's actual objection (verifiable provenance).

One wrinkle worth recording: npm's bundle embeds 428 stray CR characters
inside a vendored BSD licence comment, because a bundled dependency ships CRLF
source. Diff formats cannot carry a trailing-CR-only change, so
`tools/sync-vendor.mjs` normalises line endings and guarantees a trailing
newline instead. Without that the generated file differs from the vendored one
by exactly those 428 bytes plus a final newline.

**addons-linter's one `DANGEROUS_EVAL` here** is
`/******/ return this || new Function('return this')();` - webpack's own
generated bootstrap, present verbatim in the module-wrapper preamble of
effectively every webpack bundle (the `/******/` comment prefix is webpack's
own marker for its runtime code, not this project's). It is the standard
cross-environment global-object lookup, reached only as a fallback when
`this` is already falsy at that point in the bootstrap - which it is not, in
a browser or extension context. Not something to patch out of a bundle this
size for one boilerplate line; left as upstream ships it.

## The smaller libraries

Measuring these turned up a pattern that changes how they should be handled.
They are **stock npm builds that Andrew ran the project's own `eslint --fix`
over**, plus a small edit at the module boundary where a UMD build had to
become an ES module. The huge textual diffs are almost entirely lint autofix:
`let`->`const`, `var`->`const`, added semicolons, ternary line breaks, quote
style, and split combined `var` declarations.

Comparing **ASTs** rather than text separates the two, and is the right tool
here: it ignores whitespace, comments and quote style, so what remains is only
what can actually change behaviour.

| Library | Version | Real change beyond lint autofix | Status |
|---|---|---|---|
| pako | 3.0.1 | none - 3.x ships real ESM, no wrapper needed at all | **migrated** |
| fuse.js | 7.5.0 | none at all | **migrated** |
| sortablejs | 1.15.7 | named export only; plugins already mounted upstream | **migrated** |
| sweetalert2 | 11.26.25 | ESM boundary; includes a payload that must stay stripped | **migrated** |
| mp4-muxer | 4.3.3 | none - AST identical to the vendored copy | **migrated, 5.2.2 tried and reverted** |
| gif.js (worker) | 0.2.0 | none - AST identical; the vendored copy was only beautified | **migrated** |
| gif.js (main) | 0.2.0 | ESM wrapper + worker URL resolved from `import.meta.url` | **migrated** |
| coloris | 0.21.1, pinned commit | 9 KB patch; one deliberate bug fix on top | **migrated** |
| jswebm | 0.1.2 | generated from `src/`, 23 KB patch | **migrated** |
| vtt.js | dash.js contrib | **proven** - AST-identical to dash.js's bundle plus 3 changes | **verified** |
| mp4box | 0.5.3 | 37 KB patch, five changes, one of them an addition | **migrated, 2.4.1 upgrade attempted and shelved (2026-09-06)** |
| libsamplerate-js | none published | filename bug fixed; wrapper+library rebuilt and checked | **reproduced** |
| knob | `jherrm/knobs@cf2db70f` | **verified** - `pnpm run verify:knob` | **verified** |
| googlevideo | ? | `LuanRT/googlevideo` | pending |

`eventemitter.mjs` is **not** a vendored library - it is FastStream's own
code and should stay in git.

### Worked examples

**pako** was stock 2.1.0 with a single appended export line. The generated
file (npm build + that line) parses to an **AST identical** to the vendored
copy, so the replacement needed no patch and no playback test - the parsed
program is provably the same. Since upgraded to 3.0.1, whose `dist/pako.mjs`
is real ESM with named `deflate`/`inflate` exports - that appended line has
nothing to attach to any more, so the wrapper is gone too and this is now a
verbatim copy, same as fuse.js.

**mp4box 2.4.1 was sized up (2026-09-06) and shelved.** Two problems, not
one. First, the public API changed: `MP4Box.createFile()` is gone, replaced
by a bare `createFile()` export, which alone would mean code changes in
`mp4merger.mjs` (3 call sites), `demuxers.mjs` and `MP4Player.mjs`. Second,
and the real blocker: mp4box.js was rewritten in TypeScript and is now
bundled with rolldown, which renames every internal binding to a short
synthetic identifier (`$`, `Bn`, `Kt`, ...) and only maps back to a readable
name at the final `export {...}` statement. Checked both the `.mjs` and
`.cjs` output - neither keeps real names. That breaks the method this
project otherwise relies on for exactly this kind of upgrade: hls.js's and
dash.js's bundlers keep real function/module names, so a patch hunk can be
found, diffed against the new release, and judged landed/superseded/still
needed. Here, none of the five customized functions
(`buildTrakSampleLists`, `getSample`, `getSampleList`, `flattenItemInfo`,
`writeHeader`) are findable by name any more, and two of them
(`samples_stored` sample-release tracking, used by `MP4Player.mjs` in core
playback; `getSampleList()`, used by the save-to-disk DASH-to-MP4 path) are
real behaviour, not lint noise. Porting them would mean reverse-engineering
the rolldown output's alias chain back to the real functions first - a
materially bigger and riskier undertaking than hls.js, on code that sits in
the playback-critical path. 0.5.3 stays pinned + patched; that already
satisfies AMO's actual objection (verifiable provenance), and nothing
requires the newer release. Worth revisiting only with a lot more time
budgeted, or if GPAC ever ships a build that preserves real names.

**mp4-muxer 5.2.2 was tried (2026-09-06) and reverted.** The API surface
`reencoder.mjs` uses (`Muxer`, `StreamTarget`, `addVideoChunk`,
`addAudioChunk`, `finalize`) is unchanged between 4.3.3 and 5.2.2 - checked
directly against 5.2.2's `.d.ts` before touching anything. But
`tests/e2e/specs/modules.e2e.mjs`'s existing "writes a valid MP4 container"
test - which declares a video track and calls `finalize()` with **zero**
video chunks added, exercising exactly the "recording stopped before any
frame arrived" edge case a re-encode tool has to survive - throws in 5.2.2:

```
page-side failure: can't access property "colorSpace", track.info.decoderConfig is null
```

5.2.2's `videoSampleDescription()` unconditionally reads
`track.info.decoderConfig.colorSpace` when writing the `stsd` box.
`decoderConfig` is only ever populated from a real chunk's metadata, so a
video track that received no chunks has a null one, and finalization
crashes instead of producing a container with an empty track (or at least
not crashing). 5.2.2 is the current latest release (checked against the npm
registry directly, not assumed), so there is no newer patch to wait for, and
the package is itself deprecated upstream in favor of a successor library
("Mediabunny"). Given a real behavioural regression, on the newest
available version, in a package upstream has stopped investing in - reverted
to 4.3.3 rather than shipped it or patched around it.

**fuse.js** needed nothing at all: 34 AST differences, every one of them lint
autofix, and identical exports.

This is a strictly better outcome than a patch. A patch of `eslint --fix`
noise would be a thousand lines of diff that tells a reviewer nothing; using
the npm file as published, with any real change expressed as a few lines in a
documented transform, is exactly what AMO is asking for.

### mp4-muxer and gif.js: proven, not argued

These two are worth separating from the "measured" cases because the evidence
is stronger. Their vendored copies are **AST-identical** to the published
builds once the transformations the project's own `eslint --fix` performs are
normalised away:

| Normalised | What it changes |
|---|---|
| `one-var` | `var a, b` into `var a; var b` |
| `curly` | `if (x) stmt;` into `if (x) { stmt; }` |
| `quotes` | a literal's raw text, not its value |
| `no-var` / `prefer-const` | the declaration keyword |
| `indent` | whitespace *inside* a multi-line template literal |

Nothing else differed. That is a stronger claim than "the diff looks
additive", which is exactly the reasoning that shipped the mp4box regression:
the parsed program is the same program.

Finding the base for mp4-muxer needed the AST size as a search key rather than
the line count, since the vendored copy is reformatted. 4.3.3 sits between
4.3.2 and 5.0.0 by that measure and matches exactly; a line-count search would
have pointed at 5.0.0.

gif.js needed one real change. The npm build spawns its worker from
`options.workerScript`, a bare `'gif.worker.js'` that the browser resolves
against the **document**, and the extension's player page is not in that
directory. `toGifModule` rewrites the single `new Worker(...)` call to resolve
from `import.meta.url` instead. Both anchors it edits are asserted, so a
future gif.js that changes either fails the build rather than silently
shipping a module that exports nothing or spawns a worker from a 404.

Neither is covered by the playback suite - GIF export and remuxing are not on
the path a video takes - so `tests/e2e/specs/modules.e2e.mjs` drives both
directly: gif.js encodes two frames and the test checks for a `GIF89a` header,
mp4-muxer writes a container and the test checks for an `ftyp` box at offset
4. Breaking the worker URL on purpose fails the gif test and only that test.

gif.js later picked up a second, cosmetic patch (`patches/gif.js@0.2.0.patch`):
a bundled UA-sniffing helper module declares `var UA, browser, mode, platform,
ua` and then reads `browser.platform.name` off its own function-scoped
`browser` object - nothing to do with the WebExtensions `browser` global, but
addons-linter's `webextension-unsupported-api` check does not appear to do
scope analysis, so it flagged the access as an unimplemented API anyway.
Confirmed empirically, not assumed: renaming that one local variable to
`browserInfo` (a plain word-boundary rename, scoped to just that bundled
module so it cannot touch anything else in the file) made the warning
disappear on a real `lint:amo` run, with nothing else in the 12-warning count
changing. `module.exports` still returns the same shaped object, so nothing
downstream can observe the rename.

### libsamplerate: a shipped bug, and why npm is the wrong answer

This section used to say the answer here was "use the published package".
Measuring it says the opposite, and on the way to that measurement the
resampler turned out to have never worked at all.

#### The resampler was broken in every build, including upstream's

The vendored `libsamplerate.mjs` is webpack output, and webpack emitted the
wasm reference under its content-hashed name:

```js
module.exports = __webpack_require__.p + "625941a851f0440e1705.wasm";
```

The file vendored beside it is called `libsamplerate.wasm`. Nothing sets
`Module.locateFile` or `Module.wasmBinary`, so the request 404s. The glue is
built with `BINARYEN_ASYNC_COMPILATION=0`, which means it instantiates
synchronously through a blocking `XMLHttpRequest` rather than
`WebAssembly.instantiateStreaming` - so the 404 response body was handed
straight to `WebAssembly.Module`, which rejected it:

```
at offset 4: failed to match magic number
```

Every call to `create()` threw. The same mismatch is present in upstream
v1.3.77, so this is not something the fork introduced.

It went unnoticed because of where the code sits: the resampler is reached
only from `reencoder.mjs`, which needs WebCodecs and therefore runs on Chrome
only, and only when a user re-encodes a download. Nothing on the playback path
touches it, and no test did either.

The fix is the one string literal, and it is annotated in place. With it
applied, 1 second of a 440 Hz sine resampled 48000 -> 44100 comes back as
44054 samples at peak 1.0, RMS 0.7071 and still 440 Hz.
`tests/e2e/specs/modules.e2e.mjs` now asserts exactly that, and it was watched
failing with the magic-number error before the fix.

#### Do not replace it with the npm package

The earlier recommendation assumed npm's build was the same thing with better
provenance. It is not the same thing. Measured, not estimated:

| Artifact | JS | wasm | Real WebAssembly? | Zipped total |
|---|---|---|---|---|
| vendored (Andrew's build) | 50,636 | 117,508, separate file | **yes** | **110,601** |
| npm 1.4.3 | 24,714 | 1,501,929, separate file | yes | 1,352,606 |
| npm 2.1.0 - 2.1.2 | 2,016,428, wasm inlined | none | **no** | 1,470,718 |

`@alexanderolsen/libsamplerate-js` has shipped **no WebAssembly at all** since
2.1.0. The string `WebAssembly` does not appear anywhere in its published
bundles; what is there is a wasm2js shim whose `instantiate` returns a
thenable. Upstream's own build script says why:

```sh
-s WASM=0 \        # don't generate a separate .wasm file
-s SINGLE_FILE=1 \ # inline the generated wasm
```

So migrating to npm would mean shipping **+1.36 MB compressed** - a 32%
increase on the 4.28 MB AMO zip - to replace working WebAssembly with
asm.js. That is a worse product in exchange for provenance, and the size lands
on every user whether or not they ever re-encode anything.

Version 1.4.3 is the last release with real wasm in a separate file, and it is
no cheaper: its wasm is 1.5 MB and barely compresses, because sinc coefficient
tables are incompressible float data.

#### The 117 KB is not free, and now we know what it costs

Probing each converter with a full second of audio - rather than merely
constructing one - shows where the 12x size difference went:

| Converter | Frames out for 48000 in |
|---|---|
| `SRC_SINC_MEDIUM_QUALITY` | 44054 |
| `SRC_SINC_BEST_QUALITY` | **2** |
| `SRC_SINC_FASTEST` | **2** |
| `SRC_ZERO_ORDER_HOLD` | 44100 |
| `SRC_LINEAR` | 44100 |

Two of the five sinc converters construct without error and then emit almost
nothing, which is what an absent coefficient table looks like from
JavaScript - and libsamplerate's sinc tables are exactly the megabyte-scale
static float data missing from this build. Probing them in a different order
gives the same result, so it is the build and not leaked state between
instances.

The 46-frame shortfall on the medium converter is different in kind and is not
a defect: a sinc converter cannot emit the tail it has no future input for.
`SRC_ZERO_ORDER_HOLD` and `SRC_LINEAR`, which need no lookahead, return 44100
exactly.

FastStream only ever asks for `SRC_SINC_MEDIUM_QUALITY`, so none of this
affects the product - but it does mean the vendored wasm is **not**
interchangeable with a stock build, and swapping it would silently change
resampling quality. The e2e suite now pins the three that work.

So Andrew's build is not sloppy, it is a deliberate trade: `-O3`, `-g0`, real
WebAssembly, one converter's tables, and 12x smaller than the published one.

#### What is actually left to do

Only provenance, and it is a narrower problem than it looked. The glue carries
the machine that produced it:

```js
var _scriptName = "file:///Users/andrews/Desktop/fs/libsamplerate-js/src/glue.js";
```

Mozilla's requirement for compiled code is source plus build instructions, and
those instructions are now known: upstream's `scripts/build_emscripten.sh`
with `WASM=0` changed to `WASM=1` and `SINGLE_FILE=1` to `SINGLE_FILE=0`,
against `libsamplerate.a` from `scripts/library/build_library.sh`. The
remaining work is to pin an emscripten version, run that build, and ship a
`verify:libsamplerate` that reproduces the artifact and compares hashes - the
same shape as `verify:vtt`, which is already how vtt.js is handled.

#### Reproduced, with an honest limit on what that proves

`tools/reproduce-libsamplerate-wasm.sh` does exactly that: fetches the
wrapper unmodified from `aolsenjazz/libsamplerate-js` (confirmed unchanged
since commit `581aac655d`, 2021-01-13 - checked via that path's own commit
history, not assumed), builds `libsamplerate` 0.2.2 with `emconfigure`, and
compiles the two with `em++` using upstream's own flags minus the two that
turn off WebAssembly.

libsamplerate 0.2.2 is a choice, not a certainty: it was published 2021-09-05,
four days before npm 1.4.3 - the last release with a real, separate wasm -
went out on 2021-09-09. That is the reasoning; there is nothing to check it
against, because `lib/libsamplerate.a` was committed as a **prebuilt binary
in that repository's very first commit** (`d5e77f2720`, 2021-01-12), with no
source and no build script anywhere in its history. That was confirmed by
walking the commit history of that exact path, the same way the mp4box bisect
was - there is nothing left to bisect here. This is the same shape of problem
the whole file started from, one level down: not "who modified this," but
"nobody ever recorded how this was built," and libsamplerate-js's own history
proves it, rather than assuming it.

So this script cannot claim byte-identity, and does not. What it produces is
run through the exact numeric check `modules.e2e.mjs` runs on the shipped
module - a 440 Hz sine, 48000 -> 44100 - and the result for
`SRC_SINC_MEDIUM_QUALITY`, the only converter the product uses, is:

| | shipped | rebuilt (0.2.2) | rebuilt (0.2.0, control) |
|---|---|---|---|
| length | 44054 | 44054 | 44054 |
| peak | 1.0000001192092896 | 1.0000001192092896 | 1.0000001192092896 |
| rms | 0.7070750381175818 | 0.7070750381175818 | 0.7070750381175818 |

Exact agreement on all three figures - but the 0.2.0 control matches too,
which means this particular signal is not sensitive enough to tell
libsamplerate versions apart on its own. What it does establish is narrower
and still real: the published wrapper, compiled with documented flags against
a real release of the library it wraps, reproduces the shipped module's
behaviour on the one converter FastStream calls. The version pin stays a
documented inference, not a proven match, and the difference between those
two claims is written down here rather than blurred.

One thing the rebuild does that the shipped file does not: **every converter
works.** The shipped wasm returns 2 frames - not reduced quality, no usable
output at all - for `SRC_SINC_BEST_QUALITY` and `SRC_SINC_FASTEST`; the
rebuild returns correct audio for both, alongside the same match on the other
three. FastStream never asks for either, so this is not a product bug, but it
is a genuine defect in the shipped binary that a full rebuild does not carry.

The script needs a real toolchain - emsdk plus autotools - so it is
documentation to run by hand, the same way the ONNX Runtime rebuild command
above is, not a `pnpm run` target.

### The VAD blobs: the model is proven, the runtime is not

`vad/` holds the two largest files left in the tree, and both are binaries a
reviewer cannot read:

| File | Size | Status |
|---|---|---|
| `silero_vad_half.ort` | 1,856,120 B | **verified** - `pnpm run verify:vad` |
| `ort-wasm-simd-threaded.wasm` | 1,037,262 B | **stamped** - `pnpm run verify:ort` |
| `ort-wasm-simd-threaded.mjs` | 24 KB | emscripten glue from the same build |
| `ort.wasm.mjs` | 126 KB | **generated** from onnxruntime-web@1.20.0 |

**The model.** snakers4/silero-vad publishes only ONNX - `silero_vad.onnx`,
`silero_vad_half.onnx` and four variants, plus a `.jit` and a
`.safetensors`. There is no `.ort` anywhere in that repository, and there is
no reason to expect one: `.ort` is ONNX Runtime's own serialised format,
produced by converting a `.onnx` with `convert_onnx_models_to_ort`. So the
provenance path is a two-step one, and the honest form of it is:
`silero_vad_half.onnx` (published, hash-verifiable) plus the exact conversion
command.

That is now checked rather than argued. `tools/verify-vad.mjs` fetches the
published models from a pinned tag and asks how much of each appears
**byte-for-byte** inside the vendored `.ort`. Weight tensors are long
contiguous runs in both protobuf and flatbuffers, so a converted model carries
them across verbatim even though the two formats frame everything else
differently:

| Published model | Content shared with the `.ort` |
|---|---|
| `silero_vad_half.onnx` | **96.60%** |
| `silero_vad_16k_op15.onnx` | 20.48% |
| `silero_vad.onnx` (full precision) | 11.39% |

The controls are the point. A single high number could mean the method is
measuring the file format; three numbers this far apart mean it is measuring
the model. An exhaustive pass over every 64-byte window agrees with the
sampled one to two decimal places, and the longest single run shared with the
base is 264,128 bytes.

It is not 100% because ORT's graph optimiser fuses nodes on conversion - the
file registers `com.microsoft:FusedConv:1` - and fusion rewrites the weights it
folds together. The script asserts 90%, refuses to pass if a control ever
scores as high as the base, and was watched failing: scribbling over the
weight region drops the base to 64.14% and exits 1.

So the model is no longer the problem. **The runtime still is.**

**The runtime.** The wasm is a tenth the size of the one onnxruntime-web
publishes, so it is a custom reduced build with no published counterpart. It
is not anonymous, though: ONNX Runtime stamps its own build metadata into the
binary, and reading it out gives the whole configuration.

```
ORT Build Info: git-branch=main, git-commit-id=5c74539ab7,
build type=MinSizeRel, cmake cxx flags:  -ffunction-sections -fdata-sections
-flto -msimd128 -pthread -Wno-pthreads-mem-growth -fno-exceptions
-fno-unwind-tables -fno-asynchronous-unwind-tables
```

Plus, elsewhere in the binary, the version `1.20.0` and the message *"This
build doesn't support ORT format models older than version 5"* - which is what
a reduced build says, and the reason the model beside it is `.ort` rather than
`.onnx`. A reduced runtime will not load ONNX at all, so the two cannot be
separated.

`5c74539ab7` is real: `5c74539ab70e953e952fd2e4a8cc29daaf3455d5`, committed
2024-09-03. It is a **main-branch commit, not the v1.20.0 tag** (`1a313abba7`,
about two months later), which is worth stating plainly because it means the
runtime and the loader do not come from the same place - see below.

`pnpm run verify:ort` reads that stamp out of the shipped file and checks every
field against the values above, so this documentation cannot quietly drift away
from the binary. It was watched failing: scribbling over the commit id makes it
exit 1. What it proves is that the binary self-reports a specific upstream
commit and configuration; what it does not prove is that rebuilding there
reproduces these bytes.

The flags say what that rebuild would be. `-msimd128` is SIMD, `-pthread` is
threads, `-fno-exceptions` is `--disable_exceptions`, `MinSizeRel` is the
config, and the ORT-format-only restriction is `--minimal_build` - so:

```sh
git clone --recursive https://github.com/microsoft/onnxruntime
cd onnxruntime && git checkout 5c74539ab7
./build.sh --build_wasm --config MinSizeRel \
  --enable_wasm_simd --enable_wasm_threads \
  --minimal_build --disable_exceptions --skip_tests
```

#### That command was run, and the answer key was checked against

`tools/reproduce-ort-wasm.sh` runs it: clones onnxruntime at `5c74539ab7`,
fetches only the one submodule this build path needs (`cmake/external/onnx` -
the other two, `emsdk` and `libprotobuf-mutator`, are its own pinned emsdk
copy and a fuzzing harness respectively), and builds with the flags above via
`build.py`.

Two problems came up along the way, both external and both documented in the
script rather than worked around silently. CMake 4.x refuses
`cmake_minimum_required` versions below 3.5, which `google_nsync` - a
transitive dependency fetched automatically - still declares; the fix is
CMake's own suggested `-DCMAKE_POLICY_VERSION_MINIMUM=3.5`. And GitLab had
regenerated the byte content of the pinned Eigen archive since onnxruntime's
`cmake/deps.txt` recorded its hash - a live instance of the exact issue
onnxruntime's own deps.txt cites at
`gitlab.com/libeigen/eigen/-/issues/2744` - confirmed by downloading the
archive and checking its root directory name still matches the pinned commit
before accepting the new hash. The script re-derives that hash at run time
rather than trusting a pin that GitLab can silently invalidate.

With both cleared, the build produces a real
`ort-wasm-simd-threaded.wasm`, and its own "ORT Build Info" stamp - the same
one `verify:ort` reads from the shipped file - was checked against the
recorded values field by field:

```
ok   commit      git-commit-id=5c74539ab7
ok   build type  build type=MinSizeRel
ok   flag        -ffunction-sections / -fdata-sections / -flto / -msimd128 /
                 -pthread / -Wno-pthreads-mem-growth / -fno-exceptions /
                 -fno-unwind-tables / -fno-asynchronous-unwind-tables
ok   version     1.20.0
ok   minimal     ORT-format-only (reduced build)
BAD  branch      git-branch=main
```

Every field matches except `git-branch`, and that one is explained rather
than concerning: this build checked out a detached commit, so git reports
`HEAD`; a branch checkout at the same commit reports `main`. Same tree, same
commit, same compiler flags - a checkout-state label, not a build
difference.

Then the rebuilt runtime was asked to do the actual job: load
`silero_vad_half.ort` and run the same 512-sample, `[2,1,128]`-state
inference `vad.mjs` makes.

|  | shipped | rebuilt |
|---|---|---|
| silence | 0.04426264762878418 | 0.04426264762878418 |
| noise | 0.02436661720275879 | 0.02436661720275879 |
| state shape | [2, 1, 128] | [2, 1, 128] |

Bit for bit identical. Between the exact commit, the exact flags, and
identical inference output on the real model, this is as complete a
reproduction as the shipped binary's own self-attestation permits.

**The one thing this does not reproduce is size.** The rebuild is 4,016,081
bytes against the shipped 1,037,262 - about 4x larger - because this build
used only `--minimal_build` and `--disable_ml_ops`; the shipped binary was
further restricted to a specific set of ONNX operators via
`--include_ops_by_config`, and which ops were in that list is not recoverable
from the binary's stamp. That is the one open question left on this file, and
it is about a build parameter, not about what the binary is or whether it
works - both of which are now settled.

**The glue.** `ort-wasm-simd-threaded.mjs` is 23,512 bytes against the 24,618
onnxruntime-web 1.20.0 publishes, and the two differ only in minified
identifiers (`h` where upstream has `g`) around identical structure. So it is
not hand-written or hand-minified: it is the emscripten output of the same
build that produced the wasm, which is what it should be. Glue and wasm pair
correctly with each other.

`ort.wasm.mjs`'s one `UNSAFE_VAR_ASSIGNMENT` (`await import(url)`, `webpackIgnore`d) is generated too: `dynamicImportDefault`, part of
onnxruntime-web's own proxy-worker mechanism, importing a module from a URL
that was itself built two lines earlier from a same-origin `fetch` and
`URL.createObjectURL`. Generated emscripten/onnxruntime-web glue is not
something to hand-patch line by line - the correct lever, if this needed to
change, is the build flags in `reproduce-ort-wasm.sh` and the npm release
pin, both already the subject of the reproduction above. Left as generated.

**The pairing, now actually run.** `ort.wasm.mjs` is generated from the
published onnxruntime-web 1.20.0, while the glue and wasm come from main two
months earlier. A release loader driving a pre-release runtime is exactly the
combination that fails quietly, and nothing had ever executed it - the VAD is
reached only from `AudioAnalyzerNode`, behind subtitle syncing.

`tests/e2e/ext-specs/vad.e2e.mjs` now runs it on the extension origin, under
the real CSP: create an `InferenceSession` from the `.ort`, feed it 512 samples
and a zeroed `[2,1,128]` state, exactly as `vad.mjs` does.

| | |
|---|---|
| input names | `input`, `state` |
| output names | `output`, `stateN` |
| silence | `0.0443` - correctly not speech |
| noise | `0.0244` - different, so the model reads its input |
| returned state | `[2,1,128]` |

It works. That retires the concern rather than arguing it away.

**The glue's own upstream.** `vad/vad.mjs` derives from ricky0123/vad-web:
the `Silero` and `FrameProcessor` classes, `modelFetcher`,
`frameSamples: 512`, `positiveSpeechThreshold: 0.5` and `redemptionFrames: 8`
are all that project's. It ships `.onnx` too, never `.ort`, which confirms the
conversion is FastStream's own step.

It cannot be pinned to a release, and after trying, it should not be. vad-web
publishes a webpack bundle plus per-module CommonJS files; the vendored file
is neither. It is a 275-line ES module that keeps the three classes it needs
and drops the microphone capture, the worklet plumbing and the packaging that
make up most of the original. Declaration matching finds no shared top-level
declarations with any of 0.0.19, 0.0.20, 0.0.22 or 0.0.24 - not because the
lineage is in doubt but because the file was restructured rather than copied.

That puts it in a different category from the binaries above, and a better
one. It is unminified, readable JavaScript a reviewer can simply read - 275
lines with no build step between the source and what ships. The risk that
motivated this whole document is code nobody can check; this is code anybody
can. Recording where it came from is the right treatment, and generating it
is not available.

**Still open.** One thing: reproducing the wasm from the command above. That
is provenance, not correctness - the feature is proven to work.

### vtt.js: provenance proven, and re-checkable on demand

This one was expected to be the awkward case and turned out to be the
cleanest. The starting assumption in this document was wrong twice over: the
file is not a bundle of videojs/vtt.js's published `lib/`, and it is not
0.13.0.

The bundle's internal module map gives it away. It requires
`./process/parse-content.js`, `./parser/parser.js`, `./box-position.js` and
eighteen others - a nested layout that videojs/vtt.js does not have; its `lib/`
is six flat files. The layout belongs to the build **dash.js** maintains at
`contrib/videojs-vtt.js/vtt.js`, which is byte-identical across dash.js v4.7.4
through v5.1.0.

`chrome/player/modules/vtt.mjs` is that file with exactly three changes:

| Change | Why |
|---|---|
| `FONT_SIZE_PERCENT` 0.25 -> 0.05 | subtitles rendered at a fifth of dash.js's default size relative to the container |
| `processCues(window, cues, overlay, parentId)` loses `parentId` | dash.js added that parameter for its own container; FastStream did not take it |
| `if (parentId) { paddedOverlay.id = parentId; }` removed | the body of the same dash.js addition |

plus `export const WebVTT = window.WebVTT;` appended so a bundle that assigns
to a global can be imported. Note that two of the three are *removals* of
dash.js's additions - FastStream's copy is closer to videojs/vtt.js than
dash.js's own is.

Apply those to the upstream file and the result parses to the **same program**
as the vendored one.

It cannot be generated at build time: videojs/vtt.js publishes only `lib/*` to
npm, and dash.js's npm package ships only the minified `vtt.min.js`, not this
bundle. So it is *verified* instead of generated. `pnpm run verify:vtt` fetches
the upstream file, applies the three changes and asserts AST equality, and
fails with the exact point of divergence if anything moves. That is the
difference between a claim in a document and a claim a reviewer can re-run -
and it is mutation-tested, so a wrong expectation fails rather than passing
quietly.

`tools/ast-compare.mjs` is the shared normaliser this uses, now a real module
rather than a throwaway script: it undoes `one-var`, `curly`, `quotes`,
`no-var`/`prefer-const` and template-literal re-indentation, so what survives
is only what can change behaviour.

**Its one `UNSAFE_VAR_ASSIGNMENT`** is `TEXTAREA_ELEMENT.innerHTML = s;`
inside `unescape(s)`, decoding HTML entities in cue text by writing to a
detached `<textarea>` and reading `.textContent` back. This is not a
sanitizer that might be wrong, it is safe by construction: the HTML spec
gives `<textarea>` an RCDATA content model, so assigning to its `innerHTML`
can never create an element or run a script no matter what the string
contains - the entire value always becomes exactly one text node. Confirmed
that addons-linter cannot be told this either: an inline
`// eslint-disable-next-line no-unsanitized/property` on this exact line was
tested and made no difference to the warning count, so whatever runs this
check does not honour inline directives (a sensible choice for a review
tool, since otherwise a maintainer could always just disable the finding).
`DOMParser().parseFromString(s, 'text/html')` was considered as an
alternative and rejected: unlike a textarea's RCDATA parsing, `'text/html'`
parsing genuinely constructs real elements (just detached from any
document), which is a weaker guarantee resting on browsers not fetching
resources for a detached document rather than on what the parser is
spec-required to produce. Left as upstream ships it.

### webm.mjs is generated from jswebm's published sources

`reencoder/webm.mjs` was readable `class Track { ... }` source ending in
`window.JsWebm = JsWebm;`, whereas jswebm's npm package ships a minified
webpack bundle in `dist/`. So the vendored file was jswebm's `src/` directory
concatenated into one ES module - the same shape as mp4box.

That turned out to be good news, because jswebm publishes `src/` in the npm
tarball alongside the bundle. Comparing declaration by declaration with
`tools/compare-decls.mjs` settled it immediately: **30 of the 35 top-level
declarations were already byte-for-byte identical** to jswebm@0.1.2's sources
once eslint's autofixes were normalised away. Nothing about that is a
judgement call - either a declaration parses to the same tree or it does not.

So webm.mjs is now generated, on the same model as hls.js: the npm tarball
plus `patches/jswebm@0.1.2.patch`. Five changes are FastStream's, and a
reviewer reads them in the patch instead of taking a 104 KB file on trust:

| Change | Where | Why it matters |
|---|---|---|
| `MasteringData` and `Colour` classes added | `Track.js` | parses Matroska colour metadata, which upstream skips over |
| `case 0x55B0` builds a `Colour` | `VideoTrack.js` | upstream read the element as an integer and discarded it |
| `initVp8Headers` / `initVp9Headers` added | `JsWebm.js` | derives a full `vp09.00.10.08…` codec string; WebCodecs rejects a bare `vp9` |
| the three Vorbis setup headers are not pushed as packets | `JsWebm.js` | FastStream hands `codecPrivate` to WebCodecs itself |
| `demux()` returns whether it advanced | `JsWebm.js` | `WebMDemuxer.process()` is `while (this.demuxer.demux())` |
| `keyframe` → `keyFrame`, track looked up by number, frame length validated, `isKeyframe` on audio packets | `SimpleBlock.js` | upstream *writes* `this.keyframe` and *reads* `this.keyFrame`, so every chunk was `delta` |

The last two rows are upstream bugs rather than product changes, which is
worth saying plainly: this is a maintained fork, not a mangled copy.

After the migration all 35 declarations match. The generated file additionally
contains upstream's `UNSET` constant, which the hand-made concatenation had
dropped; it appears exactly once in the file - its own declaration - so it is
dead code, and keeping upstream's own line is preferable to inventing a rule
that deletes it.

One cost worth stating: jswebm lists `@babel/preset-env`, `lodash`,
`circular-json` and `eslint-utils` as *runtime* dependencies rather than dev
ones, which is a packaging mistake on its author's part and pulls about a
hundred packages into the dev tree. None of it ships - the build reads
`node_modules/jswebm/src/*.js` as text and nothing ever imports the package -
and the lockfile still passes the supply-chain check. It is a slower install
in exchange for a hash-verified base, which is the right way round.

`src/Chapters.js` and `src/Queue.js` stay out: the vendored file never
included them and nothing references them.

**Tested, not assumed.** `tests/e2e/specs/modules.e2e.mjs` demuxes a real VP9
file through `WebMDemuxer` and asserts the codec string, the dimensions, the
chunk count and that at least one chunk is a keyframe - which covers every
row of the table above. Removing `demux()`'s return makes it fail, verified
by doing exactly that. The fixture is transcoded from the MP4 one with ffmpeg
on first run, so no binary enters the repository.

### coloris: generated from a pinned commit, with an 11 KB patch

Two earlier claims here were wrong, and both came from searching the wrong
thing rather than from ranking the results wrongly.

First, the base was searched against `src/coloris.js`. The vendored copy uses
`var` and ends `}();`, which is babel output - it comes from
**`dist/coloris.js`**, which mdbassit builds with babel and gulp.

Second, ranking by whole-file AST size put v0.25.0 first. That is the key
failing: the vendored file is larger than *every* release, so "newest" and
"nearest" become the same answer for the wrong reason. Matching
**declaration by declaration** separates them:

| Release | Declarations identical |
|---|---|
| v0.19.0 | 29 |
| v0.20.0 | 30 |
| **v0.21.1** | **31** |
| v0.22.0 | 31 |
| v0.23.0 | 30 |
| v0.24.0 | 30 |
| v0.25.0 | 29 |

v0.21.1 and v0.22.0 tie, and one line breaks it: v0.22.0 added
`ready: DOMReady` to the exported object, which the vendored file does not
have.

**mdbassit/Coloris is not on npm** - the package literally named `coloris` is
an unrelated project and `@melloware/coloris` is a different fork - so it is
pinned as a git dependency instead. pnpm records the commit and a tarball
integrity hash in the lockfile:

```
Coloris@https://codeload.github.com/mdbassit/Coloris/tar.gz/0898dae84c3b5c538edafc557c2a671b7f230825
  integrity: sha512-pWMXd/4JNXN2L4+oY3m9KPcxf+yVQCE0f1zyLltOjG2596I++b4HnnX9gxc6csbidjwDJ0oJZESOVoLtIKZGug==
```

That is the same guarantee a registry version gives a reviewer: a fixed
artifact they can fetch and hash themselves.

FastStream's changes are in `patches/Coloris@0.21.1.patch`, 11 KB (grew from
9 KB after the `textContent` changes described below), and they
are not the cosmetic rebinding the earlier note described. They are three
features:

| Change | What it is |
|---|---|
| `document` → `container` at 19 call sites, plus `container.ownerDocument` where a real Document is needed | scopes the picker to the player's own subtree instead of the page |
| `init()` moved into `configure`'s `case 'parent'`, `container = undefined` dropped from `init`, `DOMReady(init)` disabled | the picker is built into its container when configured, not at DOMReady |
| a new `bindElement(element)`, and `case 'el'` removed from `configure` | binds one element directly instead of a selector, which is what `SubtitlesSettingsManager` needs |
| keyboard control for the hue and alpha sliders, `stopPropagation` on trapped keys, and capture-phase delegated listeners | the picker lives inside a video player that binds arrow keys and Tab of its own |

The module shape - unwrapping the UMD and exporting `Coloris` and
`bindElement` - is in `sync-vendor.mjs`, not the patch, so the package in
`node_modules` stays a valid script.

Applying all of it reproduces the vendored file exactly: **43 of 43
declarations identical, and the whole file parses to the same program.**

**One bug fixed on top.** The fork had rewritten `DOMReady` to attach its
`DOMContentLoaded` listener to `container` rather than `document`. An element
never receives `DOMContentLoaded`, and `container` is `undefined` until a
parent is configured, so any Coloris call made while the document was still
parsing would throw `TypeError: container is undefined`. It survived because
FastStream's scripts run after parsing, which makes the branch unreachable in
practice - a latent crash rather than a live one. That line is restored to
`document`, and it is now the single deliberate difference from the file this
replaces: **42 of 43 declarations identical, one fixed.**

**Tested.** `tests/e2e/specs/modules.e2e.mjs` drives the player's own picker
the way `InterfaceController` does, and asserts it renders into `.mainplayer`
rather than the document, opens on click, and writes the chosen colour back
to the bound input. Removing the patched `init()` call makes it fail,
verified by doing exactly that.

**A second pass did change the warning count.** coloris originally accounted
for 7 of the 12 addons-linter warnings, all `UNSAFE_VAR_ASSIGNMENT` on
`innerHTML` writes - upstream's code, present whether the file is vendored or
generated, since addons-linter grades the code, not where it came from. Five
of the seven turned out to be genuinely static: `clearButton.innerHTML =
settings.clearLabel`, `closeButton.innerHTML = settings.closeLabel`, and the
two `a11y.open`/`a11y.swatch` label writes all read from Coloris's own
built-in defaults (`'Clear'`, `'Close'`, plain-text a11y labels) - confirmed
by checking FastStream's actual call in `InterfaceController.mjs`, which
passes `parent`, `theme`, `themeMode`, `formatToggle`, `swatches`, `alpha`,
and `focusInput`, never `clearLabel`/`closeLabel`/`a11y`. `patches/
Coloris@0.21.1.patch` now also rewrites those four sites (one call site is
hit twice) from `innerHTML` to `textContent` - an exact behavioural match for
plain-text labels, and strictly safer if a future caller ever does pass a
dynamic value through them.

The remaining two - the swatch list built by joining per-colour HTML strings,
and the picker's own ~40-line template literal - build markup by
concatenation rather than static assignment, and **`textContent` is not a
valid swap for either.** Both assign actual HTML structure (`<div>` wrappers,
swatch buttons, the picker's inputs and sliders) - `textContent` doesn't
parse markup, so applying it here would render the literal tag text on
screen instead of the widget. Both are fed only FastStream's own hardcoded
values today (a fixed hex/rgb swatch array, and the library's own static
a11y defaults), but rewriting either into safe DOM construction is a
materially bigger change to code that renders the entire widget, so they are
left as they are rather than rewritten under time pressure.

Applying just the four-site rename was caught doing real damage once:
recreating the patch via a second `pnpm patch` / `pnpm patch-commit` cycle
starting from a *pristine* copy silently produced a patch containing only the
new change, dropping every earlier hunk (`bindElement` included) - `pnpm
patch` hands you the pristine package, not the already-patched one, so
anything added this way must be layered onto a copy the existing patch has
already been applied to, not assumed. The full `pnpm run test:e2e` suite
caught it immediately: the colour-picker test and, because
`InterfaceController` calls `Coloris(...)` during its own construction and an
uncaught `ReferenceError` there aborted the rest of player setup, all three
playback tests failed too. Re-applying the existing patch with `patch -p1`
before layering the new change on top, then confirming both `bindElement` and
`textContent` are present in the resulting diff, fixed it - verified by
rerunning the exact tests that had failed.

What the migration changes is the thing that actually got the add-on
refused: a reviewer can now fetch a pinned commit, hash it, and read a 9 KB
diff, instead of being asked to trust 40 KB of unattributed JavaScript.

### sweetalert2 ships a payload that must stay removed

Worth stating plainly, because taking the npm file naively would have
reintroduced it. Upstream sweetalert2 contains:

```js
if (typeof window !== 'undefined' && /^ru\b/.test(navigator.language) &&
    location.host.match(/\.(ru|su|by|xn--p1ai)$/)) {
  ...
  document.body.style.pointerEvents = 'none';
  var ukrainianAnthem = document.createElement('audio');
  ukrainianAnthem.src = 'https://flag-gimn.ru/wp-content/uploads/2021/09/Ukraina.mp3';
  ukrainianAnthem.loop = true;
```

For users whose browser language is Russian on a .ru/.su/.by/.xn--p1ai host,
it makes the page unusable and loops remote audio. Andrew had removed it from
the vendored copy. Three separate reasons it must stay removed: it loads
remote media from a third-party host at runtime, which fails AMO review on its
own; it disables interaction with whatever page the extension is injected
into; and it triggers on the user's locale rather than on anything they did.

`tools/sync-vendor.mjs` strips it by brace matching rather than a line range,
so it survives upstream reformatting, and the build is checked for its
absence.

### sweetalert2's DANGEROUS_EVAL: dead code, and provably so

sweetalert2 supports configuring a popup declaratively through a `<template>`
element instead of the JS options object - `<swal-function-param name="..."
value="...">` children let a page-author-supplied string become a real
function value, which HTML attributes cannot hold any other way. Doing that
needs `new Function(value)()`, and that call is what addons-linter flags.

Two independent things make this dead code in FastStream, not just
low-risk. First, `getTemplateParams` bails to `{}` before ever reaching it
unless `params.template` is set, and grepping the whole codebase for
`swal-function-param` or any `<template>`-based Swal config turns up
nothing - FastStream always calls the plain JS options API. Second, even if
that were wrong, `build_firefox_amo/manifest.json`'s CSP is `script-src
'self' 'wasm-unsafe-eval'` - no `'unsafe-eval'` - so `new Function(...)`
would throw a CSP violation the instant it executed, in this extension,
regardless of caller.

Patched (`patches/sweetalert2@11.12.4.patch`) to throw a message explaining
why instead of calling `new Function`, rather than leaving the call in
place. The throw is exactly as unreachable as the original call was - this
removes the AST pattern, not a working feature - and makes the reason
explicit for anyone who goes looking, instead of a silent behaviour change.

Caught two of my own mistakes verifying this one, both fixed before
committing: the first patch attempt put an apostrophe inside a
single-quoted JS string (`'this build's CSP'`), which is a syntax error,
not a lint warning - `pnpm run lint:amo` turned the fixed warning into a
worse `JS_SYNTAX_ERROR` and caught it immediately. Second, reopening the
patch to fix that via `pnpm patch sweetalert2@11.12.4` handed back the
*already-patched* (broken) file this time, not a pristine copy - the
opposite of what the same command did for Coloris earlier - so the state
handed back by `pnpm patch` was checked directly rather than assumed
either way, both times.

### mp4box - measured, migrated, then reverted

Two corrections happened here, and both are worth recording.

**First**, an early pass concluded mp4box "is not a published dist" and was
concatenated from source. That was wrong: the version search had only tested
the ten most recent releases, which are all 2.x, and mp4box was rewritten for
2.0, so every one differs by ~16,000 lines. The search reported a floor and it
was read as a match. Testing the 0.x line is unambiguous - **base is 0.5.3**,
at 238 differing lines against 617 for 0.5.2 and 711 for 0.5.4.

**Second**, migrating to 0.5.3 was committed on the strength of that
measurement and a claim that it was safe because it only *added* two box
parsers. The end-to-end suite then failed MP4 playback, and swapping the two
files back and forth confirmed it: **the vendored copy plays, 0.5.3 does
not.** The migration was reverted.

The intermediate "the old file fails too, so the migration is exonerated"
conclusion was itself wrong - it was confounded by a 416 bug in the test
server, which was answering FastStream's overshooting Range requests with
"Range Not Satisfiable" instead of clamping them. Both files failed for that
unrelated reason, which looked like exoneration.

**Third**, the bisect was run, and it did not need mp4box's git history at
all - only a tool that could see the file properly.

`compare-decls` reported "2 declarations differing" and that was misleading,
because mp4box declares twelve things and then hangs **339 assignments** off
them. `declarations()` never looked at those. Adding `prototypeAssignments()`
changes the picture completely:

```
declarations   identical 12   differing 2   MPEG4DescriptorParser, ISOFile
assignments    identical 332  differing 4   BoxParser.Box.prototype.writeHeader
                                            ISOFile.prototype.buildTrakSampleLists
                                            ISOFile.prototype.getSample
                                            ISOFile.prototype.flattenItemInfo
               only ours 3                  ISOFile.prototype.getSampleList
                                            ISOFile.prototype.items
                                            ISOFile.prototype.entity_groups
```

332 of 339 assignments identical settles the base: this really is 0.5.3-era
code. The seven that are not are the migration's actual work list, and one of
them explains everything:

**`ISOFile.prototype.getSampleList` exists only in the vendored copy, and
`modules/dash2mp4/mp4merger.mjs:66` calls it.** It is a FastStream addition.
Replacing the file with stock 0.5.3 deletes a method the product calls.

The experiment was re-run from scratch against the current test server - the
one whose 416 bug confounded the original attempt - and the earlier conclusion
holds: **stock 0.5.3 fails `plays MP4 (mp4box)`, the vendored copy passes.**
Reverting only the `MPEG4DescriptorParser` change and keeping everything else
at 0.5.3 still fails, which rules that difference out and puts the cause in
`ISOFile`. For the record, that descriptor change is upstream *fixing* a bug:
the vendored loop does `size = (byteRead & 0x7F) << 7`, overwriting on every
byte, where 0.5.3 accumulates with `size = (size << 7) + (byteRead & 0x7F)`.

**Fourth**, the migration was done, and the patch needs **five** of those
seven, not all of them.

Each candidate was built and run against `plays MP4 (mp4box)`:

| Applied | Result |
|---|---|
| `getSampleList` alone | fails |
| `getSample` + `getSampleList` | fails |
| `buildTrakSampleLists` + `getSampleList` | **passes** |
| all seven | passes |
| all but `items` and `entity_groups` | **passes** |

So `buildTrakSampleLists` is the one playback depends on. `items` and
`entity_groups` turn out to be **0.5.2-era leftovers, not fork changes**: 0.5.3
initialises both in the `ISOFile` constructor, which is also the better place -
a `prototype`-level array is shared by every instance. They are dropped.

The other three - `writeHeader`, `getSample`, `flattenItemInfo` - are kept even
though playback passes without them. They differ from **both** 0.5.2 and 0.5.3,
so they are deliberate fork changes, and the paths that would exercise them
(download, merge, image items) have no end-to-end coverage. Dropping them
because one test still passes is the exact reasoning that shipped the original
regression.

`MPEG4DescriptorParser` is **not** in the patch: that difference is upstream
fixing a real bug, and 0.5.3's version is taken.

The generated file is structurally identical to the candidate that was tested -
337 declarations and assignments, zero differences - and against the old
vendored copy every one of the 337 assignments matches, the only changes being
the two dropped leftovers and the two declarations that carry the descriptor
fix and the constructor initialisation.

So mp4box is now **generated** from `mp4box@0.5.3` plus
`patches/mp4box@0.5.3.patch`, like hls.js and dash.js. 318 KB of unattributed
JavaScript becomes a published tarball plus a 37 KB patch of five named
changes.

- `players/mp4/MP4Player.mjs` and `modules/dash2mp4/mp4merger.mjs` import
  `{MP4Box, DataStream}`; the vendored file exports them directly and drops
  the trailing CommonJS block

Two lessons generalise. A library migration is not "provably inert" because
its diff looks additive - only the end-to-end suite settles it. And a
comparison tool that reports a small number is not the same as a small
difference: check that the tool can see the shape of the file it is reading.

## The two that stay vendored

vtt.js and knob total 116 KB. Neither can be generated from a published
artifact, and each for a different reason. Documenting their provenance
precisely is what a reviewer actually needs; adding a bundler to the build to
produce them from pinned commits would replace one unverifiable artifact with
another, since the reviewer would then have to trust our build pipeline
instead of Andrew's.

### vtt.js — 88 KB

Provenance is **proven and re-runnable**; see
"vtt.js: provenance proven, and re-checkable on demand" above, and run
`pnpm run verify:vtt`.

Two claims this document previously made here were wrong, and are recorded
because they show how the wrong answer was reached. It said the base was
**0.13.0** and that the file was a browserify bundle of videojs/vtt.js's
`lib/`. Both came from a line-count search across videojs/vtt.js releases,
which will always return a nearest release even when the true base is not in
the set at all. The bundle's own module map settles it: it requires
`./process/parse-content.js`, `./parser/parser.js` and eighteen more nested
paths that videojs/vtt.js's six flat `lib/` files do not have. The file is
**dash.js's `contrib/videojs-vtt.js/vtt.js`**, byte-identical across dash.js
v4.7.4 through v5.1.0, plus three changes and an export line.

Imported by `SubtitleTrack.mjs` and `ui/subtitles/SubtitlesManager.mjs`.

### knob — 28 KB, verified on demand

Base pinned: **jherrm/knobs `Knob.js` at `cf2db70f`** (2012-05-16), found with
`tools/find-base.mjs --commits`. Not the repository's head: the 2022 commit is
a third larger and matches far worse.

It cannot be generated - the repository has **no `package.json`**, so no
package manager can install it, and there is no npm release to pin. So it is
verified instead, the same way vtt.js is. `pnpm run verify:knob` fetches
`Knob.js` at that commit and compares parsed declarations:

```
top-level identical    10 of 11
top-level ours only    Knob            (upstream keeps it inside an IIFE)
top-level differing    members
members identical      33 of 39
members changed        val, doMouseScroll, __validateAndPublishAngle,
                       __angleFromValue, __publish
members added          __validateAndPublishValue, __validateValue,
                       __valueFromAngles
members removed        __determineValue  (renamed to __valueFromAngles)
```

Every one of those differences is in the list below, and the script fails if a
single one appears that is not - it does not check a count, it checks the
exact sets. Mutation tested: injecting one statement into `setDimensions`
moves it into `members changed` and exits 1.

That is a stronger claim than a patch would give. A patch says "here is what we
changed"; this says "here is what we changed, and nothing else changed", and
re-checks it against upstream on demand.

The npm package named `knob` is `mmckegg/knob`, an unrelated canvas widget,
and jherrm/knobs is not published to npm at all.

Almost all of the 278-line diff is this project's eslint autofix. The real
changes are ten, and they make it an adapted, maintained fork rather than a
transformed copy:

- the IIFE wrapper is removed and `Knob` is exported
- the constructor takes `(inputEl, callback)` instead of `(callback, options)`,
  stores the element, and throws without one; the options-merge loop and the
  `valueMin < valueMax` check are dropped with it
- a scroll gesture is added: `gestureScrollEnabled`, `angleScrollRatio`, and
  `doMouseScroll` honouring both
- HTML-slider defaults: `valueMin: 0`, `valueMax: 100`, a new `value: 0`, and
  `angleSlideRatio` 1 → 2
- `val(value)` sets by value rather than by angle, and accepts `0`
- `__determineValue` becomes `__valueFromAngles`, with a new `__validateValue`
- `__publish` writes `element.value` and dispatches a `change` event, and the
  callback loses its `angle, value` arguments
- `__angleFromValue` is a genuine **upstream bug fix**: the original tested
  `isFinite` on the angle bounds while mapping the value bounds, and
  referenced an undefined `valueMax`

Upstream: https://github.com/jherrm/knobs

### If this is ever revisited

The stronger version of this is to add each as a pinned git dependency, so
the lockfile records a commit hash, and bundle at build time. That gives a
reviewer a hash to check rather than a prose description. It costs a bundler
in the build and is worth doing only if a reviewer asks - for 153 KB across
three small, stable libraries, the documentation above is the better trade.

## youtube.js

Not shipped to AMO, so it is out of scope for that submission. `NO_YOUTUBE`
(`build.mjs`, `buildFirefoxAmo()`) splices `yt.mjs`, `googlevideo.mjs`,
`YTPlayer`, the sandboxed evaluator, and `yt_runner.js` out of that target
entirely - a decision project made deliberately, to keep the store build
small and easy to review rather than take on YouTube's anti-bot arms race
inside a listed extension. Confirmed empirically: `build_firefox_amo`
contains no file matching `yt*.mjs` or `googlevideo.mjs` after a real build.

It still ships in the GitHub self-host build (`buildFirefoxGithub()`,
`buildChromeGithub()`), where it remains an unmeasured ~33,000-line vendor
of `youtubei.js` (github.com/LuanRT/YouTube.js). Andrew maintains his own
fork at github.com/Andrews54757/YouTube.js and pulls version bumps in
wholesale (see the file's own commit history: "Update Youtube.js to v8.0.0",
"Update ytjs", etc.), same shape as hls.js/dash.js but far bigger.

If this is ever revisited: `yt.mjs`'s embedded `packageInfo.version` reads
`17.0.1`, and `youtubei.js@17.0.1` is a real published npm version - but a
module-inventory diff against that exact tarball's `bundle/browser.js`
(639 modules) against the vendored file (618 modules) shows they are close
but not identical: 613 modules are shared, and 5 - including
`bgutils/BGUtils.js` and `bgutils/SandboxedEvaluator.js` - exist only in the
vendored file. That means the real base is a specific commit on Andrew's
fork past the `17.0.1` npm tag, not the tag itself, and finding it would be
the first step before a patch could be written. Not attempted, since the
file isn't in the AMO build this documentation is scoped to.

Unrelated to the splice, the AMO manifest drops the `contextualIdentities`
permission (`build.mjs`, `buildFirefoxAmo()`). Mozilla's schema scopes that
permission to the `browser.contextualIdentities` namespace - querying and
editing container definitions - and nothing in the project calls it.
Requesting a permission nothing uses is what an AMO reviewer stops on.

`cookies` was very nearly dropped alongside it and must not be: the
`DOWNLOAD` handler in `background.mjs` reads `sender.tab.cookieStoreId` and
passes it to `tabs.create()`, so that a download started from a container
tab opens in that same container. Firefox gates `cookieStoreId` on the
`cookies` permission - the bundled schema says so outright on
`downloads.download` - so removing it silently breaks container downloads
while leaving every test green. The first pass at this did remove it, on
the strength of a grep for `.cookies.` that `cookieStoreId` does not match.
