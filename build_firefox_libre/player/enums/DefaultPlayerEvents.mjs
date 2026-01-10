export const DefaultPlayerEvents = {
  /**
    * The abort event is fired when the resource was not fully loaded, but not as the result of an error.
    */
  ABORT: 'abort',
  /**
   * The browser can play the media, but estimates that not enough data has been loaded to play the media up to its end without having to stop for further buffering of content.
   */
  CANPLAY: 'canplay',
  /**
   * The browser estimates it can play the media up to its end without stopping for content buffering.
   */
  CANPLAYTHROUGH: 'canplaythrough',
  /**
   * The rendering of an OfflineAudioContext is terminated.
   */
  COMPLETE: 'complete',
  /**
   * The duration attribute has been updated.
   */
  DURATIONCHANGE: 'durationchange',
  /**
   * The media has become empty; for example, this event is sent if the media has already been loaded (or partially loaded), and the load() method is called to reload it.
   */
  EMPTIED: 'emptied',
  /**
   * Playback has stopped because the end of the media was reached.
   */
  ENDED: 'ended',
  /**
   * The first frame of the media has finished loading.
   */
  LOADEDDATA: 'loadeddata',
  /**
   * The metadata has been loaded.
   */
  LOADEDMETADATA: 'loadedmetadata',
  /**
   * Playback has been paused.
   */
  PAUSE: 'pause',
  /**
   * Playback has begun.
   */
  PLAY: 'play',
  /**
   * Playback is ready to start after having been paused or delayed due to lack of data.
   */
  PLAYING: 'playing',
  /**
   * Fired periodically as the browser loads a resource.
   */
  PROGRESS: 'progress',
  /**
   * The playback rate has changed.
   */
  RATECHANGE: 'ratechange',
  /**
   * A seek operation completed.
   */
  SEEKED: 'seeked',
  /**
   * A seek operation began.
   */
  SEEKING: 'seeking',
  /**
   * The user agent is trying to fetch media data, but data is unexpectedly not forthcoming.
   */
  STALLED: 'stalled',
  /**
   * The loading of a resource has been suspended.
   */
  SUSPEND: 'suspend',
  /**
   * The time indicated by the currentTime attribute has been updated.
   */
  TIMEUPDATE: 'timeupdate',
  /**
   * The volume has changed.
   */
  VOLUMECHANGE: 'volumechange',
  /**
   * Playback has stopped because of a temporary lack of data.
   */
  WAITING: 'waiting',
  LEVELUPDATE: 'levelupdate',
  FRAGMENT_UPDATE: 'fragmentupdate',
  /**
   * The manifest has been loaded. Levels are available
   * @param {number} suggestedLevel - The suggested level to load
   */
  MANIFEST_PARSED: 'manifestparsed',
  DESTROYED: 'destroyed',
  /**
   * Failed to load video
   */
  ERROR: 'error',
  /**
   * Fired when the player requests a key (DRM not supported)
   */
  NEED_KEY: 'needkey',
  /**
   * Fired when the player has skip segments
   */
  SKIP_SEGMENTS: 'skipsegments',
  /**
   * Fired when the player has playlist
   */
  PLAYLIST: 'playlist',
};
