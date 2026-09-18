#!/usr/bin/env python3
"""Sanity-check every camera: is it inside geometry, or is the view blocked?

Casts the view ray plus a small fan across the frame and reports the nearest hit
and the fraction of rays that hit something within a few metres — which is what
"the camera is buried in a wall or a tree" looks like numerically.
"""
import os
import sys
import math

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
import core
bpy = core.bpy
from mathutils import Vector


def main():
    blend = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "out",
                                                               "beit_biram.blend")
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(blend))
    dg = bpy.context.evaluated_depsgraph_get()
    sc = bpy.context.scene
    cams = sorted([o for o in bpy.data.objects if o.type == "CAMERA"],
                  key=lambda c: c.name)
    print(f"{'camera':<26} {'near':>7} {'blocked':>8}  nearest object")
    print("-" * 78)
    worst = []
    for cam in cams:
        mat = cam.matrix_world
        origin = mat.translation
        fov = 2 * math.atan(cam.data.sensor_width / (2 * cam.data.lens))
        hits = 0
        total = 0
        nearest = 1e9
        nearest_name = "-"
        for iy in range(-2, 3):
            for ix in range(-3, 4):
                ax = ix / 3.0 * fov / 2
                ay = iy / 2.0 * fov / 2 * (sc.render.resolution_y /
                                           sc.render.resolution_x)
                d = mat.to_quaternion() @ Vector((math.tan(ax), math.tan(ay), -1.0))
                d.normalize()
                ok, loc, nrm, idx, obj, _ = sc.ray_cast(dg, origin, d)
                total += 1
                if ok:
                    dist = (loc - origin).length
                    if dist < 4.0:
                        hits += 1
                    if dist < nearest:
                        nearest = dist
                        nearest_name = obj.name
        frac = hits / total
        flag = "  <-- BLOCKED" if frac > 0.25 or nearest < 1.2 else ""
        print(f"{cam.name:<26} {nearest:7.2f} {frac:7.0%}  {nearest_name}{flag}")
        if flag:
            worst.append(cam.name)
    if worst:
        print("\nneeds repositioning: " + ", ".join(worst))
    else:
        print("\nall cameras have a clear view")


if __name__ == "__main__":
    main()
