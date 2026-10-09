import {MessageTypes} from '../../enums/MessageTypes.mjs';

export async function getPoTokens(videoId, visitorData) {
  const response = await chrome.runtime.sendMessage({
    type: MessageTypes.REQUEST_YT_PO_TOKENS,
    videoId,
    visitorData,
  });
  if (response?.error) {
    throw new Error(response.error);
  }
  if (!response || typeof response.contentToken !== 'string' || !response.contentToken ||
      typeof response.sessionToken !== 'string' || !response.sessionToken ||
      typeof response.visitorData !== 'string' || !response.visitorData ||
      (visitorData && response.visitorData !== visitorData)) {
    throw new Error('YouTube did not return valid playback tokens.');
  }
  return response;
}
