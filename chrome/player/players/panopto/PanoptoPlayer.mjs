import {RequestUtils} from '../../utils/RequestUtils.mjs';
import HLSPlayer from '../hls/HLSPlayer.mjs';
import {MP4Boxes, PanoptoHLS, PanoptoMediaPlaylist, PanoptoSource} from './PanoptoUtils.mjs';

/**
 * Plays a Panopto session as a single HLS presentation.
 *
 * Panopto hands out one independent HLS encode per stream — typically an audio-only
 * primary and one or more video-only screen or camera captures. This player synthesizes a
 * multivariant playlist that presents them as ordinary video levels plus alternate audio
 * renditions, so the rest of FastStream sees a perfectly normal HLS stream.
 *
 * Two corrections are applied to make that work, both handled in {@link PanoptoUtils}:
 *
 * 1. Each stream's media playlist is trimmed to the window the session actually maps to,
 *    since a capture may run for hours longer than the session it was delivered for.
 * 2. Each stream's fMP4 decode times are rebased onto one shared timeline, because
 *    hls.js applies the main track's `initPTS` to the alternate audio renditions.
 *
 * A trim boundary rarely lands exactly on session time zero, so the presentation may
 * start a little ahead of it. See {@link PanoptoHLS.planTimeline}.
 */
export default class PanoptoPlayer extends HLSPlayer {
  constructor(client, config) {
    super(client, config);

    this.descriptor = null;
    this.leadIn = 0;
    this.streams = [];
    /** Variant directory -> the stream that owns it. */
    this.streamsByVariant = new Map();
    /** Variant directory -> parsed playlist, then the trimmed body once served. */
    this.playlistCache = new Map();
    /** Variant directory -> media timescale, learned from that variant's init segment. */
    this.timescales = new Map();
  }

  async setSource(source) {
    this.source = source;

    const descriptor = PanoptoSource.decode(source.url);
    if (!descriptor || !Array.isArray(descriptor.streams) || descriptor.streams.length === 0) {
      throw new Error('Not a valid Panopto source');
    }
    this.descriptor = descriptor;

    this.hls.loadSource(PanoptoHLS.toPlaylistURL(await this.buildMultivariantPlaylist()));
  }

  getSource() {
    return this.source;
  }

  /**
   * Resolves every stream, plans the shared timeline, and builds the multivariant
   * playlist that hls.js will load.
   * @return {Promise<string>} The playlist body.
   */
  async buildMultivariantPlaylist() {
    const descriptor = this.descriptor;

    const resolved = await Promise.all(descriptor.streams.map(async (stream) => {
      try {
        return await this.resolveStream(stream);
      } catch (e) {
        console.warn('Panopto: skipping unreadable stream', stream.name, e);
        return null;
      }
    }));

    this.streams = resolved.filter((stream) => stream !== null);
    if (this.streams.length === 0) {
      throw new Error('No playable Panopto streams');
    }

    this.leadIn = PanoptoHLS.planTimeline(this.streams, descriptor.duration);

    for (const stream of this.streams) {
      for (const variant of stream.variants) {
        this.streamsByVariant.set(PanoptoHLS.variantKey(variant.url), stream);
      }
    }

    const audioStreams = this.streams.filter((stream) => stream.hasAudio && !stream.hasVideo);
    const videoStreams = this.streams.filter((stream) => stream.hasVideo);

    if (videoStreams.length === 0) {
      throw new Error('Panopto session has no video streams');
    }

    console.log(`Panopto: "${descriptor.title}" — ${videoStreams.length} video / ${audioStreams.length} audio stream(s), lead-in ${this.leadIn.toFixed(3)}s`);
    for (const stream of this.streams) {
      console.log(`  ${stream.name}: session 0 at media ${stream.offset.toFixed(3)}s, decode time shift ${stream.delta.toFixed(3)}s`);
    }

    // Captions come from Panopto timed against session time, which the lead-in precedes.
    this.client.setSubtitleTimelineOffset(this.leadIn);

    return PanoptoHLS.buildMultivariantPlaylist(videoStreams, audioStreams, this.leadIn);
  }

  /**
   * Loads a stream's multivariant playlist, plus the one media playlist needed to find
   * the segment boundary that session time zero falls inside.
   * @param {Object} stream - A stream entry from the source descriptor.
   * @return {Promise<Object|null>} The resolved stream, or null if it is unusable.
   */
  async resolveStream(stream) {
    const variants = PanoptoHLS.parseMultivariantPlaylist(await fetchText(stream.url), stream.url);
    if (variants.length === 0) {
      return null;
    }

    // The variants of one stream share a segment grid, so the cheapest one is enough.
    const reference = variants.reduce((min, variant) => (variant.bandwidth < min.bandwidth ? variant : min), variants[0]);
    const referencePlaylist = PanoptoMediaPlaylist.parse(await fetchText(reference.url));
    this.playlistCache.set(PanoptoHLS.variantKey(reference.url), referencePlaylist);

    return {
      ...stream,
      ...PanoptoHLS.classify(variants),
      variants,
      offset: stream.offset || 0,
      reference: referencePlaylist,
    };
  }

  /**
   * Trims a media playlist to its stream's session window.
   *
   * Called by {@link HLSLoader} for every non-fragment response.
   *
   * @param {Object} context - The loader context.
   * @param {string} data - The response body.
   * @return {string} The playlist to hand to hls.js.
   */
  processPlaylist(context, data) {
    const key = PanoptoHLS.variantKey(context.url);
    const stream = this.streamsByVariant.get(key);
    if (!stream || typeof data !== 'string') {
      return data;
    }

    const cached = this.playlistCache.get(key);
    if (typeof cached === 'string') {
      return cached;
    }

    const playlist = cached instanceof PanoptoMediaPlaylist ? cached : PanoptoMediaPlaylist.parse(data);
    const {text, first, last} = PanoptoHLS.trimToWindow(playlist, stream);
    this.playlistCache.set(key, text);

    if (last - first + 1 !== playlist.segments.length) {
      console.log(`Panopto: trimmed ${stream.name} to segments ${first}-${last} of ${playlist.segments.length}`);
    }

    return text;
  }

  /**
   * Rebases a segment's decode times onto the shared timeline.
   *
   * Called by {@link HLSFragmentRequester} for every fragment response. The
   * initialization segment carries the timescale the shift has to be expressed in, and
   * hls.js always loads it before the media segments it describes.
   *
   * @param {Object} frag - The hls.js fragment.
   * @param {ArrayBuffer} data - The segment body.
   * @return {ArrayBuffer} The segment to hand to hls.js.
   */
  processFragmentData(frag, data) {
    if (!frag || !frag.url || !(data instanceof ArrayBuffer)) {
      return data;
    }

    const key = PanoptoHLS.variantKey(frag.url);
    const stream = this.streamsByVariant.get(key);
    if (!stream) {
      return data;
    }

    if (frag.sn === 'initSegment') {
      const timescale = MP4Boxes.getTimescale(data);
      if (timescale) {
        this.timescales.set(key, timescale);
      } else {
        console.warn('Panopto: could not read timescale for', stream.name);
      }
      return data;
    }

    const timescale = this.timescales.get(key);
    if (!timescale) {
      console.warn('Panopto: no timescale yet for', stream.name, '- leaving segment unshifted');
      return data;
    }

    MP4Boxes.shiftDecodeTime(data, stream.delta * timescale);
    return data;
  }

  getVideoLevels() {
    const levels = super.getVideoLevels();
    levels.forEach((level) => {
      // Names the source stream, so that a screen capture and a camera at the same
      // resolution stay separate entries in the quality menu.
      const name = this.hls.levels[this.getIndexes(level.id).levelID]?.name;
      if (name) {
        level.label = name;
      }
    });
    return levels;
  }

  /**
   * How far the presentation timeline runs ahead of Panopto's session timeline.
   * @return {number} Offset in seconds.
   */
  getTimelineOffset() {
    return this.leadIn;
  }
}

/**
 * Fetches a text resource, failing loudly on a bad status.
 * @param {string} url - The URL to fetch.
 * @return {Promise<string>} The response body.
 */
async function fetchText(url) {
  const xhr = await RequestUtils.request({url});
  if (xhr.status !== 200 && xhr.status !== 206) {
    throw new Error(`Failed to load ${url}: HTTP ${xhr.status}`);
  }
  return xhr.responseText;
}
