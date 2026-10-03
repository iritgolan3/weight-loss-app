"""
Primary structure and building services:
  * W12 mezzanine girder spanning wall-to-wall, carried at mid-span by the
    central HSS post (the "central structural post" called out in the brief),
    with base plate, anchor bolts, cap plate and web stiffeners.
  * W8 mezzanine joists, ledgers.
  * Fire-sprinkler system (E3: fire protection) - riser, main, branch lines,
    upright heads, hangers, concealed heads in the soffit.
  * Ductless mini-split heads (E3: HVAC) with line-set covers.
"""

import math
from . import config as C
from .core import (box, box_between, cylinder, pipe, profile_sweep, prism, group,
                   lathe, rounded_rect, instance)

COL = "STRUCTURE"


def i_profile(d, bf, tf, tw, r=0.0):
    h, b, w = d / 2, bf / 2, tw / 2
    return [(-b, -h), (b, -h), (b, -h + tf), (w, -h + tf), (w, h - tf), (b, h - tf),
            (b, h), (-b, h), (-b, h - tf), (-w, h - tf), (-w, -h + tf), (-b, -h + tf)]


def c_profile(d, bf, tf, tw):
    """C-channel opening toward +x (local)."""
    h = d / 2
    return [(0, -h), (bf, -h), (bf, -h + tf), (tw, -h + tf), (tw, h - tf), (bf, h - tf),
            (bf, h), (0, h)]


GIRDER_D = 12.22 * C.IN
GIRDER_BF = 6.49 * C.IN
GIRDER_TF = 0.38 * C.IN
GIRDER_TW = 0.23 * C.IN
GIRDER_Y = C.MEZZ_FRONT_Y + GIRDER_BF / 2
GIRDER_TOP = C.MEZZ_STEEL_TOP
GIRDER_BOT = GIRDER_TOP - GIRDER_D


def build_girder(L):
    zc = GIRDER_TOP - GIRDER_D / 2
    g = profile_sweep("Mezzanine_Girder_W12", [(C.X0 - 0.12, GIRDER_Y, zc),
                                                (C.X1 + 0.12, GIRDER_Y, zc)],
                      i_profile(GIRDER_D, GIRDER_BF, GIRDER_TF, GIRDER_TW), L.steel_black,
                      COL, bevel=0.0015, up_hint=(0, 0, 1))
    # bearing plates where the girder pockets into the demising walls
    for side, x in (("L", C.X0 + 0.004), ("R", C.X1 - 0.004)):
        box(f"Mezzanine_Girder_Bearing_Plate_{side}", (0.008, 0.30, 0.40),
            (x, GIRDER_Y, zc), L.steel_black, COL, bevel=0.002, share=False)
        for dz in (-0.13, 0.13):
            for dy in (-0.1, 0.1):
                cylinder("Mezzanine_Girder_Embed_Bolt", 0.011, 0.02,
                         (x + (0.012 if side == "L" else -0.012), GIRDER_Y + dy, zc + dz),
                         L.steel_black, COL, rot=(0, math.radians(90), 0), verts=6)
    return g


def build_central_post(L):
    """HSS 6x6x3/8 post at mid-span under the girder."""
    px, py = C.POST_X, GIRDER_Y
    s = C.POST_SIZE
    base_t, cap_t = 0.025, 0.019
    post = group("Mezzanine_Central_Post", COL, loc=(px, py, 0.0))
    h = GIRDER_BOT - cap_t - base_t
    prism("Mezzanine_Central_Post_HSS6x6", rounded_rect(s, s, 0.019, 3), h, L.steel_black,
          COL, loc=(0, 0, base_t), parent=post, bevel=0.0)
    # base plate, grout, anchors
    box("Mezzanine_Central_Post_Base_Plate", (0.356, 0.356, base_t), (0, 0, base_t / 2),
        L.steel_black, COL, bevel=0.003, parent=post)
    for dx in (-0.127, 0.127):
        for dy in (-0.127, 0.127):
            cylinder("Mezzanine_Central_Post_Anchor_Rod", 0.0095, 0.075,
                     (dx, dy, base_t + 0.035), L.galv, COL, verts=12, parent=post)
            lathe("Mezzanine_Central_Post_Anchor_Nut",
                  [(0.0, 0.0), (0.017, 0.0), (0.017, 0.016), (0.0, 0.016)], L.galv, COL,
                  loc=(dx, dy, base_t + 0.004), segments=6, parent=post,
                  share_key="anchor_nut", sharp_angle=20)
            cylinder("Mezzanine_Central_Post_Anchor_Washer", 0.022, 0.004,
                     (dx, dy, base_t + 0.002), L.galv, COL, verts=24, parent=post)
    # cap plate + bolts into the girder bottom flange
    box("Mezzanine_Central_Post_Cap_Plate", (0.30, 0.20, cap_t), (0, 0, GIRDER_BOT - cap_t / 2),
        L.steel_black, COL, bevel=0.003, parent=post)
    for dx in (-0.115, 0.115):
        for dy in (-0.06, 0.06):
            lathe("Mezzanine_Central_Post_Cap_Bolt",
                  [(0.0, 0.0), (0.016, 0.0), (0.016, 0.013), (0.0, 0.013)], L.steel_black, COL,
                  loc=(dx, dy, GIRDER_BOT - cap_t - 0.013), segments=6, parent=post,
                  share_key="cap_bolt", sharp_angle=20)
    # web stiffeners above the post (both sides of the web)
    for sgn in (-1, 1):
        box("Mezzanine_Girder_Web_Stiffener", (0.012, GIRDER_BF / 2 - GIRDER_TW / 2 - 0.004,
                                               GIRDER_D - 2 * GIRDER_TF),
            (0.0, sgn * (GIRDER_TW / 2 + (GIRDER_BF / 2 - GIRDER_TW / 2) / 2), GIRDER_BOT + GIRDER_D / 2),
            L.steel_black, COL, bevel=0.0015, parent=post)
    # floor protection: rubber corner guards on the post (garage practice)
    for k, (dx, dy) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1))):
        box("Mezzanine_Central_Post_Corner_Guard", (0.03, 0.03, 0.9),
            (dx * (s / 2 + 0.003), dy * (s / 2 + 0.003), base_t + 0.47),
            L.rubber, COL, bevel=0.006, parent=post)
    return post


def build_joists(L):
    d, bf, tf, tw = 8.0 * C.IN, 5.25 * C.IN, 0.33 * C.IN, 0.23 * C.IN
    zc = C.MEZZ_STEEL_TOP - d / 2
    y0 = GIRDER_Y + GIRDER_TW / 2 + 0.003
    y1 = C.Y1 - 0.01
    n = int(math.ceil(C.WIDTH / C.JOIST_SPACING_MEZZ))
    xs = [C.X0 + C.WIDTH * (i + 0.5) / n for i in range(n)]
    proto = None
    for x in xs:
        if proto is None:
            proto = profile_sweep("Mezzanine_Joist_W8", [(x, y0, zc), (x, y1, zc)],
                                  i_profile(d, bf, tf, tw), L.steel_black, COL,
                                  up_hint=(0, 0, 1))
            px = x
        else:
            instance(proto, "Mezzanine_Joist_W8", loc=(x - px, 0, 0), col=COL)
        # shear tab at the girder
        box("Mezzanine_Joist_Shear_Tab", (0.01, 0.10, d - 0.04), (x + 0.012, y0 + 0.05, zc),
            L.steel_black, COL, bevel=0.0015)
    # rear wall ledger (C10) and side ledgers (L4x4)
    profile_sweep("Mezzanine_Ledger_Rear_C10",
                  [(C.X0, C.Y1 - 0.0, zc), (C.X1, C.Y1 - 0.0, zc)],
                  [(x_, -y_) for (x_, y_) in c_profile(0.254, 0.07, 0.011, 0.0067)],
                  L.steel_black, COL, up_hint=(0, 0, 1))
    for side, x, sgn in (("L", C.X0, 1), ("R", C.X1, -1)):
        box_between(f"Mezzanine_Ledger_Side_{side}", (min(x, x + sgn * 0.1), y0, C.MEZZ_STEEL_TOP - 0.1),
                    (max(x, x + sgn * 0.1), C.Y1, C.MEZZ_STEEL_TOP), L.steel_black, COL,
                    bevel=0.002, share=False)


# ---------------------------------------------------------------- sprinklers

def build_sprinklers(L):
    z_main = C.DECK_Z - C.JOIST_DEPTH - 0.11
    xm = 0.85
    r_main, r_branch = 0.030, 0.0167
    red = L.steel_red
    # riser at the front-right corner
    xr, yr = C.X1 - 0.16, 0.22
    pipe("Sprinkler_Riser", [(xr, yr, 0.0), (xr, yr, z_main), (xm, yr, z_main)], r_main, red,
         COL, sides=16, bend_radius=0.08)
    box("Sprinkler_Riser_Floor_Flange", (0.14, 0.14, 0.02), (xr, yr, 0.01), red, COL, bevel=0.004)
    # control valve trim
    lathe("Sprinkler_Riser_Valve_Body", [(0.0, -0.09), (0.05, -0.09), (0.06, -0.05), (0.065, 0.05),
                                         (0.05, 0.09), (0.0, 0.09)], red, COL,
          loc=(xr, yr, 1.55), segments=24)
    cylinder("Sprinkler_Riser_Valve_Stem", 0.008, 0.20, (xr - 0.12, yr, 1.55), L.steel_bare, COL,
             rot=(0, math.radians(90), 0), verts=12)
    lathe("Sprinkler_Riser_Valve_Handwheel", [(0.07, -0.006), (0.08, 0.0), (0.07, 0.006)],
          red, COL, loc=(xr - 0.22, yr, 1.55), rot=(0, math.radians(90), 0), segments=24)
    lathe("Sprinkler_Riser_Gauge", [(0.0, 0.0), (0.04, 0.0), (0.04, 0.03), (0.0, 0.03)],
          L.chrome, COL, loc=(xr - 0.07, yr, 1.85), rot=(0, -math.radians(90), 0), segments=24)
    cylinder("Sprinkler_Riser_Gauge_Face", 0.036, 0.002, (xr - 0.101, yr, 1.85), L.label_white,
             COL, rot=(0, math.radians(90), 0), verts=24)
    box("Sprinkler_Riser_Flow_Switch", (0.10, 0.08, 0.14), (xr - 0.07, yr, 2.2), red, COL,
        bevel=0.01)
    box("Sprinkler_Riser_Tag", (0.0008, 0.10, 0.07), (xr - 0.031, yr, 1.30), L.label_white, COL,
        bevel=0.0)
    # main along Y
    pipe("Sprinkler_Main", [(xm, yr, z_main), (xm, C.Y1 - 0.4, z_main)], r_main, red, COL,
         sides=16)
    # branch lines along X with upright heads
    for k, yb in enumerate([1.6, 4.6, 7.6, 10.4, 13.4, 16.4]):
        pipe("Sprinkler_Branch", [(C.X0 + 0.7, yb, z_main), (C.X1 - 0.7, yb, z_main)],
             r_branch, red, COL, sides=12)
        lathe("Sprinkler_Branch_Tee", [(0.0, -0.045), (0.042, -0.045), (0.042, 0.045),
                                       (0.0, 0.045)], red, COL, loc=(xm, yb, z_main),
              rot=(math.radians(90), 0, 0), segments=16, share_key="spr_tee")
        for xh in (-3.05, 0.0, 3.05):
            _upright_head(L, xh, yb, z_main + r_branch)
        # hangers (threaded rod + clevis) from the joists
        for xh in (-2.6, 2.4):
            pipe("Sprinkler_Hanger_Rod", [(xh, yb, z_main + r_branch), (xh, yb, C.DECK_Z - C.JOIST_DEPTH)],
                 0.0048, L.galv, COL, sides=6, cap=True)
            lathe("Sprinkler_Hanger_Clevis", [(r_branch + 0.004, -0.012), (r_branch + 0.008, 0.0),
                                              (r_branch + 0.004, 0.012)], L.galv, COL,
                  loc=(xh, yb, z_main), rot=(0, math.radians(90), 0), segments=16,
                  share_key="clevis")
    # concealed pendant heads in the mezzanine soffit (white cover plates)
    for x in (-3.4, -1.0, 1.5):
        for y in (12.6, 15.8):
            cylinder("Sprinkler_Concealed_Cover_Plate", 0.040, 0.004,
                     (x, y, C.MEZZ_SOFFIT_Z - 0.002), L.plastic_white, COL, verts=32)


def _upright_head(L, x, y, z):
    g = group("Sprinkler_Head_Upright", COL, loc=(x, y, z))
    lathe("Sprinkler_Head_Body", [(0.0, 0.0), (0.012, 0.0), (0.012, 0.018), (0.008, 0.026),
                                  (0.0, 0.026)], L.brass, COL, segments=16, parent=g,
          share_key="spr_body")
    for s in (-1, 1):
        box("Sprinkler_Head_Frame_Arm", (0.003, 0.004, 0.03), (s * 0.009, 0, 0.04), L.brass, COL,
            bevel=0.0, parent=g)
    cylinder("Sprinkler_Head_Bulb", 0.0025, 0.016, (0, 0, 0.036), L.taillight, COL, verts=8,
             parent=g)
    cylinder("Sprinkler_Head_Deflector", 0.014, 0.0015, (0, 0, 0.056), L.brass, COL, verts=20,
             parent=g)
    return g


# ---------------------------------------------------------------- HVAC

def build_hvac(L):
    """Two ductless mini-split heads (bay + mezzanine) with line-set covers."""
    units = [
        ("HVAC_MiniSplit_Bay", (C.X0 + 0.002, 3.6, 3.85), math.radians(90), 3.85),
        ("HVAC_MiniSplit_Mezzanine", (1.6, C.Y1 - 0.002, C.MEZZ_FFL + 2.05), 0.0, None),
    ]
    for name, loc, rotz, z in units:
        g = group(name, COL, loc=loc, rot=(0, 0, rotz))
        # body: 1.0 x 0.24 deep x 0.32 high, rounded front
        prof = [(0.0, 0.0), (0.0, 0.32), (-0.20, 0.32), (-0.24, 0.27), (-0.24, 0.05),
                (-0.20, 0.0)]
        prism(f"{name}_Body", [(p[0], p[1]) for p in prof], 1.0, L.plastic_white, COL,
              loc=(-0.5, 0.0, 0.0), rot=(math.radians(90), 0, math.radians(90)), parent=g,
              bevel=0.01, segments=3)
        box(f"{name}_Louver", (0.86, 0.06, 0.012), (0, -0.215, 0.03), L.plastic_white, COL,
            bevel=0.004, parent=g, rot=(math.radians(-25), 0, 0))
        box(f"{name}_Outlet_Shadow", (0.88, 0.05, 0.05), (0, -0.19, 0.03), L.plastic_black, COL,
            bevel=0.004, parent=g)
        box(f"{name}_Display", (0.05, 0.002, 0.012), (0.36, -0.241, 0.18), L.neon_white, COL,
            bevel=0.0, parent=g)
        # line-set cover down/up the wall
        box(f"{name}_LineSet_Cover", (0.08, 0.065, 1.2), (0.42, -0.035, 0.9), L.plastic_white,
            COL, bevel=0.006, parent=g)
        box(f"{name}_LineSet_Elbow", (0.10, 0.07, 0.10), (0.42, -0.035, 0.29), L.plastic_white,
            COL, bevel=0.01, parent=g)


def build(L):
    build_girder(L)
    build_central_post(L)
    build_joists(L)
    build_sprinklers(L)
    build_hvac(L)
