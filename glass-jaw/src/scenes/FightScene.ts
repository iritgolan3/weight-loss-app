import type { Game, Scene } from '../core/Game';
import type { GameTime } from '../core/Time';
import type { BoxerDef } from '../data/types';
import { getArena } from '../data/arenas';
import { getDifficulty, type Difficulty } from '../data/difficulty';
import { Fighter, FighterStats, FState } from '../combat/Fighter';
import { CombatSystem } from '../combat/CombatSystem';
import { PlayerController } from '../combat/PlayerController';
import { DEFAULT_FIGHT, FightConfig, FightPhase, FightResult, Referee } from '../combat/Referee';
import type { FightEvents, HitResult } from '../combat/types';
import { EventBus } from '../core/EventBus';
import { EnemyAI } from '../ai/EnemyAI';
import { PlayerProfile } from '../ai/PlayerProfile';
import { AnimationSystem } from '../anim/AnimationSystem';

import { ArenaRenderer, RING, RING_BAND_H, OPPONENT_UNIT, PLAYER_UNIT } from '../render/ArenaRenderer';
import type { CrowdMood } from '../render/Crowd';
import { CameraController } from '../render/CameraController';
import { FighterRenderer } from '../render/FighterRenderer';
import { VFXManager } from '../render/VFXManager';
import { HUD, HudState } from '../ui/HUD';
import { PLAYER_LOOK, PLAYER_BASE_STATS } from '../data/player';
import { RNG } from '../core/RNG';
import { clamp01, Ease } from '../core/MathUtil';
import { Action, COMBAT_ACTIONS } from '../input/Actions';
import type { Ctx } from '../render/draw';
import { PALETTE, displayText } from '../ui/ui';
import type { TrainingConfig } from './TrainingConfig';
import { PauseOverlay } from '../ui/screens/PauseOverlay';

export interface FightStats {
  punchesThrown: number;
  punchesLanded: number;
  perfectDodges: number;
  parries: number;
  counters: number;
  weaknessHits: number;
  knockdownsDealt: number;
  knockdownsTaken: number;
  specialsThrown: number;
  damageDealt: number;
  damageTaken: number;
  /** Landed / thrown. */
  accuracy: number;
  maxCombo: number;
}

export interface FightSetup {
  opponent: BoxerDef;
  difficulty: Difficulty;
  playerStats?: FighterStats;
  mode: 'career' | 'arcade' | 'training';
  rounds?: number;
  roundSeconds?: number;
  /** Training configuration; only used when mode === 'training'. */
  training?: TrainingConfig;
  onComplete: (result: FightResult, stats: FightStats) => void;
  onQuit: () => void;
}


/**
 * A complete bout.
 *
 * Draw order is fixed and deliberate: arena, opponent, world VFX, player,
 * foreground framing, HUD, screen VFX. The player never occludes the
 * opponent's tells, and the HUD never sits where the action is.
 */
export class FightScene implements Scene {
  readonly name = 'fight';

  private readonly bus = new EventBus<FightEvents>();
  private readonly rng = new RNG((Date.now() ^ 0x5bf03) >>> 0);

  readonly player: Fighter;
  readonly opponent: Fighter;
  readonly def: BoxerDef;
  private readonly profile = new PlayerProfile();
  private readonly combat: CombatSystem;
  private readonly control: PlayerController;
  readonly ai: EnemyAI;
  readonly ref: Referee;

  private readonly playerAnim: AnimationSystem;
  private readonly oppAnim: AnimationSystem;
  private readonly playerArt: FighterRenderer;
  private readonly oppArt: FighterRenderer;
  private readonly arena: ArenaRenderer;
  private readonly camera = new CameraController();
  private readonly vfx = new VFXManager();
  private readonly hud = new HUD();

  private readonly arenaDef;
  private readonly config: FightConfig;
  private unsub: (() => void)[] = [];

  /** Accumulated fight statistics. */
  readonly stats: FightStats = {
    punchesThrown: 0, punchesLanded: 0, perfectDodges: 0, parries: 0, counters: 0,
    weaknessHits: 0, knockdownsDealt: 0, knockdownsTaken: 0, specialsThrown: 0,
    damageDealt: 0, damageTaken: 0, accuracy: 0, maxCombo: 0,
  };
  private combo = 0;
  private comboTimer = 0;

  /** Excitement drives the crowd and the music mix. */
  private excitement = 0.3;
  private animTime = 0;
  private resultReported = false;
  private resultDelay = 0;
  private tellInfo: HudState['tell'] = null;
  private counterWindow = 0;
  private ambienceTimer = 0;
  /** Set by training mode to suppress career bookkeeping. */
  readonly isTraining: boolean;
  /** Progress toward the current drill's goal, if any. */
  drillProgress = 0;
  drillComplete = false;
  private drillBest = 0;

  constructor(private readonly game: Game, private readonly setup: FightSetup) {
    this.def = setup.opponent;
    this.isTraining = setup.mode === 'training';
    this.arenaDef = getArena(this.def.arena);
    const diff = getDifficulty(setup.difficulty);

    this.player = new Fighter('Kid Comet', true, setup.playerStats ?? PLAYER_BASE_STATS);
    this.opponent = new Fighter(this.def.name, false, this.def.stats);
    this.opponent.weakness = this.def.weakness;

    this.combat = new CombatSystem(this.bus, game.loop.time);
    this.combat.options.enemyDamageScale = diff.enemyDamage;
    this.combat.options.playerDamageScale = diff.playerDamage;
    this.control = new PlayerController(this.player, game.input, this.profile, this.bus);
    this.ai = new EnemyAI(this.def, this.opponent, this.profile, this.bus, this.rng, diff);

    this.config = {
      ...DEFAULT_FIGHT,
      rounds: setup.rounds ?? DEFAULT_FIGHT.rounds,
      roundSeconds: setup.roundSeconds ?? DEFAULT_FIGHT.roundSeconds,
    };
    this.ref = new Referee(this.config, this.player, this.opponent, this.bus, (f) => {
      if (!f.isPlayer) this.ai.onGetUp();
    });

    this.playerAnim = new AnimationSystem(PLAYER_LOOK, false);
    this.oppAnim = new AnimationSystem(this.def.appearance, true);
    this.playerArt = new FighterRenderer(PLAYER_LOOK);
    this.oppArt = new FighterRenderer(this.def.appearance);
    this.arena = new ArenaRenderer(game.renderer);

    // The player's timing windows widen or tighten with difficulty.
    this.player.stats.counter *= diff.window;
    this.applySettings();
  }

  // -- Lifecycle -------------------------------------------------------------

  enter(): void {
    this.player.resetForFight();
    this.opponent.resetForFight();
    this.opponent.weakness = this.def.phaseWeaknesses?.[0] ?? this.def.weakness;
    this.ai.reset();
    this.ref.reset();
    this.profile.reset();
    this.vfx.clear();
    this.camera.reset();
    this.player.setState(FState.Intro, this.config.introSeconds * 60);
    this.opponent.setState(FState.Intro, this.config.introSeconds * 60);

    if (this.setup.training) this.applyTraining(this.setup.training);

    this.subscribe();
    this.game.audio.playMusic(this.musicTrack(), 0.8);
    this.game.onAudioReady = () => this.game.audio.playMusic(this.musicTrack(), 0.4);
  }

  exit(): void {
    for (const off of this.unsub) off();
    this.unsub = [];
    this.bus.clear();
    this.game.onAudioReady = null;
  }

  private musicTrack() {
    if (this.isTraining) return 'training' as const;
    if (this.def.music === 'final') return 'final' as const;
    if (this.def.music === 'boss') return 'boss' as const;
    if (this.def.music === 'world') return 'world' as const;
    if (this.def.music === 'pro') return 'pro' as const;
    return 'rookie' as const;
  }

  private applySettings(): void {
    const s = this.game.settings.current;
    this.camera.settings.shakeScale = s.cameraShake;
    this.camera.settings.motionScale = s.screenEffects;
    this.vfx.intensity = s.screenEffects;
    this.vfx.flashIntensity = s.flashIntensity;
    this.vfx.particles.budget = this.game.renderer.quality.particles * s.screenEffects;
    this.combat.options.hitStopScale = s.hitStop;
    this.combat.options.slowMoScale = s.slowMotion;
  }

  /** Counts a drill event and fires the completion moment once. */
  private noteDrill(kind: TrainingConfig['goal'], amount = 1): void {
    const t = this.setup.training;
    if (!t || t.goal !== kind || this.drillComplete) return;
    this.drillProgress += amount;
    this.drillBest = Math.max(this.drillBest, this.drillProgress);
    if (t.target > 0 && this.drillProgress >= t.target) {
      this.drillComplete = true;
      this.game.audio.play('uiUnlock');
      this.game.audio.play('crowdBig');
      this.callout('DRILL COMPLETE!', 320, PALETTE.green, 82);
      this.vfx.flash(PALETTE.green, 0.3, 0.3);
    }
  }

  private applyTraining(t: TrainingConfig): void {
    this.combat.playerInvincible = t.invincible;
    this.ai.passive = t.passive;
    this.ai.forcedRoutine = t.forcedRoutine ?? null;
    if (t.infiniteStamina) this.player.stamina.regenRate = 1e4;
    if (t.startTokens) this.player.special.tokens = t.startTokens;
    if (t.opponentHealthScale) {
      this.opponent.health.current = this.opponent.health.max * t.opponentHealthScale;
    }
  }

  resize(): void { this.arena.invalidate(); }

  // -- Events ----------------------------------------------------------------

  private subscribe(): void {
    const audio = this.game.audio;

    this.unsub.push(this.bus.on('hit', (r) => this.onHit(r)));

    this.unsub.push(this.bus.on('attackStart', ({ fighter, attack }) => {
      if (fighter.isPlayer) {
        this.stats.punchesThrown++;
        if (attack.tier) this.stats.specialsThrown++;
      }
    }));

    this.unsub.push(this.bus.on('telegraph', (t) => {
      this.tellInfo = { label: t.label, color: t.color, side: t.side, remaining: t.frames / 60 };
      const tg = this.def.attacks[Object.keys(this.def.attacks).find(
        (k) => this.def.attacks[k].telegraph?.kind === t.kind,
      ) ?? ''];
      const sfx = tg?.telegraph?.sfx ?? 'tellLow';
      audio.play(sfx as 'tellLow' | 'tellBig' | 'tellFast');
    }));

    this.unsub.push(this.bus.on('dodge', ({ fighter, dir, perfect }) => {
      if (!fighter.isPlayer) return;
      const p = this.screenOf(fighter);
      audio.play(perfect ? 'perfectDodge' : 'dodge', { dir: dir === 'left' ? -1 : 1 });
      this.vfx.dodge(p.x, p.y - 220, dir === 'left' ? -1 : 1, perfect);
      if (perfect) {
        this.stats.perfectDodges++;
        this.noteDrill('dodges');
        this.excitement = Math.min(1, this.excitement + 0.22);
        this.callout('PERFECT DODGE', 380, PALETTE.green, 72);
        this.camera.onCounter(0, -60);
        this.counterWindow = 0.5;
        audio.play('crowdCheer');
        this.crowdReact(0.5);
        this.profile.recordCounter(true);
      }
    }));

    this.unsub.push(this.bus.on('parry', () => {
      this.stats.parries++;
      this.noteDrill('blocks');
      const p = this.screenOf(this.player);
      audio.play('parry');
      this.vfx.parry(p.x, p.y - 260);
      this.callout('PARRY!', 380, PALETTE.gold, 68);
      this.camera.onCounter(0, -40);
      this.counterWindow = 0.45;
      this.crowdReact(0.45);
      audio.play('crowdCheer');
    }));

    this.unsub.push(this.bus.on('guardBreak', ({ fighter }) => {
      audio.play('guardBreak');
      const p = this.screenOf(fighter);
      this.vfx.impact(p.x, p.y - 240, 0.8, '#ffb347', true);
      this.callout('GUARD BROKEN', 400, PALETTE.orange, 62);
      this.camera.shake(0.6);
      this.crowdReact(fighter.isPlayer ? 0.3 : 0.6);
    }));

    this.unsub.push(this.bus.on('stun', ({ fighter }) => {
      audio.play('stun');
      const p = this.screenOf(fighter);
      this.vfx.stun(p.x, p.y - (fighter.isPlayer ? 560 : 430));
      if (!fighter.isPlayer) {
        this.callout('STUNNED!', 340, PALETTE.gold, 80);
        audio.play('crowdBig');
        this.crowdReact(0.8);
        this.excitement = 1;
      }
    }));

    this.unsub.push(this.bus.on('token', ({ fighter, tokens, reason }) => {
      if (!fighter.isPlayer) return;
      audio.play('token', { tier: tokens });
      const p = this.screenOf(this.opponent);
      this.vfx.token(p.x, p.y - 300);
      const words: Record<string, string> = {
        weakness: 'WEAK POINT!',
        perfectCounter: 'COUNTER STAR!',
        parryCounter: 'PARRY STAR!',
        perfectDodgeCounter: 'SLIP STAR!',
        stunFinish: 'STAR!',
      };
      this.callout(words[reason] ?? 'STAR!', 300, PALETTE.gold, 64);
      this.crowdReact(0.4);
    }));

    this.unsub.push(this.bus.on('knockdown', ({ fighter }) => {
      const p = this.screenOf(fighter);
      audio.play('knockdown');
      audio.play('crowdBig');
      this.vfx.knockdown(p.x, p.y - 120);
      this.camera.onKnockdown(0, 40);
      // A man on the canvas empties the seats either way; it is louder when
      // it is the man they came to see go down.
      this.crowdReact(fighter.isPlayer ? 0.8 : 1);
      this.excitement = 1;
      if (fighter.isPlayer) {
        this.stats.knockdownsTaken++;
        this.callout('DOWN!', 300, PALETTE.red, 96);
      } else {
        this.stats.knockdownsDealt++;
        this.callout('KNOCKDOWN!', 300, PALETTE.gold, 96);
      }
      this.ref.onKnockdown(fighter);
    }));

    this.unsub.push(this.bus.on('countOut', () => {
      if (this.ref.count > 0 && this.ref.count <= 10) audio.count(this.ref.count);
    }));

    this.unsub.push(this.bus.on('getUp', ({ fighter }) => {
      audio.play('crowdCheer');
      this.crowdReact(0.7);
      this.callout(fighter.isPlayer ? 'UP!' : 'HE IS UP!', 340,
        fighter.isPlayer ? PALETTE.green : PALETTE.orange, 62);
    }));

    this.unsub.push(this.bus.on('roundStart', () => {
      audio.play('bell');
      this.crowdReact(0.5);
    }));
    this.unsub.push(this.bus.on('roundEnd', () => {
      audio.play('bell3');
      // The final bell is the whole room on its feet, not a polite ripple.
      if (this.ref.round >= this.ref.config.rounds) this.arena.ovation();
      else this.crowdReact(0.45);
    }));

    this.unsub.push(this.bus.on('phaseChange', ({ fighter, phase, rage }) => {
      if (fighter.isPlayer) return;
      audio.play('crowdBig');
      this.camera.shake(0.5);
      this.crowdReact(rage ? 0.75 : 0.55);
      this.vfx.flash(this.def.appearance.glow, 0.35, 0.3);
      if (rage) {
        this.callout('ENRAGED!', 320, PALETTE.red, 86);
      } else if (phase > 0 && this.def.boss) {
        this.callout(`PHASE ${phase + 1}`, 320, this.def.appearance.glow, 76);
      }
      // Remind the player that a boss's weak point just moved.
      if (this.def.phaseWeaknesses && phase > 0) {
        this.callout('WEAK POINT MOVED', 410, PALETTE.gold, 44);
      }
    }));

    this.unsub.push(this.bus.on('taunt', ({ fighter }) => {
      if (fighter.isPlayer) return;
      audio.voice(this.def.voice.pitch, this.def.voice.grit, 0);
      const line = this.rng.pick(this.def.quotes.taunt);
      this.callout(line, 470, '#ffffff', 34, 'drift');
      this.crowdReact(0.22);
    }));

    this.unsub.push(this.bus.on('fightEnd', () => {
      this.arena.ovation();
      this.resultDelay = 2.4;
      this.game.audio.stopMusic(0.5);
    }));
  }

  /**
   * Tells the audience something happened.
   *
   * `strength` is 0..1 and IS the severity of the event: a jab barely stirs
   * the front rows, a knockdown takes the whole room out of its seat. Every
   * gameplay event routes through here so the crowd can never end up cheering
   * at the wrong size — which is the thing that makes an arcade crowd read as
   * wallpaper instead of an audience.
   */
  private crowdReact(strength: number): void {
    this.arena.react(clamp01(strength));
    this.excitement = Math.min(1, this.excitement + strength * 0.35);
  }

  /** The room's baseline, from what is happening in the fight right now. */
  private updateCrowdMood(): void {
    const hurt = Math.min(this.player.health.fraction, this.opponent.health.fraction);
    let mood: CrowdMood;
    if (this.ref.phase === FightPhase.Count || this.ref.phase === FightPhase.Finished) {
      mood = 'roaring';
    } else if (this.ref.phase === FightPhase.BetweenRounds || this.ref.phase === FightPhase.Intro) {
      mood = 'interested';
    } else if (hurt < 0.3 || this.excitement > 0.6) {
      mood = 'roaring';
    } else if (hurt < 0.62 || this.excitement > 0.28) {
      mood = 'excited';
    } else {
      mood = 'interested';
    }
    this.arena.setMood(mood);
  }

  private onHit(r: HitResult): void {
    const audio = this.game.audio;
    const target = this.screenOf(r.defender);
    const unit = r.defender.isPlayer ? PLAYER_UNIT : OPPONENT_UNIT;
    const ix = target.x + r.x * unit * (r.defender.isPlayer ? 1 : -1);
    const iy = target.y + r.y * unit;
    const byPlayer = r.attacker.isPlayer;

    switch (r.outcome) {
      case 'dodge':
      case 'perfectDodge':
        if (!byPlayer) return; // player dodge feedback is handled in 'dodge'
        this.ai.notifyMissed();
        return;

      case 'parry':
        return;

      case 'block':
      case 'grazeBlock':
        if (r.outcome === 'block' && !byPlayer) this.noteDrill('blocks');
        audio.play(r.outcome === 'block' ? 'block' : 'blockWrong');
        this.vfx.block(ix, iy, r.outcome === 'block');
        this.camera.shake(0.1);
        this.crowdReact(0.06);
        if (byPlayer) this.ai.notifyMissed();
        return;

      default:
        break;
    }

    // --- A punch actually landed -------------------------------------------
    const heavy = r.attack.weight >= 2 || r.outcome === 'perfectCounter' || r.outcome === 'weakness';
    const color = r.outcome === 'weakness' ? '#ffd166'
      : r.outcome === 'perfectCounter' ? '#7ef9a2'
      : r.outcome === 'counter' ? '#4cc9f0' : '#ffe9a8';

    this.vfx.impact(ix, iy, r.intensity, color, heavy);
    this.camera.onHit(r.intensity, byPlayer ? 1 : -1);
    // Ordinary hit: a murmur. Heavy shot or clean counter: a roar.
    this.crowdReact(r.intensity * (heavy ? 0.75 : 0.3) + (byPlayer ? 0.08 : 0));

    if (r.attack.tier) audio.play(`special${Math.min(3, r.attack.tier)}` as 'special1' | 'special2' | 'special3');
    else if (r.outcome === 'perfectCounter' || r.outcome === 'weakness') audio.play('counter');
    else if (r.zone === 'body') audio.play('punchBody', { weight: r.attack.weight });
    else if (r.attack.weight >= 2) audio.play('punchHeavy', { weight: r.attack.weight });
    else audio.play('punchMed', { weight: r.attack.weight });

    // Vocal reaction from whoever ate it.
    const hurt = clamp01(r.damage / 18);
    if (r.defender.isPlayer) audio.voice(1.02, 0.35, hurt);
    else audio.voice(this.def.voice.pitch, this.def.voice.grit, hurt);

    this.ref.noteDamage(byPlayer, r.damage);

    if (byPlayer) {
      this.stats.punchesLanded++;
      this.stats.damageDealt += r.damage;
      this.ai.notifyLanded();
      this.combo++;
      this.comboTimer = 1.3;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
      if (this.setup.training?.goal === 'combo') this.drillProgress = this.stats.maxCombo;
      if (this.setup.training?.goal === 'reaction') this.noteDrill('reaction');
      this.excitement = Math.min(1, this.excitement + 0.06 + r.intensity * 0.2);

      if (r.outcome === 'weakness') {
        this.stats.weaknessHits++;
        this.callout('WEAK POINT!', 330, PALETTE.gold, 88);
        this.camera.onCounter(0, -50);
        this.vfx.flash('#ffd166', 0.4, 0.2);
        audio.play('crowdBig');
        this.ref.addScore(1200);
        this.game.career.noteWeaknessFound(this.def.id);
      } else if (r.outcome === 'perfectCounter') {
        this.stats.counters++;
        this.noteDrill('counters');
        this.callout('PERFECT COUNTER!', 330, PALETTE.green, 76);
        this.camera.onCounter(0, -40);
        audio.play('crowdCheer');
        this.ref.addScore(700);
        this.profile.recordCounter(true);
      } else if (r.outcome === 'counter') {
        this.stats.counters++;
        this.noteDrill('counters');
        this.callout('COUNTER', 350, PALETTE.blue, 58);
        this.ref.addScore(300);
      } else if (this.combo >= 3) {
        // Offset to the side so a combo counter never covers the opponent.
        this.vfx.callout(`${this.combo} HIT`, this.game.renderer.dw / 2 + 300,
          this.band + 420, PALETTE.gold, 46, 'drift');
      }
      this.ref.addScore(r.damage * 8);
    } else {
      this.stats.damageTaken += r.damage;
      this.combo = 0;
      this.profile.recordHitTaken();
      this.excitement = Math.min(1, this.excitement + 0.04);
      if (r.intensity > 0.6) this.vfx.flash('#ff4d4d', 0.24, 0.18);
    }
  }

  // -- Layout ---------------------------------------------------------------

  /** 0..1 how far through a knockdown a fighter is, for framing. */
  private downAmount(f: Fighter): number {
    if (f.state === FState.KnockedDown) return clamp01(f.downPose);
    if (f.state === FState.GettingUp) return clamp01(1 - f.progress);
    return 0;
  }

  /** Vertical offset of the authored ring band within the design space. */
  private get band(): number {
    return Math.max(0, (this.game.renderer.dh - RING_BAND_H) / 2);
  }

  /**
   * Big callout text, positioned relative to the ring band so it stays with
   * the action on tall displays instead of drifting to the top of the screen.
   */
  private callout(text: string, y: number, color: string, size: number,
    style: 'slam' | 'pop' | 'drift' = 'slam'): void {
    this.vfx.callout(text, this.game.renderer.dw / 2, this.band + y, color, size, style);
  }

  /** Screen position of a fighter's feet. */
  private screenOf(f: Fighter): { x: number; y: number } {
    const cx = this.game.renderer.dw / 2;
    if (f.isPlayer) {
      return { x: cx + this.playerAnim.pose.offset.x * PLAYER_UNIT, y: RING.playerFeet };
    }
    return {
      x: cx - this.oppAnim.pose.offset.x * OPPONENT_UNIT,
      y: RING.opponentFeet - this.downAmount(f) * 168,
    };
  }

  // -- Update ---------------------------------------------------------------

  update(dt: number, _time: GameTime): void {
    const input = this.game.input;

    // Pause.
    if (input.justPressed(Action.Pause) && this.ref.phase !== FightPhase.Finished) {
      this.game.audio.play('uiBack');
      this.game.push(new PauseOverlay(this.game, this));
      return;
    }

    // Intro: any combat button skips it.
    if (this.ref.phase === FightPhase.Intro) {
      for (const a of COMBAT_ACTIONS) {
        if (input.justPressed(a) || input.justPressed(Action.Confirm)) { this.ref.skipIntro(); break; }
      }
    }

    // Mash to beat the count.
    if (this.ref.phase === FightPhase.Count && this.ref.downed?.isPlayer) {
      for (const a of COMBAT_ACTIONS) if (input.justPressed(a)) this.ref.mash();
      if (input.justPressed(Action.Confirm)) this.ref.mash();
    }

    this.ref.update(dt, this.def.ai.getUpSpeed);
    this.profile.update(dt);

    // Combat only runs while the round is live.
    if (this.ref.inputsLive) {
      this.control.update(dt, this.opponent);
      this.ai.update(dt, this.player);
      this.combat.update(this.player, this.opponent);
    }

    this.player.update(dt);
    this.opponent.update(dt);

    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.combo = 0;

    this.counterWindow = Math.max(0, this.counterWindow - dt);
    this.updateCrowdMood();
    if (this.tellInfo) {
      this.tellInfo.remaining -= dt;
      if (this.tellInfo.remaining <= 0) this.tellInfo = null;
    }

    // Report the result once the celebration has had a moment to land.
    if (this.ref.phase === FightPhase.Finished && !this.resultReported) {
      this.resultDelay -= dt;
      if (this.resultDelay <= 0) {
        this.resultReported = true;
        this.stats.accuracy = this.stats.punchesThrown > 0
          ? this.stats.punchesLanded / this.stats.punchesThrown : 0;
        this.setup.onComplete(this.ref.result!, this.stats);
      }
    }
  }

  updateRaw(rawDt: number): void {
    this.animTime += rawDt;
    this.camera.update(rawDt);
    this.vfx.update(rawDt);
    this.playerAnim.update(rawDt, this.player, this.animTime);
    this.oppAnim.update(rawDt, this.opponent, this.animTime);

    // Excitement decays, and drives crowd volume and music intensity.
    this.excitement = Math.max(0.18, this.excitement - rawDt * 0.12);
    this.game.audio.setMusicIntensity(this.excitement);
    this.ambienceTimer -= rawDt;
    if (this.ambienceTimer <= 0) {
      this.ambienceTimer = 2.4;
      this.game.audio.ambience(0.18 + this.excitement * 0.5, 2.6);
    }

    // Sweat when gassed or badly hurt.
    if (this.player.stamina.gassed && this.rng.chance(rawDt * 5)) {
      const p = this.screenOf(this.player);
      this.vfx.sweat(p.x + this.rng.range(-60, 60), p.y - 520, 1);
    }
    if (this.opponent.stamina.gassed && this.rng.chance(rawDt * 5)) {
      const p = this.screenOf(this.opponent);
      this.vfx.sweat(p.x + this.rng.range(-50, 50), p.y - 400, 1);
    }

    this.hud.update(rawDt, this.hudState());
  }

  private hudState(): HudState {
    return {
      player: this.player,
      opponent: this.opponent,
      def: this.def,
      ref: this.ref,
      settings: this.game.settings.current,
      time: this.animTime,
      tell: this.tellInfo,
      counterWindow: this.counterWindow,
      drill: this.setup.training
        ? {
            name: this.setup.training.name,
            goal: this.setup.training.goal,
            progress: Math.round(this.drillProgress),
            target: this.setup.training.target,
            complete: this.drillComplete,
          }
        : null,
      dw: this.game.renderer.dw,
      dh: this.game.renderer.dh,
    };
  }

  // -- Render ---------------------------------------------------------------

  render(ctx: Ctx, _alpha: number, _time: GameTime): void {
    const r = this.game.renderer;
    const dw = r.dw, dh = r.dh;
    const cx = dw / 2;
    // Centre the authored 1080-tall ring band in whatever design space we have.
    const band = (dh - RING_BAND_H) / 2;

    if (band > 0.5) {
      ctx.fillStyle = '#05030a';
      ctx.fillRect(0, 0, dw, dh);
    }

    ctx.save();
    ctx.translate(0, band);
    this.camera.apply(ctx, cx, RING_BAND_H * 0.52);

    this.arena.drawBack(ctx, this.arenaDef, this.animTime, this.game.loop.time.rawDt);

    // --- Opponent ---
    const oppTell = this.opponent.tellGlow;
    if (oppTell > 0.05) this.drawTellPulse(ctx, cx, oppTell);
    // A downed fighter lies toward the back of the ring, not into the camera:
    // raise and shrink them so the sprawl never lands on top of the player.
    const down = this.downAmount(this.opponent);
    this.oppArt.draw(ctx, this.oppAnim.pose, {
      x: cx, y: RING.opponentFeet - down * 168,
      unit: OPPONENT_UNIT * (1 - down * 0.12), facing: -1, showFace: true, flash: this.opponent.flash, tell: oppTell,
      tellColor: this.opponent.telegraphColor,
      rage: this.opponent.ragePulse, stun: this.opponent.state === FState.Stunned ? 1 : 0,
      gassed: this.opponent.stamina.gassed ? 1 : clamp01(1 - this.opponent.health.fraction * 1.4),
      hurt: clamp01(1 - this.opponent.health.fraction), alpha: 1, time: this.animTime,
    });

    // The referee works between the two fighters in depth: behind the player,
    // in front of the man he is counting over.
    this.arena.drawReferee(ctx, dw, this.animTime, this.refereeState(),
      this.ref.phase === FightPhase.Count ? this.ref.timer : 0);

    this.vfx.drawWorld(ctx);

    // --- Player (foreground, seen from behind) ---
    this.playerArt.draw(ctx, this.playerAnim.pose, {
      x: cx, y: RING.playerFeet, unit: PLAYER_UNIT, facing: 1, showFace: false, flash: this.player.flash, tell: 0, tellColor: '#ffffff',
      rage: 0, stun: this.player.state === FState.Stunned ? 1 : 0,
      gassed: this.player.stamina.gassed ? 1 : 0,
      hurt: clamp01(1 - this.player.health.fraction), alpha: 1, time: this.animTime,
    });

    this.arena.drawFront(ctx, this.arenaDef, dw);
    ctx.restore();

    // --- HUD (outside the camera transform so it never shakes) ---
    const hs = this.hudState();
    if (this.ref.phase === FightPhase.Intro) this.hud.drawIntro(ctx, hs);
    else this.hud.draw(ctx, hs);

    this.vfx.drawScreen(ctx, dw, dh);

    if (this.ref.phase === FightPhase.Finished) this.drawFinishBanner(ctx, dw, dh);
  }

  /** What the referee should be doing right now. */
  private refereeState(): 'idle' | 'counting' | 'waveOff' | 'raiseWinner' {
    if (this.ref.phase === FightPhase.Count) return 'counting';
    if (this.ref.phase === FightPhase.Finished) {
      return this.ref.result?.winner === this.player ? 'raiseWinner' : 'waveOff';
    }
    return 'idle';
  }

  /**
   * The telegraph cue, drawn BEHIND the opponent.
   *
   * This used to be a radial-gradient bloom laid over the fighter, which
   * washed the character out to a glowing smear and broke the flat-cel style
   * everywhere else in the game obeys. It is now hard-edged: concentric rings
   * that snap outward on the telegraph's own clock. It reads at a glance, it
   * cannot hide the animation that is the real tell, and it is drawn.
   */
  private drawTellPulse(ctx: Ctx, cx: number, strength: number): void {
    const y = RING.opponentFeet - 300;
    const col = this.opponent.telegraphColor;
    ctx.save();
    ctx.globalAlpha = clamp01(strength) * 0.85 * this.vfx.intensity;
    ctx.lineCap = 'butt';
    for (let i = 0; i < 3; i++) {
      // Each ring runs its own phase, so they chase outward rather than pulse
      // together. Hard stroke, flat colour, no blur.
      const t = ((this.animTime * 1.9 + i * 0.34) % 1);
      const r = 120 + t * 330;
      ctx.globalAlpha = clamp01(strength) * (1 - t) * 0.8 * this.vfx.intensity;
      ctx.strokeStyle = col;
      ctx.lineWidth = 16 * (1 - t * 0.55);
      ctx.beginPath();
      ctx.ellipse(cx, y, r, r * 0.78, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawFinishBanner(ctx: Ctx, dw: number, dh: number): void {
    const res = this.ref.result;
    if (!res) return;
    const won = res.winner === this.player;
    const t = clamp01(1 - this.resultDelay / 2.4);
    const pop = Ease.backOut(clamp01(t * 3));
    ctx.save();
    ctx.globalAlpha = clamp01(t * 4);
    ctx.fillStyle = 'rgba(6,4,10,0.42)';
    ctx.fillRect(0, 0, dw, dh);
    ctx.translate(dw / 2, dh * 0.4);
    ctx.scale(pop, pop);
    const word = res.method === 'DEC' ? (won ? 'DECISION' : 'DECISION') : res.method;
    displayText(ctx, won ? word : 'DOWN AND OUT', 0, 0, 132,
      won ? PALETTE.gold : PALETTE.red, { outlineWidth: 22, shadow: won ? PALETTE.orange : PALETTE.red });
    displayText(ctx, won ? 'YOU WIN' : 'YOU LOSE', 0, 104, 52, PALETTE.text, { outlineWidth: 10 });
    ctx.restore();
  }

  /** Used by the pause overlay to draw the frozen fight behind it. */
  get transparent(): boolean { return false; }

  quit(): void { this.setup.onQuit(); }
}
