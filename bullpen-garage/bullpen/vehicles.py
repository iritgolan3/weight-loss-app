"""
Placeholder vehicles that keep the real dimensions, stance, colour and
silhouette class, with no real make's design or badges.

Body: smooth loft through parametric cross-sections. Wheel arches and
panel shut-lines are boolean-cut, so the grooves are real. Greenhouse: a
separate loft with per-face material zones (glass, black frit, B-pillar,
painted roof and pillars). Wheels: tyre profile, multi-spoke rim, brake disc
and caliper, lug nuts. Lights are placed flush on the body by BVH ray cast.

Car-local frame: +Y forward, X lateral, Z up; origin on the ground at the
centre of the footprint.
"""

import math
import bmesh
import bpy
from mathutils import Vector, Matrix, Euler
from mathutils.bvhtree import BVHTree
from . import config as C
from .core import (box, cylinder, pipe, lathe, group, new_object, mesh_from_pydata,
                   uv_sphere, collection, finish_mesh, add_bevel)
from . import materials as M
from . import textures

COL = "AUTOMOTIVE"


# ---------------------------------------------------------------- math helpers

def _catmull(pts, samples=4, closed=False):
    """Catmull-Rom resample of a list of 2D/3D tuples."""
    P = [Vector(p) for p in pts]
    n = len(P)
    out = []
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0 = P[(i - 1) % n] if closed else P[max(i - 1, 0)]
        p1 = P[i]
        p2 = P[(i + 1) % n] if closed else P[i + 1]
        p3 = P[(i + 2) % n] if closed else P[min(i + 2, n - 1)]
        for s in range(samples):
            t = s / samples
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                              (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    if not closed:
        out.append(P[-1])
    return out


def _interp_keys(keys, t):
    """Smooth (Catmull-Rom) interpolation of keyframe rows [(t, v1, v2, ...)]."""
    ts = [k[0] for k in keys]
    if t <= ts[0]:
        return list(keys[0][1:])
    if t >= ts[-1]:
        return list(keys[-1][1:])
    i = max(j for j in range(len(ts) - 1) if ts[j] <= t)
    t0, t1 = ts[i], ts[i + 1]
    u = (t - t0) / (t1 - t0)
    k0 = keys[max(i - 1, 0)]
    k1, k2 = keys[i], keys[i + 1]
    k3 = keys[min(i + 2, len(keys) - 1)]
    res = []
    for c in range(1, len(k1)):
        p0, p1, p2, p3 = k0[c], k1[c], k2[c], k3[c]
        # monotone-ish: clamp tangents a bit to avoid overshoot
        m1 = 0.5 * (p2 - p0) * 0.8
        m2 = 0.5 * (p3 - p1) * 0.8
        u2, u3 = u * u, u * u * u
        h00, h10, h01, h11 = 2 * u3 - 3 * u2 + 1, u3 - 2 * u2 + u, -2 * u3 + 3 * u2, u3 - u2
        res.append(h00 * p1 + h10 * m1 + h01 * p2 + h11 * m2)
    return res


# ---------------------------------------------------------------- profiles

PROFILES = {
    # t (rear=0 -> front=1): half-width factor, z bottom, z top (shoulder), crown
    "rear_engine": dict(
        body=[(0.000, 0.80, 0.33, 0.86, 0.02), (0.020, 0.87, 0.25, 0.94, 0.03), (0.060, 0.91, 0.20, 0.965, 0.03),
              (0.180, 0.985, 0.17, 0.925, 0.05), (0.260, 1.000, 0.16, 0.90, 0.06), (0.400, 0.955, 0.155, 0.87, 0.04),
              (0.550, 0.935, 0.155, 0.86, 0.02), (0.660, 0.94, 0.155, 0.855, -0.01), (0.760, 0.96, 0.16, 0.80, -0.06),
              (0.860, 0.955, 0.17, 0.745, -0.075), (0.940, 0.91, 0.19, 0.68, -0.06), (0.985, 0.82, 0.24, 0.60, -0.03),
              (1.000, 0.72, 0.30, 0.55, -0.01)],
        cabin=[(0.150, 0.66, 0.955, 0.52, 0.962), (0.230, 0.69, 0.925, 0.55, 1.07), (0.320, 0.70, 0.900, 0.56, 1.20),
               (0.420, 0.70, 0.885, 0.57, 1.285), (0.500, 0.705, 0.876, 0.57, 1.30), (0.560, 0.715, 0.870, 0.575, 1.265),
               (0.620, 0.735, 0.864, 0.60, 1.07), (0.668, 0.75, 0.858, 0.62, 0.866)],
        ws=(0.560, 0.668), rw=(0.150, 0.425), side=(0.405, 0.640), b_pillar=0.505,
        front_overhang=0.95, lights="round", spoiler=True, exhaust="center"),
    "front_engine": dict(
        body=[(0.000, 0.80, 0.30, 0.80, 0.02), (0.020, 0.88, 0.24, 0.875, 0.03), (0.080, 0.935, 0.20, 0.895, 0.03),
              (0.200, 0.99, 0.17, 0.88, 0.05), (0.280, 1.000, 0.16, 0.86, 0.05), (0.420, 0.965, 0.155, 0.84, 0.04),
              (0.520, 0.955, 0.155, 0.83, 0.02), (0.560, 0.96, 0.155, 0.83, 0.0), (0.700, 0.975, 0.16, 0.80, -0.025),
              (0.820, 0.98, 0.165, 0.76, -0.035), (0.920, 0.955, 0.18, 0.70, -0.03), (0.975, 0.88, 0.22, 0.62, -0.02),
              (1.000, 0.78, 0.28, 0.55, 0.0)],
        cabin=[(0.180, 0.70, 0.888, 0.58, 0.896), (0.260, 0.72, 0.874, 0.585, 1.06), (0.340, 0.735, 0.864, 0.60, 1.195),
               (0.420, 0.745, 0.858, 0.61, 1.27), (0.480, 0.75, 0.852, 0.61, 1.28), (0.525, 0.76, 0.846, 0.62, 1.17),
               (0.568, 0.78, 0.836, 0.64, 0.84)],
        ws=(0.470, 0.568), rw=(0.180, 0.420), side=(0.385, 0.550), b_pillar=0.468,
        front_overhang=0.95, lights="slim", spoiler=False, exhaust="quad"),
}


def _section(hw, zb, zt, crown, ring_half=13):
    h = zt - zb
    tuck = 0.80
    ctrl = [(0.0, zb), (hw * tuck, zb), (hw * 0.965, zb + 0.07 * h), (hw, zb + 0.32 * h),
            (hw * 0.985, zb + 0.60 * h), (hw * 0.935, zb + 0.86 * h), (hw * 0.81, zt), (hw * 0.45, zt + crown * 0.65),
            (0.0, zt + crown)]
    pts = _catmull(ctrl, samples=3)
    # resample to fixed count by arc length
    import itertools
    lens = [0.0]
    for a, b in zip(pts, pts[1:]):
        lens.append(lens[-1] + (b - a).length)
    total = lens[-1]
    out = []
    j = 0
    for k in range(ring_half + 1):
        s = total * k / ring_half
        while j < len(lens) - 2 and lens[j + 1] < s:
            j += 1
        u = (s - lens[j]) / max(1e-9, lens[j + 1] - lens[j])
        out.append(pts[j].lerp(pts[j + 1], u))
    return out   # from bottom centre (x=0) round the right side to top centre (x=0)


def _ring_from_half(half):
    """Full ring (counter-clockwise looking +Y): right half bottom->top,
    then left half top->bottom (mirrored), dropping duplicate centre points."""
    right = [(p.x, p.y) for p in half]
    left = [(-p.x, p.y) for p in reversed(half[1:-1])]
    return right + left


def _loft(stations, cap=True):
    """stations: list of (y, ring[(x, z)]) with equal ring sizes."""
    verts, faces = [], []
    m = len(stations[0][1])
    for (y, ring) in stations:
        for p in ring:
            # optional third component: per-point Y offset (leaning end faces)
            verts.append((p[0], y + (p[2] if len(p) > 2 else 0.0), p[1]))
    n = len(stations)
    for i in range(n - 1):
        a, b = i * m, (i + 1) * m
        for j in range(m):
            j2 = (j + 1) % m
            faces.append((a + j, b + j, b + j2, a + j2))
    if cap:
        # rear and front caps as fans to a slightly protruding centre
        for idx, sgn in ((0, -1), (n - 1, 1)):
            y, ring = stations[idx]
            cx = sum(p[0] for p in ring) / m
            cz = sum(p[1] for p in ring) / m
            ci = len(verts)
            verts.append((cx, y + sgn * 0.012, cz))
            base = idx * m
            for j in range(m):
                j2 = (j + 1) % m
                if sgn < 0:
                    faces.append((base + j2, base + j, ci))
                else:
                    faces.append((base + j, base + j2, ci))
    return verts, faces


# ---------------------------------------------------------------- body

def _body_mesh(spec, prof, detail=True):
    Lc, W = spec["length"], spec["width"]
    hw_max = W / 2
    keys = prof["body"]
    nst = 96 if detail else 48
    ring_half = 14 if detail else 9
    stations = []
    for i in range(nst + 1):
        # cosine spacing -> denser at the ends
        u = i / nst
        t = 0.5 - 0.5 * math.cos(math.pi * u)
        hwf, zb, zt, crown = _interp_keys(keys, t)
        half = _section(hwf * hw_max, zb, zt, crown, ring_half)
        stations.append((-Lc / 2 + t * Lc, _ring_from_half(half)))
    # rounded ends: extra shrinking stations; the upper part of the nose/tail
    # leans back so the end face is not a vertical wall
    for end in (0, 1):
        y, ring = stations[0] if end == 0 else stations[-1]
        cx = sum(p[0] for p in ring) / len(ring)
        cz = sum(p[1] for p in ring) / len(ring)
        zmin = min(p[1] for p in ring)
        zmax = max(p[1] for p in ring)
        extra = []
        for k, (dy, sc) in enumerate(((0.012, 0.965), (0.026, 0.90), (0.040, 0.78), (0.050, 0.60))):
            lean = 0.55 if end else 0.35
            r2 = []
            for p in ring:
                hf = (p[1] - zmin) / max(1e-6, zmax - zmin)
                off = (dy if end else -dy) * (1.0 - lean * hf) - (dy if end else -dy)
                r2.append((cx + (p[0] - cx) * sc, cz + (p[1] - cz) * (sc + (1 - sc) * 0.45), off))
            extra.append((y + (dy if end else -dy), r2))
        if end == 0:
            stations = list(reversed(extra)) + stations
        else:
            stations = stations + extra
    return _loft(stations)


def _cabin_mesh(spec, prof, detail=True):
    Lc, W = spec["length"], spec["width"]
    hw_max = W / 2
    keys = prof["cabin"]
    t0, t1 = keys[0][0], keys[-1][0]
    nst = 56 if detail else 24
    stations = []
    for i in range(nst + 1):
        t = t0 + (t1 - t0) * i / nst
        hb, zb, ht, ztop = _interp_keys(keys, t)
        hb *= hw_max
        ht *= hw_max
        zb -= 0.03                      # sink into the body
        zt = max(ztop, zb + 0.04)
        hgt = zt - zb
        ctrl = [(hb, zb), (hb - (hb - ht) * 0.55, zb + hgt * 0.55), (ht + 0.02, zt - 0.035), (ht * 0.6, zt - 0.006),
                (0.0, zt)]
        half = _catmull(ctrl, samples=3)
        # resample to fixed count
        lens = [0.0]
        for a, b in zip(half, half[1:]):
            lens.append(lens[-1] + (b - a).length)
        k_n = 10 if detail else 6
        res = []
        j = 0
        for k in range(k_n + 1):
            s = lens[-1] * k / k_n
            while j < len(lens) - 2 and lens[j + 1] < s:
                j += 1
            u = (s - lens[j]) / max(1e-9, lens[j + 1] - lens[j])
            res.append(half[j].lerp(half[j + 1], u))
        # ring: bottom centre (x=0,zb) -> right half -> top -> left -> back
        right = [(p.x, p.y) for p in res]
        ring = [(0.0, zb)] + right + [(-p.x, p.y) for p in reversed(res[:-1])]
        stations.append((-Lc / 2 + t * Lc, ring))
    verts, faces = _loft(stations)
    # per-face loft parameters: t along the car, u from belt (0) to roof centre (1)
    k_n = 10 if detail else 6
    m = 2 * k_n + 2
    u_vert = [0.0] + [k / k_n for k in range(k_n + 1)] + [(k_n - 1 - k) / k_n for k in range(k_n)]
    params = []
    for i in range(nst):
        ta = t0 + (t1 - t0) * (i + 0.5) / nst
        for j in range(m):
            j2 = (j + 1) % m
            uu = -1.0 if (j == 0 or j2 == 0) else 0.5 * (u_vert[j] + u_vert[j2])
            params.append((ta, uu))
    params += [(t0, -1.0)] * m + [(t1, -1.0)] * m
    return verts, faces, params


def _assign_cabin_materials(mesh, spec, prof, params):
    """Material zones from loft parameters: 0 paint, 1 glass, 2 black trim/frit."""
    ws0, ws1 = prof["ws"]
    rw0, rw1 = prof["rw"]
    sd0, sd1 = prof["side"]
    bp = prof["b_pillar"]
    mats = []
    for (t, u) in params:
        m = 0
        if u < 0:
            m = 0
        elif ws0 < t < ws1 and u >= 0.50:                       # windshield
            m = 2 if (t < ws0 + 0.010 or t > ws1 - 0.010 or u < 0.58) else 1
        elif rw0 < t < rw1 and u >= 0.50:                       # backlight
            m = 2 if (t < rw0 + 0.012 or t > rw1 - 0.012 or u < 0.58) else 1
        elif sd0 < t < sd1 and u < 0.62:                        # side glass
            if u < 0.07 or u > 0.55 or t < sd0 + 0.008 or t > sd1 - 0.008 or abs(t - bp) < 0.010:
                m = 2
            else:
                m = 1
        mats.append(m)
    mesh.polygons.foreach_set("material_index", mats)


# ---------------------------------------------------------------- wheels

def wheel(name, spec, L, loc, side, col, parent, detail=True, rim_mat=None, width=0.255, caliper=None):
    d = spec["wheel_d"]
    r = d / 2
    rim_r = spec["rim_in"] * C.IN / 2
    g = group(name, col, loc=loc, rot=(0, 0, 0), parent=parent)
    rot = (0, math.radians(90) * side, 0)
    w = width
    # tyre profile (radius, axial) revolved around local Z then rotated to X
    sw = (r - rim_r)
    prof = [(rim_r - 0.005, -w / 2 + 0.01), (rim_r + 0.01, -w / 2), (rim_r + sw * 0.5, -w / 2 - 0.006),
            (r - 0.025, -w / 2 + 0.002), (r - 0.005, -w / 2 + 0.03)]
    grooves = 4 if detail else 0
    tread = [(r, -w / 2 + 0.04)]
    if grooves:
        span = w - 0.08
        for k in range(grooves):
            zc = -w / 2 + 0.04 + span * (k + 1) / (grooves + 1)
            tread += [(r, zc - 0.006), (r - 0.007, zc - 0.005), (r - 0.007, zc + 0.005), (r, zc + 0.006)]
    tread += [(r, w / 2 - 0.04)]
    prof += tread + [(r - 0.005, w / 2 - 0.03), (r - 0.025, w / 2 - 0.002), (rim_r + sw * 0.5, w / 2 + 0.006),
                     (rim_r + 0.01, w / 2), (rim_r - 0.005, w / 2 - 0.01)]
    lathe(f"{name}_Tyre", [(p[0], p[1]) for p in prof], L.tire, col, rot=rot, segments=64 if detail else 32,
          parent=g, sharp_angle=50, share_key=f"tyre_{d}_{w}_{detail}")
    # rim barrel + lip
    rm = rim_mat or L.wheel_silver
    lathe(f"{name}_Rim_Barrel", [(rim_r - 0.012, w / 2 - 0.02), (rim_r - 0.004, w / 2 - 0.01), (rim_r + 0.008, w / 2 - 0.004),
                                 (rim_r + 0.006, w / 2 + 0.002), (rim_r - 0.010, w / 2 + 0.002), (rim_r - 0.02, w / 2 - 0.02),
                                 (rim_r - 0.03, -w / 2 + 0.02), (rim_r - 0.005, -w / 2 + 0.01)], rm, col, rot=rot,
          segments=64 if detail else 32, parent=g, share_key=f"rim_barrel_{rim_r}_{w}_{rm.name}")
    # spokes (10-spoke, 5 split pairs)
    face_z = w / 2 - 0.035
    nsp = 10 if detail else 5
    for k in range(nsp):
        a = 2 * math.pi * k / nsp
        sp = box(f"{name}_Spoke", (0.028 if detail else 0.04, rim_r - 0.06, 0.022), (0, 0, 0), rm, col, bevel=0.005,
                 parent=g)
        m = Matrix.Rotation(rot[1], 4, 'Y') @ Matrix.Rotation(a, 4, 'Z') @ Matrix.Translation((0, (rim_r - 0.06) / 2 + 0.05, face_z))
        sp.matrix_basis = m
    lathe(f"{name}_Hub_Face", [(0.0, face_z + 0.02), (0.055, face_z + 0.02), (0.07, face_z + 0.005), (0.07, face_z - 0.02),
                               (0.0, face_z - 0.02)], rm, col, rot=rot, segments=40, parent=g,
          share_key=f"hub_{w}_{rm.name}")
    cylinder(f"{name}_Center_Cap", 0.03, 0.01, (side * (face_z + 0.022), 0, 0), L.black_metal, col, rot=rot, verts=32,
             parent=g)
    if detail:
        for k in range(5):
            a = 2 * math.pi * k / 5 + 0.3
            pr = 0.05
            cylinder(f"{name}_Lug_Bolt", 0.0085, 0.02, (side * (face_z + 0.02), pr * math.cos(a), pr * math.sin(a)),
                     L.chrome, col, rot=rot, verts=6, parent=g)
        # brake disc + caliper behind the spokes
        lathe(f"{name}_Brake_Disc", [(0.08, -0.016), (rim_r - 0.035, -0.016), (rim_r - 0.035, 0.016), (0.08, 0.016)],
              L.brake_disc, col, loc=(side * (-0.02), 0, 0), rot=rot, segments=48, parent=g,
              share_key=f"disc_{rim_r}")
        cal = caliper or L.brake_red
        box(f"{name}_Brake_Caliper", (0.07, 0.10, 0.16), (side * (-0.02), -0.06, rim_r - 0.085), cal, col, bevel=0.012,
            segments=3, parent=g, rot=(math.radians(-25), 0, 0))
    return g


# ---------------------------------------------------------------- assembly

def _boolean_apply(obj, cutters, material_transfer=True):
    """Apply difference booleans one at a time. A cut that collapses the
    mesh (an exact-solver failure on near-coincident geometry) is skipped,
    so a bad cutter can never delete the body."""
    for k, c in enumerate(cutters):
        before = len(obj.data.vertices)
        mod = obj.modifiers.new(f"Bool_{k}", 'BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.object = c
        mod.solver = 'EXACT'
        try:
            mod.material_mode = 'TRANSFER' if material_transfer else 'INDEX'
        except (AttributeError, TypeError):
            pass
        dg = bpy.context.evaluated_depsgraph_get()
        ev = obj.evaluated_get(dg)
        mesh = bpy.data.meshes.new_from_object(ev)
        obj.modifiers.clear()
        if len(mesh.vertices) < before * 0.8:
            print(f"[bullpen] boolean cut {k} on {obj.name} rejected ({before} -> {len(mesh.vertices)} verts)")
            bpy.data.meshes.remove(mesh)
            continue
        old = obj.data
        obj.data = mesh
        mesh.name = old.name
        bpy.data.meshes.remove(old)
    for c in cutters:
        me = c.data
        bpy.data.objects.remove(c)
        if me.users == 0:
            bpy.data.meshes.remove(me)
    return obj


def _cutter_box(size, loc, rot=(0, 0, 0), mat=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
    me = bpy.data.meshes.new("Cutter")
    bm.to_mesh(me)
    bm.free()
    if mat:
        me.materials.append(mat)
    o = bpy.data.objects.new("Cutter", me)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    o.hide_render = True
    return o


def _cutter_cyl(r, depth, loc, mat=None, verts=64):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r, radius2=r, depth=depth)
    me = bpy.data.meshes.new("Cutter")
    bm.to_mesh(me)
    bm.free()
    if mat:
        me.materials.append(mat)
    o = bpy.data.objects.new("Cutter", me)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (0, math.radians(90), 0)
    o.hide_render = True
    return o


def _raycast(bvh, origin, direction):
    hit = bvh.ray_cast(Vector(origin), Vector(direction).normalized(), 5.0)
    return hit[0], hit[1]


def build_car(spec, L, loc=None, rotz=0.0, scale=1.0, col=COL, detail=True, parent=None):
    prof = PROFILES[spec["kind"]]
    Lc, W = spec["length"], spec["width"]
    name = spec["name"]
    if loc is None:
        loc = (spec["x"], spec["y_rear"] + Lc / 2, 0.0)
    root = group(name, col, loc=loc, rot=(0, 0, rotz), parent=parent)
    root.scale = (scale, scale, scale)
    paint = M.car_paint(f"M_CarPaint_{name}", spec["color"], spec.get("metallic", 0.6))
    # ---- body
    v, f = _body_mesh(spec, prof, detail)
    me = mesh_from_pydata(f"{name}_Body", v, f, smooth=True, sharp_angle=None, recalc=True)
    me.materials.append(paint)
    me.materials.append(L.plastic_black)
    body = new_object(f"{name}_Body", me, col, (0, 0, 0), (0, 0, 0), root)
    bvh_pre = BVHTree.FromPolygons([tuple(x) for x in v], [tuple(x) for x in f])
    # axle positions
    y_f = Lc / 2 - prof["front_overhang"]
    y_r = y_f - spec["wheelbase"]
    r = spec["wheel_d"] / 2
    zc = r - 0.008
    cutters = []
    for ya in (y_f, y_r):
        for s in (-1, 1):
            cutters.append(_cutter_cyl(r + 0.045, 0.62, (s * (W / 2 + 0.06), ya, zc + 0.012), L.plastic_black))
    if detail:
        cutters += _shutline_cutters(spec, prof, bvh_pre, L)
    # temporarily put the body at origin-space for booleans (root has no transform yet in depsgraph)
    body.parent = None
    _boolean_apply(body, cutters)
    body.parent = root
    body.data.shade_smooth()
    body.data.set_sharp_from_angle(angle=math.radians(62))   # keeps arch/shut-line edges crisp only
    if detail:
        from .core import box_uv
        box_uv(body.data)
    # ---- greenhouse
    v2, f2, params = _cabin_mesh(spec, prof, detail)
    me2 = mesh_from_pydata(f"{name}_Greenhouse", v2, f2, smooth=True, sharp_angle=None, recalc=True)
    for m in (paint, L.glass_car, L.plastic_black_gloss):
        me2.materials.append(m)
    _assign_cabin_materials(me2, spec, prof, params)
    me2.set_sharp_from_angle(angle=math.radians(65))
    _sharp_material_borders(me2)
    new_object(f"{name}_Greenhouse", me2, col, (0, 0, 0), (0, 0, 0), root)
    bvh = BVHTree.FromPolygons([tuple(vv.co) for vv in body.data.vertices],
                               [tuple(p.vertices) for p in body.data.polygons])
    # ---- underbody + wheels
    box(f"{name}_Underbody_Tray", (W * 0.78, Lc * 0.86, 0.02), (0, 0, 0.165), L.plastic_black, col, bevel=0.01,
        parent=root, share=False)
    wf, wr = (0.245, 0.305) if spec["kind"] == "rear_engine" else (0.265, 0.295)
    tr_f = W / 2 - wf / 2 - 0.015
    tr_r = W / 2 - wr / 2 - 0.012
    rim_mat = L.wheel_silver if spec["kind"] == "rear_engine" else L.gunmetal
    cal = L.brake_red if spec["kind"] == "front_engine" else L.brake_yellow
    for (ya, tr, ww, tag) in ((y_f, tr_f, wf, "Front"), (y_r, tr_r, wr, "Rear")):
        for s, sd in ((-1, "L"), (1, "R")):
            wheel(f"{name}_Wheel_{tag}_{sd}", spec, L, (s * tr, ya, zc), s, col, root, detail, rim_mat, ww, cal)
    # ---- lights, glass details, trim
    _lights(spec, prof, bvh, L, root, col, detail)
    _mirrors(spec, prof, L, root, col, paint)
    if detail:
        _trim(spec, prof, bvh, L, root, col, paint)
        _interior(spec, prof, L, root, col)
    return root


def _sharp_material_borders(mesh):
    """Mark edges between different material zones sharp (crisp glass edges)."""
    bm = bmesh.new()
    bm.from_mesh(mesh)
    sharp = []
    for e in bm.edges:
        if len(e.link_faces) == 2 and e.link_faces[0].material_index != e.link_faces[1].material_index:
            e.smooth = False
    bm.to_mesh(mesh)
    bm.free()


def _shutline_cutters(spec, prof, bvh, L):
    """2 mm slabs that only bite the outer skin -> real panel gaps."""
    Lc, W = spec["length"], spec["width"]
    hw = W / 2
    cuts = []
    gap = 0.0035
    y_f = Lc / 2 - prof["front_overhang"]
    sd0, sd1 = prof["side"]
    door_f = -Lc / 2 + (sd1 + 0.015) * Lc
    door_r = -Lc / 2 + (sd0 + (0.0 if spec["kind"] == "front_engine" else 0.02)) * Lc
    def surf_x(y, z):
        loc, nrm = _raycast(bvh, (hw + 0.5, y, z), (-1, 0, 0))
        return loc.x if loc else hw
    for s in (-1, 1):
        for yy in (door_f, door_r):
            x = surf_x(yy, 0.55)
            cuts.append(_cutter_box((0.06, gap, 0.62), (s * (x + 0.012), yy, 0.52), mat=L.plastic_black))
        # door bottom edge
        x = surf_x((door_f + door_r) / 2, 0.30)
        cuts.append(_cutter_box((0.05, door_f - door_r, gap), (s * (x + 0.01), (door_f + door_r) / 2, 0.27),
                                mat=L.plastic_black))
    # front lid (hood/bonnet) and rear lid: slabs that follow the surface slope
    def top_z(x, y):
        loc, n = _raycast(bvh, (x, y, 3.0), (0, 0, -1))
        return loc.z if loc else 0.8

    def lid(y0, y1, xs):
        for s in (-1, 1):
            x = s * xs
            z0, z1 = top_z(x, y0), top_z(x, y1)
            ln = math.hypot(y1 - y0, z1 - z0)
            ang = math.atan2(z1 - z0, y1 - y0)
            cuts.append(_cutter_box((gap, ln, 0.05), (x, (y0 + y1) / 2, (z0 + z1) / 2), rot=(ang, 0, 0),
                                    mat=L.plastic_black))
        zc = top_z(0.0, y0)
        cuts.append(_cutter_box((xs * 2, gap, 0.05), (0, y0, zc), mat=L.plastic_black))
        zc = top_z(0.0, y1)
        cuts.append(_cutter_box((xs * 2, gap, 0.05), (0, y1, zc), mat=L.plastic_black))

    ws1 = prof["ws"][1]
    lid(-Lc / 2 + (ws1 + 0.015) * Lc, Lc / 2 - 0.10, hw * 0.60)
    rw0 = prof["rw"][0]
    lid(-Lc / 2 + 0.07, -Lc / 2 + (rw0 - 0.012) * Lc, hw * 0.56)
    return cuts


def _place_on_surface(obj, bvh, origin, direction, offset=0.0):
    loc, nrm = _raycast(bvh, origin, direction)
    if loc is None:
        return False
    obj.location = loc + nrm * offset
    obj.rotation_euler = nrm.to_track_quat('Z', 'Y').to_euler()
    return True


def _lights(spec, prof, bvh, L, root, col, detail):
    Lc, W = spec["length"], spec["width"]
    hw = W / 2
    # parked cars: lamps off (inner elements are unlit LED surfaces)
    drl = L.plastic_white
    tail_em = L.taillight
    if prof["lights"] == "round":
        # round headlamps on the front fender tops
        for s in (-1, 1):
            g = group(f"{spec['name']}_Headlight_{'L' if s < 0 else 'R'}", col, parent=root)
            ok = _place_on_surface(g, bvh, (s * hw * 0.62, Lc / 2 + 0.5, 0.74), (0, -1, -0.35), offset=-0.01)
            lathe(f"{spec['name']}_Headlight_Bowl", [(0.0, -0.03), (0.088, -0.03), (0.09, 0.0), (0.0, 0.0)], L.chrome, col,
                  parent=g, segments=40)
            lathe(f"{spec['name']}_Headlight_Lens", [(0.0, 0.035), (0.05, 0.03), (0.085, 0.012), (0.09, 0.0)], L.glass_lens,
                  col, parent=g, segments=40)
            lathe(f"{spec['name']}_Headlight_DRL_Ring", [(0.060, 0.002), (0.068, 0.002), (0.068, 0.006), (0.060, 0.006)],
                  drl, col, parent=g, segments=40)
            cylinder(f"{spec['name']}_Headlight_Projector", 0.028, 0.02, (0, 0, 0.0), L.chrome, col, verts=24, parent=g)
        # full-width rear light bar
        g = group(f"{spec['name']}_Taillight_Bar", col, parent=root)
        _place_on_surface(g, bvh, (0, -Lc / 2 - 0.5, 0.80), (0, 1, 0), offset=-0.004)
        box(f"{spec['name']}_Taillight_Lens", (W * 0.86, 0.06, 0.012), (0, 0, 0.0), L.taillight, col, bevel=0.004,
            parent=g)
        box(f"{spec['name']}_Taillight_Glow", (W * 0.84, 0.012, 0.004), (0, 0, -0.004), tail_em, col, bevel=0.0,
            parent=g)
    else:
        for s in (-1, 1):
            g = group(f"{spec['name']}_Headlight_{'L' if s < 0 else 'R'}", col, parent=root)
            _place_on_surface(g, bvh, (s * hw * 0.70, Lc / 2 + 0.5, 0.62), (0, -1, -0.15), offset=-0.006)
            box(f"{spec['name']}_Headlight_Lens", (0.36, 0.09, 0.03), (0, 0, 0.0), L.glass_lens, col, bevel=0.02,
                segments=3, parent=g, rot=(0, 0, s * 0.15))
            box(f"{spec['name']}_Headlight_Housing", (0.34, 0.075, 0.02), (0, 0, -0.012), L.black_metal, col, bevel=0.012,
                parent=g, rot=(0, 0, s * 0.15))
            box(f"{spec['name']}_Headlight_DRL", (0.28, 0.008, 0.004), (0, -0.025, 0.004), drl, col, bevel=0.0, parent=g,
                rot=(0, 0, s * 0.15))
            for k in range(2):
                cylinder(f"{spec['name']}_Headlight_Projector", 0.022, 0.012, (s * (-0.06 + k * 0.08), 0.008, -0.002),
                         L.chrome, col, verts=20, parent=g)
            g2 = group(f"{spec['name']}_Taillight_{'L' if s < 0 else 'R'}", col, parent=root)
            _place_on_surface(g2, bvh, (s * hw * 0.72, -Lc / 2 - 0.5, 0.74), (0, 1, 0), offset=-0.004)
            box(f"{spec['name']}_Taillight_Lens", (0.38, 0.06, 0.016), (0, 0, 0.0), L.taillight, col, bevel=0.012,
                parent=g2, rot=(0, 0, -s * 0.1))
            box(f"{spec['name']}_Taillight_Glow", (0.34, 0.012, 0.004), (0, 0, -0.006), tail_em, col, bevel=0.0,
                parent=g2)


def _mirrors(spec, prof, L, root, col, paint):
    Lc, W = spec["length"], spec["width"]
    keys = prof["cabin"]
    t = prof["side"][1] - 0.01
    hb, zb, ht, zt = _interp_keys(keys, t)
    y = -Lc / 2 + t * Lc
    for s in (-1, 1):
        x = s * (hb * W / 2 + 0.02)
        g = group(f"{spec['name']}_Mirror_{'L' if s < 0 else 'R'}", col, loc=(x, y, zb + 0.07), parent=root)
        box(f"{spec['name']}_Mirror_Stalk", (0.08, 0.05, 0.03), (s * 0.04, 0.0, -0.01), paint, col, bevel=0.012, parent=g)
        uv_sphere(f"{spec['name']}_Mirror_Housing", 0.075, (s * 0.12, -0.01, 0.025), paint, col, 24, 12,
                  scale=(1.15, 0.65, 0.65), parent=g)
        box(f"{spec['name']}_Mirror_Glass", (0.14, 0.004, 0.065), (s * 0.12, -0.055, 0.025), L.mirror, col, bevel=0.008,
            parent=g)


def _trim(spec, prof, bvh, L, root, col, paint):
    Lc, W = spec["length"], spec["width"]
    hw = W / 2
    name = spec["name"]
    # door handles (flush bars)
    sd0, sd1 = prof["side"]
    yh = -Lc / 2 + (sd0 + 0.06) * Lc
    for s in (-1, 1):
        g = group(f"{name}_Door_Handle_{'L' if s < 0 else 'R'}", col, parent=root)
        if _place_on_surface(g, bvh, (s * (hw + 0.5), yh, 0.80), (-s, 0, 0), offset=0.002):
            box(f"{name}_Door_Handle_Bar", (0.17, 0.025, 0.008), (0, 0, 0), L.black_metal if spec["kind"] == "front_engine"
                else L.chrome, col, bevel=0.004, parent=g, rot=(0, 0, math.radians(90)))
    # front intakes / grille
    g = group(f"{name}_Front_Intake_Center", col, parent=root)
    if _place_on_surface(g, bvh, (0, Lc / 2 + 0.5, 0.36), (0, -1, 0), offset=-0.01):
        box(f"{name}_Front_Intake_Mesh", (W * 0.42, 0.10, 0.03), (0, 0, 0), L.plastic_black, col, bevel=0.02, segments=3,
            parent=g, rot=(0, 0, 0))
    for s in (-1, 1):
        g = group(f"{name}_Front_Intake_Side", col, parent=root)
        if _place_on_surface(g, bvh, (s * hw * 0.70, Lc / 2 + 0.5, 0.34), (0, -1, 0), offset=-0.01):
            box(f"{name}_Front_Intake_Side_Mesh", (0.24, 0.10, 0.03), (0, 0, 0), L.plastic_black, col, bevel=0.02,
                parent=g)
    # rear diffuser + exhausts
    g = group(f"{name}_Rear_Diffuser", col, loc=(0, -Lc / 2 + 0.18, 0.21), parent=root)
    box(f"{name}_Diffuser_Panel", (W * 0.62, 0.32, 0.02), (0, 0, 0), L.plastic_black, col, bevel=0.005, parent=g,
        rot=(math.radians(-12), 0, 0))
    for k in range(5):
        box(f"{name}_Diffuser_Fin", (0.006, 0.30, 0.08), (-0.36 + k * 0.18, 0.0, 0.03), L.plastic_black, col, bevel=0.002,
            parent=g, rot=(math.radians(-12), 0, 0))
    tips = [(-0.06, 0.26), (0.06, 0.26)] if prof["exhaust"] == "center" else [(-0.55, 0.25), (-0.44, 0.25), (0.44, 0.25), (0.55, 0.25)]
    for (x, z) in tips:
        loc, n = _raycast(bvh, (x, -Lc / 2 - 0.5, z), (0, 1, 0))
        yb = loc.y if loc else -Lc / 2
        lathe(f"{name}_Exhaust_Tip", [(0.0, -0.10), (0.042, -0.10), (0.045, 0.01), (0.040, 0.012), (0.037, -0.09),
                                      (0.0, -0.09)], L.chrome, col, loc=(x, yb + 0.03, z), rot=(math.radians(90), 0, 0),
              segments=32, parent=root)
    # licence plate (rear)
    from .materials import image_print
    plate_img = "plate_car01.png" if spec["kind"] == "rear_engine" else "plate_car02.png"
    pmat = image_print(f"M_Plate_{name}", textures.image(plate_img), rough=0.35)
    g = group(f"{name}_Licence_Plate_Rear", col, parent=root)
    if _place_on_surface(g, bvh, (0, -Lc / 2 - 0.5, 0.48), (0, 1, 0), offset=0.004):
        from .props import uv_plane
        uv_plane(f"{name}_Licence_Plate", 0.305, 0.152, (0, 0, 0), pmat, col, parent=g, rot=(math.radians(-90), 0, 0))
    # wipers at the windshield base
    ws1 = prof["ws"][1]
    yw = -Lc / 2 + (ws1 - 0.012) * Lc
    keys = prof["cabin"]
    hb, zb, _, _ = _interp_keys(keys, ws1 - 0.012)
    for s in (-1, 1):
        box(f"{name}_Wiper", (0.55, 0.012, 0.01), (s * 0.18, yw, zb + 0.005), L.plastic_black, col, bevel=0.003, parent=root,
            rot=(0, 0, math.radians(8 * s)))
    if prof["spoiler"]:
        # integrated ducktail lip
        loc, n = _raycast(bvh, (0, -Lc / 2 + 0.12, 3.0), (0, 0, -1))
        if loc:
            box(f"{name}_Ducktail_Lip", (W * 0.70, 0.12, 0.018), (0, loc.y - 0.02, loc.z + 0.01), paint, col, bevel=0.008,
                segments=3, parent=root, rot=(math.radians(-8), 0, 0))


def _interior(spec, prof, L, root, col):
    Lc, W = spec["length"], spec["width"]
    name = spec["name"]
    keys = prof["cabin"]
    t_mid = (prof["side"][0] + prof["side"][1]) / 2
    hb, zb, ht, zt = _interp_keys(keys, t_mid)
    y_mid = -Lc / 2 + t_mid * Lc
    ws1 = prof["ws"][1]
    y_dash = -Lc / 2 + (ws1 - 0.045) * Lc
    g = group(f"{name}_Interior", col, parent=root)
    box(f"{name}_Interior_Tub", (W * 0.80, (prof["side"][1] - prof["side"][0]) * Lc + 0.5, 0.02), (0, y_mid, 0.30),
        L.felt, col, bevel=0.0, parent=g)
    box(f"{name}_Dashboard", (W * 0.78, 0.30, 0.16), (0, y_dash, zb - 0.06), L.leather_black, col, bevel=0.04, segments=3,
        parent=g)
    for s in (-1, 1):
        sx = s * 0.36
        box(f"{name}_Seat_Cushion", (0.48, 0.50, 0.10), (sx, y_mid - 0.05, 0.40), L.leather_brown if spec["kind"] == "front_engine"
            else L.leather_black, col, bevel=0.04, segments=4, parent=g)
        box(f"{name}_Seat_Back", (0.48, 0.12, 0.62), (sx, y_mid - 0.36, 0.72), L.leather_brown if spec["kind"] == "front_engine"
            else L.leather_black, col, bevel=0.05, segments=4, parent=g, rot=(math.radians(-14), 0, 0))
    # steering wheel (left-hand drive)
    lathe(f"{name}_Steering_Wheel", [(0.175, -0.015), (0.19, 0.0), (0.175, 0.015), (0.16, 0.0)], L.leather_black, col,
          loc=(-0.36, y_dash - 0.28, zb - 0.02), rot=(math.radians(70), 0, 0), segments=40, parent=g)
    box(f"{name}_Center_Console", (0.22, 0.70, 0.18), (0, y_mid + 0.10, 0.36), L.leather_black, col, bevel=0.03, parent=g)


def build(L):
    for spec in C.CARS:
        build_car(spec, L)
