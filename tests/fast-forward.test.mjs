import assert from 'node:assert/strict';
import test from 'node:test';
import {DefaultKeybinds} from '../chrome/player/options/defaults/DefaultKeybinds.mjs';
import {DefaultOptions} from '../chrome/player/options/defaults/DefaultOptions.mjs';

const element = {
  addEventListener() {
  },
};

globalThis.document = {
  addEventListener() {
  },
  querySelector() {
    return element;
  },
  querySelectorAll() {
    return [];
  },
};

const {KeybindManager} = await import('../chrome/player/ui/KeybindManager.mjs');

/**
 * Creates a client with only the state used by the seek keybind.
 * @param {number} currentTime - Initial playback position.
 * @param {number} duration - Configured fast-forward duration.
 * @return {Object} Fake client and the seek-save calls it received.
 */
function createClient(currentTime, duration) {
  const seekSaveCalls = [];
  return {
    seekSaveCalls,
    client: {
      currentTime,
      options: {
        fastForwardDuration: duration,
      },
      setSeekSave(value) {
        seekSaveCalls.push(value);
      },
    },
  };
}

test('fast-forward defaults to L and 85 seconds', () => {
  assert.equal(DefaultKeybinds.FastForward, 'KeyL');
  assert.equal(DefaultOptions.fastForwardDuration, 85);
});

test('fast-forward seeks by the configured duration', () => {
  const {client, seekSaveCalls} = createClient(10, 85);
  const manager = new KeybindManager(client);

  manager.emit('FastForward');

  assert.equal(client.currentTime, 95);
  assert.deepEqual(seekSaveCalls, [false, true]);
});

test('fast-forward keybind and duration can both be changed', () => {
  const {client} = createClient(100, 12);
  const manager = new KeybindManager(client);

  manager.setKeybinds({FastForward: 'KeyK'});
  manager.emit('FastForward');

  assert.deepEqual(manager.keyStringToKeybinds('KeyK'), ['FastForward']);
  assert.equal(client.currentTime, 112);
});
