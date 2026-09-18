#!/usr/bin/env python3
"""Alternative lighting setups for the campus, saved as separate .blend files.

    python3 scripts/variants.py                 # all variants
    python3 scripts/variants.py --only golden

Daylight accuracy is the priority and lives in the main build; these are the
optional extras. Sun elevation and azimuth are the real Haifa values (32.8 N)
for the stated hour, so shadows fall where they actually would.
"""
import os
import sys
import math
import argparse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
import core
bpy = core.bpy

# name: (sun elevation, azimuth from north, sun W/m2, sun colour, sky light,
#        sky as seen by camera, exposure)
VARIANTS = {
    "morning": (34.0, 108.0, 2.30, (1.00, 0.955, 0.895), 0.30, 0.62, 0.35),
    "golden":  (12.0, 258.0, 1.90, (1.00, 0.760, 0.520), 0.22, 0.70, 0.55),
    "sunset":  (3.5, 272.0, 1.35, (1.00, 0.590, 0.330), 0.18, 0.80, 0.75),
    "evening": (-4.0, 280.0, 0.25, (0.72, 0.790, 1.000), 0.10, 0.45, 1.30),
}


def apply(name):
    elev, azim, energy, colour, sky_lit, sky_view, exposure = VARIANTS[name]
    sun = bpy.data.objects.get("SUN_Haifa")
    if sun is None:
        raise SystemExit("SUN_Haifa not found — build the scene first")
    sun.data.energy = energy
    sun.data.color = colour
    sun.rotation_euler = (math.radians(90.0 - elev), 0.0,
                          -math.radians(azim - 180.0))

    nt = bpy.context.scene.world.node_tree
    sky = next((n for n in nt.nodes if n.type == "TEX_SKY"), None)
    if sky is not None:
        try:
            sky.sun_elevation = math.radians(max(elev, -6.0))
            sky.sun_rotation = math.radians(azim - 180.0)
        except Exception:
            pass
    mix = next((n for n in nt.nodes if n.type == "MIX_SHADER"), None)
    if mix is not None:
        mix.inputs[2].links[0].from_node.inputs["Strength"].default_value = sky_view
        mix.inputs[1].links[0].from_node.inputs["Strength"].default_value = sky_lit
    bpy.context.scene.view_settings.exposure = exposure

    # after dark the campus lighting should read
    if name in ("sunset", "evening"):
        for m in bpy.data.materials:
            if m.name.startswith("MISC_Emissive"):
                for n in m.node_tree.nodes:
                    if n.type == "BSDF_PRINCIPLED":
                        n.inputs["Emission Strength"].default_value = (
                            26.0 if name == "evening" else 12.0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--blend", default=os.path.join(HERE, "..", "out",
                                                    "beit_biram.blend"))
    ap.add_argument("--outdir", default=os.path.join(HERE, "..", "out"))
    ap.add_argument("--only", default=None)
    args = ap.parse_args()

    names = [args.only] if args.only else list(VARIANTS)
    for name in names:
        bpy.ops.wm.open_mainfile(filepath=os.path.abspath(args.blend))
        apply(name)
        out = os.path.join(os.path.abspath(args.outdir),
                           f"beit_biram_{name}.blend")
        bpy.ops.wm.save_as_mainfile(filepath=out)
        print(f"  {name:<8} -> {os.path.basename(out)}")


if __name__ == "__main__":
    main()
