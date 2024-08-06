import {StatefulResampler} from './resampler.mjs';


let resampler;
const pastSamples = [null, null, null];
const pastTimestamps = [-1, -1, -1];
const remainders = [];
let numChannels;

function pushSample(data) {
  const format = data.format;
  let isInterleaved = false;
  let TypedArrayConstructor;
  switch (format) {
    case 'u8':
      isInterleaved = true;
      TypedArrayConstructor = Uint8Array;
      break;
    case 's16':
      isInterleaved = true;
      TypedArrayConstructor = Int16Array;
      break;
    case 's32':
      isInterleaved = true;
      TypedArrayConstructor = Int32Array;
    case 'f32':
      isInterleaved = true;
      TypedArrayConstructor = Float32Array;
      break;
    case 'u8-planar':
      isInterleaved = false;
      TypedArrayConstructor = Uint8Array;
      break;
    case 's16-planar':
      isInterleaved = false;
      TypedArrayConstructor = Int16Array;
      break;
    case 's32-planar':
      isInterleaved = false;
      TypedArrayConstructor = Int32Array;
      break;
    case 'f32-planar':
      isInterleaved = false;
      TypedArrayConstructor = Float32Array;
      break;
    default:
      throw new Error('unsupported audio format');
  }
  const numFrames = data.numberOfFrames;
  const channels = [];

  if (isInterleaved) {
    const audioDataBuffer = new TypedArrayConstructor(numChannels * numFrames);
    data.copyTo(audioDataBuffer, {
      planeIndex: 0,
    });
    for (let i = 0; i < numChannels; i++) {
      const channelBuffer = new TypedArrayConstructor(numFrames);
      for (let j = 0; j < numFrames; j++) {
        channelBuffer[j] = audioDataBuffer[j * numChannels + i];
      }
      channels.push(channelBuffer);
    }
  } else {
    for (let i = 0; i < numChannels; i++) {
      const channelData = new TypedArrayConstructor(numFrames);
      data.copyTo(channelData, {
        planeIndex: i,
      });
      channels.push(channelData);
    }
  }
  data.close();

  if (data.timestamp <= pastTimestamps[pastTimestamps.length - 1]) {
    throw new Error('out of order audio data');
  }

  pastSamples.push(channels);
  pastTimestamps.push(data.timestamp);


  // Remove first
  pastSamples.shift();
  pastTimestamps.shift();
}

function runResampler(shift) {
  if (shift) {
    pastSamples.shift();
    pastTimestamps.shift();
    pastSamples.push(null);
    pastTimestamps.push(-1);
  }
  const past = pastSamples[0];
  const current = pastSamples[1];
  const next = pastSamples[2];
  const currentTimestamp = pastTimestamps[1];

  if (!current) {
    return;
  }

  const resampled = [];
  for (let i = 0; i < numChannels; i++) {
    const pastSample = past ? past[i] : null;
    const currentSample = current[i];
    const nextSample = next ? next[i] : null;
    const remainder = {
      remainder: remainders[i],
    };
    const resampledChannel = resampler.resample(pastSample, currentSample, nextSample, remainder);
    resampled.push(resampledChannel);

    if (i === numChannels - 1) {
      remainders[i] = remainder.remainder;
    }
  }

  const newNumSamples = resampled[0].length;
  const resampledData = new Float32Array(newNumSamples * numChannels);
  for (let i = 0; i < numChannels; i++) {
    resampled[i].forEach((v, j) => {
      resampledData[i * newNumSamples + j] = v;
    });
  }

  const newAudio = new AudioData({
    format: 'f32-planar',
    numberOfChannels: numChannels,
    numberOfFrames: newNumSamples,
    timestamp: currentTimestamp,
    sampleRate: resampler.newSampleRate,
    data: resampledData,
  });

  return newAudio;
};

addEventListener('message', async (event) => {
  if (event.data.type === 'close') {
    close();
  } else if (event.data.type === 'init') {
    numChannels = event.data.numChannels;
    for (let i = 0; i < numChannels; i++) {
      remainders.push(0);
    }
    resampler = new StatefulResampler(event.data.oldSampleRate, event.data.newSampleRate, event.data.details);
  } else if (event.data.type === 'pushSample') {
    pushSample(event.data.data);
    const result = runResampler();
    if (!result) {
      return;
    }
    postMessage({
      type: 'resampled',
      data: result,
    }, [result]);
  } else if (event.data.type === 'finish') {
    const result = runResampler(true);
    if (!result) {
      return;
    }
    postMessage({
      type: 'resampled',
      data: result,
    }, [result]);
  }
});
