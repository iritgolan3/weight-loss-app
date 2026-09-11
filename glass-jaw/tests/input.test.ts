import test from 'node:test';
import assert from 'node:assert/strict';
import { InputManager } from '../src/input/InputManager';
import { Action, DEFAULT_KEYS, DEFAULT_PAD, prettyKey } from '../src/input/Actions';

/** Minimal fake gamepad so the mapping can be tested without hardware. */
function fakePad(buttons: number[] = [], axes: number[] = [0, 0, 0, 0]) {
  return {
    index: 0,
    connected: true,
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: buttons.includes(i), value: buttons.includes(i) ? 1 : 0, touched: false,
    })),
  };
}

/**
 * Node defines `navigator` as a getter-only global, so it has to be swapped
 * with defineProperty rather than assignment, and put back afterwards.
 */
function withPads(pads: unknown[], fn: (input: InputManager) => void): void {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    get: () => ({ getGamepads: () => pads }),
  });
  try {
    fn(new InputManager());
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else delete (globalThis as { navigator?: unknown }).navigator;
  }
}

test('default bindings cover every action on keyboard and gamepad', () => {
  for (const a of Object.values(Action)) {
    assert.ok(DEFAULT_KEYS[a]?.length, `${a} has no key binding`);
    assert.ok(DEFAULT_PAD[a]?.length, `${a} has no gamepad binding`);
  }
});

test('the documented control scheme is what is actually bound', () => {
  assert.ok(DEFAULT_KEYS[Action.PunchLeft].includes('KeyA'));
  assert.ok(DEFAULT_KEYS[Action.PunchRight].includes('KeyD'));
  assert.ok(DEFAULT_KEYS[Action.AimHigh].includes('KeyW'));
  assert.ok(DEFAULT_KEYS[Action.AimLow].includes('KeyS'));
  assert.ok(DEFAULT_KEYS[Action.DodgeLeft].includes('KeyQ'));
  assert.ok(DEFAULT_KEYS[Action.DodgeRight].includes('KeyE'));
  assert.ok(DEFAULT_KEYS[Action.Block].includes('Space'));
  assert.ok(DEFAULT_KEYS[Action.Special].some((k) => k.startsWith('Shift')));
  assert.ok(DEFAULT_KEYS[Action.Pause].includes('Escape'));
});

test('no two combat actions share a gamepad button', () => {
  const combat = [Action.PunchLeft, Action.PunchRight, Action.AimHigh, Action.AimLow,
    Action.DodgeLeft, Action.DodgeRight];
  const seen = new Map<number, Action>();
  for (const a of combat) {
    for (const b of DEFAULT_PAD[a]) {
      const other = seen.get(b);
      assert.ok(other === undefined, `button ${b} is on both ${a} and ${other}`);
      seen.set(b, a);
    }
  }
});

test('a gamepad button press registers and releases', () => {
  withPads([fakePad([2])], (input) => {
    input.pollPads();
    assert.equal(input.isDown(Action.PunchLeft), true, 'X should punch left');
    assert.equal(input.justPressed(Action.PunchLeft), true);
    assert.equal(input.consume(Action.PunchLeft), true, 'press should be buffered');
    assert.equal(input.consume(Action.PunchLeft), false, 'a press must only fire once');
  });
});

test('a disconnected gamepad releases everything it was holding', () => {
  const pads: unknown[] = [fakePad([2])];
  withPads(pads, (input) => {
    input.pollPads();
    assert.equal(input.isDown(Action.PunchLeft), true);
    pads[0] = null;
    input.pollPads();
    assert.equal(input.isDown(Action.PunchLeft), false, 'a dropped pad left a key stuck');
    assert.equal(input.gamepadConnected, false);
  });
});

test('the left stick drives dodges like the d-pad', () => {
  withPads([fakePad([], [-1, 0, 0, 0])], (input) => {
    input.pollPads();
    assert.equal(input.isDown(Action.DodgeLeft), true, 'stick left should dodge left');
  });
  withPads([fakePad([], [1, 0, 0, 0])], (input) => {
    input.pollPads();
    assert.equal(input.isDown(Action.DodgeRight), true);
  });
  // A stick resting inside the deadzone must not trigger anything.
  withPads([fakePad([], [0.2, 0.2, 0, 0])], (input) => {
    input.pollPads();
    assert.equal(input.isDown(Action.DodgeLeft), false);
    assert.equal(input.isDown(Action.DodgeRight), false);
    assert.equal(input.isDown(Action.MenuUp), false);
  });
});

test('an input pressed slightly early is still buffered', () => {
  withPads([fakePad([1])], (input) => {
    input.bufferMs = 140;
    input.pollPads();
    assert.equal(input.isBuffered(Action.PunchRight), true);
    // endFrame expires one-frame edges but must keep the buffered press alive.
    input.endFrame();
    assert.equal(input.justPressed(Action.PunchRight), false);
    assert.equal(input.isBuffered(Action.PunchRight), true, 'buffer expired immediately');
  });
});

test('a buffered press expires rather than firing much later', () => {
  withPads([fakePad([1])], (input) => {
    input.bufferMs = 0;
    input.pollPads();
    input.endFrame();
    assert.equal(input.isBuffered(Action.PunchRight), false);
  });
});

test('flush clears pending input so a scene change never inherits a press', () => {
  withPads([fakePad([2, 1])], (input) => {
    input.pollPads();
    assert.equal(input.isBuffered(Action.PunchLeft), true);
    input.flush();
    assert.equal(input.isBuffered(Action.PunchLeft), false);
    assert.equal(input.justPressed(Action.PunchRight), false);
  });
});

test('key names render readably for the controls screen', () => {
  assert.equal(prettyKey('KeyA'), 'A');
  assert.equal(prettyKey('Space'), 'Space');
  assert.equal(prettyKey('ShiftLeft'), 'L-Shift');
  assert.equal(prettyKey('ArrowLeft'), 'Left Arrow');
  assert.equal(prettyKey('Escape'), 'Esc');
  assert.equal(prettyKey('Digit1'), '1');
});

test('rebinding an action takes effect on the gamepad immediately', () => {
  withPads([fakePad([7])], (input) => {
    assert.equal(input.isDown(Action.PunchLeft), false);
    input.pad[Action.PunchLeft] = [7];
    input.pollPads();
    assert.equal(input.isDown(Action.PunchLeft), true, 'rebound button did not register');
  });
});
