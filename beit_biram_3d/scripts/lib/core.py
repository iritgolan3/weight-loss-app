"""Core Blender helpers for the Beit Biram campus reconstruction.

Everything is built in metres: 1 Blender unit = 1 m.
World axes: +X = east, +Y = north, +Z = up.
"""
import os
import math


# The PyPI `bpy` wheel ships its OCIO config but does not point Blender at it,
# which silently drops the scene to a raw (NONE) view transform.
_CM = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "..", "..", "colormanagement")
if "OCIO" not in os.environ:
    import bpy as _probe_bpy  # noqa: F401  (import defines resource_path)
    import bpy.utils as _u
    _cfg = os.path.join(_u.resource_path("LOCAL"), "datafiles",
                        "colormanagement", "config.ocio")
    if os.path.isfile(_cfg):
        os.environ["OCIO"] = _cfg

import bpy  # noqa: E402
import bmesh  # noqa: E402,F401

TAU = math.tau
PI = math.pi


# --------------------------------------------------------------------------
# scene / collections
# --------------------------------------------------------------------------

def reset_scene():
    """Wipe the file back to an empty scene with Cycles enabled."""
    import addon_utils
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        addon_utils.enable("cycles", default_set=True)
    except Exception:
        pass
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.length_unit = "METERS"
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.objects,
                  bpy.data.curves, bpy.data.node_groups):
        for item in list(block):
            if item.users == 0:
                block.remove(item)
    return sc


_COLL_CACHE = {}


def coll(path):
    """Fetch or create a nested collection, e.g. coll('BEIT_BIRAM/BUILDINGS/BIRAM')."""
    if path in _COLL_CACHE:
        return _COLL_CACHE[path]
    parts = path.split("/")
    parent = bpy.context.scene.collection
    acc = []
    for part in parts:
        acc.append(part)
        key = "/".join(acc)
        if key in _COLL_CACHE:
            parent = _COLL_CACHE[key]
            continue
        existing = bpy.data.collections.get(part)
        if existing is None or existing.name in [c.name for c in _COLL_CACHE.values()]:
            existing = bpy.data.collections.new(part)
        if existing.name not in [c.name for c in parent.children]:
            parent.children.link(existing)
        _COLL_CACHE[key] = existing
        parent = existing
    return parent


def clear_coll_cache():
    _COLL_CACHE.clear()


# --------------------------------------------------------------------------
# mesh construction
# --------------------------------------------------------------------------

class MeshBuilder:
    """Accumulates welded vertices and faces, optionally with per-face material slots."""

    def __init__(self, weld=1e-5):
        self.verts = []
        self.faces = []
        self.face_mats = []
        self._index = {}
        self._q = 1.0 / weld

    def v(self, x, y, z):
        key = (round(x * self._q), round(y * self._q), round(z * self._q))
        i = self._index.get(key)
        if i is None:
            i = len(self.verts)
            self.verts.append((x, y, z))
            self._index[key] = i
        return i

    def face(self, pts, mat=0):
        """pts: sequence of (x, y, z). Degenerate faces are dropped."""
        idx = [self.v(*p) for p in pts]
        dedup = []
        for i in idx:
            if not dedup or dedup[-1] != i:
                dedup.append(i)
        if len(dedup) > 2 and dedup[0] == dedup[-1]:
            dedup.pop()
        if len(dedup) < 3:
            return
        self.faces.append(tuple(dedup))
        self.face_mats.append(mat)

    def quad(self, a, b, c, d, mat=0):
        self.face((a, b, c, d), mat)

    def prism(self, poly, z0, z1, mat=0, cap_bottom=True, cap_top=True):
        """Extrude a CCW 2D polygon [(x, y), ...] between two heights."""
        n = len(poly)
        for i in range(n):
            x0, y0 = poly[i]
            x1, y1 = poly[(i + 1) % n]
            self.quad((x0, y0, z0), (x1, y1, z0), (x1, y1, z1), (x0, y0, z1), mat)
        if cap_top:
            self.face([(x, y, z1) for x, y in poly], mat)
        if cap_bottom:
            self.face([(x, y, z0) for x, y in reversed(poly)], mat)

    def box(self, x0, y0, z0, x1, y1, z1, mat=0):
        poly = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
        self.prism(poly, z0, z1, mat)

    def append(self, other, loc=(0, 0, 0), rot_z=0.0, scale=1.0, mat_map=None):
        """Merge another builder's geometry, transformed into this one's space."""
        ca, sa = math.cos(rot_z), math.sin(rot_z)
        ox, oy, oz = loc
        for f, m in zip(other.faces, other.face_mats):
            if mat_map is not None:
                m = mat_map.get(m, m) if isinstance(mat_map, dict) else mat_map(m)
            pts = []
            for i in f:
                x, y, z = other.verts[i]
                x *= scale; y *= scale; z *= scale
                pts.append((ox + x * ca - y * sa, oy + x * sa + y * ca, oz + z))
            self.face(pts, m)
        return self

    def stats(self):
        return len(self.verts), len(self.faces)

    def to_object(self, name, collection, mats=(), loc=(0, 0, 0), rot_z=0.0,
                  shade_smooth=False, auto_smooth_deg=None):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.verts, [], self.faces)
        me.validate(verbose=False)
        for m in mats:
            me.materials.append(m)
        if mats and len(mats) > 1:
            for p, mi in zip(me.polygons, self.face_mats):
                p.material_index = min(mi, len(mats) - 1)
        if shade_smooth:
            for p in me.polygons:
                p.use_smooth = True
        me.update()
        ob = bpy.data.objects.new(name, me)
        ob.location = loc
        ob.rotation_euler = (0, 0, rot_z)
        collection.objects.link(ob)
        if auto_smooth_deg is not None:
            add_smooth_by_angle(ob, auto_smooth_deg)
        return ob


def add_smooth_by_angle(ob, degrees=30.0):
    """Blender 4.1+ removed mesh auto-smooth; emulate with a weighted-normal setup."""
    for p in ob.data.polygons:
        p.use_smooth = True
    mod = ob.modifiers.new("SmoothByAngle", "EDGE_SPLIT")
    mod.split_angle = math.radians(degrees)
    mod.use_edge_sharp = True


def obj_from_mb(mb, name, collection, mats=(), **kw):
    return mb.to_object(name, collection, mats=mats, **kw)


# --------------------------------------------------------------------------
# walls with real openings
# --------------------------------------------------------------------------

def wall_panel(mb, length, height, thickness, openings=(), mat=0, reveal_mat=None,
               z0=0.0, u0=0.0, close_ends=True, close_bottom=True, close_top=True):
    """Add a wall to `mb`, in the wall's own local frame.

    The wall runs along +X from u0 to u0+length, is `thickness` deep along +Y
    (0 .. thickness) and spans z0 .. z0+height.
    `openings` is a sequence of (u, v, w, h) in wall-local coordinates, where u is
    measured from u0 and v from z0.

    Openings are punched as real geometry and lined with reveal faces, so window
    and door heads/jambs/sills read correctly in raking light.
    """
    reveal_mat = mat if reveal_mat is None else reveal_mat
    ops = [(u0 + o[0], z0 + o[1], o[2], o[3]) for o in openings]

    us = {u0, u0 + length}
    vs = {z0, z0 + height}
    for ox, oz, ow, oh in ops:
        us.add(ox); us.add(ox + ow)
        vs.add(oz); vs.add(oz + oh)
    us = sorted(us)
    vs = sorted(vs)

    def in_opening(cu, cv):
        for ox, oz, ow, oh in ops:
            if ox - 1e-6 < cu < ox + ow + 1e-6 and oz - 1e-6 < cv < oz + oh + 1e-6:
                return True
        return False

    y0, y1 = 0.0, thickness
    for i in range(len(us) - 1):
        a, b = us[i], us[i + 1]
        if b - a < 1e-6:
            continue
        for j in range(len(vs) - 1):
            c, d = vs[j], vs[j + 1]
            if d - c < 1e-6:
                continue
            if in_opening((a + b) * 0.5, (c + d) * 0.5):
                continue
            # outer face (normal -Y, facing out) and inner face (normal +Y)
            mb.quad((a, y0, c), (b, y0, c), (b, y0, d), (a, y0, d), mat)
            mb.quad((a, y1, c), (a, y1, d), (b, y1, d), (b, y1, c), mat)

    # reveals around each opening
    for ox, oz, ow, oh in ops:
        x0, x1 = ox, ox + ow
        za, zb = oz, oz + oh
        mb.quad((x0, y0, za), (x0, y1, za), (x0, y1, zb), (x0, y0, zb), reveal_mat)   # jamb
        mb.quad((x1, y0, za), (x1, y0, zb), (x1, y1, zb), (x1, y1, za), reveal_mat)   # jamb
        mb.quad((x0, y0, zb), (x0, y1, zb), (x1, y1, zb), (x1, y0, zb), reveal_mat)   # head
        mb.quad((x0, y0, za), (x1, y0, za), (x1, y1, za), (x0, y1, za), reveal_mat)   # sill

    za, zb = z0, z0 + height
    xa, xb = u0, u0 + length
    if close_ends:
        mb.quad((xa, y0, za), (xa, y0, zb), (xa, y1, zb), (xa, y1, za), mat)
        mb.quad((xb, y0, za), (xb, y1, za), (xb, y1, zb), (xb, y0, zb), mat)
    if close_bottom:
        mb.quad((xa, y0, za), (xa, y1, za), (xb, y1, za), (xb, y0, za), mat)
    if close_top:
        mb.quad((xa, y0, zb), (xb, y0, zb), (xb, y1, zb), (xa, y1, zb), mat)


# --------------------------------------------------------------------------
# instancing
# --------------------------------------------------------------------------

def link_dup(template, name, loc=(0, 0, 0), rot_z=0.0, collection=None,
             scale=(1, 1, 1), rot=None):
    """Linked duplicate: a new object sharing the template's mesh datablock."""
    ob = bpy.data.objects.new(name, template.data)
    ob.location = loc
    ob.rotation_euler = rot if rot is not None else (0, 0, rot_z)
    ob.scale = scale
    (collection or template.users_collection[0]).objects.link(ob)
    return ob


def make_template(ob, hide=True):
    """Move an object into the hidden TEMPLATES collection to act as instance source."""
    tcol = coll("BEIT_BIRAM/_TEMPLATES")
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    tcol.objects.link(ob)
    if hide:
        ob.hide_render = True
        ob.hide_viewport = True
    return ob


def instance_on_points(name, template, points, collection, rot_jitter=0.0,
                       scale_range=(1.0, 1.0), seed=0):
    """Scatter linked duplicates of `template` across `points` [(x, y, z), ...]."""
    import random
    rng = random.Random(seed)
    out = []
    for i, p in enumerate(points):
        s = rng.uniform(*scale_range)
        ob = link_dup(template, f"{name}_{i:03d}", loc=p,
                      rot_z=rng.uniform(-rot_jitter, rot_jitter),
                      collection=collection, scale=(s, s, s))
        out.append(ob)
    return out


# --------------------------------------------------------------------------
# misc
# --------------------------------------------------------------------------

def join_objects(objs, name):
    """Join a list of objects into the first one (keeps material slots)."""
    if not objs:
        return None
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    objs[0].name = name
    return objs[0]


def solidify(ob, thickness, offset=-1.0):
    m = ob.modifiers.new("Solidify", "SOLIDIFY")
    m.thickness = thickness
    m.offset = offset
    return m


def bevel(ob, width=0.01, segments=1, angle=40.0):
    m = ob.modifiers.new("Bevel", "BEVEL")
    m.width = width
    m.segments = segments
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(angle)
    return m


def subdiv(ob, levels=1, simple=False):
    m = ob.modifiers.new("Subdiv", "SUBSURF")
    m.levels = levels
    m.render_levels = levels
    if simple:
        m.subdivision_type = "SIMPLE"
    return m


def lerp(a, b, t):
    return a + (b - a) * t


def rot_pt(x, y, ang):
    c, s = math.cos(ang), math.sin(ang)
    return (x * c - y * s, x * s + y * c)
