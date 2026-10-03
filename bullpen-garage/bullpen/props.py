"""
Reusable small props: picture frames, potted plants, books, bottles,
glasses, mugs, racing helmets, trophies, table/floor lamps, storage totes.
All functions take a collection name and an optional parent, so assemblies
stay movable.
"""

import math
import random
import bmesh
import bpy
from mathutils import Vector
from .core import (box, cylinder, pipe, lathe, group, uv_sphere, mesh_from_pydata,
                   new_object, rounded_rect, mesh_from_bm, instance, text, ray_visibility)
from . import textures

rng = random.Random(42)


# ---------------------------------------------------------------- frames

def picture_frame(name, w, h, image_name, loc, rotz, L, col, parent=None, frame_w=0.035,
                  depth=0.025, mat_frame=None, mat_border=0.06, glass=True, gloss=False):
    """Wall frame: moulding + white mat + print (UV mapped) + glazing.
    Local frame: back on y=0, front toward -Y, centred in X/Z."""
    g = group(name, col, loc=loc, rot=(0, 0, rotz), parent=parent)
    mf = mat_frame or L.black_metal
    # moulding as 4 mitred boxes
    for nm, sz, lc in (
        ("Top", (w, depth, frame_w), (0, -depth / 2, h / 2 - frame_w / 2)),
        ("Bottom", (w, depth, frame_w), (0, -depth / 2, -h / 2 + frame_w / 2)),
        ("Left", (frame_w, depth, h - 2 * frame_w), (-w / 2 + frame_w / 2, -depth / 2, 0)),
        ("Right", (frame_w, depth, h - 2 * frame_w), (w / 2 - frame_w / 2, -depth / 2, 0)),
    ):
        box(f"{name}_Frame_{nm}", sz, lc, mf, col, bevel=0.003, parent=g)
    iw, ih = w - 2 * frame_w, h - 2 * frame_w
    if mat_border > 0:
        box(f"{name}_Mat_Board", (iw, 0.003, ih), (0, -0.006, 0), L.paper, col, bevel=0.0, parent=g)
    pw, ph = iw - 2 * mat_border, ih - 2 * mat_border
    if image_name:
        img = textures.image(image_name)
        from .materials import image_print
        mat = image_print(f"M_Print_{image_name.split('.')[0]}", img, gloss=gloss)
        _uv_plane(f"{name}_Print", pw, ph, (0, -0.0081, 0), mat, col, g)
    if glass:
        box(f"{name}_Glazing", (iw, 0.002, ih), (0, -depth + 0.006, 0), L.glass, col, bevel=0.0, parent=g)
    return g


def _uv_plane(name, w, h, loc, mat, col, parent):
    verts = [(-w / 2, 0, -h / 2), (w / 2, 0, -h / 2), (w / 2, 0, h / 2), (-w / 2, 0, h / 2)]
    me = mesh_from_pydata(name, verts, [(0, 1, 2, 3)], smooth=False, uv=False)
    uvl = me.uv_layers.new(name="UVMap")
    for i, uv in enumerate(((0, 0), (1, 0), (1, 1), (0, 1))):
        uvl.data[i].uv = uv
    me.materials.append(mat)
    return new_object(name, me, col, loc, (0, 0, 0), parent)


def uv_plane(name, w, h, loc, mat, col, parent=None, rot=(0, 0, 0)):
    o = _uv_plane(name, w, h, loc, mat, col, parent)
    o.rotation_euler = rot
    return o


# ---------------------------------------------------------------- plants

_leaf_mesh = {}


def _leaf(size, curl=0.25):
    key = (round(size, 3), curl)
    if key in _leaf_mesh:
        return _leaf_mesh[key]
    # fiddle-leaf style: broad oval, slight fold along the midrib and droop
    nu, nv = 6, 9
    verts, faces = [], []
    for j in range(nv):
        t = j / (nv - 1)
        width = math.sin(math.pi * min(1.0, t * 1.05)) ** 0.8 * (0.55 + 0.45 * t) * size * 0.45
        for i in range(nu):
            s = (i / (nu - 1)) * 2 - 1
            x = s * width
            y = t * size
            z = abs(s) * width * curl - (t ** 2) * size * 0.25
            verts.append((x, y, z))
    for j in range(nv - 1):
        for i in range(nu - 1):
            a = j * nu + i
            faces.append((a, a + 1, a + nu + 1, a + nu))
    me = mesh_from_pydata("Plant_Leaf", verts, faces, smooth=True)
    _leaf_mesh[key] = me
    return me


def potted_plant(name, loc, L, col, parent=None, height=1.4, pot_r=0.22, pot_h=0.42, leaves=46,
                 seed=1):
    r = random.Random(seed)
    g = group(name, col, loc=loc, parent=parent)
    lathe(f"{name}_Pot", [(0.0, 0.0), (pot_r * 0.82, 0.0), (pot_r, pot_h * 0.15), (pot_r, pot_h),
                          (pot_r - 0.012, pot_h), (pot_r - 0.012, pot_h * 0.2), (0.0, pot_h * 0.2)],
          L.ceramic_black, col, segments=48, parent=g)
    cylinder(f"{name}_Soil", pot_r - 0.014, 0.01, (0, 0, pot_h - 0.03), L.soil, col, verts=32, parent=g)
    # trunk + branches
    trunk_top = pot_h + height * 0.55
    pipe(f"{name}_Trunk", [(0, 0, pot_h - 0.03), (0.02, 0.01, pot_h + height * 0.3),
                           (-0.01, 0.02, trunk_top)], 0.014, L.walnut, col, sides=8, bend_radius=0.2,
         parent=g)
    me = _leaf(0.26)
    for k in range(leaves):
        t = k / leaves
        z = pot_h + height * (0.35 + 0.65 * t) + r.uniform(-0.05, 0.05)
        a = k * 2.399 + r.uniform(-0.3, 0.3)
        rad = 0.05 + 0.18 * math.sin(math.pi * t) + r.uniform(0, 0.05)
        lx, ly = rad * math.cos(a), rad * math.sin(a)
        o = new_object(f"{name}_Leaf", me, col, (lx, ly, z),
                       (r.uniform(-0.5, 0.2), r.uniform(-0.3, 0.3), a - math.pi / 2), g)
        if not me.materials:
            me.materials.append(L.leaf)
        if k % 3 == 0:
            pipe(f"{name}_Stem", [(lx * 0.3, ly * 0.3, z - 0.10), (lx, ly, z)], 0.004, L.leaf, col,
                 sides=5, parent=g)
    return g


# ---------------------------------------------------------------- tabletop

def bottle(name, loc, L, col, kind="wine", mat=None, parent=None, label=True):
    g = group(name, col, loc=loc, parent=parent)
    if kind == "wine":
        prof = [(0.0, 0.0), (0.036, 0.0), (0.037, 0.005), (0.037, 0.20), (0.030, 0.235), (0.014, 0.26),
                (0.013, 0.31), (0.0, 0.31)]
        cap = (0.014, 0.05, 0.29)
    elif kind == "spirit":
        prof = [(0.0, 0.0), (0.042, 0.0), (0.044, 0.006), (0.044, 0.17), (0.036, 0.20), (0.016, 0.215),
                (0.015, 0.26), (0.0, 0.26)]
        cap = (0.018, 0.03, 0.255)
    else:  # beer
        prof = [(0.0, 0.0), (0.030, 0.0), (0.031, 0.004), (0.031, 0.13), (0.022, 0.17), (0.013, 0.20),
                (0.013, 0.225), (0.0, 0.225)]
        cap = (0.0145, 0.012, 0.226)
    lathe(f"{name}_Glass", prof, mat or L.glass_bottle_green, col, segments=24, parent=g,
          share_key=f"bottle_{kind}_{(mat or L.glass_bottle_green).name}")
    cylinder(f"{name}_Cap", cap[0], cap[1], (0, 0, cap[2]), L.black_metal if kind != "beer" else L.alu_brushed,
             col, verts=16, parent=g)
    if label:
        lathe(f"{name}_Label", [(prof[2][0] + 0.0008, 0.05), (prof[2][0] + 0.0008, 0.12)], L.label_white, col,
              segments=24, parent=g, share_key=f"label_{kind}")
    return g


def tumbler(name, loc, L, col, parent=None):
    return lathe(name, [(0.0, 0.0), (0.035, 0.0), (0.04, 0.09), (0.037, 0.09), (0.032, 0.012), (0.0, 0.012)],
                 L.glass, col, loc=loc, segments=32, parent=parent, share_key="tumbler")


def mug(name, loc, L, col, parent=None, rotz=0.0, mat=None):
    g = group(name, col, loc=loc, rot=(0, 0, rotz), parent=parent)
    lathe(f"{name}_Body", [(0.0, 0.0), (0.040, 0.0), (0.042, 0.095), (0.038, 0.095), (0.036, 0.008), (0.0, 0.008)],
          mat or L.porcelain, col, segments=32, parent=g)
    pipe(f"{name}_Handle", [(0.040, 0, 0.075), (0.07, 0, 0.07), (0.07, 0, 0.03), (0.040, 0, 0.025)], 0.006,
         mat or L.porcelain, col, sides=8, bend_radius=0.015, parent=g)
    return g


def book_row(name, x0, length, loc, rotz, L, col, parent=None, seed=3, h=(0.20, 0.28)):
    r = random.Random(seed)
    g = group(name, col, loc=loc, rot=(0, 0, rotz), parent=parent)
    mats = [L.plastic_black, L.leather_brown, L.plastic_red, L.plastic_blue, L.plastic_white, L.fabric_cushion,
            L.walnut, L.plastic_grey]
    x = x0
    while x < x0 + length:
        t = r.uniform(0.022, 0.045)
        hh = r.uniform(*h)
        d = r.uniform(0.15, 0.22)
        box(f"{name}_Book", (t, d, hh), (x + t / 2, -d / 2 - 0.01, hh / 2), r.choice(mats), col, bevel=0.002,
            parent=g, share=False)
        x += t + 0.002
    return g


def helmet(name, loc, L, col, rotz=0.0, parent=None, shell=None, stripe=None):
    """Full-face racing helmet: shell, visor, stripe, chin vent."""
    g = group(name, col, loc=loc, rot=(0, 0, rotz), parent=parent)
    rr = 0.14
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=24, radius=rr)
    for v in bm.verts:
        v.co.y *= 1.12
        v.co.z *= 1.02
    cut = [f for f in bm.faces if f.calc_center_median().z < -0.55 * rr]
    bmesh.ops.delete(bm, geom=cut, context='FACES')
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.008)
    me = mesh_from_bm(f"{name}_Shell", bm)
    me.materials.append(shell or L.red_paint)
    new_object(f"{name}_Shell", me, col, (0, 0, 0.55 * rr), (0, 0, 0), g)
    # visor: front cap of a slightly larger sphere
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=24, radius=rr * 1.03)
    for v in bm.verts:
        v.co.y *= 1.12
        v.co.z *= 1.02
    keep = lambda c: c.y < -0.45 * rr and -0.12 * rr < c.z < 0.38 * rr
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keep(f.calc_center_median())], context='FACES')
    me = mesh_from_bm(f"{name}_Visor", bm)
    me.materials.append(L.glass_car)
    new_object(f"{name}_Visor", me, col, (0, 0, 0.55 * rr), (0, 0, 0), g)
    box(f"{name}_Chin_Vent", (0.06, 0.02, 0.025), (0, -0.155, 0.02), L.plastic_black, col, bevel=0.006, parent=g)
    if stripe is not None:
        box(f"{name}_Stripe", (0.03, 0.30, 0.004), (0, 0.0, 0.55 * rr + rr * 1.02 + 0.0005), stripe, col,
            bevel=0.0, parent=g)
    return g


def trophy(name, loc, L, col, h=0.30, parent=None, mat=None):
    g = group(name, col, loc=loc, parent=parent)
    box(f"{name}_Base", (0.10, 0.10, 0.06), (0, 0, 0.03), L.walnut, col, bevel=0.004, parent=g)
    lathe(f"{name}_Cup", [(0.0, 0.06), (0.03, 0.06), (0.012, 0.09), (0.012, 0.06 + h * 0.4), (0.06, 0.06 + h * 0.6),
                          (0.075, 0.06 + h), (0.07, 0.06 + h), (0.055, 0.06 + h * 0.62), (0.0, 0.06 + h * 0.62)],
          mat or L.brass, col, segments=40, parent=g)
    for s in (-1, 1):
        pipe(f"{name}_Handle", [(s * 0.06, 0, 0.06 + h * 0.85), (s * 0.10, 0, 0.06 + h * 0.8),
                                (s * 0.09, 0, 0.06 + h * 0.6), (s * 0.04, 0, 0.06 + h * 0.5)], 0.005,
             mat or L.brass, col, sides=8, bend_radius=0.02, parent=g)
    box(f"{name}_Plaque", (0.06, 0.002, 0.025), (0, -0.051, 0.03), L.brass, col, bevel=0.0, parent=g)
    return g


def table_lamp(name, loc, L, col, parent=None, kelvin=2700, lumens=350, shade_mat=None):
    from . import lighting
    g = group(name, col, loc=loc, parent=parent)
    lathe(f"{name}_Base", [(0.0, 0.0), (0.08, 0.0), (0.08, 0.02), (0.02, 0.04), (0.012, 0.36), (0.0, 0.36)],
          L.brass, col, segments=40, parent=g)
    shade = lathe(f"{name}_Shade", [(0.11, 0.30), (0.15, 0.30), (0.12, 0.52), (0.08, 0.52)], shade_mat or L.fabric_cushion,
                  col, segments=48, parent=g)
    lathe(f"{name}_Shade_Inner", [(0.08, 0.519), (0.118, 0.519), (0.148, 0.301), (0.11, 0.301)],
          shade_mat or L.fabric_cushion, col, segments=48, parent=g)
    lighting.point(f"{name}_Light", (0, 0, 0.42), lumens, kelvin, radius=0.03, parent=g)
    return g


def tote(name, loc, L, col, parent=None, rotz=0.0, mat=None, lid=None):
    g = group(name, col, loc=loc, rot=(0, 0, rotz), parent=parent)
    box(f"{name}_Bin", (0.60, 0.40, 0.30), (0, 0, 0.15), mat or L.plastic_black, col, bevel=0.02, segments=3,
        parent=g)
    box(f"{name}_Lid", (0.62, 0.42, 0.03), (0, 0, 0.315), lid or L.plastic_yellow, col, bevel=0.01, parent=g)
    box(f"{name}_Label", (0.12, 0.001, 0.06), (0, -0.2005, 0.20), L.label_white, col, bevel=0.0, parent=g)
    return g
