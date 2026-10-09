// Mint in YouTube's MAIN world using its own WebPoClient.
// https://github.com/LuanRT/ump-inspector/blob/main/src/capture/injected.ts
(() => {
  function getClientWindow() {
    try {
      // Embedded players can have a cross-origin top window.
      if (window.top.location.origin === window.location.origin) {
        return window.top;
      }
    } catch (error) {
      // Use the embedded YouTube page's client instead.
    }
    return window;
  }

  async function mintTokens(videoId, visitorData) {
    if (typeof videoId !== 'string' || !/^[\w-]{11}$/.test(videoId) ||
        (visitorData !== undefined && (typeof visitorData !== 'string' || !visitorData || visitorData.length > 4096))) {
      throw new Error('Invalid YouTube token binding.');
    }

    const clientWindow = getClientWindow();
    const deadline = Date.now() + 10000;
    let provider;
    while (Date.now() < deadline) {
      // Prefer the first client; other clients can return a static token regardless of binding.
      const key = 'havuokmhhs-0' in clientWindow ? 'havuokmhhs-0' :
        Object.keys(clientWindow).find((key) => key.startsWith('havuokmhhs'));
      provider = key && clientWindow[key]?.bevasrs;
      visitorData = visitorData || clientWindow.ytcfg?.get?.('VISITOR_DATA') ||
        clientWindow.ytcfg?.get?.('INNERTUBE_CONTEXT')?.client?.visitorData;
      if (typeof provider?.wpc === 'function' && visitorData) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (typeof provider?.wpc !== 'function' || !visitorData) {
      throw new Error('YouTube WebPoClient is unavailable. Reload the YouTube page and try again.');
    }
    const client = await provider.wpc();
    if (typeof client?.mws !== 'function') {
      throw new Error('YouTube WebPoClient cannot mint playback tokens.');
    }
    // Wait for real tokens rather than accepting cold-start or error tokens.
    const contentToken = await client.mws({c: videoId, mc: false, me: false});
    const sessionToken = await client.mws({c: visitorData, mc: false, me: false});
    if (typeof contentToken !== 'string' || !contentToken || typeof sessionToken !== 'string' || !sessionToken) {
      throw new Error('YouTube WebPoClient returned an empty playback token.');
    }
    return {contentToken, sessionToken, visitorData};
  }

  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.origin !== window.location.origin ||
        event.data?.type !== 'fs-yt-po-token-request' || typeof event.data.requestId !== 'string') {
      return;
    }
    const response = {type: 'fs-yt-po-token-response', requestId: event.data.requestId};
    try {
      response.tokens = await mintTokens(event.data.videoId, event.data.visitorData);
    } catch (error) {
      response.error = error?.message || String(error);
    }
    window.postMessage(response, window.location.origin);
  });
})();
