"""Sushi Ginza Onodera, New York (461 Fifth Avenue, 2016-2023) - procedural Blender model.

Run:  python build_onodera.py -- <out_dir> [--glb] [--render] [--quick] [--only=<view>]

What the model is based on
  * Street front: Google Street View 2016-2022, rectified with a metre scale
    (bay widths, pier bands, sign band, upper glazing, door, kumiko window screen).
  * Interior: published descriptions (Michelin guide, reviews, the designer's
    and builder's credits): L-shaped single-plank Ise-hinoki counter with 16
    seats, four 4-top tables, a double-height "cathedral" room, Bizen-ware tile
    wall laid in a shoji-like grid behind the counter, hand-applied earthen
    plaster, Oya-stone coping, brushed black granite floor, warm lighting with
    a glowing band behind a wood lattice about 3 m up, a light-wood
    shoji-like cube at the entrance where reservations are checked.
  Interior proportions not covered by those sources are inferred.

Coordinates: metres, Z up. The Fifth Avenue glass line is x = 0, the street is
x < 0 and the room runs east (+x). North is +y.
"""
import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402

import helpers as H  # noqa: E402
from helpers import box, cylinder, lathe, spot, area, point, lattice, bars  # noqa: E402
import props as P  # noqa: E402
import materials  # noqa: E402
import output as O  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else 'out')
DO_RENDER = '--render' in argv
QUICK = '--quick' in argv
ONLY = [a.split('=', 1)[1] for a in argv if a.startswith('--only=')]
os.makedirs(OUT, exist_ok=True)

s = O.reset_scene()
M, I = materials.build(bpy, os.path.join(OUT, 'textures'))
WEB_LIGHTS = []          # simplified light rig for the real-time web viewer


def web_rect(color_k, intensity, w, h, pos, look):
    WEB_LIGHTS.append(dict(type='rect', k=color_k, i=intensity, w=w, h=h, pos=pos, look=look))


def web_point(color_k, intensity, dist, pos):
    WEB_LIGHTS.append(dict(type='point', k=color_k, i=intensity, d=dist, pos=pos))


# ------------------------------------------------------------------ plan
YS, YN = -4.35, 4.35          # inner faces of the side walls (frontage ~9 m)
XF = 0.30                     # inside face of the storefront
XE = 19.0                     # dining room / kitchen wall
XK = 25.0                     # back of kitchen
HR = 7.6                      # double-height ceiling
WT = 0.15                     # wall thickness

# L-shaped counter: long leg along x (guests on the south side facing north),
# short leg at the east end (guests on the east side facing west).
CZ = 0.80                     # counter height
LL_X = (7.0, 15.85)           # long leg extent
LL_Y = (0.90, 1.70)           # long leg slab depth (guest edge at y=0.90)
SL_X = (15.05, 15.85)         # short leg slab width (guest edge at x=15.85)
SL_Y = (1.70, 3.60)
WK_Y = (1.70, 2.45)           # chefs' work top behind the long leg
WK_X = (14.30, 15.05)         # chefs' work top behind the short leg
BK_Y = (3.70, YN)             # back counter against the Bizen wall
LONG_SEATS = [7.45 + i * (15.25 - 7.45) / 11 for i in range(12)]
SHORT_SEATS = [1.30, 2.00, 2.70, 3.40]


def wall(name, a, b, axis, c, h0=0.0, h1=HR, openings=(), mat=None, coll='Shell', t=WT, tile=1.2):
    """Wall along `axis` ('x' or 'y') from a to b at the other coordinate c.
    openings: [(a0, a1, z_top)] door/window holes starting at the floor."""
    mat = mat or M['plaster_light']
    cur = a
    pieces = []
    for (o0, o1, top) in sorted(openings):
        if o0 > cur:
            pieces.append((cur, o0, h0, h1))
        pieces.append((o0, o1, top, h1))
        cur = o1
    if cur < b:
        pieces.append((cur, b, h0, h1))
    for (p0, p1, z0, z1) in pieces:
        if z1 - z0 <= 0:
            continue
        if axis == 'x':
            box(name, (p1 - p0, t, z1 - z0), ((p0 + p1) / 2, c, (z0 + z1) / 2), mat, coll, tile)
        else:
            box(name, (t, p1 - p0, z1 - z0), (c, (p0 + p1) / 2, (z0 + z1) / 2), mat, coll, tile)


# ================================================================== SHELL
box('Floor_granite', (XE - XF, YN - YS, 0.04), ((XF + XE) / 2, 0, -0.02), M['granite'], 'Shell', 1.6)
wall('Cutaway_wall_south', XF, XE, 'x', YS - WT / 2, coll='Cutaway')
# north wall: plaster, with the Bizen tile field added on its face behind the counter
wall('Wall_north', XF, XE, 'x', YN + WT / 2)
KD = (2.55, 3.65, 2.4)        # staff door to the kitchen (north end of the east wall)
RD = (-3.9, -2.9, 2.4)        # guest corridor (restrooms) at the south end
wall('Wall_east', YS, YN, 'y', XE + WT / 2, openings=[RD, KD])
box('Ceiling_plaster', (XE - XF + 0.3, YN - YS + 0.3, 0.08), ((XF + XE) / 2, 0, HR + 0.04), M['plaster_light'], 'Ceiling', 2.0)
# Oya-stone wainscot + coping on the east wall (and coping strip along the south wall)
box('East_oya_wainscot', (0.04, YN - YS, 1.05), (XE - 0.02, 0, 0.525), M['oya'], 'Interior', 0.6)
box('East_oya_coping', (0.07, YN - YS, 0.05), (XE - 0.035, 0, 1.075), M['oya'], 'Interior', 0.6)
box('South_oya_base', (XE - XF, 0.03, 0.12), ((XF + XE) / 2, YS + 0.015, 0.06), M['oya'], 'Interior', 0.6)
# kitchen (closed room behind the east wall)
box('Floor_kitchen', (XK - XE, YN - YS, 0.04), ((XE + XK) / 2, 0, -0.02), M['floor'], 'Shell', 1.0)
wall('Kitchen_wall_back', YS, YN, 'y', XK + WT / 2, mat=M['plaster'], h1=3.2)
wall('Cutaway_kitchen_wall_s', XE, XK, 'x', YS - WT / 2, mat=M['plaster'], h1=3.2, coll='Cutaway')
wall('Kitchen_wall_n', XE, XK, 'x', YN + WT / 2, mat=M['plaster'], h1=3.2)
box('Ceiling_kitchen', (XK - XE, YN - YS, 0.06), ((XE + XK) / 2, 0, 3.2), M['plaster'], 'Ceiling', 1.5)
bars('Kitchen_counters', [(((XE + XK) / 2, YN - 0.35, 0.45), (XK - XE - 0.4, 0.7, 0.9)),
                          (((XE + XK) / 2, YS + 0.35, 0.45), (XK - XE - 0.4, 0.7, 0.9)),
                          (((XE + XK) / 2 + 0.6, 0, 0.45), (3.0, 1.0, 0.9))], M['steel'], 'Kitchen')
area('Kitchen_light', ((XE + XK) / 2, 0, 3.1), 300, size=(4.0, 6.0), k=4000)
# restroom corridor stub behind the south opening
wall('Corridor_wall', XE, XE + 2.0, 'x', RD[1] + WT / 2 + 0.01, mat=M['plaster'], h1=3.2)

# ================================================================== BIZEN TILE WALL
BZ_X = (6.6, 15.85)
BZ_Z = (0.95, 4.35)
box('Bizen_tile_wall', (BZ_X[1] - BZ_X[0], 0.03, BZ_Z[1] - BZ_Z[0]), ((BZ_X[0] + BZ_X[1]) / 2, YN - 0.015, (BZ_Z[0] + BZ_Z[1]) / 2),
    M['bizen_tiles'], 'Counter', 3.0)
box('Bizen_wall_frame_top', (BZ_X[1] - BZ_X[0] + 0.08, 0.08, 0.06), ((BZ_X[0] + BZ_X[1]) / 2, YN - 0.04, BZ_Z[1] + 0.03), M['hinoki'], 'Counter', 1.5)
for x in BZ_X:
    box('Bizen_wall_frame_side', (0.06, 0.08, BZ_Z[1] - BZ_Z[0]), (x, YN - 0.04, (BZ_Z[0] + BZ_Z[1]) / 2), M['hinoki'], 'Counter', 1.5)
# grazing light washing down the tiles
box('Bizen_wash_slot', (BZ_X[1] - BZ_X[0] - 0.1, 0.05, 0.02), ((BZ_X[0] + BZ_X[1]) / 2, YN - 0.1, BZ_Z[1] - 0.02), M['emit_warm'], 'Counter')
area('Bizen_wash', ((BZ_X[0] + BZ_X[1]) / 2, YN - 0.18, BZ_Z[1] - 0.05), 260, size=(BZ_X[1] - BZ_X[0] - 0.2, 0.06), k=2900,
     rot=(math.radians(18), 0, 0))
web_rect(2900, 4, BZ_X[1] - BZ_X[0], 0.2, (11.2, YN - 0.6, 4.2), (11.2, YN - 0.1, 1.0))

# ================================================================== COUNTER (single-plank Ise hinoki)
box('Counter_hinoki_long', (LL_X[1] - LL_X[0], LL_Y[1] - LL_Y[0], 0.09), ((LL_X[0] + LL_X[1]) / 2, (LL_Y[0] + LL_Y[1]) / 2, CZ - 0.045),
    M['hinoki'], 'Counter', 2.4, bevel=0.008, segments=3)
box('Counter_hinoki_short', (SL_X[1] - SL_X[0], SL_Y[1] - SL_Y[0], 0.09), ((SL_X[0] + SL_X[1]) / 2, (SL_Y[0] + SL_Y[1]) / 2, CZ - 0.045),
    M['hinoki'], 'Counter', 2.4, bevel=0.008, segments=3, rot_grain=True)
# raised hinoki lip between guest counter and chefs' work top
box('Counter_lip_long', (WK_X[0] - LL_X[0], 0.05, 0.035), ((LL_X[0] + WK_X[0]) / 2, LL_Y[1] - 0.025, CZ + 0.0175), M['hinoki'], 'Counter', 2.0, bevel=0.004)
box('Counter_lip_short', (0.05, SL_Y[1] - LL_Y[1] + 0.05, 0.035), (SL_X[0] + 0.025, (LL_Y[1] + SL_Y[1]) / 2 - 0.025, CZ + 0.0175), M['hinoki'], 'Counter', 2.0, bevel=0.004)
# body: recessed smoked-oak front, black toe kick, purse hooks
box('Counter_front_long', (LL_X[1] - LL_X[0] - 0.05, 0.05, CZ - 0.19), ((LL_X[0] + LL_X[1]) / 2 - 0.025, LL_Y[0] + 0.22, 0.10 + (CZ - 0.19) / 2), M['oak_dark'], 'Counter', 0.6)
box('Counter_front_short', (0.05, SL_Y[1] - LL_Y[0] - 0.22, CZ - 0.19), (SL_X[1] - 0.22, (LL_Y[0] + 0.22 + SL_Y[1]) / 2, 0.10 + (CZ - 0.19) / 2), M['oak_dark'], 'Counter', 0.6)
box('Counter_toekick_long', (LL_X[1] - LL_X[0] - 0.05, 0.05, 0.10), ((LL_X[0] + LL_X[1]) / 2 - 0.025, LL_Y[0] + 0.27, 0.05), M['black'], 'Counter')
box('Counter_toekick_short', (0.05, SL_Y[1] - LL_Y[0] - 0.27, 0.10), (SL_X[1] - 0.27, (LL_Y[0] + 0.27 + SL_Y[1]) / 2, 0.05), M['black'], 'Counter')
hooks = [((x, LL_Y[0] + 0.19, CZ - 0.17), (0.03, 0.03, 0.012)) for x in LONG_SEATS] + \
        [((SL_X[1] - 0.19, y, CZ - 0.17), (0.03, 0.03, 0.012)) for y in SHORT_SEATS]
bars('Counter_purse_hooks', hooks, M['brass'], 'Counter')
# chefs' work tops (hinoki) on stainless bases; end caps
box('Chef_worktop_long', (WK_X[0] - LL_X[0], WK_Y[1] - WK_Y[0], 0.05), ((LL_X[0] + WK_X[0]) / 2, (WK_Y[0] + WK_Y[1]) / 2, CZ - 0.025), M['hinoki'], 'Counter', 2.0)
box('Chef_worktop_short', (WK_X[1] - WK_X[0], SL_Y[1] - LL_Y[1], 0.05), ((WK_X[0] + WK_X[1]) / 2, (LL_Y[1] + SL_Y[1]) / 2, CZ - 0.025), M['hinoki'], 'Counter', 2.0)
box('Chef_base_long', (WK_X[0] - LL_X[0], WK_Y[1] - WK_Y[0], CZ - 0.11), ((LL_X[0] + WK_X[0]) / 2, (WK_Y[0] + WK_Y[1]) / 2, 0.06 + (CZ - 0.11) / 2), M['steel'], 'Counter')
box('Chef_base_short', (WK_X[1] - WK_X[0], SL_Y[1] - LL_Y[1], CZ - 0.11), ((WK_X[0] + WK_X[1]) / 2, (LL_Y[1] + SL_Y[1]) / 2, 0.06 + (CZ - 0.11) / 2), M['steel'], 'Counter')
box('Counter_end_west', (0.09, WK_Y[1] - LL_Y[0], CZ), (LL_X[0] - 0.045, (LL_Y[0] + WK_Y[1]) / 2, CZ / 2), M['hinoki'], 'Counter', 1.0, bevel=0.006)
box('Counter_end_north', (SL_X[1] - WK_X[0], 0.09, CZ), ((WK_X[0] + SL_X[1]) / 2, SL_Y[1] + 0.045, CZ / 2), M['hinoki'], 'Counter', 1.0, bevel=0.006)
# chefs' raised wooden floor
box('Floor_chef_long', (WK_X[1] - LL_X[0] + 0.3, YN - LL_Y[1], 0.06), ((LL_X[0] - 0.3 + WK_X[1]) / 2, (LL_Y[1] + YN) / 2, 0.03), M['oak_dark'], 'Counter', 0.8)

# --- itamae stations (three along the long leg, one at the short leg)
wy = (WK_Y[0] + WK_Y[1]) / 2
stations = [(8.6, wy, 0.0), (11.0, wy, 0.0), (13.3, wy, 0.0), ((WK_X[0] + WK_X[1]) / 2, 2.85, math.pi / 2)]
fishes = ['tuna', 'toro', 'white_fish', 'salmon', 'tuna', 'toro']
for i, (sx, sy, rz) in enumerate(stations):
    parts = []
    parts.append(box(f'St{i}_manaita', (0.72, 0.36, 0.03), (0, 0.02, 0.015), M['hinoki'], 'Chef', 0.5, bevel=0.004))
    parts.append(cylinder(f'St{i}_ohitsu', 0.16, 0.15, (-0.6, 0.1, 0.075), M['hinoki'], 'Chef', seg=40, tile=0.3))
    for hz in (0.035, 0.115):
        parts.append(cylinder(f'St{i}_hoop', 0.163, 0.012, (-0.6, 0.1, hz), M['brass'], 'Chef', seg=40, cap=False))
    parts.append(cylinder(f'St{i}_lid', 0.165, 0.02, (-0.6, 0.1, 0.16), M['hinoki'], 'Chef', seg=40, tile=0.3))
    parts.append(lathe(f'St{i}_tezu', [(0, 0), (0.05, 0), (0.07, 0.05), (0.065, 0.05), (0.045, 0.006), (0, 0.006)], (0.48, 0.16, 0), M['ceramic_white'], 'Chef'))
    parts.append(box(f'St{i}_blade', (0.27, 0.035, 0.003), (0.05, -0.08, 0.032), M['steel'], 'Chef', 0.2))
    parts.append(box(f'St{i}_handle', (0.13, 0.022, 0.02), (0.25, -0.08, 0.04), M['hinoki_raw'], 'Chef', 0.2, bevel=0.004))
    for k in range(3):
        parts.append(box(f'St{i}_netabako', (0.24, 0.16, 0.06), (-0.15 + k * 0.26, 0.27, 0.03), M['hinoki'], 'Chef', 0.4, bevel=0.003))
    parts.append(lathe(f'St{i}_wasabi', [(0, 0), (0.025, 0), (0.02, 0.02), (0, 0.025)], (0.3, 0.05, 0.03), M['wasabi'], 'Chef'))
    st = P.join(parts, f'Chef_station_{i}')
    st.location = (sx, sy, CZ)
    st.rotation_euler = (0, 0, rz)
    for k in range(2):
        nx = sx - 0.1 + k * 0.08 if rz == 0 else sx
        ny = sy + 0.03 if rz == 0 else sy - 0.1 + k * 0.08
        P.nigiri(f'Chef_nigiri_{i}_{k}', (nx, ny, CZ + 0.03), M, fishes[(i + k) % 6], 'Chef', rot=0.1 + rz)

# ================================================================== BACK COUNTER (refrigerated, wood-fronted)
bx0, bx1 = BZ_X[0], WK_X[0]
box('Back_cabinets', (bx1 - bx0, BK_Y[1] - BK_Y[0], 0.84), ((bx0 + bx1) / 2, (BK_Y[0] + BK_Y[1]) / 2, 0.06 + 0.42), M['oak_light'], 'Back', 0.7)
n_doors = 12
rev, pulls = [], []
for i in range(n_doors + 1):
    x = bx0 + i * (bx1 - bx0) / n_doors
    rev.append(((x, BK_Y[0] - 0.001, 0.48), (0.006, 0.006, 0.80)))
for i in range(n_doors):
    x = bx0 + (i + 0.5) * (bx1 - bx0) / n_doors
    pulls.append(((x, BK_Y[0] - 0.008, 0.82), (0.14, 0.012, 0.012)))
bars('Back_reveals', rev, M['black'], 'Back')
bars('Back_pulls', pulls, M['brass'], 'Back')
box('Back_counter_top', (bx1 - bx0 + 0.02, BK_Y[1] - BK_Y[0] + 0.02, 0.04), ((bx0 + bx1) / 2, (BK_Y[0] + BK_Y[1]) / 2 - 0.01, 0.92), M['oak_dark'], 'Back', 0.8)
# ceramics, sake bottles and stacks of Bizen plates on the back counter
rnd = random.Random(3)
for x in [bx0 + 0.3 + k * 0.38 for k in range(int((bx1 - bx0 - 0.4) / 0.38))]:
    kind = rnd.random()
    yy = BK_Y[0] + 0.35
    if kind < 0.35:
        lathe('Back_tokkuri', [(0, 0), (0.045, 0), (0.06, 0.06), (0.055, 0.12), (0.02, 0.17), (0.018, 0.2), (0.0, 0.2)],
              (x + rnd.uniform(-.05, .05), yy, 0.94), M['plate_dark'], 'Back')
    elif kind < 0.6:
        col = M['glass'] if rnd.random() < 0.4 else M['ceramic_dark']
        lathe('Back_sake', [(0, 0), (0.04, 0), (0.042, 0.2), (0.016, 0.26), (0.014, 0.31), (0.0, 0.31)],
              (x + rnd.uniform(-.05, .05), yy, 0.94), col, 'Back')
    elif kind < 0.85:
        for k in range(rnd.randint(2, 5)):
            cylinder('Back_plates', 0.11, 0.015, (x, yy, 0.95 + k * 0.017), M['plate_dark'], 'Back', seg=32)
    else:
        box('Back_hinoki_box', (0.3, 0.2, 0.08), (x, yy, 0.98), M['hinoki'], 'Back', 0.4, bevel=0.003)

# ================================================================== CANOPY over the L (hinoki lattice, glowing)
CANZ = 3.0
canopy_rects = [((LL_X[0] - 0.2, 16.1), (0.35, 3.25)),      # long part
                ((14.1, 16.9), (3.25, 4.0))]                # short part, northern end
for j, ((cx0, cx1), (cy0, cy1)) in enumerate(canopy_rects):
    box(f'Ceiling_canopy_board_{j}', (cx1 - cx0, cy1 - cy0, 0.03), ((cx0 + cx1) / 2, (cy0 + cy1) / 2, CANZ + 0.16), M['hinoki_ceiling'], 'Ceiling', 1.5)
    n = int((cy1 - cy0) / 0.085)
    bars(f'Ceiling_canopy_slats_{j}', [(((cx0 + cx1) / 2, cy0 + 0.0425 + k * (cy1 - cy0) / n, CANZ + 0.1), (cx1 - cx0, 0.032, 0.09)) for k in range(n)],
         M['hinoki_ceiling'], 'Ceiling', 1.5)
    # fascia
    bars(f'Ceiling_canopy_fascia_{j}', [(((cx0 + cx1) / 2, cy0, CANZ + 0.09), (cx1 - cx0, 0.03, 0.18)), (((cx0 + cx1) / 2, cy1, CANZ + 0.09), (cx1 - cx0, 0.03, 0.18)),
                                        ((cx0, (cy0 + cy1) / 2, CANZ + 0.09), (0.03, cy1 - cy0, 0.18)), ((cx1, (cy0 + cy1) / 2, CANZ + 0.09), (0.03, cy1 - cy0, 0.18))],
         M['hinoki_ceiling'], 'Ceiling', 1.5)
    # glow on top of the canopy, onto the tall ceiling
    box(f'Ceiling_canopy_glow_{j}', (cx1 - cx0 - 0.1, cy1 - cy0 - 0.1, 0.005), ((cx0 + cx1) / 2, (cy0 + cy1) / 2, CANZ + 0.18), M['emit_soft'], 'Ceiling')
    area(f'Canopy_up_{j}', ((cx0 + cx1) / 2, (cy0 + cy1) / 2, CANZ + 0.25), 260 * (cx1 - cx0) * (cy1 - cy0) / 20, size=(cx1 - cx0, cy1 - cy0), k=2800, rot=(math.pi, 0, 0))
    for x in (cx0 + 0.2, cx1 - 0.2):
        for y in (cy0 + 0.2, cy1 - 0.2):
            cylinder('Ceiling_canopy_rod', 0.006, HR - CANZ - 0.18, (x, y, (HR + CANZ + 0.18) / 2), M['black'], 'Ceiling', seg=8)
# pin-spots: one per guest plate, plus work lights
dl = []
for i, x in enumerate(LONG_SEATS):
    dl.append((x, LL_Y[0] + 0.25))
    spot(f'Spot_seat_L{i}', (x, LL_Y[0] + 0.25, CANZ + 0.05), 45, size_deg=26, blend=0.5, k=3000, radius=0.02)
for i, y in enumerate(SHORT_SEATS):
    dl.append((SL_X[1] - 0.25, y))
    spot(f'Spot_seat_S{i}', (SL_X[1] - 0.25, y, CANZ + 0.05), 45, size_deg=26, blend=0.5, k=3000, radius=0.02)
for i, (sx, sy, rz) in enumerate(stations):
    dl.append((sx, sy))
    spot(f'Spot_station_{i}', (sx, sy, CANZ + 0.05), 70, size_deg=40, blend=0.6, k=3200, radius=0.02)
area('Chef_aisle_fill', (11.0, 3.1, CANZ), 140, size=(8.0, 0.6), k=3000)
bars('Ceiling_downlight_cans', [((x, y, CANZ + 0.035), (0.07, 0.07, 0.03)) for (x, y) in dl], M['black'], 'Ceiling')
bars('Ceiling_downlight_lenses', [((x, y, CANZ + 0.018), (0.045, 0.045, 0.004)) for (x, y) in dl], M['emit_soft'], 'Ceiling')
web_rect(3000, 10, LL_X[1] - LL_X[0], 0.5, (11.4, LL_Y[0] + 0.25, CANZ), (11.4, LL_Y[0] + 0.25, 0))
web_rect(3000, 10, 0.5, SL_Y[1] - LL_Y[0], (SL_X[1] - 0.25, 2.25, CANZ), (SL_X[1] - 0.25, 2.25, 0))
web_rect(3200, 6, 7.5, 1.2, (11.0, 2.4, CANZ), (11.0, 2.4, 0))
web_rect(2800, 3, 9.0, 2.6, (11.4, 1.8, CANZ + 0.3), (11.4, 1.8, HR))

# ================================================================== GLOWING LATTICE BAND (south wall, ~3 m up)
GB_X = (1.2, XE - 0.3)
GB_Z = (2.85, 3.35)
box('Band_backlight', (GB_X[1] - GB_X[0], 0.02, GB_Z[1] - GB_Z[0]), ((GB_X[0] + GB_X[1]) / 2, YS + 0.01, (GB_Z[0] + GB_Z[1]) / 2), M['washi_glow'], 'Interior', 0.6)
lattice('Band_lattice', 'y', YS + 0.06, GB_X, GB_Z, int((GB_X[1] - GB_X[0]) / 0.06), 2, t=0.02, d=0.04, mat=M['hinoki'], coll='Interior')
box('Band_shelf', (GB_X[1] - GB_X[0], 0.14, 0.03), ((GB_X[0] + GB_X[1]) / 2, YS + 0.07, GB_Z[0] - 0.015), M['hinoki'], 'Interior', 1.0)
area('Band_glow', ((GB_X[0] + GB_X[1]) / 2, YS + 0.25, (GB_Z[0] + GB_Z[1]) / 2), 260, size=(GB_X[1] - GB_X[0], 0.4), k=2700,
     rot=(math.radians(-90), 0, 0))
web_rect(2700, 3, GB_X[1] - GB_X[0], 0.5, ((GB_X[0] + GB_X[1]) / 2, YS + 0.2, 3.1), ((GB_X[0] + GB_X[1]) / 2, 0, 3.1))

# high ceiling: grid of small warm recessed downlights
hl = []
for x in [2.0 + k * 2.2 for k in range(8)]:
    for y in (-2.9, -0.6, 2.2):
        if y > 0 and 6.8 < x < 16.5:
            continue           # the canopy takes over above the counter
        hl.append((x, y))
        spot(f'Spot_high_{len(hl)}', (x, y, HR - 0.05), 260, size_deg=22, blend=0.4, k=2900, radius=0.03)
bars('Ceiling_high_cans', [((x, y, HR - 0.015), (0.09, 0.09, 0.03)) for (x, y) in hl], M['black'], 'Ceiling')
bars('Ceiling_high_lenses', [((x, y, HR - 0.032), (0.05, 0.05, 0.004)) for (x, y) in hl], M['emit_soft'], 'Ceiling')
area('Room_fill', (9.5, -1.5, HR - 0.2), 180, size=(16, 4), k=2700)

# ================================================================== GUEST SEATING
for i, x in enumerate(LONG_SEATS):
    P.chair(f'Chair_L{i:02d}', (x, LL_Y[0] - 0.52, 0), math.pi, M)
    P.setting(f'Seat_L{i:02d}', x, LL_Y[0] + 0.24, CZ, M)
for i, y in enumerate(SHORT_SEATS):
    P.chair(f'Chair_S{i:02d}', (SL_X[1] + 0.52, y, 0), -math.pi / 2, M)
    P.setting(f'Seat_S{i:02d}', SL_X[1] - 0.24, y, CZ, M, rot=math.pi / 2)
served = {1: 'toro', 2: 'tuna', 4: 'white_fish', 5: 'tuna', 7: 'salmon', 8: 'toro', 10: 'white_fish'}
for i, f in served.items():
    P.nigiri(f'Served_nigiri_{i}', (LONG_SEATS[i] + 0.02, LL_Y[0] + 0.24, CZ + 0.012), M, f, 'Tableware', rot=0.35)
    lathe(f'Served_gari_{i}', [(0, 0), (0.02, 0.0), (0.012, 0.015), (0, 0.016)], (LONG_SEATS[i] - 0.07, LL_Y[0] + 0.25, CZ + 0.012), M['ginger'], 'Tableware')
for i in (0, 3, 6, 9, 11):
    lathe(f'Sake_guinomi_{i}', [(0, 0), (0.022, 0), (0.03, 0.035), (0.028, 0.036), (0.02, 0.004), (0, 0.004)],
          (LONG_SEATS[i] - 0.2, LL_Y[0] + 0.16, CZ), M['plate_dark'], 'Tableware')
for i in (1, 3):
    P.nigiri(f'Served_nigiri_S{i}', (SL_X[1] - 0.24, SHORT_SEATS[i], CZ + 0.012), M, 'tuna', 'Tableware', rot=math.pi / 2 + 0.3)

# four 4-top tables along the south half of the room
TABLES = [(8.6, -2.85), (10.8, -2.85), (13.0, -2.85), (15.2, -2.85)]
for j, (tx, ty) in enumerate(TABLES):
    box(f'Table_{j}_top', (0.95, 0.95, 0.05), (tx, ty, 0.735), M['hinoki'], 'Tables', 1.5, bevel=0.006)
    box(f'Table_{j}_pedestal', (0.12, 0.12, 0.69), (tx, ty, 0.365), M['oak_dark'], 'Tables', 0.5)
    box(f'Table_{j}_foot', (0.6, 0.6, 0.03), (tx, ty, 0.015), M['oak_dark'], 'Tables', 0.5)
    for k, (dx, dy, r) in enumerate([(-0.25, -0.75, 0), (0.25, -0.75, 0), (-0.25, 0.75, math.pi), (0.25, 0.75, math.pi)]):
        P.chair(f'Table_{j}_chair_{k}', (tx + dx, ty + dy, 0), r, M, coll='Tables')
        P.plate_square(f'Table_{j}_plate_{k}', (tx + dx, ty + dy * 0.36, 0.76), M, coll='Tables')

# ================================================================== FRONT: entry cube, floating island, lounge
# light-wood "shoji cube" just inside the door, where reservations are checked
EC_X = (1.2, 4.2)
EC_Y = (YS + 0.25, -0.95)
EC_H = 2.9
post = 0.09
corners = [(EC_X[0], EC_Y[0]), (EC_X[0], EC_Y[1]), (EC_X[1], EC_Y[0]), (EC_X[1], EC_Y[1])]
bars('Cube_posts', [((x, y, EC_H / 2), (post, post, EC_H)) for (x, y) in corners], M['oak_light'], 'Entrance', 0.6)
bars('Cube_beams', [(((EC_X[0] + EC_X[1]) / 2, y, EC_H - 0.05), (EC_X[1] - EC_X[0], post, 0.1)) for y in EC_Y] +
     [((x, (EC_Y[0] + EC_Y[1]) / 2, EC_H - 0.05), (post, EC_Y[1] - EC_Y[0], 0.1)) for x in EC_X], M['oak_light'], 'Entrance', 0.6)
bars('Cube_roof_slats', [(((EC_X[0] + EC_X[1]) / 2, EC_Y[0] + 0.05 + k * 0.1, EC_H - 0.02), (EC_X[1] - EC_X[0], 0.03, 0.04))
                         for k in range(int((EC_Y[1] - EC_Y[0]) / 0.1))], M['oak_light'], 'Entrance', 0.6)
# panels: west side open toward the door, north side open toward the dining room
CUBE_PANELS = [('y', EC_Y[0] + 0.02, EC_X, 'south'), ('x', EC_X[1], EC_Y, 'east'),
               ('y', EC_Y[1], (EC_X[0], 2.6), 'north-west part'), ('x', EC_X[0], (EC_Y[0], -3.2), 'west-south part')]
for (pl, c, rng, _) in CUBE_PANELS:
    a0, a1 = rng[0] + post / 2, rng[1] - post / 2
    if pl == 'y':
        box('Cube_washi', (a1 - a0, 0.01, EC_H - 0.35), ((a0 + a1) / 2, c, (EC_H - 0.35) / 2 + 0.12), M['washi_glow'], 'Entrance', 0.5)
    else:
        box('Cube_washi', (0.01, a1 - a0, EC_H - 0.35), (c, (a0 + a1) / 2, (EC_H - 0.35) / 2 + 0.12), M['washi_glow'], 'Entrance', 0.5)
    lattice('Cube_kumiko', pl, c, (a0, a1), (0.12, EC_H - 0.23),
            max(2, int((a1 - a0) / 0.3)), 8, t=0.022, d=0.04, mat=M['oak_light'], coll='Entrance')
box('Cube_host_stand', (0.45, 1.1, 1.05), (EC_X[1] - 0.45, (EC_Y[0] + EC_Y[1]) / 2, 0.525), M['hinoki'], 'Entrance', 1.0, bevel=0.006)
box('Cube_host_top', (0.5, 1.15, 0.035), (EC_X[1] - 0.45, (EC_Y[0] + EC_Y[1]) / 2, 1.07), M['oak_dark'], 'Entrance', 0.6)
box('Cube_book', (0.25, 0.32, 0.025), (EC_X[1] - 0.45, (EC_Y[0] + EC_Y[1]) / 2, 1.1), M['lacquer_black'], 'Entrance')
point('Cube_light', ((EC_X[0] + EC_X[1]) / 2, (EC_Y[0] + EC_Y[1]) / 2, 2.4), 140, k=2800, radius=0.4)
web_point(2800, 5, 5, ((EC_X[0] + EC_X[1]) / 2, (EC_Y[0] + EC_Y[1]) / 2, 2.4))

# white birch trunks in a dark glazed urn just inside the door
DOOR_Y = (-3.15, -0.80)
lathe('Entry_urn', [(0, 0), (0.15, 0), (0.2, 0.22), (0.17, 0.5), (0.12, 0.58), (0.0, 0.58)], (0.75, -1.25, 0), M['ceramic_dark'], 'Entrance')
rb = random.Random(11)
birch = []
for k in range(9):
    a = rb.uniform(0, 6.28)
    tilt = rb.uniform(0.03, 0.2)
    L = rb.uniform(2.3, 3.1)
    d = Vector((math.sin(tilt) * math.cos(a), math.sin(tilt) * math.sin(a), math.cos(tilt)))
    st = cylinder(f'Entry_birch_{k}', rb.uniform(0.014, 0.024), L, (0, 0, 0), M['birch'], 'Entrance', seg=8)
    st.location = Vector((0.75, -1.25, 0.45)) + d * (L / 2)
    st.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()

# floating Oya-stone island with a large ikebana, between the front and the counter
box('Island_body', (2.0, 0.9, 0.66), (5.6, -2.3, 0.43), M['oya'], 'Decor', 0.8)
box('Island_coping', (2.06, 0.96, 0.05), (5.6, -2.3, 0.785), M['oya'], 'Decor', 0.8, bevel=0.004)
box('Island_shadow_gap', (1.8, 0.7, 0.1), (5.6, -2.3, 0.05), M['black'], 'Decor')
P.ikebana('Island_ikebana', (5.9, -2.3, 0.81), M, 'Decor', scale=1.6)
for k in range(3):
    lathe(f'Island_bizen_{k}', [(0, 0), (0.07, 0), (0.1, 0.1), (0.06, 0.24), (0.035, 0.3), (0, 0.3)], (4.9 + k * 0.25, -2.35 + 0.12 * (k % 2), 0.81), M['plate_dark'], 'Decor')
spot('Spot_island', (5.6, -2.3, HR - 0.05), 380, size_deg=14, blend=0.5, k=2800)
web_point(2800, 3, 4, (5.6, -2.3, 2.5))

# waiting bench and the kumiko screen behind the window bay (north front)
WIN_Y = (0.40, 3.20)
box('Lounge_bench', (0.5, 2.0, 0.42), (2.8, YN - 0.4, 0.21), M['hinoki'], 'Entrance', 1.0, bevel=0.006, rot=(0, 0, 0))
box('Lounge_bench_long', (2.2, 0.45, 0.42), (3.5, YN - 0.3, 0.21), M['hinoki'], 'Entrance', 1.0, bevel=0.006)

# ================================================================== STREET FRONT (Fifth Avenue, 2021-2023 state)
# Measured from rectified Street View: piers 1.2-1.35 m, window bay ~2.8 m,
# door bay ~2.35 m; black base 0.45 m; sign band 4.0-4.5 m; upper glazing in a
# shallow projecting box to ~7.4 m; stone band with square vents to ~9 m.
LIME = M['facade_stone']
FD = 0.32                     # pier projection in front of the glass line
SIGN_Z = (4.0, 4.5)
TOPZ = 7.45
own_piers = [(3.2, 4.5), (-0.8, 0.4), (-4.5, -3.15)]
own_bays = [(0.4, 3.2, 'window'), (-3.15, -0.8, 'door')]
# the rest of 461 Fifth Avenue's base to the south (former BCBG etc.)
south_piers = [(-7.0 - k * 3.8 - 1.3, -7.0 - k * 3.8) for k in range(2)]
south_bays = [(-7.0, -4.5, 'shop'), (-10.8, -8.3, 'shop')]
piers = own_piers + south_piers
bays = own_bays + south_bays
F_Y = (-12.1, 4.5)
for i, (a, b) in enumerate(piers):
    cy = (a + b) / 2
    box(f'Facade_pier_{i}', (FD, b - a, TOPZ + 0.1), (-FD / 2, cy, (TOPZ + 0.1) / 2), LIME, 'Facade', 1.0)
    box(f'Facade_pier_base_{i}', (FD + 0.03, b - a + 0.02, 0.45), (-FD / 2, cy, 0.225), M['granite'], 'Facade', 0.6)
    z = 0.45 + 0.72
    bands = []
    while z < TOPZ - 0.3:
        band = cylinder(f'Facade_pier_band_{i}', 0.05, b - a, (0, 0, 0), LIME, 'Facade', seg=14)
        band.rotation_euler = (math.pi / 2, 0, 0)
        band.location = (-FD, cy, z)
        bands.append(band)
        z += 0.72
    P.join(bands, f'Facade_pier_bands_{i}')
# stone band with square vents, then the office floors (light greige precast)
box('Facade_band', (FD + 0.08, F_Y[1] - F_Y[0], 1.55), (-(FD + 0.08) / 2, (F_Y[0] + F_Y[1]) / 2, TOPZ + 0.1 + 0.775), LIME, 'Facade', 1.0)
box('Facade_band_lip', (FD + 0.16, F_Y[1] - F_Y[0], 0.1), (-(FD + 0.16) / 2, (F_Y[0] + F_Y[1]) / 2, TOPZ + 0.1 + 1.55), LIME, 'Facade', 1.0, bevel=0.015)
bars('Facade_vents', [((-FD - 0.081, (a + b) / 2, TOPZ + 0.95), (0.01, 0.3, 0.3)) for (a, b, _) in bays], M['charcoal'], 'Facade')
UP0 = TOPZ + 1.75
box('Facade_upper', (0.4, F_Y[1] - F_Y[0], 16.0 - UP0), (-0.2, (F_Y[0] + F_Y[1]) / 2, (16.0 + UP0) / 2), LIME, 'Facade', 1.0)
win = []
for (a, b, _) in bays:
    for fl in range(3):
        z = UP0 + 0.9 + fl * 3.6
        for k in range(2):
            w = (b - a - 0.5) / 2
            y = a + 0.25 + w / 2 + k * (w + 0.0)
            win.append(((-0.41, y, z + 0.95), (0.03, w - 0.1, 1.9)))
bars('Facade_office_windows', win, M['glass_dark'], 'Facade')
bars('Facade_office_mullions', [((-0.43, y, z), (0.03, 0.06, 1.95)) for ((_, y0, z), (__, w, ___)) in win for y in (y0 - w / 2 - 0.03, y0 + w / 2 + 0.03)],
     M['charcoal'], 'Facade')

# black storefront bays
for (a, b, kind) in bays:
    cy = (a + b) / 2
    w = b - a
    fx = -0.05
    frame = [((fx, a + 0.04, TOPZ / 2), (0.12, 0.08, TOPZ)), ((fx, b - 0.04, TOPZ / 2), (0.12, 0.08, TOPZ)),
             ((fx, cy, 0.225), (0.14, w, 0.45)), ((fx, cy, TOPZ - 0.06), (0.14, w, 0.12))]
    bars('Facade_bay_frame', frame, M['black'], 'Facade')
    box('Facade_sign_band', (0.24, w, SIGN_Z[1] - SIGN_Z[0]), (fx - 0.04, cy, (SIGN_Z[0] + SIGN_Z[1]) / 2), M['black'], 'Facade')
    box('Facade_sign_trim', (0.25, w, 0.02), (fx - 0.04, cy, SIGN_Z[1] - 0.01), M['brass'], 'Facade')
    # projecting upper glazing box with angled glass sides
    pz0, pz1 = SIGN_Z[1], TOPZ - 0.12
    proj = 0.22
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in [(-proj, a + 0.25, pz0), (-proj, b - 0.25, pz0), (-proj, b - 0.25, pz1), (-proj, a + 0.25, pz1),
                                    (0.0, a + 0.08, pz0), (0.0, b - 0.08, pz0), (0.0, b - 0.08, pz1), (0.0, a + 0.08, pz1)]]
    for f in [(0, 1, 2, 3), (4, 0, 3, 7), (1, 5, 6, 2)]:
        bm.faces.new([vs[i] for i in f])
    bm.normal_update()
    H.mesh_obj('Facade_upper_glass', bm, M['glass_dark'] if kind == 'shop' else M['glass_store'], 'Facade', 1.0)
    bars('Facade_upper_frame', [((-proj - 0.01, cy, pz0 + 0.02), (0.05, w - 0.5, 0.05)), ((-proj - 0.01, cy, pz1 - 0.02), (0.05, w - 0.5, 0.05)),
                                ((-proj - 0.01, a + 0.25, (pz0 + pz1) / 2), (0.05, 0.05, pz1 - pz0)), ((-proj - 0.01, b - 0.25, (pz0 + pz1) / 2), (0.05, 0.05, pz1 - pz0))],
         M['black'], 'Facade')
    if kind == 'shop':
        box('Facade_shop_glass', (0.02, w - 0.16, SIGN_Z[0] - 0.45), (fx, cy, (0.45 + SIGN_Z[0]) / 2), M['glass_dark'], 'Facade')
        continue
    if kind == 'window':
        box('Facade_window_glass', (0.015, w - 0.16, SIGN_Z[0] - 0.45), (fx, cy, (0.45 + SIGN_Z[0]) / 2), M['glass_store'], 'Facade')
        # pale celadon glass strips at the lower sides, slim mullions
        bars('Facade_celadon', [((fx + 0.02, y, 1.15), (0.02, 0.2, 1.4)) for y in (a + 0.2, b - 0.2)], M['teal'], 'Facade')
        bars('Facade_window_mullions', [((fx, y, (0.45 + SIGN_Z[0]) / 2), (0.08, 0.04, SIGN_Z[0] - 0.45)) for y in (a + 0.32, b - 0.32)], M['black'], 'Facade')
        # hinoki kumiko lattice over a white backing (0.9-1.85 m), beige logo panel below
        kx, kw = 0.16, w - 0.75
        box('Kumiko_backing', (0.01, kw, 0.95), (kx + 0.03, cy, 1.375), M['washi_glow'], 'Facade', 0.6)
        lattice('Kumiko_window_screen', 'x', kx, (cy - kw / 2, cy + kw / 2), (0.9, 1.85), 30, 12, t=0.012, d=0.035, mat=M['hinoki'], coll='Facade')
        box('Kumiko_logo_panel', (0.03, kw, 0.45), (kx, cy, 0.675), M['beige'], 'Facade', 0.8)
    if kind == 'door':
        dz = 2.8
        box('Facade_door_transom', (0.015, w - 0.16, SIGN_Z[0] - dz - 0.06), (fx, cy, (dz + 0.06 + SIGN_Z[0]) / 2), M['glass_store'], 'Facade')
        box('Facade_door_head', (0.1, w, 0.08), (fx, cy, dz), M['brass_dark'], 'Facade')
        side_w = 0.7
        box('Facade_door_sidelight', (0.015, side_w, dz - 0.45), (fx, a + 0.08 + side_w / 2, (0.45 + dz) / 2), M['glass_store'], 'Facade')
        box('Facade_door_mullion', (0.08, 0.05, dz), (fx, a + 0.08 + side_w + 0.025, dz / 2), M['brass_dark'], 'Facade')
        dw = w - 0.16 - side_w - 0.05
        dcy = b - 0.08 - dw / 2
        bars('Facade_door_frame', [((fx, dcy, dz - 0.07), (0.06, dw, 0.06)), ((fx, dcy, 0.08), (0.06, dw, 0.12)),
                                   ((fx, dcy - dw / 2 + 0.03, dz / 2), (0.06, 0.05, dz)), ((fx, dcy + dw / 2 - 0.03, dz / 2), (0.06, 0.05, dz))],
             M['brass_dark'], 'Facade')
        box('Facade_door_glass', (0.012, dw - 0.08, dz - 0.2), (fx, dcy, dz / 2), M['glass_store'], 'Facade')
        # fine bronze mesh laminated behind the door and sidelight glass
        mesh_items = []
        for (m0, m1) in ((a + 0.1, a + 0.08 + side_w - 0.02), (dcy - dw / 2 + 0.06, dcy + dw / 2 - 0.06)):
            for q in range(int((m1 - m0) / 0.05) + 1):
                mesh_items.append(((fx + 0.03, m0 + q * 0.05, (0.5 + dz - 0.1) / 2), (0.004, 0.004, dz - 0.6)))
            for q in range(int((dz - 0.6) / 0.05) + 1):
                mesh_items.append(((fx + 0.03, (m0 + m1) / 2, 0.5 + q * 0.05), (0.004, m1 - m0, 0.004)))
        bars('Facade_door_bronze_mesh', mesh_items, M['brass_dark'], 'Facade')
        # round brass ring pull (~0.4 m) on a vertical brass rod
        ring_y = dcy - dw / 2 + 0.28
        tor = bpy.ops.mesh.primitive_torus_add(major_radius=0.19, minor_radius=0.017, major_segments=48, minor_segments=10,
                                               location=(fx - 0.09, ring_y, 1.15), rotation=(0, math.pi / 2, 0))
        ring = bpy.context.active_object
        ring.name = 'Facade_door_ring_pull'
        for c in ring.users_collection:
            c.objects.unlink(ring)
        H.collection('Facade').objects.link(ring)
        ring.data.materials.append(M['brass'])
        for p in ring.data.polygons:
            p.use_smooth = True
        cylinder('Facade_door_rod', 0.012, 2.1, (fx - 0.06, ring_y, 1.15), M['brass'], 'Facade', seg=12)

# north neighbour: the older, ornamented limestone building (now Muji)
NB_Y = (4.5, 14.0)
box('Neighbour_N_wall', (0.5, NB_Y[1] - NB_Y[0], 16.0), (-0.25 + 0.05, (NB_Y[0] + NB_Y[1]) / 2, 8.0), M['limestone_old'], 'Facade', 1.2)
box('Neighbour_N_shopglass', (0.04, 7.5, 4.2), (-0.21, 9.4, 2.4), M['glass_dark'], 'Facade')
box('Neighbour_N_shopframe', (0.06, 7.7, 0.3), (-0.23, 9.4, 4.55), M['lacquer_red'], 'Facade')
box('Neighbour_N_frieze', (0.12, NB_Y[1] - NB_Y[0], 0.7), (-0.26, (NB_Y[0] + NB_Y[1]) / 2, 5.6), M['limestone_old'], 'Facade', 0.6, bevel=0.02)
bars('Neighbour_N_windows', [((-0.21, y, z), (0.04, 1.3, 2.0)) for y in (6.0, 8.0, 10.5, 12.5) for z in (7.6, 11.2, 14.6)], M['glass_dark'], 'Facade')

# sidewalk, curb, street, street trees, Fifth Ave lamp post
box('Sidewalk', (6.0, 30, 0.14), (-3.0, -1.0, -0.07), M['sidewalk'], 'Street', 1.5)
box('Curb', (0.25, 30, 0.16), (-6.1, -1.0, -0.06), LIME, 'Street', 1.0)
box('Street', (16.0, 30, 0.1), (-14.2, -1.0, -0.19), M['asphalt'], 'Street', 3.0)
bars('Street_lane_marks', [((-12.0, y, -0.135), (0.12, 3.0, 0.01)) for y in (-12, -6, 0, 6, 12)], M['towel'], 'Street')
for (tx, ty, seed) in ((-5.0, -6.3, 5), (-5.0, 7.5, 6)):
    rt = random.Random(seed)
    cylinder('Tree_trunk', 0.11, 3.6, (tx, ty, 1.8), M['branch'], 'Street', seg=10)
    limbs = []
    for k in range(5):
        a = k * 1.3 + rt.uniform(-0.3, 0.3)
        d = Vector((0.55 * math.cos(a), 0.55 * math.sin(a), 0.85)).normalized()
        L = rt.uniform(1.4, 2.0)
        lb = cylinder('Tree_limb', 0.05, L, (0, 0, 0), M['branch'], 'Street', seg=8)
        lb.location = Vector((tx, ty, 3.4)) + d * (L / 2)
        lb.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
        limbs.append(lb)
    P.join(limbs, 'Tree_limbs')
    for g, mat in ((0, M['leaf']), (1, M['leaf_light'])):
        bm = bmesh.new()
        for k in range(70):
            r = rt.uniform(0.22, 0.42)
            ang = rt.uniform(0, 6.28)
            rad = rt.uniform(0.0, 1.9) ** 0.8
            c = Vector((tx + rad * math.cos(ang), ty + rad * math.sin(ang), 4.9 + rt.uniform(-1.0, 1.2) * (1 - rad / 3)))
            geom = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r)
            vs = geom['verts']
            for v in vs:
                v.co *= 1 + rt.uniform(-0.12, 0.12)
            bmesh.ops.translate(bm, vec=c, verts=vs)
        bm.normal_update()
        H.mesh_obj(f'Tree_foliage_{g}', bm, mat, 'Street', 0.3, smooth=True)
    box('Tree_pit', (1.2, 1.2, 0.02), (tx, ty, 0.005), M['charcoal'], 'Street')
cylinder('Lamp_post', 0.07, 7.0, (-5.6, 10.5, 3.5), M['facade_metal'], 'Street', seg=12)
box('Lamp_arm', (1.6, 0.08, 0.08), (-6.3, 10.5, 7.0), M['facade_metal'], 'Street')
box('Lamp_head', (0.5, 0.25, 0.12), (-7.0, 10.5, 6.95), M['facade_metal'], 'Street')


def text(name, body, loc, size, rot, mat, coll='Facade', extrude=0.004, font=None):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    if font and os.path.exists(font):
        cu.font = bpy.data.fonts.load(font)
    ob = bpy.data.objects.new(name, cu)
    H.collection(coll).objects.link(ob)
    ob.location = loc
    ob.rotation_euler = rot
    ob.data.materials.append(mat)
    for o in bpy.context.view_layer.objects:
        o.select_set(o == ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.convert(target='MESH')
    return ob


SERIF = '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'
dcy = (DOOR_Y[0] + DOOR_Y[1]) / 2
szc = (SIGN_Z[0] + SIGN_Z[1]) / 2
text('Facade_sign_small', 'SUSHI GINZA', (-0.216, dcy, szc + 0.13), 0.085, (math.pi / 2, 0, -math.pi / 2), M['gold'], font=SERIF)
text('Facade_sign_big', 'ONODERA', (-0.216, dcy, szc - 0.05), 0.24, (math.pi / 2, 0, -math.pi / 2), M['gold'], font=SERIF)
text('Kumiko_logo_text', 'Onodera New York', (0.1435, 1.8, 0.62), 0.09, (math.pi / 2, 0, -math.pi / 2), M['black'], extrude=0.001,
     font='/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf')
spot('Facade_sign_light', (-1.6, dcy, 6.5), 120, size_deg=50, blend=0.9, k=2700, rot=(0, math.radians(-25), 0))
web_point(2700, 6, 6, (-1.2, -1.0, 4.0))

# ================================================================== WORLD / OUTPUT
O.world(s, (0.012, 0.011, 0.010), 1.0)
O.render_settings(s, samples=24 if QUICK else 110, res=(960, 540) if QUICK else (1600, 900))

VIEWS = {
    'hero':     dict(pos=(6.4, -4.0, 2.5), target=(13.5, 2.2, 1.2), lens=16),
    'counter':  dict(pos=(11.2, -1.75, 1.5), target=(11.2, 4.3, 1.55), lens=15),
    'guest':    dict(pos=(LONG_SEATS[6], LL_Y[0] - 0.45, 1.2), target=(LONG_SEATS[6] + 0.1, 4.3, 1.05), lens=24),
    'chef':     dict(pos=(14.0, 3.15, 1.65), target=(6.5, -0.6, 1.0), lens=17),
    'tables':   dict(pos=(18.4, -2.2, 1.9), target=(3.0, -0.6, 2.3), lens=17),
    'volume':   dict(pos=(18.6, -4.0, 6.2), target=(5.0, 1.0, 2.6), lens=15),
    'overview': dict(pos=(10.5, -13.5, 24.0), target=(10.0, 0.2, 0.0), lens=24, hide=['Ceiling', 'Cutaway']),
    'entrance': dict(pos=(-10.5, -4.6, 1.7), target=(0.0, -0.3, 3.6), lens=22, day=True, exposure=-0.6),
}
cams = {k: O.camera(f'Cam_{k}', v['pos'], v['target'], v['lens']) for k, v in VIEWS.items()}
s.camera = cams['hero']

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'onodera.blend'), compress=True)
print('SAVED blend; objects:', len(bpy.data.objects))

with open(os.path.join(OUT, 'views.json'), 'w') as f:
    json.dump({k: dict(pos=v['pos'], target=v['target'], ceiling=('hide' not in v)) for k, v in VIEWS.items()}, f, indent=1)
with open(os.path.join(OUT, 'lights.json'), 'w') as f:
    json.dump(WEB_LIGHTS, f, indent=1)

if '--glb' in argv:
    O.export_glb(os.path.join(OUT, 'onodera.glb'))

if DO_RENDER:
    os.makedirs(os.path.join(OUT, 'renders'), exist_ok=True)
    for k, v in VIEWS.items():
        if ONLY and k not in ONLY:
            continue
        if v.get('day'):
            O.daylight(s, True)
        O.render(s, cams[k], os.path.join(OUT, 'renders', f'{k}.png'), exposure=v.get('exposure', 0.0), hide=v.get('hide', ()))
        if v.get('day'):
            O.daylight(s, False)
        print('RENDERED', k, flush=True)
