# -*- coding: utf-8 -*-
"""Running gear (wheels, axles, ladder frame) and the cab-over driver's cab."""
import bpy, bmesh, math
from math import sin, cos, pi, radians
from mathutils import Vector, Matrix, Euler
from lib_build import (D, MB, MATS, add_bevel, shade_auto_smooth, empty, text_obj,
                       M_BODY, M_TRIM, M_GLASS, M_RUBBER, M_METAL, M_AMBER,
                       M_LENS, M_FRAME, M_STEEL, M_DECAL)


def arc_band(cx, cz, r_in, r_out, a0, a1, steps=20):
    """Polygon (in XZ) of an annular sector -- used for fenders / wheel arches."""
    pts = [(cx + r_out * cos(a0 + (a1 - a0) * i / steps),
            cz + r_out * sin(a0 + (a1 - a0) * i / steps)) for i in range(steps + 1)]
    pts += [(cx + r_in * cos(a0 + (a1 - a0) * i / steps),
             cz + r_in * sin(a0 + (a1 - a0) * i / steps)) for i in range(steps, -1, -1)]
    return pts


# =============================================================================
#  WHEEL  --  one mesh, instanced eight times
# =============================================================================
def build_wheel_mesh():
    R, W, RR = D['tire_r'], D['tire_w'], D['rim_r']
    hw = W / 2
    b = MB()

    # --- tire carcass: closed cross-section revolved about Y -----------------
    prof = [
        (RR,          -hw),
        (RR,          -hw * 0.90),
        (RR + 0.105,  -hw * 1.01),
        (RR + 0.250,  -hw * 1.09),
        (R - 0.070,   -hw * 0.99),
        (R - 0.028,   -hw * 0.80),
        (R - 0.007,   -hw * 0.47),
        (R,            0.0),
        (R - 0.007,    hw * 0.47),
        (R - 0.028,    hw * 0.80),
        (R - 0.070,    hw * 0.99),
        (RR + 0.250,   hw * 1.09),
        (RR + 0.105,   hw * 1.01),
        (RR,           hw * 0.90),
        (RR,           hw),
    ]
    b.revolve(prof, segments=56, mat=M_RUBBER)

    # --- aggressive military tread (XZL-style chevrons) ----------------------
    N = 30
    for i in range(N):
        a = 2.0 * pi * i / N
        for row, (yc, skew) in enumerate([(0.098, 0.38), (-0.098, -0.38)]):
            ang = a + (pi / N if row else 0.0)
            M = (Matrix.Rotation(ang, 4, 'Y')
                 @ Matrix.Translation(Vector((0.0, yc, R - 0.012)))
                 @ Matrix.Rotation(skew, 4, 'Z')
                 @ Matrix.Diagonal(Vector((0.082, 0.190, 0.062, 1.0))))
            bmesh.ops.create_cube(b.bm, size=1.0, matrix=M)
        # shoulder lugs, offset half a pitch
        for yc in (0.182, -0.182):
            ang = a + pi / (2 * N)
            M = (Matrix.Rotation(ang, 4, 'Y')
                 @ Matrix.Translation(Vector((0.0, yc, R - 0.062)))
                 @ Matrix.Rotation(0.18 * (1 if yc > 0 else -1), 4, 'Z')
                 @ Matrix.Diagonal(Vector((0.075, 0.105, 0.075, 1.0))))
            bmesh.ops.create_cube(b.bm, size=1.0, matrix=M)
    b._tag(M_RUBBER)

    # --- rim: barrel, dish, beadlock ring ------------------------------------
    b.revolve([(RR, -hw * 0.94), (RR, hw * 0.94), (RR - 0.030, hw * 0.94),
               (RR - 0.030, -hw * 0.94)], segments=44, mat=M_METAL)
    b.cyl(RR - 0.015, 0.040, (0, 0.055, 0), axis='Y', seg=44, mat=M_METAL)      # dish face
    b.cyl(0.130, 0.150, (0, 0.120, 0), axis='Y', seg=28, mat=M_METAL)           # hub
    b.cyl(0.098, 0.035, (0, 0.205, 0), axis='Y', seg=24, mat=M_METAL)           # hub cap
    b.revolve([(RR - 0.004, 0.170), (RR + 0.028, 0.170),
               (RR + 0.028, 0.203), (RR - 0.004, 0.203)],
              segments=44, mat=M_METAL)                                          # beadlock ring
    for i in range(10):                                                          # wheel nuts
        a = 2 * pi * i / 10
        b.cyl(0.024, 0.048, (0.172 * sin(a), 0.098, 0.172 * cos(a)),
              axis='Y', seg=6, mat=M_STEEL)
    for i in range(20):                                                          # beadlock bolts
        a = 2 * pi * i / 20 + 0.08
        b.cyl(0.014, 0.030, ((RR + 0.012) * sin(a), 0.205, (RR + 0.012) * cos(a)),
              axis='Y', seg=6, mat=M_STEEL)

    ob = b.finish("Wheel_master", smooth_angle=34)
    return ob


def build_wheels(root):
    master = build_wheel_mesh()
    master.parent = root
    wheels = [master]
    placements = []
    for ax in D['axles']:
        for side in (1, -1):
            placements.append((ax, side))
    master.location = (placements[0][0], D['wheel_y'] * placements[0][1], D['tire_r'])
    master.rotation_euler = Euler((0, 0, 0), 'XYZ')
    master.name = "Wheel_A1_L"
    for idx, (ax, side) in enumerate(placements[1:], start=1):
        ob = bpy.data.objects.new("Wheel_%d_%s" % (idx // 2 + 1, "L" if side > 0 else "R"),
                                  master.data)
        ob.location = (ax, D['wheel_y'] * side, D['tire_r'])
        ob.rotation_euler = Euler((0, radians(180) if side < 0 else 0, 0), 'XYZ')
        bpy.context.collection.objects.link(ob)
        ob.parent = root
        wheels.append(ob)
    return wheels


# =============================================================================
#  LADDER FRAME, AXLES, DRIVELINE, TANKS
# =============================================================================
def build_chassis(root):
    b = MB()
    ft, fb, fy, fw = D['frame_top'], D['frame_bot'], D['frame_y'], D['frame_w']
    x0, x1 = -4.95, 5.05

    # --- two C-section main rails -------------------------------------------
    for s in (1, -1):
        y = fy * s
        b.box(x0, x1, y - fw / 2, y + fw / 2, fb, ft, M_METAL)
        b.box(x0, x1, y - fw / 2 - 0.035, y + fw / 2 + 0.035, ft - 0.045, ft, M_METAL)
        b.box(x0, x1, y - fw / 2 - 0.035, y + fw / 2 + 0.035, fb, fb + 0.045, M_METAL)

    # --- cross members -------------------------------------------------------
    for cx in (4.85, 4.20, 3.05, 1.70, 0.40, -0.90, -2.05, -3.30, -4.60):
        b.box(cx - 0.055, cx + 0.055, -fy - 0.05, fy + 0.05, fb + 0.02, ft - 0.02, M_METAL)

    # --- front bumper mounting horns ----------------------------------------
    for s in (1, -1):
        b.box(4.90, 5.16, fy * s - 0.07, fy * s + 0.07, 1.02, 1.30, M_TRIM)

    # --- axles, hubs, differentials, springs, shocks -------------------------
    for i, ax in enumerate(D['axles']):
        z = D['tire_r']
        b.cyl(0.072, 1.62, (ax, 0.0, z), axis='Y', seg=20, mat=M_METAL)          # beam
        b.cyl(0.205, 0.34, (ax - 0.02, -0.055, z), axis='X', seg=26, mat=M_METAL)  # diff bowl
        b.cyl(0.115, 0.26, (ax + 0.20, -0.055, z), axis='X', seg=18, mat=M_METAL)  # pinion nose
        for s in (1, -1):
            y = D['wheel_y'] * s
            b.cyl(0.165, 0.24, (ax, y - 0.16 * s, z), axis='Y', seg=22, mat=M_METAL)  # hub reduction
            b.cyl(0.108, 0.16, (ax, y - 0.30 * s, z), axis='Y', seg=18, mat=M_METAL)
            # leaf / coil suspension package
            b.box(ax - 0.62, ax + 0.62, 0.50 * s - 0.045, 0.50 * s + 0.045, z + 0.16, z + 0.215, M_METAL)
            b.box(ax - 0.44, ax + 0.44, 0.50 * s - 0.045, 0.50 * s + 0.045, z + 0.215, z + 0.262, M_METAL)
            b.box(ax - 0.28, ax + 0.28, 0.50 * s - 0.045, 0.50 * s + 0.045, z + 0.262, z + 0.310, M_METAL)
            # shock absorber
            b.tube((ax - 0.12, 0.66 * s, z + 0.08), (ax - 0.30, 0.50 * s, ft - 0.03),
                   0.038, seg=12, mat=M_TRIM)
            # brake drum face
            b.cyl(0.215, 0.10, (ax, y - 0.02 * s, z), axis='Y', seg=24, mat=M_TRIM)

    # --- drive shafts --------------------------------------------------------
    shaft_y = -0.055
    segs = [(3.75, 2.18), (2.18, 0.30), (0.30, -1.28), (-1.28, -2.77)]
    for (a, c) in segs:
        b.tube((a - 0.22, shaft_y, D['tire_r'] + 0.02), (c + 0.22, shaft_y, D['tire_r'] + 0.10),
               0.052, seg=14, mat=M_STEEL)

    # --- gearbox / transfer case / engine sump --------------------------------
    b.box(3.05, 4.35, -0.34, 0.30, 0.74, 1.16, M_METAL)      # engine
    b.box(2.05, 3.05, -0.30, 0.26, 0.82, 1.14, M_METAL)      # gearbox
    b.box(1.35, 2.05, -0.34, 0.30, 0.78, 1.12, M_METAL)      # transfer case

    # --- fuel / water tanks, air reservoirs, battery box ----------------------
    for s in (1, -1):
        b.cyl(0.275, 1.45, (0.85, 0.80 * s, 1.00), axis='X', seg=26, mat=M_METAL)     # fuel/water
        b.cyl(0.155, 0.72, (-0.55, 0.72 * s, 0.98), axis='X', seg=20, mat=M_METAL)    # air tank
    b.box(-1.95, -1.15, 0.52, 1.14, 0.90, 1.18, M_TRIM)      # battery / tool box
    b.box(-1.95, -1.15, -1.14, -0.52, 0.90, 1.18, M_TRIM)

    # --- exhaust: engine -> vertical stack behind the cab ---------------------
    b.tube((3.90, 0.30, 0.92), (3.27, 0.86, 1.02), 0.062, seg=14, mat=M_TRIM)
    b.tube((3.27, 0.86, 1.02), (3.21, 1.06, 1.35), 0.062, seg=14, mat=M_TRIM)
    b.tube((3.21, 1.06, 1.35), (3.21, 1.06, 2.86), 0.064, seg=16, mat=M_TRIM)
    b.cyl(0.082, 0.16, (3.21, 1.06, 2.90), axis='Z', seg=16, mat=M_TRIM)

    # --- wheel-arch lips ------------------------------------------------------
    # crown-only lips: the bodywork already covers most of each tire, so a full
    # half-hoop reads as a floating band rather than a fender
    for ax in D['axles']:
        r_in = D['tire_r'] + 0.055
        r_out = r_in + 0.050
        pts = arc_band(ax, D['tire_r'], r_in, r_out, radians(44), radians(136), steps=16)
        for s in (1, -1):
            y_out = (D['wheel_y'] + D['tire_w'] / 2 + 0.030) * s
            y_in = (D['wheel_y'] - D['tire_w'] / 2 - 0.015) * s
            b.prism(pts if s > 0 else pts[::-1], min(y_in, y_out), max(y_in, y_out), M_TRIM)

    # --- mud flaps behind the rear axle of each bogie -------------------------
    for ax in (D['axles'][1], D['axles'][3]):
        for s in (1, -1):
            b.box(ax - 0.78, ax - 0.73, (D['wheel_y'] - 0.21) * s, (D['wheel_y'] + 0.21) * s,
                  0.22, 0.74, M_TRIM)

    ob = b.finish("Chassis", parent=root, smooth_angle=30)
    add_bevel(ob, width=0.008, segments=2, angle=40)
    return ob


# =============================================================================
#  CAB
# =============================================================================
def build_cab(root):
    fb, ft = D['cab_front_b'], D['cab_front_t']
    wst, cr = D['cab_ws_top'], D['cab_rear']
    cb, ct = D['cab_bot'], D['cab_top']
    z0, z1 = D['cab_ws_z0'], D['cab_ws_z1']
    hwd = D['cab_half']

    b = MB()
    # --- shell: side profile extruded across the cab --------------------------
    shell = [
        (fb,   cb),          # front lower corner
        (ft,   z0),          # top of the flat front panel = windshield base
        (wst,  z1),          # windshield header
        (wst - 0.08, ct),    # roof front edge
        (cr + 0.06, ct),     # roof rear edge
        (cr,   ct - 0.08),
        (cr,   cb),          # rear lower corner
    ]
    b.prism(shell, -hwd, hwd, M_BODY)

    # --- windshield ------------------------------------------------------------
    # the shell is a solid extrusion, so the glass is offset along the screen
    # normal instead of being recessed into it
    import math as _m
    dx, dz = wst - ft, z1 - z0
    L = _m.hypot(dx, dz)
    nx, nz = dz / L, -dx / L                       # outward normal of the screen
    def _ws(off, shrink=0.0):
        return ((ft + nx * off + (dx / L) * shrink, z0 + nz * off + (dz / L) * shrink),
                (wst + nx * off - (dx / L) * shrink, z1 + nz * off - (dz / L) * shrink))

    gw = 1.100
    (gx0, gz0_), (gx1, gz1_) = _ws(0.008, 0.045)
    b.plate([(gx0, -gw, gz0_), (gx0, gw, gz0_), (gx1, gw, gz1_), (gx1, -gw, gz1_)], mat=M_GLASS)
    # centre mullion and side pillars, standing proud of the glass
    (fx0, fz0), (fx1, fz1) = _ws(0.030)
    b.prism([(fx0 + 0.012, fz0 + 0.010), (fx1 + 0.012, fz1 - 0.008),
             (fx1 - 0.055, fz1 - 0.008), (fx0 - 0.055, fz0 + 0.010)], -0.024, 0.024, M_TRIM)
    for yy in (gw + 0.026, -gw - 0.026):
        b.prism([(fx0 + 0.010, fz0 + 0.010), (fx1 + 0.010, fz1 - 0.008),
                 (fx1 - 0.055, fz1 - 0.008), (fx0 - 0.055, fz0 + 0.010)],
                yy - 0.026, yy + 0.026, M_TRIM)
    # header and sill mouldings
    b.prism([(fx0 + 0.012, fz0), (fx0 + 0.012, fz0 + 0.048),
             (fx0 - 0.055, fz0 + 0.048), (fx0 - 0.055, fz0)], -gw - 0.052, gw + 0.052, M_TRIM)
    b.prism([(fx1 + 0.010, fz1 - 0.048), (fx1 + 0.010, fz1),
             (fx1 - 0.055, fz1), (fx1 - 0.055, fz1 - 0.048)], -gw - 0.052, gw + 0.052, M_TRIM)

    # --- doors: shut lines, glass, handles ------------------------------------
    dx0, dx1 = 3.46, 5.02          # door aperture
    gx0, gx1 = 3.88, 4.72          # drop glass
    gz0, gz1 = 2.24, 2.82
    for s in (1, -1):
        y = hwd * s
        yg = (hwd + 0.007) * s
        yo = (hwd + 0.006) * s
        b.box(dx0, dx1, min(y, y + 0.010 * s), max(y, y + 0.010 * s), cb + 0.05, ct - 0.09, M_BODY)
        b.box(gx0, gx1, min(hwd * s, yg), max(hwd * s, yg), gz0, gz1, M_GLASS)
        t, lap = 0.030, 0.013
        yf = (hwd + 0.030) * s
        lo, hi = min(hwd * s, yf), max(hwd * s, yf)
        b.box(gx0 - t, gx1 + t, lo, hi, gz1 - lap, gz1 + t, M_TRIM)
        b.box(gx0 - t, gx1 + t, lo, hi, gz0 - t, gz0 + lap, M_TRIM)
        b.box(gx0 - t, gx0 + lap, lo, hi, gz0 - t, gz1 + t, M_TRIM)
        b.box(gx1 - lap, gx1 + t, lo, hi, gz0 - t, gz1 + t, M_TRIM)
        # grab handle + door handle
        b.tube((4.28, yo + 0.055 * s, 1.52), (4.28, yo + 0.055 * s, 2.06), 0.020, 10, M_TRIM)
        b.box(3.98, 4.20, min(yo, yo + 0.045 * s), max(yo, yo + 0.045 * s), 1.98, 2.06, M_TRIM)
        # cab steps
        for (zz, xa, xb) in ((0.72, 4.16, 4.66), (0.98, 4.16, 4.66)):
            b.box(xa, xb, min(y, y - 0.30 * s), max(y, y - 0.30 * s), zz, zz + 0.055, M_METAL)
        for xx in (4.20, 4.62):
            b.tube((xx, y - 0.14 * s, 0.72), (xx, y - 0.05 * s, 1.14), 0.020, 8, M_METAL)

    # --- rear-of-cab access ladder + grab rails --------------------------------
    for s in (1, -1):
        y = (hwd + 0.045) * s
        b.tube((3.86, y, 1.18), (3.86, y, 2.80), 0.024, 10, M_METAL)
        b.tube((3.52, y, 1.18), (3.52, y, 2.80), 0.024, 10, M_METAL)
        for zz in (1.42, 1.76, 2.10, 2.44, 2.76):
            b.tube((3.52, y, zz), (3.86, y, zz), 0.018, 8, M_METAL)

    # --- roof drip rails --------------------------------------------------------
    b.box(cr + 0.04, wst - 0.06, -hwd, -hwd + 0.045, ct, ct + 0.032, M_TRIM)
    b.box(cr + 0.04, wst - 0.06, hwd - 0.045, hwd, ct, ct + 0.032, M_TRIM)

    ob = b.finish("Cab", parent=root, smooth_angle=30)
    add_bevel(ob, width=0.014, segments=3, angle=35)
    return ob


def build_cab_details(root):
    """Bull bar, lighting, mirrors, wipers, cab roof rack."""
    hwd = D['cab_half']
    XF, XB = D['bar_front'], D['bar_back']
    BZ0, BZ1, BH = D['bar_z0'], D['bar_z1'], D['bar_half']
    b = MB()

    # =====================  BULL BAR / FRONT BUMPER  =========================
    b.box(XB, XF, -BH, BH, BZ0 + 0.22, BZ1, M_TRIM)              # upper beam (carries the lamps)
    b.box(XB + 0.03, XF - 0.025, -BH, BH, BZ0, BZ0 + 0.22, M_TRIM)  # lower valance
    b.box(XB - 0.12, XB, -1.16, 1.16, BZ0 + 0.10, BZ1 - 0.06, M_TRIM)
    for s in (1, -1):                                             # outer end caps
        b.box(XB - 0.10, XF, BH * s - 0.055, BH * s, BZ0, BZ1, M_TRIM)
    # centre recovery block, pintle hook and shackle mounts
    b.box(XB, XF + 0.04, -0.22, 0.22, BZ0 - 0.08, BZ0 + 0.26, M_TRIM)
    b.cyl(0.072, 0.20, (XF + 0.13, 0.0, BZ0 + 0.06), axis='X', seg=18, mat=M_STEEL)
    b.revolve([(0.052, -0.03), (0.098, -0.03), (0.098, 0.03), (0.052, 0.03)],
              segments=22, mat=M_STEEL, center=(XF + 0.22, 0.0, BZ0 + 0.06), axis='X')
    for s in (1, -1):
        b.box(XF - 0.03, XF + 0.055, 0.38 * s - 0.035, 0.38 * s + 0.035,
              BZ0 + 0.02, BZ0 + 0.20, M_STEEL)
    b.box(XB + 0.02, XF - 0.01, -BH + 0.02, BH - 0.02, BZ1, BZ1 + 0.055, M_TRIM)   # top cap rail
    b.box(XB - 0.30, XF - 0.06, -0.86, 0.86, BZ0 - 0.16, BZ0 - 0.10, M_METAL)      # skid plate
    # winch behind the bar
    b.cyl(0.115, 0.52, (XB - 0.22, 0.0, BZ1 - 0.22), axis='Y', seg=22, mat=M_METAL)
    b.box(XB - 0.38, XB - 0.06, -0.34, 0.34, BZ1 - 0.36, BZ1 - 0.24, M_METAL)

    # =====================  FRONT LIGHTING  ===================================
    # measured from the head-on reference: main lamps at |Y| 0.90, amber at 1.06,
    # four square auxiliary pods low on the bar at |Y| 0.34 and 0.62
    LZ = 1.72
    for s in (1, -1):
        cy = 0.90 * s
        b.box(XF - 0.03, XF + 0.030, cy - 0.115, cy + 0.115, LZ - 0.095, LZ + 0.095, M_TRIM)
        b.box(XF + 0.028, XF + 0.044, cy - 0.098, cy + 0.098, LZ - 0.078, LZ + 0.078, M_LENS)
        cy = 1.06 * s
        b.box(XF - 0.03, XF + 0.030, cy - 0.072, cy + 0.072, LZ - 0.095, LZ + 0.095, M_TRIM)
        b.box(XF + 0.028, XF + 0.044, cy - 0.058, cy + 0.058, LZ - 0.078, LZ + 0.078, M_AMBER)
        for yy in (0.34, 0.62):
            cy = yy * s
            b.box(XF - 0.03, XF + 0.048, cy - 0.070, cy + 0.070, 1.32, 1.46, M_TRIM)
            b.box(XF + 0.046, XF + 0.058, cy - 0.055, cy + 0.055, 1.335, 1.445, M_LENS)

    # =====================  MIRRORS  ==========================================
    for s in (1, -1):
        y0 = (hwd + 0.01) * s
        y1 = 1.40 * s
        b.box(4.74, 4.84, min(y0, y0 + 0.05 * s), max(y0, y0 + 0.05 * s), 2.60, 2.96, M_TRIM)
        b.tube((4.79, y0, 2.90), (4.90, y1, 3.10), 0.034, 12, M_TRIM)
        b.tube((4.90, y1, 3.10), (4.94, y1, 2.52), 0.034, 12, M_TRIM)
        b.tube((4.76, y0, 2.42), (4.92, y1 * 0.98, 2.60), 0.030, 12, M_TRIM)
        b.box(4.86, 5.00, y1 - 0.105, y1 + 0.105, 2.50, 3.26, M_TRIM)     # main head
        b.box(4.852, 4.866, y1 - 0.090, y1 + 0.090, 2.53, 3.23, M_GLASS)
        b.box(4.86, 4.98, 1.26 * s - 0.105, 1.26 * s + 0.105, 2.00, 2.30, M_TRIM)  # wide angle
        b.box(4.852, 4.864, 1.26 * s - 0.090, 1.26 * s + 0.090, 2.02, 2.28, M_GLASS)

    # =====================  WIPERS  ===========================================
    # arm and blade are laid on the screen plane itself, parked low and inboard
    for s in (1, -1):
        piv = (5.124, 0.74 * s, 2.258)
        elb = (5.010, 0.44 * s, 2.480)
        tip = (4.927, 0.20 * s, 2.643)
        b.cyl(0.032, 0.055, (piv[0] - 0.01, piv[1], piv[2]), axis='X', seg=14, mat=M_TRIM)
        b.tube(piv, elb, 0.016, 10, M_TRIM)
        b.tube(elb, tip, 0.011, 8, M_TRIM)
        # rubber blade, sitting a few mm off the glass
        b.tube((5.084, 0.64 * s, 2.300), (4.902, 0.17 * s, 2.655), 0.012, 8, M_TRIM)

    # =====================  CAB ROOF RACK (raised, with the X brace) ==========
    RZ, RT = D['rack_cab_z'], D['rack_cab_top']
    ct = D['cab_top']
    x_f, x_b = 4.72, 3.44
    y_r = 1.10
    tr = 0.030
    legs_x = (x_f, (x_f + x_b) / 2, x_b)
    for s in (1, -1):
        for lx in legs_x:
            b.tube((lx, y_r * s, ct - 0.03), (lx, y_r * s, RZ), tr, 10, M_TRIM)
            b.box(lx - 0.075, lx + 0.075, y_r * s - 0.06, y_r * s + 0.06, ct - 0.03, ct + 0.02, M_TRIM)
        b.tube((x_f, y_r * s, RZ), (x_b, y_r * s, RZ), tr, 12, M_TRIM)   # lower side rail
        b.tube((x_f, y_r * s, RT), (x_b, y_r * s, RT), tr, 12, M_TRIM)   # upper side rail
        b.tube((x_f, y_r * s, RZ), (x_f, y_r * s, RT), tr, 10, M_TRIM)   # corner posts
        b.tube((x_b, y_r * s, RZ), (x_b, y_r * s, RT), tr, 10, M_TRIM)
    for cx in legs_x:
        b.tube((cx, -y_r, RZ), (cx, y_r, RZ), 0.026, 12, M_TRIM)         # deck cross rails
    b.tube((x_f, -y_r, RT), (x_f, y_r, RT), tr, 12, M_TRIM)              # top hoop
    b.tube((x_b, -y_r, RT), (x_b, y_r, RT), tr, 12, M_TRIM)
    for s in (1, -1):                                                     # short verticals
        b.tube((x_f, 0.33 * s, RZ), (x_f, 0.33 * s, RT), 0.024, 10, M_TRIM)
    # the X brace across the front bay
    b.tube((x_f - 0.010, -y_r + 0.02, RZ + 0.02), (x_f - 0.010, y_r - 0.02, RT - 0.02),
           0.023, 8, M_TRIM)
    b.tube((x_f - 0.010, y_r - 0.02, RZ + 0.02), (x_f - 0.010, -y_r + 0.02, RT - 0.02),
           0.023, 8, M_TRIM)
    # roof light bar on the front hoop
    for yy in (-0.82, -0.28, 0.28, 0.82):
        b.box(x_f - 0.055, x_f + 0.050, yy - 0.080, yy + 0.080, RT - 0.070, RT + 0.070, M_TRIM)
        b.box(x_f + 0.046, x_f + 0.060, yy - 0.065, yy + 0.065, RT - 0.056, RT + 0.056, M_LENS)

    ob = b.finish("Cab_details", parent=root, smooth_angle=30)
    add_bevel(ob, width=0.006, segments=2, angle=40)
    return ob
