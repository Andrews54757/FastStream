import {DefaultPlayerEvents} from '../enums/DefaultPlayerEvents.mjs';

export class VideoUtils {
  static addPassthroughEventListenersToVideo(video, emitter) {
    video.addEventListener(DefaultPlayerEvents.ABORT, (event) => {
      emitter.emit(DefaultPlayerEvents.ABORT);
    });

    video.addEventListener(DefaultPlayerEvents.CANPLAY, (event) => {
      emitter.emit(DefaultPlayerEvents.CANPLAY);
    });

    video.addEventListener(DefaultPlayerEvents.CANPLAYTHROUGH, (event) => {
      emitter.emit(DefaultPlayerEvents.CANPLAYTHROUGH);
    });

    video.addEventListener(DefaultPlayerEvents.COMPLETE, (event) => {
      emitter.emit(DefaultPlayerEvents.COMPLETE);
    });

    video.addEventListener(DefaultPlayerEvents.DURATIONCHANGE, (event) => {
      emitter.emit(DefaultPlayerEvents.DURATIONCHANGE);
    });

    video.addEventListener(DefaultPlayerEvents.EMPTIED, (event) => {
      emitter.emit(DefaultPlayerEvents.EMPTIED);
    });


    video.addEventListener(DefaultPlayerEvents.ENDED, (event) => {
      emitter.emit(DefaultPlayerEvents.ENDED);
    });


    video.addEventListener(DefaultPlayerEvents.ERROR, (event) => {
      emitter.emit(DefaultPlayerEvents.ERROR, event);
    });


    video.addEventListener(DefaultPlayerEvents.LOADEDDATA, (event) => {
      emitter.emit(DefaultPlayerEvents.LOADEDDATA);
    });


    video.addEventListener(DefaultPlayerEvents.LOADEDMETADATA, (event) => {
      emitter.emit(DefaultPlayerEvents.LOADEDMETADATA);
    });


    video.addEventListener(DefaultPlayerEvents.PAUSE, (event) => {
      emitter.emit(DefaultPlayerEvents.PAUSE);
    });


    video.addEventListener(DefaultPlayerEvents.PLAY, (event) => {
      emitter.emit(DefaultPlayerEvents.PLAY);
    });


    video.addEventListener(DefaultPlayerEvents.PLAYING, (event) => {
      emitter.emit(DefaultPlayerEvents.PLAYING);
    });


    video.addEventListener(DefaultPlayerEvents.PROGRESS, (event) => {
      emitter.emit(DefaultPlayerEvents.PROGRESS);
    });


    video.addEventListener(DefaultPlayerEvents.RATECHANGE, (event) => {
      emitter.emit(DefaultPlayerEvents.RATECHANGE);
    });


    video.addEventListener(DefaultPlayerEvents.SEEKED, (event) => {
      emitter.emit(DefaultPlayerEvents.SEEKED);
    });


    video.addEventListener(DefaultPlayerEvents.SEEKING, (event) => {
      emitter.emit(DefaultPlayerEvents.SEEKING);
    });


    video.addEventListener(DefaultPlayerEvents.STALLED, (event) => {
      emitter.emit(DefaultPlayerEvents.STALLED);
    });


    video.addEventListener(DefaultPlayerEvents.SUSPEND, (event) => {
      emitter.emit(DefaultPlayerEvents.SUSPEND);
    });


    video.addEventListener(DefaultPlayerEvents.TIMEUPDATE, (event) => {
      emitter.emit(DefaultPlayerEvents.TIMEUPDATE);
    });


    video.addEventListener(DefaultPlayerEvents.VOLUMECHANGE, (event) => {
      emitter.emit(DefaultPlayerEvents.VOLUMECHANGE);
    });

    video.addEventListener(DefaultPlayerEvents.WAITING, (event) => {
      emitter.emit(DefaultPlayerEvents.WAITING);
    });
  }

  static destroyVideo(video) {
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch (e) {
      console.error(e);
    }
  }

  static isBuffered(buffered, time) {
    if (buffered.length === 0) return false;
    const currentTime = time;
    for (let i = 0; i < buffered.length; i++) {
      if (currentTime >= buffered.start(i) && currentTime <= buffered.end(i)) {
        return true;
      }
    }
    return false;
  }
}
