# -*- coding: utf-8 -*-
"""Habitation box, roof rack, rear end, and lettering."""
import bpy, bmesh, math
from math import sin, cos, pi, radians
from mathutils import Vector, Matrix, Euler
from lib_build import (D, MB, MATS, add_bevel, shade_auto_smooth, empty, text_obj,
                       M_BODY, M_TRIM, M_GLASS, M_RUBBER, M_METAL, M_AMBER,
                       M_LENS, M_FRAME, M_STEEL, M_DECAL, M_RED, M_GLASS2)

HW = D['w_half']

# --- window and locker schedule (all X ranges are front -> rear) -------------
WIN_SMALL = [  # two stacked light-framed hatches, measured X 0.45..1.03
    (0.45, 1.03, 3.06, 3.38),
    (0.45, 1.03, 2.56, 2.81),
]
WIN_LARGE = [  # saloon windows, common sill / header height
    (-2.02, -1.35, 2.62, 3.28),
    (-2.63, -2.14, 2.62, 3.28),
]
WIN_DOOR = (-4.57, -3.66, 2.62, 3.28)          # glazing inside the entry door
DOOR = (-4.68, -3.56, 1.40, 3.44)              # entry door aperture (left side only)
LOCKERS = [
    (2.40, 1.62, 1.40, 1.98),
    (0.95, 0.48, 1.40, 1.86),
    (0.12, -0.78, 1.40, 1.86),
    (-1.30, -2.24, 1.40, 1.86),
    (-2.45, -3.30, 1.40, 2.00),
]


def _window(b, x0, x1, z0, z1, side, frame_mat=M_TRIM, t=0.035, glass=M_GLASS2,
            frame_depth=0.034):
    """Flush-bonded window.

    The body is a solid extrusion, so the pane has to sit just PROUD of the skin
    (6 mm) with a raised surround lapping over its edges -- which is how these
    composite panels are actually glazed anyway.
    """
    y_in = HW * side
    y_g = (HW + 0.007) * side
    y_f = (HW + frame_depth) * side
    lo_g, hi_g = min(y_in, y_g), max(y_in, y_g)
    lo_f, hi_f = min(y_in, y_f), max(y_in, y_f)
    b.box(x0, x1, lo_g, hi_g, z0, z1, glass)                                  # pane
    lap = 0.014
    b.box(x0 - t, x1 + t, lo_f, hi_f, z1 - lap, z1 + t, frame_mat)            # header
    b.box(x0 - t, x1 + t, lo_f, hi_f, z0 - t, z0 + lap, frame_mat)            # sill
    b.box(x0 - t, x0 + lap, lo_f, hi_f, z0 - t, z1 + t, frame_mat)            # front jamb
    b.box(x1 - lap, x1 + t, lo_f, hi_f, z0 - t, z1 + t, frame_mat)            # rear jamb


def _locker(b, x0, x1, z0, z1, side):
    """Recessed lift-up storage hatch with a flush latch."""
    lo = min(x0, x1)
    hi = max(x0, x1)
    y_o = (HW + 0.004) * side
    y_f = y_o + 0.010 * side
    a, c = min(y_o, y_f), max(y_o, y_f + 0.008 * side)
    t = 0.030
    b.box(lo, hi, a, c, z1 - t, z1, M_TRIM)
    b.box(lo, hi, a, c, z0, z0 + t, M_TRIM)
    b.box(lo, lo + t, a, c, z0, z1, M_TRIM)
    b.box(hi - t, hi, a, c, z0, z1, M_TRIM)
    # flush T-handle latch
    cx = (lo + hi) / 2
    hx = hi - 0.11
    b.box(hx - 0.045, hx + 0.045, min(y_o, y_o + 0.018 * side), max(y_o, y_o + 0.018 * side),
          (z0 + z1) / 2 - 0.045, (z0 + z1) / 2 + 0.045, M_METAL)
    b.cyl(0.022, 0.030, (hx, y_o + 0.026 * side, (z0 + z1) / 2), axis='Y', seg=14, mat=M_STEEL)


# =============================================================================
#  HABITATION BOX
# =============================================================================
def build_box(root):
    bf, br = D['box_front'], D['box_rear']
    bb, bt = D['box_bot'], D['box_top']
    nx = D['nose_tip_x']

    b = MB()
    shell = [
        (bf,  bb),                    # front face, bottom
        (bf,  D['nose_tip_z0']),      # front face, top -> underside of the nose overhang
        (nx,  D['nose_tip_z0']),      # forward along the overhang underside
        (nx,  D['nose_tip_z1']),      # short vertical face at the tip of the nose
        (D['nose_base_z'], bt),       # aerodynamic slope up to the roof line
        (br,  bt),                    # roof
        (br,  bb),                    # rear face
    ]
    b.prism(shell, -HW, HW, M_BODY)

    # --- sandwich-panel seams (subtle, as on the real composite body) --------
    for s in (1, -1):
        y = (HW + 0.0015) * s
        y2 = y + 0.004 * s
        lo, hi = min(y, y2), max(y, y2)
        for sx in (1.45, -0.30, -2.05, -3.75):
            b.box(sx - 0.006, sx + 0.006, lo, hi, bb + 0.02, bt - 0.02, M_BODY)
        b.box(br + 0.02, bf - 0.02, lo, hi, 2.16, 2.166, M_BODY)

    # --- rub rails along the bottom edge -------------------------------------
    for s in (1, -1):
        b.box(br + 0.01, bf - 0.01, (HW - 0.01) * s, (HW + 0.022) * s, bb + 0.02, bb + 0.075, M_TRIM)

    # --- glazing --------------------------------------------------------------
    for s in (1, -1):
        for (x0, x1, z0, z1) in WIN_SMALL:
            _window(b, x0, x1, z0, z1, s, frame_mat=M_FRAME, t=0.040, glass=M_GLASS2)
        for (x0, x1, z0, z1) in WIN_LARGE:
            _window(b, x0, x1, z0, z1, s, frame_mat=M_TRIM, t=0.042, glass=M_GLASS2)
        if s < 0:   # right side has a window where the left side has the door
            _window(b, WIN_DOOR[0], WIN_DOOR[1], WIN_DOOR[2], WIN_DOOR[3], s,
                    frame_mat=M_TRIM, t=0.042, glass=M_GLASS2)

    # --- entry door (left side) ------------------------------------------------
    dx0, dx1, dz0, dz1 = DOOR
    s = 1
    y_o = (HW + 0.006) * s
    b.box(dx0, dx1, HW - 0.004, y_o, dz0, dz1, M_BODY)
    t = 0.020
    b.box(dx0, dx1, HW + 0.004, y_o + 0.008, dz1 - t, dz1, M_TRIM)
    b.box(dx0, dx1, HW + 0.004, y_o + 0.008, dz0, dz0 + t, M_TRIM)
    b.box(dx0, dx0 + t, HW + 0.004, y_o + 0.008, dz0, dz1, M_TRIM)
    b.box(dx1 - t, dx1, HW + 0.004, y_o + 0.008, dz0, dz1, M_TRIM)
    _window(b, WIN_DOOR[0], WIN_DOOR[1], WIN_DOOR[2], WIN_DOOR[3], 1,
            frame_mat=M_TRIM, t=0.042, glass=M_GLASS2)
    b.box(dx1 - 0.14, dx1 - 0.06, y_o, y_o + 0.055, 1.95, 2.28, M_METAL)       # lever handle
    b.tube((dx0 + 0.06, y_o + 0.05, 1.55), (dx0 + 0.06, y_o + 0.05, 2.35), 0.020, 10, M_METAL)
    # fold-out entry step
    b.box(dx0 + 0.10, dx1 - 0.10, HW - 0.02, HW + 0.30, 1.03, 1.09, M_METAL)
    for xx in (dx0 + 0.14, dx1 - 0.14):
        b.tube((xx, HW + 0.26, 1.06), (xx, HW - 0.01, dz0 - 0.01), 0.018, 8, M_METAL)

    # --- lower-body storage lockers --------------------------------------------
    for s in (1, -1):
        for (x0, x1, z0, z1) in LOCKERS:
            if s > 0 and not (x1 > dx1 or x0 < dx0):
                pass
            _locker(b, x0, x1, z0, z1, s)
        # circular service hatches: fills / shore power
        b.cyl(0.115, 0.024, (-2.95, (HW + 0.004) * s, 2.16), axis='Y', seg=26, mat=M_TRIM)
        b.cyl(0.085, 0.020, (-2.95, (HW + 0.014) * s, 2.16), axis='Y', seg=26, mat=M_METAL)
        b.cyl(0.085, 0.022, (1.30, (HW + 0.004) * s, 2.10), axis='Y', seg=22, mat=M_TRIM)
        # awning rail (slim extrusion just under the roof edge)
        b.box(-3.40, 1.45, (HW - 0.005) * s, (HW + 0.042) * s, 3.40, 3.49, M_TRIM)

    # --- service module in the cab / box gap (louvred intake + exhaust bay) -----
    mx0, mx1 = bf + 0.01, D['nose_tip_x'] - 0.06
    b.box(mx0, mx1, -1.14, 1.14, bb, 2.50, M_TRIM)
    for i in range(11):                      # horizontal louvres
        z = 1.34 + i * 0.105
        for s in (1, -1):
            b.box(mx0 + 0.03, mx1 - 0.03, 1.14 * s, (1.14 + 0.022) * s, z, z + 0.055, M_TRIM)
        b.box(mx1, mx1 + 0.022, -1.10, 1.10, z, z + 0.055, M_TRIM)

    ob = b.finish("Box", parent=root, smooth_angle=28)
    add_bevel(ob, width=0.014, segments=3, angle=36)
    return ob


# =============================================================================
#  ROOF RACK OVER THE BOX
# =============================================================================
def build_box_rack(root):
    bt = D['box_top']
    rz = D['rack_box_z']
    x_f, x_b = 2.50, -4.81
    y_r = 1.20
    tr = 0.032
    b = MB()

    n_legs = 9
    leg_xs = [x_f - (x_f - x_b) * i / (n_legs - 1) for i in range(n_legs)]
    for s in (1, -1):
        b.tube((x_f, y_r * s, rz), (x_b, y_r * s, rz), tr, 12, M_TRIM)
        for lx in leg_xs:
            b.tube((lx, y_r * s, bt - 0.01), (lx, y_r * s, rz), 0.026, 10, M_TRIM)
            b.box(lx - 0.075, lx + 0.075, y_r * s - 0.065, y_r * s + 0.065, bt - 0.02, bt + 0.02, M_TRIM)
    b.tube((x_f, -y_r, rz), (x_f, y_r, rz), tr, 12, M_TRIM)
    b.tube((x_b, -y_r, rz), (x_b, y_r, rz), tr, 12, M_TRIM)

    n_cross = 12
    for i in range(1, n_cross):
        cx = x_f - (x_f - x_b) * i / n_cross
        b.tube((cx, -y_r, rz), (cx, y_r, rz), 0.024, 10, M_TRIM)

    # diagonal bracing over the forward bays, as on the reference vehicle
    for i in range(2):
        a = x_f - (x_f - x_b) * i / n_cross
        c = x_f - (x_f - x_b) * (i + 1) / n_cross
        b.tube((a, -y_r + 0.02, rz - 0.012), (c, y_r - 0.02, rz - 0.012), 0.020, 8, M_TRIM)
        b.tube((a, y_r - 0.02, rz - 0.012), (c, -y_r + 0.02, rz - 0.012), 0.020, 8, M_TRIM)

    # roof-edge kerb rails
    for s in (1, -1):
        b.box(x_b - 0.04, x_f + 0.04, (1.25 - 0.05) * s, 1.25 * s, bt, bt + 0.045, M_TRIM)

    ob = b.finish("Roof_rack", parent=root, smooth_angle=30)
    add_bevel(ob, width=0.005, segments=2, angle=40)
    return ob


# =============================================================================
#  REAR END: spare wheel carrier, lamps, ladder
# =============================================================================
def build_rear(root, wheel_mesh):
    """Rear face: upright spare-wheel well, lamp clusters, ladder, tow gear."""
    br, bb, bt = D['box_rear'], D['box_bot'], D['box_top']
    sx, sz = D['spare_x'], D['spare_z']
    R = D['tire_r']
    b = MB()

    # --- spare-wheel well: the wheel stands upright and pokes out the back ----
    wy, wz0, wz1 = 0.245, sz - R - 0.055, sz + R + 0.055
    t = 0.045
    b.box(br - t, br, -wy - 0.09, -wy, wz0 - 0.05, wz1 + 0.05, M_TRIM)     # bezel sides
    b.box(br - t, br, wy, wy + 0.09, wz0 - 0.05, wz1 + 0.05, M_TRIM)
    b.box(br - t, br, -wy - 0.09, wy + 0.09, wz1, wz1 + 0.05, M_TRIM)      # bezel top
    b.box(br - 0.20, br, -wy - 0.06, wy + 0.06, wz0 - 0.09, wz0, M_TRIM)   # well floor
    for zz in (wz0 + 0.10, sz, wz1 - 0.10):                                 # retaining straps
        b.box(br - 0.02, br + 0.02, -wy - 0.02, wy + 0.02, zz - 0.022, zz + 0.022, M_METAL)
    b.tube((br - 0.02, -wy - 0.02, sz), (br - 0.02, wy + 0.02, sz), 0.020, 10, M_METAL)

    # --- tail lamp clusters ---------------------------------------------------
    for s in (1, -1):
        y = 1.06 * s
        b.box(br - 0.055, br, y - 0.090, y + 0.090, 1.42, 1.94, M_TRIM)
        b.box(br - 0.070, br - 0.050, y - 0.074, y + 0.074, 1.72, 1.90, M_RED)
        b.box(br - 0.070, br - 0.050, y - 0.074, y + 0.074, 1.52, 1.68, M_AMBER)
        b.box(br - 0.05, br, y - 0.062, y + 0.062, bt - 0.17, bt - 0.06, M_TRIM)
        b.box(br - 0.064, br - 0.046, y - 0.048, y + 0.048, bt - 0.155, bt - 0.080, M_RED)

    # --- rear access ladder to the roof rack ----------------------------------
    ly = 0.72
    for yy in (ly - 0.19, ly + 0.19):
        b.tube((br - 0.09, yy, 1.36), (br - 0.09, yy, bt + 0.14), 0.024, 10, M_METAL)
        b.tube((br - 0.09, yy, bt + 0.14), (br + 0.28, yy, D['rack_box_z']), 0.024, 10, M_METAL)
    for i in range(8):
        z = 1.52 + i * 0.29
        b.tube((br - 0.09, ly - 0.19, z), (br - 0.09, ly + 0.19, z), 0.018, 8, M_METAL)
    for z in (1.66, 2.96):
        for yy in (ly - 0.19, ly + 0.19):
            b.tube((br, yy, z), (br - 0.09, yy, z), 0.020, 8, M_METAL)

    # --- rear bumper / tow hitch ----------------------------------------------
    b.box(br - 0.14, br + 0.02, -1.22, -0.36, 1.06, 1.32, M_TRIM)
    b.box(br - 0.14, br + 0.02, 0.36, 1.22, 1.06, 1.32, M_TRIM)
    b.box(br - 0.24, br - 0.10, -0.22, 0.22, 1.02, 1.22, M_STEEL)

    ob = b.finish("Rear", parent=root, smooth_angle=30)
    add_bevel(ob, width=0.006, segments=2, angle=40)

    # the spare re-uses the road-wheel mesh, stood upright in the well
    sp = bpy.data.objects.new("Spare_wheel", wheel_mesh)
    sp.location = (sx, 0.0, sz)
    bpy.context.collection.objects.link(sp)
    sp.parent = root
    return ob, sp


# =============================================================================
#  LETTERING
# =============================================================================
def build_decals(root):
    out = []
    # box sides -- maker's name, upper front corner
    out.append(text_obj("Logo_L", "Athina craft", (2.26, HW + 0.006, 3.33),
                        (radians(90), 0, radians(180)), size=0.155, parent=root))
    out.append(text_obj("Logo_R", "Athina craft", (2.26, -(HW + 0.006), 3.33),
                        (radians(90), 0, 0), size=0.155, parent=root))
    # small unit markings low on the body
    for s, rot in ((1, (radians(90), 0, radians(180))), (-1, (radians(90), 0, 0))):
        out.append(text_obj("Mk_f%d" % s, "8x8  EXPEDITION", (1.98, s * (HW + 0.006), 1.62),
                            rot, size=0.050, parent=root))
        out.append(text_obj("Mk_r%d" % s, "TAC-UNIT 03", (-4.12, s * (HW + 0.006), 1.62),
                            rot, size=0.050, parent=root))
    # cab front panel
    out.append(text_obj("Front_txt", "TAC-UNIT", (5.114, 0.62, 2.155),
                        (radians(90), 0, radians(90)), size=0.058, parent=root))
    out.append(text_obj("Front_num", "03", (5.117, 0.62, 2.060),
                        (radians(90), 0, radians(90)), size=0.070, parent=root))
    return out
