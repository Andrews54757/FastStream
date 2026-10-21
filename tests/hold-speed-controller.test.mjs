import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HoldSpeedController,
  bindHoldSpeedInterruptions,
  getHoldSpeedConfig,
  matchesHoldSpeedKey,
} from '../chrome/player/ui/HoldSpeedController.mjs';
import {WebUtils} from '../chrome/player/utils/WebUtils.mjs';

/**
 * Creates a deterministic timer queue for controller tests.
 * @return {Object} Timer controls and the scheduled tasks.
 */
function timerQueue() {
  const tasks = new Map();
  let nextId = 0;

  return {
    tasks,
    setTimer(callback, delay) {
      const id = ++nextId;
      tasks.set(id, {callback, delay, cleared: false, ran: false});
      return id;
    },
    clearTimer(id) {
      const task = tasks.get(id);
      if (task) {
        task.cleared = true;
      }
    },
    runAll() {
      for (const task of tasks.values()) {
        if (!task.cleared && !task.ran) {
          task.ran = true;
          task.callback();
        }
      }
    },
  };
}

/**
 * Creates a controller with fake player, overlay and timer dependencies.
 * @param {Object} [overrides] - Values to override in the fake environment.
 * @return {Object} The controller and observable dependencies.
 */
function controllerHarness(overrides = {}) {
  const timers = timerQueue();
  const shownRates = [];
  let hidden = 0;
  let played = 0;
  const client = {
    player: {},
    playbackRate: 1,
    paused: false,
    play() {
      played++;
      this.paused = false;
    },
  };
  Object.assign(client, overrides.client);

  const controller = new HoldSpeedController({
    client,
    getConfig: () => ({key: 'ArrowRight', rate: 2, delay: 300, ...overrides.config}),
    showOverlay: (rate) => shownRates.push(rate),
    hideOverlay: () => hidden++,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });

  return {
    controller,
    client,
    timers,
    shownRates,
    hiddenCount: () => hidden,
    playedCount: () => played,
  };
}

/**
 * Minimal event target used to test lifecycle bindings.
 */
class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) || []) {
      listener();
    }
  }
}

test('normalizes hold-speed settings and rejects invalid values', () => {
  assert.deepEqual(getHoldSpeedConfig({
    holdSpeedKey: 'ArrowRight',
    holdSpeedRate: '2.5',
    holdSpeedDelay: '0',
  }), {key: 'ArrowRight', rate: 2.5, delay: 0});

  assert.deepEqual(getHoldSpeedConfig({
    holdSpeedKey: '',
    holdSpeedRate: '-1',
    holdSpeedDelay: 'not-a-number',
  }), {key: 'None', rate: 2, delay: 300});
});

test('builds and releases keyboard and mouse binding strings', () => {
  const keyEvent = {
    key: 'ArrowDown',
    code: 'ArrowDown',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: true,
  };
  assert.equal(WebUtils.getKeyString(keyEvent), 'Shift+ArrowDown');
  assert.equal(WebUtils.getMouseButtonString({button: 2}), 'MouseRight');

  assert.equal(matchesHoldSpeedKey('Shift+ArrowDown', 'Shift+ArrowDown'), true);
  assert.equal(matchesHoldSpeedKey('ArrowDown', 'Shift+ArrowDown', true), true);
  assert.equal(matchesHoldSpeedKey('ArrowUp', 'Shift+ArrowDown', true), false);
  assert.equal(matchesHoldSpeedKey('MouseRight', 'MouseRight'), false);
  assert.equal(matchesHoldSpeedKey('ArrowRight', 'None'), false);
});

test('activates after the delay and restores the previous rate', () => {
  const harness = controllerHarness();
  const {controller, client, timers} = harness;
  const release = {};

  controller.begin('ArrowRight');
  assert.equal(client.playbackRate, 1);
  assert.equal(timers.tasks.size, 1);

  timers.runAll();
  assert.equal(client.playbackRate, 2);
  assert.equal(harness.playedCount(), 1);
  assert.deepEqual(harness.shownRates, [2]);
  assert.equal(controller.blocksContextMenu, true);

  controller.complete(release, () => assert.fail('long press must not replay the short action'));
  assert.equal(client.playbackRate, 1);
  assert.equal(harness.hiddenCount(), 1);
  assert.equal(controller.blocksContextMenu, false);
});

test('a short press replays its normal action without speeding up', () => {
  const harness = controllerHarness();
  const {controller, client, timers} = harness;
  const event = {type: 'keyup'};
  let replayed = null;

  controller.begin('ArrowRight');
  controller.complete(event, (keyString, receivedEvent) => {
    replayed = {keyString, receivedEvent};
  });
  timers.runAll();

  assert.deepEqual(replayed, {keyString: 'ArrowRight', receivedEvent: event});
  assert.equal(client.playbackRate, 1);
  assert.equal(harness.playedCount(), 0);
});

test('interrupting before the delay prevents activation and short-press replay', () => {
  const harness = controllerHarness();
  const {controller, client, timers} = harness;

  controller.begin('ArrowRight');
  controller.interrupt();
  timers.runAll();
  controller.complete({}, () => assert.fail('interrupted press must not replay'));

  assert.equal(client.playbackRate, 1);
  assert.equal(harness.playedCount(), 0);
});

test('interrupting an active hold restores the rate and overlay', () => {
  const harness = controllerHarness();
  const {controller, client, timers} = harness;

  controller.begin();
  timers.runAll();
  assert.equal(client.playbackRate, 2);

  controller.interrupt();
  assert.equal(client.playbackRate, 1);
  assert.equal(harness.hiddenCount(), 1);
  assert.equal(controller.blocksContextMenu, false);
});

test('releasing after a paused press leaves the player playing at normal speed', () => {
  const harness = controllerHarness({client: {paused: true}});
  const {controller, client, timers} = harness;

  controller.begin();
  timers.runAll();
  assert.equal(client.paused, false);

  controller.complete({}, () => {});
  assert.equal(client.paused, false);
  assert.equal(client.playbackRate, 1);
});

test('long-press clicks are consumed once', () => {
  const harness = controllerHarness();
  const {controller, client, timers} = harness;

  controller.begin();
  timers.runAll();

  assert.equal(controller.consumeSuppressedClick(), true);
  assert.equal(client.playbackRate, 1);
  assert.equal(controller.consumeSuppressedClick(), false);
});

test('window blur and hidden-page transitions interrupt the hold', () => {
  const windowTarget = new FakeEventTarget();
  const documentTarget = new FakeEventTarget();
  documentTarget.hidden = false;
  let interrupts = 0;

  const unbind = bindHoldSpeedInterruptions(
      windowTarget,
      documentTarget,
      () => interrupts++,
  );

  documentTarget.dispatch('visibilitychange');
  assert.equal(interrupts, 0);

  documentTarget.hidden = true;
  documentTarget.dispatch('visibilitychange');
  assert.equal(interrupts, 1);

  windowTarget.dispatch('blur');
  assert.equal(interrupts, 2);

  unbind();
  windowTarget.dispatch('blur');
  documentTarget.dispatch('visibilitychange');
  assert.equal(interrupts, 2);
});
