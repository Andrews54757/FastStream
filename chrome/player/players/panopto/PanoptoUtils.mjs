/**
 * Stitches Panopto's separately-encoded streams into a single HLS presentation.
 *
 * Panopto delivers each stream (primary/audio, screen, camera, ...) as its own HLS
 * encode. The encodes are independent: a screen capture may run for hours while the
 * delivered session is only an hour, and `RelativeSegments` says which window of the
 * encode the session actually maps to. Each encode's fMP4 `tfdt` decode times are
 * relative to that encode's own start, so two streams that should play together can be
 * thousands of seconds apart on the wire.
 *
 * hls.js derives `initPTS` from the main (video) track only and applies it to alternate
 * audio renditions, so the raw decode times of every stream we combine must already sit
 * on one shared timeline. These helpers trim each media playlist to its session window
 * and rebase its `tfdt` boxes so that they do.
 *
 * Everything here is free of DOM and network dependencies so that it can be exercised
 * directly against real Panopto manifests.
 */

const SOURCE_URL_PREFIX = 'data:application/x-panopto+json,';
const PLAYLIST_URL_PREFIX = 'data:application/vnd.apple.mpegurl,';

const VIDEO_CODEC_REGEX = /^(avc|hvc|hev|dvh|vp0|vp8|vp9|av01)/i;
const AUDIO_CODEC_REGEX = /^(mp4a|ac-3|ec-3|opus|mp3|alac|flac|dts)/i;

const AUDIO_GROUP_ID = 'panopto-audio';
// Marks the URLs of the audio-only view of a muxed stream. A fragment identifier never
// reaches the server, so the rendition and the stream it is taken from stay one
// resource while remaining two things to the player and to the download cache.
const AUDIO_RENDITION_MARKER = '#panopto-audio-only';
const MUXED_AUDIO_GROUP_ID = 'panopto-muxed-audio';

/**
 * A parsed HLS media playlist, retaining enough structure to re-emit a trimmed copy.
 */
export class PanoptoMediaPlaylist {
  constructor() {
    this.headerLines = [];
    this.mapLine = null;
    this.map = null;
    this.mediaSequence = 0;
    this.segments = [];
    this.totalDuration = 0;
  }

  /**
   * Parses a media playlist.
   * @param {string} text - The playlist body.
   * @return {PanoptoMediaPlaylist} The parsed playlist.
   */
  static parse(text) {
    const playlist = new PanoptoMediaPlaylist();
    const lines = text.split('\n');

    let pendingDuration = 0;
    let pendingByteRange = null;
    let pendingTags = [];
    let time = 0;
    // Byte ranges may omit the offset, in which case they continue from the previous
    // range against the same resource.
    const nextImplicitOffset = new Map();

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line === '') continue;

      if (line.startsWith('#EXTINF:')) {
        pendingDuration = parseFloat(line.substring(8).split(',')[0]) || 0;
      } else if (line.startsWith('#EXT-X-BYTERANGE:')) {
        pendingByteRange = parseByteRange(line.substring(17));
      } else if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
        playlist.mediaSequence = parseInt(line.substring(22), 10) || 0;
      } else if (line.startsWith('#EXT-X-MAP:')) {
        playlist.mapLine = line;
        playlist.map = parseMapTag(line);
      } else if (line.startsWith('#EXT-X-DISCONTINUITY') || line.startsWith('#EXT-X-KEY:') || line.startsWith('#EXT-X-PROGRAM-DATE-TIME:')) {
        pendingTags.push(line);
      } else if (line.startsWith('#EXTM3U') || line.startsWith('#EXT-X-ENDLIST')) {
        // Re-emitted on serialize.
      } else if (line.startsWith('#')) {
        if (playlist.segments.length === 0) {
          playlist.headerLines.push(line);
        }
      } else {
        if (pendingByteRange && pendingByteRange.offset === null) {
          pendingByteRange.offset = nextImplicitOffset.get(line) || 0;
        }
        if (pendingByteRange) {
          nextImplicitOffset.set(line, pendingByteRange.offset + pendingByteRange.length);
        }

        playlist.segments.push({
          uri: line,
          duration: pendingDuration,
          start: time,
          end: time + pendingDuration,
          byteRange: pendingByteRange,
          tags: pendingTags,
        });

        time += pendingDuration;
        pendingDuration = 0;
        pendingByteRange = null;
        pendingTags = [];
      }
    }

    playlist.totalDuration = time;
    return playlist;
  }

  /**
   * Finds the index of the last segment starting at or before the given media time.
   * @param {number} mediaTime - Time within this playlist's own timeline.
   * @return {number} A segment index, clamped into range.
   */
  indexAtTime(mediaTime) {
    if (this.segments.length === 0) return 0;

    let low = 0;
    let high = this.segments.length - 1;
    let found = 0;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.segments[mid].start <= mediaTime) {
        found = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return found;
  }

  /**
   * Re-emits the playlist covering only `[startIndex, endIndex]`.
   *
   * Byte range offsets are always written explicitly, since dropping leading segments
   * invalidates the implicit-offset chain.
   *
   * @param {number} startIndex - First segment to keep.
   * @param {number} endIndex - Last segment to keep, inclusive.
   * @param {number} [firstSegmentPad] - Seconds to add to the first kept segment's
   *     declared duration. hls.js always starts a playlist's timeline at zero, so this
   *     is how a stream that begins partway into the presentation says so.
   * @return {string} The trimmed playlist body.
   */
  serialize(startIndex, endIndex, firstSegmentPad = 0, uriSuffix = '') {
    const kept = this.segments.slice(startIndex, endIndex + 1);
    const lines = ['#EXTM3U'];

    for (const header of this.headerLines) {
      lines.push(header);
    }

    lines.push(`#EXT-X-MEDIA-SEQUENCE:${this.mediaSequence + startIndex}`);

    if (this.mapLine) {
      lines.push(uriSuffix ?
          this.mapLine.replace(/URI="([^"]*)"/, (match, uri) => `URI="${uri}${uriSuffix}"`) :
          this.mapLine);
    }

    kept.forEach((segment, index) => {
      for (const tag of segment.tags) {
        lines.push(tag);
      }
      const duration = index === 0 ? segment.duration + firstSegmentPad : segment.duration;
      lines.push(`#EXTINF:${duration.toFixed(6)},`);
      if (segment.byteRange) {
        lines.push(`#EXT-X-BYTERANGE:${segment.byteRange.length}@${segment.byteRange.offset}`);
      }
      lines.push(segment.uri + uriSuffix);
    });

    lines.push('#EXT-X-ENDLIST');
    return lines.join('\n') + '\n';
  }
}

/**
 * Parses a `#EXT-X-MAP` tag into the resource it names.
 * @param {string} line - The whole tag line.
 * @return {{uri: string, byteRange: {length: number, offset: number}|null}|null} The map.
 */
function parseMapTag(line) {
  const uri = /URI="([^"]*)"/.exec(line);
  if (!uri) {
    return null;
  }

  const range = /BYTERANGE="([^"]*)"/.exec(line);
  const byteRange = range ? parseByteRange(range[1]) : null;
  if (byteRange && byteRange.offset === null) {
    byteRange.offset = 0;
  }

  return {uri: uri[1], byteRange};
}

/**
 * Parses a `#EXT-X-BYTERANGE` value.
 * @param {string} value - The tag value, `length[@offset]`.
 * @return {{length: number, offset: number|null}} The parsed range.
 */
function parseByteRange(value) {
  const parts = value.trim().split('@');
  return {
    length: parseInt(parts[0], 10) || 0,
    offset: parts.length > 1 ? (parseInt(parts[1], 10) || 0) : null,
  };
}

/**
 * Minimal ISO base media file format reader, used to find and rewrite decode times.
 */
export class MP4Boxes {
  /**
   * Iterates the boxes directly contained in `[start, end)`.
   * @param {DataView} view - View over the buffer.
   * @param {number} start - Start offset.
   * @param {number} end - End offset.
   * @param {Function} callback - Called with (type, contentStart, contentEnd, boxStart).
   */
  static walk(view, start, end, callback) {
    let offset = start;
    while (offset + 8 <= end) {
      let size = view.getUint32(offset);
      const type = String.fromCharCode(
          view.getUint8(offset + 4), view.getUint8(offset + 5),
          view.getUint8(offset + 6), view.getUint8(offset + 7),
      );
      let contentStart = offset + 8;

      if (size === 1) {
        if (offset + 16 > end) break;
        // 64-bit size. Buffers here are segment-sized, so the high word is always zero.
        size = view.getUint32(offset + 8) * 4294967296 + view.getUint32(offset + 12);
        contentStart = offset + 16;
      } else if (size === 0) {
        size = end - offset;
      }

      if (size < 8 || offset + size > end) break;

      callback(type, contentStart, offset + size, offset);
      offset += size;
    }
  }

  /**
   * Walks a nested box path, invoking the callback for each match of the final type.
   * @param {DataView} view - View over the buffer.
   * @param {number} start - Start offset.
   * @param {number} end - End offset.
   * @param {string[]} path - Box types, outermost first.
   * @param {Function} callback - Called with (contentStart, contentEnd, boxStart) per match.
   */
  static walkPath(view, start, end, path, callback) {
    this.walk(view, start, end, (type, contentStart, contentEnd, boxStart) => {
      if (type !== path[0]) return;
      if (path.length === 1) {
        callback(contentStart, contentEnd, boxStart);
      } else {
        this.walkPath(view, contentStart, contentEnd, path.slice(1), callback);
      }
    });
  }

  /**
   * Reads every track's media timescale from an fMP4 initialization segment.
   *
   * A Panopto stream is usually a single track, but a primary stream that captured the
   * camera as well as the microphone is muxed, and its two tracks keep timescales of
   * their own.
   *
   * @param {ArrayBuffer} buffer - The init segment.
   * @return {Map<number, number>} Track ID to timescale, in track order.
   */
  static getTimescales(buffer) {
    const view = new DataView(buffer);
    const timescales = new Map();

    this.walkPath(view, 0, buffer.byteLength, ['moov', 'trak'], (trakStart, trakEnd) => {
      let trackId = null;
      let timescale = null;

      this.walkPath(view, trakStart, trakEnd, ['tkhd'], (start) => {
        const version = view.getUint8(start);
        trackId = version === 1 ? view.getUint32(start + 20) : view.getUint32(start + 12);
      });

      this.walkPath(view, trakStart, trakEnd, ['mdia', 'mdhd'], (start) => {
        const version = view.getUint8(start);
        timescale = version === 1 ? view.getUint32(start + 20) : view.getUint32(start + 12);
      });

      if (trackId !== null && timescale) {
        timescales.set(trackId, timescale);
      }
    });

    return timescales;
  }

  /**
   * Shifts a media segment's start time by `deltaSeconds`.
   *
   * This is what puts independently-encoded Panopto streams onto one timeline. The
   * buffer is modified in place; `trun` sample offsets are relative to the decode time
   * and so need no adjustment.
   *
   * Both places a segment records its start are rewritten. The `tfdt` is what players
   * decode from, but a `sidx` — which Panopto emits on every segment — carries its own
   * copy in its own timescale, and tools that remux from these segments may read that
   * one instead. Leaving the two disagreeing produces a file that plays back correctly
   * but converts wrongly.
   *
   * @param {ArrayBuffer} buffer - The media segment.
   * @param {number} deltaSeconds - Signed shift, in seconds.
   * @param {Map<number, number>} timescales - Track ID to media timescale.
   * @return {boolean} True if at least one start time was rewritten.
   */
  static shiftDecodeTime(buffer, deltaSeconds, timescales) {
    if (!deltaSeconds || !timescales || timescales.size === 0) return false;

    const view = new DataView(buffer);
    // A single-track segment need not name a track we recognize, so with only one
    // timescale on offer every box is rebased in that one.
    const only = timescales.size === 1 ? timescales.values().next().value : null;
    let patched = false;

    const shift = (start, version, offset, scale) => {
      const delta = Math.round(deltaSeconds * scale);
      if (version === 1) {
        const current = Number(view.getBigUint64(start + offset));
        view.setBigUint64(start + offset, BigInt(Math.max(0, current + delta)));
      } else {
        const current = view.getUint32(start + offset);
        view.setUint32(start + offset, Math.max(0, current + delta));
      }
      patched = true;
    };

    this.walkPath(view, 0, buffer.byteLength, ['sidx'], (start) => {
      // reference_ID occupies the four bytes before the segment index's own timescale.
      const scale = view.getUint32(start + 8) || only;
      if (scale) {
        shift(start, view.getUint8(start), 12, scale);
      }
    });

    this.walkPath(view, 0, buffer.byteLength, ['moof', 'traf'], (trafStart, trafEnd) => {
      // A track fragment names the track it belongs to, which is what tells a muxed
      // segment's audio from its video: the two are shifted by the same number of
      // seconds, but counted in different timescales.
      let scale = only;
      this.walkPath(view, trafStart, trafEnd, ['tfhd'], (start) => {
        scale = timescales.get(view.getUint32(start + 4)) || scale;
      });

      if (!scale) return;

      this.walkPath(view, trafStart, trafEnd, ['tfdt'], (start) => {
        shift(start, view.getUint8(start), 4, scale);
      });
    });

    return patched;
  }

  /**
   * Wraps already-serialized contents in a box.
   * @param {string} type - The four-character box type.
   * @param {Uint8Array[]} parts - The contents, in order.
   * @return {Uint8Array} The box.
   */
  static box(type, parts) {
    const length = parts.reduce((total, part) => total + part.byteLength, 0);
    const out = new Uint8Array(8 + length);

    new DataView(out.buffer).setUint32(0, out.byteLength);
    for (let i = 0; i < 4; i++) {
      out[4 + i] = type.charCodeAt(i);
    }

    let offset = 8;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.byteLength;
    }

    return out;
  }

  /**
   * Concatenates boxes into one buffer.
   * @param {Uint8Array[]} parts - The boxes, in order.
   * @return {ArrayBuffer} The buffer.
   */
  static join(parts) {
    const out = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));

    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.byteLength;
    }

    return out.buffer;
  }

  /**
   * Rewrites an initialization segment to describe only its audio track.
   *
   * A session whose audio was captured alongside a camera arrives muxed into that
   * stream, and a player can only take alternate audio from a rendition that has
   * nothing else in it — so the rest of the session would play silent. Serving that
   * stream a second time with its video taken out gives them their sound back.
   *
   * @param {ArrayBuffer} buffer - The initialization segment.
   * @return {{buffer: ArrayBuffer, trackId: number}|null} The rewritten segment and the
   *     track it kept, or null if it could not be rewritten.
   */
  static stripInitToAudio(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let moov = null;

    this.walk(view, 0, buffer.byteLength, (type, contentStart, contentEnd, boxStart) => {
      if (type === 'moov') {
        moov = {contentStart, contentEnd, boxStart};
      }
    });

    if (!moov) {
      return null;
    }

    const traks = [];
    this.walk(view, moov.contentStart, moov.contentEnd, (type, contentStart, contentEnd, boxStart) => {
      if (type !== 'trak') return;

      const trak = {boxStart, boxEnd: contentEnd, trackId: null, handler: null};
      this.walkPath(view, contentStart, contentEnd, ['tkhd'], (start) => {
        trak.trackId = view.getUint8(start) === 1 ? view.getUint32(start + 20) : view.getUint32(start + 12);
      });
      this.walkPath(view, contentStart, contentEnd, ['mdia', 'hdlr'], (start) => {
        trak.handler = readBoxType(view, start + 8);
      });
      traks.push(trak);
    });

    const audio = traks.find((trak) => trak.handler === 'soun');
    if (!audio || audio.trackId === null) {
      return null;
    }

    if (traks.length === 1) {
      return {buffer, trackId: audio.trackId};
    }

    const movie = [];
    this.walk(view, moov.contentStart, moov.contentEnd, (type, contentStart, contentEnd, boxStart) => {
      if (type === 'trak') {
        if (boxStart === audio.boxStart) {
          movie.push(bytes.subarray(boxStart, contentEnd));
        }
        return;
      }

      // The track extends box carries a default per track, so it loses the same one.
      if (type === 'mvex') {
        const kept = [];
        this.walk(view, contentStart, contentEnd, (childType, childStart, childEnd, childStartBox) => {
          if (childType === 'trex' && view.getUint32(childStart + 4) !== audio.trackId) return;
          kept.push(bytes.subarray(childStartBox, childEnd));
        });
        movie.push(this.box('mvex', kept));
        return;
      }

      movie.push(bytes.subarray(boxStart, contentEnd));
    });

    const rebuilt = [];
    this.walk(view, 0, buffer.byteLength, (type, contentStart, contentEnd, boxStart) => {
      rebuilt.push(type === 'moov' ? this.box('moov', movie) : bytes.subarray(boxStart, contentEnd));
    });

    return {buffer: this.join(rebuilt), trackId: audio.trackId};
  }

  /**
   * Rewrites a media segment to carry only one track's samples.
   *
   * The companion to {@link stripInitToAudio}: the other track's fragment and its bytes
   * are dropped, and what remains is repositioned, since sample offsets are measured
   * from the start of the movie fragment that just got smaller.
   *
   * @param {ArrayBuffer} buffer - The media segment.
   * @param {number} trackId - The track to keep.
   * @return {ArrayBuffer|null} The rewritten segment, or null if it could not be.
   */
  static stripSegmentToAudio(buffer, trackId) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    const boxes = [];
    let moof = null;
    let mdat = null;
    this.walk(view, 0, buffer.byteLength, (type, contentStart, contentEnd, boxStart) => {
      const box = {type, contentStart, contentEnd, boxStart};
      boxes.push(box);
      if (type === 'moof') moof = box;
      if (type === 'mdat') mdat = box;
    });

    if (!moof || !mdat) {
      return null;
    }

    const fragments = [];
    this.walk(view, moof.contentStart, moof.contentEnd, (type, contentStart, contentEnd, boxStart) => {
      if (type !== 'traf') return;

      const fragment = {boxStart, boxEnd: contentEnd, trackId: null, flags: 0, defaultSampleSize: 0, runs: []};
      this.walkPath(view, contentStart, contentEnd, ['tfhd'], (start) => {
        fragment.flags = view.getUint32(start) & 0xffffff;
        fragment.trackId = view.getUint32(start + 4);

        let cursor = start + 8;
        if (fragment.flags & 0x000001) cursor += 8;
        if (fragment.flags & 0x000002) cursor += 4;
        if (fragment.flags & 0x000008) cursor += 4;
        if (fragment.flags & 0x000010) fragment.defaultSampleSize = view.getUint32(cursor);
      });
      this.walkPath(view, contentStart, contentEnd, ['trun'], (start) => {
        fragment.runs.push(start);
      });
      fragments.push(fragment);
    });

    const audio = fragments.find((fragment) => fragment.trackId === trackId);
    if (!audio) {
      return null;
    }

    if (fragments.length === 1) {
      return buffer;
    }

    // Sample positions given from an absolute base would survive neither the movie
    // fragment shrinking nor the media data being trimmed.
    if (audio.flags & 0x000001) {
      return null;
    }

    let dataStart = null;
    let dataLength = 0;
    let firstOffset = null;

    for (const run of audio.runs) {
      const flags = view.getUint32(run) & 0xffffff;
      const count = view.getUint32(run + 4);
      let cursor = run + 8;
      let offset = null;

      if (flags & 0x000001) {
        offset = view.getInt32(cursor);
        cursor += 4;
      }
      if (flags & 0x000004) cursor += 4;

      let length = 0;
      for (let i = 0; i < count; i++) {
        if (flags & 0x000100) cursor += 4;
        if (flags & 0x000200) {
          length += view.getUint32(cursor);
          cursor += 4;
        } else {
          length += audio.defaultSampleSize;
        }
        if (flags & 0x000400) cursor += 4;
        if (flags & 0x000800) cursor += 4;
      }

      // A run without an offset of its own carries straight on from the last one.
      const start = offset === null ? (dataStart === null ? null : dataStart + dataLength) : moof.boxStart + offset;
      if (start === null) {
        return null;
      }

      if (dataStart === null) {
        dataStart = start;
        firstOffset = offset;
      } else if (start !== dataStart + dataLength) {
        // The track's samples are scattered through the media data rather than laid out
        // in one run, so they cannot be lifted out by trimming.
        return null;
      }

      dataLength += length;
    }

    if (firstOffset === null || dataLength === 0 ||
        dataStart < mdat.contentStart || dataStart + dataLength > mdat.contentEnd) {
      return null;
    }

    const fragmentBoxes = [];
    this.walk(view, moof.contentStart, moof.contentEnd, (type, contentStart, contentEnd, boxStart) => {
      if (type === 'traf' && boxStart !== audio.boxStart) return;
      fragmentBoxes.push(bytes.subarray(boxStart, contentEnd));
    });

    const movieFragment = this.box('moof', fragmentBoxes);
    const fragmentView = new DataView(movieFragment.buffer, movieFragment.byteOffset, movieFragment.byteLength);
    const shift = movieFragment.byteLength + 8 - firstOffset;

    this.walkPath(fragmentView, 8, movieFragment.byteLength, ['traf', 'trun'], (start) => {
      if (fragmentView.getUint32(start) & 0x000001) {
        fragmentView.setInt32(start + 8, fragmentView.getInt32(start + 8) + shift);
      }
    });

    const indexedSize = movieFragment.byteLength + 8 + dataLength;
    const rebuilt = [];

    for (const box of boxes) {
      if (box.type === 'moof') {
        rebuilt.push(movieFragment);
      } else if (box.type === 'mdat') {
        rebuilt.push(this.box('mdat', [bytes.subarray(dataStart, dataStart + dataLength)]));
      } else if (box.type === 'sidx') {
        const index = this.reindexSidx(view, bytes, box, trackId, indexedSize);
        if (index) rebuilt.push(index);
      } else {
        rebuilt.push(bytes.subarray(box.boxStart, box.contentEnd));
      }
    }

    return this.join(rebuilt);
  }

  /**
   * Rewrites a segment index for a segment that has just been trimmed to one track.
   * @param {DataView} view - View over the original segment.
   * @param {Uint8Array} bytes - The original segment.
   * @param {Object} box - The segment index's bounds.
   * @param {number} trackId - The track that was kept.
   * @param {number} indexedSize - How many bytes the index now covers.
   * @return {Uint8Array|null} The rewritten index, or null if it should be dropped.
   */
  static reindexSidx(view, bytes, box, trackId, indexedSize) {
    if (view.getUint32(box.contentStart + 4) !== trackId) {
      return null;
    }

    const version = view.getUint8(box.contentStart);
    const entries = box.contentStart + (version === 1 ? 32 : 24);

    // Rewriting one entry is a matter of its size; several would have to be re-measured
    // against the trimmed media, and an index that lies is worse than none at all.
    if (entries + 4 > box.contentEnd || view.getUint16(entries - 2) !== 1) {
      return null;
    }

    const copy = bytes.slice(box.boxStart, box.contentEnd);
    const copyView = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);
    const offset = entries - box.boxStart;

    // first_offset, which precedes the entry count and its reserved half-word.
    if (version === 1) {
      copyView.setBigUint64(offset - 12, 0n);
    } else {
      copyView.setUint32(offset - 8, 0);
    }

    // The entry's leading bit marks a reference to another index rather than to media.
    copyView.setUint32(offset, (view.getUint32(entries) & 0x80000000) | indexedSize);

    return copy;
  }
}

/**
 * Helpers for the compact descriptor the Panopto content script hands to the player.
 */
export class PanoptoSource {
  /**
   * Encodes a descriptor as a source URL.
   * @param {Object} descriptor - The Panopto session descriptor.
   * @return {string} A data URL.
   */
  static encode(descriptor) {
    return SOURCE_URL_PREFIX + encodeURIComponent(JSON.stringify(descriptor));
  }

  /**
   * Decodes a descriptor from a source URL.
   * @param {string} url - The source URL.
   * @return {Object|null} The descriptor, or null if the URL is not one of ours.
   */
  static decode(url) {
    if (!url || !url.startsWith(SOURCE_URL_PREFIX)) {
      return null;
    }
    try {
      return JSON.parse(decodeURIComponent(url.substring(SOURCE_URL_PREFIX.length)));
    } catch (e) {
      console.error('Failed to decode Panopto source', e);
      return null;
    }
  }

  /**
   * Computes the media time within a stream that corresponds to session time zero.
   *
   * `RelativeSegments` is authoritative when present: Panopto uses it to select the
   * delivered window out of a longer encode. The stream's `AbsoluteStart`/`RelativeStart`
   * describe the recorder's wall clock and disagree with it, so they are only a fallback.
   *
   * @param {Object} stream - A `Delivery.Streams` entry.
   * @return {number} Media time, in seconds, aligned to session time zero.
   */
  static getSessionOffset(stream) {
    const segments = stream.RelativeSegments;
    if (Array.isArray(segments) && segments.length > 0 && typeof segments[0].Start === 'number') {
      return segments[0].Start - (segments[0].RelativeStart || 0);
    }
    return -(stream.RelativeStart || 0) || 0;
  }
}

/**
 * Builds the combined presentation from a set of resolved Panopto streams.
 */
export class PanoptoHLS {
  /**
   * Reduces a playlist or segment URL to the variant directory that contains it.
   *
   * Panopto gives every variant its own directory, holding both the media playlist and
   * the single resource its segments byte-range into, so the directory identifies the
   * variant no matter which of them was requested — and survives any URL normalization
   * hls.js applies on the way.
   *
   * @param {string} url - An absolute URL.
   * @return {string} The directory portion, without query or hash.
   */
  static variantKey(url) {
    const stripped = url.split(/[?#]/)[0];
    return stripped.substring(0, stripped.lastIndexOf('/') + 1);
  }

  /**
   * Whether a URL addresses the audio-only view of a muxed stream.
   * @param {string} url - The URL.
   * @return {boolean} True if it does.
   */
  static isAudioRendition(url) {
    return url.includes(AUDIO_RENDITION_MARKER);
  }

  /**
   * The suffix marking the audio-only view of a muxed stream.
   * @return {string} The marker.
   */
  static get audioRenditionMarker() {
    return AUDIO_RENDITION_MARKER;
  }

  /**
   * Identifies a variant together with the part it is playing, since a muxed stream is
   * served both whole and as audio alone and the two are processed differently.
   * @param {string} url - The URL.
   * @return {string} The key.
   */
  static roleKey(url) {
    return this.variantKey(url) + (this.isAudioRendition(url) ? AUDIO_RENDITION_MARKER : '');
  }

  /**
   * Presents a muxed stream as an audio-only rendition.
   *
   * Its cheapest variant is used: the video in it is thrown away on arrival, so the
   * less of it there is the better.
   *
   * @param {Object} stream - A stream carrying both audio and video.
   * @return {Object} A stream entry for the audio in it.
   */
  static toAudioRendition(stream) {
    const variant = stream.variants.reduce((cheapest, candidate) => {
      return candidate.bandwidth < cheapest.bandwidth ? candidate : cheapest;
    }, stream.variants[0]);

    return {
      ...stream,
      name: `${stream.name} audio`,
      hasVideo: false,
      variants: [{...variant, url: variant.url + AUDIO_RENDITION_MARKER}],
    };
  }

  /**
   * Parses a multivariant playlist into its variant list.
   * @param {string} text - The playlist body.
   * @param {string} baseURL - URL the playlist was loaded from.
   * @return {Object[]} The variants.
   */
  static parseMultivariantPlaylist(text, baseURL) {
    const variants = [];
    let attributes = null;

    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        attributes = parseAttributes(line.substring(18));
      } else if (line !== '' && !line.startsWith('#') && attributes) {
        variants.push({
          url: new URL(line, baseURL).href,
          bandwidth: parseInt(attributes.BANDWIDTH, 10) || 0,
          averageBandwidth: parseInt(attributes['AVERAGE-BANDWIDTH'], 10) || 0,
          resolution: attributes.RESOLUTION || null,
          frameRate: attributes['FRAME-RATE'] || null,
          codecs: attributes.CODECS || null,
        });
        attributes = null;
      }
    }

    return variants;
  }

  /**
   * Classifies a stream by the codecs its variants declare.
   * @param {Object[]} variants - The stream's variants.
   * @return {{hasVideo: boolean, hasAudio: boolean, audioCodec: string|null}} The verdict.
   */
  static classify(variants) {
    const codecs = splitCodecs(variants.map((variant) => variant.codecs || '').join(','));
    return {
      hasVideo: variants.some((variant) => !!variant.resolution) || codecs.some((codec) => VIDEO_CODEC_REGEX.test(codec)),
      hasAudio: codecs.some((codec) => AUDIO_CODEC_REGEX.test(codec)),
      audioCodec: codecs.find((codec) => AUDIO_CODEC_REGEX.test(codec)) || null,
    };
  }

  /**
   * Places every stream on one shared presentation timeline.
   *
   * Each stream is snapped back to the segment boundary at or before session time zero,
   * because a segment is the smallest thing a playlist can start on. The largest of
   * those snapping residuals becomes the presentation's lead-in, so that the stream
   * needing the most room still starts on a boundary and no content has to be dropped.
   * The presentation therefore runs `leadIn` seconds ahead of Panopto's session time.
   *
   * Each stream is then given the `delta` to add to its raw decode times, which is what
   * collapses the streams' unrelated timelines into the one hls.js will buffer against.
   *
   * @param {Object[]} streams - Resolved streams, each with `offset` and `reference`.
   * @param {number} duration - The session duration in seconds.
   * @return {number} The lead-in, in seconds.
   */
  static planTimeline(streams, duration) {
    for (const stream of streams) {
      const boundary = stream.reference.segments[stream.reference.indexAtTime(stream.offset)];
      stream.residual = boundary ? Math.max(0, stream.offset - boundary.start) : 0;
    }

    const leadIn = streams.reduce((max, stream) => Math.max(max, stream.residual), 0);

    for (const stream of streams) {
      stream.delta = leadIn - stream.offset;
      stream.windowStart = stream.offset - leadIn;
      stream.windowEnd = stream.offset + duration;
    }

    return leadIn;
  }

  /**
   * Trims a media playlist to the session window planned for its stream.
   *
   * Only whole segments are kept. `windowStart` sits exactly on a boundary for the
   * stream that set the lead-in; for any other stream it may fall mid-segment, and
   * starting at the following boundary is what keeps every rebased decode time
   * non-negative.
   *
   * A stream whose first kept segment does not begin at presentation time zero has that
   * gap added to the segment's declared duration. Without it the playlist would claim
   * the stream starts at zero while its rebased decode times say otherwise, and hls.js
   * schedules alternate audio from the playlist but places it by decode time — so the
   * two have to agree or audio fragments get requested against the wrong positions.
   *
   * @param {PanoptoMediaPlaylist} playlist - The stream's media playlist.
   * @param {Object} stream - A stream that has been through {@link planTimeline}.
   * @param {string} uriSuffix - Appended to every URI the playlist names.
   * @return {{text: string, first: number, last: number, pad: number}} The trimmed playlist.
   */
  static trimToWindow(playlist, stream, uriSuffix = '') {
    let first = playlist.indexAtTime(stream.windowStart);
    if (playlist.segments[first] && playlist.segments[first].start < stream.windowStart - 0.0005) {
      first = Math.min(first + 1, playlist.segments.length - 1);
    }

    const last = Math.max(first, playlist.indexAtTime(stream.windowEnd));

    // Where the first kept segment lands once its decode times are rebased.
    const pad = Math.max(0, playlist.segments[first].start + stream.delta);

    return {text: playlist.serialize(first, last, pad, uriSuffix), first, last, pad};
  }

  /**
   * Builds the multivariant playlist presenting every stream as one presentation.
   * @param {Object[]} videoStreams - Streams carrying video.
   * @param {Object[]} audioStreams - Audio-only streams.
   * @param {number} leadIn - Seconds of video preceding session time zero.
   * @return {string} The playlist body.
   */
  static buildMultivariantPlaylist(videoStreams, audioStreams, leadIn) {
    const lines = ['#EXTM3U', '#EXT-X-INDEPENDENT-SEGMENTS'];

    if (leadIn > 0) {
      // Start where every stream has content, rather than inside the lead-in where only
      // video does.
      lines.push(`#EXT-X-START:TIME-OFFSET=${leadIn.toFixed(6)},PRECISE=YES`);
    }

    audioStreams.forEach((stream, index) => {
      const attributes = [
        'TYPE=AUDIO',
        `GROUP-ID="${AUDIO_GROUP_ID}"`,
        `NAME="${escapeAttribute(stream.name)}"`,
      ];
      if (stream.language) {
        attributes.push(`LANGUAGE="${escapeAttribute(stream.language)}"`);
      }
      attributes.push(
          `DEFAULT=${index === 0 ? 'YES' : 'NO'}`,
          `AUTOSELECT=${index === 0 ? 'YES' : 'NO'}`,
          `URI="${stream.variants[0].url}"`,
      );
      lines.push(`#EXT-X-MEDIA:${attributes.join(',')}`);
    });

    const audioCodec = audioStreams.length > 0 ? audioStreams[0].audioCodec : null;

    // Leaving a stream that carries its own audio out of the alternate group is not
    // enough to keep the two from playing at once: a variant that names no group at all
    // is offered every rendition there is. Saying the audio is already in the stream
    // takes a group of its own, holding renditions that name no URI.
    const muxedStreams = audioStreams.length > 0 ? videoStreams.filter((stream) => stream.hasAudio) : [];

    muxedStreams.forEach((stream, index) => {
      lines.push('#EXT-X-MEDIA:' + [
        'TYPE=AUDIO',
        `GROUP-ID="${MUXED_AUDIO_GROUP_ID}"`,
        `NAME="${escapeAttribute(stream.name)}"`,
        `DEFAULT=${index === 0 ? 'YES' : 'NO'}`,
        `AUTOSELECT=${index === 0 ? 'YES' : 'NO'}`,
      ].join(','));
    });

    for (const stream of videoStreams) {
      // A stream that already carries its own audio keeps it, and is left out of the
      // alternate audio group so that the two are never played together.
      const useAudioGroup = audioStreams.length > 0 && !stream.hasAudio;
      const audioGroup = useAudioGroup ? AUDIO_GROUP_ID :
          (muxedStreams.includes(stream) ? MUXED_AUDIO_GROUP_ID : null);

      for (const variant of stream.variants) {
        const codecs = splitCodecs(variant.codecs);
        if (useAudioGroup && audioCodec) {
          codecs.push(audioCodec);
        }

        const attributes = [`BANDWIDTH=${variant.bandwidth || 1}`];
        if (variant.averageBandwidth) {
          attributes.push(`AVERAGE-BANDWIDTH=${variant.averageBandwidth}`);
        }
        if (codecs.length > 0) {
          attributes.push(`CODECS="${codecs.join(',')}"`);
        }
        if (variant.resolution) {
          attributes.push(`RESOLUTION=${variant.resolution}`);
        }
        if (variant.frameRate) {
          attributes.push(`FRAME-RATE=${variant.frameRate}`);
        }
        attributes.push(`NAME="${escapeAttribute(stream.name)}"`);
        if (audioGroup) {
          attributes.push(`AUDIO="${audioGroup}"`);
        }

        lines.push(`#EXT-X-STREAM-INF:${attributes.join(',')}`);
        lines.push(variant.url);
      }
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Wraps a playlist body as a URL hls.js can load.
   * @param {string} text - The playlist body.
   * @return {string} A data URL.
   */
  static toPlaylistURL(text) {
    return PLAYLIST_URL_PREFIX + encodeURIComponent(text);
  }
}

/**
 * Reads a four-character code.
 * @param {DataView} view - The view to read from.
 * @param {number} offset - Where the code starts.
 * @return {string} The code.
 */
function readBoxType(view, offset) {
  return String.fromCharCode(
      view.getUint8(offset), view.getUint8(offset + 1),
      view.getUint8(offset + 2), view.getUint8(offset + 3),
  );
}

/**
 * Splits a CODECS attribute into individual codec strings.
 * @param {string} codecs - The attribute value.
 * @return {string[]} The codecs.
 */
function splitCodecs(codecs) {
  return (codecs || '').split(',').map((codec) => codec.trim()).filter((codec) => codec !== '');
}

/**
 * Parses the attribute list of an HLS tag.
 * @param {string} str - The attribute list.
 * @return {Object} Attribute name to value, with quotes removed.
 */
function parseAttributes(str) {
  const attributes = {};
  const regex = /([A-Za-z0-9-]+)=("[^"]*"|[^,]*)/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    const value = match[2];
    attributes[match[1]] = value.startsWith('"') ? value.slice(1, -1) : value;
  }
  return attributes;
}

/**
 * Escapes a value for use inside a quoted HLS attribute.
 * @param {string} value - The raw value.
 * @return {string} The escaped value.
 */
function escapeAttribute(value) {
  return String(value || '').replace(/["\r\n]/g, ' ');
}
