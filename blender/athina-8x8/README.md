# Athina-style 8x8 expedition camper — procedural Blender model

A parametric 3D model of a MAN KAT-based 8x8 expedition truck / overland camper,
built entirely in Python with `bpy`. Running the build script produces the model,
a white-cyclorama studio set, five cameras and the final renders.

## Running it

The model needs Blender 4.x/5.x. Either use a real Blender install:

```bash
blender -b -P build_all.py -- --samples 110 --scale 1.0
```

…or the standalone `bpy` wheel (what this was developed against — Python 3.11):

```bash
python3.11 -m venv venv && ./venv/bin/pip install bpy
./venv/bin/python build_all.py --samples 110 --scale 1.0 --glb
```

### Options

| flag | meaning |
| --- | --- |
| `--views side,front,hero,rear,low` | which cameras to render |
| `--samples N` | Cycles samples per pixel (adaptive sampling + OIDN denoise) |
| `--scale F` | resolution multiplier — use `0.4` for fast look-dev |
| `--exposure E` | stops; `+0.05` puts the backdrop at pure white |
| `--no-render` | build and save the `.blend` only |
| `--glb` | also export `athina_8x8.glb` |

Outputs land next to the script: `athina_8x8.blend`, `athina_8x8.glb`, `renders/`.

## Layout

| file | contents |
| --- | --- |
| `lib_build.py` | master dimensions, PBR materials, the `MB` mesh builder (primitives, profile extrusion, solids of revolution, tubing) |
| `parts_running.py` | wheels, axles, ladder frame, driveline, tanks, cab, bull bar, lighting, mirrors, cab roof rack |
| `parts_body.py` | habitation box, glazing, lockers, roof rack, rear end, lettering |
| `scene_setup.py` | self-lit cove backdrop, eight-light studio rig, cameras, Cycles settings |
| `build_all.py` | entry point |

## Dimensions

Every major dimension in `lib_build.py:D` was measured off the two reference
photographs rather than guessed. The side elevation scales at **82.5 px/m** with
the ground line at y=362 and the bull-bar face at x=86, which gives:

* overall length **10.60 m**, width **2.50 m**, height over the roof rack **3.80 m**
* axle centres at X = **3.90 / 2.28 / −1.25 / −2.65**
* habitation box **2.55 → −4.85**, floor **1.32**, roof **3.66**
* roof-rack rail 10 cm above the roof (measured from the daylight gap under it)
* window apertures read straight off the brightness profile of the body side

The vehicle is modelled in metres, +X forward, +Y to the vehicle's left,
ground plane at Z = 0.

## Notes on the shading

The body is near-black (albedo ~0.014), so it only reads through reflections.
The backdrop is therefore *self-lit* — a large emissive cove, exactly like a lit
backdrop in a real studio — which renders clean white and doubles as the huge
soft source that gives the black panels their gradients. `add_surface_variation`
adds a very subtle roughness and bump breakup so large flat panels don't render
as dead mirrors.

Because the body is a solid extrusion, glazing sits *proud* of the skin with a
raised surround lapping over its edges, which is how these composite panels are
bonded anyway — a pane placed "inside" the wall is simply invisible.
