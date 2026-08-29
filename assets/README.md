# assets

Models that ship with the game, wired up by `models.json`. Whatever is listed
there becomes that slot's default for everybody who opens the game — no code
change needed, just drop the `.glb` in beside this file under the name the
manifest uses:

```json
{
  "player": "elon.glb",
  "truck": "tesla-semi.glb",
  "cyber": { "file": "cybertruck.glb", "yaw": 90, "size": 1.1 }
}
```

The slots are `player`, `person`, `m3`, `my`, `cyber` and `truck`. Use the long
form when a model needs turning or resizing to sit right in its lane: `yaw` is
degrees (vehicles must face +x, i.e. to the right) and `size` multiplies the
fitted size. A listed file that is missing is skipped quietly, and the built-in
blocky shape is used instead — so an entry can be added before its model is.

A model a player uploads through the pencil panel wins over the shipped one for
that player; removing it in the panel brings the shipped model back.

## What ships today

| slot | file | source |
|---|---|---|
| `player` | `character.glb` | the Ayalon voxel businessman — the default skin |
| `m3` | `model3.glb` | Tesla Model 3 |
| `cyber` | `cybertruck.glb` | Cybertruck |
| `truck` | `semi.glb` | Tesla Semi |
| `train` | `train.glb` | high-speed train |

All five were authored facing +z, so the manifest turns the vehicles 90° to face
along the road; the character needs no turn.

Keep these small. A model straight out of a scanner or a generator is often
tens of megabytes, which everyone has to download before the game starts. Run
it through gltf-transform first, e.g.

    npx @gltf-transform/cli optimize source.glb assets/model.glb \
      --texture-size 512 --texture-compress webp \
      --simplify-error 0.0004 --compress meshopt

That is what the models above went through: 43 MB of Draco-compressed originals
became 2.9 MB. Keep `--simplify-error` low — voxel models lose their hard edges
quickly — and prefer `--compress meshopt` over draco, since the meshopt decoder
is the one embedded in the single-file build.
