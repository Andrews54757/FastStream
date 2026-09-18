// Reads a Panopto session's delivery info and hands FastStream a descriptor of every
// stream it contains, plus the caption track.
//
// The requests run here, in the page, rather than in the player: DeliveryInfo.aspx is
// same-origin from the viewer, so the session cookies ride along for free and no headers
// need copying. The CDN URLs it returns are publicly readable, so the player can fetch
// the media itself without any further authentication.

(() => {
  const DELIVERY_INFO_PATH = '/Panopto/Pages/Viewer/DeliveryInfo.aspx';
  const SOURCE_URL_PREFIX = 'data:application/x-panopto+json,';

  // Panopto arranges its own viewer, and the element holding the video being played is
  // not the largest one on the page, so the replacer is pointed straight at it instead
  // of being left to pick by size.
  const PLAYER_CONTAINER_QUERY = '#rightPlayersContainer';

  // The viewer builds its layout after page load, so the container will usually not be
  // there yet when the player is asked to open.
  const PLAYER_CONTAINER_TIMEOUT = 3000;

  const deliveryId = new URLSearchParams(location.search).get('id');
  if (!deliveryId || !/^[0-9a-f-]{36}$/i.test(deliveryId)) {
    return;
  }

  /**
   * Resolves once FastStream is switched on for this tab.
   *
   * Nothing here touches the network before that: reading a session's delivery info is
   * work the user has not asked for until they turn the extension on.
   *
   * @return {Promise<void>} Resolves when the tab is enabled.
   */
  function waitUntilEnabled() {
    return new Promise((resolve) => {
      const onMessage = (request) => {
        if (request.type === 'MESSAGE_FROM_CONTENT' && request.destination === 'custom' &&
            request.data?.type === 'tab-enabled') {
          chrome.runtime.onMessage.removeListener(onMessage);
          resolve();
        }
      };
      chrome.runtime.onMessage.addListener(onMessage);

      // The tab may already have been on before this page loaded.
      chrome.runtime.sendMessage({type: 'IS_TAB_ENABLED'}, (response) => {
        if (response?.enabled) {
          chrome.runtime.onMessage.removeListener(onMessage);
          resolve();
        }
      });
    });
  }

  // The main content script is the one that performs the replacement, and it only
  // accepts configuration once it has registered the frame. Started right away so it is
  // settled well before the delivery lookup below produces a source to open.
  const replacerConfigured = (async () => {
    await new Promise((resolve) => {
      chrome.runtime.sendMessage({type: 'WAIT_UNTIL_MAIN_LOADED'}, () => resolve());
    });

    await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'SEND_TO_CONTENT',
        destination: 'main',
        data: {
          type: 'config',
          config: {
            customVideoQuery: PLAYER_CONTAINER_QUERY,
            customVideoQueryTimeout: PLAYER_CONTAINER_TIMEOUT,
          },
        },
      }, () => resolve());
    });
  })();

  /**
   * Posts a form-encoded request to the delivery info endpoint.
   * @param {Object} params - Form fields.
   * @return {Promise<Object|null>} The parsed response, or null on failure.
   */
  async function postDeliveryInfo(params) {
    const body = new URLSearchParams(params).toString();

    const response = await fetch(DELIVERY_INFO_PATH, {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body,
    });

    if (!response.ok) {
      throw new Error(`DeliveryInfo responded ${response.status}`);
    }

    return response.json();
  }

  /**
   * Computes the media time within a stream that corresponds to session time zero.
   *
   * `RelativeSegments` selects the delivered window out of what may be a much longer
   * capture, and is authoritative when present. The stream's `RelativeStart` only
   * describes where the recorder thought it started and can disagree by hours.
   *
   * @param {Object} stream - A `Delivery.Streams` entry.
   * @return {number} Media time in seconds.
   */
  function getSessionOffset(stream) {
    const segments = stream.RelativeSegments;
    if (Array.isArray(segments) && segments.length > 0 && typeof segments[0].Start === 'number') {
      return segments[0].Start - (segments[0].RelativeStart || 0);
    }
    return -(stream.RelativeStart || 0);
  }

  /**
   * Builds a readable, unique name for a stream.
   * @param {Object} stream - A `Delivery.Streams` entry.
   * @param {number} index - Position in the stream list.
   * @param {Set<string>} used - Names already taken.
   * @return {string} The name.
   */
  function getStreamName(stream, index, used) {
    let base = (stream.Name || '').trim();

    if (!base) {
      const tag = (stream.Tag || '').toUpperCase();
      if (tag === 'SCREEN') {
        base = 'Screen';
      } else if (tag === 'AUDIO') {
        base = 'Primary';
      } else if (tag) {
        base = tag.charAt(0) + tag.slice(1).toLowerCase();
      } else {
        base = `Stream ${index + 1}`;
      }
    }

    let name = base;
    let suffix = 2;
    while (used.has(name)) {
      name = `${base} ${suffix++}`;
    }
    used.add(name);

    return name;
  }

  /**
   * Formats seconds as a WebVTT timestamp.
   * @param {number} seconds - The time.
   * @return {string} `HH:MM:SS.mmm`.
   */
  function formatTimestamp(seconds) {
    // Rounded to whole milliseconds up front, so that a fraction just short of a second
    // cannot round up to "1000" and be read back as an extra second.
    const total = Math.max(0, Math.round(seconds * 1000));

    const pad = (value, width) => String(value).padStart(width, '0');
    return `${pad(Math.floor(total / 3600000), 2)}:${pad(Math.floor(total / 60000) % 60, 2)}:` +
      `${pad(Math.floor(total / 1000) % 60, 2)}.${pad(total % 1000, 3)}`;
  }

  /**
   * Converts Panopto's caption list into a WebVTT document.
   * @param {Array} captions - Caption entries.
   * @param {number} duration - Session duration, used to close the final cue.
   * @return {string|null} The WebVTT body, or null if there is nothing to show.
   */
  function captionsToWebVTT(captions, duration) {
    const cues = [];

    captions.forEach((caption, index) => {
      const text = caption.Caption ?? caption.Text ?? '';
      const start = caption.Time ?? caption.RelativeTime ?? caption.StartTime;

      if (typeof start !== 'number' || typeof text !== 'string' || text.trim() === '') {
        return;
      }

      const next = captions[index + 1];
      const nextStart = next ? (next.Time ?? next.RelativeTime ?? next.StartTime) : null;

      // Panopto sends Duration as 0 on every entry and puts the real length in
      // CaptionDuration. Without it each caption would linger until the next one starts.
      const length = [caption.Duration, caption.CaptionDuration]
          .find((value) => typeof value === 'number' && value > 0);

      let end = length !== undefined ? start + length :
        (typeof nextStart === 'number' ? nextStart : duration);

      if (typeof nextStart === 'number' && end > nextStart) {
        end = nextStart;
      }

      if (!(end > start)) {
        end = start + 1;
      }

      cues.push(`${formatTimestamp(start)} --> ${formatTimestamp(end)}\n${text.trim()}`);
    });

    if (cues.length === 0) {
      return null;
    }

    return `WEBVTT\n\n${cues.join('\n\n')}\n`;
  }

  /**
   * Requests the caption track, if the session has one.
   * @param {Object} delivery - The `Delivery` object.
   * @return {Promise<Array>} Subtitle entries for FastStream, possibly empty.
   */
  async function getSubtitles(delivery) {
    if (!delivery.HasCaptions) {
      return [];
    }

    const languages = Array.isArray(delivery.AvailableCaptions) && delivery.AvailableCaptions.length > 0 ?
      delivery.AvailableCaptions.map((caption) => caption.Language) :
      [0];

    const subtitles = [];

    for (const language of languages) {
      try {
        const response = await postDeliveryInfo({
          deliveryId,
          getCaptions: 'true',
          language: String(language ?? 0),
          responseType: 'json',
        });

        const captions = Array.isArray(response) ? response : (response?.Captions || response?.captions);
        if (!Array.isArray(captions)) {
          continue;
        }

        const data = captionsToWebVTT(captions, delivery.Duration || 0);
        if (data) {
          subtitles.push({
            data,
            label: languages.length > 1 ? `Panopto captions (${language})` : 'Panopto captions',
            language: language === 0 ? 'en' : '',
          });
        }
      } catch (e) {
        console.warn('FastStream: failed to load Panopto captions', e);
      }
    }

    return subtitles;
  }

  (async () => {
    await waitUntilEnabled();

    let info;
    try {
      info = await postDeliveryInfo({
        deliveryId,
        isLiveNotes: 'false',
        refreshAuthCookie: 'true',
        isActiveBroadcast: 'false',
        isEditing: 'false',
        isKollectiveAgentInstalled: 'false',
        isEmbed: 'false',
        responseType: 'json',
      });
    } catch (e) {
      console.warn('FastStream: could not read Panopto delivery info', e);
      return;
    }

    const delivery = info?.Delivery;
    if (!delivery || !Array.isArray(delivery.Streams) || delivery.Streams.length === 0) {
      console.warn('FastStream: Panopto session has no streams');
      return;
    }

    if (delivery.IsBroadcast || delivery.IsActiveBroadcast) {
      console.log('FastStream: skipping Panopto live broadcast');
      return;
    }

    const usedNames = new Set();
    const streams = delivery.Streams.map((stream, index) => {
      const url = stream.StreamUrl || stream.StreamHttpUrl;
      const type = (stream.ViewerMediaFileTypeName || stream.EditMediaFileTypeName || '').toLowerCase();

      if (!url || type !== 'hls') {
        console.log('FastStream: skipping non-HLS Panopto stream', stream.Tag, type);
        return null;
      }

      return {
        id: stream.PublicID || stream.StreamFileId || String(index),
        name: getStreamName(stream, index, usedNames),
        tag: stream.Tag || '',
        url,
        offset: getSessionOffset(stream),
      };
    }).filter((stream) => stream !== null);

    if (streams.length === 0) {
      console.warn('FastStream: no HLS streams in Panopto session');
      return;
    }

    const descriptor = {
      version: 1,
      deliveryId,
      sessionId: delivery.SessionPublicID || info.SessionId || '',
      title: delivery.SessionName || document.title,
      duration: delivery.Duration || 0,
      streams,
    };

    const subtitles = await getSubtitles(delivery);

    // Announcing the source is what eventually triggers the replacement, so the
    // replacer has to know which element to target before this goes out.
    await replacerConfigured;

    chrome.runtime.sendMessage({
      type: 'DETECTED_SOURCE',
      url: SOURCE_URL_PREFIX + encodeURIComponent(JSON.stringify(descriptor)),
      ext: 'panopto',
      headers: {},
      subtitles,
    });
  })();
})();
