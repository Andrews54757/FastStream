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

/**
 * A parsed HLS media playlist, retaining enough structure to re-emit a trimmed copy.
 */
export class PanoptoMediaPlaylist {
  constructor() {
    this.headerLines = [];
    this.mapLine = null;
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
  serialize(startIndex, endIndex, firstSegmentPad = 0) {
    const kept = this.segments.slice(startIndex, endIndex + 1);
    const lines = ['#EXTM3U'];

    for (const header of this.headerLines) {
      lines.push(header);
    }

    lines.push(`#EXT-X-MEDIA-SEQUENCE:${this.mediaSequence + startIndex}`);

    if (this.mapLine) {
      lines.push(this.mapLine);
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
      lines.push(segment.uri);
    });

    lines.push('#EXT-X-ENDLIST');
    return lines.join('\n') + '\n';
  }
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
   * @param {Function} callback - Called with (type, contentStart, contentEnd).
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

      callback(type, contentStart, offset + size);
      offset += size;
    }
  }

  /**
   * Walks a nested box path, invoking the callback for each match of the final type.
   * @param {DataView} view - View over the buffer.
   * @param {number} start - Start offset.
   * @param {number} end - End offset.
   * @param {string[]} path - Box types, outermost first.
   * @param {Function} callback - Called with (contentStart, contentEnd) for each match.
   */
  static walkPath(view, start, end, path, callback) {
    this.walk(view, start, end, (type, contentStart, contentEnd) => {
      if (type !== path[0]) return;
      if (path.length === 1) {
        callback(contentStart, contentEnd);
      } else {
        this.walkPath(view, contentStart, contentEnd, path.slice(1), callback);
      }
    });
  }

  /**
   * Reads the media timescale from an fMP4 initialization segment.
   * @param {ArrayBuffer} buffer - The init segment.
   * @return {number|null} The timescale, or null if not found.
   */
  static getTimescale(buffer) {
    const view = new DataView(buffer);
    let timescale = null;

    this.walkPath(view, 0, buffer.byteLength, ['moov', 'trak', 'mdia', 'mdhd'], (start) => {
      if (timescale !== null) return;
      const version = view.getUint8(start);
      timescale = version === 1 ? view.getUint32(start + 20) : view.getUint32(start + 12);
    });

    return timescale;
  }

  /**
   * Shifts every `tfdt` decode time in a media segment by `delta` timescale units.
   *
   * This is what puts independently-encoded Panopto streams onto one timeline. The
   * buffer is modified in place; `trun` sample offsets are relative to the decode time
   * and so need no adjustment.
   *
   * @param {ArrayBuffer} buffer - The media segment.
   * @param {number} delta - Signed shift, in the track's timescale units.
   * @return {boolean} True if at least one decode time was rewritten.
   */
  static shiftDecodeTime(buffer, delta) {
    if (!delta) return false;

    const view = new DataView(buffer);
    let patched = false;

    this.walkPath(view, 0, buffer.byteLength, ['moof', 'traf', 'tfdt'], (start) => {
      const version = view.getUint8(start);
      if (version === 1) {
        const current = Number(view.getBigUint64(start + 4));
        view.setBigUint64(start + 4, BigInt(Math.max(0, Math.round(current + delta))));
      } else {
        const current = view.getUint32(start + 4);
        view.setUint32(start + 4, Math.max(0, Math.round(current + delta)));
      }
      patched = true;
    });

    return patched;
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
   * @return {{text: string, first: number, last: number, pad: number}} The trimmed playlist.
   */
  static trimToWindow(playlist, stream) {
    let first = playlist.indexAtTime(stream.windowStart);
    if (playlist.segments[first] && playlist.segments[first].start < stream.windowStart - 0.0005) {
      first = Math.min(first + 1, playlist.segments.length - 1);
    }

    const last = Math.max(first, playlist.indexAtTime(stream.windowEnd));

    // Where the first kept segment lands once its decode times are rebased.
    const pad = Math.max(0, playlist.segments[first].start + stream.delta);

    return {text: playlist.serialize(first, last, pad), first, last, pad};
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

    for (const stream of videoStreams) {
      // A stream that already carries its own audio keeps it, and is left out of the
      // alternate audio group so that the two are never played together.
      const useAudioGroup = audioStreams.length > 0 && !stream.hasAudio;

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
        if (useAudioGroup) {
          attributes.push(`AUDIO="${AUDIO_GROUP_ID}"`);
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
