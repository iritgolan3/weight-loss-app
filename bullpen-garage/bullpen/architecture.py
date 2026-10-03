"""
Building shell: slab and coating, walls, cove base, exposed bar-joist roof
with metal deck, 14' insulated overhead door with high-lift hardware and
jack-shaft opener, insulated steel man door, bathroom enclosure, exterior
context seen through the door lites.
"""

import math
import re
from mathutils import Vector
from . import config as C
from .core import (box, box_between, cylinder, pipe, profile_sweep, prism,
                   group, instance, lathe, rounded_rect, mesh_from_pydata,
                   new_object, add_bevel, text, uv_sphere)

ARCH = "ARCHITECTURE"
STRUCT = "STRUCTURE"


# ---------------------------------------------------------------- floor

def build_floor(L):
    """Coated slab split at the saw-cut control joints (3 mm joints)."""
    xs = [C.X0] + sorted(C.SLAB_JOINTS_X) + [C.X1]
    ys = [C.Y0] + sorted(C.SLAB_JOINTS_Y) + [C.Y1]
    g = 0.0015  # half joint width
    k = 1
    for i in range(len(xs) - 1):
        for j in range(len(ys) - 1):
            x0 = xs[i] + (g if i > 0 else 0)
            x1 = xs[i + 1] - (g if i < len(xs) - 2 else 0)
            y0 = ys[j] + (g if j > 0 else 0)
            y1 = ys[j + 1] - (g if j < len(ys) - 2 else 0)
            box_between(f"Floor_Slab_Panel_{k:02d}", (x0, y0, -C.SLAB_T), (x1, y1, 0.0),
                        L.floor, ARCH, bevel=0.0012, segments=2, share=False)
            k += 1
    # joint sealant visible in the saw cuts
    box_between("Floor_Joint_Sealant", (C.X0, C.Y0, -C.SLAB_T), (C.X1, C.Y1, -0.004),
                L.rubber, ARCH, bevel=0, share=False)
    # epoxy cove base (integral 4" cove) along the walls
    r = 0.025
    prof = [(0.0, 0.0), (0.0, 0.10), (0.004, 0.10), (0.004, r)]
    for s in range(1, 7):
        a = math.radians(180 + 90 * s / 6)
        prof.append((0.004 + r + r * math.cos(a), r + r * math.sin(a)))
    # prof is (out-from-wall, up); build per wall as (local x, local z) extrusion
    door_l = C.MAN_DOOR_CENTER_X - C.MAN_DOOR_W / 2 - 0.06
    door_r = C.MAN_DOOR_CENTER_X + C.MAN_DOOR_W / 2 + 0.06
    ohd_l = C.OHD_CENTER_X - C.OHD_WIDTH / 2
    ohd_r = C.OHD_CENTER_X + C.OHD_WIDTH / 2
    runs = [
        # (start, end, inward normal)
        ((C.X0, C.Y0), (C.X0, C.Y1), (1, 0)),            # left wall
        ((C.X1, C.Y1), (C.X1, C.Y0), (-1, 0)),           # right wall
        ((C.X0, C.Y1), (C.X1, C.Y1), (0, -1)),           # back wall
        ((C.X0, C.Y0), (door_l, C.Y0), (0, 1)),          # front wall segments
        ((door_r, C.Y0), (ohd_l, C.Y0), (0, 1)),
        ((ohd_r, C.Y0), (C.X1, C.Y0), (0, 1)),
    ]
    for idx, (a, b, n) in enumerate(runs):
        _cove_run(f"Floor_Cove_Base_{idx + 1:02d}", a, b, n, prof, L.floor)


def _cove_run(name, a, b, n, prof, mat):
    a, b = Vector((*a, 0)), Vector((*b, 0))
    d = (b - a)
    length = d.length
    d.normalize()
    nv = Vector((n[0], n[1], 0))
    verts, faces = [], []
    m = len(prof)
    for end in (a, b):
        for (o, z) in prof:
            p = end + nv * o
            verts.append((p.x, p.y, z))
    for j in range(m - 1):
        faces.append((j, j + 1, m + j + 1, m + j))
    faces.append(tuple(range(m)))
    faces.append(tuple(m + j for j in reversed(range(m))))
    me = mesh_from_pydata(name, verts, faces, smooth=True, sharp_angle=40, recalc=True)
    me.materials.append(mat)
    return new_object(name, me, ARCH)


# ---------------------------------------------------------------- walls

def build_walls(L):
    top = C.DECK_Z + 0.25
    t = C.WALL_T
    tf = C.FRONT_WALL_T
    box_between("Wall_Main_Left", (C.X0 - t, -tf, -C.SLAB_T), (C.X0, C.Y1 + t, top),
                L.wall, ARCH, bevel=0, share=False)
    box_between("Wall_Main_Right", (C.X1, -tf, -C.SLAB_T), (C.X1 + t, C.Y1 + t, top),
                L.wall, ARCH, bevel=0, share=False)
    box_between("Wall_Main_Back", (C.X0, C.Y1, -C.SLAB_T), (C.X1, C.Y1 + t, top),
                L.wall, ARCH, bevel=0, share=False)
    # front wall around the openings (painted CMU)
    md_l = C.MAN_DOOR_CENTER_X - C.MAN_DOOR_W / 2 - 0.05
    md_r = C.MAN_DOOR_CENTER_X + C.MAN_DOOR_W / 2 + 0.05
    md_t = C.MAN_DOOR_H + 0.05
    oh_l = C.OHD_CENTER_X - C.OHD_WIDTH / 2
    oh_r = C.OHD_CENTER_X + C.OHD_WIDTH / 2
    oh_t = C.OHD_HEIGHT
    y0, y1 = -tf, 0.0
    segs = [
        ("Wall_Front_Left", (C.X0, y0, -C.SLAB_T), (md_l, y1, top)),
        ("Wall_Front_ManDoor_Header", (md_l, y0, md_t), (md_r, y1, top)),
        ("Wall_Front_Pier", (md_r, y0, -C.SLAB_T), (oh_l, y1, top)),
        ("Wall_Front_OHD_Header", (oh_l, y0, oh_t), (oh_r, y1, top)),
        ("Wall_Front_Right", (oh_r, y0, -C.SLAB_T), (C.X1, y1, top)),
    ]
    for name, a, b in segs:
        box_between(name, a, b, L.cmu, ARCH, bevel=0.004, share=False)
    # steel jamb guards / angle at the overhead door jambs
    for side, x in (("L", oh_l), ("R", oh_r)):
        s = -1 if side == "L" else 1
        box_between(f"OHD_Jamb_Angle_{side}", (x - 0.003 * s if s > 0 else x - 0.0, -0.08, 0.0),
                    (x + 0.003 * s if s > 0 else x + 0.003, 0.0, oh_t), L.steel_grey, ARCH,
                    bevel=0.001, share=False)
    # bollard-style jamb guards outside? (no evidence) - omitted on purpose
    # interior side of the openings (returns) painted
    # threshold under man door
    box_between("ManDoor_Threshold", (md_l + 0.05, -0.20, 0.0), (md_r - 0.05, -0.02, 0.012),
                L.alu_brushed, ARCH, bevel=0.002, share=False)


# ---------------------------------------------------------------- roof

def _angle_profile(leg=0.05, t=0.005):
    """L-angle cross-section (local x horizontal, y vertical)."""
    return [(0, 0), (leg, 0), (leg, t), (t, t), (t, leg), (0, leg)]


def build_roof(L):
    """Open-web steel bar joists (spanning X) with 1.5" B-deck above."""
    deck_z = C.DECK_Z
    jd = C.JOIST_DEPTH
    span0, span1 = C.X0 - 0.05, C.X1 + 0.05
    ys = []
    y = C.JOIST_SPACING * 0.5
    while y < C.Y1:
        ys.append(y)
        y += C.JOIST_SPACING
    proto = None
    parts = []
    for i, yj in enumerate(ys):
        if proto is None:
            parts = _make_joist(L, yj, deck_z, jd, span0, span1)
            proto = parts
        else:
            dy = yj - ys[0]
            for p in proto:
                instance(p, p["base_name"],
                         loc=(p.location.x, p.location.y + dy, p.location.z),
                         rot=p.rotation_euler, col=STRUCT)
    # bridging angles running along Y at third points (top & bottom chords)
    for bx in (-C.WIDTH / 6 * 1.5, C.WIDTH / 6 * 1.5):
        for z in (deck_z - 0.06, deck_z - jd + 0.01):
            box_between("Roof_Joist_Bridging", (bx - 0.02, 0.0, z), (bx + 0.02, C.Y1, z + 0.035),
                        L.steel_white, STRUCT, bevel=0.002, share=True)
    # metal deck: trapezoidal ribs every 6", running along Y (spanning joists)
    pitch = 6 * C.IN
    rib_h = 1.5 * C.IN
    top_w = 1.75 * C.IN
    bot_w = 1.75 * C.IN
    verts, faces = [], []
    xs = []
    x = C.X0 - 0.1
    while x < C.X1 + 0.1:
        # profile points along X for one pitch (z relative to deck underside)
        xs.extend([
            (x, rib_h), (x + top_w / 2, rib_h),
            (x + top_w / 2 + 0.012, 0.0), (x + pitch - top_w / 2 - 0.012, 0.0),
            (x + pitch - top_w / 2, rib_h)])
        x += pitch
    ylen = [-0.1, C.Y1 + 0.1]
    n = len(xs)
    for yy in ylen:
        for (px, pz) in xs:
            verts.append((px, yy, deck_z + pz))
    for k in range(n - 1):
        faces.append((k, k + 1, n + k + 1, n + k))
    me = mesh_from_pydata("Roof_Metal_Deck", verts, faces, smooth=False)
    me.materials.append(L.deck)
    deck = new_object("Roof_Metal_Deck", me, STRUCT)
    sol = deck.modifiers.new("Solidify", 'SOLIDIFY')
    sol.thickness = 0.0009
    sol.offset = 1.0
    # roof insulation / roof board above the deck (closes the volume)
    box_between("Roof_Insulation_Board", (C.X0 - 0.3, -0.4, deck_z + rib_h + 0.001),
                (C.X1 + 0.3, C.Y1 + 0.3, deck_z + rib_h + 0.12), L.concrete_smooth, STRUCT,
                bevel=0, share=False)
    # perimeter ledger angles on the side walls (joist bearing)
    for side, x0, x1 in (("L", C.X0, C.X0 + 0.1), ("R", C.X1 - 0.1, C.X1)):
        box_between(f"Roof_Bearing_Ledger_{side}", (x0, 0.0, deck_z - 0.11),
                    (x1, C.Y1, deck_z - 0.10 + 0.01), L.steel_white, STRUCT, bevel=0.002,
                    share=False)


def _make_joist(L, y, deck_z, jd, x0, x1):
    parts = []
    tc_z = deck_z - 0.002   # top of top chord
    # top chord: double angles, 25 mm gap
    leg = 0.05
    gap = 0.0125
    for side, s in (("A", 1), ("B", -1)):
        prof = [(s * gap + s * px, -py) for (px, py) in _angle_profile(leg, 0.005)]
        if s < 0:
            prof = list(reversed(prof))
        parts.append(profile_sweep(f"Roof_Joist_TopChord{side}",
                                   [(x0, y, tc_z), (x1, y, tc_z)],
                                   [(p[0], p[1]) for p in prof], L.steel_white, STRUCT,
                                   up_hint=(0, 0, 1)))
        bc_z = deck_z - jd
        prof_b = [(s * gap + s * px, py) for (px, py) in _angle_profile(0.038, 0.004)]
        if s < 0:
            prof_b = list(reversed(prof_b))
        parts.append(profile_sweep(f"Roof_Joist_BottomChord{side}",
                                   [(x0 + 0.25, y, bc_z), (x1 - 0.25, y, bc_z)],
                                   prof_b, L.steel_white, STRUCT, up_hint=(0, 0, 1)))
    # web: continuous round-bar zig-zag (see below); remember base names
    # so the other joists can be linked duplicates
    panel = 0.61
    n = int((x1 - x0 - 0.5) / panel)
    pts = []
    xs = x0 + 0.25
    for k in range(n + 1):
        xx = xs + k * (x1 - x0 - 0.5) / n
        zz = (deck_z - 0.03) if k % 2 == 0 else (deck_z - jd + 0.02)
        pts.append((xx, y, zz))
    parts.append(pipe("Roof_Joist_Web", pts, 0.011, L.steel_white, STRUCT, sides=8,
                      bend_radius=0.015, steps=2))
    # end bearing seats
    for xe, nm in ((x0 + 0.05, "L"), (x1 - 0.05, "R")):
        parts.append(box(f"Roof_Joist_Seat_{nm}", (0.1, 0.12, 0.13),
                         (xe, y, deck_z - 0.065), L.steel_white, STRUCT, bevel=0.002))
    for p in parts:
        p["base_name"] = re.sub(r"_\d{2,}$", "", p.name)
    return parts


# ---------------------------------------------------------------- overhead door

def build_overhead_door(L):
    W = C.OHD_WIDTH + 0.05
    H = C.OHD_HEIGHT
    n = C.OHD_SECTIONS
    sh = H / n
    cx = C.OHD_CENTER_X
    t = 0.051
    open_f = max(0.0, min(1.0, C.OHD_OPEN_FRACTION))
    door = group("Garage_Door", ARCH, loc=(cx, 0.0, 0.0))
    hl = 1.0                                  # high-lift above the opening
    v_top = H + hl
    lift = open_f * (H - 0.3)
    for k in range(n):
        z0 = k * sh + 0.002 + lift
        if z0 + sh > v_top + 0.05:
            continue  # sections already on the horizontal track are omitted when open
        name = f"Garage_Door_Section_{k + 1}"
        if k + 1 == C.OHD_WINDOW_ROW:
            _door_window_section(L, door, name, W, sh, t, z0)
        else:
            box(name, (W, t, sh - 0.004), (0, 0.03, z0 + sh / 2), L.ohd_panel, ARCH,
                bevel=0.006, segments=3, parent=door, share=True)
            # pressed rib grooves (commercial ribbed panel) on the inside skin
        _door_section_hardware(L, door, k, W, sh, t, z0, n)
    # bottom astragal seal
    box("Garage_Door_Bottom_Seal", (W - 0.02, 0.04, 0.025), (0, 0.03, lift + 0.0125),
        L.weatherstrip, ARCH, bevel=0.008, parent=door)
    # perimeter weather seal on jambs/header (interior side visible)
    for s in (-1, 1):
        box(f"Garage_Door_Jamb_Seal_{'L' if s < 0 else 'R'}", (0.03, 0.02, H),
            (s * (W / 2 - 0.01), -0.004, H / 2), L.weatherstrip, ARCH, bevel=0.004,
            parent=door)
    _door_tracks(L, door, W, H, hl, cx)
    return door


def _door_window_section(L, door, name, W, sh, t, z0):
    nwin = 4
    ww, wh = 0.61, 0.305
    zc = z0 + sh / 2
    # bands above/below
    band = (sh - wh) / 2
    box(f"{name}_Lower", (W, t, band - 0.002), (0, 0.03, z0 + band / 2), L.ohd_panel,
        ARCH, bevel=0.005, parent=door, share=False)
    box(f"{name}_Upper", (W, t, band - 0.002), (0, 0.03, z0 + sh - band / 2 - 0.002),
        L.ohd_panel, ARCH, bevel=0.005, parent=door, share=False)
    pitch = W / nwin
    xs = [-W / 2 + pitch * (i + 0.5) for i in range(nwin)]
    edges = [-W / 2] + [x for xc in xs for x in (xc - ww / 2, xc + ww / 2)] + [W / 2]
    for i in range(0, len(edges), 2):
        a, b = edges[i], edges[i + 1]
        box(f"{name}_Stile", (b - a, t, wh + 0.004), ((a + b) / 2, 0.03, zc), L.ohd_panel,
            ARCH, bevel=0.003, parent=door, share=False)
    for i, xc in enumerate(xs):
        # glazing: double pane acrylic, frame ring on both faces
        box(f"Garage_Door_Window_Glass_{i + 1}", (ww - 0.01, 0.006, wh - 0.01), (xc, 0.03, zc),
            L.glass_door, ARCH, bevel=0.0, parent=door, share=True)
        ring = rounded_rect(ww + 0.05, wh + 0.05, 0.03, 4)
        inner = rounded_rect(ww - 0.02, wh - 0.02, 0.015, 4)
        for side, yy in (("In", 0.058), ("Out", 0.0)):
            _frame_ring(f"Garage_Door_Window_Frame_{side}_{i + 1}", ring, inner, 0.012,
                        (xc, yy, zc), L.plastic_black, door)


def _frame_ring(name, outer, inner, depth, loc, mat, parent):
    """Flat picture-frame ring in the XZ plane (outer/inner outlines in XZ)."""
    n = len(outer)
    verts = []
    for (x, z) in outer:
        verts.append((x, 0, z))
    for (x, z) in inner:
        verts.append((x, 0, z))
    for (x, z) in outer:
        verts.append((x, depth, z))
    for (x, z) in inner:
        verts.append((x, depth, z))
    faces = []
    m = len(inner)
    # front face (outer ring y=0) as quads between outer/inner (same counts)
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, n + j, n + i))                    # front
        faces.append((2 * n + i, 2 * n + n + i, 2 * n + n + j, 2 * n + j))  # back
        faces.append((i, 2 * n + i, 2 * n + j, j))            # outer side
        faces.append((n + i, n + j, 3 * n + j, 3 * n + i))    # inner side
    me = mesh_from_pydata(name, verts, faces, smooth=True, sharp_angle=35)
    me.materials.append(mat)
    o = new_object(name, me, ARCH, loc=loc, parent=parent)
    o.location.y -= depth / 2
    return o


def _door_section_hardware(L, door, k, W, sh, t, z0, n):
    y_in = 0.03 + t / 2
    # end stiles and centre stiles (galvanised U-channels on the inside skin)
    for xs in (-W / 2 + 0.06, -W / 6, W / 6, W / 2 - 0.06):
        box("Garage_Door_Stile", (0.075, 0.012, sh - 0.01), (xs, y_in + 0.006, z0 + sh / 2),
            L.galv, ARCH, bevel=0.002, parent=door)
    # hinges at the joint above this section
    if k < n - 1:
        for xs in (-W / 2 + 0.06, -W / 6, W / 6, W / 2 - 0.06):
            box("Garage_Door_Hinge", (0.06, 0.008, 0.14), (xs, y_in + 0.016, z0 + sh),
                L.galv, ARCH, bevel=0.0015, parent=door)
            cylinder("Garage_Door_Hinge_Knuckle", 0.007, 0.05, (xs, y_in + 0.022, z0 + sh),
                     L.galv, ARCH, rot=(0, math.radians(90), 0), verts=12, parent=door)
    # rollers at each end (stem through hinge into the track)
    for s in (-1, 1):
        xr = s * (W / 2 + 0.03)
        zr = z0 + (sh if k < n - 1 else sh - 0.08)
        cylinder("Garage_Door_Roller_Stem", 0.0055, 0.10, (s * (W / 2 - 0.02), y_in + 0.025, zr),
                 L.steel_bare, ARCH, rot=(0, math.radians(90), 0), verts=12, parent=door)
        cylinder("Garage_Door_Roller_Wheel", 0.024, 0.016, (xr, y_in + 0.025, zr),
                 L.plastic_black, ARCH, rot=(0, math.radians(90), 0), verts=24, parent=door)
    # reinforcing struts on the upper two sections and the bottom section
    if k >= n - 2 or k == 0:
        box("Garage_Door_Strut", (W - 0.25, 0.06, 0.075), (0, y_in + 0.035, z0 + sh * 0.55),
            L.galv, ARCH, bevel=0.002, parent=door)
    if k == 0:
        for s in (-1, 1):
            box("Garage_Door_Bottom_Bracket", (0.07, 0.04, 0.16),
                (s * (W / 2 - 0.05), y_in + 0.02, z0 + 0.09), L.galv, ARCH, bevel=0.002,
                parent=door)


def _door_tracks(L, door, W, H, hl, cx):
    """Vertical + high-lift track, radius, horizontal track, torsion shaft."""
    r = 0.38
    v_top = H + hl
    y_tr = 0.03 + 0.051 / 2 + 0.025
    h_len = 3.6
    for s, nm in ((-1, "L"), (1, "R")):
        x = cx + s * (W / 2 + 0.03)
        pts = [(x, y_tr, 0.02), (x, y_tr, v_top + r), (x, y_tr + h_len, v_top + r)]
        # track: C-channel (flanges along Y, opening toward the door) swept
        # along the vertical + radius + horizontal path. Profile x -> -Y,
        # profile y -> +X for this path orientation.
        prof = [(-0.02, -0.025), (0.02, -0.025), (0.02, 0.025), (0.016, 0.025),
                (0.016, -0.021), (-0.016, -0.021), (-0.016, 0.025), (-0.02, 0.025)]
        prof = [(px, -py * s) for (px, py) in prof]
        profile_sweep(f"Garage_Door_Track_{nm}", pts, prof, L.galv, ARCH,
                      bend_radius=r, up_hint=(1, 0, 0))
        # jamb angle the vertical track is bolted to
        box(f"Garage_Door_Track_Jamb_Angle_{nm}", (0.004, 0.06, v_top - 0.1),
            (x + s * 0.03, 0.03, (v_top - 0.1) / 2 + 0.05), L.galv, ARCH, bevel=0.001,
            share=False)
        # rear hanger from the joists and sway brace
        y_end = y_tr + h_len - 0.05
        z_top = C.DECK_Z - C.JOIST_DEPTH
        pipe(f"Garage_Door_Track_Hanger_{nm}",
             [(x + s * 0.02, y_end, v_top + r), (x + s * 0.02, y_end, z_top + 0.02)],
             0.012, L.galv, ARCH, sides=4, cap=True)
        pipe(f"Garage_Door_Track_Brace_{nm}",
             [(x + s * 0.02, y_end - 0.6, v_top + r), (x + s * 0.02, y_end, z_top - 0.05)],
             0.010, L.galv, ARCH, sides=4, cap=True)
        # lift cable from drum to bottom bracket
        pipe(f"Garage_Door_Lift_Cable_{nm}", [(x - s * 0.05, 0.075, 0.10),
                                               (x - s * 0.05, 0.075, v_top + 0.05)],
             0.0024, L.steel_bare, ARCH, sides=6, cap=False)
        # photo-eye safety sensors
        box(f"Garage_Door_PhotoEye_{nm}", (0.05, 0.07, 0.06), (x + s * 0.04, 0.12, 0.15),
            L.plastic_black, ARCH, bevel=0.006)
        box(f"Garage_Door_PhotoEye_Lens_{nm}", (0.012, 0.02, 0.02), (x - s * 0.0, 0.12, 0.15),
            L.glass_lens, ARCH, bevel=0.002)
    # torsion shaft + springs + drums at the top of the high-lift
    zs = v_top + 0.12
    ys = 0.17
    xl, xr = cx - W / 2 - 0.12, cx + W / 2 + 0.12
    cylinder("Garage_Door_Torsion_Shaft", 0.0127, xr - xl + 0.2, ((xl + xr) / 2, ys, zs),
             L.steel_bare, ARCH, rot=(0, math.radians(90), 0), verts=16, share=False)
    for s, xd in ((-1, cx - W / 2 - 0.03), (1, cx + W / 2 + 0.03)):
        prof = [(0.0, -0.06), (0.10, -0.06), (0.10, -0.05), (0.075, 0.03), (0.075, 0.06),
                (0.0, 0.06)]
        lathe("Garage_Door_Cable_Drum", prof, L.alu_cast, ARCH, loc=(xd, ys, zs),
              rot=(0, math.radians(90) * s, 0), segments=32)
        # end bearing plate on the wall
        box("Garage_Door_End_Bearing_Plate", (0.14, 0.008, 0.20), (xd + s * 0.09, 0.006, zs),
            L.galv, ARCH, bevel=0.002)
    # coil springs either side of the centre bracket
    for s in (-1, 1):
        _coil("Garage_Door_Torsion_Spring", (cx + s * 0.75, ys, zs), 0.045, 0.0075, 1.2,
              L.steel_black)
    box("Garage_Door_Center_Bracket", (0.12, 0.17, 0.16), (cx, 0.09, zs), L.galv, ARCH,
        bevel=0.002)
    # jack-shaft opener on the wall at the right end of the shaft
    xo = xr + 0.22
    op = group("Garage_Door_Opener_Jackshaft", ARCH, loc=(xo, 0.10, zs - 0.08))
    box("Opener_Housing", (0.24, 0.20, 0.36), (0, 0.0, 0.0), L.plastic_grey, ARCH,
        bevel=0.02, segments=3, parent=op)
    box("Opener_Cover_Logo_Plate", (0.18, 0.004, 0.06), (0, -0.101, 0.08), L.alu_brushed, ARCH,
        bevel=0.001, parent=op)
    cylinder("Opener_Motor", 0.055, 0.14, (0, 0.02, -0.22), L.black_metal, ARCH, parent=op,
             verts=24)
    box("Opener_Battery_Pack", (0.16, 0.08, 0.10), (0, 0.02, -0.40), L.plastic_black, ARCH,
        bevel=0.01, parent=op)
    pipe("Opener_Release_Cord", [(xo + 0.08, 0.0, zs - 0.30), (xo + 0.08, 0.0, 1.95)],
         0.003, L.plastic_red, ARCH, sides=6)
    box("Opener_Release_Handle", (0.03, 0.03, 0.10), (xo + 0.08, 0.0, 1.90), L.plastic_red,
        ARCH, bevel=0.008)
    pipe("Opener_Power_Cord", [(xo, 0.05, zs - 0.30), (xo, 0.05, zs - 0.6),
                               (xo + 0.25, 0.04, zs - 0.65), (xo + 0.25, 0.02, 4.0)],
         0.004, L.plastic_black, ARCH, sides=6, bend_radius=0.05)
    box("Opener_Outlet_Box", (0.07, 0.04, 0.12), (xo + 0.25, 0.02, 3.95), L.galv, ARCH,
        bevel=0.003)


def _coil(name, center, radius, wire_r, length, mat, turns_per_m=34):
    pts = []
    turns = int(length * turns_per_m)
    steps = turns * 10
    cx, cy, cz = center
    for i in range(steps + 1):
        a = 2 * math.pi * i / 10
        x = cx - length / 2 + length * i / steps
        pts.append((x, cy + radius * math.cos(a), cz + radius * math.sin(a)))
    return pipe(name, pts, wire_r, mat, ARCH, sides=6, bend_radius=0.0, steps=1)


# ---------------------------------------------------------------- man door

def build_man_door(L):
    w, h = C.MAN_DOOR_W, C.MAN_DOOR_H
    cx = C.MAN_DOOR_CENTER_X
    g = group("Door_Man_Entry", ARCH, loc=(cx, 0.0, 0.0))
    fw = 0.05   # frame face
    depth = C.FRONT_WALL_T
    # hollow-metal frame: head + jambs with a stop
    for nm, sz, loc in (
        ("Door_Man_Frame_Head", (w + 2 * fw, depth + 0.01, fw), (0, -depth / 2, h + fw / 2)),
        ("Door_Man_Frame_Jamb_L", (fw, depth + 0.01, h), (-w / 2 - fw / 2, -depth / 2, h / 2)),
        ("Door_Man_Frame_Jamb_R", (fw, depth + 0.01, h), (w / 2 + fw / 2, -depth / 2, h / 2)),
    ):
        box(nm, sz, loc, L.door_steel, ARCH, bevel=0.003, parent=g, share=False)
    for nm, sz, loc in (
        ("Door_Man_Stop_Head", (w, 0.016, 0.016), (0, -0.165 + 0.008, h - 0.008)),
        ("Door_Man_Stop_L", (0.016, 0.016, h), (-w / 2 + 0.008, -0.165 + 0.008, h / 2)),
        ("Door_Man_Stop_R", (0.016, 0.016, h), (w / 2 - 0.008, -0.165 + 0.008, h / 2)),
    ):
        box(nm, sz, loc, L.door_steel, ARCH, bevel=0.002, parent=g, share=False)
    # leaf (1-3/4") set toward the outside (out-swing)
    box("Door_Man_Leaf", (w - 0.006, 0.0445, h - 0.012), (0, -0.165 - 0.022, h / 2 + 0.002),
        L.door_steel, ARCH, bevel=0.003, segments=3, parent=g, share=False)
    yi = -0.165 + 0.0
    # lever handle + rose
    lx = w / 2 - 0.07
    cylinder("Door_Man_Lever_Rose", 0.032, 0.012, (lx, yi + 0.006, 1.016), L.stainless_y,
             ARCH, rot=(math.radians(90), 0, 0), parent=g, verts=32)
    pipe("Door_Man_Lever", [(lx, yi + 0.012, 1.016), (lx, yi + 0.055, 1.016),
                            (lx - 0.12, yi + 0.065, 1.016)], 0.009, L.stainless, ARCH,
         sides=12, bend_radius=0.02, parent=g)
    cylinder("Door_Man_Deadbolt_Rose", 0.03, 0.01, (lx, yi + 0.005, 1.016 + 0.15), L.stainless_y,
             ARCH, rot=(math.radians(90), 0, 0), parent=g, verts=32)
    box("Door_Man_Deadbolt_Thumbturn", (0.012, 0.018, 0.045), (lx, yi + 0.018, 1.166),
        L.stainless, ARCH, bevel=0.004, parent=g)
    # door closer (parallel-arm, interior side)
    box("Door_Man_Closer_Body", (0.30, 0.055, 0.065), (-w / 2 + 0.25, yi + 0.03, h - 0.08),
        L.alu_cast, ARCH, bevel=0.01, segments=3, parent=g)
    box("Door_Man_Closer_Arm", (0.30, 0.012, 0.02), (-w / 2 + 0.38, yi + 0.07, h + 0.02),
        L.alu_cast, ARCH, bevel=0.003, parent=g)
    # kick plate
    box("Door_Man_Kick_Plate", (w - 0.06, 0.0015, 0.25), (0, yi + 0.001, 0.14), L.stainless,
        ARCH, bevel=0.0005, parent=g)
    # wall-mounted door stop/bumper
    # weatherstrip at the stops
    box("Door_Man_Weatherstrip_Head", (w - 0.02, 0.006, 0.012), (0, yi - 0.004, h - 0.02),
        L.weatherstrip, ARCH, bevel=0.002, parent=g)
    return g


# ---------------------------------------------------------------- bathroom

def build_bathroom(L):
    """Partition walls under the mezzanine (rear-right corner) + fixtures."""
    x0 = C.X1 - C.BATH_W
    y0 = C.Y1 - C.BATH_D
    ztop = C.MEZZ_SOFFIT_Z
    t = 0.12
    dw, dh = 0.813, 2.032
    door_y = y0 + 0.25 + dw / 2      # door centre on the bathroom's left wall
    g = group("Bathroom", ARCH)
    # front partition (faces the bay)
    box_between("Bathroom_Wall_Front", (x0 - t, y0 - t, 0.0), (C.X1, y0, ztop), L.wall, ARCH,
                bevel=0.003, share=False).parent = g
    # left partition with door opening
    box_between("Bathroom_Wall_Left_A", (x0 - t, y0, 0.0), (x0, door_y - dw / 2 - 0.04, ztop),
                L.wall, ARCH, bevel=0.003, share=False).parent = g
    box_between("Bathroom_Wall_Left_B", (x0 - t, door_y + dw / 2 + 0.04, 0.0), (x0, C.Y1, ztop),
                L.wall, ARCH, bevel=0.003, share=False).parent = g
    box_between("Bathroom_Wall_Left_Header", (x0 - t, door_y - dw / 2 - 0.04, dh + 0.04),
                (x0, door_y + dw / 2 + 0.04, ztop), L.wall, ARCH, bevel=0.003,
                share=False).parent = g
    # door casing + slab door (walnut-stained) closed
    for nm, a, b in (
        ("Bathroom_Door_Casing_Head", (x0 - t - 0.012, door_y - dw / 2 - 0.10, dh + 0.04),
         (x0 + 0.012, door_y + dw / 2 + 0.10, dh + 0.12)),
        ("Bathroom_Door_Casing_L", (x0 - t - 0.012, door_y - dw / 2 - 0.10, 0.0),
         (x0 + 0.012, door_y - dw / 2 - 0.04, dh + 0.04)),
        ("Bathroom_Door_Casing_R", (x0 - t - 0.012, door_y + dw / 2 + 0.04, 0.0),
         (x0 + 0.012, door_y + dw / 2 + 0.10, dh + 0.04)),
    ):
        box_between(nm, a, b, L.plastic_black, ARCH, bevel=0.002, share=False).parent = g
    box_between("Bathroom_Door_Leaf", (x0 - t / 2 - 0.0175, door_y - dw / 2 - 0.035, 0.01),
                (x0 - t / 2 + 0.0175, door_y + dw / 2 + 0.035, dh + 0.035), L.walnut_y, ARCH,
                bevel=0.002, share=False).parent = g
    # flush pull + privacy lever (outside face, black)
    hx = x0 - t / 2 - 0.0175
    cylinder("Bathroom_Door_Lever_Rose", 0.028, 0.01, (hx - 0.005, door_y - dw / 2 + 0.03, 0.965),
             L.black_metal, ARCH, rot=(0, math.radians(90), 0), parent=g)
    pipe("Bathroom_Door_Lever", [(hx - 0.01, door_y - dw / 2 + 0.03, 0.965),
                                  (hx - 0.05, door_y - dw / 2 + 0.03, 0.965),
                                  (hx - 0.06, door_y - dw / 2 + 0.15, 0.965)], 0.0085,
         L.black_metal, ARCH, sides=12, bend_radius=0.02, parent=g)
    for zh in (0.25, 1.0, 1.85):
        box("Bathroom_Door_Hinge", (0.006, 0.02, 0.09), (hx - 0.002, door_y + dw / 2 + 0.03, zh),
            L.black_metal, ARCH, bevel=0.001, parent=g)
    # interior fixtures (visible only through the door if opened)
    tx = C.X1 - 0.40
    ty = C.Y1 - 0.36
    lathe("Bathroom_WC_Bowl", [(0.0, 0.0), (0.12, 0.0), (0.16, 0.20), (0.19, 0.40), (0.17, 0.42),
                               (0.0, 0.42)], L.porcelain, ARCH, loc=(tx - 0.95, C.Y1 - 0.45, 0.0),
          segments=32)
    box("Bathroom_WC_Tank", (0.48, 0.20, 0.38), (tx - 0.95, C.Y1 - 0.12, 0.62), L.porcelain, ARCH,
        bevel=0.02, segments=3)
    box("Bathroom_Vanity", (0.90, 0.53, 0.84), (tx, y0 + 0.30 + 0.45, 0.42), L.walnut, ARCH,
        bevel=0.004, rot=(0, 0, math.radians(90)))
    box("Bathroom_Vanity_Top", (0.92, 0.55, 0.03), (tx, y0 + 0.75, 0.855), L.quartz, ARCH,
        bevel=0.003, rot=(0, 0, math.radians(90)))
    box("Bathroom_Mirror", (0.006, 0.75, 0.95), (C.X1 - 0.004, y0 + 0.75, 1.55), L.mirror, ARCH,
        bevel=0.001)
    return g


# ---------------------------------------------------------------- exterior

def build_exterior(L):
    """Context outside the front wall: apron, drive aisle, opposite building."""
    col = ARCH
    box_between("Exterior_Concrete_Apron", (-30, -6.0, -0.30), (30, -C.FRONT_WALL_T, -0.02),
                L.concrete, col, bevel=0, share=False)
    box_between("Exterior_Drive_Aisle", (-30, -18.0, -0.32), (30, -6.0, -0.05), L.asphalt, col,
                bevel=0, share=False)
    box_between("Exterior_Apron_Opposite", (-30, -24.0, -0.30), (30, -18.0, -0.02), L.concrete,
                col, bevel=0, share=False)
    # opposite condo building: stucco wall with overhead doors
    box_between("Exterior_Opposite_Building", (-30, -32.0, -0.3), (30, -24.0, 7.2), L.stucco,
                col, bevel=0, share=False)
    for i in range(-3, 4):
        x = i * 9.144 + 1.1
        box(f"Exterior_Opposite_OHD", (3.66, 0.06, 4.27), (x, -23.98, 2.135), L.ohd_panel, col,
            bevel=0.004)
        box(f"Exterior_Opposite_ManDoor", (0.91, 0.05, 2.13), (x - 4.3, -23.99, 1.065),
            L.door_steel, col, bevel=0.003)
        box(f"Exterior_Opposite_WallPack", (0.3, 0.15, 0.22), (x, -23.9, 5.0), L.black_metal,
            col, bevel=0.01)
    # our own building's exterior face
    box_between("Exterior_Front_Fascia", (-30, -C.FRONT_WALL_T - 0.02, C.DECK_Z + 0.2),
                (30, -C.FRONT_WALL_T, C.DECK_Z + 1.0), L.stucco, col, bevel=0, share=False)
    # neighbour units continue the facade left/right
    box_between("Exterior_Front_Wall_Neighbour_L", (-30, -C.FRONT_WALL_T - 0.01, -0.3),
                (C.X0 - C.WALL_T, -0.0, C.DECK_Z + 1.0), L.stucco, col, bevel=0, share=False)
    box_between("Exterior_Front_Wall_Neighbour_R", (C.X1 + C.WALL_T, -C.FRONT_WALL_T - 0.01, -0.3),
                (30, -0.0, C.DECK_Z + 1.0), L.stucco, col, bevel=0, share=False)
    # landscaping strip
    box_between("Exterior_Landscape_Strip", (-30, -40.0, -0.3), (30, -32.0, 0.0), L.grass, col,
                bevel=0, share=False)


def build(L):
    build_floor(L)
    build_walls(L)
    build_roof(L)
    build_overhead_door(L)
    build_man_door(L)
    build_bathroom(L)
    build_exterior(L)
