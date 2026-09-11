import type { Difficulty } from '../data/difficulty';

export interface BoxerRecord {
  /** Fights won against this opponent. */
  wins: number;
  losses: number;
  /** Fastest knockout, in seconds. 0 = never KO'd them. */
  bestTime: number;
  /** Highest score earned against them. */
  bestScore: number;
  /** True once they have been beaten at least once. */
  defeated: boolean;
  /** True once their weak point has been discovered in a fight. */
  weaknessFound: boolean;
  /** Times knocked down by the player, lifetime. */
  knockdowns: number;
}

export interface CareerState {
  active: boolean;
  /** Index into LEAGUE_ORDER. */
  league: number;
  /** Order index of the next opponent inside that league. */
  next: number;
  money: number;
  /** Total ranking points. */
  rank: number;
  upgrades: Record<string, number>;
  /** Boxer ids the player has beaten in career mode. */
  cleared: string[];
  /** Career fight count. */
  fights: number;
  wins: number;
  losses: number;
  /** True once the championship has been won. */
  champion: boolean;
}

export interface Stats {
  punchesThrown: number;
  punchesLanded: number;
  perfectDodges: number;
  parries: number;
  counters: number;
  weaknessHits: number;
  knockdownsDealt: number;
  knockdownsTaken: number;
  koWins: number;
  totalFights: number;
  totalWins: number;
  totalLosses: number;
  timeInRing: number;
  longestWinStreak: number;
  currentWinStreak: number;
  specialsThrown: number;
}

export interface SaveData {
  version: number;
  career: CareerState;
  /** Per-boxer records, keyed by boxer id. */
  records: Record<string, BoxerRecord>;
  /** Boxer ids unlocked for Arcade and Training. */
  unlockedBoxers: string[];
  unlockedArenas: string[];
  stats: Stats;
  /** Highest difficulty the career has been completed on. */
  clearedDifficulties: Difficulty[];
  lastPlayed: number;
}

export const SAVE_VERSION = 1;
const STORAGE_KEY = 'glassjaw.save.v1';

export function emptyRecord(): BoxerRecord {
  return { wins: 0, losses: 0, bestTime: 0, bestScore: 0, defeated: false, weaknessFound: false, knockdowns: 0 };
}

export function emptySave(): SaveData {
  return {
    version: SAVE_VERSION,
    career: {
      active: false, league: 0, next: 0, money: 0, rank: 0,
      upgrades: {}, cleared: [], fights: 0, wins: 0, losses: 0, champion: false,
    },
    records: {},
    // The first opponent is always available so Arcade is never empty.
    unlockedBoxers: ['paco'],
    unlockedArenas: ['gym'],
    stats: {
      punchesThrown: 0, punchesLanded: 0, perfectDodges: 0, parries: 0, counters: 0,
      weaknessHits: 0, knockdownsDealt: 0, knockdownsTaken: 0, koWins: 0,
      totalFights: 0, totalWins: 0, totalLosses: 0, timeInRing: 0,
      longestWinStreak: 0, currentWinStreak: 0, specialsThrown: 0,
    },
    clearedDifficulties: [],
    lastPlayed: Date.now(),
  };
}

/**
 * Persistence.
 *
 * Writes are debounced and wrapped so a storage failure (private browsing, a
 * full quota) degrades to "this session is not saved" rather than crashing a
 * fight. Loads are defensive: any missing field is filled from a fresh save, so
 * an older save never breaks a newer build.
 */
export class SaveSystem {
  data: SaveData = emptySave();
  /** False when localStorage is unavailable — the UI surfaces this. */
  persistent = true;
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() { this.load(); }

  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { this.data = emptySave(); return; }
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      this.data = this.migrate(parsed);
    } catch {
      this.data = emptySave();
      this.persistent = false;
    }
  }

  private migrate(parsed: Partial<SaveData>): SaveData {
    const fresh = emptySave();
    const out: SaveData = {
      ...fresh,
      ...parsed,
      version: SAVE_VERSION,
      career: { ...fresh.career, ...(parsed.career ?? {}) },
      stats: { ...fresh.stats, ...(parsed.stats ?? {}) },
      records: parsed.records ?? {},
      unlockedBoxers: parsed.unlockedBoxers?.length ? parsed.unlockedBoxers : fresh.unlockedBoxers,
      unlockedArenas: parsed.unlockedArenas?.length ? parsed.unlockedArenas : fresh.unlockedArenas,
      clearedDifficulties: parsed.clearedDifficulties ?? [],
    };
    // Guarantee every referenced record is well-formed.
    for (const [k, v] of Object.entries(out.records)) {
      out.records[k] = { ...emptyRecord(), ...v };
    }
    return out;
  }

  /** Queues a write. Multiple calls in one frame collapse into one. */
  markDirty(): void {
    this.dirty = true;
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 400);
  }

  flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.data.lastPlayed = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      this.persistent = true;
    } catch {
      this.persistent = false;
    }
  }

  record(boxerId: string): BoxerRecord {
    let r = this.data.records[boxerId];
    if (!r) { r = emptyRecord(); this.data.records[boxerId] = r; }
    return r;
  }

  isUnlocked(boxerId: string): boolean {
    return this.data.unlockedBoxers.includes(boxerId);
  }

  unlockBoxer(boxerId: string): boolean {
    if (this.data.unlockedBoxers.includes(boxerId)) return false;
    this.data.unlockedBoxers.push(boxerId);
    this.markDirty();
    return true;
  }

  unlockArena(arenaId: string): boolean {
    if (this.data.unlockedArenas.includes(arenaId)) return false;
    this.data.unlockedArenas.push(arenaId);
    this.markDirty();
    return true;
  }

  addStats(delta: Partial<Stats>): void {
    for (const [k, v] of Object.entries(delta)) {
      if (typeof v === 'number') {
        (this.data.stats as unknown as Record<string, number>)[k] =
          ((this.data.stats as unknown as Record<string, number>)[k] ?? 0) + v;
      }
    }
    this.markDirty();
  }

  reset(): void {
    this.data = emptySave();
    this.dirty = true;
    this.flush();
  }

  /** Exports the save as a JSON string for manual backup. */
  export(): string { return JSON.stringify(this.data); }

  /** Imports a previously exported save. Returns false if it is not valid. */
  import(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as Partial<SaveData>;
      if (typeof parsed !== 'object' || parsed === null) return false;
      this.data = this.migrate(parsed);
      this.dirty = true;
      this.flush();
      return true;
    } catch {
      return false;
    }
  }
}
