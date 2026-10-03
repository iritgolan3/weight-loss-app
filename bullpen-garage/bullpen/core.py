"""
Core scene / geometry helpers shared by every builder module.

Conventions
-----------
* Object scale is always (1, 1, 1): real dimensions are baked into the mesh
  so procedural materials (object-space coordinates) and UVs stay in metres.
* Every mesh gets a box-projected UV map in metres ("UVMap"), so image
  textures applied later (Unity / Unreal export) never stretch.
* Hard-surface objects get a Bevel modifier (harden normals) instead of baked
  bevels, so edge softness stays editable.
* Identical primitives share mesh data (linked duplicates).
"""

import math
import bpy
import bmesh
from mathutils import Vector, Matrix, Euler, Quaternion

COLLECTION_NAMES = [
    "ARCHITECTURE", "STRUCTURE", "MEZZANINE", "CABINETS", "WORKSHOP",
    "FURNITURE", "AUTOMOTIVE", "LIGHTING", "DECOR", "DETAILS",
    "CAMERAS", "REFERENCE",
]

_collections = {}
_mesh_cache = {}
_name_counts = {}


# --------------------------------------------------------------------- scene

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _collections.clear()
    _mesh_cache.clear()
    _name_counts.clear()
    scene = bpy.context.scene
    us = scene.unit_settings
    us.system = 'METRIC'
    us.scale_length = 1.0
    us.length_unit = 'METERS'
    us.mass_unit = 'KILOGRAMS'
    for name in COLLECTION_NAMES:
        collection(name)
    return scene


def collection(name, parent=None):
    """Return (creating if needed) a collection linked under parent/scene."""
    if name in _collections:
        return _collections[name]
    col = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    parent_col = parent if parent is not None else bpy.context.scene.collection
    if col.name not in parent_col.children:
        parent_col.children.link(col)
    _collections[name] = col
    return col


def sub_collection(parent_name, name):
    return collection(name, collection(parent_name))


def unique(name):
    """Descriptive unique names: Name, Name_02, Name_03 ..."""
    n = _name_counts.get(name, 0) + 1
    _name_counts[name] = n
    if n == 1 and name not in bpy.data.objects:
        return name
    while True:
        cand = f"{name}_{n:02d}"
        if cand not in bpy.data.objects:
            return cand
        n += 1
        _name_counts[name] = n


def _col(col):
    if isinstance(col, str):
        return collection(col)
    return col


# --------------------------------------------------------------------- objects

def new_object(name, data, col, loc=(0, 0, 0), rot=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(unique(name), data)
    _col(col).objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rot
    if parent is not None:
        obj.parent = parent
    return obj


def empty(name, col, loc=(0, 0, 0), rot=(0, 0, 0), parent=None, size=0.25,
          kind='PLAIN_AXES'):
    obj = new_object(name, None, col, loc, rot, parent)
    obj.empty_display_type = kind
    obj.empty_display_size = size
    return obj


def group(name, col, loc=(0, 0, 0), rot=(0, 0, 0), parent=None):
    """Parent empty used to keep modular assemblies movable as one unit."""
    return empty(name, col, loc, rot, parent, size=0.15, kind='ARROWS')


def instance(src, name, loc=(0, 0, 0), rot=(0, 0, 0), col=None, parent=None):
    """Linked duplicate (shares mesh data) including modifiers."""
    obj = bpy.data.objects.new(unique(name), src.data)
    (_col(col) if col else src.users_collection[0]).objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rot
    if parent is not None:
        obj.parent = parent
    for m in src.modifiers:
        nm = obj.modifiers.new(m.name, m.type)
        for p in m.bl_rna.properties:
            if p.is_readonly or p.identifier in {"name", "type"}:
                continue
            try:
                setattr(nm, p.identifier, getattr(m, p.identifier))
            except (AttributeError, TypeError):
                pass
    for prop in ("visible_camera", "visible_diffuse", "visible_glossy",
                 "visible_transmission", "visible_shadow"):
        setattr(obj, prop, getattr(src, prop))
    return obj


def set_material(obj_or_mesh, *mats):
    data = obj_or_mesh.data if hasattr(obj_or_mesh, "data") else obj_or_mesh
    data.materials.clear()
    for m in mats:
        data.materials.append(m)


def add_bevel(obj, width=0.003, segments=2, angle=30.0, harden=True):
    if width <= 0:
        return None
    mod = obj.modifiers.new("Bevel", 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(angle)
    mod.harden_normals = harden
    mod.use_clamp_overlap = True
    mod.miter_outer = 'MITER_ARC'
    return mod


def add_weighted_normals(obj):
    mod = obj.modifiers.new("WeightedNormal", 'WEIGHTED_NORMAL')
    mod.keep_sharp = True
    mod.weight = 50
    return mod


def add_subsurf(obj, levels=1, render_levels=2):
    mod = obj.modifiers.new("Subdivision", 'SUBSURF')
    mod.levels = levels
    mod.render_levels = render_levels
    return mod


def ray_visibility(obj, camera=True, diffuse=True, glossy=True,
                   transmission=True, shadow=True):
    obj.visible_camera = camera
    obj.visible_diffuse = diffuse
    obj.visible_glossy = glossy
    obj.visible_transmission = transmission
    obj.visible_shadow = shadow


# --------------------------------------------------------------------- mesh utils

def box_uv(mesh, scale=1.0):
    """Cube-projection UVs in object-space metres."""
    if not mesh.uv_layers:
        mesh.uv_layers.new(name="UVMap")
    uv = mesh.uv_layers.active.data
    verts = mesh.vertices
    for poly in mesh.polygons:
        n = poly.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            co = verts[mesh.loops[li].vertex_index].co
            if ax == 0:
                u, v = co.y * (1 if n.x > 0 else -1), co.z
            elif ax == 1:
                u, v = co.x * (-1 if n.y > 0 else 1), co.z
            else:
                u, v = co.x, co.y * (1 if n.z > 0 else -1)
            uv[li].uv = (u * scale, v * scale)


def finish_mesh(mesh, smooth=True, sharp_angle=None, uv=True):
    if uv:
        box_uv(mesh)
    if smooth:
        mesh.shade_smooth()
        if sharp_angle is not None:
            mesh.set_sharp_from_angle(angle=math.radians(sharp_angle))
    mesh.update()
    return mesh


def mesh_from_bm(name, bm, smooth=True, sharp_angle=None, uv=True):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return finish_mesh(mesh, smooth, sharp_angle, uv)


def mesh_from_pydata(name, verts, faces, smooth=True, sharp_angle=None, uv=True,
                     recalc=False):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    mesh.validate(clean_customdata=False)
    if recalc:
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(mesh)
        bm.free()
    return finish_mesh(mesh, smooth, sharp_angle, uv)


def bm_add_box(bm, size, center=(0, 0, 0), mat_index=0):
    sx, sy, sz = size
    cx, cy, cz = center
    res = bmesh.ops.create_cube(bm, size=1.0)
    for v in res["verts"]:
        v.co.x = v.co.x * sx + cx
        v.co.y = v.co.y * sy + cy
        v.co.z = v.co.z * sz + cz
    faces = {f for v in res["verts"] for f in v.link_faces}
    for f in faces:
        f.material_index = mat_index
    return res["verts"]


# --------------------------------------------------------------------- primitives

def _origin_offset(size, origin):
    sx, sy, sz = size
    if origin == 'bottom':
        return (0, 0, sz / 2)
    if origin == 'top':
        return (0, 0, -sz / 2)
    if origin == 'back':           # back face (+Y) at origin
        return (0, -sy / 2, 0)
    if origin == 'bottom_back':
        return (0, -sy / 2, sz / 2)
    if origin == 'min':            # min corner at origin
        return (sx / 2, sy / 2, sz / 2)
    return (0, 0, 0)


def box(name, size, loc, mat, col, rot=(0, 0, 0), bevel=0.003, segments=2,
        origin='center', parent=None, share=True, mats_extra=()):
    """Bevelled box with real dimensions baked into the mesh."""
    size = tuple(max(1e-4, s) for s in size)
    key = ("box", tuple(round(s, 5) for s in size), origin,
           mat.name if mat else None, tuple(m.name for m in mats_extra))
    mesh = _mesh_cache.get(key) if share else None
    if mesh is None:
        bm = bmesh.new()
        bm_add_box(bm, size, _origin_offset(size, origin))
        mesh = mesh_from_bm(name, bm, smooth=bevel > 0)
        if mat:
            mesh.materials.append(mat)
        for m in mats_extra:
            mesh.materials.append(m)
        if share:
            _mesh_cache[key] = mesh
    obj = new_object(name, mesh, col, loc, rot, parent)
    if bevel > 0:
        seg = segments if min(size) > 0.004 else 1
        add_bevel(obj, min(bevel, min(size) * 0.45), seg)
    return obj


def box_between(name, p0, p1, mat, col, bevel=0.003, segments=2, parent=None,
                share=True):
    """Axis-aligned box spanning two corner points."""
    p0, p1 = Vector(p0), Vector(p1)
    size = tuple(abs(p1[i] - p0[i]) for i in range(3))
    center = (p0 + p1) / 2
    return box(name, size, center, mat, col, bevel=bevel, segments=segments,
               parent=parent, share=share)


def cylinder(name, radius, depth, loc, mat, col, rot=(0, 0, 0), verts=32,
             bevel=0.0015, origin='center', parent=None, share=True,
             radius_top=None, cap=True):
    rt = radius if radius_top is None else radius_top
    key = ("cyl", round(radius, 5), round(rt, 5), round(depth, 5), verts,
           origin, cap, mat.name if mat else None)
    mesh = _mesh_cache.get(key) if share else None
    if mesh is None:
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=verts,
                              radius1=radius, radius2=rt, depth=depth)
        if origin == 'bottom':
            bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, depth / 2))
        elif origin == 'top':
            bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, -depth / 2))
        mesh = mesh_from_bm(name, bm, smooth=True, sharp_angle=40)
        if mat:
            mesh.materials.append(mat)
        if share:
            _mesh_cache[key] = mesh
    obj = new_object(name, mesh, col, loc, rot, parent)
    if bevel > 0 and cap:
        add_bevel(obj, min(bevel, radius * 0.3, depth * 0.3), 2, angle=40)
    return obj


def uv_sphere(name, radius, loc, mat, col, segments=32, rings=16, scale=(1, 1, 1),
              parent=None, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings,
                              radius=radius)
    for v in bm.verts:
        v.co.x *= scale[0]
        v.co.y *= scale[1]
        v.co.z *= scale[2]
    mesh = mesh_from_bm(name, bm, smooth=True)
    if mat:
        mesh.materials.append(mat)
    return new_object(name, mesh, col, loc, rot, parent)


def lathe(name, profile, mat, col, loc=(0, 0, 0), rot=(0, 0, 0), segments=48,
          parent=None, sharp_angle=45, mats=None, mat_idx=None, share_key=None,
          angle=2 * math.pi):
    """Revolve a (radius, z) profile around local Z."""
    key = ("lathe", share_key) if share_key else None
    mesh = _mesh_cache.get(key) if key else None
    if mesh is None:
        full = abs(angle - 2 * math.pi) < 1e-6
        nseg = segments if full else segments + 1
        verts, faces, rings = [], [], []
        for (r, z) in profile:
            if r < 1e-6:
                rings.append([len(verts)])
                verts.append((0.0, 0.0, z))
            else:
                ring = []
                for i in range(nseg):
                    a = angle * i / segments
                    ring.append(len(verts))
                    verts.append((r * math.cos(a), r * math.sin(a), z))
                rings.append(ring)
        face_mats = []
        for k in range(len(rings) - 1):
            ra, rb = rings[k], rings[k + 1]
            mi = mat_idx[k] if mat_idx else 0
            rng = segments
            for i in range(rng):
                i2 = (i + 1) % nseg if full else i + 1
                if len(ra) == 1 and len(rb) == 1:
                    continue
                if len(ra) == 1:
                    faces.append((ra[0], rb[i], rb[i2]))
                elif len(rb) == 1:
                    faces.append((ra[i], ra[i2], rb[0]))
                else:
                    faces.append((ra[i], ra[i2], rb[i2], rb[i]))
                face_mats.append(mi)
        mesh = mesh_from_pydata(name, verts, faces, smooth=True,
                                sharp_angle=sharp_angle)
        for m in (mats or [mat]):
            if m:
                mesh.materials.append(m)
        if mat_idx:
            mesh.polygons.foreach_set("material_index", face_mats)
        if key:
            _mesh_cache[key] = mesh
    return new_object(name, mesh, col, loc, rot, parent)


def prism(name, poly2d, height, mat, col, loc=(0, 0, 0), rot=(0, 0, 0),
          bevel=0.002, parent=None, segments=2):
    """Extrude a 2D polygon (local XY) along +Z by height."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, 0.0)) for (x, y) in poly2d]
    face = bm.faces.new(vs)
    face.normal_update()
    if face.normal.z > 0:
        face.normal_flip()
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    top = [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=top, vec=(0, 0, height))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = mesh_from_bm(name, bm, smooth=bevel > 0)
    if mat:
        mesh.materials.append(mat)
    obj = new_object(name, mesh, col, loc, rot, parent)
    if bevel > 0:
        add_bevel(obj, bevel, segments)
    return obj


def rounded_rect(w, h, r, n=4, cx=0.0, cy=0.0):
    """Closed 2D rounded-rectangle outline (counter-clockwise)."""
    r = min(r, w / 2 - 1e-5, h / 2 - 1e-5)
    pts = []
    corners = [(w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90),
               (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)]
    for (x, y, a0) in corners:
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + x + r * math.cos(a), cy + y + r * math.sin(a)))
    return pts


# --------------------------------------------------------------------- sweeps

def _fillet_path(points, bend_radius, steps=8):
    pts = [Vector(p) for p in points]
    if bend_radius <= 0 or len(pts) < 3:
        return pts
    out = [pts[0]]
    for i in range(1, len(pts) - 1):
        p0, p1, p2 = pts[i - 1], pts[i], pts[i + 1]
        d0 = (p1 - p0)
        d1 = (p2 - p1)
        l0, l1 = d0.length, d1.length
        if l0 < 1e-6 or l1 < 1e-6:
            continue
        d0.normalize()
        d1.normalize()
        cosang = max(-1.0, min(1.0, d0.dot(d1)))
        theta = math.acos(cosang)
        if theta < 1e-3:
            out.append(p1)
            continue
        t = bend_radius * math.tan(theta / 2)
        t = min(t, l0 * 0.49, l1 * 0.49)
        a = p1 - d0 * t
        b = p1 + d1 * t
        for s in range(steps + 1):
            u = s / steps
            q = a * (1 - u) ** 2 + p1 * 2 * u * (1 - u) + b * u * u
            out.append(q)
    out.append(pts[-1])
    return out


def sweep_mesh(name, points, profile, cap=True, bend_radius=0.0, steps=8,
               closed=False, twist=0.0, up_hint=None):
    """Sweep a closed 2D profile [(x, y)] along a 3D polyline."""
    path = _fillet_path(points, bend_radius, steps)
    n = len(path)
    tangents = []
    for i in range(n):
        if i == 0:
            t = path[1] - path[0]
        elif i == n - 1:
            t = path[-1] - path[-2]
        else:
            t = (path[i + 1] - path[i]).normalized() + (path[i] - path[i - 1]).normalized()
        if t.length < 1e-9:
            t = path[min(i + 1, n - 1)] - path[max(i - 1, 0)]
        tangents.append(t.normalized())
    # parallel-transport frames
    t0 = tangents[0]
    up = Vector(up_hint) if up_hint else Vector((0, 0, 1))
    if abs(t0.dot(up)) > 0.95:
        up = Vector((1, 0, 0)) if abs(t0.x) < 0.9 else Vector((0, 1, 0))
    nrm = (up - t0 * up.dot(t0)).normalized()
    frames = []
    for i in range(n):
        if i > 0:
            q = tangents[i - 1].rotation_difference(tangents[i])
            nrm = q @ nrm
            nrm = (nrm - tangents[i] * nrm.dot(tangents[i])).normalized()
        bin_ = nrm.cross(tangents[i])
        frames.append((nrm.copy(), bin_))
    # profile x -> side (up x tangent), profile y -> up; force CCW so the
    # swept faces point outward
    area = sum(profile[k][0] * profile[(k + 1) % len(profile)][1] -
               profile[(k + 1) % len(profile)][0] * profile[k][1]
               for k in range(len(profile)))
    if area < 0:
        profile = list(reversed(profile))
    verts, faces = [], []
    m = len(profile)
    for i, p in enumerate(path):
        nv, bv = frames[i]
        scale = 1.0
        if 0 < i < n - 1:
            d0 = (path[i] - path[i - 1]).normalized()
            d1 = (path[i + 1] - path[i]).normalized()
            c = max(0.3, math.cos(d0.angle(d1) / 2) if (d0.length and d1.length) else 1)
            scale = 1.0 / c
        ang = twist * i / max(1, n - 1)
        ca, sa = math.cos(ang), math.sin(ang)
        for (x, y) in profile:
            xr, yr = x * ca - y * sa, x * sa + y * ca
            verts.append(p + bv * (xr * scale) + nv * yr)
    rows = n if not closed else n + 1
    for i in range(rows - 1):
        a0 = (i % n) * m
        b0 = ((i + 1) % n) * m
        for j in range(m):
            j2 = (j + 1) % m
            faces.append((a0 + j, a0 + j2, b0 + j2, b0 + j))
    if cap and not closed:
        faces.append(tuple(reversed(range(m))))
        faces.append(tuple((n - 1) * m + j for j in range(m)))
    return verts, faces


def pipe(name, points, radius, mat, col, sides=16, bend_radius=None, cap=True,
         loc=(0, 0, 0), rot=(0, 0, 0), parent=None, steps=8, closed=False):
    if bend_radius is None:
        bend_radius = radius * 3
    prof = [(radius * math.cos(2 * math.pi * k / sides),
             radius * math.sin(2 * math.pi * k / sides)) for k in range(sides)]
    v, f = sweep_mesh(name, points, prof, cap=cap, bend_radius=bend_radius,
                      steps=steps, closed=closed)
    mesh = mesh_from_pydata(name, v, f, smooth=True, sharp_angle=60)
    if mat:
        mesh.materials.append(mat)
    return new_object(name, mesh, col, loc, rot, parent)


def profile_sweep(name, points, profile, mat, col, bend_radius=0.0, cap=True,
                  loc=(0, 0, 0), rot=(0, 0, 0), parent=None, bevel=0.0,
                  sharp_angle=35, up_hint=None):
    v, f = sweep_mesh(name, points, profile, cap=cap, bend_radius=bend_radius,
                      up_hint=up_hint)
    mesh = mesh_from_pydata(name, v, f, smooth=True, sharp_angle=sharp_angle)
    if mat:
        mesh.materials.append(mat)
    obj = new_object(name, mesh, col, loc, rot, parent)
    if bevel > 0:
        add_bevel(obj, bevel, 2)
    return obj


# --------------------------------------------------------------------- text

def text(name, body, size, loc, mat, col, rot=(math.radians(90), 0, 0),
         extrude=0.0, align='CENTER', valign='CENTER', parent=None, bevel=0.0,
         font_path=None, to_mesh=True, spacing=1.0):
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body = body
    curve.size = size
    curve.extrude = extrude
    curve.bevel_depth = bevel
    curve.align_x = align
    curve.align_y = valign
    curve.space_character = spacing
    if font_path:
        try:
            curve.font = bpy.data.fonts.load(font_path, check_existing=True)
        except RuntimeError:
            pass
    obj = new_object(name, curve, col, loc, rot, parent)
    if mat:
        curve.materials.append(mat)
    if to_mesh:
        dg = bpy.context.evaluated_depsgraph_get()
        ev = obj.evaluated_get(dg)
        mesh = bpy.data.meshes.new_from_object(ev)
        obj_name = obj.name
        bpy.data.objects.remove(obj)
        bpy.data.curves.remove(curve)
        finish_mesh(mesh, smooth=False)
        if mat and not mesh.materials:
            mesh.materials.append(mat)
        obj = new_object(obj_name, mesh, col, loc, rot, parent)
    return obj


# --------------------------------------------------------------------- outliner

def adopt(group_name, col, prefixes):
    """Parent loose top-level objects of a collection (matched by name
    prefix) under one identity empty, keeping the outliner tidy. The empty
    sits at the origin, so world placement is unchanged."""
    c = _col(col)
    loose = [o for o in c.objects if o.parent is None and o.name != group_name and
             o.name.startswith(tuple(prefixes))]
    if not loose:
        return None
    g = bpy.data.objects.get(group_name)
    if g is None:
        g = group(group_name, c)
    for o in loose:
        if o is not g:
            o.parent = g
    return g


# --------------------------------------------------------------------- math

def look_at_euler(origin, target, roll=0.0):
    d = Vector(target) - Vector(origin)
    q = d.to_track_quat('-Z', 'Y')
    e = q.to_euler()
    if roll:
        e.rotate_axis('Z', roll)
    return e


def xform(loc, rot=(0, 0, 0)):
    """World matrix for a loc/rot pair (objects' matrix_world is stale until
    the depsgraph updates, so compute placements explicitly)."""
    return Matrix.Translation(Vector(loc)) @ Euler(rot).to_matrix().to_4x4()


def lerp(a, b, t):
    return a + (b - a) * t


def kelvin_rgb(k):
    """Approximate blackbody colour (Tanner Helland fit), linear-ish."""
    t = k / 100.0
    if t <= 66:
        r = 255
        g = 99.4708025861 * math.log(t) - 161.1195681661
        b = 0 if t <= 19 else 138.5177312231 * math.log(t - 10) - 305.0447927307
    else:
        r = 329.698727446 * ((t - 60) ** -0.1332047592)
        g = 288.1221695283 * ((t - 60) ** -0.0755148492)
        b = 255
    c = [max(0, min(255, x)) / 255.0 for x in (r, g, b)]
    return tuple(x ** 2.2 for x in c)
