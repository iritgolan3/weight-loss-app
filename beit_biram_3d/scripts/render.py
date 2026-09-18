#!/usr/bin/env python3
"""Render preview images from the campus .blend.

    python3 scripts/render.py --cams CAM_01_MainEntrance,CAM_05_AerialOverview \
                              --samples 64 --res 960x540
"""
import os
import sys
import argparse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
import core                                     # sets OCIO before bpy loads
bpy = core.bpy


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--blend", default=os.path.join(HERE, "..", "out",
                                                    "beit_biram.blend"))
    ap.add_argument("--out", default=os.path.join(HERE, "..", "renders"))
    ap.add_argument("--cams", default="ALL")
    ap.add_argument("--samples", type=int, default=96)
    ap.add_argument("--res", default="1280x720")
    ap.add_argument("--prefix", default="")
    args = ap.parse_args()

    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(args.blend))
    sc = bpy.context.scene
    w, h = (int(v) for v in args.res.lower().split("x"))
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.cycles.samples = args.samples
    sc.cycles.use_denoising = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    sc.render.image_settings.compression = 20

    cams = [o for o in bpy.data.objects if o.type == "CAMERA"]
    if args.cams != "ALL":
        want = {c.strip() for c in args.cams.split(",")}
        cams = [c for c in cams if c.name in want]
    cams.sort(key=lambda c: c.name)

    os.makedirs(os.path.abspath(args.out), exist_ok=True)
    for cam in cams:
        sc.camera = cam
        path = os.path.join(os.path.abspath(args.out),
                            f"{args.prefix}{cam.name}.png")
        sc.render.filepath = path
        print(f"  rendering {cam.name} -> {os.path.basename(path)}")
        bpy.ops.render.render(write_still=True)
    print(f"done: {len(cams)} image(s)")


if __name__ == "__main__":
    main()
