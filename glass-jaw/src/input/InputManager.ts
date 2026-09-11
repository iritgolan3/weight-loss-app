import { Action, DEFAULT_KEYS, DEFAULT_PAD, KeyBindings, PadBindings } from './Actions';

interface ActionState {
  /** Held right now. */
  down: boolean;
  /** Went down since the last consume — the buffered edge. */
  buffered: boolean;
  /** Timestamp (ms) of the most recent press. */
  pressedAt: number;
  /** Timestamp (ms) of the most recent release. */
  releasedAt: number;
  /** Rising edge limited to this exact frame (menus use this, not the buffer). */
  justPressed: boolean;
  justReleased: boolean;
}

/**
 * Keyboard + gamepad input with press buffering.
 *
 * Design notes on feel:
 *  - Events are applied the instant the browser delivers them; the game loop
 *    only *reads* state, so there is no extra frame of queueing latency.
 *  - A press stays in the buffer for `bufferMs`. If the player taps punch two
 *    frames before their recovery ends, the punch still comes out. Without
 *    this the game feels like it is ignoring inputs even when it is not.
 */
export class InputManager {
  keys: KeyBindings = structuredClone(DEFAULT_KEYS);
  pad: PadBindings = structuredClone(DEFAULT_PAD);

  /** How long a press remains eligible to be consumed, in milliseconds. */
  bufferMs = 133;

  private state = new Map<Action, ActionState>();
  private codeDown = new Set<string>();
  private padDown = new Set<number>();
  private prevPadDown = new Set<number>();
  private attached = false;
  private padIndex: number | null = null;
  private stickDeadzone = 0.45;

  /** Set while the settings screen is listening for a key to rebind. */
  captureNext: ((binding: { code?: string; button?: number }) => void) | null = null;

  /** Raw key listener for screens that need literal text/keys (e.g. rebinding). */
  onRawKey: ((code: string, e: KeyboardEvent) => void) | null = null;

  constructor() {
    for (const a of Object.values(Action)) {
      this.state.set(a, {
        down: false, buffered: false, pressedAt: -1e9, releasedAt: -1e9,
        justPressed: false, justReleased: false,
      });
    }
  }

  attach(target: Window = window): void {
    if (this.attached) return;
    this.attached = true;
    target.addEventListener('keydown', this.onKeyDown, { passive: false });
    target.addEventListener('keyup', this.onKeyUp, { passive: false });
    target.addEventListener('blur', this.releaseAll);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  detach(target: Window = window): void {
    if (!this.attached) return;
    this.attached = false;
    target.removeEventListener('keydown', this.onKeyDown);
    target.removeEventListener('keyup', this.onKeyUp);
    target.removeEventListener('blur', this.releaseAll);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private onVisibility = (): void => {
    if (document.hidden) this.releaseAll();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    if (this.captureNext) {
      e.preventDefault();
      const cb = this.captureNext;
      this.captureNext = null;
      cb({ code: e.code });
      return;
    }
    this.onRawKey?.(e.code, e);
    if (this.isBoundCode(e.code)) e.preventDefault();
    if (this.codeDown.has(e.code)) return;
    this.codeDown.add(e.code);
    for (const action of this.actionsForCode(e.code)) this.press(action);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (!this.codeDown.has(e.code)) return;
    this.codeDown.delete(e.code);
    if (this.isBoundCode(e.code)) e.preventDefault();
    for (const action of this.actionsForCode(e.code)) {
      // Only release if no other bound key for that action is still held.
      if (!this.keys[action].some((c) => this.codeDown.has(c))) this.release(action);
    }
  };

  private isBoundCode(code: string): boolean {
    for (const list of Object.values(this.keys)) if (list.includes(code)) return true;
    return false;
  }

  private *actionsForCode(code: string): Generator<Action> {
    for (const action of Object.values(Action)) {
      if (this.keys[action].includes(code)) yield action;
    }
  }

  private press(action: Action): void {
    const s = this.state.get(action)!;
    if (s.down) return;
    s.down = true;
    s.buffered = true;
    s.justPressed = true;
    s.pressedAt = performance.now();
  }

  private release(action: Action): void {
    const s = this.state.get(action)!;
    if (!s.down) return;
    s.down = false;
    s.justReleased = true;
    s.releasedAt = performance.now();
  }

  releaseAll = (): void => {
    this.codeDown.clear();
    this.padDown.clear();
    for (const s of this.state.values()) {
      s.down = false;
      s.buffered = false;
      s.justPressed = false;
    }
  };

  /** Poll gamepads. Called once at the top of every simulation frame. */
  pollPads(): void {
    const pads = navigator.getGamepads?.() ?? [];
    let active: Gamepad | null = null;
    if (this.padIndex !== null && pads[this.padIndex]?.connected) {
      active = pads[this.padIndex]!;
    } else {
      this.padIndex = null;
      for (const p of pads) {
        if (p?.connected) { active = p; this.padIndex = p.index; break; }
      }
    }
    if (!active) {
      if (this.padDown.size) { this.padDown.clear(); this.syncPadActions(); }
      return;
    }

    this.prevPadDown = new Set(this.padDown);
    this.padDown.clear();
    for (let i = 0; i < active.buttons.length; i++) {
      if (active.buttons[i]?.pressed || active.buttons[i]?.value > 0.5) this.padDown.add(i);
    }
    // Map the left stick onto the d-pad indices so sticks drive dodges/menus.
    const [ax = 0, ay = 0] = active.axes;
    if (ax < -this.stickDeadzone) this.padDown.add(14);
    if (ax > this.stickDeadzone) this.padDown.add(15);
    if (ay < -this.stickDeadzone) this.padDown.add(12);
    if (ay > this.stickDeadzone) this.padDown.add(13);

    if (this.captureNext) {
      for (const b of this.padDown) {
        if (!this.prevPadDown.has(b)) {
          const cb = this.captureNext;
          this.captureNext = null;
          cb({ button: b });
          return;
        }
      }
    }
    this.syncPadActions();
  }

  private syncPadActions(): void {
    for (const action of Object.values(Action)) {
      const buttons = this.pad[action];
      const heldNow = buttons.some((b) => this.padDown.has(b));
      const keyHeld = this.keys[action].some((c) => this.codeDown.has(c));
      const s = this.state.get(action)!;
      if (heldNow && !s.down) this.press(action);
      else if (!heldNow && !keyHeld && s.down) this.release(action);
    }
  }

  get gamepadConnected(): boolean { return this.padIndex !== null; }

  // ---- Queries -------------------------------------------------------------

  isDown(action: Action): boolean { return this.state.get(action)!.down; }

  /** True only on the frame of the press. Use for menus. */
  justPressed(action: Action): boolean { return this.state.get(action)!.justPressed; }

  justReleased(action: Action): boolean { return this.state.get(action)!.justReleased; }

  /** Non-destructive buffered check. */
  isBuffered(action: Action): boolean {
    const s = this.state.get(action)!;
    return s.buffered && performance.now() - s.pressedAt <= this.bufferMs;
  }

  /** Destructive: takes the buffered press so it cannot fire twice. */
  consume(action: Action): boolean {
    const s = this.state.get(action)!;
    if (s.buffered && performance.now() - s.pressedAt <= this.bufferMs) {
      s.buffered = false;
      return true;
    }
    return false;
  }

  /** Milliseconds since the action was last pressed. */
  sincePress(action: Action): number {
    return performance.now() - this.state.get(action)!.pressedAt;
  }

  /** Clears buffered presses without consuming — used on scene transitions. */
  flush(): void {
    for (const s of this.state.values()) { s.buffered = false; s.justPressed = false; s.justReleased = false; }
  }

  /** Call at the END of each simulation frame to expire one-frame edges. */
  endFrame(): void {
    const now = performance.now();
    for (const s of this.state.values()) {
      s.justPressed = false;
      s.justReleased = false;
      if (s.buffered && now - s.pressedAt > this.bufferMs) s.buffered = false;
    }
  }
}
