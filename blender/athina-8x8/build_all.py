# -*- coding: utf-8 -*-
"""
Build the Athina-style 8x8 expedition camper and (optionally) render it.

    python build_all.py [--samples N] [--scale F] [--views side,front,hero]
                        [--vt Standard|AgX|Filmic] [--exposure E] [--no-render]
"""
import sys, os, time, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy
import lib_build
from lib_build import D, empty, scene_init
import parts_running as PR
import parts_body as PB
import scene_setup as SS


def parse_args(argv):
    # works both as `python build_all.py ...` and `blender -b -P build_all.py -- ...`
    argv = argv[argv.index("--") + 1:] if "--" in argv else argv[1:]
    p = argparse.ArgumentParser()
    p.add_argument("--samples", type=int, default=110)
    p.add_argument("--scale", type=float, default=1.0)
    p.add_argument("--views", type=str, default="side,front,hero")
    p.add_argument("--vt", type=str, default="Standard")
    p.add_argument("--exposure", type=float, default=0.0)
    p.add_argument("--tag", type=str, default="")
    p.add_argument("--outdir", type=str, default=os.path.join(os.path.dirname(
        os.path.abspath(__file__)), "renders"))
    p.add_argument("--no-render", action="store_true")
    p.add_argument("--glb", action="store_true")
    return p.parse_args(argv)


def build():
    t0 = time.time()
    scene_init()
    # parts_* captured MATS at import time (None) -- refresh the binding
    for mod in (PR, PB, SS):
        mod.MATS = lib_build.MATS
    lib_build.MATS = lib_build.MATS

    root = empty("TRUCK", (0, 0, 0))

    wheels = PR.build_wheels(root)
    PR.build_chassis(root)
    PR.build_cab(root)
    PR.build_cab_details(root)
    PB.build_box(root)
    PB.build_box_rack(root)
    PB.build_rear(root, wheels[0].data)
    PB.build_decals(root)

    SS.build_studio()
    SS.build_lights()
    cams = SS.build_cameras()

    tris = 0
    for ob in bpy.data.objects:
        if ob.type == 'MESH':
            tris += len(ob.data.polygons)
    print("[build] %d objects, %d faces, %.1fs" %
          (len(bpy.data.objects), tris, time.time() - t0))
    return root, cams


def main():
    args = parse_args(sys.argv)
    root, cams = build()
    os.makedirs(args.outdir, exist_ok=True)

    base = os.path.dirname(args.outdir)
    blend = os.path.join(base, "athina_8x8.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    print("[save]", blend)

    if args.glb:
        glb = os.path.join(base, "athina_8x8.glb")
        for ob in bpy.data.objects:
            ob.select_set(ob.type in {'MESH', 'FONT'} and ob.name != "Backdrop")
        try:
            bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB',
                                      use_selection=True, export_apply=True)
            print("[save]", glb)
        except Exception as e:
            print("[glb] export failed:", e)

    if args.no_render:
        return
    SS.setup_render(samples=args.samples, view_transform=args.vt, exposure=args.exposure)
    for key in [v.strip() for v in args.views.split(",") if v.strip()]:
        t = time.time()
        p = SS.render_view(cams, key, args.outdir, scale=args.scale, tag=args.tag)
        print("[render] %-6s %6.1fs -> %s" % (key, time.time() - t, p))


if __name__ == "__main__":
    main()
