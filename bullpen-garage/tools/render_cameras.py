"""
Render cameras from an existing bullpen_garage.blend without rebuilding.

  python tools/render_cameras.py [--blend FILE] [--cams all|A,B] [--res WxH] [--samples N] [--out DIR]
  blender -b bullpen_garage.blend --python tools/render_cameras.py -- --cams Camera_Lounge
"""

import argparse
import os
import sys
import time
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument("--blend", default=os.path.join(ROOT, "bullpen_garage.blend"))
ap.add_argument("--cams", default="all")
ap.add_argument("--res", default="")
ap.add_argument("--samples", type=int, default=0)
ap.add_argument("--out", default=os.path.join(ROOT, "renders"))
args = ap.parse_args(argv)

if not bpy.data.filepath:
    bpy.ops.wm.open_mainfile(filepath=args.blend)
scene = bpy.context.scene
if args.res:
    w, h = (int(v) for v in args.res.lower().split("x"))
    scene.render.resolution_x, scene.render.resolution_y = w, h
if args.samples:
    scene.cycles.samples = args.samples
scene.render.image_settings.file_format = 'JPEG'
scene.render.image_settings.quality = 92
os.makedirs(args.out, exist_ok=True)
cams = sorted(o.name for o in bpy.data.objects if o.type == 'CAMERA')
want = cams if args.cams == "all" else [c.strip() for c in args.cams.split(",")]
for name in want:
    cam = bpy.data.objects[name]
    scene.camera = cam
    scene.view_settings.exposure = float(cam.get("exposure", 0.0))
    scene.render.filepath = os.path.join(args.out, f"{name}.jpg")
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"[bullpen] rendered {name} in {time.time() - t:.0f}s", flush=True)
