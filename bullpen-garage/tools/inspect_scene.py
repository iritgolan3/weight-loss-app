"""
Scene QA for bullpen_garage.blend: structural sanity checks.

  python tools/inspect_scene.py [path/to/bullpen_garage.blend]
  blender -b bullpen_garage.blend --python tools/inspect_scene.py

Reports: meshes without materials, empty meshes, non-unit scales (outside
the deliberately scaled model cars), objects below the floor, assemblies
floating above their support (floor / mezzanine / counter), counts per
collection, and the triangle budget.
"""

import sys
import bpy
from mathutils import Vector

if not bpy.data.filepath and len(sys.argv) > 1 and sys.argv[-1].endswith(".blend"):
    bpy.ops.wm.open_mainfile(filepath=sys.argv[-1])

import os
sys.path.insert(0, os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")))
from bullpen import config as C
SUPPORTS = [0.0, C.MEZZ_FFL, C.CAB_BASE_H + C.CAB_TOP_T]

dg = bpy.context.evaluated_depsgraph_get()
issues = []


def world_bbox(obj):
    pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))


tris = 0
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        me = obj.data
        if len(me.polygons) == 0:
            issues.append(("EMPTY_MESH", obj.name))
        if not any(s.material for s in obj.material_slots):
            issues.append(("NO_MATERIAL", obj.name))
        ev = obj.evaluated_get(dg)
        tris += sum(len(p.vertices) - 2 for p in ev.data.polygons)
        s = obj.scale
        if abs(s.x - 1) > 1e-6 or abs(s.y - 1) > 1e-6 or abs(s.z - 1) > 1e-6:
            issues.append(("SCALED", obj.name))

# below-floor check (interior objects only)
EXEMPT = ("Floor_", "Wall_", "Exterior_", "Mezzanine_Girder_Bearing", "Trench_Drain", "Roof_")
for obj in bpy.data.objects:
    if obj.type != 'MESH' or obj.name.startswith(EXEMPT):
        continue
    lo, hi = world_bbox(obj)
    if lo.z < -0.012 and -1.0 < lo.y and lo.y < C.Y1:
        issues.append(("BELOW_FLOOR", f"{obj.name} min z={lo.z:.3f}"))

# floating assemblies: top-level groups in furniture/workshop/automotive
for col_name in ("FURNITURE", "WORKSHOP", "AUTOMOTIVE"):
    col = bpy.data.collections.get(col_name)
    if not col:
        continue
    for root in [o for o in col.objects if o.parent is None and o.type == 'EMPTY']:
        meshes = [c for c in root.children_recursive if c.type == 'MESH']
        if not meshes:
            continue
        zmin = min(world_bbox(m)[0].z for m in meshes)
        gap = min(abs(zmin - s) for s in SUPPORTS)
        if gap > 0.03 and not root.name.startswith(("Sign_", "Bar_Wall_Clock", "Desk_Monitor", "Workshop_Bench_Vise",
                                                    "Slatwall", "Air_", "HoseReel", "Detailing_Pressure", "TV_", "Media_Console",
                                                    "Workshop_Cordless", "Workshop_Battery", "Display_", "Desk_", "Keepsake",
                                                    "Coffee_Table_", "Side_Table_Lamp", "Bar_Counter", "Bar_Shelf",
                                                    "Storage_Tote", "DetailCart", "ToolChest_Impact", "Workshop_Paper",
                                                    "Slatwall_")):
            issues.append(("FLOATING?", f"{root.name} lowest point z={zmin:.3f}"))

print("=" * 70)
print(f"objects: {len(bpy.data.objects)}  meshes: {len(bpy.data.meshes)}  materials: {len(bpy.data.materials)}"
      f"  lights: {len([o for o in bpy.data.objects if o.type == 'LIGHT'])}  triangles: {tris:,}")
for col in bpy.data.collections:
    print(f"  {col.name:<14} {len(col.all_objects):>5} objects")
print(f"issues: {len(issues)}")
for kind, what in issues[:200]:
    print(f"  [{kind}] {what}")
print("=" * 70)
