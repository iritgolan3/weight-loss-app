"""
Small believable details:
  * 200 A panel (E3) with EMT conduit risers, disconnect
  * switch bank, opener push-button, alarm keypad by the man door
  * duplex receptacles around the walls (48" garage height), GFCI at the bench
  * 50 A RV receptacle beside the overhead door (E3: dedicated RV outlet)
  * fire extinguisher + sign, smoke/CO detector, security camera, Wi-Fi AP
  * trench drain at the overhead door, rubber wheel stops at the parking spots
"""

import math
from . import config as C
from .core import box, box_between, cylinder, pipe, lathe, group, uv_sphere, text

COL = "DETAILS"
R_LEFT, R_RIGHT, R_BACK, R_FRONT = math.radians(90), math.radians(-90), 0.0, math.radians(180)


def wall_plate(name, loc, rotz, L, kind="duplex", gang=1, mat=None):
    """Device + cover plate. Local frame: back on the wall (y=0), front -Y."""
    g = group(name, COL, loc=loc, rot=(0, 0, rotz))
    w = 0.07 + (gang - 1) * 0.046
    box(f"{name}_Plate", (w, 0.006, 0.115), (0, -0.003, 0), mat or L.plastic_white, COL, bevel=0.0025, parent=g)
    for k in range(gang):
        x = -w / 2 + 0.035 + k * 0.046
        if kind == "duplex" or kind == "gfci":
            for zz in (0.019, -0.019):
                box(f"{name}_Receptacle", (0.034, 0.004, 0.026), (x, -0.007, zz), mat or L.plastic_white, COL,
                    bevel=0.004, parent=g)
                for sx in (-0.006, 0.006):
                    box(f"{name}_Slot", (0.0018, 0.001, 0.008), (x + sx, -0.0092, zz + 0.002), L.felt, COL, bevel=0.0,
                        parent=g)
                box(f"{name}_Ground", (0.004, 0.001, 0.004), (x, -0.0092, zz - 0.007), L.felt, COL, bevel=0.0, parent=g)
            if kind == "gfci":
                box(f"{name}_GFCI_Buttons", (0.012, 0.002, 0.02), (x, -0.010, 0.0), L.plastic_grey, COL, bevel=0.001, parent=g)
        elif kind == "switch":
            box(f"{name}_Rocker", (0.024, 0.006, 0.062), (x, -0.008, 0), mat or L.plastic_white, COL, bevel=0.003,
                parent=g)
    return g


def build_electrical(L):
    # 200 A load centre on the left wall near the front corner
    pg = group("Electrical_Panel_200A", COL, loc=(C.X0, 1.08, 1.55), rot=(0, 0, R_LEFT))
    box("Panel_Enclosure", (0.36, 0.10, 0.92), (0, -0.05, 0), L.steel_grey, COL, bevel=0.004, parent=pg)
    box("Panel_Door", (0.34, 0.006, 0.80), (0, -0.103, -0.03), L.steel_grey, COL, bevel=0.002, parent=pg)
    box("Panel_Latch", (0.02, 0.01, 0.06), (0.14, -0.108, -0.03), L.chrome, COL, bevel=0.002, parent=pg)
    box("Panel_Label", (0.20, 0.001, 0.09), (0, -0.1065, 0.25), L.label_white, COL, bevel=0.0, parent=pg)
    for x in (-0.12, -0.04, 0.04, 0.12):
        pipe("Panel_EMT_Conduit", [(x, -0.04, 0.46), (x, -0.04, 4.6 - 1.55)], 0.0105, L.galv, COL, sides=10, parent=pg)
        for zz in (1.2, 2.4):
            box("Panel_Conduit_Strap", (0.03, 0.012, 0.02), (x, -0.025, zz), L.galv, COL, bevel=0.002, parent=pg)
    # switch bank + opener button + alarm keypad by the man door (front wall, interior)
    xs = C.MAN_DOOR_CENTER_X + C.MAN_DOOR_W / 2 + 0.17
    wall_plate("Switch_Bank_ManDoor", (xs, 0.0, 1.22), R_FRONT, L, kind="switch", gang=4)
    og = group("Garage_Door_Wall_Button", COL, loc=(xs + 0.20, 0.0, 1.30), rot=(0, 0, R_FRONT))
    box("Opener_Button_Body", (0.07, 0.025, 0.11), (0, -0.0125, 0), L.plastic_white, COL, bevel=0.006, parent=og)
    box("Opener_Button_Push", (0.045, 0.006, 0.045), (0, -0.027, 0.012), L.plastic_grey, COL, bevel=0.004, parent=og)
    box("Opener_Button_Light", (0.012, 0.004, 0.012), (0, -0.027, -0.035), L.neon_white, COL, bevel=0.002, parent=og)
    kg = group("Alarm_Keypad", COL, loc=(xs, 0.0, 1.48), rot=(0, 0, R_FRONT))
    box("Keypad_Body", (0.13, 0.025, 0.10), (0, -0.0125, 0), L.plastic_white, COL, bevel=0.008, parent=kg)
    box("Keypad_Screen", (0.07, 0.002, 0.03), (0, -0.0255, 0.025), L.plastic_black_gloss, COL, bevel=0.001, parent=kg)
    for i in range(12):
        box("Keypad_Key", (0.012, 0.003, 0.008), (-0.02 + (i % 3) * 0.02, -0.0265, -0.002 - (i // 3) * 0.012),
            L.plastic_grey, COL, bevel=0.001, parent=kg)
    # duplex receptacles at 48" around the bay
    k = 1
    for y in (2.3, 4.6):
        wall_plate(f"Receptacle_Left_{k:02d}", (C.X0, y, 1.22), R_LEFT, L)
        k += 1
    wall_plate("Receptacle_Front_Pier", (-1.25, 0.0, 1.22), R_FRONT, L)
    wall_plate("Receptacle_Post_Bay", (C.POST_X, C.MEZZ_FRONT_Y + 0.0825 - C.POST_SIZE / 2, 1.10), R_BACK, L,
               kind="gfci")
    for y in (11.75, 16.9):
        wall_plate(f"Receptacle_Bar_{k:02d}", (C.X0, y, 0.45), R_LEFT, L)
        k += 1
    wall_plate("Receptacle_TV_Wall", (C.TV_CENTER_X + 0.4, C.Y1 - 0.034, 1.30), R_BACK, L)
    for x in (-3.0, 0.5):
        wall_plate(f"Receptacle_Mezzanine_{k:02d}", (x, C.Y1, C.MEZZ_FFL + 0.40), R_BACK, L)
        k += 1
    # switches: bathroom, stair (3-way bottom + top), bar
    wall_plate("Switch_Bathroom", (C.X1 - C.BATH_W - 0.12, C.Y1 - C.BATH_D + 0.12, 1.22), R_LEFT, L, kind="switch")
    wall_plate("Switch_Stair_Bottom", (C.X0, C.STAIR_BOTTOM_Y - 0.45, 1.22), R_LEFT, L, kind="switch", gang=2)
    wall_plate("Switch_Stair_Top", (C.X0, C.MEZZ_FRONT_Y + 0.55, C.MEZZ_FFL + 1.22), R_LEFT, L, kind="switch", gang=2)
    # 50 A RV receptacle (weatherproof box) beside the overhead door
    xr = C.OHD_CENTER_X + C.OHD_WIDTH / 2 + 0.45
    rg = group("RV_Receptacle_50A", COL, loc=(xr, 0.0, 1.05), rot=(0, 0, R_FRONT))
    box("RV_Box", (0.16, 0.09, 0.22), (0, -0.045, 0), L.steel_grey, COL, bevel=0.006, parent=rg)
    box("RV_Cover_Lid", (0.14, 0.03, 0.12), (0, -0.10, 0.03), L.steel_grey, COL, bevel=0.006, parent=rg,
        rot=(math.radians(-15), 0, 0))
    box("RV_Breaker_Door", (0.10, 0.004, 0.05), (0, -0.092, -0.07), L.plastic_black, COL, bevel=0.002, parent=rg)
    pipe("RV_Conduit", [(0, -0.045, 0.11), (0, -0.045, 2.35)], 0.0135, L.galv, COL, sides=10, parent=rg)


def build_safety(L):
    # fire extinguisher on the front-wall pier with sign above
    fx = -1.75
    fg = group("Fire_Extinguisher", COL, loc=(fx, 0.0, 0.0), rot=(0, 0, R_FRONT))
    box("Extinguisher_Bracket", (0.08, 0.04, 0.12), (0, -0.02, 1.22), L.black_metal, COL, bevel=0.004, parent=fg)
    lathe("Extinguisher_Cylinder", [(0.0, 0.0), (0.065, 0.0), (0.068, 0.02), (0.068, 0.40), (0.05, 0.45), (0.018, 0.47),
                                    (0.0, 0.47)], L.red_paint, COL, loc=(0, -0.11, 0.86), segments=40, parent=fg)
    box("Extinguisher_Valve", (0.03, 0.06, 0.06), (0, -0.11, 1.36), L.chrome, COL, bevel=0.006, parent=fg)
    box("Extinguisher_Handle", (0.02, 0.12, 0.012), (0, -0.14, 1.40), L.black_metal, COL, bevel=0.003, parent=fg)
    pipe("Extinguisher_Hose", [(0.02, -0.12, 1.34), (0.06, -0.14, 1.20), (0.06, -0.16, 0.98)], 0.007, L.rubber, COL,
         sides=8, bend_radius=0.05, parent=fg)
    lathe("Extinguisher_Gauge", [(0.0, 0.0), (0.014, 0.0), (0.014, 0.006), (0.0, 0.006)], L.chrome, COL,
          loc=(0, -0.145, 1.35), rot=(math.radians(90), 0, 0), segments=16, parent=fg)
    box("Extinguisher_Label", (0.08, 0.001, 0.12), (0, -0.1795, 1.06), L.label_white, COL, bevel=0.0, parent=fg)
    box("Extinguisher_Sign", (0.20, 0.004, 0.28), (0, -0.002, 1.75), L.red_paint, COL, bevel=0.002, parent=fg)
    t = text("Extinguisher_Sign_Text", "FIRE\nEXT.", 0.05, (0, -0.0045, 1.74), L.label_white, COL,
             rot=(math.radians(90), 0, 0), parent=fg)
    # smoke / CO detector under the mezzanine soffit + bay ceiling (on a joist bottom chord)
    for i, (x, y, z) in enumerate(((-1.2, 13.4, C.MEZZ_SOFFIT_Z), (0.4, 6.1, C.DECK_Z - C.JOIST_DEPTH + 0.0))):
        lathe(f"Smoke_CO_Detector_{i + 1:02d}", [(0.0, 0.0), (0.065, 0.0), (0.065, -0.03), (0.05, -0.045), (0.0, -0.047)],
              L.plastic_white, COL, loc=(x, y, z), segments=40)
        cylinder(f"Smoke_CO_Detector_LED_{i + 1:02d}", 0.003, 0.002, (x + 0.03, y, z - 0.047), L.neon_red, COL, verts=8)
    # interior security cameras (dome) in the bay corners
    for i, (x, y, z) in enumerate(((C.X1 - 0.25, 10.6, C.MEZZ_SOFFIT_Z - 0.0), (C.X0 + 0.25, 0.30, 4.0))):
        cg = group(f"Security_Camera_{i + 1:02d}", COL, loc=(x, y, z))
        if i == 0:
            lathe("SecCam_Base", [(0.0, 0.0), (0.06, 0.0), (0.06, -0.02), (0.0, -0.02)], L.plastic_white, COL,
                  segments=32, parent=cg)
            uv_sphere("SecCam_Dome", 0.045, (0, 0, -0.025), L.glass_car, COL, 24, 12, scale=(1, 1, 0.8), parent=cg)
        else:
            box("SecCam_Mount", (0.05, 0.10, 0.05), (0.05, 0.0, 0.0), L.plastic_white, COL, bevel=0.01, parent=cg,
                rot=(0, 0, math.radians(90)))
            box("SecCam_Body", (0.07, 0.16, 0.07), (0.10, 0.10, -0.04), L.plastic_white, COL, bevel=0.02, parent=cg,
                rot=(math.radians(-20), 0, math.radians(-30)))
            box("SecCam_Lens", (0.05, 0.01, 0.05), (0.13, 0.18, -0.07), L.glass_car, COL, bevel=0.01, parent=cg,
                rot=(math.radians(-20), 0, math.radians(-30)))
    # Wi-Fi access point on the soffit
    lathe("WiFi_Access_Point", [(0.0, 0.0), (0.10, 0.0), (0.10, -0.025), (0.09, -0.032), (0.0, -0.033)],
          L.plastic_white, COL, loc=(0.6, 14.6, C.MEZZ_SOFFIT_Z), segments=40)


def build_floor_details(L):
    # trench drain just inside the overhead door
    x0 = C.OHD_CENTER_X - C.OHD_WIDTH / 2 + 0.05
    x1 = C.OHD_CENTER_X + C.OHD_WIDTH / 2 - 0.05
    yd = 0.42
    tg = group("Trench_Drain", COL)
    box_between("Trench_Drain_Channel_Shadow", (x0, yd - 0.06, -0.06), (x1, yd + 0.06, -0.002), L.felt, COL, bevel=0,
                share=False).parent = tg
    for nm, a, b in (("Frame_N", (x0 - 0.01, yd + 0.06, -0.003), (x1 + 0.01, yd + 0.07, 0.0005)),
                     ("Frame_S", (x0 - 0.01, yd - 0.07, -0.003), (x1 + 0.01, yd - 0.06, 0.0005))):
        box_between(f"Trench_Drain_{nm}", a, b, L.stainless, COL, bevel=0.0005, share=False).parent = tg
    n = int((x1 - x0) / 0.5)
    for i in range(n):
        gx0 = x0 + i * (x1 - x0) / n + 0.002
        gx1 = x0 + (i + 1) * (x1 - x0) / n - 0.002
        g = group("Trench_Drain_Grate", COL, parent=tg)
        box_between("Trench_Drain_Grate_Frame", (gx0, yd - 0.058, -0.004), (gx1, yd + 0.058, 0.0), L.stainless, COL,
                    bevel=0.0005, share=True).parent = g
        k = 0
        x = gx0 + 0.02
        while x < gx1 - 0.02:
            box("Trench_Drain_Grate_Slot", (0.008, 0.09, 0.0012), (x, yd, -0.0004), L.felt, COL, bevel=0.0, parent=g)
            x += 0.018
    # rubber wheel stops ahead of each car's front tyres
    for spec in C.CARS:
        prof_front = 0.95
        y_front_axle = spec["y_rear"] + spec["length"] - prof_front
        ys = y_front_axle + spec["wheel_d"] / 2 + 0.16
        for s in (-1, 1):
            xw = spec["x"] + s * (spec["width"] / 2 - 0.15)
            wg = group(f"Wheel_Stop_{spec['name'][:6]}", COL, loc=(xw, ys, 0.0))
            prof = [(-0.09, 0.0), (0.09, 0.0), (0.06, 0.09), (-0.06, 0.09)]
            from .core import prism
            prism("Wheel_Stop_Rubber", prof, 0.55, L.rubber_mat, COL, loc=(-0.275, 0.0, 0.0),
                  rot=(math.radians(90), 0, math.radians(90)), parent=wg, bevel=0.01)
            for zz in (-0.15, 0.15):
                box("Wheel_Stop_Reflector", (0.10, 0.002, 0.03), (zz, -0.0751, 0.045), L.plastic_yellow, COL, bevel=0.0,
                    parent=wg, rot=(math.radians(-18), 0, 0))


def build(L):
    build_electrical(L)
    build_safety(L)
    build_floor_details(L)
