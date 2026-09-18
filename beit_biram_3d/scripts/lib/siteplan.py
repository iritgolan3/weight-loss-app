"""The Beit Biram site plan — single source of truth for the campus layout.

Coordinates: metres, +X east, +Y north, origin at the middle of the walled campus.
The campus is ~250 x 205 m = ~51,000 m^2, matching the documented ~50 dunam.

LAYOUT EVIDENCE (see REFERENCES.md):
  * "ממערבה לבניין בירם (לקראת הכניסה) מצויים בניין הספרייה, מרכזי מחשבים
     ותקשורת ומתחם המדעים" -> the library, computer/communications centres and the
     science complex lie WEST of the Biram Building, toward the entrance.
     => main entrance on the WEST (Abba Hushi Blvd frontage);
        Biram Building EAST of the entrance cluster.
  * "בקצהו הצפוני של הקמפוס מתחם הספורט ולידו המכלול הפדגוגי ובניין הרוח והרעות"
     -> sports complex at the NORTH end, with the pedagogical complex and the
        Ruach ve-Re'ut building BESIDE it.
  * "רוב הבניינים בקמפוס מקושרים על ידי שדרת הפרגולה" -> a pergola avenue links
     most of the buildings: modelled here as an east-west spine with branches.
  * "הקמפוס מוקף חומת בטון" -> a continuous concrete acoustic wall on the frontages.

Exact footprints, storey counts and window grids are RECONSTRUCTIONS (tier B in
REFERENCES.md) sized from era, function and the documented 50-dunam envelope.
"""

# ---------------------------------------------------------------- site bounds
SITE_X0, SITE_X1 = -125.0, 125.0
SITE_Y0, SITE_Y1 = -101.0, 101.0

# streets bounding the campus (documented: Abba Hushi, Einstein, Yaarot)
ST_ABBA_HUSHI_X = -141.0     # west frontage, runs N-S; campus address is No. 15
ST_EINSTEIN_Y = -117.0       # south frontage, runs E-W
ST_YAAROT_X = 141.0          # east frontage, runs N-S

# ------------------------------------------------------------------- terraces
# Mount Carmel hillside: the ground falls from the south-east down to the north.
# (x0, y0, x1, y1, level_z, blend_margin)
TERRACES = [
    ("SOUTH_ARRIVAL", -138, -112, 138, -52, 9.0, 9.0),
    ("CORE",          -138,  -48, 138,  18, 4.5, 8.0),
    ("TRANSITION",    -138,   22, 138,  40, 0.5, 7.0),
    ("SPORTS",        -138,   44, 138, 112, -4.5, 9.0),
]

REGIONAL_FALL_N = 0.085     # ground drops ~8.5% toward the north (toward the sea)
REGIONAL_FALL_W = 0.010     # and very gently toward the west

# ------------------------------------------------------------------ buildings
# name, (x0, y0, x1, y1), terrace level z, storeys, note
BUILDINGS = {
    # --- core academic row, south of the pergola spine (terrace CORE, z=4.5) ---
    "LIBRARY_REICH":      dict(rect=(-98, -42, -56, -14), z=4.5, floors=3,
                               era=1967, style="modern_concrete"),
    "SCIENCE_COMPLEX":    dict(rect=(-46, -42,  -6, -14), z=4.5, floors=3,
                               era=1970, style="brutalist"),
    "BIRAM_BUILDING":     dict(rect=(  6, -40,  66, -14), z=4.5, floors=3,
                               era=1940, style="international"),
    "ARCHIVE":            dict(rect=( 76, -38, 106, -18), z=4.5, floors=2,
                               era=2004, style="stone_modern"),
    # --- north of the spine ---
    "COMPUTER_CENTRE":    dict(rect=(-104,   6, -58,  30), z=4.5, floors=2,
                               era=1955, style="modern_concrete"),
    "PEVZNER_HALL":       dict(rect=(-46,    4,   2,  40), z=4.5, floors=1,
                               era=1962, style="suspended_roof"),
    "OPEN_UNIVERSITY":    dict(rect=( 14,    6,  58,  32), z=4.5, floors=2,
                               era=1985, style="brutalist"),
    # --- north end, beside the sports complex (terrace SPORTS, z=-4.5) ---
    "SPORTS_HALL":        dict(rect=( -8,   48,  48,  96), z=-4.5, floors=1,
                               era=1955, style="sports"),
    "PEDAGOGICAL":        dict(rect=( 56,   46, 102,  70), z=-4.5, floors=2,
                               era=1990, style="brutalist"),
    "RUACH_VERE_UT":      dict(rect=( 56,   76, 108, 100), z=-4.5, floors=3,
                               era=2022, style="contemporary"),
    # --- south arrival zone (terrace SOUTH_ARRIVAL, z=9.0) ---
    "KINDERGARTEN":       dict(rect=(-40,  -94,   6, -66), z=9.0, floors=1,
                               era=2000, style="pavilion"),
    "MAINTENANCE":        dict(rect=( 46,  -92,  96, -66), z=9.0, floors=1,
                               era=1980, style="utility"),
    "GATEHOUSE":          dict(rect=(-122, -26, -114, -14), z=4.5, floors=1,
                               era=1990, style="utility"),
}

# ------------------------------------------------------------------ open areas
SPORTS = dict(
    sprint_track=(-114, 46, -9, 55),        # 6 straight lanes, red polyurethane
    pitch=(-110, 57, -20, 101),             # 90 x 44 synthetic-turf football pitch
    parade=(-40, 22, 40, 40),               # מסדרים — paved assembly ground
    courts=(50, 22, 112, 40),               # outdoor basketball, two courts
)

PARKING = dict(
    main=(-118, -96, -62, -58),
    east=(100, -96, 120, -60),
)

# main lawns — the documented "wide lawns between the buildings"
LAWNS = [
    (-56, -12, -46, 2),
    (-104, -12, -100, 2),
    (-6, -12, 6, 2),
    (-98, -10, 66, 2),        # the long spine lawn
    (-46, -12, 6, 2),
    (-40, 42, 40, 44),
]

# ------------------------------------------------------------------- circulation
# The pergola avenue: an east-west spine at y = 0 with branches serving each
# building group and running north to the sports complex.
PERGOLA_SPINE = [(-112, 0), (100, 0)]
PERGOLA_BRANCHES = [
    [(-77, 0), (-77, 6)],            # to the computer centre
    [(-77, 0), (-77, -14)],          # to the library
    [(-26, 0), (-26, 4)],            # to Pevzner Hall
    [(-26, 0), (-26, -14)],          # to the science complex
    [(36, 0), (36, -14)],            # to the Biram Building
    [(36, 0), (36, 6)],              # to the Open University wing
    [(20, 0), (20, 22), (20, 44)],   # north, down to the sports complex
    [(-112, 0), (-112, -14)],        # from the main gate
]

# main paths (not pergola-covered)
PATHS = [
    [(-125, -20), (-112, -20), (-112, 0)],                 # main gate approach
    [(-90, 0), (-90, 22), (-60, 22), (-60, 42)],
    [(88, 0), (88, -18)],
    [(20, 44), (20, 60), (-8, 60)],
    [(-95, -48), (-95, -58)],                              # down to the car park
    [(60, -48), (60, -60), (60, -66)],
    [(-20, 40), (-20, 44)],
    [(74, 40), (74, 46)],
]

# ------------------------------------------------------------------- boundary
GATES = [
    dict(name="MAIN_PEDESTRIAN", pos=(-125, -20), width=9.0, axis="x"),
    dict(name="VEHICLE_SOUTHWEST", pos=(-125, -76), width=7.0, axis="x"),
    dict(name="SERVICE_EAST", pos=(125, -78), width=7.0, axis="x"),
    dict(name="SPORTS_NORTH", pos=(20, 101), width=6.0, axis="y"),
]

WALL_HEIGHT = 3.2          # documented concrete acoustic wall
WALL_THICK = 0.35


def rect_center(r):
    return ((r[0] + r[2]) / 2.0, (r[1] + r[3]) / 2.0)


def rect_size(r):
    return (r[2] - r[0], r[3] - r[1])
