/**
 * Seedable PRNG (mulberry32). Deterministic runs make AI patterns reproducible,
 * which matters: a player must be able to learn an opponent, not fight dice.
 */
export class RNG {
  private state: number;

  constructor(seed = 0x9e3779b9) {
    this.state = seed >>> 0;
  }

  reseed(seed: number): void {
    this.state = seed >>> 0;
  }

  /** [0, 1) */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }

  int(lo: number, hi: number): number {
    return Math.floor(this.range(lo, hi + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Weighted pick. `weights[i]` corresponds to `arr[i]`; non-positive weights are skipped. */
  pickWeighted<T>(arr: readonly T[], weights: readonly number[]): T | null {
    let total = 0;
    for (let i = 0; i < arr.length; i++) if (weights[i] > 0) total += weights[i];
    if (total <= 0) return null;
    let r = this.next() * total;
    for (let i = 0; i < arr.length; i++) {
      if (weights[i] <= 0) continue;
      r -= weights[i];
      if (r <= 0) return arr[i];
    }
    return arr[arr.length - 1];
  }
}

export const rng = new RNG(Date.now() & 0xffffffff);
