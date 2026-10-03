"""
Modular steel garage cabinetry.

Each module is an assembly parented to an empty named Cabinet_NN_<type>.
Module-local frame: X runs along the run (width, centred), the back is at
y = 0 against the wall, the front faces -Y, and Z is up from the floor.

Every module is built from real parts: carcass shell, recessed aluminium toe
kick, double-wall drawer/door fronts with 3 mm reveals, aluminium bar pulls
on standoffs, lock cylinders, and stainless worktop, sink and slatwall where
used. The same module functions build the bar's back-bar (walnut fronts) in
furniture.py.
"""

import math
from mathutils import Vector
from . import config as C
from .core import (box, box_between, cylinder, pipe, lathe, group, profile_sweep,
                   prism, rounded_rect, xform)
from . import lighting

COL = "CABINETS"
FRONT_T = 0.020
GAP = C.CAB_GAP


# ---------------------------------------------------------------- parts

def pull_bar(g, name, length, x, z, y_front, L, vertical=False, mat=None):
    """Aluminium bar pull: 12 mm round bar on two 30 mm standoffs."""
    mat = mat or L.alu_brushed
    proj = 0.032
    y = y_front - proj
    if vertical:
        cylinder(f"{name}_Bar", 0.0065, length, (x, y, z), mat, COL, verts=16, parent=g)
        for s in (-1, 1):
            cylinder(f"{name}_Standoff", 0.0045, proj, (x, y_front - proj / 2, z + s * (length / 2 - 0.03)),
                     mat, COL, rot=(math.radians(90), 0, 0), verts=12, parent=g)
    else:
        cylinder(f"{name}_Bar", 0.0065, length, (x, y, z), mat, COL,
                 rot=(0, math.radians(90), 0), verts=16, parent=g)
        for s in (-1, 1):
            cylinder(f"{name}_Standoff", 0.0045, proj, (x + s * (length / 2 - 0.03), y_front - proj / 2, z),
                     mat, COL, rot=(math.radians(90), 0, 0), verts=12, parent=g)


def lock_cylinder(g, name, x, z, y_front, L):
    cylinder(f"{name}_Lock", 0.011, 0.006, (x, y_front - 0.003, z), L.chrome, COL,
             rot=(math.radians(90), 0, 0), verts=24, parent=g)
    box(f"{name}_Lock_Slot", (0.0015, 0.001, 0.009), (x, y_front - 0.0065, z), L.black_metal, COL,
        bevel=0.0, parent=g)


def carcass(g, name, width, depth, height, L, toe=C.CAB_TOE, mat=None, toe_mat=None):
    """Shell (sides/top/bottom/back) + recessed toe kick."""
    mat = mat or L.cab_carcass
    t = 0.0012 * 0 + 0.018
    d_in = depth - FRONT_T - 0.002
    # side panels (visible at run ends) full depth to the front faces
    for s in (-1, 1):
        box(f"{name}_Side", (t, d_in, height - toe), (s * (width / 2 - t / 2), -d_in / 2, toe + (height - toe) / 2),
            mat, COL, bevel=0.0015, parent=g)
    box(f"{name}_Top", (width - 2 * t, d_in, t), (0, -d_in / 2, height - t / 2), mat, COL,
        bevel=0.001, parent=g)
    box(f"{name}_Bottom", (width - 2 * t, d_in, t), (0, -d_in / 2, toe + t / 2), mat, COL,
        bevel=0.001, parent=g)
    box(f"{name}_Back", (width - 2 * t, 0.006, height - toe), (0, -0.003, toe + (height - toe) / 2),
        mat, COL, bevel=0.0, parent=g)
    # dark interior void behind the reveals
    box(f"{name}_Interior_Shadow", (width - 2 * t - 0.002, 0.01, height - toe - 2 * t - 0.002),
        (0, -d_in + 0.03, toe + (height - toe) / 2), L.felt, COL, bevel=0.0, parent=g)
    if toe > 0:
        box(f"{name}_ToeKick", (width - 0.002, 0.004, toe - 0.004), (0, -depth + 0.06, toe / 2),
            toe_mat or L.alu_brushed, COL, bevel=0.001, parent=g)
        box(f"{name}_ToeKick_Void", (width - 0.004, depth - 0.08, toe - 0.01), (0, -depth / 2 + 0.01, toe / 2),
            L.felt, COL, bevel=0.0, parent=g)
        for sx in (-1, 1):
            for sy in (0.08, depth - 0.12):
                cylinder(f"{name}_Leveler", 0.015, toe - 0.01, (sx * (width / 2 - 0.06), -sy, (toe - 0.01) / 2),
                         L.plastic_black, COL, verts=12, parent=g)


def drawer_stack(g, name, width, depth, z0, z1, ratios, L, front_mat=None, pull_mat=None,
                 lock=True):
    front_mat = front_mat or L.cab
    total = z1 - z0
    n = len(ratios)
    avail = total - GAP * (n + 1)
    s = sum(ratios)
    z = z1 - GAP
    for i, r in enumerate(ratios):
        h = avail * r / s
        zc = z - h / 2
        box(f"{name}_Drawer_Front", (width - 2 * GAP, FRONT_T, h),
            (0, -depth + FRONT_T / 2, zc), front_mat, COL, bevel=0.0018, segments=2, parent=g)
        # drawer box side visible in the reveal (galvanised)
        box(f"{name}_Drawer_Box", (width - 0.06, 0.004, h - 0.03), (0, -depth + FRONT_T + 0.004, zc),
            L.galv, COL, bevel=0.0, parent=g)
        plen = min(width - 0.10, 0.62)
        pull_bar(g, f"{name}_Drawer_Pull", plen, 0, z - 0.035 if h > 0.09 else zc, -depth, L,
                 mat=pull_mat)
        if lock and i == 0:
            lock_cylinder(g, name, width / 2 - 0.05, z - 0.035, -depth, L)
        z -= h + GAP


def door_pair(g, name, width, depth, z0, z1, L, front_mat=None, pull_mat=None, single=False,
              pull_len=0.30, pull_top=True, lock=True):
    front_mat = front_mat or L.cab
    h = z1 - z0 - 2 * GAP
    zc = (z0 + z1) / 2
    n = 1 if single or width < 0.5 else 2
    dw = (width - GAP * (n + 1)) / n
    for i in range(n):
        xc = -width / 2 + GAP + dw / 2 + i * (dw + GAP)
        box(f"{name}_Door", (dw, FRONT_T, h), (xc, -depth + FRONT_T / 2, zc), front_mat, COL,
            bevel=0.0018, segments=2, parent=g)
        # pull near the meeting edge
        px = xc + (dw / 2 - 0.045) * (1 if i == 0 and n == 2 else -1 if n == 2 else 1)
        if n == 1:
            px = xc + dw / 2 - 0.045
        pz = (z1 - GAP - 0.04 - pull_len / 2) if pull_top else (z0 + GAP + 0.04 + pull_len / 2)
        pull_bar(g, f"{name}_Door_Pull", pull_len, px, pz, -depth, L, vertical=True, mat=pull_mat)
    if lock:
        lock_cylinder(g, f"{name}_Door", (0.03 if n == 2 else width / 2 - 0.05),
                      (z1 - 0.06 if pull_top else z0 + 0.06), -depth, L)


# ---------------------------------------------------------------- modules

def base_module(kind, name, width, L, loc, rotz, depth=C.CAB_DEPTH, height=C.CAB_BASE_H,
                front_mat=None, pull_mat=None, carcass_mat=None, toe_mat=None, col=COL):
    g = group(name, col, loc=loc, rot=(0, 0, rotz))
    z0, z1 = C.CAB_TOE, height
    if kind == "open_bench":
        # open knee space: two end panels + back + shelf rail
        for s in (-1, 1):
            box(f"{name}_End_Panel", (0.02, depth - 0.02, height), (s * (width / 2 - 0.01), -(depth - 0.02) / 2, height / 2),
                carcass_mat or L.cab_carcass, COL, bevel=0.002, parent=g)
        box(f"{name}_Back_Panel", (width - 0.04, 0.012, height - 0.1), (0, -0.006, height / 2 + 0.05),
            carcass_mat or L.cab_carcass, COL, bevel=0.001, parent=g)
        box(f"{name}_Apron_Rail", (width - 0.04, 0.03, 0.06), (0, -depth + 0.04, height - 0.03),
            carcass_mat or L.cab_carcass, COL, bevel=0.002, parent=g)
        # power strip under the bench
        box(f"{name}_Power_Strip", (0.45, 0.04, 0.04), (0, -0.04, height - 0.09), L.alu_brushed, COL,
            bevel=0.004, parent=g)
        for i in range(6):
            box(f"{name}_Power_Strip_Outlet", (0.025, 0.003, 0.03), (-0.17 + i * 0.068, -0.061, height - 0.09),
                L.plastic_black, COL, bevel=0.0005, parent=g)
        return g
    carcass(g, name, width, depth, height, L, mat=carcass_mat, toe_mat=toe_mat)
    if kind == "drawer_5":
        drawer_stack(g, name, width, depth, z0, z1, [0.10, 0.10, 0.14, 0.18, 0.22], L, front_mat, pull_mat)
    elif kind == "drawer_3_wide":
        drawer_stack(g, name, width, depth, z0, z1, [0.16, 0.22, 0.30], L, front_mat, pull_mat)
    elif kind == "drawer_2":
        drawer_stack(g, name, width, depth, z0, z1, [0.4, 0.6], L, front_mat, pull_mat)
    elif kind == "door_2":
        zsplit = z1 - 0.15
        drawer_stack(g, f"{name}_Top", width, depth, zsplit, z1, [1.0], L, front_mat, pull_mat, lock=False)
        door_pair(g, name, width, depth, z0, zsplit + GAP, L, front_mat, pull_mat, pull_len=0.25)
    elif kind == "sink":
        zsplit = z1 - 0.15
        # tilt-out false front
        box(f"{name}_False_Front", (width - 2 * GAP, FRONT_T, 0.15 - 2 * GAP),
            (0, -depth + FRONT_T / 2, zsplit + 0.075), front_mat or L.cab, COL, bevel=0.0018, parent=g)
        door_pair(g, name, width, depth, z0, zsplit + GAP, L, front_mat, pull_mat, pull_len=0.25,
                  lock=False)
    elif kind == "wine":
        # walnut fronted beverage fridge slot is handled in furniture
        door_pair(g, name, width, depth, z0, z1, L, front_mat, pull_mat, single=True, pull_len=0.4)
    return g


def tall_module(name, width, L, loc, rotz, depth=C.CAB_DEPTH, height=C.CAB_TALL_H,
                front_mat=None, pull_mat=None):
    g = group(name, COL, loc=loc, rot=(0, 0, rotz))
    carcass(g, name, width, depth, height, L)
    door_pair(g, name, width, depth, C.CAB_TOE, height, L, front_mat, pull_mat,
              pull_len=0.55, pull_top=False)
    # vented upper panel detail: two rows of slots on each door top
    nslot = 6
    for i in range(nslot):
        for s in (-1, 1):
            box(f"{name}_Vent_Slot", (0.06, 0.002, 0.006),
                (s * width / 4, -depth - 0.0005, height - 0.12 - i * 0.016), L.felt, COL, bevel=0.0,
                parent=g)
    return g


def upper_module(name, width, L, loc, rotz, depth=C.CAB_UPPER_DEPTH, height=C.CAB_UPPER_H,
                 front_mat=None, pull_mat=None, led=True):
    g = group(name, COL, loc=loc, rot=(0, 0, rotz))
    t = 0.018
    d_in = depth - FRONT_T - 0.002
    for s in (-1, 1):
        box(f"{name}_Side", (t, d_in, height), (s * (width / 2 - t / 2), -d_in / 2, height / 2),
            L.cab_carcass, COL, bevel=0.0015, parent=g)
    box(f"{name}_Bottom", (width, d_in, t), (0, -d_in / 2, t / 2), L.cab_carcass, COL,
        bevel=0.0015, parent=g)
    box(f"{name}_Top", (width - 2 * t, d_in, t), (0, -d_in / 2, height - t / 2), L.cab_carcass, COL,
        bevel=0.001, parent=g)
    box(f"{name}_Back", (width - 2 * t, 0.006, height), (0, -0.003, height / 2), L.cab_carcass, COL,
        bevel=0.0, parent=g)
    box(f"{name}_Interior_Shadow", (width - 0.04, 0.01, height - 0.04), (0, -d_in + 0.03, height / 2),
        L.felt, COL, bevel=0.0, parent=g)
    # doors with pulls along the bottom edge (horizontal)
    n = 1 if width < 0.5 else 2
    dw = (width - GAP * (n + 1)) / n
    for i in range(n):
        xc = -width / 2 + GAP + dw / 2 + i * (dw + GAP)
        box(f"{name}_Door", (dw, FRONT_T, height - 2 * GAP), (xc, -depth + FRONT_T / 2, height / 2),
            front_mat or L.cab, COL, bevel=0.0018, parent=g)
        plen = min(dw - 0.10, 0.25)
        px = xc + (dw / 2 - 0.05 - plen / 2) * (1 if i == 0 and n == 2 else -1 if n == 2 else 0)
        pull_bar(g, f"{name}_Door_Pull", plen, px, 0.04, -depth, L, mat=pull_mat)
    if led:
        m = xform(loc, (0, 0, rotz))
        lighting.led_strip(f"{name}_UnderCab_LED",
                           m @ Vector((-width / 2 + 0.03, -depth + 0.06, -0.008)),
                           m @ Vector((width / 2 - 0.03, -depth + 0.06, -0.008)),
                           L, kelvin=C.LIGHT_UNDERCAB_K, lm_per_m=550)
    return g


def countertop(name, x0, x1, L, loc, rotz, depth=C.CAB_DEPTH + 0.025, z=C.CAB_BASE_H,
               style=C.COUNTER_STYLE, sink_x=None, col=COL):
    g = group(name, col, loc=loc, rot=(0, 0, rotz))
    w = x1 - x0
    xc = (x0 + x1) / 2
    t = C.CAB_TOP_T
    sw, sd = 0.55, 0.40
    sy = -depth / 2 - 0.02
    if style == "stainless":
        mat = L.stainless
        if sink_x is None:
            box(f"{name}_Top", (w, depth, t), (xc, -depth / 2, z + t / 2), mat, col, bevel=0.003,
                segments=3, parent=g)
        else:
            # top in four pieces around a real sink cut-out
            xl, xr = sink_x - sw / 2, sink_x + sw / 2
            yb, yf = sy + sd / 2, sy - sd / 2
            for nm, (a0, a1, b0, b1) in (("Left", (x0, xl, -depth, 0.0)), ("Right", (xr, x1, -depth, 0.0)),
                                         ("Back", (xl, xr, yb, 0.0)), ("Front", (xl, xr, -depth, yf))):
                box(f"{name}_Top_{nm}", (a1 - a0, b1 - b0, t), ((a0 + a1) / 2, (b0 + b1) / 2, z + t / 2), mat, col,
                    bevel=0.002, segments=2, parent=g, share=False)
        box(f"{name}_Backsplash_Lip", (w, 0.012, 0.05), (xc, -0.006, z + t + 0.025), mat, col,
            bevel=0.002, parent=g)
    else:
        box(f"{name}_Top", (w, depth, 0.045), (xc, -depth / 2, z + 0.0225), L.maple_block, col,
            bevel=0.004, segments=3, parent=g)
    if sink_x is not None:
        # undermount stainless sink: bowl walls, drain, gooseneck faucet
        sh = 0.25
        ztop = z + t
        for nm, sz, lc in (
            ("Sink_Wall_Front", (sw, 0.003, sh), (sink_x, sy - sd / 2, ztop - sh / 2)),
            ("Sink_Wall_Back", (sw, 0.003, sh), (sink_x, sy + sd / 2, ztop - sh / 2)),
            ("Sink_Wall_L", (0.003, sd, sh), (sink_x - sw / 2, sy, ztop - sh / 2)),
            ("Sink_Wall_R", (0.003, sd, sh), (sink_x + sw / 2, sy, ztop - sh / 2)),
            ("Sink_Floor", (sw, sd, 0.003), (sink_x, sy, ztop - sh)),
        ):
            box(f"{name}_{nm}", sz, lc, L.stainless_y, col, bevel=0.0, parent=g)
        cylinder(f"{name}_Sink_Drain", 0.045, 0.004, (sink_x, sy, ztop - sh + 0.003), L.chrome, col,
                 verts=32, parent=g)
        # rim seen as a 1 mm lip
        _rim = rounded_rect(sw + 0.01, sd + 0.01, 0.02, 4)
        # faucet: base + gooseneck + spray head + lever
        fx, fy = sink_x, -0.07
        cylinder(f"{name}_Faucet_Base", 0.028, 0.05, (fx, fy, ztop + 0.025), L.chrome, col, verts=32,
                 parent=g)
        pipe(f"{name}_Faucet_Gooseneck", [(fx, fy, ztop + 0.05), (fx, fy, ztop + 0.36),
                                          (fx, fy - 0.20, ztop + 0.36), (fx, fy - 0.20, ztop + 0.25)],
             0.0135, L.chrome, col, sides=20, bend_radius=0.07, parent=g)
        cylinder(f"{name}_Faucet_Spray_Head", 0.017, 0.07, (fx, fy - 0.20, ztop + 0.23), L.chrome, col,
                 verts=24, parent=g)
        pipe(f"{name}_Faucet_Lever", [(fx + 0.03, fy, ztop + 0.12), (fx + 0.09, fy, ztop + 0.15)], 0.006,
             L.chrome, col, sides=12, parent=g)
        cylinder(f"{name}_Soap_Pump", 0.014, 0.10, (fx + 0.12, fy, ztop + 0.05), L.chrome, col, verts=20,
                 parent=g)
    return g


def slatwall(name, x0, x1, z0, z1, L, loc, rotz, col=COL, mat=None):
    """PVC slatwall panel with 3" slot pitch (real T-slot geometry)."""
    g = group(name, col, loc=loc, rot=(0, 0, rotz))
    pitch = 3 * C.IN
    t = 0.019
    slot = 0.012
    depth_slot = 0.010
    prof = [(0.0, 0.0)]
    z = 0.0
    n = int((z1 - z0) / pitch)
    # profile in (outward = -y, up = z) as (x=-y, y=z)
    pts = [(0.0, 0.0), (t, 0.0)]
    for k in range(n):
        zb = k * pitch + pitch - slot
        pts += [(t, zb), (t - depth_slot + 0.004, zb), (t - depth_slot, zb + 0.004),
                (t - depth_slot, zb + slot - 0.004), (t - depth_slot + 0.004, zb + slot),
                (t, zb + slot)]
    top = n * pitch
    pts += [(t, top), (0.0, top)]
    # sweep along local X: profile x -> +Y(side), so negate to put the face at -Y
    prof = [(-px, pz) for (px, pz) in pts]
    profile_sweep(f"{name}_Panel", [(x0, 0.0, z0), (x1, 0.0, z0)], prof, mat or L.plastic_grey, col,
                  parent=g, up_hint=(0, 0, 1), sharp_angle=30)
    # aluminium J-trim top/bottom
    box(f"{name}_Trim_Top", (x1 - x0, 0.022, 0.012), ((x0 + x1) / 2, -0.011, z0 + top + 0.006),
        L.alu_brushed, col, bevel=0.0015, parent=g)
    box(f"{name}_Trim_Bottom", (x1 - x0, 0.022, 0.012), ((x0 + x1) / 2, -0.011, z0 - 0.006),
        L.alu_brushed, col, bevel=0.0015, parent=g)
    g["slot_pitch"] = pitch
    g["z0"] = z0
    return g


# ---------------------------------------------------------------- build

def build(L):
    """Right-wall workshop run (config CAB_RUN), uppers, worktop, slatwall,
    plus storage lockers + refrigerator under the mezzanine."""
    rot = math.radians(-90)       # module -Y (front) faces world -X
    x_wall = C.X1
    y = C.CAB_RUN_Y0
    placements = []
    for i, (kind, w) in enumerate(C.CAB_RUN):
        yc = y + w / 2
        name = f"Cabinet_{i + 1:02d}_{kind.title().replace('_', '')}"
        # module local +X maps to world -Y with rotz=-90: centre placement only
        if kind == "tall_locker":
            tall_module(name, w, L, (x_wall, yc, 0.0), rot)
        else:
            base_module(kind, name, w, L, (x_wall, yc, 0.0), rot)
        placements.append((kind, w, yc))
        y += w + 0.002
    run_end = y
    # worktop over all base modules between the lockers
    bases = [p for p in placements if p[0] != "tall_locker"]
    y_start = bases[0][2] - bases[0][1] / 2
    y_end = bases[-1][2] + bases[-1][1] / 2
    sink = [p for p in placements if p[0] == "sink"]
    # countertop group in world-aligned frame: local x = world -Y, so map coordinates
    ct_loc = (x_wall, 0.0, 0.0)
    sink_local = (-sink[0][2]) if sink else None
    countertop("Workbench_Main_Countertop", -y_end, -y_start, L, ct_loc, rot, sink_x=sink_local)
    # slatwall backsplash between worktop and uppers
    sw_z0 = C.CAB_BASE_H + C.CAB_TOP_T + 0.06
    sw_z1 = C.CAB_UPPER_BOTTOM - 0.03
    slatwall("Slatwall_Workshop", -y_end, -y_start, sw_z0, sw_z1, L, (x_wall, 0.0, 0.0), rot)
    # upper cabinets over every base module except the open bench (tools on slatwall there)
    k = 1
    for kind, w, yc in placements:
        if kind in ("tall_locker",):
            continue
        if kind == "open_bench":
            # extend slatwall to the ceiling of the uppers above the bench
            slatwall("Slatwall_Bench_Upper", -(yc + w / 2), -(yc - w / 2), C.CAB_UPPER_BOTTOM - 0.03,
                     C.CAB_TALL_H, L, (x_wall, 0.0, 0.0), rot)
            continue
        upper_module(f"Cabinet_Upper_{k:02d}", w, L, (x_wall, yc, C.CAB_UPPER_BOTTOM), rot)
        k += 1
    # under the mezzanine on the right wall: 2 storage lockers + fridge alcove
    y = C.MEZZ_FRONT_Y + 0.40
    for i in range(2):
        tall_module(f"Cabinet_Locker_Mezz_{i + 1:02d}", 0.914, L, (x_wall, y + 0.457, 0.0), rot,
                    height=C.CAB_TALL_H)
        y += 0.916
    # stainless refrigerator next to the lockers
    fr = group("Refrigerator_Garage", COL, loc=(x_wall, y + 0.42, 0.0), rot=(0, 0, rot))
    box("Refrigerator_Body", (0.84, 0.74, 1.78), (0, -0.37 - 0.02, 0.89), L.stainless_y, COL,
        bevel=0.012, segments=3, parent=fr)
    box("Refrigerator_Door_Seam", (0.84, 0.002, 0.004), (0, -0.762, 1.12), L.felt, COL, bevel=0.0, parent=fr)
    box("Refrigerator_Door_Split", (0.004, 0.002, 0.66), (0, -0.762, 1.45), L.felt, COL, bevel=0.0, parent=fr)
    for s in (-1, 1):
        pull_bar(fr, "Refrigerator_Handle", 0.55, s * 0.035, 1.45, -0.762, L, vertical=True, mat=L.stainless)
    pull_bar(fr, "Refrigerator_Drawer_Handle", 0.6, 0.0, 1.05, -0.762, L, mat=L.stainless)
    box("Refrigerator_Display", (0.08, 0.002, 0.04), (0.25, -0.763, 1.55), L.plastic_black_gloss, COL,
        bevel=0.0, parent=fr)
    box("Refrigerator_Kick_Grille", (0.8, 0.01, 0.08), (0, -0.74, 0.04), L.plastic_black, COL,
        bevel=0.002, parent=fr)
    return run_end
