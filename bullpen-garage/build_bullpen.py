"""
Build "The Bullpen" garage-condo scene.

Usage
-----
Inside Blender (Scripting tab): open this file and press Run Script.
Headless:  blender --background --python build_bullpen.py -- [options]
With the bpy wheel:  python build_bullpen.py [options]

Options
  --out PATH         .blend to save (default: bullpen_garage.blend next to this file)
  --render CAMS      comma-separated camera names to render (or "all")
  --res WxH          render resolution (default from config)
  --samples N        Cycles samples
  --renders DIR      output folder for renders (default: renders/)
  --only MODULES     build only these modules (debugging), e.g. architecture,mezzanine
  --no-save          skip saving the .blend
"""

import os
import sys
import time
import argparse

HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.getcwd()
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import importlib
import bpy  # noqa: E402

MODULES = ["architecture", "structure", "mezzanine", "cabinets", "workshop",
           "furniture", "vehicles", "decor", "details", "lighting", "cameras"]


def _args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "bullpen_garage.blend"))
    ap.add_argument("--render", default="")
    ap.add_argument("--res", default="")
    ap.add_argument("--samples", type=int, default=0)
    ap.add_argument("--renders", default=os.path.join(HERE, "renders"))
    ap.add_argument("--only", default="")
    ap.add_argument("--no-save", action="store_true")
    ap.add_argument("--fmt", default="JPEG")
    try:
        return ap.parse_args(argv)
    except SystemExit:
        return ap.parse_args([])


def main():
    args = _args()
    import bullpen
    from bullpen import core, materials
    for name in ["config", "core", "materials", "textures"] + MODULES + ["render"]:
        full = f"bullpen.{name}"
        if full in sys.modules:
            importlib.reload(sys.modules[full])
    from bullpen import core, materials, render  # re-bind after reload

    t0 = time.time()
    core.reset_scene()
    L = materials.Lib()
    only = [m.strip() for m in args.only.split(",") if m.strip()]
    for name in MODULES:
        if only and name not in only:
            continue
        mod = importlib.import_module(f"bullpen.{name}")
        t = time.time()
        mod.build(L)
        print(f"[bullpen] {name:<13} {time.time() - t:6.1f}s  objects={len(bpy.data.objects)}")
    render.setup(args)
    render.finalize()
    print(f"[bullpen] build done in {time.time() - t0:.1f}s, "
          f"{len(bpy.data.objects)} objects, {len(bpy.data.materials)} materials")
    if not args.no_save:
        bpy.ops.wm.save_as_mainfile(filepath=args.out, compress=True)
        print(f"[bullpen] saved {args.out}")
    if args.render:
        render.render_cameras(args)


if __name__ == "__main__":
    main()
