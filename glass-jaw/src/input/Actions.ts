/** Every discrete thing the player can ask the game to do. */
export enum Action {
  PunchLeft = 'PunchLeft',
  PunchRight = 'PunchRight',
  AimHigh = 'AimHigh',
  AimLow = 'AimLow',
  DodgeLeft = 'DodgeLeft',
  DodgeRight = 'DodgeRight',
  Block = 'Block',
  Special = 'Special',
  Pause = 'Pause',
  Confirm = 'Confirm',
  Cancel = 'Cancel',
  MenuUp = 'MenuUp',
  MenuDown = 'MenuDown',
  MenuLeft = 'MenuLeft',
  MenuRight = 'MenuRight',
}

export const COMBAT_ACTIONS: readonly Action[] = [
  Action.PunchLeft, Action.PunchRight, Action.AimHigh, Action.AimLow,
  Action.DodgeLeft, Action.DodgeRight, Action.Block, Action.Special,
];

/** Actions the player is allowed to remap in Settings. */
export const REMAPPABLE: readonly Action[] = [
  ...COMBAT_ACTIONS, Action.Pause,
];

export const ACTION_LABELS: Record<Action, string> = {
  [Action.PunchLeft]: 'Left Punch',
  [Action.PunchRight]: 'Right Punch',
  [Action.AimHigh]: 'Head Punch / Aim High',
  [Action.AimLow]: 'Body Punch / Aim Low',
  [Action.DodgeLeft]: 'Dodge Left',
  [Action.DodgeRight]: 'Dodge Right',
  [Action.Block]: 'Block / Parry',
  [Action.Special]: 'Special / Counter',
  [Action.Pause]: 'Pause',
  [Action.Confirm]: 'Confirm',
  [Action.Cancel]: 'Back',
  [Action.MenuUp]: 'Menu Up',
  [Action.MenuDown]: 'Menu Down',
  [Action.MenuLeft]: 'Menu Left',
  [Action.MenuRight]: 'Menu Right',
};

export type KeyBindings = Record<Action, string[]>;
export type PadBindings = Record<Action, number[]>;

export const DEFAULT_KEYS: KeyBindings = {
  [Action.PunchLeft]: ['KeyA'],
  [Action.PunchRight]: ['KeyD'],
  [Action.AimHigh]: ['KeyW', 'ArrowUp'],
  [Action.AimLow]: ['KeyS', 'ArrowDown'],
  [Action.DodgeLeft]: ['KeyQ', 'ArrowLeft'],
  [Action.DodgeRight]: ['KeyE', 'ArrowRight'],
  [Action.Block]: ['Space'],
  [Action.Special]: ['ShiftLeft', 'ShiftRight'],
  [Action.Pause]: ['Escape'],
  [Action.Confirm]: ['Enter', 'Space', 'NumpadEnter'],
  [Action.Cancel]: ['Escape', 'Backspace'],
  [Action.MenuUp]: ['KeyW', 'ArrowUp'],
  [Action.MenuDown]: ['KeyS', 'ArrowDown'],
  [Action.MenuLeft]: ['KeyA', 'ArrowLeft'],
  [Action.MenuRight]: ['KeyD', 'ArrowRight'],
};

/** Standard gamepad button indices (W3C "standard" mapping). */
export const DEFAULT_PAD: PadBindings = {
  [Action.PunchLeft]: [2],        // X / Square
  [Action.PunchRight]: [1],       // B / Circle
  [Action.AimHigh]: [3, 12],      // Y / Triangle, D-pad up
  [Action.AimLow]: [0, 13],       // A / Cross, D-pad down
  [Action.DodgeLeft]: [4, 14],    // LB, D-pad left
  [Action.DodgeRight]: [5, 15],   // RB, D-pad right
  [Action.Block]: [6, 7],         // LT / RT
  [Action.Special]: [10, 11],     // Stick clicks
  [Action.Pause]: [9],            // Start
  [Action.Confirm]: [0],
  [Action.Cancel]: [1],
  [Action.MenuUp]: [12],
  [Action.MenuDown]: [13],
  [Action.MenuLeft]: [14],
  [Action.MenuRight]: [15],
};

export const PAD_BUTTON_NAMES: Record<number, string> = {
  0: 'A / Cross', 1: 'B / Circle', 2: 'X / Square', 3: 'Y / Triangle',
  4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 8: 'Select', 9: 'Start',
  10: 'L-Stick', 11: 'R-Stick', 12: 'D-Up', 13: 'D-Down', 14: 'D-Left', 15: 'D-Right',
  16: 'Home',
};

export function prettyKey(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  if (code.startsWith('Arrow')) return code.slice(5) + ' Arrow';
  switch (code) {
    case 'Space': return 'Space';
    case 'ShiftLeft': return 'L-Shift';
    case 'ShiftRight': return 'R-Shift';
    case 'ControlLeft': return 'L-Ctrl';
    case 'ControlRight': return 'R-Ctrl';
    case 'Escape': return 'Esc';
    case 'Enter': return 'Enter';
    case 'Backspace': return 'Backspace';
    default: return code;
  }
}
