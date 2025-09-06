// import {StatefulResampler} from './resampler.mjs';
import {ConverterType, create} from './libsamplerate.mjs';

const resamplers = [];
let loadPromise = null;
let newSampleRate = null;
let numChannels;

function resampleAudioSample(data) {
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

  const resampled = [];
  for (let i = 0; i < numChannels; i++) {
    const currentSample = channels[i];
    const resampler = resamplers[i];
    resampled.push(resampler.full(currentSample));
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
    timestamp: data.timestamp,
    sampleRate: newSampleRate,
    data: resampledData,
  });
  return newAudio;
}

addEventListener('message', async (event) => {
  await loadPromise;
  if (event.data.type === 'close') {
    // destroy
    resamplers.forEach((resampler) => {
      try {
        resampler.destroy();
      } catch (e) {
      }
    });
    close();
  } else if (event.data.type === 'init') {
    numChannels = event.data.numChannels;
    const promises = [];
    for (let i = 0; i < numChannels; i++) {
      promises.push(create(1, event.data.oldSampleRate, event.data.newSampleRate, {
        converterType: ConverterType.SRC_SINC_MEDIUM_QUALITY,
      }));
    }
    newSampleRate = event.data.newSampleRate;

    loadPromise = Promise.all(promises).then((instances) => {
      resamplers.push(...instances);
      console.log('Resampler instances created');
    });
  } else if (event.data.type === 'pushSample') {
    const result = resampleAudioSample(event.data.data);
    if (!result) {
      return;
    }
    postMessage({
      type: 'resampled',
      data: result,
    }, [result]);
  }
});
