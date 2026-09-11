import { ALL_BOXERS, boxersInLeague, getBoxer, LEAGUE_ORDER } from '../data/boxers';
import type { BoxerDef, League } from '../data/types';
import { applyUpgrades, UPGRADES } from '../data/player';
import type { FighterStats } from '../combat/Fighter';
import type { SaveSystem } from '../save/SaveSystem';
import { ARENA_LIST } from '../data/arenas';

export interface FightReward {
  money: number;
  rank: number;
  unlockedBoxers: BoxerDef[];
  unlockedArenas: string[];
  leagueAdvanced: League | null;
  becameChampion: boolean;
}

/**
 * Career progression.
 *
 * The ladder is strictly ordered inside each league, so every opponent is a
 * deliberate lesson the next one builds on. Beating an opponent unlocks them
 * for Arcade and Training, which is how the game encourages you to go back and
 * actually *learn* someone who gave you trouble.
 */
export class CareerSystem {
  constructor(private readonly save: SaveSystem) {}

  get state() { return this.save.data.career; }

  get leagueId(): League { return LEAGUE_ORDER[Math.min(this.state.league, LEAGUE_ORDER.length - 1)]; }

  /** The next opponent on the ladder, or null once the career is complete. */
  get nextOpponent(): BoxerDef | null {
    const s = this.state;
    if (s.league >= LEAGUE_ORDER.length) return null;
    const list = boxersInLeague(LEAGUE_ORDER[s.league]);
    return list[s.next] ?? null;
  }

  get complete(): boolean { return this.state.league >= LEAGUE_ORDER.length; }

  /** Every opponent in order, with their current status. */
  ladder(): { boxer: BoxerDef; state: 'cleared' | 'next' | 'locked' }[] {
    const out: { boxer: BoxerDef; state: 'cleared' | 'next' | 'locked' }[] = [];
    const next = this.nextOpponent;
    for (const lg of LEAGUE_ORDER) {
      for (const b of boxersInLeague(lg)) {
        out.push({
          boxer: b,
          state: this.state.cleared.includes(b.id) ? 'cleared' : b.id === next?.id ? 'next' : 'locked',
        });
      }
    }
    return out;
  }

  start(): void {
    const s = this.state;
    s.active = true;
    if (!s.cleared.length) {
      s.league = 0;
      s.next = 0;
      s.money = 0;
      s.rank = 0;
      s.fights = 0;
      s.wins = 0;
      s.losses = 0;
      s.champion = false;
      s.upgrades = {};
    }
    this.save.unlockBoxer(boxersInLeague('rookie')[0].id);
    this.save.markDirty();
  }

  /** Wipes career progress but keeps unlocks, records and lifetime stats. */
  restart(): void {
    const s = this.state;
    s.league = 0; s.next = 0; s.money = 0; s.rank = 0;
    s.cleared = []; s.fights = 0; s.wins = 0; s.losses = 0;
    s.champion = false; s.upgrades = {};
    s.active = true;
    this.save.markDirty();
  }

  playerStats(): FighterStats {
    return applyUpgrades(this.state.upgrades);
  }

  upgradeLevel(key: string): number { return this.state.upgrades[key] ?? 0; }

  upgradeCost(key: string): number | null {
    const u = UPGRADES.find((x) => x.key === key);
    if (!u) return null;
    const lvl = this.upgradeLevel(key);
    if (lvl >= u.maxLevel) return null;
    return u.cost(lvl);
  }

  canAfford(key: string): boolean {
    const c = this.upgradeCost(key);
    return c !== null && this.state.money >= c;
  }

  buyUpgrade(key: string): boolean {
    const cost = this.upgradeCost(key);
    if (cost === null || this.state.money < cost) return false;
    this.state.money -= cost;
    this.state.upgrades[key] = this.upgradeLevel(key) + 1;
    this.save.markDirty();
    return true;
  }

  /** Records a career win and advances the ladder. */
  onWin(boxerId: string, method: 'KO' | 'TKO' | 'DEC', score: number, seconds: number): FightReward {
    const s = this.state;
    const boxer = getBoxer(boxerId);
    const reward: FightReward = {
      money: 0, rank: 0, unlockedBoxers: [], unlockedArenas: [],
      leagueAdvanced: null, becameChampion: false,
    };

    s.fights++;
    s.wins++;

    // A knockout pays better than a decision, and so does a fast one.
    const speedBonus = seconds > 0 ? Math.max(0, 1 - seconds / 240) : 0;
    const methodMult = method === 'KO' ? 1.5 : method === 'TKO' ? 1.3 : 1;
    reward.money = Math.round(boxer.purse * methodMult * (1 + speedBonus * 0.5));
    reward.rank = Math.round(40 + boxer.purse / 90 + score / 400);
    s.money += reward.money;
    s.rank += reward.rank;

    const rec = this.save.record(boxerId);
    rec.wins++;
    rec.defeated = true;
    if (score > rec.bestScore) rec.bestScore = score;
    if (method !== 'DEC' && (rec.bestTime === 0 || seconds < rec.bestTime)) rec.bestTime = seconds;

    if (this.save.unlockBoxer(boxerId)) reward.unlockedBoxers.push(boxer);

    if (!s.cleared.includes(boxerId)) {
      s.cleared.push(boxerId);
      // Advance only if this was the opponent actually in front of us.
      const next = this.nextOpponent;
      if (next && next.id === boxerId) {
        s.next++;
        const list = boxersInLeague(LEAGUE_ORDER[s.league]);
        if (s.next >= list.length) {
          s.league++;
          s.next = 0;
          if (s.league < LEAGUE_ORDER.length) reward.leagueAdvanced = LEAGUE_ORDER[s.league];
          else { s.champion = true; reward.becameChampion = true; }
        }
      }
    }

    // Arenas unlock as the circuit grows.
    for (const a of ARENA_LIST) {
      if (a.unlockedBy === boxerId && this.save.unlockArena(a.id)) reward.unlockedArenas.push(a.id);
    }
    // Also unlock the next opponent so Arcade can preview who is coming.
    const upcoming = this.nextOpponent;
    if (upcoming && this.save.unlockBoxer(upcoming.id)) reward.unlockedBoxers.push(upcoming);

    this.save.markDirty();
    return reward;
  }

  onLoss(boxerId: string): void {
    const s = this.state;
    s.fights++;
    s.losses++;
    // A loss costs ranking points but never progress: the ladder still waits.
    s.rank = Math.max(0, s.rank - 18);
    const rec = this.save.record(boxerId);
    rec.losses++;
    this.save.markDirty();
  }

  /** Marks a weak point as discovered, for the boxer profile screen. */
  noteWeaknessFound(boxerId: string): void {
    const rec = this.save.record(boxerId);
    if (!rec.weaknessFound) {
      rec.weaknessFound = true;
      this.save.markDirty();
    }
  }

  /** Boxers available in Arcade and Training. */
  unlockedBoxers(): BoxerDef[] {
    return ALL_BOXERS.filter((b) => this.save.isUnlocked(b.id));
  }

  /** Progress through the whole career, 0..1. */
  get progress(): number {
    return this.state.cleared.length / ALL_BOXERS.length;
  }

  get title(): string {
    const r = this.state.rank;
    if (this.state.champion) return 'WORLD CHAMPION';
    if (r >= 1400) return 'CONTENDER';
    if (r >= 900) return 'RANKED';
    if (r >= 500) return 'PROSPECT';
    if (r >= 200) return 'JOURNEYMAN';
    return 'ROOKIE';
  }
}
