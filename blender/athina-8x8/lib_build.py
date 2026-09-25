# -*- coding: utf-8 -*-
"""
Athina-style 8x8 expedition truck / overland camper -- procedural Blender model.
Core library: dimensions, materials, mesh builder helpers.
Units: meters.  +X = forward (front of truck), +Y = vehicle left, +Z = up.
Ground plane at Z = 0.
"""
import bpy, bmesh, math, os, sys
from math import sin, cos, pi, radians
from mathutils import Vector, Matrix, Euler

# =============================================================================
#  MASTER DIMENSIONS  (derived from the two reference photographs)
# =============================================================================
D = dict(
    # --- overall envelope (photogrammetry off the two reference shots:
    #     side view scales at 82.5 px/m, ground line at y=362, bumper face at x=86) ---
    x_front      = 5.30,   # front face of the bull bar
    x_rear       = -5.30,  # rearmost point (spare wheel tread)
    w_half       = 1.25,   # half width of the habitation box

    # --- running gear: contact patches measured at X = 3.90 / 2.28 / -1.25 / -2.65 ---
    tire_r       = 0.700,
    tire_w       = 0.420,
    rim_r        = 0.300,
    wheel_y      = 1.020,
    axles        = [3.90, 2.28, -1.25, -2.65],

    # --- ladder frame ---
    frame_top    = 1.16,
    frame_bot    = 0.86,
    frame_y      = 0.44,
    frame_w      = 0.09,

    # --- cab (cab-over, MAN KAT style) ---
    cab_front_b  = 5.14,
    cab_front_t  = 5.10,
    cab_ws_top   = 4.74,
    cab_rear     = 3.35,
    cab_bot      = 1.14,
    cab_top      = 2.98,
    cab_ws_z0    = 2.22,
    cab_ws_z1    = 2.92,
    cab_half     = 1.235,

    # --- bull bar ---
    bar_front    = 5.30,
    bar_back     = 4.98,
    bar_z0       = 1.16,
    bar_z1       = 1.96,
    bar_half     = 1.290,

    # --- habitation box (roof measured at 3.66, rack rail 10 cm above it) ---
    box_front    = 2.55,
    box_rear     = -4.85,
    box_bot      = 1.32,
    box_top      = 3.66,
    nose_tip_x   = 3.25,
    nose_tip_z0  = 2.55,
    nose_tip_z1  = 3.20,
    nose_base_z  = 2.65,

    # --- roof racks ---
    rack_box_z   = 3.80,
    rack_cab_z   = 3.06,
    rack_cab_top = 3.42,

    # --- spare wheel, carried upright in a rear well ---
    spare_x      = -4.62,
    spare_z      = 1.68,
)

# =============================================================================
#  MATERIALS  --  every object uses the same slot order, see MAT_ORDER
# =============================================================================
MAT_ORDER = [
    "Body.Black",     # 0  satin black composite panel
    "Trim.Black",     # 1  matte black trim / plastics
    "Glass.Tint",     # 2  dark tinted glazing
    "Rubber",         # 3  tire rubber
    "Metal.Dark",     # 4  dark anodised / powder-coated steel
    "Amber",          # 5  indicator lens
    "Lens.Clear",     # 6  head/aux lamp lens
    "Frame.Light",    # 7  light-grey window frames
    "Steel",          # 8  bare / brushed steel
    "Decal",          # 9  graphite lettering
    "Lens.Red",       # 10 tail-lamp lens
    "Glass.Saloon",   # 11 habitation glazing (reads lighter, as in the photos)
]
M_BODY, M_TRIM, M_GLASS, M_RUBBER, M_METAL, M_AMBER, M_LENS, M_FRAME, M_STEEL, M_DECAL, M_RED, M_GLASS2 = range(12)


def _pbr(name, base, rough, metal=0.0, spec=0.5, coat=0.0, transmission=0.0, ior=1.45,
         emission=None, emission_str=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    n = m.node_tree.nodes["Principled BSDF"]
    def setv(key, val):
        if key in n.inputs:
            n.inputs[key].default_value = val
    setv("Base Color", (*base, 1.0))
    setv("Roughness", rough)
    setv("Metallic", metal)
    setv("IOR", ior)
    setv("Transmission Weight", transmission)
    setv("Coat Weight", coat)
    setv("Coat Roughness", 0.06)
    if "Specular IOR Level" in n.inputs:
        n.inputs["Specular IOR Level"].default_value = spec
    if emission is not None:
        setv("Emission Color", (*emission, 1.0))
        setv("Emission Strength", emission_str)
    return m


def build_materials():
    mats = {}
    mats["Body.Black"]  = _pbr("Body.Black",  (0.013, 0.014, 0.016), 0.30, 0.0, 0.19, coat=0.05)
    mats["Trim.Black"]  = _pbr("Trim.Black",  (0.009, 0.009, 0.010), 0.56, 0.0, 0.16)
    mats["Glass.Tint"]  = _pbr("Glass.Tint",  (0.018, 0.020, 0.024), 0.045, 0.0, 1.0,
                               ior=1.55, coat=0.35)
    mats["Rubber"]      = _pbr("Rubber",      (0.011, 0.011, 0.012), 0.80, 0.0, 0.14)
    mats["Metal.Dark"]  = _pbr("Metal.Dark",  (0.026, 0.027, 0.029), 0.38, 0.85, 0.5)
    mats["Amber"]       = _pbr("Amber",       (0.85, 0.32, 0.02),   0.18, 0.0, 0.6,
                               emission=(0.9, 0.35, 0.03), emission_str=0.35)
    mats["Lens.Clear"]  = _pbr("Lens.Clear",  (0.62, 0.65, 0.68),   0.12, 0.0, 0.8,
                               emission=(0.75, 0.80, 0.85), emission_str=0.25)
    mats["Frame.Light"] = _pbr("Frame.Light", (0.66, 0.67, 0.66),   0.40, 0.0, 0.5)
    mats["Steel"]       = _pbr("Steel",       (0.30, 0.31, 0.32),   0.32, 1.0, 0.5)
    mats["Decal"]       = _pbr("Decal",       (0.20, 0.21, 0.22),   0.52, 0.0, 0.5)
    mats["Lens.Red"]    = _pbr("Lens.Red",    (0.42, 0.020, 0.012), 0.16, 0.0, 0.7,
                               emission=(0.55, 0.03, 0.02), emission_str=0.30)
    mats["Glass.Saloon"] = _pbr("Glass.Saloon", (0.052, 0.056, 0.062), 0.075, 0.0, 1.0,
                                ior=1.52, coat=0.30)
    add_surface_variation(mats["Body.Black"], 0.25, 0.35, 2.2, 42.0, 0.035)
    add_surface_variation(mats["Trim.Black"], 0.50, 0.62, 3.0, 60.0, 0.045)
    add_surface_variation(mats["Rubber"],     0.74, 0.86, 9.0, 90.0, 0.090)
    return [mats[n] for n in MAT_ORDER]


def add_surface_variation(mat, rough_lo=0.26, rough_hi=0.36, noise_scale=2.2,
                          bump_scale=42.0, bump_strength=0.035):
    """Break up a perfectly flat shader with very subtle roughness + bump noise.

    Without it large black panels render as dead mirrors; the reference
    photographs show soft, slowly drifting highlights across each panel.
    """
    nt = mat.node_tree
    n = nt.nodes["Principled BSDF"]
    coord = nt.nodes.new("ShaderNodeTexCoord")
    coord.location = (-1100, -200)

    rough_tex = nt.nodes.new("ShaderNodeTexNoise")
    rough_tex.location = (-880, -120)
    rough_tex.inputs["Scale"].default_value = noise_scale
    rough_tex.inputs["Detail"].default_value = 3.0
    rough_tex.inputs["Roughness"].default_value = 0.5
    nt.links.new(coord.outputs["Object"], rough_tex.inputs["Vector"])

    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.location = (-660, -120)
    mr.inputs["From Min"].default_value = 0.30
    mr.inputs["From Max"].default_value = 0.70
    mr.inputs["To Min"].default_value = rough_lo
    mr.inputs["To Max"].default_value = rough_hi
    mr.clamp = True
    nt.links.new(rough_tex.outputs["Fac"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], n.inputs["Roughness"])

    bump_tex = nt.nodes.new("ShaderNodeTexNoise")
    bump_tex.location = (-880, -420)
    bump_tex.inputs["Scale"].default_value = bump_scale
    bump_tex.inputs["Detail"].default_value = 2.0
    nt.links.new(coord.outputs["Object"], bump_tex.inputs["Vector"])

    bump = nt.nodes.new("ShaderNodeBump")
    bump.location = (-660, -420)
    bump.inputs["Strength"].default_value = bump_strength
    bump.inputs["Distance"].default_value = 0.004
    nt.links.new(bump_tex.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], n.inputs["Normal"])
    return mat


MATS = None  # filled by scene_init()


# =============================================================================
#  MESH BUILDER
# =============================================================================
class MB:
    """Accumulates primitives into one bmesh; tracks per-face material slots."""

    def __init__(self):
        self.bm = bmesh.new()
        self._seen = set()

    # -- internal ------------------------------------------------------------
    def _tag(self, mat):
        for f in self.bm.faces:
            if f not in self._seen:
                f.material_index = mat
                self._seen.add(f)

    @staticmethod
    def _mat4(loc=(0, 0, 0), rot=None, scale=(1, 1, 1)):
        M = Matrix.Translation(Vector(loc))
        if rot is not None:
            if isinstance(rot, Euler):
                M = M @ rot.to_matrix().to_4x4()
            elif isinstance(rot, Matrix):
                M = M @ (rot.to_4x4() if len(rot.row) == 3 else rot)
            else:
                M = M @ Euler(rot, 'XYZ').to_matrix().to_4x4()
        M = M @ Matrix.Diagonal(Vector((*scale, 1.0)))
        return M

    # -- primitives ----------------------------------------------------------
    def cube(self, size, loc=(0, 0, 0), rot=None, mat=0):
        """size = (sx, sy, sz) full dimensions."""
        bmesh.ops.create_cube(self.bm, size=1.0, matrix=self._mat4(loc, rot, size))
        self._tag(mat)
        return self

    def box(self, x0, x1, y0, y1, z0, z1, mat=0):
        """Axis-aligned box from two corners."""
        return self.cube((abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)),
                         ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), None, mat)

    def cyl(self, r, h, loc=(0, 0, 0), axis='Z', seg=24, mat=0, r2=None, rot=None):
        rotm = {'Z': None, 'X': (0, pi / 2, 0), 'Y': (pi / 2, 0, 0)}[axis]
        if rot is not None:
            rotm = rot
        bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg,
                              radius1=r, radius2=(r if r2 is None else r2), depth=h,
                              matrix=self._mat4(loc, rotm))
        self._tag(mat)
        return self

    def tube(self, p1, p2, r, seg=12, mat=0, cap=True):
        """Cylinder spanning two points -- roof-rack / bull-bar tubing."""
        p1, p2 = Vector(p1), Vector(p2)
        d = p2 - p1
        L = d.length
        if L < 1e-6:
            return self
        M = Matrix.Translation((p1 + p2) / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        bmesh.ops.create_cone(self.bm, cap_ends=cap, cap_tris=False, segments=seg,
                              radius1=r, radius2=r, depth=L, matrix=M)
        self._tag(mat)
        return self

    def prism(self, pts_xz, y0, y1, mat=0):
        """Extrude a 2-D side profile [(x,z), ...] along Y."""
        bm = self.bm
        vs = [bm.verts.new((x, y0, z)) for (x, z) in pts_xz]
        f = bm.faces.new(vs)
        geom = bmesh.ops.extrude_face_region(bm, geom=[f])
        nv = [e for e in geom['geom'] if isinstance(e, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, verts=nv, vec=(0.0, y1 - y0, 0.0))
        self._tag(mat)
        return self

    def prism_yz(self, pts_yz, x0, x1, mat=0):
        """Extrude a 2-D front profile [(y,z), ...] along X."""
        bm = self.bm
        vs = [bm.verts.new((x0, y, z)) for (y, z) in pts_yz]
        f = bm.faces.new(vs)
        geom = bmesh.ops.extrude_face_region(bm, geom=[f])
        nv = [e for e in geom['geom'] if isinstance(e, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, verts=nv, vec=(x1 - x0, 0.0, 0.0))
        self._tag(mat)
        return self

    def revolve(self, profile, segments=48, mat=0, center=(0, 0, 0), axis='Y', closed=True):
        """profile = [(radius, offset_along_axis), ...]; closed loop -> solid of revolution."""
        bm = self.bm
        n = len(profile)
        rings = []
        for i in range(segments):
            a = 2.0 * pi * i / segments
            ring = []
            for (r, t) in profile:
                if axis == 'Y':
                    p = (center[0] + r * sin(a), center[1] + t, center[2] + r * cos(a))
                elif axis == 'Z':
                    p = (center[0] + r * cos(a), center[1] + r * sin(a), center[2] + t)
                else:  # 'X'
                    p = (center[0] + t, center[1] + r * cos(a), center[2] + r * sin(a))
                ring.append(bm.verts.new(p))
            rings.append(ring)
        top = n if closed else n - 1
        for i in range(segments):
            a, b = rings[i], rings[(i + 1) % segments]
            for j in range(top):
                k = (j + 1) % n
                try:
                    bm.faces.new((a[j], a[k], b[k], b[j]))
                except ValueError:
                    pass
        self._tag(mat)
        return self

    def plate(self, corners, mat=0):
        """Single flat quad/ngon from a list of 3-D points (glass panes, decals)."""
        bm = self.bm
        vs = [bm.verts.new(c) for c in corners]
        try:
            bm.faces.new(vs)
        except ValueError:
            pass
        self._tag(mat)
        return self

    # -- output --------------------------------------------------------------
    def finish(self, name, parent=None, recalc=True, smooth_angle=None):
        bm = self.bm
        bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
        if recalc:
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        for m in MATS:
            me.materials.append(m)
        ob = bpy.data.objects.new(name, me)
        bpy.context.collection.objects.link(ob)
        if parent:
            ob.parent = parent
        if smooth_angle is not None:
            shade_auto_smooth(ob, smooth_angle)
        return ob


def shade_auto_smooth(ob, angle_deg=32.0):
    try:
        bpy.context.view_layer.objects.active = ob
        for o in bpy.context.selected_objects:
            o.select_set(False)
        ob.select_set(True)
        bpy.ops.object.shade_auto_smooth(angle=radians(angle_deg))
        ob.select_set(False)
    except Exception:
        for p in ob.data.polygons:
            p.use_smooth = True


def _try_set(obj, **kw):
    """Set attributes that may have been renamed between Blender releases."""
    for k, v in kw.items():
        try:
            setattr(obj, k, v)
        except (AttributeError, TypeError):
            pass


def add_bevel(ob, width=0.012, segments=2, angle=38.0):
    m = ob.modifiers.new("Bevel", 'BEVEL')
    m.width = width
    m.segments = segments
    m.limit_method = 'ANGLE'
    m.angle_limit = radians(angle)
    _try_set(m, miter_outer='MITER_ARC',
             clamp_overlap=True, use_clamp_overlap=True)
    return m


def empty(name, loc=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.4
    e.location = loc
    bpy.context.collection.objects.link(e)
    if parent:
        e.parent = parent
    return e


def text_obj(name, body, loc, rot, size=0.10, extrude=0.004, mat=M_DECAL,
             align='CENTER', parent=None, bold=False):
    cu = bpy.data.curves.new(name, type='FONT')
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.align_x = align
    cu.align_y = 'CENTER'
    cu.space_character = 1.05
    ob = bpy.data.objects.new(name, cu)
    ob.location = loc
    ob.rotation_euler = Euler(rot, 'XYZ')
    bpy.context.collection.objects.link(ob)
    for m in MATS:
        ob.data.materials.append(m)
    ob.active_material_index = mat
    # font curves carry one material index per character -> set them all
    for bf in cu.body_format:
        bf.material_index = mat
    if parent:
        ob.parent = parent
    return ob


def scene_init():
    global MATS
    # wipe the factory scene
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for blk in (bpy.data.meshes, bpy.data.materials, bpy.data.curves,
                bpy.data.lights, bpy.data.cameras, bpy.data.worlds):
        for item in list(blk):
            blk.remove(item, do_unlink=True)
    MATS = build_materials()
    return MATS
