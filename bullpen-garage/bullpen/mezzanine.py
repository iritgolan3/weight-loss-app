"""
Mezzanine deck, soffit, fascia, guards and the main stair.

The deck sits on the steel framing from structure.py (girder + W8 joists):
19 mm plywood sub-floor + 6 mm oak-look LVP. The underside is a drywall
soffit; the black W12 girder stays exposed at the front edge with the
central post below it.
"""

import math
from . import config as C
from .core import (box, box_between, cylinder, pipe, profile_sweep, prism, group,
                   lathe, rounded_rect, instance)
from .structure import GIRDER_Y, GIRDER_BF, GIRDER_TOP, GIRDER_BOT

COL = "MEZZANINE"


# ---------------------------------------------------------------- guards

def guard_run(name, p0, p1, base0, base1, L, height=C.GUARD_HEIGHT, style=None,
              max_post=1.5, col=COL, cap=True, toe=True, posts=True, start_post=True,
              end_post=True):
    """Modular guard/railing section between plan points p0 -> p1.

    base0/base1 are the walking-surface heights at each end, so the same
    function builds level mezzanine guards and raked stair guards."""
    style = style or C.GUARD_STYLE
    g = group(name, col)
    x0, y0 = p0
    x1, y1 = p1
    dx, dy = x1 - x0, y1 - y0
    run = math.hypot(dx, dy)
    ux, uy = dx / run, dy / run

    def at(t):
        return (x0 + dx * t, y0 + dy * t, base0 + (base1 - base0) * t)

    post_w = 0.05
    rail_h = 0.05
    top_z = height - rail_h / 2
    # posts
    npan = max(1, int(math.ceil(run / max_post)))
    post_ts = [i / npan for i in range(npan + 1)]
    if not start_post:
        post_ts = post_ts[1:]
    if not end_post:
        post_ts = post_ts[:-1]
    if posts:
        for t in post_ts:
            px, py, pz = at(t)
            box(f"{name}_Post", (post_w, post_w, height), (px, py, pz + height / 2),
                L.steel_black, col, bevel=0.003, parent=g)
            box(f"{name}_Post_Base_Plate", (0.12, 0.12, 0.012), (px, py, pz + 0.006),
                L.steel_black, col, bevel=0.002, parent=g)
    # top rail
    a = at(0.0)
    b = at(1.0)
    prof_top = [(-0.025, -0.025), (0.025, -0.025), (0.025, 0.025), (-0.025, 0.025)]
    profile_sweep(f"{name}_Top_Rail", [(a[0], a[1], a[2] + top_z), (b[0], b[1], b[2] + top_z)],
                  prof_top, L.steel_black, col, bevel=0.003, parent=g, up_hint=(0, 0, 1))
    if cap:
        prof_cap = [(-0.045, 0.0), (0.045, 0.0), (0.045, 0.028), (-0.045, 0.028)]
        profile_sweep(f"{name}_Oak_Cap", [(a[0] - ux * 0.04, a[1] - uy * 0.04, a[2] + height),
                                          (b[0] + ux * 0.04, b[1] + uy * 0.04, b[2] + height)],
                      prof_cap, L.oak, col, bevel=0.005, parent=g, up_hint=(0, 0, 1))
    # bottom rail / toe plate
    bot_z = 0.10
    if toe:
        prof_toe = [(-0.003, 0.0), (0.003, 0.0), (0.003, 0.10), (-0.003, 0.10)]
        profile_sweep(f"{name}_Toe_Plate", [(a[0], a[1], a[2] + 0.002), (b[0], b[1], b[2] + 0.002)],
                      prof_toe, L.steel_black, col, bevel=0.001, parent=g, up_hint=(0, 0, 1))
    prof_bot = [(-0.012, -0.02), (0.012, -0.02), (0.012, 0.02), (-0.012, 0.02)]
    profile_sweep(f"{name}_Bottom_Rail", [(a[0], a[1], a[2] + bot_z + 0.02),
                                          (b[0], b[1], b[2] + bot_z + 0.02)],
                  prof_bot, L.steel_black, col, bevel=0.002, parent=g, up_hint=(0, 0, 1))
    infill_lo = bot_z + 0.04
    infill_hi = top_z - rail_h / 2
    if style == "pickets":
        n = int(run / C.PICKET_SPACING)
        ph = infill_hi - infill_lo
        for i in range(1, n):
            t = i / n
            # skip pickets that would clash with a post
            if any(abs((t - pt) * run) < post_w / 2 + 0.02 for pt in post_ts):
                continue
            px, py, pz = at(t)
            box(f"{name}_Picket", (0.019, 0.019, ph), (px, py, pz + infill_lo + ph / 2),
                L.steel_black, col, bevel=0.0015, parent=g, share=True)
    elif style == "glass":
        for k in range(npan):
            ta, tb = post_ts[k], post_ts[k + 1] if k + 1 < len(post_ts) else 1.0
            pa, pb = at(ta + 0.02), at(tb - 0.02)
            profile_sweep(f"{name}_Glass_Panel",
                          [(pa[0], pa[1], pa[2] + infill_lo), (pb[0], pb[1], pb[2] + infill_lo)],
                          [(-0.006, 0.0), (0.006, 0.0), (0.006, infill_hi - infill_lo),
                           (-0.006, infill_hi - infill_lo)], L.glass, col, parent=g,
                          up_hint=(0, 0, 1))
    elif style == "cable":
        zc = infill_lo + 0.03
        while zc < infill_hi:
            pipe(f"{name}_Cable", [(a[0], a[1], a[2] + zc), (b[0], b[1], b[2] + zc)], 0.0024,
                 L.steel_bare, col, sides=6, parent=g)
            zc += 0.075
    return g


# ---------------------------------------------------------------- deck

def build_deck(L):
    y_front = C.MEZZ_FRONT_Y
    box_between("Mezzanine_Subfloor_Plywood", (C.X0, y_front, C.MEZZ_STEEL_TOP),
                (C.X1, C.Y1, C.MEZZ_STEEL_TOP + C.MEZZ_SUBFLOOR_T), L.ply, COL, bevel=0,
                share=False)
    box_between("Mezzanine_Floor", (C.X0, y_front + 0.004, C.MEZZ_FFL - C.MEZZ_FINISH_T),
                (C.X1, C.Y1, C.MEZZ_FFL), L.lvp, COL, bevel=0.0015, share=False)
    # front edge: black steel fascia plate over the girder flange + deck edge
    box_between("Mezzanine_Fascia_Plate", (C.X0, y_front - 0.008, GIRDER_TOP - 0.02),
                (C.X1, y_front - 0.002, C.MEZZ_FFL + 0.012), L.steel_black, COL, bevel=0.002,
                share=False)
    # aluminium nosing on the deck edge
    box_between("Mezzanine_Edge_Nosing", (C.X0, y_front - 0.002, C.MEZZ_FFL - 0.002),
                (C.X1, y_front + 0.035, C.MEZZ_FFL + 0.004), L.alu_brushed, COL, bevel=0.0015,
                share=False)
    # drywall soffit under the joists (lounge ceiling)
    box_between("Mezzanine_Soffit_Drywall", (C.X0, GIRDER_Y + GIRDER_BF / 2, C.MEZZ_SOFFIT_Z),
                (C.X1, C.Y1, C.MEZZ_SOFFIT_Z + 0.016), L.ceiling, COL, bevel=0, share=False)
    # drywall returns closing the gap between soffit and girder web
    box_between("Mezzanine_Soffit_Return", (C.X0, GIRDER_Y + GIRDER_BF / 2 - 0.016, C.MEZZ_SOFFIT_Z),
                (C.X1, GIRDER_Y + GIRDER_BF / 2, GIRDER_TOP - 0.02), L.ceiling, COL, bevel=0,
                share=False)
    # vinyl wall base on the mezzanine walls
    for nm, a, b in (
        ("Mezzanine_Wall_Base_Back", (C.X0, C.Y1 - 0.012, C.MEZZ_FFL), (C.X1, C.Y1, C.MEZZ_FFL + 0.10)),
        ("Mezzanine_Wall_Base_Left", (C.X0, y_front, C.MEZZ_FFL), (C.X0 + 0.012, C.Y1, C.MEZZ_FFL + 0.10)),
        ("Mezzanine_Wall_Base_Right", (C.X1 - 0.012, y_front, C.MEZZ_FFL), (C.X1, C.Y1, C.MEZZ_FFL + 0.10)),
    ):
        box_between(nm, a, b, L.plastic_black, COL, bevel=0.002, share=False)


def build_guards(L):
    y = C.MEZZ_FRONT_Y + 0.05
    x_start = C.X0 + C.STAIR_WIDTH - 0.012 / 2 - 0.004    # meets the stair guard's top post
    guard_run("Mezzanine_Railing_Front", (x_start, y), (C.X1 - 0.03, y), C.MEZZ_FFL, C.MEZZ_FFL, L,
              max_post=1.55, start_post=False)


# ---------------------------------------------------------------- stair

def build_stair(L):
    r = C.STAIR_RISE
    gng = C.STAIR_GOING
    ytop = C.STAIR_TOP_Y
    ybot = C.STAIR_BOTTOM_Y
    n = C.STAIR_RISERS
    wid = C.STAIR_WIDTH
    t_str = 0.012
    stair = group("Stair_Main", COL)

    def nosing_z(y):
        return r * (1 + (y - ybot) / gng)

    # stringers: plate polygon in the (y, z) plane
    above = 0.05
    depth = 0.30 / math.cos(math.atan(r / gng))
    y_toe = ybot - 0.05
    y_heel = None
    # where the bottom edge meets the floor
    y_heel = ybot + ((depth - above) / r - 1) * gng
    y_cut = ytop - above * gng / r          # top edge reaches the mezzanine FFL
    poly = [(y_toe, 0.0), (y_heel, 0.0), (ytop, nosing_z(ytop) + above - depth),
            (ytop, C.MEZZ_FFL), (y_cut, C.MEZZ_FFL), (y_toe, nosing_z(y_toe) + above)]
    for side, x in (("Wall", C.X0 + 0.004), ("Open", C.X0 + wid - t_str - 0.004)):
        prism(f"Stair_Stringer_{side}", poly, t_str, L.steel_black, COL, loc=(x, 0, 0),
              rot=(math.radians(90), 0, math.radians(90)), parent=stair, bevel=0.002)
        box(f"Stair_Stringer_Base_Plate_{side}", (0.10, 0.30, 0.012),
            (x + t_str / 2, (y_toe + y_heel) / 2, 0.006), L.steel_black, COL, bevel=0.002,
            parent=stair)
    # treads: 40 mm white oak, open risers, 25 mm nosing
    tw = wid - 2 * (t_str + 0.004) - 0.004
    xc = C.X0 + wid / 2
    for k in range(1, n):
        y0 = ytop - (n - k) * gng
        y1 = y0 + gng
        z = k * r
        box("Stair_Tread_Oak", (tw, gng + 0.025, C.STAIR_TREAD_T),
            (xc, (y0 - 0.025 + y1) / 2, z - C.STAIR_TREAD_T / 2), L.oak, COL,
            bevel=0.004, segments=3, parent=stair, share=False)
        # anti-slip groove inserts near the nosing
        for gy in (0.03, 0.05):
            box("Stair_Tread_AntiSlip", (tw - 0.10, 0.008, 0.001), (xc, y0 - 0.025 + gy, z + 0.0002),
                L.rubber, COL, bevel=0.0, parent=stair)
        # clip angles under the tread on both stringers
        for sx in (C.X0 + 0.004 + t_str + 0.02, C.X0 + wid - t_str - 0.004 - 0.02):
            box("Stair_Tread_Clip_Angle", (0.04, gng - 0.06, 0.04),
                (sx, (y0 + y1) / 2 - 0.0125, z - C.STAIR_TREAD_T - 0.02), L.steel_black, COL,
                bevel=0.0015, parent=stair)
    # wall handrail: 42 mm round, 34" above the nosing line, returns to the wall
    hr_h = 0.865
    hx = C.X0 + 0.065
    yb, yt = ybot - 0.05, ytop - 0.02
    pts = [(C.X0 + 0.01, yb - 0.30, nosing_z(yb) + hr_h), (hx, yb - 0.30, nosing_z(yb) + hr_h),
           (hx, yb, nosing_z(yb) + hr_h), (hx, yt, nosing_z(yt) + hr_h),
           (hx, yt + 0.30, nosing_z(yt) + hr_h), (C.X0 + 0.01, yt + 0.30, nosing_z(yt) + hr_h)]
    pipe("Stair_Handrail_Wall", pts, 0.021, L.steel_black, COL, sides=20, bend_radius=0.06,
         parent=stair)
    yy = yb + 0.25
    while yy < yt - 0.1:
        z = nosing_z(yy) + hr_h - 0.021
        pipe("Stair_Handrail_Bracket", [(C.X0 + 0.004, yy, z - 0.045), (hx - 0.005, yy, z - 0.045),
                                        (hx, yy, z)], 0.006, L.steel_black, COL, sides=8,
             bend_radius=0.012, parent=stair)
        cylinder("Stair_Handrail_Bracket_Rose", 0.03, 0.008, (C.X0 + 0.004, yy, z - 0.045),
                 L.steel_black, COL, rot=(0, math.radians(90), 0), parent=stair)
        yy += 1.2
    # open-side guard, raked, landing on the mezzanine corner
    gx = C.X0 + wid - t_str / 2 - 0.004
    yn = ybot - 0.02
    zb = nosing_z(yn)
    guard_run("Stair_Railing_Open_Side", (gx, yn), (gx, C.MEZZ_FRONT_Y + 0.05),
              zb, C.MEZZ_FFL, L, max_post=1.7, toe=False, start_post=False)
    # newel at the floor (start of the raked guard)
    nh = zb + C.GUARD_HEIGHT
    box("Stair_Newel_Post", (0.075, 0.075, nh), (gx, yn, nh / 2), L.steel_black, COL,
        bevel=0.004, parent=stair)
    box("Stair_Newel_Cap_Oak", (0.10, 0.10, 0.03), (gx, yn, nh + 0.03), L.oak, COL,
        bevel=0.006, parent=stair)
    box("Stair_Newel_Base_Plate", (0.16, 0.16, 0.012), (gx, yn, 0.006), L.steel_black,
        COL, bevel=0.002, parent=stair)
    # LED step lights in the wall alongside every 3rd tread
    for k in range(2, n, 3):
        y0 = ytop - (n - k) * gng
        z = k * r + 0.22
        box("Stair_Step_Light_Housing", (0.012, 0.11, 0.06), (C.X0 + 0.006, y0 + gng / 2, z),
            L.black_metal, COL, bevel=0.002, parent=stair)
        box("Stair_Step_Light_Lens", (0.002, 0.08, 0.012), (C.X0 + 0.0125, y0 + gng / 2, z - 0.012),
            L.led_warm, COL, bevel=0.0, parent=stair)
    return stair


def build(L):
    build_deck(L)
    build_guards(L)
    build_stair(L)
