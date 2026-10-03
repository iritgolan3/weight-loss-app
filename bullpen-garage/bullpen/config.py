"""
Layout and style parameters for The Bullpen reconstruction.

Every value tagged ASSUMPTION could not be checked against the source video
(see RECONSTRUCTION_PLAN.md, section 0). Fix those values against real frames,
then re-run build_bullpen.py. The other modules read their dimensions from
here.

Coordinate system: metres; origin at the top of the floor coating, middle of
the front wall's interior face. +X runs left to right looking in from the
overhead door, +Y runs toward the back wall, +Z is up.
"""

FT = 0.3048
IN = 0.0254

# ---------------------------------------------------------------- shell
# ASSUMPTION: 30 x 60 ft interior. WheelHouse suites run from ~700 sq ft to
# several thousand sq ft (search evidence E4).
WIDTH = 30 * FT            # 9.144 m interior, wall face to wall face
DEPTH = 60 * FT            # 18.288 m interior
X0, X1 = -WIDTH / 2, WIDTH / 2
Y0, Y1 = 0.0, DEPTH

WALL_T = 0.20              # side/back wall thickness rendered (CMU + furring)
FRONT_WALL_T = 0.25
SLAB_T = 6 * IN            # E3: 6" structural slab
DECK_Z = 6.40              # ASSUMPTION: underside of roof deck (~21 ft)
JOIST_DEPTH = 0.56
JOIST_SPACING = 5 * FT     # 1.524 m
WALL_FINISH = "drywall"    # ASSUMPTION
CEILING_COLOR = (0.86, 0.86, 0.85)  # ASSUMPTION: white-painted exposed structure

# saw-cut control joints (ASSUMPTION: ~15 ft grid)
SLAB_JOINTS_X = [0.0]
SLAB_JOINTS_Y = [4.572, 9.144, 13.716]

# ---------------------------------------------------------------- front wall
# E3: 14' tall insulated panel door. ASSUMPTION: 12' wide, offset right.
OHD_WIDTH = 12 * FT
OHD_HEIGHT = 14 * FT
OHD_CENTER_X = 1.10
OHD_SECTIONS = 7
OHD_WINDOW_ROW = 5        # 1-based section index from the bottom that has lites
OHD_OPEN_FRACTION = 0.0   # 0 = closed, 1 = fully open (rolls onto the high-lift track)

# E3: insulated steel man door. ASSUMPTION: 3'x7', left side.
MAN_DOOR_W = 3 * FT
MAN_DOOR_H = 7 * FT
MAN_DOOR_CENTER_X = -3.20

# ---------------------------------------------------------------- mezzanine
# E5: mezzanine with a central structural post. ASSUMPTION: full width,
# 24 ft deep, at the back of the unit.
MEZZ_FRONT_Y = DEPTH - 24 * FT     # 10.97 m
MEZZ_FFL = 3.20                    # finished floor level
MEZZ_FINISH_T = 0.006             # LVP
MEZZ_SUBFLOOR_T = 0.019           # 3/4" plywood
MEZZ_STEEL_TOP = MEZZ_FFL - MEZZ_FINISH_T - MEZZ_SUBFLOOR_T
MEZZ_JOIST_DEPTH = 8 * IN         # W8 joists
MEZZ_SOFFIT_Z = MEZZ_STEEL_TOP - MEZZ_JOIST_DEPTH - 0.03 - 0.016  # furring + drywall
GIRDER_DEPTH = 12.2 * IN           # W12 front girder
GIRDER_FLANGE = 6.5 * IN
POST_SIZE = 6 * IN                 # HSS6x6 central post
POST_X = 0.0                       # ASSUMPTION: exactly centred on the width
JOIST_SPACING_MEZZ = 4 * FT
GUARD_HEIGHT = 42 * IN
GUARD_STYLE = "pickets"            # ASSUMPTION: "pickets" | "glass" | "cable"
PICKET_SPACING = 0.115             # centre-to-centre; < 4" clear opening

# ---------------------------------------------------------------- stair
# ASSUMPTION: straight run along the left wall, rising toward the back.
STAIR_WIDTH = 42 * IN
STAIR_RISERS = 18
STAIR_RISE = MEZZ_FFL / STAIR_RISERS          # 0.1778 m
STAIR_GOING = 0.280
STAIR_TREAD_T = 0.040
STAIR_X0 = X0                                  # against left wall
STAIR_TOP_Y = MEZZ_FRONT_Y
STAIR_BOTTOM_Y = STAIR_TOP_Y - (STAIR_RISERS - 1) * STAIR_GOING

# ---------------------------------------------------------------- cabinets
# ASSUMPTION: powder-coated steel modular garage cabinets along the right wall.
CAB_DEPTH = 24 * IN
CAB_BASE_H = 0.865
CAB_TOE = 0.10
CAB_TOP_T = 0.038
CAB_UPPER_BOTTOM = 1.45
CAB_UPPER_H = 0.76
CAB_UPPER_DEPTH = 14 * IN
CAB_TALL_H = 2.21
CAB_GAP = 0.003                 # reveal between fronts
CAB_RUN_Y0 = 0.95
CAB_RUN_Y1 = 10.40
CAB_COLOR = (0.035, 0.037, 0.040)     # ASSUMPTION: graphite/black
CAB_ACCENT = (0.62, 0.63, 0.64)      # brushed aluminium trim
COUNTER_STYLE = "stainless"           # ASSUMPTION: "stainless" | "butcher_block"

# Base-run module list (front to back): (type, width_m)
CAB_RUN = [
    ("tall_locker", 0.762),
    ("drawer_5", 0.762),
    ("drawer_3_wide", 0.914),
    ("door_2", 0.914),
    ("sink", 0.914),
    ("drawer_5", 0.762),
    ("open_bench", 1.524),
    ("drawer_3_wide", 0.914),
    ("door_2", 0.762),
    ("tall_locker", 0.762),
]

# ---------------------------------------------------------------- lounge / bar
# ASSUMPTION: TV wall on the back wall, bar on the left wall, bath at back right.
BATH_W = 2.60
BATH_D = 2.70
TV_SIZE_IN = 75
TV_CENTER_X = -0.37
SOFA_Y = 15.05
BAR_X_FACE = X0 + 2.20        # customer side of the bar
BAR_Y0, BAR_Y1 = 11.85, 15.60

# ---------------------------------------------------------------- vehicles
# ASSUMPTION: two cars, nose-in toward the lounge.
CARS = [
    dict(name="Car_01_RearEngineCoupe", kind="rear_engine", x=-1.55, y_rear=2.25,
         length=4.573, width=1.852, height=1.300, wheelbase=2.450,
         color=(0.42, 0.010, 0.012), metallic=0.15, wheel_d=0.69, rim_in=20),
    dict(name="Car_02_FrontEngineGT", kind="front_engine", x=1.80, y_rear=2.05,
         length=4.700, width=1.950, height=1.280, wheelbase=2.700,
         color=(0.42, 0.43, 0.44), metallic=0.85, wheel_d=0.70, rim_in=20),
]

# ---------------------------------------------------------------- lighting
LIGHT_BAY_K = 5000
LIGHT_LOUNGE_K = 3000
LIGHT_BAR_K = 2700
LIGHT_UNDERCAB_K = 4000
SUN_ELEVATION_DEG = 38
SUN_ROTATION_DEG = 20     # sun lamp azimuth so light enters through the door lites

# ---------------------------------------------------------------- render
RENDER_W = 1600
RENDER_H = 900
RENDER_SAMPLES = 192
