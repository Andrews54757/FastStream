import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {getPoTokens} from '../chrome/player/players/yt/WebPoToken.mjs';

const injectedScript = readFileSync(new URL('../chrome/custom/yt_inject.js', import.meta.url), 'utf8');
const contentScript = readFileSync(new URL('../chrome/custom/yt_content.js', import.meta.url), 'utf8');
const playerScript = readFileSync(new URL('../chrome/player/players/yt/YTPlayer.mjs', import.meta.url), 'utf8');
const videoId = 'dQw4w9WgXcQ';

function bridge({inject = true, mint, top, ready = true} = {}) {
  const listeners = new Set();
  const calls = [];
  const timers = new Map();
  const messages = [];
  let now = 0;
  let onMessage;
  const window = {
    location: {origin: 'https://www.youtube.com'},
    addEventListener: (type, listener) => listeners.add(listener),
    removeEventListener: (type, listener) => listeners.delete(listener),
    postMessage(data) {
      messages.push(data);
      queueMicrotask(() => this.dispatch({source: window, origin: window.location.origin, data}));
    },
    dispatch(event) {
      for (const listener of [...listeners]) listener(event);
    },
    ytcfg: {get: (key) => key === 'VISITOR_DATA' ? 'page-visitor' : undefined},
  };
  window.top = top || window;
  const provider = {
    async wpc() {
      assert.equal(this, provider);
      return {
        async mws(options) {
          calls.push({...options});
          return mint ? mint(options) : 'token:' + options.c;
        },
      };
    },
  };
  if (ready) window['havuokmhhs-0'] = {bevasrs: provider};
  const chrome = {runtime: {
    onMessage: {addListener: (listener) => onMessage = listener},
    sendMessage(message, callback) {
      if (callback) callback('loaded');
    },
  }};
  const context = vm.createContext({
    window, chrome, console, crypto: {randomUUID}, Date: {now: () => now},
    document: {addEventListener() {}},
    MutationObserver: class {
      observe() {}
    },
    setTimeout(callback, delay) {
      const timer = {callback, delay};
      timers.set(timer, timer);
      if (delay === 100) {
        queueMicrotask(() => {
          timers.delete(timer);
          now += delay;
          callback();
        });
      }
      return timer;
    },
    clearTimeout: (timer) => timers.delete(timer),
  });
  vm.runInContext(contentScript, context);
  if (inject) vm.runInContext(injectedScript, context);
  return {
    window, calls, timers, provider, listeners, messages,
    request(payload = {}) {
      return new Promise((resolve) => {
        assert.equal(onMessage({type: 'MINT_YT_PO_TOKENS', videoId, ...payload}, {}, resolve), true);
      });
    },
  };
}

test('mints both bindings through the page client and removes the response listener', async () => {
  const page = bridge();
  const listenerCount = page.listeners.size;
  const tokens = await page.request();
  assert.deepEqual({...tokens}, {
    contentToken: 'token:' + videoId, sessionToken: 'token:page-visitor', visitorData: 'page-visitor',
  });
  assert.deepEqual(page.calls, [
    {c: videoId, mc: false, me: false}, {c: 'page-visitor', mc: false, me: false},
  ]);
  assert.equal(page.listeners.size, listenerCount);
  assert.equal(page.timers.size, 0);
});

test('prefers the first WebPoClient over static clients', async () => {
  const page = bridge();
  page.window['havuokmhhs-static'] = {bevasrs: {wpc() {
    throw new Error('Static client selected');
  }}};
  assert.equal((await page.request()).contentToken, 'token:' + videoId);
});

test('finds renamed clients and context visitor data', async () => {
  const page = bridge({ready: false});
  page.window['havuokmhhs-renamed'] = {bevasrs: page.provider};
  page.window.ytcfg.get = (key) => key === 'INNERTUBE_CONTEXT' ? {client: {visitorData: 'context-visitor'}} : undefined;
  assert.equal((await page.request()).visitorData, 'context-visitor');
});

test('waits for delayed page client initialization', async () => {
  const page = bridge({ready: false});
  const pending = page.request();
  queueMicrotask(() => page.window['havuokmhhs-0'] = {bevasrs: page.provider});
  assert.equal((await pending).sessionToken, 'token:page-visitor');
});

test('uses the local client in cross-origin embeds', async () => {
  const top = {};
  Object.defineProperty(top, 'location', {get() {
    throw new Error('Cross-origin');
  }});
  const page = bridge({top});
  assert.equal((await page.request()).visitorData, 'page-visitor');
});

test('preserves the established visitor binding during renewal', async () => {
  const page = bridge();
  assert.equal((await page.request({visitorData: 'existing-visitor'})).sessionToken, 'token:existing-visitor');
});

test('concurrent requests keep video bindings separate', async () => {
  const page = bridge();
  const anotherVideo = 'abcdefghijk';
  const [first, second] = await Promise.all([page.request(), page.request({videoId: anotherVideo})]);
  assert.equal(first.contentToken, 'token:' + videoId);
  assert.equal(second.contentToken, 'token:' + anotherVideo);
  assert.equal(page.timers.size, 0);
});

test('propagates mint failures and empty tokens', async () => {
  const failed = bridge({mint() {
    throw new Error('Mint failed');
  }});
  assert.equal((await failed.request()).error, 'Mint failed');
  const empty = bridge({mint: () => ''});
  assert.match((await empty.request()).error, /empty playback token/);
});

test('rejects invalid bindings before minting', async () => {
  const page = bridge();
  assert.match((await page.request({videoId: 'invalid'})).error, /Invalid YouTube token binding/);
  assert.equal(page.calls.length, 0);
});

test('returns an actionable error when YouTube never initializes the client', async () => {
  const page = bridge({ready: false});
  assert.match((await page.request()).error, /WebPoClient is unavailable/);
  assert.equal(page.calls.length, 0);
  assert.equal(page.timers.size, 0);
});

test('bounds minting when WebPoClient never settles', async () => {
  const page = bridge({mint: () => new Promise(() => {})});
  const pending = page.request();
  await new Promise((resolve) => setImmediate(resolve));
  for (const timer of page.timers.values()) timer.callback();
  assert.match((await pending).error, /Timed out/);
  assert.equal(page.timers.size, 0);
});

test('ignores foreign responses and bounds requests when the page bridge is absent', async () => {
  const page = bridge({inject: false});
  const listenerCount = page.listeners.size;
  const pending = page.request();
  const {requestId} = page.messages[0];
  page.window.dispatch({source: {}, origin: page.window.location.origin,
    data: {type: 'fs-yt-po-token-response', requestId, tokens: {}}});
  page.window.dispatch({source: page.window, origin: 'https://example.com',
    data: {type: 'fs-yt-po-token-response', requestId, tokens: {}}});
  page.window.dispatch({source: page.window, origin: page.window.location.origin,
    data: {type: 'fs-yt-po-token-response', requestId: 'unrelated', tokens: {}}});
  assert.equal(page.listeners.size, listenerCount + 1);
  for (const timer of page.timers.values()) timer.callback();
  assert.match((await pending).error, /Timed out/);
  assert.equal(page.listeners.size, listenerCount);
  assert.equal(page.timers.size, 0);
});

test('player helper forwards requests and rejects malformed or mismatched responses', async () => {
  const previousChrome = globalThis.chrome;
  try {
    globalThis.chrome = {runtime: {async sendMessage(request) {
      assert.deepEqual(request, {type: 'REQUEST_YT_PO_TOKENS', videoId, visitorData: 'visitor'});
      return {contentToken: 'content', sessionToken: 'session', visitorData: 'visitor'};
    }}};
    assert.equal((await getPoTokens(videoId, 'visitor')).contentToken, 'content');
    globalThis.chrome.runtime.sendMessage = async () => ({error: 'Page missing'});
    await assert.rejects(getPoTokens(videoId), /Page missing/);
    globalThis.chrome.runtime.sendMessage = async () => ({contentToken: '', sessionToken: 'session', visitorData: 'visitor'});
    await assert.rejects(getPoTokens(videoId), /valid playback tokens/);
    globalThis.chrome.runtime.sendMessage = async () => ({contentToken: 'content', sessionToken: 'session', visitorData: 'other'});
    await assert.rejects(getPoTokens(videoId, 'visitor'), /valid playback tokens/);
  } finally {
    globalThis.chrome = previousChrome;
  }
});

test('video info uses page visitor identity and keeps iOS independent of WebPoClient', async () => {
  const tokens = {contentToken: 'content', sessionToken: 'session', visitorData: 'page-visitor'};
  let tokenRequests = 0;
  let config;
  let infoOptions;
  const youtube = {
    session: {player: {}},
    async getInfo(id, options) {
      assert.equal(id, videoId);
      infoOptions = options;
      return {};
    },
  };
  const context = vm.createContext({
    DashPlayer: class {}, ClientType: {IOS: 'iOS', WEB: 'WEB'},
    IndexedDBManager: {isSupportedAndAvailable: async () => false},
    getPoTokens: async () => {
      tokenRequests++; return tokens;
    },
    Innertube: {create: async (options) => {
      config = options; return youtube;
    }},
  });
  vm.runInContext(playerScript.replace(/^import .*;\n/gm, '').replace('export default class', 'class') +
    '\nglobalThis.player = Object.create(YTPlayer.prototype);', context);
  const player = context.player;
  const [, info] = await player.getVideoInfo(videoId, 'WEB');
  assert.equal(config.visitor_data, 'page-visitor');
  assert.equal(youtube.session.player.po_token, 'session');
  assert.equal(youtube.session.content_token, 'content');
  assert.equal(infoOptions.po_token, 'content');
  assert.equal(info.client_type, 'WEB');
  await player.getVideoInfo(videoId, 'iOS');
  assert.equal(tokenRequests, 1);
  assert.equal(infoOptions.po_token, undefined);
});
