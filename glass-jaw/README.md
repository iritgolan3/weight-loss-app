# GLASS JAW — Championship Boxing

A modern, high-resolution arcade boxing game. One opponent at a time, a ring, and
a pattern you have to learn.

You do not win by out-mashing anybody. You win by watching a fighter until you
know what their shoulder does half a second before their right hand arrives —
and then being somewhere else when it does.

```bash
npm install
npm run dev        # play at http://localhost:5173
```

---

## Controls

| Key | Action |
|---|---|
| `A` / `D` | Left punch / right punch |
| `W` | Punch to the head (or hold as an aim modifier) |
| `S` | Punch to the body (or hold as an aim modifier) |
| `Q` / `E` | Dodge left / dodge right |
| `Q` + `E` | Duck under a high shot |
| `SPACE` | Block — tap it just before a punch lands to **parry** |
| `SPACE` + `S` | Block low, against body shots |
| `SHIFT` | Spend **all** your stars on the biggest special |
| `SHIFT` + `S` | Spend exactly one star |
| `ESC` | Pause |

Gamepads work out of the box, and every binding is remappable in Settings.

**The one thing worth knowing:** a dodge is only a *perfect* dodge if you leave
it late. Slipping early gets you out of the way; slipping at the last moment
leaves the opponent wide open and pays you a star.

---

## How a fight actually works

Each boxer has a fixed set of **routines** — learnable sequences — and every
attack is announced by a **telegraph**: a distinct wind-up pose, a colour, and a
sound. Bruno lifts both arms over his head. Sven stamps his back foot. Duke
roars. None of it is random, and none of it is hidden.

Six things you can do about an incoming punch:

- **Block** it (guard the right height, or it still hurts)
- **Parry** it — press block in the last few frames and they stagger
- **Dodge** it — late, for the perfect version
- **Counter** them mid-attack, for bonus damage
- **Hit their weak point**, if you have found it
- **Eat it**, and lose a star

### Stars

Stars are earned only by reading the opponent — a perfect dodge, a parry, a
perfect counter, a weak-point hit. Getting hit cleanly costs you one. They are a
running score of how cleanly you are fighting, and you spend them on specials
worth far more than any ordinary punch.

### Weak points

Every boxer has one specific tell during which one specific punch does enormous
damage and staggers them. Finding it is the moment a fight turns from survival
into a plan. The game does not tell you what it is — but once you land it, it is
recorded on their profile forever.

The final champion moves his weak point every phase, so learning him means
learning him five times.

### Armour, and why mashing does not work

While a fighter is committed to an attack — wind-up, startup or active frames —
they are **armoured**. Your punch lands and hurts, but their punch still comes
out. Only a weak-point hit, a special, a stun or a knockdown stops it.

So punching into a wind-up is a trade you chose to make. Usually a bad one.

---

## Modes

**Career** — Four leagues, sixteen opponents, one belt. Purse money between
fights buys permanent attribute upgrades in the gym. Losing costs ranking points
but never progress; the ladder waits.

**Arcade** — Any opponent you have unlocked, any difficulty, for a score.

**Training** — Seven drills (free practice, dodging, blocking, countering,
reaction, combos, boss practice) against any unlocked fighter. You cannot be
knocked out in here. This is where you actually learn somebody.

**Boxer profiles** — Tale of the tape for all sixteen, plus the weak point of
everyone you have found one on.

### Difficulty

Five tiers, and **none of them give the opponent more health**. What changes is
reaction speed, how long the tells last, how many feints they throw, how often
they counter, how relentless they are — and how wide *your* parry and dodge
windows are. There is a test that enforces this
(`tests/balance.test.ts`).

---

## The roster

| | Boxer | Archetype |
|---|---|---|
| **Rookie** | Paco "Panqueque" Delgado | The Rookie Brawler |
| | Mimi "La Mime" Moreau | The Showman |
| | Bruno "Il Muro" Bellini | The Giant |
| | Kip "Twelve Volts" Turbo | The Speedster |
| **Pro** | Olga "The Anvil" Voronova | The Technician |
| | Kwame "Sunrise" Adeyemi | The Dancer |
| | Sven "Timber" Hammarlund | The Powerhouse |
| | Rico "Ricochet" Vega | The Counter Specialist |
| **World** | Hiroshi "Kagemusha" Tanabe | The Trickster |
| | Duke "The Sergeant" Marlow | The Pressure Fighter |
| | Zara "Mirage" Nazari | The Illusionist |
| | Bruiser McGraw | The Brawler |
| **Championship** | Augusto "Velho Leão" Silva | The Old Champion |
| | Niko Zarkov | The Surgeon |
| | Nia "Tempest" Okonjo | The Storm |
| | Maxim "The Machine" Kane | The Final Champion |

Championship fights are multi-phase: opponents gain new routines and new attacks
as they lose health, not just bigger numbers.

---

## No assets

There are no image files and no audio files in this project.

Every fighter, arena, crowd, glove and particle is drawn as vectors at the
display's native resolution. Every punch, bell, voice, crowd roar and all eleven
music tracks are synthesized live with Web Audio. The whole game is code.

That is partly a constraint and partly the point: it is original by
construction, it is sharp at any resolution, and it downloads in about 90 KB.

See [CREDITS.md](CREDITS.md) and [LICENSES.md](LICENSES.md).

---

## Architecture

```
src/
  core/      Loop (fixed timestep), Time (hit-stop and slow motion), Game (scene stack)
  input/     Buffered keyboard + gamepad, remappable
  combat/    Frame data, Fighter state machine, hit resolution, referee
  ai/        Routine engine, player profiling, bounded adaptation
  anim/      Skeleton, procedural pose library, animation system
  render/    Renderer, camera, fighters, arena, VFX, particles
  audio/     Synthesis, music sequencer, mixer
  data/      The roster, arenas, difficulty, player progression
  ui/        HUD, menu framework, every screen
  career/    Ladder, purses, upgrades
  save/      Versioned, migration-tolerant persistence
  sim/       Headless fight simulator used for balance testing
```

Two decisions worth calling out:

**The simulation runs at a fixed 120 Hz, and all frame data is authored in
60 fps frames.** Combat is timing-critical, so it cannot drift with refresh rate.
Rendering interpolates on top.

**Animation is derived from combat frame data, not authored alongside it.** A
wind-up pose is a function of the wind-up timer; punch extension is a function
of the attack clock. There are no clips to fall out of sync, so a telegraph can
never lie about the hitbox behind it.

---

## Development

```bash
npm run dev        # dev server
npm run build      # typecheck + production bundle
npm run typecheck  # types only
npm test           # 52 unit, balance and AI tests
npm run playtest   # drives every screen in a real browser, fails on any error
```

### The pose lab

```
http://localhost:5173/?lab
```

Renders every animation state on a grid with joint markers, plus the whole
roster's silhouettes side by side. `←`/`→` pages, `ENTER` toggles joints,
`SPACE` switches between the front (opponent) and back (player) views.

### The balance simulator

`src/sim/Simulator.ts` plays complete fights headlessly with scripted players of
four skill levels. It is how this game was balanced, and it is why the tests can
assert things like "mashing must lose to every championship boss" and "no single
adaptive punish may take over a fight".

```bash
npx esbuild --bundle --platform=node --format=esm \
  --outfile=.test-build/balance.mjs tools/balance.ts && node .test-build/balance.mjs
```

---

## Extending it

**A new boxer** is one object in `src/data/roster/`. Give them attacks with
telegraphs, routines built from those attacks, a weak point, an appearance and
some dialogue, then add them to a league. `validateRoster()` will tell you at
test time if you have wired anything to something that does not exist — including
the easy mistake of giving a boxer a weak point whose tell they never actually
perform.

**A new telegraph** is a new case in `applyWindup()` in `src/anim/poses.ts`. The
bar to clear: it has to be identifiable in silhouette alone, at a glance,
from across the room.
