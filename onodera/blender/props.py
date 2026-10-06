"""Re-usable props: chairs, tableware, ikebana, sushi."""
import math
import bmesh
import bpy
from mathutils import Vector, Matrix
from helpers import box, cylinder, lathe, mesh_obj, collection


def join(objs, name):
    """Join a list of objects into one (keeps the scene light and the glb small)."""
    objs = [o for o in objs if o]
    ctx = bpy.context
    for o in ctx.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    ctx.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = ctx.view_layer.objects.active
    ob.name = name
    return ob


def chair(name, loc, rot_z, M, coll='Furniture', seat_h=0.46):
    """Low-back counter chair: solid dark wood frame, upholstered seat."""
    x, y, z = loc
    parts = []
    leg = 0.035
    w, d = 0.46, 0.46
    for sx in (-1, 1):
        for sy in (-1, 1):
            h = seat_h - 0.06 if sy < 0 else seat_h + 0.30
            parts.append(box(f'{name}_leg', (leg, leg, h),
                             (sx * (w / 2 - leg / 2), sy * (d / 2 - leg / 2), h / 2), M['chair_wood'], coll, 0.4, bevel=0.004))
    # stretchers
    for sy in (-1, 1):
        parts.append(box(f'{name}_str', (w - leg, 0.02, 0.03), (0, sy * (d / 2 - leg / 2), 0.16), M['chair_wood'], coll, 0.4))
    for sx in (-1, 1):
        parts.append(box(f'{name}_str', (0.02, d - leg, 0.03), (sx * (w / 2 - leg / 2), 0, 0.12), M['chair_wood'], coll, 0.4))
    # seat frame + cushion
    parts.append(box(f'{name}_apron', (w, d, 0.05), (0, 0, seat_h - 0.085), M['chair_wood'], coll, 0.4, bevel=0.004))
    parts.append(box(f'{name}_seat', (w - 0.02, d - 0.03, 0.06), (0, -0.005, seat_h - 0.03), M['chair_fabric'], coll, 0.5, bevel=0.018, segments=3))
    # curved-ish back rail (three slats approximating a curve)
    for i, a in enumerate((-1, 0, 1)):
        bx = a * 0.14
        by = d / 2 - leg / 2 - 0.02 * abs(a)
        parts.append(box(f'{name}_back', (0.155, 0.03, 0.10), (bx, by, seat_h + 0.24), M['chair_wood'], coll, 0.4, bevel=0.006,
                         rot=(0, 0, -a * 0.22)))
    ob = join(parts, name)
    ob.location = Vector(loc) + ob.location
    # rotate around chair origin
    ob.rotation_euler = (0, 0, rot_z)
    return ob


def plate_square(name, loc, M, size=0.21, coll='Tableware', mat_key='plate_dark'):
    """Flat lacquer/ceramic sushi plate (geta-like slab)."""
    return box(name, (size, size * 0.62, 0.012), (loc[0], loc[1], loc[2] + 0.006), M[mat_key], coll, 0.3, bevel=0.003)


def setting(prefix, x, y, z, M, coll='Tableware', rot=0.0):
    """One guest place setting on the counter. Built facing +Y, then rotated."""
    objs = []
    # Bizen plate for nigiri
    objs.append(plate_square(f'{prefix}_plate', (0, 0, 0), M))
    # hashioki + chopsticks to the right of the plate
    objs.append(box(f'{prefix}_hashioki', (0.045, 0.012, 0.012), (0.19, -0.06, 0.006), M['ceramic_white'], coll, 0.2, bevel=0.004))
    for k in (-1, 1):
        objs.append(box(f'{prefix}_hashi', (0.006, 0.23, 0.006), (0.19 + k * 0.006, 0.0, 0.015), M['hinoki_raw'], coll, 0.3))
    # oshibori on a small black lacquer tray, left
    objs.append(box(f'{prefix}_oshibori_tray', (0.11, 0.05, 0.008), (-0.21, -0.05, 0.004), M['lacquer_black'], coll, 0.3, bevel=0.002))
    objs.append(box(f'{prefix}_oshibori', (0.09, 0.035, 0.022), (-0.21, -0.05, 0.019), M['towel'], coll, 0.3, bevel=0.008, segments=3))
    # tea cup (yunomi), right-back
    objs.append(lathe(f'{prefix}_yunomi', [(0.0, 0.0), (0.03, 0.0), (0.032, 0.004), (0.034, 0.09), (0.031, 0.09), (0.029, 0.008), (0.0, 0.008)],
                      (0.27, 0.05, 0), M['ceramic_glaze'], coll))
    objs.append(cylinder(f'{prefix}_tea', 0.029, 0.002, (0.27, 0.05, 0.075), M['tea'], coll, seg=24))
    ob = join(objs, f'{prefix}_setting')
    ob.location = (x, y, z)
    ob.rotation_euler = (0, 0, rot)
    return ob


def nigiri(name, loc, M, fish='tuna', coll='Tableware', rot=0.0):
    """A single nigiri: rice block + slice of fish draped on top."""
    x, y, z = 0.0, 0.0, 0.0
    rice = box(f'{name}_rice', (0.05, 0.022, 0.018), (x, y, z + 0.009), M['rice'], coll, 0.05, bevel=0.008, segments=3)
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=8, y_segments=3, size=0.5)
    bmesh.ops.scale(bm, vec=Vector((0.064, 0.03, 1)), verts=bm.verts)
    for v in bm.verts:
        u = v.co.x / 0.032
        v.co.z = 0.02 - 0.010 * (u ** 2) + 0.001
    bmesh.ops.translate(bm, vec=Vector((x, y, z)), verts=bm.verts)
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.004)
    neta = mesh_obj(f'{name}_neta', bm, M[fish], coll, 0.05, smooth=True)
    ob = join([rice, neta], name)
    ob.location = loc
    ob.rotation_euler = (0, 0, rot)
    return ob


def ikebana(name, loc, M, coll='Decor', scale=1.0):
    """Tall ceramic vase with branches (cherry/maple style) – simple stylised form."""
    x, y, z = loc
    s = scale
    parts = []
    vase = lathe(f'{name}_vase', [(0, 0), (0.09 * s, 0), (0.12 * s, 0.05 * s), (0.13 * s, 0.18 * s), (0.10 * s, 0.30 * s),
                                    (0.06 * s, 0.36 * s), (0.065 * s, 0.40 * s), (0.055 * s, 0.40 * s), (0.05 * s, 0.37 * s), (0, 0.37 * s)],
                 (x, y, z), M['ceramic_dark'], coll)
    parts.append(vase)
    import random
    rnd = random.Random(hash(name) & 0xffff)
    leaves = []
    for b in range(5):
        ang = rnd.uniform(-1.2, 1.2)
        tilt = rnd.uniform(0.25, 0.7)
        L = rnd.uniform(0.45, 0.9) * s
        p0 = Vector((x, y, z + 0.38 * s))
        d = Vector((math.sin(tilt) * math.cos(ang + b), math.sin(tilt) * math.sin(ang + b), math.cos(tilt)))
        p1 = p0 + d * L
        mid = (p0 + p1) / 2
        br = cylinder(f'{name}_br{b}', 0.006 * s, L, (0, 0, 0), M['branch'], coll, seg=6)
        br.location = mid
        br.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
        parts.append(br)
        for k in range(6):
            t = rnd.uniform(0.35, 1.0)
            c = p0 + d * L * t + Vector((rnd.uniform(-.05, .05), rnd.uniform(-.05, .05), rnd.uniform(-.03, .03))) * s
            leaf = bpy.data.meshes.new('leaf')
            bm = bmesh.new()
            bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.035 * s)
            bmesh.ops.scale(bm, vec=Vector((1.0, 0.6, 0.25)), verts=bm.verts)
            bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0),
                             matrix=Matrix.Rotation(rnd.uniform(0, 6.28), 3, 'Z') @ Matrix.Rotation(rnd.uniform(-0.6, 0.6), 3, 'X'))
            bmesh.ops.translate(bm, vec=c, verts=bm.verts)
            leaves.append(mesh_obj(f'{name}_leaf', bm, M['leaf'], coll, 0.05))
    parts += leaves
    return join(parts, name)
