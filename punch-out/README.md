# Punch-Out!!

A from-scratch re-creation of the NES boxing classic, running in a browser at the
original 256×224 resolution. No engine, no build step, no dependencies — open
`index.html` and fight.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Dodge left / right | `←` `→` | D-pad, or swipe the screen |
| Duck (also blocks body shots) | `↓` | D-pad down, or swipe down |
| Right punch — body | `X` / `K` | **A** |
| Left punch — body | `Z` / `J` | **B** |
| Punch to the head | hold `↑` + a punch | hold **▲** + A/B |
| Star punch | `Enter` / `Space` | **START** |
| Second wind (3 per fight) | `Q` / `Shift` | **SELECT** |
| Get up off the canvas | mash any punch | mash **A** / **B** |

## How a fight works

- **Hearts** are your stamina. Every punch you throw costs one; punches that hit
  a guard cost four. Land nothing and you run out, turn pale blue, and can't
  punch at all until you recover. Successful dodges give hearts back.
- **Stars** come from countering. Every opponent telegraphs each attack, and
  hitting him in the right place during that tell earns a star (up to three),
  takes a big bite out of his stamina and staggers him. Getting hit loses them all.
- **Star punch** (START) spends one star on an uppercut worth about a quarter of
  his bar.
- **Knockdowns** empty the opponent's bar. He's counted over, gets back up with
  part of his stamina, and three knockdowns in a round ends it by TKO.
- **Three rounds of three minutes.** Survive to the bell and it goes to a decision
  on points — which you lose, unless you're in the ring with Mike Tyson, where
  going the distance wins it.

Each boxer's damage is a fraction of his own stamina bar, so what separates Glass
Joe from Tyson isn't a bigger number — it's how small and how unpredictable his
counter windows are. Every throw is stretched or squeezed a little at random, more
so for the later fights, so you have to read the tell rather than count frames.

## The card

**Minor Circuit** — Glass Joe · Von Kaiser · Piston Honda
**Major Circuit** — Don Flamenco · King Hippo · Great Tiger · Bald Bull
**World Circuit** — Piston Honda II · Soda Popinski · Bald Bull II · Don Flamenco II · Mr. Sandman · Super Macho Man
**Dream Fight** — Mike Tyson, then Mr. Dream

Signature moves are all here: the Honda Rush, the Bull Charge (counter the third
hop to the body and he goes straight down), King Hippo's open mouth and the
belly underneath it, Great Tiger's teleport and the dizzy spell after four of
them, Soda Popinski's bottle, the Dreamland Express, the Super Spin Punch, and
Tyson's first ninety seconds of one-hit uppercuts.

Progress is saved with a seven-digit password, shown after every fight.

## Layout

```
index.html        markup, touch pad, script tags
css/style.css     shell and touch controls
js/core.js        256×224 framebuffer, NES palette, 8×8 font, input
js/audio.js       2A03-style synth: two pulses, triangle, noise, sequencer
js/art.js         fighter construction, ring, crowd, HUD
js/roster.js      the twelve boxers, their stats and move scripts
js/looks.js       how each boxer looks: palettes, proportions, faces
js/fight.js       fight state machines, damage, knockdowns
js/scenes.js      title, VS cards, results, championships, ending, passwords
js/game.js        boot, fixed 60fps loop, touch and swipe handling
sw.js             offline cache so it runs as an installed PWA
```

## Running it

Open `index.html` directly, or serve the folder over HTTP (needed for the service
worker and offline play):

```
npx http-server punch-out -p 8080
```

`PO.debug.goto(n)` jumps straight to fight *n*; `PO.debug.scene(name, data)` jumps
to any screen.

## A note on the assets

Everything here is built from scratch. Each boxer is a body rig — wide sloped
shoulders over a narrow waist, elbows flared out, gloves tucked in front of the
chest — carrying a face built from hand-drawn pixel plates: a set of eyes, a
nose and a mouth chosen per boxer, under a hand-authored hair or headgear mask
and a moustache or beard anchored to the mouth. Eyes are drawn once and mirrored
so no face comes out lopsided, and the skull is sized to fit whatever features
it is given, so a long-nosed boxer gets a long face. Proportions, palettes and stances were matched by eye against
the original's in-ring sprites and title-card portraits. The music is written in
the NES march idiom rather than transcribed from the cartridge. No ROM data,
sprite rips or audio from the original game are used. The layouts, HUD and screen
text follow the original closely, because that's the point of a replica.
Punch-Out!! and its characters are trademarks of Nintendo; this is a fan
re-creation, not affiliated with or endorsed by them.
