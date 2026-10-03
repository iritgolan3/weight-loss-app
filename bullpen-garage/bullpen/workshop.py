"""
Workshop equipment and tools, each placed where it would be used:
  * rolling tool chest (top chest + roller cabinet) at the end of the run
  * bench vise, battery charger, shop stool at the open bench
  * slatwall hooks with hand tools above the bench
  * vertical air compressor (front-left corner) + blue aluminium air line
    across the front wall to a retractable hose reel above the cabinets
  * floor jack, jack stands, creeper, shop vac, trash can, paper towels
  * detailing station on the left wall (shelves, bottles, towels, cart)
"""

import math
import random
from mathutils import Vector
from . import config as C
from .core import (box, box_between, cylinder, pipe, lathe, group, profile_sweep,
                   prism, rounded_rect, uv_sphere, xform, instance)
from .cabinets import drawer_stack, pull_bar, carcass

COL = "WORKSHOP"
rng = random.Random(7)


# ---------------------------------------------------------------- helpers

def caster(g, name, loc, L, r=0.05, swivel=True):
    x, y, z = loc
    cylinder(f"{name}_Wheel", r, 0.035, (x, y, z + r), L.rubber, COL, rot=(0, math.radians(90), 0),
             verts=24, parent=g)
    cylinder(f"{name}_Hub", r * 0.45, 0.04, (x, y, z + r), L.chrome, COL, rot=(0, math.radians(90), 0),
             verts=16, parent=g)
    box(f"{name}_Fork", (0.05, r * 1.2, r * 1.3), (x, y + r * 0.2, z + r * 1.35), L.chrome, COL,
        bevel=0.003, parent=g)
    box(f"{name}_Plate", (0.09, 0.09, 0.006), (x, y, z + 2 * r + 0.02), L.chrome, COL, bevel=0.002,
        parent=g)


def spray_bottle(name, loc, L, mat_liquid, col=COL, parent=None, rotz=0.0):
    g = group(name, col, loc=loc, rot=(0, 0, rotz), parent=parent)
    lathe(f"{name}_Body", [(0.0, 0.0), (0.040, 0.0), (0.043, 0.01), (0.043, 0.17), (0.030, 0.20),
                           (0.014, 0.215), (0.014, 0.225), (0.0, 0.225)], mat_liquid, col,
          segments=24, parent=g, share_key="spray_bottle_" + mat_liquid.name)
    cylinder(f"{name}_Collar", 0.017, 0.02, (0, 0, 0.235), L.plastic_white, col, verts=16, parent=g)
    box(f"{name}_Head", (0.03, 0.075, 0.035), (0, -0.02, 0.26), L.plastic_black, col, bevel=0.008,
        parent=g)
    box(f"{name}_Trigger", (0.012, 0.012, 0.045), (0, -0.035, 0.225), L.plastic_black, col,
        bevel=0.004, parent=g, rot=(math.radians(-15), 0, 0))
    box(f"{name}_Label", (0.065, 0.001, 0.08), (0, -0.0435, 0.09), L.label_white, col, bevel=0.0,
        parent=g)
    return g


def jug(name, loc, L, mat, h=0.26, w=0.16, d=0.10, col=COL, parent=None, rotz=0.0):
    g = group(name, col, loc=loc, rot=(0, 0, rotz), parent=parent)
    box(f"{name}_Body", (w, d, h), (0, 0, h / 2), mat, col, bevel=0.02, segments=3, parent=g)
    cylinder(f"{name}_Cap", 0.02, 0.025, (w / 4, 0, h + 0.012), L.plastic_black, col, verts=16,
             parent=g)
    pipe(f"{name}_Handle", [(-w / 2 + 0.02, 0, h - 0.01), (-w / 2 + 0.03, 0, h + 0.03),
                            (w / 8, 0, h + 0.03), (w / 8 + 0.01, 0, h - 0.01)], 0.009, mat, col,
         sides=8, bend_radius=0.02, parent=g)
    box(f"{name}_Label", (w * 0.75, 0.001, h * 0.45), (0, -d / 2 - 0.0005, h * 0.45), L.label_white,
        col, bevel=0.0, parent=g)
    return g


# ---------------------------------------------------------------- tool chest

def build_tool_chest(L):
    y_c = 10.45
    x_back = C.X1
    rot = math.radians(-90)
    g = group("ToolChest_Rolling", COL, loc=(x_back - 0.02, y_c, 0.0), rot=(0, 0, rot))
    w, d = 1.07, 0.62
    # roller cabinet body
    zb = 0.13
    hc = 1.0
    box("ToolChest_Roller_Body", (w, d - 0.03, hc - zb), (0, -d / 2, zb + (hc - zb) / 2), L.tool_red,
        COL, bevel=0.006, segments=3, parent=g)
    drawer_stack(g, "ToolChest_Roller", w - 0.05, d + 0.002, zb + 0.02, hc - 0.03,
                 [0.07, 0.07, 0.07, 0.10, 0.10, 0.14, 0.2], L, front_mat=L.tool_red, pull_mat=L.alu_brushed)
    box("ToolChest_Roller_Top_Mat", (w - 0.01, d - 0.04, 0.012), (0, -d / 2, hc + 0.006), L.rubber_mat,
        COL, bevel=0.003, parent=g)
    box("ToolChest_Roller_Side_Handle_Bar", (0.02, 0.03, 0.03), (w / 2 + 0.03, -d / 2, hc - 0.05),
        L.chrome, COL, bevel=0.004, parent=g)
    pipe("ToolChest_Roller_Push_Handle", [(w / 2, -0.10, hc - 0.05), (w / 2 + 0.06, -0.10, hc - 0.05),
                                         (w / 2 + 0.06, -d + 0.10, hc - 0.05), (w / 2, -d + 0.10, hc - 0.05)],
         0.012, L.chrome, COL, sides=12, bend_radius=0.03, parent=g)
    for sx in (-1, 1):
        for sy in (0.08, d - 0.08):
            caster(g, "ToolChest_Caster", (sx * (w / 2 - 0.07), -sy, 0.0), L)
    # top chest
    zt = hc + 0.012
    ht = 0.50
    box("ToolChest_Top_Body", (w, d - 0.08, ht), (0, -(d - 0.08) / 2 - 0.02, zt + ht / 2), L.tool_red,
        COL, bevel=0.006, segments=3, parent=g)
    drawer_stack(g, "ToolChest_Top", w - 0.05, d - 0.08 + 0.022, zt + 0.02, zt + ht - 0.12,
                 [0.08, 0.08, 0.08, 0.1, 0.1], L, front_mat=L.tool_red, pull_mat=L.alu_brushed)
    box("ToolChest_Top_Lid", (w, d - 0.08, 0.10), (0, -(d - 0.08) / 2 - 0.02, zt + ht + 0.05 - 0.10),
        L.tool_red, COL, bevel=0.01, segments=3, parent=g)
    box("ToolChest_Top_Lid_Handle", (0.5, 0.025, 0.02), (0, -(d - 0.08) - 0.035, zt + ht - 0.07),
        L.chrome, COL, bevel=0.006, parent=g)
    # stuff on the mat: impact wrench + socket rail
    _impact_wrench("ToolChest_Impact_Wrench", (0.25, -0.30, hc + 0.012), L, parent=g, rotz=0.4)
    box("ToolChest_Socket_Rail", (0.40, 0.03, 0.012), (-0.2, -0.40, hc + 0.018), L.plastic_red, COL,
        bevel=0.003, parent=g)
    for i in range(10):
        r = 0.009 + i * 0.0012
        cylinder("ToolChest_Socket", r, 0.03 + i * 0.002, (-0.38 + i * 0.038, -0.40, hc + 0.024 + (0.03 + i * 0.002) / 2),
                 L.chrome_tool, COL, verts=12, parent=g)
    return g


def _impact_wrench(name, loc, L, parent=None, rotz=0.0, col=COL):
    g = group(name, col, loc=loc, rot=(0, 0, rotz), parent=parent)
    cylinder(f"{name}_Motor", 0.04, 0.16, (0, 0, 0.17), L.plastic_black, col, rot=(0, math.radians(90), 0),
             verts=24, parent=g)
    cylinder(f"{name}_Anvil", 0.03, 0.05, (0.10, 0, 0.17), L.black_metal, col, rot=(0, math.radians(90), 0),
             verts=20, parent=g)
    box(f"{name}_Grip", (0.045, 0.04, 0.12), (-0.03, 0, 0.09), L.plastic_red, col, bevel=0.012, parent=g,
        rot=(0, math.radians(-12), 0))
    box(f"{name}_Battery", (0.11, 0.075, 0.06), (-0.02, 0, 0.03), L.plastic_black, col, bevel=0.01,
        parent=g)
    return g


# ---------------------------------------------------------------- bench items

def build_bench_items(L):
    # find the open-bench module position from the config run
    y = C.CAB_RUN_Y0
    bench = None
    sink_y = None
    for kind, w in C.CAB_RUN:
        if kind == "open_bench":
            bench = (y, y + w)
        if kind == "sink":
            sink_y = y + w / 2
        y += w + 0.002
    top_z = C.CAB_BASE_H + C.CAB_TOP_T
    xf = C.X1 - C.CAB_DEPTH - 0.025          # countertop front edge
    yb0, yb1 = bench
    # bench vise at the front edge of the open bench
    vg = group("Workshop_Bench_Vise", COL, loc=(xf + 0.12, yb0 + 0.25, top_z), rot=(0, 0, math.radians(90)))
    box("Vise_Base", (0.20, 0.20, 0.03), (0, 0, 0.015), L.steel_grey, COL, bevel=0.006, parent=vg)
    box("Vise_Body", (0.12, 0.30, 0.10), (0, -0.02, 0.09), L.plastic_blue, COL, bevel=0.012, segments=3,
        parent=vg)
    box("Vise_Jaw_Fixed", (0.16, 0.04, 0.08), (0, 0.11, 0.17), L.plastic_blue, COL, bevel=0.008, parent=vg)
    box("Vise_Jaw_Moving", (0.16, 0.04, 0.08), (0, -0.04, 0.17), L.plastic_blue, COL, bevel=0.008,
        parent=vg)
    for yy in (0.088, -0.018):
        box("Vise_Jaw_Plate", (0.15, 0.006, 0.04), (0, yy, 0.19), L.steel_bare, COL, bevel=0.001, parent=vg)
    cylinder("Vise_Screw", 0.012, 0.22, (0, -0.24, 0.10), L.chrome, COL, rot=(math.radians(90), 0, 0),
             verts=16, parent=vg)
    cylinder("Vise_Handle", 0.008, 0.26, (0, -0.33, 0.10), L.chrome, COL, rot=(0, math.radians(90), 0),
             verts=12, parent=vg)
    for s in (-1, 1):
        uv_sphere("Vise_Handle_Knob", 0.014, (s * 0.13, -0.33, 0.10), L.chrome, COL, 16, 8, parent=vg)
    box("Vise_Anvil", (0.09, 0.07, 0.03), (0, 0.17, 0.22), L.plastic_blue, COL, bevel=0.006, parent=vg)
    # battery charger + battery maintainer on the counter
    box("Workshop_Battery_Charger", (0.22, 0.16, 0.12), (xf + 0.20, yb1 - 0.30, top_z + 0.06), L.plastic_yellow,
        COL, bevel=0.015, segments=3)
    box("Workshop_Battery_Charger_Display", (0.002, 0.08, 0.04), (xf + 0.089, yb1 - 0.30, top_z + 0.08),
        L.plastic_black_gloss, COL, bevel=0.0)
    pipe("Workshop_Battery_Charger_Clamps_Lead", [(xf + 0.10, yb1 - 0.36, top_z + 0.03),
                                                 (xf + 0.03, yb1 - 0.45, top_z + 0.005),
                                                 (xf + 0.12, yb1 - 0.60, top_z + 0.006),
                                                 (xf + 0.22, yb1 - 0.55, top_z + 0.006)], 0.0045, L.plastic_red,
         COL, sides=8, bend_radius=0.05)
    # cordless drill + driver standing on the counter
    for i, dy in enumerate((0.55, 0.75)):
        dg = group(f"Workshop_Cordless_Tool_{i + 1}", COL, loc=(xf + 0.25, yb0 + dy, top_z),
                   rot=(0, 0, math.radians(100 + i * 30)))
        box("Cordless_Battery", (0.11, 0.075, 0.07), (0, 0, 0.035), L.plastic_black, COL, bevel=0.01, parent=dg)
        box("Cordless_Grip", (0.045, 0.04, 0.12), (0.02, 0, 0.13), L.plastic_red, COL, bevel=0.012, parent=dg)
        cylinder("Cordless_Motor", 0.035, 0.15, (0.07, 0, 0.21), L.plastic_red, COL,
                 rot=(0, math.radians(90), 0), verts=20, parent=dg)
        cylinder("Cordless_Chuck", 0.02, 0.05, (0.165, 0, 0.21), L.black_metal, COL,
                 rot=(0, math.radians(90), 0), verts=16, parent=dg)
    # paper towel holder on the slatwall + roll
    zt = top_z + 0.36
    cylinder("Workshop_Paper_Towel_Roll", 0.065, 0.28, (C.X1 - 0.10, yb1 - 0.55, zt), L.paper, COL,
             rot=(math.radians(90), 0, 0), verts=32)
    cylinder("Workshop_Paper_Towel_Rod", 0.008, 0.32, (C.X1 - 0.10, yb1 - 0.55, zt), L.chrome, COL,
             rot=(math.radians(90), 0, 0), verts=12)
    for s in (-1, 1):
        box("Workshop_Paper_Towel_Bracket", (0.09, 0.006, 0.03), (C.X1 - 0.065, yb1 - 0.55 + s * 0.16, zt),
            L.chrome, COL, bevel=0.002)
    # shop stool tucked under the bench
    sg = group("Workshop_Shop_Stool", COL, loc=(xf + 0.15, (yb0 + yb1) / 2 + 0.2, 0.0))
    lathe("Stool_Seat", [(0.0, 0.0), (0.17, 0.0), (0.18, 0.02), (0.18, 0.07), (0.16, 0.085), (0.0, 0.09)],
          L.leather_black, COL, loc=(0, 0, 0.52), segments=40, parent=sg)
    cylinder("Stool_Gas_Lift", 0.025, 0.30, (0, 0, 0.36), L.chrome, COL, verts=20, parent=sg)
    cylinder("Stool_Gas_Lift_Shroud", 0.032, 0.14, (0, 0, 0.23), L.plastic_black, COL, verts=20, parent=sg)
    for i in range(5):
        a = 2 * math.pi * i / 5
        pipe("Stool_Base_Leg", [(0, 0, 0.12), (0.26 * math.cos(a), 0.26 * math.sin(a), 0.085)], 0.014,
             L.alu_cast, COL, sides=10, parent=sg)
        cylinder("Stool_Caster", 0.025, 0.02, (0.26 * math.cos(a), 0.26 * math.sin(a), 0.03), L.plastic_black,
                 COL, rot=(0, math.radians(90), a), verts=16, parent=sg)
    lathe("Stool_Foot_Ring", [(0.21, -0.008), (0.218, 0.0), (0.21, 0.008), (0.202, 0.0)], L.chrome, COL,
          loc=(0, 0, 0.28), segments=48, parent=sg)
    # shop vac next to the tool chest
    vg = group("Workshop_Shop_Vac", COL, loc=(C.X1 - 0.95, 10.55, 0.0))
    lathe("ShopVac_Drum", [(0.0, 0.05), (0.21, 0.05), (0.23, 0.10), (0.23, 0.48), (0.21, 0.50), (0.0, 0.50)],
          L.plastic_red, COL, segments=40, parent=vg)
    lathe("ShopVac_Head", [(0.0, 0.49), (0.235, 0.49), (0.24, 0.53), (0.20, 0.62), (0.0, 0.63)],
          L.plastic_black, COL, segments=40, parent=vg)
    pipe("ShopVac_Handle", [(-0.10, 0, 0.62), (-0.10, 0, 0.67), (0.10, 0, 0.67), (0.10, 0, 0.62)], 0.012,
         L.plastic_black, COL, sides=10, bend_radius=0.03, parent=vg)
    pipe("ShopVac_Hose", [(0.23, 0, 0.35), (0.35, 0, 0.30), (0.40, 0.15, 0.10), (0.20, 0.35, 0.04),
                          (-0.10, 0.30, 0.04), (-0.22, 0.10, 0.35), (-0.15, 0.0, 0.60)], 0.02, L.plastic_black,
         COL, sides=12, bend_radius=0.12, parent=vg)
    for a in range(4):
        cylinder("ShopVac_Caster", 0.025, 0.02, (0.17 * math.cos(a * math.pi / 2 + 0.8),
                                                 0.17 * math.sin(a * math.pi / 2 + 0.8), 0.025),
                 L.plastic_black, COL, rot=(0, math.radians(90), 0), verts=16, parent=vg)
    # trash can (stainless step can) near the sink
    if sink_y is not None:
        tg = group("Workshop_Trash_Can", COL, loc=(xf - 0.30, sink_y + 0.60, 0.0))
        lathe("TrashCan_Body", [(0.0, 0.02), (0.15, 0.02), (0.165, 0.60), (0.0, 0.60)], L.stainless, COL,
              segments=40, parent=tg)
        lathe("TrashCan_Lid", [(0.0, 0.60), (0.17, 0.60), (0.168, 0.63), (0.12, 0.66), (0.0, 0.665)],
              L.stainless, COL, segments=40, parent=tg)
        box("TrashCan_Pedal", (0.10, 0.06, 0.02), (0, -0.17, 0.03), L.plastic_black, COL, bevel=0.005, parent=tg)
        lathe("TrashCan_Base", [(0.0, 0.0), (0.152, 0.0), (0.152, 0.025), (0.0, 0.025)], L.plastic_black, COL,
              segments=40, parent=tg)


# ---------------------------------------------------------------- slatwall tools

def build_slatwall_tools(L):
    y = C.CAB_RUN_Y0
    bench = None
    for kind, w in C.CAB_RUN:
        if kind == "open_bench":
            bench = (y, y + w)
        y += w + 0.002
    yb0, yb1 = bench
    xf = C.X1 - 0.019      # slatwall face
    pitch = 3 * C.IN
    top_z = C.CAB_BASE_H + C.CAB_TOP_T
    sw_z0 = top_z + 0.06 - C.CAB_TOP_T + C.CAB_TOP_T
    # wrench rack: 12 combination wrenches hanging on a rail
    zr = 1.62
    box("Slatwall_Wrench_Rail", (0.02, 0.62, 0.025), (xf - 0.012, yb0 + 0.42, zr), L.alu_brushed, COL,
        bevel=0.003)
    for i in range(12):
        ln = 0.13 + i * 0.012
        wy = yb0 + 0.14 + i * 0.05
        wg = group("Slatwall_Combination_Wrench", COL, loc=(xf - 0.03, wy, zr - 0.012))
        box("Wrench_Shank", (0.004, 0.012 + i * 0.0006, ln), (0, 0, -ln / 2 - 0.01), L.chrome_tool, COL,
            bevel=0.0015, parent=wg)
        lathe("Wrench_Box_End", [(0.008 + i * 0.0005, -0.003), (0.014 + i * 0.0008, -0.003),
                                 (0.014 + i * 0.0008, 0.003), (0.008 + i * 0.0005, 0.003)], L.chrome_tool, COL,
              loc=(0, 0, -0.005), rot=(0, math.radians(90), 0), segments=16, parent=wg)
        box("Wrench_Open_End", (0.005, 0.03 + i * 0.0012, 0.022), (0, 0, -ln - 0.02), L.chrome_tool, COL,
            bevel=0.003, parent=wg)
    # screwdriver holder with 8 drivers
    zs = 1.25
    box("Slatwall_Screwdriver_Holder", (0.05, 0.36, 0.02), (xf - 0.03, yb0 + 1.00, zs), L.plastic_black, COL,
        bevel=0.004)
    for i in range(8):
        sy = yb0 + 0.85 + i * 0.043
        cols = [L.plastic_red, L.plastic_yellow, L.plastic_red, L.plastic_black]
        lathe("Screwdriver_Handle", [(0.0, 0.0), (0.012, 0.0), (0.014, 0.02), (0.013, 0.09), (0.008, 0.10),
                                     (0.0, 0.10)], cols[i % 4], COL, loc=(xf - 0.03, sy, zs + 0.01),
              segments=12, share_key=f"sd_handle_{i % 4}")
        cylinder("Screwdriver_Shaft", 0.0035, 0.12 + (i % 3) * 0.04, (xf - 0.03, sy, zs - 0.06 - (i % 3) * 0.02),
                 L.chrome_tool, COL, verts=8)
    # hammers + pliers on hooks
    for i, (hy, hz) in enumerate(((yb0 + 1.30, 1.42), (yb0 + 1.40, 1.42))):
        pipe("Slatwall_Hook", [(xf, hy, hz), (xf - 0.08, hy, hz), (xf - 0.09, hy, hz + 0.02)], 0.003,
             L.chrome, COL, sides=8, bend_radius=0.01)
        hg = group("Slatwall_Hammer", COL, loc=(xf - 0.06, hy, hz + 0.01))
        box("Hammer_Head", (0.03, 0.03, 0.12), (0, 0, 0.0), L.steel_bare, COL, bevel=0.004, parent=hg,
            rot=(math.radians(90), 0, 0))
        cylinder("Hammer_Handle", 0.013, 0.30, (0, 0, -0.16), L.oak_z if i == 0 else L.rubber, COL, verts=12,
                 parent=hg)
    # cord reel (retractable) on the slatwall upper part
    rg = group("Slatwall_Extension_Cord_Reel", COL, loc=(xf - 0.09, yb1 - 0.25, 1.85),
               rot=(0, 0, math.radians(-90)))
    cylinder("CordReel_Housing", 0.17, 0.14, (0, 0, 0), L.plastic_yellow, COL, rot=(math.radians(90), 0, 0),
             verts=40, parent=rg)
    cylinder("CordReel_Hub", 0.06, 0.15, (0, 0, 0), L.plastic_black, COL, rot=(math.radians(90), 0, 0),
             verts=24, parent=rg)
    pipe("CordReel_Cord", [(0.0, -0.08, -0.17), (0.0, -0.10, -0.35), (0.0, -0.12, -0.55)], 0.005,
         L.plastic_yellow, COL, sides=8, bend_radius=0.05, parent=rg)
    box("CordReel_Plug", (0.03, 0.05, 0.06), (0.0, -0.12, -0.58), L.plastic_black, COL, bevel=0.008, parent=rg)
    # safety glasses + gloves box on a small slatwall shelf
    box("Slatwall_Shelf_Small", (0.20, 0.40, 0.012), (xf - 0.10, yb1 - 0.70, 1.20), L.cab, COL, bevel=0.003)
    box("Slatwall_Gloves_Box", (0.12, 0.25, 0.09), (xf - 0.08, yb1 - 0.72, 1.251), L.plastic_blue, COL,
        bevel=0.004)
    box("Slatwall_Gloves_Box_Opening", (0.06, 0.12, 0.002), (xf - 0.08, yb1 - 0.72, 1.297), L.felt, COL,
        bevel=0.0)


# ---------------------------------------------------------------- compressor + air line

def build_air_system(L):
    cx, cy = C.X0 + 0.45, 0.50
    g = group("Workshop_Air_Compressor", COL, loc=(cx, cy, 0.0))
    lathe("Compressor_Tank", [(0.0, 0.14), (0.20, 0.15), (0.26, 0.24), (0.27, 0.30), (0.27, 1.45),
                              (0.26, 1.52), (0.20, 1.60), (0.0, 1.62)], L.steel_grey, COL, segments=48,
          parent=g)
    for i in range(3):
        a = 2 * math.pi * i / 3
        box("Compressor_Leg", (0.06, 0.06, 0.18), (0.20 * math.cos(a), 0.20 * math.sin(a), 0.09), L.steel_grey,
            COL, bevel=0.005, parent=g)
        box("Compressor_Isolation_Pad", (0.10, 0.10, 0.02), (0.20 * math.cos(a), 0.20 * math.sin(a), 0.01),
            L.rubber, COL, bevel=0.004, parent=g)
    box("Compressor_Pump_Plate", (0.45, 0.35, 0.02), (0, 0.0, 1.63), L.steel_grey, COL, bevel=0.004, parent=g)
    cylinder("Compressor_Motor", 0.11, 0.26, (-0.08, 0.06, 1.76), L.plastic_black, COL,
             rot=(0, math.radians(90), 0), verts=32, parent=g)
    box("Compressor_Pump_Head", (0.16, 0.16, 0.20), (0.12, -0.05, 1.75), L.alu_cast, COL, bevel=0.01, parent=g)
    for k in range(6):
        box("Compressor_Pump_Fin", (0.18, 0.18, 0.006), (0.12, -0.05, 1.68 + k * 0.025), L.alu_cast, COL,
            bevel=0.001, parent=g)
    lathe("Compressor_Belt_Guard", [(0.0, -0.03), (0.16, -0.03), (0.16, 0.03), (0.0, 0.03)], L.plastic_red, COL,
          loc=(0.0, 0.17, 1.76), rot=(math.radians(90), 0, 0), segments=40, parent=g)
    box("Compressor_Pressure_Switch", (0.08, 0.06, 0.10), (-0.18, -0.12, 1.70), L.plastic_black, COL,
        bevel=0.008, parent=g)
    lathe("Compressor_Gauge", [(0.0, 0.0), (0.03, 0.0), (0.03, 0.02), (0.0, 0.02)], L.chrome, COL,
          loc=(-0.18, -0.16, 1.62), rot=(math.radians(90), 0, 0), segments=24, parent=g)
    box("Compressor_Label", (0.20, 0.001, 0.30), (0, -0.2705, 0.80), L.label_white, COL, bevel=0.0, parent=g)
    cylinder("Compressor_Drain_Valve", 0.008, 0.05, (0, -0.15, 0.13), L.brass, COL, verts=12, parent=g)
    # power whip to wall outlet
    pipe("Compressor_Power_Cord", [(cx - 0.18, cy, 1.70), (C.X0 + 0.03, cy, 1.70), (C.X0 + 0.03, cy, 1.25)],
         0.007, L.plastic_black, COL, sides=8, bend_radius=0.06)
    # blue aluminium air main up the wall, across the front wall at 3.0 m to the right wall
    blue = L.plastic_blue
    z_air = 3.05
    yw = 0.06
    pts = [(cx + 0.10, cy - 0.10, 1.62), (cx + 0.10, cy - 0.10, 1.95), (cx + 0.10, yw, 1.95),
           (cx + 0.10, yw, z_air), (C.MAN_DOOR_CENTER_X, yw, z_air)]
    pipe("Air_Line_Drop_Compressor", pts, 0.0125, blue, COL, sides=16, bend_radius=0.05)
    # run across the front wall, jogging above the overhead door track/header
    x_ohd_l = C.OHD_CENTER_X - C.OHD_WIDTH / 2 - 0.25
    z_hi = C.OHD_HEIGHT + 1.0 + 0.55
    pts = [(C.MAN_DOOR_CENTER_X, yw, z_air), (x_ohd_l, yw, z_air), (x_ohd_l, yw, z_hi),
           (C.X1 - 0.06, yw, z_hi), (C.X1 - 0.06, 0.40, z_hi), (C.X1 - 0.06, 0.40, 2.75)]
    pipe("Air_Line_Main", pts, 0.0125, blue, COL, sides=16, bend_radius=0.08)
    # pipe clips every ~1.2 m
    for x in (C.MAN_DOOR_CENTER_X + 0.3, -0.9):
        box("Air_Line_Clip", (0.03, 0.04, 0.04), (x, yw - 0.03, z_air), blue, COL, bevel=0.004)
    # filter/regulator + hose reel on the right wall above the uppers
    rx, ry, rz = C.X1 - 0.06, 0.40, 2.70
    box("Air_Filter_Regulator", (0.06, 0.08, 0.16), (rx - 0.01, ry, rz - 0.06), L.alu_cast, COL, bevel=0.008)
    lathe("Air_Regulator_Bowl", [(0.0, 0.0), (0.022, 0.01), (0.025, 0.08), (0.0, 0.09)], L.glass_lens, COL,
          loc=(rx - 0.01, ry, rz - 0.23), segments=20)
    hg = group("Air_Hose_Reel", COL, loc=(C.X1 - 0.02, 0.85, 2.55), rot=(0, 0, math.radians(-90)))
    box("HoseReel_Wall_Bracket", (0.30, 0.02, 0.30), (0, 0.0, 0.0), L.steel_grey, COL, bevel=0.004, parent=hg)
    cylinder("HoseReel_Drum_Side_A", 0.20, 0.008, (0, -0.06, 0), L.plastic_blue, COL,
             rot=(math.radians(90), 0, 0), verts=40, parent=hg)
    cylinder("HoseReel_Drum_Side_B", 0.20, 0.008, (0, -0.20, 0), L.plastic_blue, COL,
             rot=(math.radians(90), 0, 0), verts=40, parent=hg)
    cylinder("HoseReel_Hose_Coil", 0.17, 0.13, (0, -0.13, 0), L.plastic_yellow, COL,
             rot=(math.radians(90), 0, 0), verts=40, parent=hg)
    pipe("HoseReel_Hose_Drop", [(0.0, -0.13, -0.17), (0.02, -0.13, -0.60), (0.03, -0.13, -1.0)], 0.0055,
         L.plastic_yellow, COL, sides=8, bend_radius=0.1, parent=hg)
    box("HoseReel_Hose_Stop_Ball", (0.04, 0.04, 0.04), (0.03, -0.13, -1.02), L.plastic_black, COL,
        bevel=0.015, parent=hg)
    box("HoseReel_Air_Chuck", (0.016, 0.016, 0.10), (0.03, -0.13, -1.10), L.brass, COL, bevel=0.004, parent=hg)


# ---------------------------------------------------------------- floor equipment

def build_floor_equipment(L):
    # low-profile aluminium floor jack parked by the tool chest
    jg = group("Workshop_Floor_Jack", COL, loc=(C.X1 - 1.62, 9.95, 0.0), rot=(0, 0, math.radians(110)))
    for s in (-1, 1):
        box("FloorJack_Side_Plate", (0.70, 0.008, 0.09), (0, s * 0.11, 0.075), L.plastic_red, COL, bevel=0.003,
            parent=jg)
    box("FloorJack_Lift_Arm", (0.42, 0.13, 0.04), (0.20, 0, 0.07), L.alu_cast, COL, bevel=0.006, parent=jg,
        rot=(0, math.radians(-4), 0))
    cylinder("FloorJack_Saddle", 0.06, 0.03, (0.40, 0, 0.11), L.black_metal, COL, verts=24, parent=jg)
    cylinder("FloorJack_Pump", 0.03, 0.18, (-0.20, 0, 0.11), L.chrome, COL, rot=(0, math.radians(90), 0), verts=16,
             parent=jg)
    pipe("FloorJack_Handle", [(-0.30, 0, 0.11), (-0.75, 0, 0.75)], 0.017, L.plastic_red, COL, sides=12, parent=jg)
    box("FloorJack_Handle_Grip", (0.05, 0.05, 0.14), (-0.78, 0, 0.80), L.rubber, COL, bevel=0.015, parent=jg,
        rot=(0, math.radians(-45), 0))
    for sx, sy in ((0.30, 0.10), (0.30, -0.10), (-0.30, 0.13), (-0.30, -0.13)):
        cylinder("FloorJack_Wheel", 0.035, 0.03, (sx, sy, 0.035), L.plastic_black, COL,
                 rot=(math.radians(90), 0, 0), verts=20, parent=jg)
    # pair of jack stands
    for i in range(2):
        sg = group("Workshop_Jack_Stand", COL, loc=(C.X1 - 1.72 + i * 0.32, 10.62, 0.0))
        for k in range(4):
            a = math.pi / 4 + k * math.pi / 2
            pipe("JackStand_Leg", [(0.13 * math.cos(a), 0.13 * math.sin(a), 0.0),
                                   (0.03 * math.cos(a), 0.03 * math.sin(a), 0.32)], 0.012, L.plastic_red,
                 COL, sides=4, parent=sg)
        box("JackStand_Ratchet_Bar", (0.04, 0.04, 0.30), (0, 0, 0.42), L.steel_bare, COL, bevel=0.004, parent=sg)
        box("JackStand_Saddle", (0.07, 0.05, 0.03), (0, 0, 0.58), L.steel_bare, COL, bevel=0.004, parent=sg)
        pipe("JackStand_Handle", [(0.03, 0, 0.30), (0.10, 0, 0.33), (0.10, 0, 0.28)], 0.006, L.plastic_red, COL,
             sides=6, bend_radius=0.02, parent=sg)
    # padded creeper stored flat under the stair
    cg = group("Workshop_Creeper", COL, loc=(C.X0 + 0.55, 7.2, 0.0), rot=(0, 0, math.radians(4)))
    box("Creeper_Board", (0.48, 1.0, 0.035), (0, 0.0, 0.075), L.plastic_black, COL, bevel=0.012, parent=cg)
    box("Creeper_Pad", (0.42, 0.75, 0.03), (0, 0.08, 0.107), L.leather_black, COL, bevel=0.012, parent=cg)
    box("Creeper_Headrest", (0.30, 0.18, 0.05), (0, -0.38, 0.115), L.leather_black, COL, bevel=0.02, parent=cg)
    for sx in (-0.19, 0.19):
        for sy in (-0.42, 0.0, 0.42):
            cylinder("Creeper_Caster", 0.025, 0.02, (sx, sy, 0.03), L.plastic_black, COL,
                     rot=(0, math.radians(90), 0), verts=16, parent=cg)


# ---------------------------------------------------------------- detailing station

def build_detailing_station(L):
    """Left wall, front zone: shelving with detailing products and a cart."""
    x = C.X0
    y0, y1 = 1.55, 3.35
    g = group("Detailing_Station", COL)
    # two floating steel shelves (powder-coated) on wall standards
    for z in (1.35, 1.75):
        box_between(f"Detailing_Shelf_{int(z * 100)}", (x, y0, z - 0.02), (x + 0.30, y1, z), L.cab, COL,
                    bevel=0.003, share=False).parent = g
    for yy in (y0 + 0.2, (y0 + y1) / 2, y1 - 0.2):
        box("Detailing_Shelf_Standard", (0.012, 0.03, 0.80), (x + 0.006, yy, 1.45), L.alu_brushed, COL,
            bevel=0.002, parent=g)
        for z in (1.35, 1.75):
            box("Detailing_Shelf_Bracket", (0.26, 0.012, 0.04), (x + 0.14, yy, z - 0.04), L.alu_brushed, COL,
                bevel=0.002, parent=g)
    liquids = [L.plastic_red, L.plastic_blue, L.plastic_yellow, L.glass_bottle_green, L.plastic_white,
               L.plastic_orange, L.plastic_black]
    for z in (1.35, 1.75):
        yy = y0 + 0.09
        i = 0
        while yy < y1 - 0.08:
            if rng.random() < 0.72:
                spray_bottle("Detailing_Spray_Bottle", (x + 0.16, yy, z), L, liquids[(i + int(z * 10)) % len(liquids)],
                             parent=g, rotz=math.radians(-90 + rng.uniform(-15, 15)))
            else:
                jug("Detailing_Jug", (x + 0.15, yy, z), L, liquids[(i * 3) % len(liquids)], parent=g,
                    rotz=math.radians(90))
            yy += 0.10 + rng.uniform(0.0, 0.03)
            i += 1
    # stack of microfibre towels (folded) on the lower shelf end
    for k in range(6):
        box("Detailing_Microfiber_Towel", (0.20, 0.20, 0.018), (x + 0.15, y1 + 0.20, 1.10 + k * 0.019),
            L.fabric_towel if k % 2 == 0 else L.fabric_cushion, COL, bevel=0.008, parent=g)
    box_between("Detailing_Towel_Shelf", (x, y1 + 0.06, 1.07), (x + 0.30, y1 + 0.35, 1.09), L.cab, COL,
                bevel=0.003, share=False).parent = g
    # rolling detailing cart with buckets
    cg = group("Detailing_Cart", COL, loc=(x + 0.45, 2.45, 0.0))
    for z in (0.18, 0.55, 0.85):
        box("DetailCart_Tray", (0.42, 0.75, 0.03), (0, 0, z), L.plastic_black, COL, bevel=0.008, parent=cg)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cylinder("DetailCart_Post", 0.012, 0.75, (sx * 0.19, sy * 0.35, 0.50), L.chrome, COL, verts=12, parent=cg)
            cylinder("DetailCart_Caster", 0.035, 0.03, (sx * 0.19, sy * 0.35, 0.05), L.plastic_black, COL,
                     rot=(0, math.radians(90), 0), verts=16, parent=cg)
    for k, (bx, mat) in enumerate(((-0.17, L.plastic_red), (0.17, L.plastic_blue))):
        lathe("DetailCart_Bucket", [(0.0, 0.0), (0.13, 0.0), (0.15, 0.36), (0.145, 0.36), (0.125, 0.006),
                                    (0.0, 0.006)], mat, COL, loc=(0, bx, 0.195), segments=40, parent=cg)
        lathe("DetailCart_Grit_Guard", [(0.0, 0.0), (0.125, 0.0), (0.125, 0.01), (0.0, 0.01)], L.plastic_black,
              COL, loc=(0, bx, 0.25), segments=40, parent=cg)
    for k in range(4):
        spray_bottle("DetailCart_Spray", (-0.12 + k * 0.08, 0.20, 0.87), L, liquids[k], parent=cg)
    jug("DetailCart_Shampoo", (0.10, -0.22, 0.87), L, L.plastic_orange, parent=cg)
    # foam cannon + pressure washer hose reel on the wall
    pg = group("Detailing_Pressure_Washer_Reel", COL, loc=(x + 0.02, 4.1, 1.10), rot=(0, 0, math.radians(90)))
    box("PWReel_Bracket", (0.30, 0.02, 0.30), (0, 0.0, 0.0), L.steel_grey, COL, bevel=0.004, parent=pg)
    cylinder("PWReel_Drum", 0.20, 0.16, (0, -0.11, 0), L.steel_grey, COL, rot=(math.radians(90), 0, 0), verts=40,
             parent=pg)
    cylinder("PWReel_Hose", 0.17, 0.12, (0, -0.11, 0), L.rubber, COL, rot=(math.radians(90), 0, 0), verts=40, parent=pg)
    pipe("PWReel_Hose_Drop", [(0.0, -0.11, -0.17), (0.0, -0.13, -0.6), (0.05, -0.2, -1.05)], 0.006, L.rubber,
         COL, sides=8, bend_radius=0.1, parent=pg)
    box("PWReel_Wand", (0.04, 0.04, 0.55), (0.30, -0.10, -0.20), L.plastic_black, COL, bevel=0.01, parent=pg)


def build(L):
    build_tool_chest(L)
    build_bench_items(L)
    build_slatwall_tools(L)
    build_air_system(L)
    build_floor_equipment(L)
    build_detailing_station(L)
