import { GameTime } from './Time';

export interface LoopStats {
  fps: number;
  frameMs: number;
  updateMs: number;
  renderMs: number;
  steps: number;
}

/**
 * Fixed-timestep simulation with an interpolated render pass.
 *
 * Combat is frame-data driven, so the simulation MUST advance in constant
 * increments or every counter window would drift with the refresh rate.
 * Rendering still runs once per animation frame and interpolates.
 */
export class Loop {
  readonly time = new GameTime();
  readonly fixedStep: number;

  private accumulator = 0;
  private lastTs = 0;
  private rafId = 0;
  private running = false;

  private fpsAccum = 0;
  private fpsFrames = 0;
  readonly stats: LoopStats = { fps: 0, frameMs: 0, updateMs: 0, renderMs: 0, steps: 0 };

  constructor(
    private readonly update: (dt: number, time: GameTime) => void,
    private readonly render: (alpha: number, time: GameTime) => void,
    fixedHz = 120,
  ) {
    this.fixedStep = 1 / fixedHz;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTs = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private tick = (ts: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);

    const frameStart = ts;
    // Cap at 100ms: after a tab-switch we must not simulate a thousand steps.
    let rawDt = Math.min((ts - this.lastTs) / 1000, 0.1);
    this.lastTs = ts;
    if (rawDt <= 0) rawDt = this.fixedStep;

    this.time.advance(rawDt);
    this.accumulator += this.time.dt;

    const t0 = performance.now();
    let steps = 0;
    while (this.accumulator >= this.fixedStep && steps < 8) {
      this.update(this.fixedStep, this.time);
      this.accumulator -= this.fixedStep;
      steps++;
    }
    if (steps >= 8) this.accumulator = 0; // Abandon the backlog rather than spiral.
    const t1 = performance.now();

    this.render(this.accumulator / this.fixedStep, this.time);
    const t2 = performance.now();

    this.stats.updateMs = t1 - t0;
    this.stats.renderMs = t2 - t1;
    this.stats.steps = steps;
    this.stats.frameMs = t2 - frameStart;

    this.fpsAccum += rawDt;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.stats.fps = this.fpsFrames / this.fpsAccum;
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }
  };
}
