import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {MessageTypes} from '../chrome/player/enums/MessageTypes.mjs';
import {PlayerModes} from '../chrome/player/enums/PlayerModes.mjs';
import {URLUtils} from '../chrome/player/utils/URLUtils.mjs';

function script(path) {
  return readFileSync(new URL('../chrome/background/' + path, import.meta.url), 'utf8')
      .replace(/^import .*\n/gm, '').replace(/^export /gm, '');
}

function background() {
  const event = () => ({listeners: [], addListener(listener) {
    this.listeners.push(listener);
  }});
  const timers = new Map();
  const messages = [];
  const chrome = {
    runtime: {getManifest: () => ({version: 'test'}), onMessage: event()},
    action: {onClicked: event()},
    tabs: {onRemoved: event(), onUpdated: event(), sendMessage(tabId, message, options, callback) {
      messages.push(message);
      (callback || options)(message.type === MessageTypes.SCRAPE_CAPTIONS ? [] : 'replace');
    }},
    webRequest: {onBeforeRequest: event(), onBeforeSendHeaders: event(), onHeadersReceived: event(), onErrorOccurred: event()},
  };
  const context = vm.createContext({
    chrome, console, URL, URLUtils, MessageTypes, PlayerModes, self: {},
    BackgroundUtils: {
      openWelcomePageOnInstall() {}, queryTabs: async () => [], checkMessageError() {},
      isSubtitles: (ext) => ['srt', 'vtt'].includes(ext),
      getPlayerUrl: () => 'chrome-extension://test/player/index.html',
    },
    EnvUtils: {isChrome: () => false},
    Utils: {getOptionsFromStorage: () => new Promise(() => {}), printWelcome() {}},
    RuleManager: class {},
    MultiRegexMatcher: class {
      match() {}
    },
    SponsorBlockIntegration: class {
      setup() {}
    },
    StreamSaverBackend: class {
      setup() {}
    },
    setTimeout(callback) {
      const timer = {};
      timers.set(timer, callback);
      return timer;
    },
    clearTimeout: (timer) => timers.delete(timer),
  });
  vm.runInContext(script('TabTracker.mjs') + '\n' + script('background.mjs') + '\nglobalThis.tabs = Tabs;', context);
  const tab = context.tabs.getTabOrCreate(1);
  tab.isOn = true;
  const parent = tab.getFrameOrCreate(0);
  parent.url = 'https://page.test/watch';
  const sender = {tab: {id: 1}, frameId: 1};
  const headers = [{name: 'Referer', value: parent.url}];
  return {
    messages,
    async response(url, statusCode, type = 'media', requestHeaders = headers) {
      const details = {tabId: 1, frameId: 0, parentFrameId: -1, requestId: 'media', type, url, statusCode};
      chrome.webRequest.onBeforeSendHeaders.listeners[0]({...details, requestHeaders});
      for (const listener of chrome.webRequest.onHeadersReceived.listeners) listener(details);
      await new Promise((resolve) => setImmediate(resolve));
    },
    pendingModes: () => parent.requestModes?.size || 0,
    failRequest() {
      for (const listener of chrome.webRequest.onErrorOccurred.listeners) {
        listener({tabId: 1, frameId: 0, requestId: 'media'});
      }
    },
    openDuePlayer() {
      for (const [timer, callback] of timers) {
        timers.delete(timer);
        callback();
        const player = tab.getFrameOrCreate(1);
        player.setParentFrame(parent);
        player.isPlayer = true;
        chrome.runtime.onMessage.listeners[0]({type: MessageTypes.REQUEST_SOURCES}, sender, () => {});
      }
    },
    sources() {
      return messages.filter((message) => message.type === MessageTypes.SOURCES).flatMap((message) => message.sources);
    },
    headers,
  };
}

for (const statusCode of [301, 302, 303, 307, 308]) {
  test(`a ${statusCode} redirect cannot open the iframe before the final media response`, async () => {
    const page = background();
    await page.response('https://media.test/initial.mp4', statusCode);
    page.openDuePlayer();
    await page.response('https://cdn.test/final.mp4', 200);
    page.openDuePlayer();
    assert.deepEqual(Array.from(page.sources(), (source) => source.url), ['https://cdn.test/final.mp4']);
    assert.deepEqual(page.sources()[0].headers, page.headers);
    assert.equal(page.sources()[0].mode, PlayerModes.ACCELERATED_MP4);
  });
}

for (const statusCode of [200, 206, 304]) {
  test(`a ${statusCode} media response still reaches the iframe`, async () => {
    const page = background();
    await page.response('https://media.test/video.mp4', statusCode);
    page.openDuePlayer();
    assert.deepEqual(Array.from(page.sources(), (source) => source.url), ['https://media.test/video.mp4']);
  });
}


for (const [extension, mode] of [
  ['m3u8', PlayerModes.ACCELERATED_HLS],
  ['mpd', PlayerModes.ACCELERATED_DASH],
]) {
  for (const type of ['media', 'xmlhttprequest']) {
    test(`a ${type} ${extension} redirect preserves its mode at an opaque final URL`, async () => {
      const page = background();
      await page.response('https://media.test/initial.' + extension, 302, type);
      page.openDuePlayer();
      await page.response('https://cdn.test/signed-resource', 200, type);
      page.openDuePlayer();
      assert.deepEqual(Array.from(page.sources(), (source) => source.url), ['https://cdn.test/signed-resource']);
      assert.equal(page.sources()[0].mode, mode);
      assert.equal(page.pendingModes(), 0);
    });
  }
}

test('multiple redirect hops retain the manifest mode and use final request headers', async () => {
  const page = background();
  for (const [url, status] of [
    ['https://media.test/initial.m3u8', 301],
    ['https://redirect.test/intermediate', 307],
    ['https://cdn.test/another-hop', 308],
  ]) {
    await page.response(url, status, 'xmlhttprequest');
    page.openDuePlayer();
  }
  const headers = [{name: 'Referer', value: 'https://redirect.test/'}, {name: 'Authorization', value: 'test-token'}];
  await page.response('https://cdn.test/final-resource', 200, 'xmlhttprequest', headers);
  page.openDuePlayer();
  assert.deepEqual(Array.from(page.sources(), (source) => source.url), ['https://cdn.test/final-resource']);
  assert.equal(page.sources()[0].mode, PlayerModes.ACCELERATED_HLS);
  assert.deepEqual(page.sources()[0].headers, headers);
  assert.equal(page.pendingModes(), 0);
});

for (const status of [204, 404, 500]) {
  test(`a terminal ${status} response clears the redirected request's mode`, async () => {
    const page = background();
    await page.response('https://media.test/initial.m3u8', 302, 'xmlhttprequest');
    assert.equal(page.pendingModes(), 1);
    await page.response('https://cdn.test/final-resource', status, 'xmlhttprequest');
    page.openDuePlayer();
    assert.equal(page.pendingModes(), 0);
    assert.equal(page.sources().length, 0);
  });
}

test('a failed redirected request clears its mode', async () => {
  const page = background();
  await page.response('https://media.test/initial.m3u8', 302, 'xmlhttprequest');
  assert.equal(page.pendingModes(), 1);
  page.failRequest();
  page.openDuePlayer();
  assert.equal(page.pendingModes(), 0);
  assert.equal(page.sources().length, 0);
});


test('a final URL query mode takes precedence over the redirected request mode', async () => {
  const page = background();
  await page.response('https://media.test/initial.mp4', 302, 'xmlhttprequest');
  page.openDuePlayer();
  const url = 'https://proxy.test/stream?target=https://cdn.test/master.m3u8';
  await page.response(url, 200, 'xmlhttprequest');
  page.openDuePlayer();
  assert.deepEqual(Array.from(page.sources(), (source) => source.url), [url]);
  assert.equal(page.sources()[0].mode, PlayerModes.ACCELERATED_HLS);
});
