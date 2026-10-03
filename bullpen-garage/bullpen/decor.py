"""
Wall decor and memorabilia: framed automotive prints (left wall, stair
gallery, mezzanine, bathroom wall), vintage metal sign, keys rack, desk
keepsakes. All artwork is generated (tools/make_textures.py).
"""

import math
from . import config as C
from .core import box, cylinder, lathe, group, uv_sphere, pipe
from . import props

COL = "DECOR"


def build(L):
    r_left = math.radians(90)     # frame front (-Y) faces +X on the left wall
    r_right = math.radians(-90)   # frame front faces -X on the right wall
    r_back = 0.0                  # frame front faces -Y on the back wall
    r_front = math.radians(180)   # frame front faces +Y on the front wall
    xl = C.X0 + 0.0
    # left wall above the detailing shelves
    props.picture_frame("Poster_Grand_Prix", 0.66, 0.92, "poster_grand_prix.jpg", (xl, 1.95, 2.70), r_left, L, COL)
    props.picture_frame("Poster_Endurance", 0.66, 0.92, "poster_endurance.jpg", (xl, 2.95, 2.70), r_left, L, COL)
    # vintage enamel sign (no glazing, painted steel)
    props.picture_frame("Sign_Speed_Shop", 0.96, 0.64, "sign_speed_shop.jpg", (xl, 5.05, 2.05), r_left, L, COL,
                        frame_w=0.012, depth=0.012, mat_border=0.0, glass=False, mat_frame=L.steel_grey, gloss=True)
    # stair gallery: three prints stepping up with the stair
    for i, (img, y) in enumerate((("poster_blueprint.jpg", 7.15), ("poster_track_map.jpg", 8.45),
                                  ("poster_bullpen.jpg", 9.75))):
        # centred ~1.55 m above the stair nosing line at that point
        z = C.STAIR_RISE * (1 + (y - C.STAIR_BOTTOM_Y) / C.STAIR_GOING) + 1.55
        w, h = (1.02, 0.66) if "blueprint" in img else (0.58, 0.80)
        props.picture_frame(f"Stair_Gallery_Print_{i + 1:02d}", w, h, img, (xl, y, z), r_left, L, COL,
                            mat_frame=L.walnut)
    # mezzanine: two prints over the loveseat
    zm = C.MEZZ_FFL + 1.55
    props.picture_frame("Mezzanine_Print_01", 0.62, 0.86, "poster_endurance.jpg", (xl, 15.35, zm), r_left, L, COL,
                        mat_frame=L.walnut)
    props.picture_frame("Mezzanine_Print_02", 0.62, 0.86, "poster_grand_prix.jpg", (xl, 16.45, zm), r_left, L, COL,
                        mat_frame=L.walnut)
    # bathroom wall facing the bay: track map print
    props.picture_frame("Bath_Wall_Print", 0.70, 0.95, "poster_track_map.jpg",
                        (C.X1 - C.BATH_W / 2, C.Y1 - C.BATH_D - 0.12, 1.55), r_back,
                        L, COL)
    # right wall, mezzanine level: blueprint over the storage rack
    props.picture_frame("Mezzanine_Blueprint", 1.10, 0.72, "poster_blueprint.jpg", (C.X1, 14.4, C.MEZZ_FFL + 1.6),
                        r_right, L, COL, mat_frame=L.black_metal)
    # key rack by the man door (front wall, interior side)
    kg = group("Key_Rack", COL, loc=(C.MAN_DOOR_CENTER_X + 0.85, 0.0, 1.55), rot=(0, 0, r_front))
    box("Key_Rack_Board", (0.30, 0.02, 0.12), (0, -0.01, 0), L.walnut, COL, bevel=0.004, parent=kg)
    for k in range(4):
        x = -0.11 + k * 0.073
        pipe("Key_Rack_Hook", [(x, -0.02, -0.02), (x, -0.05, -0.02), (x, -0.055, 0.005)], 0.003, L.brass, COL, sides=8,
             bend_radius=0.008, parent=kg)
        if k in (0, 2):
            box("Key_Fob", (0.035, 0.012, 0.07), (x, -0.055, -0.06), L.plastic_black, COL, bevel=0.008, parent=kg)
            lathe("Key_Ring", [(0.012, -0.0015), (0.0135, 0.0), (0.012, 0.0015), (0.0105, 0.0)], L.chrome, COL,
                  loc=(x, -0.055, -0.018), rot=(0, math.radians(90), 0), segments=20, parent=kg)
    # baseball keepsake in an acrylic cube on the desk side of the shelving (name nod)
    bg = group("Keepsake_Baseball_Cube", COL, loc=(0.45, C.Y1 - 0.17, C.MEZZ_FFL + 0.45))
    box("Keepsake_Cube_Acrylic", (0.09, 0.09, 0.09), (0, 0, 0.055), L.glass, COL, bevel=0.003, parent=bg)
    box("Keepsake_Cube_Base", (0.09, 0.09, 0.012), (0, 0, 0.006), L.black_metal, COL, bevel=0.002, parent=bg)
    uv_sphere("Keepsake_Baseball", 0.0365, (0, 0, 0.05), L.plastic_white, COL, 24, 12, parent=bg)
