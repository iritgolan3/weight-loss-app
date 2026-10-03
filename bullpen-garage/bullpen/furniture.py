"""
Lounge (under the mezzanine), bar, and the mezzanine office/lounge.

Every piece is built at real-world dimensions; local frames put the front at
-Y, and each assembly is rotated into place.
"""

import math
import random
from mathutils import Vector
from . import config as C
from .core import (box, box_between, cylinder, pipe, lathe, group, profile_sweep, prism,
                   rounded_rect, uv_sphere, text, xform, instance)
from . import lighting, props, textures
from .cabinets import base_module, countertop, pull_bar
from .materials import screen

COL = "FURNITURE"
rng = random.Random(11)


def cushion(name, size, loc, mat, parent, rot=(0, 0, 0), r=0.04, col=COL):
    return box(name, size, loc, mat, col, rot=rot, bevel=r, segments=5, parent=parent, share=False)


# ---------------------------------------------------------------- seating

def sofa(name, loc, rotz, L, width=2.40, depth=0.98, mat=None, col=COL):
    """Track-arm 3-seat sofa. Front faces -Y in local space."""
    mat = mat or L.fabric_sofa
    g = group(name, col, loc=loc, rot=(0, 0, rotz))
    arm = 0.17
    leg_h = 0.10
    # legs
    for sx in (-1, 0, 1):
        for sy in (-1, 1):
            box(f"{name}_Leg", (0.04, 0.04, leg_h), (sx * (width / 2 - 0.08), sy * (depth / 2 - 0.08), leg_h / 2),
                L.black_metal, col, bevel=0.004, parent=g)
    cushion(f"{name}_Base", (width, depth, 0.22), (0, 0, leg_h + 0.11), mat, g, r=0.02)
    for s in (-1, 1):
        cushion(f"{name}_Arm", (arm, depth, 0.62 - leg_h), (s * (width / 2 - arm / 2), 0, leg_h + (0.62 - leg_h) / 2),
                mat, g, r=0.035)
    cushion(f"{name}_Back_Frame", (width - 2 * arm, 0.20, 0.42), (0, depth / 2 - 0.10, leg_h + 0.22 + 0.21), mat, g,
            r=0.03)
    inner = width - 2 * arm
    n = 3
    cw = inner / n
    for i in range(n):
        x = -inner / 2 + cw * (i + 0.5)
        cushion(f"{name}_Seat_Cushion", (cw - 0.006, depth - 0.24, 0.17),
                (x, -0.10, leg_h + 0.22 + 0.085), mat, g, r=0.05)
        cushion(f"{name}_Back_Cushion", (cw - 0.01, 0.20, 0.46),
                (x, depth / 2 - 0.26, leg_h + 0.22 + 0.17 + 0.20), mat, g, rot=(math.radians(-12), 0, 0), r=0.07)
    # accent pillows
    for s in (-1, 1):
        cushion(f"{name}_Throw_Pillow", (0.46, 0.14, 0.46),
                (s * (inner / 2 - 0.30), depth / 2 - 0.42, leg_h + 0.22 + 0.17 + 0.20), L.fabric_cushion, g,
                rot=(math.radians(-18), math.radians(s * 8), math.radians(s * -10)), r=0.06)
    # folded throw blanket over the arm
    cushion(f"{name}_Throw_Blanket", (0.20, 0.55, 0.04), (width / 2 - arm / 2, -0.05, 0.645), L.fabric_rug, g,
            r=0.015)
    return g


def club_chair(name, loc, rotz, L, mat=None, col=COL):
    mat = mat or L.leather_brown
    g = group(name, col, loc=loc, rot=(0, 0, rotz))
    w, d = 0.86, 0.90
    for sx in (-1, 1):
        for sy in (-1, 1):
            lathe(f"{name}_Leg", [(0.0, 0.0), (0.016, 0.0), (0.022, 0.12), (0.0, 0.12)], L.walnut, col,
                  loc=(sx * (w / 2 - 0.07), sy * (d / 2 - 0.07), 0.0), segments=16, parent=g,
                  share_key="club_leg")
    cushion(f"{name}_Base", (w, d, 0.22), (0, 0, 0.23), mat, g, r=0.03)
    for s in (-1, 1):
        cushion(f"{name}_Arm", (0.16, d, 0.36), (s * (w / 2 - 0.08), 0.0, 0.42), mat, g, r=0.06)
    cushion(f"{name}_Back", (w - 0.04, 0.20, 0.46), (0, d / 2 - 0.10, 0.56), mat, g, rot=(math.radians(-8), 0, 0),
            r=0.07)
    cushion(f"{name}_Seat_Cushion", (w - 0.32, d - 0.24, 0.13), (0, -0.09, 0.405), mat, g, r=0.05)
    return g


def bar_stool(name, loc, rotz, L, seat_h=0.76, col=COL):
    g = group(name, col, loc=loc, rot=(0, 0, rotz))
    # four splayed black steel legs + foot ring
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        pipe(f"{name}_Leg", [(0.21 * math.cos(a), 0.21 * math.sin(a), 0.0),
                             (0.15 * math.cos(a), 0.15 * math.sin(a), seat_h - 0.05)], 0.011, L.black_metal, col,
             sides=12, parent=g)
        cylinder(f"{name}_Foot_Glide", 0.014, 0.008, (0.21 * math.cos(a), 0.21 * math.sin(a), 0.004), L.plastic_black,
                 col, verts=12, parent=g)
    lathe(f"{name}_Foot_Ring", [(0.183, -0.009), (0.192, 0.0), (0.183, 0.009), (0.174, 0.0)], L.black_metal, col,
          loc=(0, 0, 0.30), segments=40, parent=g, share_key="stool_ring")
    box(f"{name}_Seat_Pan", (0.36, 0.36, 0.02), (0, 0, seat_h - 0.04), L.black_metal, col, bevel=0.004, parent=g)
    cushion(f"{name}_Seat", (0.42, 0.40, 0.07), (0, 0, seat_h), L.leather_brown, g, r=0.025)
    # low back
    for s in (-1, 1):
        pipe(f"{name}_Back_Post", [(s * 0.15, 0.17, seat_h - 0.04), (s * 0.15, 0.20, seat_h + 0.22)], 0.009,
             L.black_metal, col, sides=10, parent=g)
    cushion(f"{name}_Back_Pad", (0.38, 0.05, 0.12), (0, 0.205, seat_h + 0.22), L.leather_brown, g, r=0.02)
    return g


def office_chair(name, loc, rotz, L, col=COL):
    g = group(name, col, loc=loc, rot=(0, 0, rotz))
    for i in range(5):
        a = 2 * math.pi * i / 5
        pipe(f"{name}_Base_Spoke", [(0, 0, 0.12), (0.32 * math.cos(a), 0.32 * math.sin(a), 0.08)], 0.016, L.alu_cast,
             col, sides=10, parent=g)
        cylinder(f"{name}_Caster", 0.03, 0.022, (0.32 * math.cos(a), 0.32 * math.sin(a), 0.035), L.plastic_black, col,
                 rot=(0, math.radians(90), a), verts=16, parent=g)
    cylinder(f"{name}_Gas_Lift", 0.028, 0.30, (0, 0, 0.26), L.chrome, col, verts=20, parent=g)
    box(f"{name}_Mechanism", (0.26, 0.24, 0.05), (0, 0, 0.43), L.plastic_black, col, bevel=0.01, parent=g)
    cushion(f"{name}_Seat", (0.52, 0.50, 0.10), (0, -0.02, 0.50), L.leather_black, g, r=0.04)
    cushion(f"{name}_Back", (0.50, 0.10, 0.70), (0, 0.27, 0.92), L.leather_black, g, rot=(math.radians(-10), 0, 0),
            r=0.05)
    cushion(f"{name}_Headrest", (0.36, 0.09, 0.16), (0, 0.33, 1.32), L.leather_black, g, rot=(math.radians(-12), 0, 0),
            r=0.04)
    for s in (-1, 1):
        pipe(f"{name}_Arm", [(s * 0.25, 0.15, 0.47), (s * 0.27, 0.10, 0.66), (s * 0.27, -0.18, 0.66)], 0.012,
             L.chrome, col, sides=10, bend_radius=0.05, parent=g)
        cushion(f"{name}_Arm_Pad", (0.07, 0.26, 0.03), (s * 0.27, -0.04, 0.68), L.leather_black, g, r=0.012)
    return g


# ---------------------------------------------------------------- tables / rugs

def coffee_table(name, loc, rotz, L, w=1.30, d=0.70, h=0.40, col=COL):
    g = group(name, col, loc=loc, rot=(0, 0, rotz))
    box(f"{name}_Top", (w, d, 0.05), (0, 0, h - 0.025), L.walnut, col, bevel=0.006, segments=3, parent=g)
    for s in (-1, 1):
        profile_sweep(f"{name}_Sled_Base",
                      [(s * (w / 2 - 0.12), -d / 2 + 0.06, 0.0), (s * (w / 2 - 0.12), -d / 2 + 0.06, h - 0.05),
                       (s * (w / 2 - 0.12), d / 2 - 0.06, h - 0.05), (s * (w / 2 - 0.12), d / 2 - 0.06, 0.0)],
                      [(-0.012, -0.012), (0.012, -0.012), (0.012, 0.012), (-0.012, 0.012)], L.black_metal, col,
                      bend_radius=0.0, parent=g, up_hint=(1, 0, 0), bevel=0.002)
    return g


def rug(name, loc, w, d, L, rotz=0.0, mat=None, col=COL):
    g = group(name, col, loc=loc, rot=(0, 0, rotz))
    box(f"{name}_Pile", (w, d, 0.010), (0, 0, 0.006), mat or L.fabric_rug, col, bevel=0.004, parent=g, share=False)
    # bound edge
    for nm, sz, lc in (("N", (w, 0.03, 0.011), (0, d / 2 - 0.015, 0.0065)), ("S", (w, 0.03, 0.011), (0, -d / 2 + 0.015, 0.0065)),
                       ("E", (0.03, d, 0.011), (w / 2 - 0.015, 0, 0.0065)), ("W", (0.03, d, 0.011), (-w / 2 + 0.015, 0, 0.0065))):
        box(f"{name}_Binding_{nm}", sz, lc, L.felt, col, bevel=0.003, parent=g, share=False)
    return g


# ---------------------------------------------------------------- TV wall

def build_tv_wall(L):
    x0 = C.X0 + 2.0
    x1 = C.X1 - C.BATH_W - 0.13
    ztop = C.MEZZ_SOFFIT_Z
    yb = C.Y1
    g = group("TV_Wall", COL)
    # black felt acoustic backing + vertical white-oak slats (real gaps)
    box_between("TV_Wall_Felt_Backing", (x0, yb - 0.012, 0.0), (x1, yb, ztop), L.felt, COL, bevel=0,
                share=False).parent = g
    slat_w, gap = 0.028, 0.014
    n = int((x1 - x0) / (slat_w + gap))
    off = ((x1 - x0) - n * (slat_w + gap) + gap) / 2
    for i in range(n):
        x = x0 + off + i * (slat_w + gap) + slat_w / 2
        box("TV_Wall_Oak_Slat", (slat_w, 0.020, ztop - 0.002), (x, yb - 0.012 - 0.010, ztop / 2), L.oak_z, COL,
            bevel=0.0015, parent=g)
    # TV 75"
    tw, th = 1.674, 0.952
    tx, tz = C.TV_CENTER_X, 1.30
    ty = yb - 0.032 - 0.04
    tv = group("TV_75in", COL, loc=(tx, ty, tz))
    box("TV_Panel_Body", (tw, 0.028, th), (0, 0.0, 0.0), L.plastic_black, COL, bevel=0.003, parent=tv)
    box("TV_Rear_Housing", (tw * 0.7, 0.04, th * 0.6), (0, 0.03, -0.05), L.plastic_black, COL, bevel=0.01, parent=tv)
    img = textures.image("tv_telemetry.png")
    mscreen = screen("M_TV_Screen_Telemetry", img, strength=1.2)
    props.uv_plane("TV_Screen", tw - 0.012, th - 0.012, (0, -0.0145, 0.0), mscreen, COL, parent=tv)
    box("TV_Wall_Mount", (0.40, 0.04, 0.30), (0, 0.045, 0.0), L.black_metal, COL, bevel=0.003, parent=tv)
    # bias light behind the TV
    lighting.area("Light_TV_Bias", (tx, yb - 0.04, tz), tw * 0.8, th * 0.6, lumens=120, kelvin=6500,
                  rot=(math.radians(-90), 0, 0))
    # soundbar
    box("TV_Soundbar", (1.0, 0.10, 0.065), (tx, ty - 0.03, tz - th / 2 - 0.07), L.felt, COL, bevel=0.02, segments=3)
    # floating walnut media console with fluted doors
    cw, cd, ch = 2.10, 0.42, 0.42
    cz = 0.28
    cg = group("Media_Console", COL, loc=(tx, yb - 0.032, cz))
    box("Media_Console_Case", (cw, cd, ch), (0, -cd / 2, ch / 2), L.walnut, COL, bevel=0.004, segments=2, parent=cg)
    for i in range(4):
        dx = -cw / 2 + cw / 8 + i * cw / 4
        box("Media_Console_Door", (cw / 4 - 0.006, 0.018, ch - 0.03), (dx, -cd - 0.009, ch / 2), L.walnut_y, COL,
            bevel=0.002, parent=cg)
        for k in range(9):
            cylinder("Media_Console_Flute", 0.0055, ch - 0.05, (dx - 0.10 + k * 0.025, -cd - 0.019, ch / 2), L.walnut_y,
                     COL, verts=10, parent=cg)
    box("Media_Console_Top_Shadow_Gap", (cw - 0.01, cd - 0.01, 0.004), (0, -cd / 2, ch + 0.002), L.walnut, COL,
        bevel=0.001, parent=cg)
    # console decor
    ct = cz + ch + 0.004
    props.book_row("Media_Console_Books", 0.0, 0.25, (tx + 0.55, yb - 0.10, ct), 0.0, L, COL, seed=5, h=(0.22, 0.27))
    props.potted_plant("Media_Console_Plant", (tx - 0.80, yb - 0.24, ct), L, COL, height=0.35, pot_r=0.09, pot_h=0.15,
                       leaves=16, seed=4)
    lathe("Media_Console_Vase", [(0.0, 0.0), (0.06, 0.0), (0.08, 0.10), (0.05, 0.25), (0.035, 0.30), (0.035, 0.32),
                                 (0.0, 0.32)], L.ceramic_black, COL, loc=(tx - 0.45, yb - 0.22, ct), segments=40)
    _model_car_display("Media_Console_Model_Car", (tx + 0.25, yb - 0.24, ct), L, scale=1 / 18, color=(0.42, 0.01, 0.012))
    return g


def _model_car_display(name, loc, L, scale=1 / 18, color=(0.4, 0.01, 0.01), rotz=0.6, kind="rear_engine",
                       parent=None):
    from . import vehicles
    spec = dict(name=name, kind=kind, length=4.573, width=1.852, height=1.30, wheelbase=2.45,
                color=color, metallic=0.2, wheel_d=0.69, rim_in=20)
    g = vehicles.build_car(spec, L, loc=loc, rotz=rotz, scale=scale, col=COL, detail=False, parent=parent)
    return g


# ---------------------------------------------------------------- lounge

def build_lounge(L):
    tx = C.TV_CENTER_X
    rug("Rug_Lounge", (tx, 16.35, 0.0), 2.75, 3.40, L)
    sofa("Sofa_Main", (tx, C.SOFA_Y, 0.0), math.radians(180), L)
    coffee_table("Coffee_Table", (tx, 16.25, 0.0), 0.0, L)
    club_chair("Chair_01", (tx - 1.65, 16.70, 0.0), math.radians(110), L)
    club_chair("Chair_02", (tx + 1.62, 16.75, 0.0), math.radians(-110), L)
    # coffee table styling
    ct = 0.40
    props.book_row("Coffee_Table_Books", 0.0, 0.08, (tx - 0.35, 16.15, ct), math.radians(90), L, COL, seed=9,
                   h=(0.28, 0.30))
    box("Coffee_Table_Tray", (0.40, 0.25, 0.02), (tx + 0.25, 16.25, ct + 0.01), L.leather_brown, COL, bevel=0.006)
    props.tumbler("Coffee_Table_Tumbler", (tx + 0.18, 16.22, ct + 0.02), L, COL)
    props.bottle("Coffee_Table_Bottle", (tx + 0.32, 16.28, ct + 0.02), L, COL, kind="spirit", mat=L.glass_bottle_amber)
    _remote("Coffee_Table_Remote", (tx - 0.05, 16.05, ct), L)
    # side table between chair and sofa + table lamp
    sg = group("Side_Table_Lounge", COL, loc=(tx - 1.55, 15.55, 0.0))
    lathe("Side_Table_Top", [(0.0, 0.53), (0.25, 0.53), (0.25, 0.56), (0.0, 0.56)], L.walnut, COL, segments=48, parent=sg)
    cylinder("Side_Table_Stem", 0.025, 0.52, (0, 0, 0.27), L.black_metal, COL, verts=20, parent=sg)
    lathe("Side_Table_Foot", [(0.0, 0.0), (0.20, 0.0), (0.19, 0.02), (0.0, 0.025)], L.black_metal, COL, segments=48,
          parent=sg)
    props.table_lamp("Side_Table_Lamp", (tx - 1.55, 15.55, 0.56), L, COL)
    props.potted_plant("Lounge_Floor_Plant", (tx + 1.95, 17.75, 0.0), L, COL, height=1.35, seed=2)


def _remote(name, loc, L):
    g = group(name, COL, loc=loc, rot=(0, 0, 0.3))
    box(f"{name}_Body", (0.045, 0.18, 0.018), (0, 0, 0.009), L.plastic_black, COL, bevel=0.006, parent=g)
    for k in range(4):
        box(f"{name}_Button", (0.008, 0.008, 0.002), (-0.01 + (k % 2) * 0.02, 0.04 - (k // 2) * 0.02, 0.019),
            L.plastic_grey, COL, bevel=0.001, parent=g)
    return g


# ---------------------------------------------------------------- bar

def build_bar(L):
    rot_wall = math.radians(90)          # module front (-Y) faces +X on the left wall
    x_wall = C.X0
    y = C.BAR_Y0
    modules = [("drawer_3_wide", 0.60), ("door_2", 0.90), ("fridge", 0.60), ("door_2", 0.90), ("drawer_3_wide", 0.60)]
    for i, (kind, w) in enumerate(modules):
        yc = y + w / 2
        name = f"Bar_BackBar_{i + 1:02d}_{kind.title().replace('_', '')}"
        if kind == "fridge":
            _beverage_fridge(name, (x_wall, yc, 0.0), rot_wall, w, L)
        else:
            # module local +X maps to world -Y for rot=+90; mirror placement keeps order
            base_module(kind, name, w, L, (x_wall, yc, 0.0), rot_wall, front_mat=L.walnut_y, pull_mat=L.black_metal,
                        carcass_mat=L.cab_carcass, toe_mat=L.black_metal, col=COL)
        y += w + 0.002
    y_end = y
    # quartz top on the back bar (countertop helper in the module frame: local x -> world -Y? use world box)
    box_between("Bar_BackBar_Quartz_Top", (x_wall, C.BAR_Y0, C.CAB_BASE_H), (x_wall + C.CAB_DEPTH + 0.02, y_end, C.CAB_BASE_H + 0.03),
                L.quartz, COL, bevel=0.003, share=False)
    box_between("Bar_BackBar_Backsplash", (x_wall, C.BAR_Y0, C.CAB_BASE_H + 0.03), (x_wall + 0.012, y_end, 1.25),
                L.quartz, COL, bevel=0.002, share=False)
    # floating oak shelves with under-shelf LED and bottles/glassware
    bottles = group("Bar_BackBar_Bottles", COL)
    for k, z in enumerate((1.40, 1.78)):
        box_between(f"Bar_Shelf_Oak_{k + 1}", (x_wall, C.BAR_Y0 + 0.15, z - 0.04), (x_wall + 0.28, y_end - 0.15, z),
                    L.oak_y, COL, bevel=0.003, share=False)
        lighting.led_strip(f"Bar_Shelf_LED_{k + 1}", (x_wall + 0.20, C.BAR_Y0 + 0.2, z - 0.043),
                           (x_wall + 0.20, y_end - 0.2, z - 0.043), L, kelvin=2700, lm_per_m=300, mat=L.led_warm)
        yy = C.BAR_Y0 + 0.24
        i = 0
        mats = [L.glass_bottle_amber, L.glass_bottle_green, L.glass_bottle_clear, L.glass_bottle_amber]
        while yy < y_end - 0.25:
            if k == 0 and (i % 5 == 4):
                props.tumbler("Bar_Shelf_Glass", (x_wall + 0.14, yy, z), L, COL, parent=bottles)
                props.tumbler("Bar_Shelf_Glass", (x_wall + 0.14, yy + 0.09, z), L, COL, parent=bottles)
                yy += 0.20
            else:
                kind = "spirit" if (i + k) % 3 else "wine"
                props.bottle("Bar_Shelf_Bottle", (x_wall + 0.14, yy, z), L, COL, kind=kind, mat=mats[(i + k) % 4],
                             parent=bottles)
                yy += 0.105 + rng.uniform(0, 0.03)
            i += 1
    # neon "THE BULLPEN" sign on a black backer (name from the video title)
    sy = (C.BAR_Y0 + y_end) / 2
    sg = group("Sign_The_Bullpen", COL, loc=(x_wall + 0.002, sy, 2.38), rot=(0, 0, math.radians(90)))
    box("Sign_Backer_Black", (2.20, 0.012, 0.52), (0, -0.006, 0.0), L.plastic_black_gloss, COL, bevel=0.003, parent=sg)
    t = text("Sign_Neon_Text", "THE BULLPEN", 0.28, (0, -0.03, -0.12), L.neon_red, COL, rot=(math.radians(90), 0, 0),
             extrude=0.006, bevel=0.004, parent=sg)
    lighting.camera_only(t)
    for s in (-1, 1):
        pipe("Sign_Standoff", [(s * 0.95, 0.0, 0.18), (s * 0.95, -0.028, 0.18)], 0.006, L.chrome, COL, sides=10, parent=sg)
    lighting.area("Light_Sign_Neon_Glow", (x_wall + 0.10, sy, 2.38), 1.9, 0.12, lumens=180, kelvin=1900,
                  rot=(0, math.radians(-90), 0), spread=160)
    # bar counter (island, 42" high) parallel to the back bar
    bx = (C.BAR_X_FACE - 0.40 + C.BAR_X_FACE) / 2 - 0.3
    by0, by1 = C.BAR_Y0 + 0.10, C.BAR_Y1 - 0.45
    bh = 1.07
    bg = group("Bar_Main", COL)
    body_x0, body_x1 = C.BAR_X_FACE - 0.62, C.BAR_X_FACE - 0.20
    box_between("Bar_Main_Body", (body_x0, by0, 0.0), (body_x1, by1, bh - 0.04), L.cab_carcass, COL, bevel=0.004,
                share=False).parent = bg
    # vertical oak slat cladding on the customer face (+X) and the end
    n = int((by1 - by0) / 0.045)
    for i in range(n):
        yy = by0 + 0.0225 + i * (by1 - by0 - 0.045) / max(1, n - 1)
        box("Bar_Main_Oak_Slat", (0.02, 0.032, bh - 0.12), (body_x1 + 0.01, yy, (bh - 0.12) / 2 + 0.06), L.oak_z, COL,
            bevel=0.0015, parent=bg)
    box_between("Bar_Main_Toe_Recess", (body_x1 - 0.002, by0, 0.0), (body_x1 + 0.022, by1, 0.06), L.black_metal, COL,
                bevel=0.002, share=False).parent = bg
    box_between("Bar_Main_Top_Quartz", (body_x0 - 0.04, by0 - 0.04, bh - 0.04), (C.BAR_X_FACE + 0.08, by1 + 0.04, bh),
                L.quartz, COL, bevel=0.004, share=False).parent = bg
    # foot rail on brackets
    pipe("Bar_Main_Foot_Rail", [(body_x1 + 0.16, by0 + 0.10, 0.22), (body_x1 + 0.16, by1 - 0.10, 0.22)], 0.025,
         L.black_metal, COL, sides=20, cap=True)
    for yy in (by0 + 0.25, (by0 + by1) / 2, by1 - 0.25):
        pipe("Bar_Main_Foot_Rail_Bracket", [(body_x1 + 0.025, yy, 0.30), (body_x1 + 0.16, yy, 0.22)], 0.008,
             L.black_metal, COL, sides=8)
    # work side: open shelf with glasses
    box_between("Bar_Main_Work_Shelf", (body_x0 - 0.005, by0 + 0.05, 0.75), (body_x0 + 0.002, by1 - 0.05, 0.77),
                L.black_metal, COL, bevel=0.001, share=False)
    # stools along the customer side
    k = 1
    yy = by0 + 0.40
    while yy < by1 - 0.2:
        bar_stool(f"Bar_Stool_{k:02d}", (C.BAR_X_FACE + 0.40, yy, 0.0), math.radians(-90 + rng.uniform(-8, 8)), L)
        yy += 0.66
        k += 1
    # counter styling: glasses, bottle, cocktail shaker, napkins
    props.tumbler("Bar_Counter_Glass", (C.BAR_X_FACE - 0.05, by0 + 0.75, bh), L, COL)
    props.tumbler("Bar_Counter_Glass", (C.BAR_X_FACE - 0.08, by0 + 0.88, bh), L, COL)
    props.bottle("Bar_Counter_Bottle", (body_x0 + 0.05, by0 + 1.2, bh), L, COL, kind="spirit", mat=L.glass_bottle_clear)
    lathe("Bar_Counter_Shaker", [(0.0, 0.0), (0.04, 0.0), (0.045, 0.16), (0.035, 0.20), (0.02, 0.24), (0.0, 0.245)],
          L.stainless, COL, loc=(body_x0 + 0.10, by0 + 1.45, bh), segments=32)
    box("Bar_Counter_Napkins", (0.12, 0.12, 0.03), (C.BAR_X_FACE - 0.10, by1 - 0.40, bh + 0.015), L.paper, COL,
        bevel=0.004)
    # analog clock above the back bar
    _clock("Bar_Wall_Clock", (x_wall + 0.002, C.BAR_Y1 + 0.55, 2.10), math.radians(90), L)


def _beverage_fridge(name, loc, rotz, w, L):
    g = group(name, COL, loc=loc, rot=(0, 0, rotz))
    d = C.CAB_DEPTH
    h = C.CAB_BASE_H
    box(f"{name}_Cabinet", (w - 0.004, d - 0.02, h - 0.004), (0, -d / 2 + 0.01, h / 2), L.stainless_y, COL, bevel=0.004,
        parent=g)
    # glass door with stainless frame
    box(f"{name}_Door_Frame", (w - 0.01, 0.03, h - 0.12), (0, -d + 0.005, h / 2 + 0.04), L.stainless_y, COL, bevel=0.004,
        parent=g)
    box(f"{name}_Door_Glass", (w - 0.09, 0.006, h - 0.22), (0, -d - 0.012, h / 2 + 0.04), L.glass_car, COL, bevel=0.0,
        parent=g)
    box(f"{name}_Interior_Back", (w - 0.06, 0.01, h - 0.16), (0, -0.04, h / 2 + 0.04), L.plastic_black, COL, bevel=0.0,
        parent=g)
    box(f"{name}_Vent_Grille", (w - 0.02, 0.01, 0.07), (0, -d + 0.02, 0.05), L.plastic_black, COL, bevel=0.002, parent=g)
    pull_bar(g, f"{name}_Handle", 0.45, w / 2 - 0.05, h / 2 + 0.04, -d - 0.015, L, vertical=True, mat=L.stainless)
    # shelves of cans/bottles inside + cool interior light
    for k, z in enumerate((0.20, 0.38, 0.56)):
        box(f"{name}_Shelf", (w - 0.08, d - 0.12, 0.006), (0, -d / 2, z), L.black_metal, COL, bevel=0.0, parent=g)
        for i in range(5):
            cylinder(f"{name}_Can", 0.033, 0.122, (-w / 2 + 0.10 + i * 0.095, -d + 0.13, z + 0.064),
                     [L.plastic_red, L.alu_brushed, L.plastic_blue][(i + k) % 3], COL, verts=20, parent=g)
    m = xform(loc, (0, 0, rotz))
    p = m @ Vector((0, -d / 2, h - 0.08))
    lighting.area(f"{name}_Interior_Light", p, w - 0.12, 0.05, lumens=60, kelvin=6000)


def _clock(name, loc, rotz, L):
    g = group(name, COL, loc=loc, rot=(0, 0, rotz))
    lathe(f"{name}_Bezel", [(0.0, 0.0), (0.20, 0.0), (0.205, -0.04), (0.19, -0.045), (0.185, -0.006), (0.0, -0.006)],
          L.black_metal, COL, rot=(math.radians(-90), 0, 0), segments=64, parent=g)
    from .materials import image_print
    face = image_print("M_Print_Clock_Face", textures.image("clock_face.png"))
    o = props.uv_plane(f"{name}_Face", 0.37, 0.37, (0, -0.008, 0), face, COL, parent=g)
    box(f"{name}_Hand_Hour", (0.012, 0.002, 0.10), (0.02, -0.012, 0.04), L.black_metal, COL, bevel=0.0, parent=g,
        rot=(0, math.radians(-40), 0))
    box(f"{name}_Hand_Minute", (0.008, 0.002, 0.15), (-0.03, -0.014, 0.06), L.black_metal, COL, bevel=0.0, parent=g,
        rot=(0, math.radians(25), 0))
    box(f"{name}_Glass", (0.38, 0.002, 0.38), (0, -0.035, 0), L.glass, COL, bevel=0.0, parent=g)
    return g


# ---------------------------------------------------------------- mezzanine

def build_mezzanine_office(L):
    z = C.MEZZ_FFL
    # rug + executive desk overlooking the cars
    rug("Rug_Mezzanine_Office", (1.0, 12.55, z), 2.4, 3.0, L, mat=L.fabric_rug)
    dx, dy = 1.0, 11.80
    dg = group("Desk_Executive", COL, loc=(dx, dy, z), rot=(0, 0, math.radians(180)))
    w, d, h = 1.80, 0.80, 0.76
    box("Desk_Top_Walnut", (w, d, 0.045), (0, 0, h - 0.0225), L.walnut, COL, bevel=0.004, segments=3, parent=dg)
    for s in (-1, 1):
        profile_sweep("Desk_Leg_Frame", [(s * (w / 2 - 0.08), -d / 2 + 0.05, 0.0), (s * (w / 2 - 0.08), -d / 2 + 0.05, h - 0.045),
                                         (s * (w / 2 - 0.08), d / 2 - 0.05, h - 0.045), (s * (w / 2 - 0.08), d / 2 - 0.05, 0.0)],
                      [(-0.03, -0.015), (0.03, -0.015), (0.03, 0.015), (-0.03, 0.015)], L.black_metal, COL,
                      parent=dg, up_hint=(1, 0, 0), bevel=0.002)
    box("Desk_Modesty_Panel", (w - 0.25, 0.012, 0.35), (0, d / 2 - 0.06, h - 0.23), L.black_metal, COL, bevel=0.002, parent=dg)
    # desk items (desk local frame: chair side is -Y)
    mg = group("Desk_Monitor", COL, loc=(0.0, 0.18, h), parent=dg)
    box("Monitor_Stand_Base", (0.25, 0.20, 0.012), (0, 0, 0.006), L.alu_cast, COL, bevel=0.004, parent=mg)
    box("Monitor_Stand_Neck", (0.05, 0.02, 0.32), (0, 0.04, 0.17), L.alu_cast, COL, bevel=0.004, parent=mg)
    box("Monitor_Panel", (0.62, 0.025, 0.37), (0, 0.02, 0.38), L.plastic_black, COL, bevel=0.004, parent=mg)
    mon = screen("M_Monitor_Screen", textures.image("tv_telemetry.png"), strength=0.9)
    props.uv_plane("Monitor_Screen", 0.60, 0.34, (0, 0.0072, 0.38), mon, COL, parent=mg)
    box("Desk_Keyboard", (0.42, 0.13, 0.015), (0.0, -0.12, h + 0.0075), L.alu_brushed, COL, bevel=0.003, parent=dg)
    box("Desk_Mouse", (0.06, 0.10, 0.03), (0.32, -0.12, h + 0.015), L.plastic_black, COL, bevel=0.015, parent=dg)
    box("Desk_Notebook", (0.15, 0.21, 0.012), (-0.45, -0.15, h + 0.006), L.leather_black, COL, bevel=0.003, parent=dg,
        rot=(0, 0, 0.15))
    props.mug("Desk_Coffee_Mug", (-0.60, -0.02, h), L, COL, parent=dg, rotz=1.0, mat=L.ceramic_black)
    props.table_lamp("Desk_Lamp", (0.72, 0.20, h), L, COL, parent=dg, shade_mat=L.black_metal, lumens=250)
    _model_car_display("Desk_Model_Car", (-0.55, 0.22, h), L, scale=1 / 18, color=(0.42, 0.43, 0.44), rotz=2.4,
                       kind="front_engine", parent=dg)
    office_chair("Chair_Office", (dx + 0.05, dy + 0.85, z), math.radians(8), L)
    # display shelving on the mezzanine back wall (black steel + oak)
    build_display_shelving(L, z)
    # leather loveseat + table on the left side of the mezzanine
    rug("Rug_Mezzanine_Lounge", (-2.85, 15.9, z), 2.2, 2.9, L, rotz=0.0, mat=L.fabric_cushion)
    sofa("Sofa_Mezzanine_Loveseat", (-3.95, 15.9, z), math.radians(90), L, width=1.70, depth=0.92, mat=L.leather_black)
    coffee_table("Coffee_Table_Mezzanine", (-2.75, 15.9, z), math.radians(90), L, w=1.0, d=0.55, h=0.38)
    club_chair("Chair_Mezzanine", (-1.65, 16.1, z), math.radians(-75), L)
    props.potted_plant("Mezzanine_Plant", (-4.15, 17.85, z), L, COL, height=1.5, seed=7)
    # arc floor lamp over the loveseat
    ag = group("Floor_Lamp_Arc", COL, loc=(-4.25, 14.55, z))
    box("ArcLamp_Base_Marble", (0.30, 0.30, 0.05), (0, 0, 0.025), L.quartz, COL, bevel=0.008, parent=ag)
    pipe("ArcLamp_Arc", [(0, 0, 0.05), (0.05, 0.05, 1.6), (0.6, 0.6, 2.05), (1.05, 1.05, 1.85)], 0.012, L.brass, COL,
         sides=12, bend_radius=0.6, parent=ag)
    lathe("ArcLamp_Shade", [(0.0, 0.0), (0.03, 0.0), (0.22, -0.16), (0.21, -0.165), (0.025, -0.01)], L.brass, COL,
          loc=(1.05, 1.05, 1.86), segments=48, parent=ag)
    lighting.point("ArcLamp_Light", (-4.25 + 1.05, 14.55 + 1.05, z + 1.78), 600, 2700, radius=0.05)
    # storage rack with totes in the back-right corner
    rx, ry = C.X1 - 0.65, C.Y1 - 0.30
    rg = group("Storage_Rack_Mezzanine", COL, loc=(rx, ry, z))
    for sx in (-1, 1):
        for sy in (-1, 1):
            box("Rack_Upright", (0.025, 0.025, 1.83), (sx * 0.59, sy * 0.21, 0.915), L.steel_black, COL, bevel=0.002,
                parent=rg)
    for zz in (0.10, 0.55, 1.00, 1.45):
        box("Rack_Shelf_Wire", (1.20, 0.45, 0.02), (0, 0, zz), L.steel_black, COL, bevel=0.002, parent=rg)
    lids = [L.plastic_yellow, L.plastic_red, L.plastic_blue]
    for k, zz in enumerate((0.11, 0.56, 1.01)):
        props.tote("Storage_Tote", (-0.30, 0.0, zz + 0.01), L, COL, parent=rg, lid=lids[k % 3])
        props.tote("Storage_Tote", (0.30, 0.0, zz + 0.01), L, COL, parent=rg, lid=lids[(k + 1) % 3])
    box("Storage_Car_Cover_Bag", (0.55, 0.38, 0.25), (0.0, 0.0, 1.59), L.fabric_sofa, COL, bevel=0.05, parent=rg)


def build_display_shelving(L, z):
    x0, x1 = -1.55, 0.95
    y = C.Y1
    g = group("Display_Shelving_Mezzanine", COL)
    shelf_z = [0.45, 0.90, 1.35, 1.80]
    for zz in shelf_z:
        box_between("Display_Shelf_Oak", (x0, y - 0.32, z + zz - 0.03), (x1, y - 0.01, z + zz), L.oak, COL, bevel=0.003,
                    share=False).parent = g
    for xx in (x0, (x0 + x1) / 2, x1):
        box_between("Display_Shelf_Upright", (xx - 0.015, y - 0.33, z), (xx + 0.015, y - 0.01, z + 2.10), L.steel_black,
                    COL, bevel=0.002, share=False).parent = g
    # contents: helmets, model cars, trophies, books, framed photo
    props.helmet("Display_Helmet_01", (x0 + 0.35, y - 0.17, z + 1.80), L, COL, rotz=math.radians(20), shell=L.plastic_white,
                 stripe=L.plastic_red)
    props.helmet("Display_Helmet_02", (x1 - 0.35, y - 0.17, z + 1.80), L, COL, rotz=math.radians(-25), shell=L.red_paint,
                 stripe=L.plastic_white)
    props.trophy("Display_Trophy_01", ((x0 + x1) / 2 - 0.25, y - 0.16, z + 1.80), L, COL, h=0.28)
    props.trophy("Display_Trophy_02", ((x0 + x1) / 2 + 0.25, y - 0.16, z + 1.80), L, COL, h=0.22, mat=L.chrome)
    cols = [(0.42, 0.01, 0.012), (0.02, 0.05, 0.25), (0.75, 0.48, 0.02), (0.02, 0.02, 0.02), (0.6, 0.6, 0.6)]
    for i in range(5):
        _model_car_display(f"Display_Model_Car_{i + 1:02d}", (x0 + 0.25 + i * 0.47, y - 0.16, z + 1.35), L,
                           scale=1 / 18, color=cols[i], rotz=math.radians(-90 + (i % 2) * 180 + 25),
                           kind="rear_engine" if i % 2 == 0 else "front_engine")
    props.book_row("Display_Books_01", 0.0, 0.9, (x0 + 0.08, y - 0.02, z + 0.90), 0.0, L, COL, seed=21)
    props.book_row("Display_Books_02", 0.0, 0.7, ((x0 + x1) / 2 + 0.08, y - 0.02, z + 0.45), 0.0, L, COL, seed=22)
    props.picture_frame("Display_Framed_Photo", 0.30, 0.24, "poster_bullpen.jpg", ((x0 + x1) / 2 - 0.55, y - 0.06, z + 0.90 + 0.13),
                        math.radians(-8), L, COL, frame_w=0.02, mat_border=0.03)
    for i in range(3):
        _model_car_display(f"Display_Model_Car_Lower_{i + 1:02d}", (x0 + 0.95 + i * 0.45, y - 0.16, z + 0.45), L,
                           scale=1 / 24, color=cols[(i + 2) % 5], rotz=math.radians(-60))


def build(L):
    build_tv_wall(L)
    build_lounge(L)
    build_bar(L)
    build_mezzanine_office(L)
