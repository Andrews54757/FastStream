// SPLICER:EXTENSION:REMOVE_FILE
import {DefaultPlayerEvents} from '../enums/DefaultPlayerEvents.mjs';
import {PlayerModes} from '../enums/PlayerModes.mjs';
import {SubtitleTrack} from '../SubtitleTrack.mjs';
import {EnvUtils} from '../utils/EnvUtils.mjs';
import {URLUtils} from '../utils/URLUtils.mjs';
import {VideoSource} from '../VideoSource.mjs';

// The web build exists to be embedded, and a page that embeds it has no other way to
// drive it: the frame is on another origin, so the embedder cannot reach into it for the
// client object the way the player's own scripts do. These messages are that reach.
//
// The extension build has no need for any of this. It talks to its pages over the
// extension messaging APIs, which are not available to a web page, so the whole file is
// spliced out of extension builds and the runtime still checks before starting.
const COMMAND_TYPE = 'faststream:command';
const RESPONSE_TYPE = 'faststream:response';
const EVENT_TYPE = 'faststream:event';

// Events the player raises that an embedder has reason to act on. The names are the
// player's own, which are in turn the media element's, so an embedder that already knows
// how to follow a <video> knows how to follow this. Left out are the events that describe
// FastStream's own downloading rather than playback, which fire far too often to be worth
// sending across a frame boundary.
const FORWARDED_EVENTS = [
  DefaultPlayerEvents.CANPLAY,
  DefaultPlayerEvents.DURATIONCHANGE,
  DefaultPlayerEvents.ENDED,
  DefaultPlayerEvents.ERROR,
  DefaultPlayerEvents.LOADEDMETADATA,
  DefaultPlayerEvents.MANIFEST_PARSED,
  DefaultPlayerEvents.PAUSE,
  DefaultPlayerEvents.PLAY,
  DefaultPlayerEvents.PLAYING,
  DefaultPlayerEvents.RATECHANGE,
  DefaultPlayerEvents.SEEKED,
  DefaultPlayerEvents.SEEKING,
  DefaultPlayerEvents.TIMEUPDATE,
  DefaultPlayerEvents.WAITING,
];

// Events the API raises itself, because nothing the player emits says quite the same
// thing. The volume one exists because the player routes volume through a web audio node
// rather than the media element whenever it can, so the element's own volumechange says
// nothing about what the listener hears.
const READY_EVENT = 'ready';
const SOURCE_CHANGE_EVENT = 'sourcechange';
const VOLUME_CHANGE_EVENT = 'volumechange';

const API_EVENTS = [READY_EVENT, SOURCE_CHANGE_EVENT, VOLUME_CHANGE_EVENT, ...FORWARDED_EVENTS];

// Modes an embedder may ask for by name. PlayerModes holds a few more, but they either
// name no player at all or name one the web build cannot run, and asking the loader for
// those throws from somewhere the caller cannot make sense of.
const LOADABLE_MODES = [
  PlayerModes.DIRECT,
  PlayerModes.ACCELERATED_MP4,
  PlayerModes.ACCELERATED_HLS,
  PlayerModes.ACCELERATED_DASH,
  PlayerModes.ACCELERATED_VM,
  PlayerModes.ACCELERATED_PANOPTO,
];

// The volume slider goes to 300% when the browser can amplify through a web audio node.
const MAX_VOLUME = EnvUtils.isWebAudioSupported() ? 3 : 1;
const MIN_PLAYBACK_RATE = 0.1;

// How long to let a video become seekable before seeking into it anyway.
const SEEK_WAIT_TIMEOUT = 5000;

/**
 * Waits until there is somewhere to seek to.
 *
 * A media element drops a seek made while it has no seekable range, without saying so,
 * and a video that has just been handed to it has none until it knows what it is holding.
 * An embedder that loads a video and asks to start partway in would otherwise find itself
 * back at the beginning, depending on how quickly the video arrived. A video that never
 * becomes seekable is given up on rather than left holding the command open.
 *
 * @param {FastStreamClient} client
 * @return {Promise<void>}
 */
function whenSeekable(client) {
  return new Promise((resolve) => {
    const deadline = Date.now() + SEEK_WAIT_TIMEOUT;

    const poll = () => {
      const video = client.currentVideo;
      if (!video || video.seekable.length || Date.now() >= deadline) {
        resolve();
        return;
      }
      setTimeout(poll, 50);
    };

    poll();
  });
}

/**
 * Reads a finite number out of a command's arguments.
 * @param {Object} args - The arguments the command was sent with.
 * @param {string} name - Which argument to read.
 * @return {number} The value.
 */
function requireNumber(args, name) {
  const value = args[name];
  if (typeof value !== 'number' || !isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
  return value;
}

/**
 * Reads a non-empty string out of a command's arguments.
 * @param {Object} args - The arguments the command was sent with.
 * @param {string} name - Which argument to read.
 * @return {string} The value.
 */
function requireString(args, name) {
  const value = args[name];
  if (typeof value !== 'string' || !value.length) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

/**
 * Keeps a number inside a range.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @return {number} The clamped value.
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Describes a thrown value in a way that survives a postMessage.
 *
 * Errors are not structured-cloneable in every browser that can run the player, and the
 * players throw strings about as often as they throw Errors, so everything is flattened
 * to a message.
 *
 * @param {*} error - Whatever was thrown or emitted.
 * @return {string} A human-readable message.
 */
function describeError(error) {
  if (!error) {
    return 'Unknown error';
  }
  if (typeof error === 'string') {
    return error;
  }
  return error.message || String(error);
}

/**
 * Turns a TimeRanges into something that can cross a frame boundary.
 * @param {TimeRanges} ranges
 * @return {Array<Array<number>>} Pairs of start and end times, in seconds.
 */
function serializeRanges(ranges) {
  const result = [];
  for (let i = 0; ranges && i < ranges.length; i++) {
    result.push([ranges.start(i), ranges.end(i)]);
  }
  return result;
}

/**
 * Turns a quality level into a plain object.
 *
 * The levels the players hand out are class instances holding, among other things, the
 * library's own track object, which a structured clone would either mangle or refuse.
 *
 * @param {Object} level - A VideoLevel or AudioLevel.
 * @return {Object} The parts of it an embedder can use.
 */
function serializeLevel(level) {
  return {
    id: level.id,
    label: level.label || '',
    width: level.width || 0,
    height: level.height || 0,
    bitrate: level.bitrate || 0,
    mimeType: level.mimeType || '',
    language: level.language || '',
    videoCodec: level.videoCodec ?? null,
    audioCodec: level.audioCodec ?? null,
  };
}

/**
 * Loads a subtitle track described by an embedder.
 * @param {Object} subtitle - `{label, language, url}` or `{label, language, data}`.
 * @return {Promise<SubtitleTrack>} The parsed track.
 */
async function buildSubtitleTrack(subtitle) {
  const track = new SubtitleTrack(subtitle.label || 'Subtitles', subtitle.language || null);

  if (typeof subtitle.data === 'string' && subtitle.data.length) {
    track.loadText(subtitle.data);
  } else if (typeof subtitle.url === 'string' && subtitle.url.length) {
    await track.loadURL(subtitle.url);
  } else {
    throw new Error('A subtitle needs either data or a url');
  }

  if (!track.cues.length) {
    throw new Error('Subtitle track has no cues');
  }

  return track;
}

// Every command an embedder can send, by name. Each one is handed the API, the arguments
// the embedder sent, and who sent them; whatever it returns is the reply, and whatever it
// throws becomes the reply's error.
const COMMANDS = {
  /**
   * Answers what this player is and what it can be asked to do.
   * @param {EmbedAPI} api
   * @return {Object} The player's description.
   */
  ping(api) {
    return api.describe();
  },

  /**
   * Answers everything the embedder would otherwise have to watch events to know.
   * @param {EmbedAPI} api
   * @return {Object} The current playback state.
   */
  getState(api) {
    return api.getState();
  },

  /**
   * Answers the qualities and audio tracks the current source offers.
   * @param {EmbedAPI} api
   * @return {Object} Video and audio levels, and which of each is playing.
   */
  getLevels(api) {
    const client = api.client;
    return {
      video: Array.from(client.getVideoLevels().values()).map(serializeLevel),
      audio: Array.from(client.getAudioLevels().values()).map(serializeLevel),
      currentVideo: client.getCurrentVideoLevelID(),
      currentAudio: client.getCurrentAudioLevelID(),
    };
  },

  /**
   * Answers the subtitle tracks that are loaded.
   * @param {EmbedAPI} api
   * @return {Array<Object>} Each track's label, language and whether it is showing.
   */
  getSubtitles(api) {
    const manager = api.client.interfaceController.subtitlesManager;
    return manager.tracks.map((track, index) => {
      return {
        index,
        label: track.label || '',
        language: track.language || '',
        active: manager.activeTracks.includes(track),
        cues: track.cues.length,
      };
    });
  },

  /**
   * Starts playback.
   *
   * The browser may refuse if the embedding page has not been interacted with, in which
   * case the refusal is what the embedder gets back.
   *
   * @param {EmbedAPI} api
   * @return {Promise<void>}
   */
  async play(api) {
    api.client.userInteracted();
    await api.client.play();
  },

  /**
   * Pauses playback.
   * @param {EmbedAPI} api
   * @return {Promise<void>}
   */
  async pause(api) {
    if (!api.client.player) {
      return;
    }
    await api.client.pause();
  },

  /**
   * Plays if paused, pauses if playing.
   * @param {EmbedAPI} api
   * @return {Promise<void>}
   */
  async togglePlay(api) {
    if (api.client.paused) {
      await COMMANDS.play(api);
    } else {
      await COMMANDS.pause(api);
    }
  },

  /**
   * Moves the playhead, either to a time or by an offset from where it is.
   * @param {EmbedAPI} api
   * @param {Object} args - `{time}` in seconds, or `{delta}` in seconds.
   * @return {Promise<void>}
   */
  async seek(api, args) {
    const client = api.client;
    const offset = args.delta === undefined ? null : requireNumber(args, 'delta');
    const time = offset === null ? requireNumber(args, 'time') : null;

    // A seek sent the moment a video was loaded would otherwise be thrown away by the
    // browser, so it waits for the video to be ready to take it.
    await whenSeekable(client);

    const target = offset === null ? time : client.currentTime + offset;
    const duration = client.duration;
    client.userInteracted();
    client.currentTime = duration ? clamp(target, 0, duration) : Math.max(0, target);
  },

  /**
   * Sets the volume, where 1 is unamplified and the maximum is 3 where the browser can
   * amplify.
   * @param {EmbedAPI} api
   * @param {Object} args - `{volume}`.
   */
  setVolume(api, args) {
    api.client.userInteracted();
    api.client.volume = clamp(requireNumber(args, 'volume'), 0, MAX_VOLUME);
  },

  /**
   * Silences the player, or restores the volume it had before it was silenced.
   * @param {EmbedAPI} api
   * @param {Object} args - `{muted}`.
   */
  setMuted(api, args) {
    const volumeControls = api.client.interfaceController.volumeControls;
    if (!!args.muted !== volumeControls.muted) {
      volumeControls.muteToggle();
    }
  },

  /**
   * Sets the playback rate.
   * @param {EmbedAPI} api
   * @param {Object} args - `{rate}`.
   */
  setPlaybackRate(api, args) {
    const max = api.client.options.maxPlaybackRate;
    api.client.playbackRate = clamp(requireNumber(args, 'rate'), MIN_PLAYBACK_RATE, max);
  },

  /**
   * Switches to one of the qualities that getLevels reported.
   *
   * A stream changes quality at its next fragment, so what is playing can take a moment
   * to catch up with what was asked for.
   *
   * @param {EmbedAPI} api
   * @param {Object} args - `{id}`, a level id from getLevels.
   */
  setVideoLevel(api, args) {
    if (!api.client.getVideoLevels().has(args.id)) {
      throw new Error('No such video level');
    }
    api.client.setCurrentVideoLevelID(args.id);
  },

  /**
   * Switches to one of the audio tracks that getLevels reported.
   * @param {EmbedAPI} api
   * @param {Object} args - `{id}`, a level id from getLevels.
   */
  setAudioLevel(api, args) {
    if (!api.client.getAudioLevels().has(args.id)) {
      throw new Error('No such audio level');
    }
    api.client.setCurrentAudioLevelID(args.id);
  },

  /**
   * Picks the video or audio track for a language.
   * @param {EmbedAPI} api
   * @param {Object} args - `{type, language}`, where type is `video` or `audio`.
   */
  setLanguage(api, args) {
    const type = requireString(args, 'type');
    if (type !== 'video' && type !== 'audio') {
      throw new Error('type must be video or audio');
    }
    api.client.changeLanguage(type, requireString(args, 'language'));
  },

  /**
   * Plays a video.
   *
   * This is the command an embedder normally opens with: it replaces whatever is playing,
   * along with its subtitles, with the given url.
   *
   * @param {EmbedAPI} api
   * @param {Object} args - `{url, mode, headers, subtitles, autoPlay, time}`.
   * @return {Promise<Object>} What the source was understood as.
   */
  async load(api, args) {
    const client = api.client;
    const source = api.buildSource(args);

    if (args.autoPlay !== undefined) {
      client.setAutoPlay(!!args.autoPlay);
    }

    client.clearSubtitles();
    await client.addSource(source, true);

    if (args.time !== undefined) {
      await COMMANDS.seek(api, {time: args.time});
    }

    if (Array.isArray(args.subtitles)) {
      for (const subtitle of args.subtitles) {
        await COMMANDS.addSubtitles(api, subtitle);
      }
    }

    return {url: source.url, mode: source.mode};
  },

  /**
   * Offers a video in the player's source list without switching to it.
   * @param {EmbedAPI} api
   * @param {Object} args - `{url, mode, headers, setSource}`.
   * @return {Promise<Object>} What the source was understood as.
   */
  async addSource(api, args) {
    const source = api.buildSource(args);
    await api.client.addSource(source, !!args.setSource);
    return {url: source.url, mode: source.mode};
  },

  /**
   * Loads a subtitle track, from its text or from a url the player fetches.
   * @param {EmbedAPI} api
   * @param {Object} args - `{label, language, data, url, activate}`.
   * @return {Promise<Object>} The loaded track.
   */
  async addSubtitles(api, args) {
    const track = await buildSubtitleTrack(args);
    const manager = api.client.interfaceController.subtitlesManager;
    const loaded = api.client.loadSubtitleTrack(track, args.activate === undefined);

    if (args.activate) {
      manager.activateTrack(loaded || track);
    }

    return {
      index: manager.tracks.indexOf(loaded || track),
      label: track.label,
      language: track.language,
      cues: track.cues.length,
    };
  },

  /**
   * Shows or hides one of the loaded subtitle tracks.
   * @param {EmbedAPI} api
   * @param {Object} args - `{index, active}`.
   */
  setSubtitleTrack(api, args) {
    const manager = api.client.interfaceController.subtitlesManager;
    const track = manager.tracks[requireNumber(args, 'index')];
    if (!track) {
      throw new Error('No such subtitle track');
    }

    if (args.active === false) {
      manager.deactivateTrack(track);
    } else {
      manager.activateTrack(track);
    }
  },

  /**
   * Unloads every subtitle track.
   * @param {EmbedAPI} api
   */
  clearSubtitles(api) {
    api.client.clearSubtitles();
  },

  /**
   * Takes the player in or out of fullscreen.
   *
   * The browser only allows this from a frame the embedder has allowed it in, and only
   * while the page holds a user gesture, so an embedder normally sends this from its own
   * click handler.
   *
   * @param {EmbedAPI} api
   * @param {Object} args - `{fullscreen}`.
   * @return {Promise<void>}
   */
  async setFullscreen(api, args) {
    if (!document.fullscreenEnabled) {
      throw new Error('Fullscreen is not allowed in this frame. Add allow="fullscreen" to the iframe.');
    }
    await api.client.interfaceController.fullscreenToggle(!!args.fullscreen);
  },

  /**
   * Takes the video in or out of picture-in-picture.
   *
   * As with fullscreen, the embedder must have allowed it and must be holding a user
   * gesture.
   *
   * @param {EmbedAPI} api
   * @param {Object} args - `{pictureInPicture}`.
   * @return {Promise<void>}
   */
  async setPictureInPicture(api, args) {
    await api.client.interfaceController.pipToggle(!!args.pictureInPicture);
  },

  /**
   * Asks for events to be sent to the window the command came from.
   * @param {EmbedAPI} api
   * @param {Object} args - `{events}`, a list of names, or nothing for all of them.
   * @param {Object} sender - The window and origin the command came from.
   * @return {Object} Which events will be sent.
   */
  subscribe(api, args, sender) {
    const events = Array.isArray(args.events) ? args.events.filter((name) => API_EVENTS.includes(name)) : null;
    if (events && !events.length) {
      throw new Error('None of the requested events exist');
    }

    api.addSubscriber(sender, events);
    return {events: events || API_EVENTS};
  },

  /**
   * Stops sending events to the window the command came from.
   * @param {EmbedAPI} api
   * @param {Object} args - Unused.
   * @param {Object} sender - The window and origin the command came from.
   */
  unsubscribe(api, args, sender) {
    api.removeSubscriber(sender);
  },
};

/**
 * Lets a page that has embedded the player in an iframe control it, by exchanging
 * messages with it.
 *
 * An embedder sends `{type: 'faststream:command', id, command, args}` and gets back
 * `{type: 'faststream:response', id, ok, result}` or, when the command failed,
 * `{type: 'faststream:response', id, ok: false, error}`. Replies go to the window the
 * command came from, at the origin it came from, so a command tells the API nothing about
 * where to send anything else.
 *
 * Events are sent only to embedders that asked for them with the subscribe command, other
 * than the one announcing that the player is ready, which has to go out before anyone can
 * have asked for anything.
 */
export class EmbedAPI {
  /**
   * @param {FastStreamClient} client - The player to expose.
   */
  constructor(client) {
    this.client = client;
    this.subscribers = [];
    this.playerContext = null;
    this.started = false;
    this.onMessage = this.handleMessage.bind(this);
  }

  /**
   * Starts listening for commands and announces the player to whoever embedded it.
   */
  start() {
    if (this.started) {
      return;
    }
    this.started = true;

    window.addEventListener('message', this.onMessage);

    // Each source gets its own player object, so the events have to be picked up again
    // every time the source changes.
    this.client.on('setsource', () => {
      this.attachToPlayer();
    });

    this.client.interfaceController.volumeControls.on('volume', () => {
      this.emitEvent(VOLUME_CHANGE_EVENT);
    });

    this.attachToPlayer();
    this.announce();
  }

  /**
   * Stops listening and forgets every subscriber.
   */
  destroy() {
    if (!this.started) {
      return;
    }
    this.started = false;
    window.removeEventListener('message', this.onMessage);
    this.subscribers.length = 0;

    if (this.playerContext) {
      this.playerContext.destroy();
      this.playerContext = null;
    }
  }

  /**
   * Describes the player, so an embedder can tell what it is talking to and what this
   * build of it understands.
   * @return {Object} The player's version, commands and events.
   */
  describe() {
    return {
      version: this.client.version,
      protocol: COMMAND_TYPE,
      commands: Object.keys(COMMANDS),
      events: API_EVENTS,
    };
  }

  /**
   * Collects everything an embedder might want to show about the player.
   * @return {Object} The current playback state.
   */
  getState() {
    const client = this.client;
    const video = client.currentVideo;
    const source = client.source;
    const volumeControls = client.interfaceController.volumeControls;

    return {
      version: client.version,
      hasSource: !!source,
      source: source ? {url: source.url, mode: source.mode, identifier: source.identifier} : null,
      paused: client.paused,
      buffering: !!client.state.buffering,
      ended: video ? video.ended : false,
      currentTime: client.currentTime,
      duration: client.duration,
      buffered: video ? serializeRanges(video.buffered) : [],
      volume: client.volume,
      muted: !!volumeControls.muted,
      playbackRate: client.playbackRate,
      videoWidth: video ? video.videoWidth : 0,
      videoHeight: video ? video.videoHeight : 0,
      videoLevel: client.getCurrentVideoLevelID(),
      audioLevel: client.getCurrentAudioLevelID(),
      fullscreen: !!client.state.fullscreen,
      pictureInPicture: client.interfaceController.isInPip(),
      needsUserInteraction: client.needsUserInteraction(),
    };
  }

  /**
   * Builds a source out of what an embedder asked to play.
   *
   * The mode decides which of the players handles the url. An embedder that knows what it
   * is serving can name one; otherwise it is guessed from the url the same way the
   * player guesses for a url typed into it.
   *
   * @param {Object} args - `{url, mode, headers}`.
   * @return {VideoSource} The source to hand to the client.
   */
  buildSource(args) {
    const url = requireString(args, 'url');
    const mode = args.mode === undefined ? URLUtils.getModeFromURL(url) : args.mode;

    if (!LOADABLE_MODES.includes(mode)) {
      throw new Error(`mode must be one of ${LOADABLE_MODES.join(', ')}`);
    }

    if (args.headers !== undefined && (typeof args.headers !== 'object' || args.headers === null)) {
      throw new Error('headers must be an object');
    }

    return new VideoSource(url, args.headers || {}, mode);
  }

  /**
   * Listens to the player that is playing now, in place of whichever one was playing
   * before.
   */
  attachToPlayer() {
    if (this.playerContext) {
      this.playerContext.destroy();
      this.playerContext = null;
    }

    const player = this.client.player;
    if (!player) {
      return;
    }

    this.playerContext = player.createContext();
    FORWARDED_EVENTS.forEach((name) => {
      this.playerContext.on(name, (arg) => {
        this.emitEvent(name, name === DefaultPlayerEvents.ERROR ? {message: describeError(arg)} : null);
      });
    });

    this.emitEvent(SOURCE_CHANGE_EVENT);
  }

  /**
   * Tells whoever embedded the player that it has finished loading.
   *
   * The embedder has no other way to know: an iframe's load event fires before the
   * player's modules have run, so a command sent then would arrive before anything was
   * listening. The announcement is sent with a wildcard target because the embedder's
   * origin is not knowable from in here, which is safe enough — it reaches only the
   * window that embedded this one, and says nothing but what this player is.
   */
  announce() {
    const message = {
      type: EVENT_TYPE,
      event: READY_EVENT,
      state: this.getState(),
      detail: this.describe(),
    };

    [window.parent, window.opener].forEach((target) => {
      if (!target || target === window) {
        return;
      }
      try {
        target.postMessage(message, '*');
      } catch (e) {
        console.warn('Failed to announce the player', e);
      }
    });
  }

  /**
   * Starts sending events to a window.
   * @param {Object} sender - The window and origin to send to.
   * @param {Array<string>|null} events - The events to send, or null for all of them.
   */
  addSubscriber(sender, events) {
    this.removeSubscriber(sender);
    this.subscribers.push({
      source: sender.source,
      origin: sender.origin,
      events,
    });
  }

  /**
   * Stops sending events to a window.
   * @param {Object} sender - The window to stop sending to.
   */
  removeSubscriber(sender) {
    this.subscribers = this.subscribers.filter((subscriber) => subscriber.source !== sender.source);
  }

  /**
   * Sends an event to every subscriber that asked for it.
   * @param {string} name - The event's name.
   * @param {Object} [detail] - Anything the event carries beyond the state.
   */
  emitEvent(name, detail) {
    if (!this.subscribers.length) {
      return;
    }

    const message = {
      type: EVENT_TYPE,
      event: name,
      state: this.getState(),
      detail: detail || null,
    };

    this.subscribers.slice().forEach((subscriber) => {
      if (subscriber.events && !subscriber.events.includes(name)) {
        return;
      }
      this.post(subscriber, message);
    });
  }

  /**
   * Sends a message to a window, and forgets the window if it has gone away.
   * @param {Object} subscriber - The window and origin to send to.
   * @param {Object} message - What to send.
   */
  post(subscriber, message) {
    const source = subscriber.source;
    if (!source || source.closed) {
      this.removeSubscriber(subscriber);
      return;
    }

    try {
      source.postMessage(message, EmbedAPI.targetOrigin(subscriber.origin));
    } catch (e) {
      console.warn('Failed to send to an embedder', e);
      this.removeSubscriber(subscriber);
    }
  }

  /**
   * Runs a command that arrived from an embedder and answers it.
   * @param {MessageEvent} event
   * @return {Promise<void>}
   */
  async handleMessage(event) {
    const data = event.data;
    if (!data || data.type !== COMMAND_TYPE || !event.source) {
      return;
    }

    const sender = {source: event.source, origin: event.origin};
    const name = data.command;

    if (typeof name !== 'string' || !Object.hasOwn(COMMANDS, name)) {
      this.respond(sender, data.id, {ok: false, error: {message: `Unknown command: ${name}`}});
      return;
    }

    try {
      const result = await COMMANDS[name](this, data.args || {}, sender);
      this.respond(sender, data.id, {ok: true, result: result === undefined ? null : result});
    } catch (e) {
      console.warn(`Embed API command ${name} failed`, e);
      this.respond(sender, data.id, {ok: false, error: {message: describeError(e)}});
    }
  }

  /**
   * Answers a command.
   * @param {Object} sender - The window and origin the command came from.
   * @param {*} id - Whatever the embedder labelled the command with.
   * @param {Object} body - The outcome, either `{ok: true, result}` or `{ok: false, error}`.
   */
  respond(sender, id, body) {
    try {
      sender.source.postMessage({
        type: RESPONSE_TYPE,
        id: id === undefined ? null : id,
        ...body,
      }, EmbedAPI.targetOrigin(sender.origin));
    } catch (e) {
      console.warn('Failed to answer an embedder', e);
    }
  }

  /**
   * Picks what to address a message to.
   *
   * A sandboxed embedder has an opaque origin, which arrives as the string "null" and
   * which postMessage refuses as a target. Such a window can only be addressed by a
   * wildcard; the message still goes to that one window, and carries only the player's
   * own state.
   *
   * @param {string} origin - The origin a message came from.
   * @return {string} The origin to send back to.
   */
  static targetOrigin(origin) {
    return origin && origin !== 'null' ? origin : '*';
  }
}
