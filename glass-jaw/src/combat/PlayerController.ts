import { Action } from '../input/Actions';
import { InputManager } from '../input/InputManager';
import { Fighter, FState } from './Fighter';
import { playerPunch, specialForTokens, Zone } from './Attack';
import { PlayerProfile } from '../ai/PlayerProfile';
import type { FightEvents } from './types';
import { EventBus } from '../core/EventBus';

/**
 * Turns input into fighter actions.
 *
 * Responsiveness rules this file lives by:
 *  - Read buffered presses, so an input a few frames early still comes out.
 *  - Resolve the highest-priority action first and consume only that one.
 *  - Never introduce a "wait one frame to see if a modifier arrives" delay;
 *    modifiers are checked against already-buffered state instead.
 */
export class PlayerController {
  /** Alternating hand for modifier-only punches (W / S with no A / D). */
  private nextHand: 'left' | 'right' = 'left';
  /** True while combat input is accepted. */
  enabled = true;
  /** Last punch the player threw, for UI feedback. */
  lastPunchId: string | null = null;

  constructor(
    readonly fighter: Fighter,
    private readonly input: InputManager,
    private readonly profile: PlayerProfile,
    private readonly bus: EventBus<FightEvents>,
  ) {}

  /** Aim zone from held modifiers; head is the default. */
  private get aimZone(): Zone {
    if (this.input.isDown(Action.AimLow)) return 'body';
    return 'head';
  }

  update(_dt: number, opponent: Fighter): void {
    const f = this.fighter;
    if (!this.enabled || f.defeated || f.isDown) return;

    // --- Block is a hold, handled every frame regardless of action state ----
    const wantsBlock = this.input.isDown(Action.Block);
    if (wantsBlock && (f.state === FState.Idle || f.state === FState.Block ||
      (f.state === FState.Recovery && f.canAct))) {
      const zone = this.aimZone;
      const wasBlocking = f.state === FState.Block;
      const zoneChanged = wasBlocking && f.guardZone !== zone;
      f.startBlock(zone);
      if (zoneChanged) {
        // Switching guard height re-arms a shorter parry — reading the zone pays.
        f.parryTimer = Math.max(f.parryTimer, 0.09 * f.stats.counter);
      }
      if (!wasBlocking) {
        this.profile.recordBlock();
        this.bus.emit('block', { fighter: f, correct: true });
      }
    } else if (!wantsBlock && f.state === FState.Block) {
      f.stopBlock();
    }

    if (!f.canAct) return;

    // --- 1. Special -------------------------------------------------------
    if (this.input.isBuffered(Action.Special) && f.special.tokens > 0) {
      // SHIFT alone spends everything; SHIFT + S spends exactly one token.
      const wantMinimum = this.input.isDown(Action.AimLow);
      const count = wantMinimum ? 1 : f.special.tokens;
      const def = specialForTokens(count);
      if (def) {
        this.input.consume(Action.Special);
        f.special.spend(count);
        f.startAttack(def);
        this.bus.emit('attackStart', { fighter: f, attack: def });
        this.profile.recordPunch(def.zone, opponent.state === FState.Windup);
        this.lastPunchId = def.id;
        return;
      }
    }

    // --- 2. Dodge ---------------------------------------------------------
    const dl = this.input.isBuffered(Action.DodgeLeft);
    const dr = this.input.isBuffered(Action.DodgeRight);
    if (dl && dr) {
      // Both shoulders at once ducks under a high shot.
      this.input.consume(Action.DodgeLeft);
      this.input.consume(Action.DodgeRight);
      f.startDuck();
      this.bus.emit('dodge', { fighter: f, dir: 'duck', perfect: false });
      return;
    }
    if (dl) {
      this.input.consume(Action.DodgeLeft);
      f.startDodge(-1);
      this.profile.recordDodge(-1);
      this.bus.emit('dodge', { fighter: f, dir: 'left', perfect: false });
      return;
    }
    if (dr) {
      this.input.consume(Action.DodgeRight);
      f.startDodge(1);
      this.profile.recordDodge(1);
      this.bus.emit('dodge', { fighter: f, dir: 'right', perfect: false });
      return;
    }

    // --- 3. Punch ---------------------------------------------------------
    if (wantsBlock) return; // Guard up beats throwing hands.

    const left = this.input.isBuffered(Action.PunchLeft);
    const right = this.input.isBuffered(Action.PunchRight);
    let hand: 'left' | 'right' | null = null;
    let zone: Zone = this.aimZone;

    if (left && right) {
      // Both hands: throw with whichever is "loaded" and aim high.
      hand = this.nextHand;
      zone = 'head';
      this.input.consume(Action.PunchLeft);
      this.input.consume(Action.PunchRight);
    } else if (left) {
      hand = 'left';
      this.input.consume(Action.PunchLeft);
    } else if (right) {
      hand = 'right';
      this.input.consume(Action.PunchRight);
    } else if (this.input.isBuffered(Action.AimHigh)) {
      // W with no hand key: head punch with the alternating hand.
      this.input.consume(Action.AimHigh);
      hand = this.nextHand;
      zone = 'head';
    } else if (this.input.isBuffered(Action.AimLow)) {
      this.input.consume(Action.AimLow);
      hand = this.nextHand;
      zone = 'body';
    }

    if (!hand) return;

    const def = playerPunch(hand, zone);
    f.startAttack(def);
    f.stamina.spend(def.stamina * (f.stamina.gassed ? 0.5 : 1));
    this.nextHand = hand === 'left' ? 'right' : 'left';
    this.lastPunchId = def.id;
    this.profile.recordPunch(zone, opponent.state === FState.Windup);
    this.bus.emit('attackStart', { fighter: f, attack: def });
  }
}
