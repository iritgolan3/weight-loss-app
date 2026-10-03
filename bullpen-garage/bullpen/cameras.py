"""
Cameras approximating typical walk-through tour viewpoints, plus scale
reference empties and dimension labels (REFERENCE collection, hidden from
render).

The viewpoints are generic tour framings (entrance push-in, wide bay, lounge,
mezzanine overlook, workshop). Match them to real frames of the video once
it can be reviewed: set location/target/lens in CAMERAS below.
"""

import math
import bpy
from . import config as C
from .core import new_object, look_at_euler, empty, text, collection

COL = "CAMERAS"
REF = "REFERENCE"

# name: (location, target, focal length mm, exposure EV)
CAMERAS = {
    "Camera_Entrance":      ((0.12, 0.45, 1.65), (-0.35, 12.0, 2.05), 16, 0.35),
    "Camera_Main_Garage":   ((3.75, 0.75, 2.75), (-2.2, 10.5, 1.6), 15, 0.25),
    "Camera_Lounge":        ((2.85, 11.55, 1.45), (-1.2, 17.6, 1.15), 15, 0.45),
    "Camera_Mezzanine":     ((3.05, 17.55, 4.85), (-0.8, 4.5, 1.5), 15, 0.15),
    "Camera_Workshop":      ((3.25, 1.05, 1.62), (4.25, 7.6, 1.05), 17, 0.35),
    "Camera_Stair":         ((-1.6, 4.4, 1.55), (-4.0, 10.6, 3.3), 16, 0.35),
    "Camera_Bar":           ((-0.3, 11.75, 1.55), (-4.3, 14.6, 1.55), 17, 0.45),
    "Camera_Mezzanine_Office": ((-0.55, 13.95, 4.55), (1.45, 10.9, 3.55), 20, 0.35),
    "Camera_Overview_Rear": ((-3.6, 17.6, 5.45), (1.5, 2.0, 0.6), 14, 0.15),
}


def build(L):
    for name, (loc, tgt, lens, ev) in CAMERAS.items():
        cd = bpy.data.cameras.new(name)
        cd.lens = lens
        cd.sensor_width = 36.0
        cd.clip_start = 0.05
        cd.clip_end = 250.0
        cd.dof.use_dof = False
        obj = new_object(name, cd, COL, loc, look_at_euler(loc, tgt))
        obj["exposure"] = ev
        obj["target"] = tgt
    bpy.context.scene.camera = bpy.data.objects["Camera_Entrance"]
    build_references(L)


def build_references(L):
    """Scale references: empties at key heights plus readable labels."""
    refs = [
        ("REF_ManDoor_Height_2134mm", (C.MAN_DOOR_CENTER_X, 0.05, C.MAN_DOOR_H)),
        ("REF_OverheadDoor_Height_4267mm", (C.OHD_CENTER_X, 0.10, C.OHD_HEIGHT)),
        ("REF_RoofDeck_Underside_%dmm" % round(C.DECK_Z * 1000), (0.0, 5.0, C.DECK_Z)),
        ("REF_Joist_Bottom_%dmm" % round((C.DECK_Z - C.JOIST_DEPTH) * 1000), (0.0, 5.0, C.DECK_Z - C.JOIST_DEPTH)),
        ("REF_Mezzanine_FFL_%dmm" % round(C.MEZZ_FFL * 1000), (0.0, C.MEZZ_FRONT_Y + 0.5, C.MEZZ_FFL)),
        ("REF_Mezzanine_Soffit_%dmm" % round(C.MEZZ_SOFFIT_Z * 1000), (0.0, 14.0, C.MEZZ_SOFFIT_Z)),
        ("REF_Guard_Height_1067mm", (2.0, C.MEZZ_FRONT_Y + 0.05, C.MEZZ_FFL + C.GUARD_HEIGHT)),
        ("REF_Counter_Height_%dmm" % round((C.CAB_BASE_H + C.CAB_TOP_T) * 1000), (C.X1 - 0.3, 5.0, C.CAB_BASE_H + C.CAB_TOP_T)),
        ("REF_Stair_Rise_%dmm_Going_%dmm" % (round(C.STAIR_RISE * 1000), round(C.STAIR_GOING * 1000)),
         (C.X0 + 0.5, C.STAIR_BOTTOM_Y, C.STAIR_RISE)),
    ]
    for spec in C.CARS:
        refs.append((f"REF_{spec['name']}_Length_{round(spec['length'] * 1000)}mm",
                     (spec["x"], spec["y_rear"] + spec["length"], 0.05)))
    for name, loc in refs:
        e = empty(name, REF, loc, size=0.3, kind='SINGLE_ARROW')
        label = name.replace("REF_", "").replace("_", " ")
        t = text(f"{name}_Label", label, 0.08, (loc[0], loc[1], loc[2] + 0.06), None, REF,
                 rot=(math.radians(90), 0, 0), to_mesh=False)
        t.parent = None
    # overall bounding dimensions as an empty cube
    box = empty("REF_Interior_Volume_%dx%dmm" % (round(C.WIDTH * 1000), round(C.DEPTH * 1000)), REF,
                (0.0, C.DEPTH / 2, C.DECK_Z / 2), size=1.0, kind='CUBE')
    box.scale = (C.WIDTH / 2, C.DEPTH / 2, C.DECK_Z / 2)
