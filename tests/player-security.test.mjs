import assert from 'node:assert/strict';
import {File} from 'node:buffer';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {MessageTypes} from '../chrome/player/enums/MessageTypes.mjs';
import {PlayerModes} from '../chrome/player/enums/PlayerModes.mjs';
import {DefaultPlayerEvents} from '../chrome/player/enums/DefaultPlayerEvents.mjs';
import {VideoSource} from '../chrome/player/VideoSource.mjs';
import {URLUtils} from '../chrome/player/utils/URLUtils.mjs';

function script(path) {
  return readFileSync(new URL('../chrome/player/' + path, import.meta.url), 'utf8')
      .replace(/^import .*\n/gm, '').replace(/^export /gm, '');
}

function messageWindow() {
  return {
    messages: [],
    postMessage(message, origin) {
      this.messages.push({message, origin});
    },
    addEventListener() {},
    removeEventListener() {},
  };
}

function embed() {
  const window = messageWindow();
  window.parent = messageWindow();
  window.opener = messageWindow();
  const actions = [];
  const client = {
    version: 'test',
    source: {url: 'https://media.test/video.mp4?token=secret', mode: 'direct', identifier: 'private-id'},
    state: {},
    interfaceController: {volumeControls: {on() {}, muted: false}, isInPip: () => false},
    currentTime: 5, duration: 30, volume: 1, playbackRate: 1,
    getCurrentVideoLevelID: () => null,
    getCurrentAudioLevelID: () => null,
    needsUserInteraction: () => false,
    on() {},
    player: {createContext: () => ({on() {}, destroy() {}})},
    pause: async () => actions.push('pause'),
    userInteracted: () => actions.push('interaction'),
    addSource: async () => actions.push('load'),
  };
  const context = vm.createContext({
    window, client, console, DefaultPlayerEvents, PlayerModes, VideoSource, URLUtils,
    EnvUtils: {isWebAudioSupported: () => false},
  });
  vm.runInContext(script('modules/EmbedAPI.mjs') + '\nglobalThis.api = new EmbedAPI(client);', context);
  const api = context.api;
  return {
    api, window, client, actions,
    command(source, origin, command, args = {}) {
      return api.handleMessage({source, origin,
        data: {type: 'faststream:command', id: 'request', command, args}});
    },
  };
}

test('embed API accepts the direct parent and opener and targets replies to their origins', async () => {
  const page = embed();
  for (const source of [page.window.parent, page.window.opener]) {
    await page.command(source, 'https://embedder.test', 'getState');
    assert.equal(source.messages.length, 1);
    const reply = source.messages[0];
    assert.equal(reply.origin, 'https://embedder.test');
    assert.equal(reply.message.ok, true);
    assert.equal(reply.message.result.source.url, page.client.source.url);
    await page.command(source, 'https://embedder.test', 'pause');
  }
  assert.deepEqual(page.actions, ['pause', 'pause']);
});

test('sibling frames, distant ancestors and the player itself cannot read or control it', async () => {
  const page = embed();
  for (const source of [messageWindow(), messageWindow(), page.window]) {
    for (const command of ['getState', 'subscribe', 'load', 'pause', 'seek', 'unknown']) {
      await page.command(source, 'https://embedder.test', command, {url: 'https://attacker.test/video.mp4', time: 12});
    }
    assert.equal(source.messages.length, 0);
  }
  assert.deepEqual(page.actions, []);
  assert.equal(page.client.currentTime, 5);
  assert.equal(page.api.subscribers.length, 0);
  assert.equal(page.api.pinnedOrigins.size, 0);
});

test('embed API pins each window independently and rejects navigation to another origin', async () => {
  const page = embed();
  await page.command(page.window.parent, 'https://parent.test', 'ping');
  await page.command(page.window.opener, 'https://opener.test', 'subscribe');
  page.window.opener.messages.length = 0;
  for (const command of ['getState', 'subscribe', 'pause', 'unknown']) {
    await page.command(page.window.opener, 'https://navigated.test', command);
  }
  assert.equal(page.window.opener.messages.length, 0);
  assert.deepEqual(page.actions, []);
  page.api.emitEvent('timeupdate');
  assert.equal(page.window.opener.messages[0].origin, 'https://opener.test');
  await page.command(page.window.parent, 'https://parent.test', 'pause');
  assert.deepEqual(page.actions, ['pause']);
});

test('authorized subscriptions continue to receive events', async () => {
  const page = embed();
  const otherFrame = messageWindow();
  await page.command(page.window.parent, 'https://parent.test', 'subscribe');
  await page.command(otherFrame, 'https://parent.test', 'subscribe');
  page.window.parent.messages.length = 0;
  page.api.emitEvent('timeupdate');
  assert.equal(page.window.parent.messages[0].message.event, 'timeupdate');
  assert.equal(page.window.parent.messages[0].origin, 'https://parent.test');
  assert.equal(otherFrame.messages.length, 0);
});

test('destroy forgets subscriptions and pinned origins', async () => {
  const page = embed();
  page.api.start();
  await page.command(page.window.parent, 'https://parent.test', 'subscribe');
  page.api.destroy();
  assert.equal(page.api.pinnedOrigins.size, 0);
  assert.equal(page.api.subscribers.length, 0);
  assert.equal(page.api.playerContext, null);
});

test('ready announcements omit source URLs and identifiers for both parent and opener', () => {
  const page = embed();
  page.api.announce();
  for (const target of [page.window.parent, page.window.opener]) {
    const {message, origin} = target.messages[0];
    assert.equal(origin, '*');
    assert.equal(message.event, 'ready');
    assert.deepEqual({...message.state.source}, {mode: page.client.source.mode});
    assert.equal(message.state.currentTime, 5);
    assert.equal(JSON.stringify(message).includes('secret'), false);
    assert.equal(JSON.stringify(message).includes('private-id'), false);
  }
  page.client.source = null;
  page.api.announce();
  assert.equal(page.window.parent.messages[1].message.state.source, null);
});

async function setupPlayer({extension, framed, hash, search = ''}) {
  const sources = [];
  const requests = [];
  let onMessage;
  const window = messageWindow();
  window.top = framed ? messageWindow() : window;
  window.self = window;
  window.location = {hash, search, href: 'https://player.test/index.html' + search + hash};
  window.fastStream = {
    version: 'test', options: {},
    setOptions() {}, setNeedsUserInteraction() {},
    loadAnalyzerData() {}, setMediaInfo() {}, setupPoll() {}, clearSubtitles() {},
    async addSource(source) {
      sources.push(source);
    },
  };
  const context = vm.createContext({
    window, console: {log() {}, error(error) {
      throw error;
    }}, MessageTypes, PlayerModes, URLUtils, VideoSource,
    EnvUtils: {isExtension: () => extension},
    Utils: {getOptionsFromStorage: async () => ({}), printWelcome() {}},
    EmbedAPI: class {
      start() {}
    },
    chrome: {runtime: {
      onMessage: {addListener: (listener) => onMessage = listener},
      async sendMessage(request) {
        requests.push(request);
        return request.type === MessageTypes.PLAYER_LOADED ? {isMainPlayer: true} : undefined;
      },
    }},
    URLSearchParams, File, document: {body: {}}, setInterval() {},
    MutationObserver: class {
      observe() {}
    },
  });
  vm.runInContext(script('main.mjs').replace('setup().catch', 'globalThis.setupPromise = setup().catch'), context);
  await context.setupPromise;
  return {sources, requests, onMessage};
}

const untrustedHash = '#http://127.0.0.1:41975/framed-source.mp4?faststream-headers=' +
  encodeURIComponent(JSON.stringify({Referer: 'https://forged.test/page'}));

test('framed extension player ignores hash sources and their custom headers', async () => {
  const page = await setupPlayer({extension: true, framed: true, hash: untrustedHash});
  assert.equal(page.sources.length, 0);
  assert.ok(page.requests.some((request) => request.type === MessageTypes.REQUEST_SOURCES));
});

test('top-level extension player still loads address sources with headers', async () => {
  const page = await setupPlayer({extension: true, framed: false, hash: untrustedHash});
  assert.equal(page.sources.length, 1);
  assert.equal(page.sources[0].url, 'http://127.0.0.1:41975/framed-source.mp4');
  assert.equal(page.sources[0].headers.referer, 'https://forged.test/page');
});

test('extension-created frames still load sources received through extension messaging', async () => {
  const page = await setupPlayer({extension: true, framed: true, hash: '', search: '?parent_frame_id=0'});
  assert.equal(page.requests[0].parentFrameId, 0);
  assert.equal(page.sources.length, 0);
  await new Promise((resolve) => page.onMessage({type: MessageTypes.SOURCES, autoSetSource: true,
    sources: [{url: 'https://media.test/video.mp4', headers: {Referer: 'https://trusted.test'}, mode: PlayerModes.DIRECT}]}, {}, resolve));
  assert.equal(page.sources[0].url, 'https://media.test/video.mp4');
  assert.equal(page.sources[0].headers.referer, 'https://trusted.test');
});

test('web player keeps hash loading in both top-level and framed contexts', async () => {
  for (const framed of [false, true]) {
    const page = await setupPlayer({extension: false, framed, hash: untrustedHash});
    assert.equal(page.sources.length, 1);
    assert.equal(page.sources[0].headers.referer, 'https://forged.test/page');
  }
});

test('toast and error dialogs pass untrusted markup as text', async () => {
  const dialogs = [];
  const markup = '<img src=https://attacker.test/pixel onerror=alert(1)>';
  const document = {
    createElement(tag) {
      return {tag, classList: {add() {}}, children: [],
        appendChild(child) {
          this.children.push(child);
        },
        set innerHTML(value) {
          throw new Error('Unexpected HTML parsing: ' + value);
        }};
    },
  };
  const context = vm.createContext({
    document,
    SweetAlert: {async fire(options) {
      dialogs.push(options); return {isConfirmed: false};
    }},
    Localize: {getMessage: (key, args = []) => key + ': ' + args.join(' ')},
  });
  vm.runInContext(script('utils/AlertPolyfill.mjs') + '\nglobalThis.Alert = AlertPolyfill;', context);
  const error = {message: markup, stack: 'Stack: ' + markup};
  await context.Alert.toast('error', markup, markup);
  await context.Alert.errorSendToDeveloper(error);
  await context.Alert.ytUserscriptError(error);
  assert.equal(dialogs.length, 3);
  for (const dialog of dialogs) {
    assert.equal(Object.hasOwn(dialog, 'title'), false);
    assert.ok(dialog.titleText.includes(markup));
  }
  assert.equal(dialogs[0].text, markup);
  assert.equal(dialogs[1].html.children[1].textContent, error.stack);
});
