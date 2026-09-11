import { Simulator } from '../src/sim/Simulator';
import { getBoxer } from '../src/data/boxers';
import { FState } from '../src/combat/Fighter';

const b = getBoxer('paco');
const sim = new Simulator(b, 'normal', 'masher', 999);

let oppAttacks = 0, oppActive = 0, oppHits = 0, oppWindups = 0;
let playerOpenFrames = 0, oppOpenFrames = 0, frames = 0;
const outcomes: Record<string, number> = {};

// Re-wire: observe by polling each frame via a patched run loop.
const anySim = sim as unknown as {
  bus: { on: (k: string, f: (p: unknown) => void) => void };
  opponent: typeof sim.opponent;
  player: typeof sim.player;
};
anySim.bus.on('hit', (r: unknown) => {
  const h = r as { attacker: { isPlayer: boolean }; outcome: string };
  outcomes[`${h.attacker.isPlayer ? 'P' : 'E'}:${h.outcome}`] =
    (outcomes[`${h.attacker.isPlayer ? 'P' : 'E'}:${h.outcome}`] ?? 0) + 1;
  if (!h.attacker.isPlayer) oppHits++;
});
anySim.bus.on('attackStart', (p: unknown) => {
  const a = p as { fighter: { isPlayer: boolean } };
  if (!a.fighter.isPlayer) oppAttacks++;
});

const origUpdate = sim.opponent.update.bind(sim.opponent);
sim.opponent.update = (dt: number) => {
  frames++;
  if (sim.opponent.state === FState.Active) oppActive++;
  if (sim.opponent.state === FState.Windup) oppWindups++;
  if (sim.opponent.isOpen) oppOpenFrames++;
  if (sim.player.isOpen) playerOpenFrames++;
  origUpdate(dt);
};

const r = sim.run();
console.log(JSON.stringify({
  result: { won: r.won, method: r.method, seconds: +r.seconds.toFixed(1), rounds: r.rounds,
            playerHP: +r.playerHealth.toFixed(2), oppHP: +r.opponentHealth.toFixed(2) },
  opponent: { attacksStarted: oppAttacks, windupFrames: oppWindups, activeFrames: oppActive,
              hitsResolved: oppHits, openFrames: oppOpenFrames },
  player: { thrown: r.punchesThrown, landed: r.punchesLanded, openFrames: playerOpenFrames },
  totalFrames: frames,
  outcomes,
}, null, 2));
