import {AAC} from '../../hls.mjs';
import {TrackTypes} from '../enums/TrackTypes.mjs';
import {AudioSample} from './AudioSample.mjs';

export class MultiChannelSampleAdjuster {
  constructor(tracks) {
    this.initialize(tracks);
  }

  initialize(tracks) {
    tracks.forEach((track) => {
      if (!track) return;
      if (track.type === TrackTypes.VIDEO) {
        this.videoQueue = {
          id: track.id,
          samples: [],
          outputSamples: [],
          track,
          dts_target: null,
          isContiguous: false,
        };
      } else if (track.type === TrackTypes.AUDIO) {
        this.audioQueue = {
          id: track.id,
          samples: [],
          outputSamples: [],
          track,
          pts_target: null,
          isContiguous: false,
        };
      }
    });
  }

  pushSamples(trackId, samples) {
    let queue;

    if (this.videoQueue && this.videoQueue.id === trackId) {
      queue = this.videoQueue;
    } else if (this.audioQueue && this.audioQueue.id === trackId) {
      queue = this.audioQueue;
    } else {
      return;
    }

    queue.samples.push(...samples);
  }

  findKeyframeIndex(samples) {
    for (let i = 0; i < samples.length; i++) {
      if (samples[i].isKey) {
        return i;
      }
    }
    return -1;
  }

  getVideoStartPts(samples) {
    return samples.reduce((acc, sample) => {
      return Math.min(acc, sample.pts);
    }, samples[0].pts);
  }

  process() {
    const timeOffset = 0;

    const {videoQueue, audioQueue} = this;
    const hasAudio = !!audioQueue;
    const hasVideo = !!videoQueue;

    const enoughAudioSamples = hasAudio && audioQueue.samples.length > 0;
    const enoughVideoSamples = hasVideo && videoQueue.samples.length > 0;
    let videoTimeOffset = timeOffset;
    let audioTimeOffset = timeOffset;
    let firstKeyFrameIndex = -1;

    const canRemux = ((!hasAudio || enoughAudioSamples) &&
    (!hasVideo || enoughVideoSamples));
    if (!canRemux) {
      return;
    }


    if (enoughVideoSamples) {
      firstKeyFrameIndex = this.findKeyframeIndex(videoQueue.samples);
      if (!videoQueue.isContiguous) {
        if (firstKeyFrameIndex > 0) {
          console.warn('Dropping ' + firstKeyFrameIndex + ' non-key frames');
          const startPTS = this.getVideoStartPts(videoQueue.samples);
          videoQueue.samples.splice(0, firstKeyFrameIndex);
          videoTimeOffset += (videoQueue.samples[0].pts - startPTS) / videoQueue.samples[0].timescale;
        } else if (firstKeyFrameIndex === -1) {
          console.warn('No key frame found');
        }
      }
    }

    if (enoughAudioSamples && enoughVideoSamples) {
      const startPTS = this.getVideoStartPts(videoQueue.samples);
      const tsDelta = audioQueue.samples[0].pts / audioQueue.samples[0].timescale - startPTS / videoQueue.samples[0].timescale;
      audioTimeOffset += Math.max(0, tsDelta);
      videoTimeOffset += Math.max(0, -tsDelta);
    }

    if (enoughAudioSamples) {
      const audio = this.patchAudio(
          audioQueue,
          audioTimeOffset,
          audioQueue.isContiguous,
              (hasVideo || enoughVideoSamples) ? videoTimeOffset : null,
              audioQueue.pts_target,
      );
      if (audio) {
        audioQueue.pts_target = audio.next_pts_target;
        audioQueue.isContiguous = true;
      }

      if (enoughVideoSamples) {
        const video = this.patchVideo(
            videoQueue,
            videoTimeOffset,
            videoQueue.isContiguous,
            videoQueue.dts_target,
        );
        if (video) {
          videoQueue.dts_target = video.next_dts_target;
          videoQueue.isContiguous = true;
        }
      }
    } else if (enoughVideoSamples) {
      const video = this.patchVideo(
          videoQueue,
          videoTimeOffset,
          videoQueue.isContiguous,
          videoQueue.dts_target,
      );
      if (video) {
        videoQueue.dts_target = video.next_dts_target;
        videoQueue.isContiguous = true;
      }
    }
  }

  getAllSamples() {
    const results = new Map();
    if (this.videoQueue) {
      results.set(this.videoQueue.id, this.videoQueue.outputSamples);
      this.videoQueue.outputSamples = [];
    }

    if (this.audioQueue) {
      results.set(this.audioQueue.id, this.audioQueue.outputSamples);
      this.audioQueue.outputSamples = [];
    }

    return results;
  }

  patchVideo(
      videoQueue,
      pts_estimate_in_sec,
      contiguous,
      dts_target,
  ) {
    const timeScale = videoQueue.samples[0].timescale;
    const inputSamples = videoQueue.samples;
    const init_pts_in_sec = 0;

    // if parsed fragment is contiguous with last one, let's use last DTS value as reference
    if (!contiguous || dts_target === null) {
      const pts_estimate = pts_estimate_in_sec * timeScale;
      const composition_offset = inputSamples[0].coffset;

      // if not contiguous, let's use target timeOffset
      dts_target = pts_estimate - composition_offset;
    }

    const initTime = init_pts_in_sec * timeScale;
    for (let i = 0; i < inputSamples.length; i++) {
      const sample = inputSamples[i];
      sample.pts -= initTime;
    }

    // sort video samples by DTS then PTS then demux id order
    let needs_sorting = false;
    for (let i = 1; i < inputSamples.length; i++) {
      const current_dts = inputSamples[i].pts - inputSamples[i].coffset;
      const prev_dts = inputSamples[i - 1].pts - inputSamples[i - 1].coffset;
      if (current_dts < prev_dts) {
        needs_sorting = true;
      }
    }

    if (needs_sorting) {
      inputSamples.sort((a, b) => {
        const a_dts = a.pts - a.coffset;
        const b_dts = b.pts - b.coffset;
        const deltadts = a_dts - b_dts;
        const deltapts = a.pts - b.pts;
        return deltadts || deltapts;
      });
    }

    // Get first/last DTS
    let first_dts = inputSamples[0].pts - inputSamples[0].coffset;
    let last_dts = inputSamples[inputSamples.length - 1].pts - inputSamples[inputSamples.length - 1].coffset;

    // Sample duration (as expected by trun MP4 boxes), should be the delta between sample DTS
    // set this constant duration as being the avg delta between consecutive DTS.
    const inputDuration = last_dts - first_dts;
    const average_sample_duration = inputDuration ?
      Math.round(inputDuration / (inputSamples.length - 1)) :
      (timeScale / 30);

    // if fragment are contiguous, detect hole/overlapping between fragments
    if (contiguous) {
      // check timestamp continuity across consecutive fragments (this is to remove inter-fragment gap/hole)
      const delta_target_dts = first_dts - dts_target;
      const found_hole = delta_target_dts > average_sample_duration;
      const found_overlap = delta_target_dts < -1;
      if (found_hole || found_overlap) {
        if (found_hole) {
          console.warn(
              `${(videoQueue.segmentCodec || '').toUpperCase()}: ${delta_target_dts}dts hole between fragments detected at ${pts_estimate_in_sec.toFixed(
                  3,
              )}`,
          );
        } else {
          console.warn(
              `${(videoQueue.segmentCodec || '').toUpperCase()}: ${delta_target_dts}dts overlapping between fragments detected at ${pts_estimate_in_sec.toFixed(
                  3,
              )}`,
          );
        }

        // Shrink the gap/overlap by adjusting initial DTS
        first_dts = dts_target;
        const first_pts_adjusted = inputSamples[0].pts - delta_target_dts;

        if (found_hole) {
          inputSamples[0].pts = first_pts_adjusted;
        } else { // When overlapping, adjust all subsequent sample's DTS to remove overlap
          let isPTSOrderRetained = true;
          for (let i = 0; i < inputSamples.length; i++) {
            if (inputSamples[i].pts - inputSamples[i].coffset > first_pts_adjusted && isPTSOrderRetained) {
              break;
            }

            const prevPTS = inputSamples[i].pts;
            inputSamples[i].pts -= delta_target_dts;

            // check to see if this sample's PTS order has changed
            // relative to the next one
            if (i < inputSamples.length - 1) {
              const nextSamplePTS = inputSamples[i + 1].pts;
              const currentSamplePTS = inputSamples[i].pts;

              const currentOrder = nextSamplePTS <= currentSamplePTS;
              const prevOrder = nextSamplePTS <= prevPTS;

              isPTSOrderRetained = currentOrder == prevOrder;
            }
          }
        }
        console.log(
            `Video: Initial PTS/DTS adjusted: ${first_pts_adjusted}/${first_dts}, delta: ${delta_target_dts} ms`,
        );
      }
    }

    if (inputSamples.length === 0) {
      return;
    }

    // ensure sample monotonic DTS
    first_dts = Math.max(0, first_dts);
    let dtsStep = first_dts;
    for (let i = 0; i < inputSamples.length; i++) {
      const sample = inputSamples[i];
      const sample_dts = sample.pts - sample.coffset;
      if (sample_dts < dtsStep) {
        const newdts = dts = dtsStep;
        sample.coffset = sample.pts - newdts;
        dtsStep += (average_sample_duration / 4) | 0 || 1;
      } else {
        dtsStep = sample.dts;
      }
    }
    last_dts = inputSamples[inputSamples.length - 1].dts;

    // compute min and max pts
    let min_pts = Number.POSITIVE_INFINITY;
    let max_pts = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < inputSamples.length; i++) {
      const sample = inputSamples[i];
      min_pts = Math.min(sample.pts, min_pts);
      max_pts = Math.max(sample.pts, max_pts);
    }

    let last_sample_duration_estimate;
    if (inputSamples.length.length > 1) {
      const lastSample = inputSamples[inputSamples.length - 1];
      const lastLastSample = inputSamples[inputSamples.length - 2];
      const ls_dts = lastSample.pts - lastSample.coffset;
      const lls_dts = lastLastSample.pts - lastLastSample.coffset;
      last_sample_duration_estimate = ls_dts - lls_dts;
    } else {
      last_sample_duration_estimate = average_sample_duration;
    }

    videoQueue.outputSamples = inputSamples;
    videoQueue.samples = [];

    // next AVC/HEVC sample DTS should be equal to last sample DTS + last sample duration (in PES timescale)
    dts_target = last_dts + last_sample_duration_estimate;

    const data = {
      next_dts_target: dts_target,
      timeScale,
      startPTS: min_pts,
      endPTS: max_pts + last_sample_duration_estimate,
      startDTS: first_dts,
      endDTS: dts_target,
    };
    return data;
  }

  getSamplesPerFrame(track) {
    switch (track.codec.split('.')[0]) {
      case 'mp3':
        return 1152;
      case 'ac3':
        return 1536;
      default:
        return 1024;
    }
  }

  patchAudio(
      audioQueue,
      pts_estimate_in_sec,
      contiguous,
      videoTimeOffset,
      pts_target,
  ) {
    const init_pts_in_sec = 0;
    const sample_rate = audioQueue.track.sampleRate;
    const inputTimeScale = audioQueue.samples[0].timescale;
    const mp4timeScale = sample_rate ?
      sample_rate :
      inputTimeScale;
    const scaleFactor = inputTimeScale / mp4timeScale;

    const audio_samples_per_frame = this.getSamplesPerFrame(audioQueue.track);
    const inputSampleDuration = audio_samples_per_frame * scaleFactor;
    const alignedWithVideo = videoTimeOffset !== undefined;

    let inputSamples = audioQueue.samples;

    // window.audioSamples ? window.audioSamples.push(inputSamples.map(s => s.pts)) : (window.audioSamples = [inputSamples.map(s => s.pts)]);

    // for audio samples, also consider consecutive fragments as being contiguous (even if a level switch occurs),
    // for sake of clarity:
    // consecutive fragments are frags with
    //  - less than 100ms gaps between new time offset (if accurate) and next expected PTS OR
    //  - less than 20 audio frames distance
    // contiguous fragments are consecutive fragments from same quality level (same level, new SN = old SN + 1)
    // this helps ensuring audio continuity
    // and this also avoids audio glitches/cut when switching quality, or reporting wrong duration on first audio frame
    const initTime = init_pts_in_sec * inputTimeScale;

    if (!contiguous && inputSamples.length && pts_target > 0) {
      contiguous = Math.abs(inputSamples[0].pts - initTime - pts_target) <20 * inputSampleDuration;
    }

    if (!contiguous || pts_target < 0) {
      // filter out sample with negative PTS that are not playable anyway
      // if we don't remove these negative samples, they will shift all audio samples forward.
      // leading to audio overlap between current / next fragment
      inputSamples = inputSamples.filter((sample) => sample.pts >= 0);

      // in case all samples have negative PTS, and have been filtered out, return now
      if (!inputSamples.length) {
        return;
      }

      if (videoTimeOffset === 0) {
        // Set the start to 0 to match video so that start gaps larger than inputSampleDuration are filled with silence
        pts_target = 0;
      } else {
        // if frags are not contiguous and if we cant trust time offset, let's use first sample PTS as next audio PTS
        pts_target = inputSamples[0].pts;
      }
    }

    // If the audio track is missing samples, the frames seem to get "left-shifted" within the
    // resulting mp4 segment, causing sync issues and leaving gaps at the end of the audio segment.
    // In an effort to prevent this from happening, we inject frames here where there are gaps.
    // When possible, we inject a silent frame; when that's not possible, we duplicate the last
    // frame.

    const isAac = audioQueue.track.codec.split('.')[0] === 'mp4a';

    if (isAac) {
      const maxAudioFramesDrift = 1;
      for (let i = 0, nextPts = pts_target; i < inputSamples.length; i++) {
        // First, let's see how far off this frame is from where we expect it to be
        const sample = inputSamples[i];
        const pts = sample.pts;
        const delta = pts - nextPts;
        const duration = Math.abs((1000 * delta) / inputTimeScale);

        // When remuxing with video, if we're overlapping by more than a duration, drop this sample to stay in sync
        if (
          delta <= -maxAudioFramesDrift * inputSampleDuration &&
          alignedWithVideo
        ) {
          if (i === 0) {
            console.warn(
                `Audio frame @ ${(pts / inputTimeScale).toFixed(
                    3,
                )}s overlaps nextAudioPts by ${Math.round(
                    (1000 * delta) / inputTimeScale,
                )} ms.`,
            );
            pts_target = nextPts = pts;
          }
        } // eslint-disable-line brace-style

        // Insert missing frames if:
        // 1: We're more than maxAudioFramesDrift frame away
        // 2: Not more than MAX_SILENT_FRAME_DURATION away
        // 3: currentTime (aka nextPtsNorm) is not 0
        // 4: remuxing with video (videoTimeOffset !== undefined)
        else if (
          delta >= maxAudioFramesDrift * inputSampleDuration &&
          duration < 10 * 1000 &&
          alignedWithVideo
        ) {
          let missing = Math.round(delta / inputSampleDuration);
          // Adjust nextPts so that silent samples are aligned with media pts. This will prevent media samples from
          // later being shifted if nextPts is based on timeOffset and delta is not a multiple of inputSampleDuration.
          nextPts = pts - missing * inputSampleDuration;
          if (nextPts < 0) {
            missing--;
            nextPts += inputSampleDuration;
          }
          if (i === 0) {
            pts_target = nextPts;
          }
          console.warn(
              `Injecting ${missing} audio frame @ ${(
                nextPts / inputTimeScale
              ).toFixed(3)}s due to ${Math.round(
                  (1000 * delta) / inputTimeScale,
              )} ms gap.`,
          );
          for (let j = 0; j < missing; j++) {
            const newStamp = Math.max(nextPts, 0);
            let fillFrame = AAC.getSilentFrame(
                audioQueue.track.codec,
                audioQueue.track.numberOfChannels,
            );
            if (!fillFrame) {
              console.log(
                  'Unable to get silent frame for given audio codec; duplicating last frame instead.',
              );
              fillFrame = sample.data.slice();
            }
            inputSamples.splice(i, 0, new AudioSample({
              pts: newStamp,
              timescale: inputTimeScale,
              data: fillFrame,
            }));
            nextPts += inputSampleDuration;
            i++;
          }
        }
        sample.pts = nextPts;
        nextPts += inputSampleDuration;
      }
    }

    let firstPTS = null;
    let lastPTS = null;

    if (inputSamples.length > 0) {
      if (contiguous && isAac) {
        // set PTS/DTS to expected PTS/DTS
        inputSamples[0].pts = pts_target;
      }
      firstPTS = inputSamples[0].pts;
    } else {
      return;
    }

    if (inputSamples.length > 0) {
      const lastSample = inputSamples[inputSamples.length - 1];
      lastPTS = lastSample.pts;
    }

    let lastDuration;
    if (inputSamples.length > 1) {
      lastDuration = inputSamples[inputSamples.length - 1].pts - inputSamples[inputSamples.length - 2].pts;
    } else {
      lastDuration = inputSampleDuration;
    }

    audioQueue.outputSamples = inputSamples;
    audioQueue.samples = [];

    // The next audio sample PTS should be equal to last sample PTS + duration
    pts_target =
      lastPTS + lastDuration;


    // Clear the track samples. This also clears the samples array in the demuxer, since the reference is shared
    const start = firstPTS;
    const end = pts_target;
    const audioData = {
      next_pts_target: pts_target,
      startPTS: start,
      endPTS: end,
      startDTS: start,
      endDTS: end,
    };
    return audioData;
  }
}
