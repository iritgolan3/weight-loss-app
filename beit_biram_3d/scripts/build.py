#!/usr/bin/env python3
"""Generate the Beit Biram campus .blend from scratch.

    python3 scripts/build.py [--out out/beit_biram.blend] [--light]

Everything is procedural: no external assets, no textures on disk.
"""
import os
import sys
import math
import random
import argparse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))

import core
from core import MeshBuilder, coll, link_dup, make_template
import materials as M
import arch
import props
import veg
import buildings as B
import siteplan as SP
import terrain as T
from arch import (M_WALL, M_WALL2, M_FRAME, M_GLASS, M_METAL, M_ROOF, M_SOFFIT,
                  M_ACCENT, M_DARK)

bpy = core.bpy
RNG = random.Random(20250918)
GZ = T.ground_z

# set by --lite: thins the planting for a lighter viewport scene
LITE = False


# --------------------------------------------------------------------------
# material palettes
# --------------------------------------------------------------------------

def building_mats(style):
    """Nine materials in the arch slot order, varied by architectural era."""
    frame = M.aluminium()
    glass = M.glass()
    metal = M.metal_paint()
    roof = M.roof_membrane()
    dark = M.rubber_dark()
    if style == "international":          # 1940s Biram Building: white render
        return [M.plaster_white(), M.plaster_cream(), M.metal_paint(
            "METAL_WindowSteel", (0.20, 0.21, 0.22), 0.38), glass, metal, roof,
            M.plaster_cream(), M.limestone(), dark]
    if style == "brutalist":              # bare unplastered concrete
        return [M.concrete_board(), M.concrete_board(), frame, glass, metal,
                M.roof_gravel(), M.concrete_board("CONCRETE_Soffit", tone=0.30),
                M.limestone(), dark]
    if style == "modern_concrete":        # 1955 / 1967
        return [M.concrete_board("CONCRETE_Fair", tone=0.44, board_h=0.90),
                M.concrete_board("CONCRETE_Fair", tone=0.44, board_h=0.90),
                frame, glass, metal, roof,
                M.concrete_board("CONCRETE_Soffit", tone=0.30),
                M.limestone(), dark]
    if style == "suspended_roof":         # Pevzner Hall
        return [M.concrete_board("CONCRETE_Fair", tone=0.44, board_h=0.90),
                M.concrete_board("CONCRETE_Fair", tone=0.44, board_h=0.90),
                frame, glass, metal,
                M.concrete_board("CONCRETE_Roof", tone=0.47, board_h=1.6),
                M.concrete_board("CONCRETE_Soffit", tone=0.30),
                M.limestone(), dark]
    if style == "stone_modern":           # 2004 archive
        return [M.limestone(), M.concrete_board("CONCRETE_Fair", tone=0.44,
                                                board_h=0.90), frame, glass,
                metal, roof, M.concrete_board("CONCRETE_Soffit", tone=0.30),
                M.limestone(), dark]
    if style == "contemporary":           # 2022 Ruach ve-Re'ut
        return [M.plaster_white("PLASTER_Light", (0.86, 0.855, 0.83)),
                M.concrete_board("CONCRETE_Fair", tone=0.44, board_h=0.90),
                frame, M.glass("GLASS_Curtain", (0.55, 0.66, 0.70), 0.015),
                frame, roof, M.plaster_cream(), M.limestone(), dark]
    if style == "sports":
        return [M.concrete_board("CONCRETE_Fair", tone=0.44, board_h=0.90),
                M.concrete_board("CONCRETE_Fair", tone=0.44, board_h=0.90),
                frame, glass, metal, M.steel_galv(),
                M.concrete_board("CONCRETE_Soffit", tone=0.30),
                M.limestone(), dark]
    if style == "pavilion":
        return [M.plaster_white("PLASTER_Kinder", (0.84, 0.80, 0.70)),
                M.plaster_cream(), frame, glass, metal, M.roof_membrane(),
                M.plaster_cream(), M.wood(), dark]
    return [M.concrete_board(), M.concrete_board(), frame, glass, metal, roof,
            M.concrete_board("CONCRETE_Soffit", tone=0.30), M.limestone(), dark]


PROP_MATS = None


def prop_mats():
    global PROP_MATS
    if PROP_MATS is None:
        PROP_MATS = [
            M.concrete_board("CONCRETE_Precast", tone=0.50, board_h=1.4),  # 0
            M.steel_galv(),                                                # 1
            M.wood(),                                                      # 2
            M.metal_paint("METAL_DarkGreen", (0.055, 0.105, 0.075), 0.40),  # 3
            M.glass(),                                                     # 4
            M.rubber_dark(),                                               # 5
            M.sign_white(),                                                # 6
            M.emissive(),                                                  # 7
        ]
    return PROP_MATS


# --------------------------------------------------------------------------
# terrain & ground surfaces
# --------------------------------------------------------------------------

def build_terrain():
    c = coll("BEIT_BIRAM/TERRAIN")
    mb = MeshBuilder()

    def mat_of(x, y):
        inside = (SP.SITE_X0 < x < SP.SITE_X1 and SP.SITE_Y0 < y < SP.SITE_Y1)
        if not inside:
            d = min(abs(x - SP.SITE_X0), abs(x - SP.SITE_X1),
                    abs(y - SP.SITE_Y0), abs(y - SP.SITE_Y1))
            return 2 if d > 26 else 1          # rock/scrub beyond, soil at the edge
        return 0                                # campus lawn

    n = T.build_terrain(mb, -215, -185, 215, 185, step=2.5, mat_map=mat_of)
    ob = mb.to_object("TERRAIN_Carmel", c,
                      mats=[M.grass(), M.soil(), M.rock_carmel()])
    core.add_smooth_by_angle(ob, 38)
    return ob, n


def build_ground_surfaces():
    """Paving, roads, car parks and sports surfaces laid over the terrain."""
    c = coll("BEIT_BIRAM/PATHS")
    mb = MeshBuilder()
    PAV, ASPH, TRACK, COURT, TURF, LINE, SOIL = 0, 1, 2, 3, 4, 5, 6

    # entrance plaza
    T.pad(mb, (-124, -32, -100, 4), T.ground_z(-112, -14) + 0.02, mat=PAV)
    # forecourts in front of each building
    for name, d in SP.BUILDINGS.items():
        if name in ("MAINTENANCE", "GATEHOUSE"):
            continue
        x0, y0, x1, y1 = d["rect"]
        T.pad(mb, (x0 - 3.5, y0 - 5.5, x1 + 3.5, y0 - 0.2), d["z"] + 0.02, mat=PAV)
        T.pad(mb, (x0 - 3.0, y1 + 0.2, x1 + 3.0, y1 + 3.5), d["z"] + 0.02, mat=PAV)

    # the pergola spine and its branches are paved
    def strip(path, w, mat, zoff=0.03):
        for i in range(len(path) - 1):
            (ax, ay), (bx, by) = path[i], path[i + 1]
            L = math.hypot(bx - ax, by - ay)
            if L < 0.2:
                continue
            ux, uy = (bx - ax) / L, (by - ay) / L
            nx, ny = -uy * w / 2, ux * w / 2
            n = max(1, int(L / 4.0))
            for k in range(n):
                t0, t1 = k / n, (k + 1) / n
                px0, py0 = ax + (bx - ax) * t0, ay + (by - ay) * t0
                px1, py1 = ax + (bx - ax) * t1, ay + (by - ay) * t1
                z0 = T.ground_z(px0, py0) + zoff
                z1 = T.ground_z(px1, py1) + zoff
                mb.quad((px0 + nx, py0 + ny, z0), (px1 + nx, py1 + ny, z1),
                        (px1 - nx, py1 - ny, z1), (px0 - nx, py0 - ny, z0), mat)

    strip(SP.PERGOLA_SPINE, 4.6, PAV)
    for br in SP.PERGOLA_BRANCHES:
        strip(br, 3.8, PAV)
    for p in SP.PATHS:
        strip(p, 2.8, PAV)

    # car parks and the service road
    for k, r in SP.PARKING.items():
        T.pad(mb, r, T.ground_z(*SP.rect_center(r)) + 0.02, mat=ASPH)
    strip([(-125, -76), (-60, -76), (-60, -60)], 7.0, ASPH)
    strip([(125, -78), (96, -78)], 7.0, ASPH)

    # --- sports surfaces ---
    sp = SP.SPORTS
    zs = -4.5
    T.pad(mb, sp["sprint_track"], zs + 0.03, mat=TRACK)
    T.pad(mb, sp["pitch"], zs + 0.03, mat=TURF)
    T.pad(mb, sp["parade"], 0.5 + 0.03, mat=PAV)
    T.pad(mb, sp["courts"], 0.5 + 0.03, mat=COURT)

    # markings
    _pitch_lines(mb, sp["pitch"], zs + 0.05, LINE)
    _track_lines(mb, sp["sprint_track"], zs + 0.05, LINE)
    _court_lines(mb, sp["courts"], 0.5 + 0.05, LINE)

    ob = mb.to_object("GROUND_Surfaces", c, mats=[
        M.paving_slab(), M.asphalt(), M.track_rubber(), M.court_surface(),
        M.synthetic_turf(), M.line_paint(), M.soil()])
    return ob


def _band(mb, x0, y0, x1, y1, z, mat, w=0.10):
    mb.box(min(x0, x1) - w / 2, min(y0, y1) - w / 2,
           z, max(x0, x1) + w / 2, max(y0, y1) + w / 2, z + 0.012, mat)


def _pitch_lines(mb, rect, z, mat):
    x0, y0, x1, y1 = rect
    m = 2.5
    a, b, c, d = x0 + m, y0 + m, x1 - m, y1 - m
    for (p, q, r, s) in ((a, b, c, b), (a, d, c, d), (a, b, a, d), (c, b, c, d)):
        _band(mb, p, q, r, s, z, mat)
    cx = (a + c) / 2
    _band(mb, cx, b, cx, d, z, mat)
    # centre circle
    R = 9.15
    seg = 40
    for i in range(seg):
        t0 = 2 * math.pi * i / seg
        t1 = 2 * math.pi * (i + 1) / seg
        _band(mb, cx + R * math.cos(t0), (b + d) / 2 + R * math.sin(t0),
              cx + R * math.cos(t1), (b + d) / 2 + R * math.sin(t1), z, mat)
    # penalty areas
    for s in (a, c):
        sgn = 1 if s == a else -1
        _band(mb, s + sgn * 16.5, (b + d) / 2 - 20, s + sgn * 16.5,
              (b + d) / 2 + 20, z, mat)
        _band(mb, s, (b + d) / 2 - 20, s + sgn * 16.5, (b + d) / 2 - 20, z, mat)
        _band(mb, s, (b + d) / 2 + 20, s + sgn * 16.5, (b + d) / 2 + 20, z, mat)


def _track_lines(mb, rect, z, mat):
    x0, y0, x1, y1 = rect
    lanes = 6
    for i in range(lanes + 1):
        yy = y0 + (y1 - y0) * i / lanes
        _band(mb, x0, yy, x1, yy, z, mat, w=0.06)
    for xx in (x0 + 2.0, x1 - 2.0):
        _band(mb, xx, y0, xx, y1, z, mat, w=0.10)


def _court_lines(mb, rect, z, mat):
    x0, y0, x1, y1 = rect
    for k in range(2):
        cx0 = x0 + 2.0 + k * ((x1 - x0) / 2)
        cx1 = cx0 + 28.0
        cy0, cy1 = y0 + 2.0, y0 + 17.0
        if cx1 > x1 - 1 or cy1 > y1 - 1:
            continue
        for (p, q, r, s) in ((cx0, cy0, cx1, cy0), (cx0, cy1, cx1, cy1),
                             (cx0, cy0, cx0, cy1), (cx1, cy0, cx1, cy1)):
            _band(mb, p, q, r, s, z, mat, w=0.06)
        mx = (cx0 + cx1) / 2
        _band(mb, mx, cy0, mx, cy1, z, mat, w=0.06)
        R = 1.8
        for i in range(24):
            t0 = 2 * math.pi * i / 24
            t1 = 2 * math.pi * (i + 1) / 24
            _band(mb, mx + R * math.cos(t0), (cy0 + cy1) / 2 + R * math.sin(t0),
                  mx + R * math.cos(t1), (cy0 + cy1) / 2 + R * math.sin(t1), z,
                  mat, w=0.05)


# --------------------------------------------------------------------------
# buildings
# --------------------------------------------------------------------------

BUILDERS = {
    "BIRAM_BUILDING":  (B.biram_building, {}),
    "PEVZNER_HALL":    (B.pevzner_hall, {}),
    "LIBRARY_REICH":   (B.library_reich, {}),
    "SCIENCE_COMPLEX": (B.brutalist_block, dict(fins=True, reliefs=True)),
    "COMPUTER_CENTRE": (B.computer_centre, {}),
    "ARCHIVE":         (B.archive, {}),
    "OPEN_UNIVERSITY": (B.brutalist_block, dict(fins=False, reliefs=True)),
    "SPORTS_HALL":     (B.sports_hall, {}),
    "PEDAGOGICAL":     (B.brutalist_block, dict(fins=True, reliefs=True)),
    "RUACH_VERE_UT":   (B.ruach_vereut, {}),
    "KINDERGARTEN":    (B.kindergarten, {}),
    "MAINTENANCE":     (B.utility_shed, {}),
    "GATEHOUSE":       (B.gatehouse, {}),
}

HISTORIC = {"BIRAM_BUILDING", "PEVZNER_HALL", "LIBRARY_REICH", "COMPUTER_CENTRE"}


def build_buildings():
    made = []
    for i, (name, d) in enumerate(SP.BUILDINGS.items()):
        fn, kw = BUILDERS[name]
        kwargs = dict(kw)
        if fn in (B.brutalist_block,):
            kwargs["floors"] = d["floors"]
        kwargs["seed"] = 100 + i
        mb = fn(d["rect"], d["z"], **kwargs)
        group = "HISTORIC_BUILDINGS" if name in HISTORIC else "BUILDINGS"
        c = coll(f"BEIT_BIRAM/{group}/{name}")
        ob = mb.to_object(name, c, mats=building_mats(d["style"]))
        # Curved surfaces -- Pevzner's hung roof, the sports-hall barrel vault,
        # the Biram stair drum -- are built from many near-coplanar faces and
        # read as faceted bands when flat-shaded. Smoothing below 26 degrees
        # rounds them off while every wall corner and window reveal stays crisp.
        core.add_smooth_by_angle(ob, 26)
        made.append(ob)

    # the indoor pool inside the sports hall
    r = SP.BUILDINGS["SPORTS_HALL"]["rect"]
    z = SP.BUILDINGS["SPORTS_HALL"]["z"]
    pmb = MeshBuilder()
    B.swimming_pool(pmb, (r[0] + 8, r[1] + 5, r[0] + 33, r[1] + 17.5), z + 0.4)
    ob = pmb.to_object("SPORTS_HALL_Pool", coll("BEIT_BIRAM/BUILDINGS/SPORTS_HALL"),
                       mats=[M.concrete_board("CONCRETE_Fair", tone=0.44,
                                              board_h=0.90)] * 3 +
                            [M.water_pool()] * 6)
    made.append(ob)
    return made


# --------------------------------------------------------------------------
# the pergola avenue — documented as linking most of the campus buildings
# --------------------------------------------------------------------------

def build_pergola():
    c = coll("BEIT_BIRAM/PATHS/PERGOLA")
    mb = MeshBuilder()
    arch.pergola(mb, SP.PERGOLA_SPINE, GZ, width=4.4, post_every=4.0,
                 height=3.25, post=0.28, beam=0.24)
    for br in SP.PERGOLA_BRANCHES:
        arch.pergola(mb, br, GZ, width=3.6, post_every=3.6, height=3.1,
                     post=0.24, beam=0.20)
    con = M.concrete_board("CONCRETE_Pergola", tone=0.46, board_h=1.1)
    ob = mb.to_object("PERGOLA_Avenue", c, mats=[con] * 9)
    return ob


# --------------------------------------------------------------------------
# boundary: the concrete acoustic wall, fences and gates
# --------------------------------------------------------------------------

def _boundary_runs():
    """Perimeter polyline, broken at the gate openings."""
    x0, y0, x1, y1 = SP.SITE_X0, SP.SITE_Y0, SP.SITE_X1, SP.SITE_Y1
    gaps = {}
    for g in SP.GATES:
        gaps.setdefault(g["axis"], []).append((g["pos"], g["width"]))
    runs = []

    def split_vertical(x, ya, yb):
        cuts = [(p[1], w) for (p, w) in gaps.get("x", []) if abs(p[0] - x) < 1.0]
        pts = [ya]
        for (cy, w) in sorted(cuts):
            pts += [cy - w / 2, cy + w / 2]
        pts.append(yb)
        for i in range(0, len(pts) - 1, 2):
            if pts[i + 1] - pts[i] > 1.0:
                runs.append([(x, pts[i]), (x, pts[i + 1])])

    def split_horizontal(y, xa, xb):
        cuts = [(p[0], w) for (p, w) in gaps.get("y", []) if abs(p[1] - y) < 1.0]
        pts = [xa]
        for (cx, w) in sorted(cuts):
            pts += [cx - w / 2, cx + w / 2]
        pts.append(xb)
        for i in range(0, len(pts) - 1, 2):
            if pts[i + 1] - pts[i] > 1.0:
                runs.append([(pts[i], y), (pts[i + 1], y)])

    split_vertical(x0, y0, y1)
    split_vertical(x1, y0, y1)
    split_horizontal(y0, x0, x1)
    split_horizontal(y1, x0, x1)
    return runs


def build_boundary():
    c = coll("BEIT_BIRAM/STREET/BOUNDARY")
    mb = MeshBuilder()
    runs = _boundary_runs()
    for r in runs:
        # the road frontages get the documented solid acoustic wall; the
        # quieter north edge behind the sports ground gets steel palisade
        is_north = abs(r[0][1] - SP.SITE_Y1) < 1.0
        if is_north:
            props.palisade_fence(mb, r, GZ, height=2.6, mat=props.P_PAINT)
        else:
            props.acoustic_wall(mb, r, GZ, height=SP.WALL_HEIGHT,
                                thick=SP.WALL_THICK, panel=4.2)
    for g in SP.GATES:
        gx, gy = g["pos"]
        ang = math.pi / 2 if g["axis"] == "x" else 0.0
        props.sliding_gate(mb, gx, gy, GZ(gx, gy), width=g["width"],
                           height=2.4, ang=ang,
                           open_frac=0.30 if "MAIN" in g["name"] else 0.0)
        for s in (-1, 1):
            px = gx + (0 if g["axis"] == "x" else s * (g["width"] / 2 + 0.8))
            py = gy + (s * (g["width"] / 2 + 0.8) if g["axis"] == "x" else 0)
            mb.box(px - 0.45, py - 0.45, GZ(px, py) - 0.4, px + 0.45, py + 0.45,
                   GZ(px, py) + 3.6, props.P_CONCRETE)
    # controlled pedestrian entry beside the main gate
    props.turnstile(mb, -122.0, -14.0, GZ(-122, -14), ang=0.0)
    props.turnstile(mb, -122.0, -26.0, GZ(-122, -26), ang=0.0)

    ob = mb.to_object("BOUNDARY_Wall_Fences_Gates", c, mats=prop_mats())
    return ob


def build_retaining():
    """Retaining walls along the terrace edges, with connecting flights."""
    c = coll("BEIT_BIRAM/TERRAIN/RETAINING")
    mb = MeshBuilder()
    con = M.concrete_board("CONCRETE_Retaining", tone=0.40, board_h=0.75)
    # bench faces: south->core, core->transition, transition->sports
    for (y, top_z) in ((-50.0, 9.0), (20.0, 4.5), (42.0, 0.5)):
        T.retaining_wall(mb, [(SP.SITE_X0 + 1, y), (SP.SITE_X1 - 1, y)],
                         top_z=top_z, thick=0.55, mat=0, coping=True)
    # steps down through each retaining wall, aligned with the main paths
    for (y, top_z, lower) in ((-50.0, 9.0, 4.5), (20.0, 4.5, 0.5),
                              (42.0, 0.5, -4.5)):
        drop = top_z - lower
        n = max(2, int(round(drop / 0.165)))
        for sx in (-95.0, -20.0, 20.0, 60.0):
            arch.stairs(mb, sx - 2.5, y, top_z - n * 0.165, 5.0, n,
                        rise=0.165, run=0.32, ang=0.0, mat=0)
            arch.railing(mb, [(sx - 2.7, y), (sx - 2.7, y + n * 0.32)],
                         top_z - n * 0.165, height=1.05, mat=1)
            arch.railing(mb, [(sx + 2.7, y), (sx + 2.7, y + n * 0.32)],
                         top_z - n * 0.165, height=1.05, mat=1)
        # an accessible ramp beside the middle flight
        arch.ramp(mb, 34.0, y, lower, top_z, 2.4, drop / 0.06, ang=math.pi / 2,
                  mat=0)
    ob = mb.to_object("RETAINING_Walls_Steps", c,
                      mats=[con, M.metal_paint("METAL_Handrail",
                                               (0.62, 0.62, 0.60), 0.44)] + [con] * 7)
    return ob


# --------------------------------------------------------------------------
# vegetation
# --------------------------------------------------------------------------

def _camera_keepout(x, y):
    """Keep planting off the camera viewpoints and their near sight lines.

    The planting is dense enough that a tree will otherwise land on top of a
    camera or directly in front of it, which is how the Biram Building view
    ended up as a wall of canopy.
    """
    for name, loc, target, lens in CAMERAS:
        if loc[2] > 40.0:                 # aerials look down over everything
            continue
        cx, cy = loc[0], loc[1]
        if math.hypot(x - cx, y - cy) < 11.0:
            return True
        tx, ty = target[0], target[1]
        dx, dy = tx - cx, ty - cy
        L = math.hypot(dx, dy)
        if L < 1e-3:
            continue
        t = ((x - cx) * dx + (y - cy) * dy) / (L * L)
        if 0.0 < t < 1.05:
            px, py = cx + dx * t, cy + dy * t
            # a corridor that widens with distance, matching the cone of view
            if math.hypot(x - px, y - py) < 7.0 + 5.0 * t:
                return True
    return False


def _blocked(x, y, margin=3.0, keepout=True):
    """True where a tree must not be planted.

    `keepout` guards the camera sight lines. Ground cover passes False:
    tufts and low shrubs are exactly what a close-up wants in the
    foreground, and they are too small to block a view.
    """
    if keepout and _camera_keepout(x, y):
        return True
    for d in SP.BUILDINGS.values():
        x0, y0, x1, y1 = d["rect"]
        if x0 - margin < x < x1 + margin and y0 - margin < y < y1 + margin:
            return True
    for r in list(SP.SPORTS.values()) + list(SP.PARKING.values()):
        x0, y0, x1, y1 = r
        if x0 - 2 < x < x1 + 2 and y0 - 2 < y < y1 + 2:
            return True
    # keep the pergola route and its paving clear
    for seg in [SP.PERGOLA_SPINE] + SP.PERGOLA_BRANCHES:
        for i in range(len(seg) - 1):
            ax, ay = seg[i]
            bx, by = seg[i + 1]
            L = math.hypot(bx - ax, by - ay)
            if L < 1e-3:
                continue
            t = max(0, min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (L * L)))
            px, py = ax + (bx - ax) * t, ay + (by - ay) * t
            if math.hypot(x - px, y - py) < 3.6:
                return True
    # the entrance plaza stays open
    if -124 < x < -100 and -32 < y < 4:
        return True
    return False


def species():
    """Built lazily: material datablocks must be created after the scene reset."""
    return {
        "PINE":     (veg.pine_aleppo, M.bark(), M.foliage_pine(), (9.0, 14.0)),
        "CYPRESS":  (veg.cypress, M.bark("VEG_BarkCypress", (0.13, 0.10, 0.07)),
                     M.foliage_cypress(), (8.0, 13.0)),
        "FICUS":    (veg.broadleaf, M.bark(), M.foliage(), (7.5, 12.0)),
        "OLIVE":    (veg.olive, M.bark("VEG_BarkOlive", (0.17, 0.155, 0.125)),
                     M.foliage_olive(), (5.0, 7.5)),
        "PALM":     (veg.palm_washingtonia,
                     M.bark("VEG_BarkPalm", (0.20, 0.165, 0.12)),
                     M.foliage_olive(), (9.0, 14.0)),
        "FLOWERING": (veg.flowering_tree, M.bark(),
                      M.foliage("VEG_FoliageFlower", (0.145, 0.105, 0.045), 0.6),
                      (6.5, 9.5)),
    }


def _templates():
    """One template mesh per species per size variant, hidden from renders."""
    tpl = {}
    for name, (fn, bark_m, leaf_m, (h0, h1)) in species().items():
        variants = []
        for k in range(3):
            h = h0 + (h1 - h0) * k / 2.0
            mb = fn(height=h, seed=hash((name, k)) & 0xFFFF)
            ob = mb.to_object(f"TPL_{name}_{k}", coll("BEIT_BIRAM/_TEMPLATES"),
                              mats=[bark_m, leaf_m])
            core.add_smooth_by_angle(ob, 80)
            ob.hide_render = True
            ob.hide_viewport = True
            variants.append(ob)
        tpl[name] = variants
    # understorey
    for k in range(3):
        mb = veg.bush(radius=0.7 + 0.35 * k, seed=500 + k)
        ob = mb.to_object(f"TPL_BUSH_{k}", coll("BEIT_BIRAM/_TEMPLATES"),
                          mats=[M.bark(), M.hedge()])
        core.add_smooth_by_angle(ob, 80)
        ob.hide_render = True
        ob.hide_viewport = True
        tpl.setdefault("BUSH", []).append(ob)
    for k in range(3):
        mb = veg.grass_tuft(seed=700 + k, height=0.24 + 0.08 * k)
        ob = mb.to_object(f"TPL_TUFT_{k}", coll("BEIT_BIRAM/_TEMPLATES"),
                          mats=[M.bark(), M.grass_blade()])
        ob.hide_render = True
        ob.hide_viewport = True
        tpl.setdefault("TUFT", []).append(ob)
    return tpl


def _plant(tpl, species, pts, coll_path, rng, scale=(0.9, 1.15), jitter=1.2):
    c = coll(coll_path)
    out = []
    if LITE:
        pts = pts[::2]
    for i, (x, y) in enumerate(pts):
        px = x + rng.uniform(-jitter, jitter)
        py = y + rng.uniform(-jitter, jitter)
        if _blocked(px, py, 1.4):
            continue
        v = rng.choice(tpl[species])
        s = rng.uniform(*scale)
        ob = link_dup(v, f"{species}_{i:03d}", loc=(px, py, GZ(px, py) - 0.15),
                      rot_z=rng.uniform(0, math.tau), collection=c,
                      scale=(s, s, s * rng.uniform(0.94, 1.08)))
        out.append(ob)
    return out


def build_vegetation():
    rng = random.Random(4242)
    tpl = _templates()
    planted = 0
    if LITE:
        # keep every planting position's *role* but drop density, so the lite
        # scene still reads as the same campus rather than a different one
        for key in list(tpl):
            tpl[key] = tpl[key][:1]

    # --- hero trees: large specimens at the campus focal points ---
    hero = [
        ("FICUS", -104.0, -6.0), ("FICUS", -104.0, 8.0),     # entrance forecourt
        ("FICUS", -52.0, -6.0), ("FICUS", -2.0, -6.0),        # main lawn
        ("FICUS", 70.0, -6.0), ("PINE", -30.0, -50.0),
        ("PINE", 30.0, -50.0), ("FICUS", 10.0, 16.0),
    ]
    hc = coll("BEIT_BIRAM/VEGETATION/HERO_TREES")
    for i, (sp, x, y) in enumerate(hero):
        if _camera_keepout(x, y):
            continue
        v = tpl[sp][-1]
        s = rng.uniform(1.25, 1.55)
        link_dup(v, f"HERO_{sp}_{i:02d}", loc=(x, y, GZ(x, y) - 0.2),
                 rot_z=rng.uniform(0, math.tau), collection=hc,
                 scale=(s, s, s))
        planted += 1

    # --- palms flanking the entrance plaza ---
    pts = [(-101.0, -28.0 + i * 7.0) for i in range(9)]
    planted += len(_plant(tpl, "PALM", pts,
                          "BEIT_BIRAM/VEGETATION/TREES/PALMS", rng,
                          scale=(0.95, 1.12), jitter=0.4))

    # --- avenue of shade trees along the pergola spine ---
    pts = []
    for x in range(-96, 100, 9):
        for y in (-7.5, 7.5):
            pts.append((float(x), y))
    planted += len(_plant(tpl, "FICUS", pts,
                          "BEIT_BIRAM/VEGETATION/TREES/SPINE_AVENUE", rng,
                          scale=(0.85, 1.10), jitter=1.0))

    # --- Carmel pines along the perimeter and the terrace banks ---
    pts = []
    for x in range(-118, 120, 11):
        pts.append((float(x), SP.SITE_Y0 + 6.5))
        pts.append((float(x), -55.0))
    for y in range(-96, 96, 11):
        pts.append((SP.SITE_X0 + 7.0, float(y)))
        pts.append((SP.SITE_X1 - 7.0, float(y)))
    planted += len(_plant(tpl, "PINE", pts,
                          "BEIT_BIRAM/VEGETATION/TREES/PINES", rng,
                          scale=(0.85, 1.2), jitter=2.2))

    # --- cypress screens: car park edge and the sports boundary ---
    pts = [(-60.0, y) for y in range(-96, -56, 5)]
    pts += [(x, 44.5) for x in range(-118, -10, 6)]
    planted += len(_plant(tpl, "CYPRESS", pts,
                          "BEIT_BIRAM/VEGETATION/TREES/CYPRESS", rng,
                          scale=(0.9, 1.15), jitter=0.8))

    # --- olives on the south terrace ---
    pts = [(x, y) for x in range(-40, 40, 9) for y in (-60.0, -70.0)]
    planted += len(_plant(tpl, "OLIVE", pts,
                          "BEIT_BIRAM/VEGETATION/TREES/OLIVES", rng,
                          scale=(0.9, 1.2), jitter=2.0))

    # --- flowering trees at the entrance and courtyards ---
    pts = [(-108.0, -24.0), (-108.0, 0.0), (-92.0, 16.0), (-16.0, 16.0),
           (46.0, 16.0), (-70.0, -48.0), (18.0, -48.0), (-52.0, -24.0),
           (2.0, -24.0), (70.0, -24.0), (-52.0, 18.0), (86.0, 10.0)]
    planted += len(_plant(tpl, "FLOWERING", pts,
                          "BEIT_BIRAM/VEGETATION/TREES/FLOWERING", rng,
                          scale=(0.9, 1.2), jitter=1.4))

    # --- a dense pine belt inside the boundary wall, as on the Carmel ---
    belt = []
    for x in range(-116, 118, 7):
        belt.append((float(x), SP.SITE_Y0 + 4.0))
        belt.append((float(x), SP.SITE_Y0 + 11.5))
    for y in range(-94, 98, 7):
        belt.append((SP.SITE_X0 + 4.5, float(y)))
        belt.append((SP.SITE_X1 - 4.5, float(y)))
        belt.append((SP.SITE_X0 + 11.0, float(y)))
        belt.append((SP.SITE_X1 - 11.0, float(y)))
    planted += len(_plant(tpl, "PINE", belt,
                          "BEIT_BIRAM/VEGETATION/TREES/PINE_BELT", rng,
                          scale=(0.8, 1.25), jitter=2.4))

    # --- trees filling the lawns between the building rows ---
    lawn = []
    for x in range(-110, 112, 8):
        for y in (-52.0, -8.0, 8.0, 34.0):
            lawn.append((float(x) + rng.uniform(-2, 2), y))
    for x in range(-100, 104, 13):
        lawn.append((float(x), -66.0))
        lawn.append((float(x), -84.0))
    rng.shuffle(lawn)
    half = len(lawn) // 2
    planted += len(_plant(tpl, "FICUS", lawn[:half],
                          "BEIT_BIRAM/VEGETATION/TREES/LAWNS", rng,
                          scale=(0.8, 1.15), jitter=2.2))
    planted += len(_plant(tpl, "OLIVE", lawn[half:],
                          "BEIT_BIRAM/VEGETATION/TREES/LAWNS", rng,
                          scale=(0.85, 1.2), jitter=2.2))

    # --- street trees outside the campus (Haifa context) ---
    street = []
    for y in range(-176, 180, 12):
        street.append((SP.ST_ABBA_HUSHI_X - 11.5, float(y)))
        street.append((SP.ST_ABBA_HUSHI_X + 11.5, float(y)))
        street.append((SP.ST_YAAROT_X + 7.5, float(y)))
    for x in range(-180, 184, 14):
        street.append((float(x), SP.ST_EINSTEIN_Y - 7.5))
    sc_ = coll("BEIT_BIRAM/STREET/TREES")
    n_st = 0
    for i, (x, y) in enumerate(street):
        if _camera_keepout(x, y):
            continue
        sp = "FICUS" if i % 3 else "PALM"
        v = rng.choice(tpl[sp])
        s2 = rng.uniform(0.8, 1.1)
        link_dup(v, f"STREET_TREE_{i:03d}",
                 loc=(x, y, T.base_height(x, y) - 0.1),
                 rot_z=rng.uniform(0, math.tau), collection=sc_,
                 scale=(s2, s2, s2))
        n_st += 1
    planted += n_st

    # --- shrubs at building bases and along paths ---
    bc = coll("BEIT_BIRAM/VEGETATION/BUSHES")
    n_bush = 0
    for d in SP.BUILDINGS.values():
        x0, y0, x1, y1 = d["rect"]
        for x in [x0 + i * 2.6 for i in range(int((x1 - x0) / 2.6))]:
            for (yy, off) in ((y0, -1.6), (y1, 1.6)):
                px = x + rng.uniform(-0.5, 0.5)
                py = yy + off + rng.uniform(-0.3, 0.3)
                if rng.random() < (0.75 if LITE else 0.45):
                    continue
                v = rng.choice(tpl["BUSH"])
                s = rng.uniform(0.75, 1.3)
                link_dup(v, f"BUSH_{n_bush:04d}", loc=(px, py, GZ(px, py) - 0.1),
                         rot_z=rng.uniform(0, math.tau), collection=bc,
                         scale=(s, s, s * rng.uniform(0.8, 1.15)))
                n_bush += 1

    # --- hedges, beds and climbers as one welded mesh ---
    mb = MeshBuilder()
    HEDGE, SOIL, FLOWER = 0, 1, 2
    for path in ([[(-118, -57.5), (-62, -57.5)]] +
                 [[(-99, -44), (-55, -44)], [(-47, -44), (-5, -44)],
                  [(5, -42), (67, -42)]] +
                 [[(-124, -34), (-100, -34)], [(-124, 6), (-100, 6)]]):
        sub = MeshBuilder()
        veg.hedge_run(sub, [(0, 0), (math.hypot(path[1][0] - path[0][0],
                                                path[1][1] - path[0][1]), 0)],
                      width=0.95, height=1.05, mat=HEDGE, seed=rng.randint(0, 999))
        ang = math.atan2(path[1][1] - path[0][1], path[1][0] - path[0][0])
        mb.append(sub, loc=(path[0][0], path[0][1], GZ(*path[0]) - 0.05), rot_z=ang)
    for rect in [(-122, -30, -116, 2), (-106, -30, -102, 2),
                 (-44, -10, -8, -6), (8, -10, 64, -6)]:
        veg.flower_bed(mb, rect, GZ((rect[0] + rect[2]) / 2,
                                    (rect[1] + rect[3]) / 2) + 0.05,
                       mat_soil=SOIL, mat_flower=FLOWER, seed=rng.randint(0, 999),
                       density=0.30)
    # creepers on the campus wall — vegetation touching the concrete
    for run in _boundary_runs()[:3]:
        veg.climber(mb, run, GZ(*run[0]), 2.4, mat=HEDGE, seed=rng.randint(0, 999),
                    step=6.0)
    ob = mb.to_object("HEDGES_BEDS", coll("BEIT_BIRAM/VEGETATION/BUSHES"),
                      mats=[M.hedge(), M.soil(), M.flowers()])
    core.add_smooth_by_angle(ob, 62)

    # --- grass tufts at path edges (close-up realism only where it shows) ---
    gc = coll("BEIT_BIRAM/VEGETATION/GRASS")
    n_t = 0

    def rough_ground(x, y):
        """Tufts belong on the unmown ground, not the middle of a cut lawn:
        the pine belt inside the wall, the terrace banks and the verges."""
        near_wall = (x < SP.SITE_X0 + 16 or x > SP.SITE_X1 - 16
                     or y < SP.SITE_Y0 + 16 or y > SP.SITE_Y1 - 16)
        near_bank = any(abs(y - edge) < 7.0 for edge in (-50.0, 20.0, 42.0))
        return near_wall or near_bank

    for _ in range(300 if LITE else 1100):
        x = rng.uniform(-120, 120)
        y = rng.uniform(-98, 98)
        if not rough_ground(x, y):
            continue
        if _blocked(x, y, 1.0, keepout=False):
            continue
        v = rng.choice(tpl["TUFT"])
        s = rng.uniform(0.8, 1.6)
        link_dup(v, f"TUFT_{n_t:04d}", loc=(x, y, GZ(x, y) - 0.02),
                 rot_z=rng.uniform(0, math.tau), collection=gc, scale=(s, s, s))
        n_t += 1
    return planted, n_bush, n_t


# --------------------------------------------------------------------------
# site furniture, signage and exterior lighting
# --------------------------------------------------------------------------

def build_furniture():
    rng = random.Random(777)
    c = coll("BEIT_BIRAM/FURNITURE")
    mb = MeshBuilder()

    # benches flanking the pergola spine, facing the lawns
    for x in range(-100, 96, 12):
        for (y, a) in ((-6.2, 0.0), (6.2, math.pi)):
            props.bench(mb, x + rng.uniform(-1, 1), y, GZ(x, y), ang=a,
                        length=1.9)
    # benches on the entrance plaza and in the courtyards
    for (x, y, a) in ((-112, -26, math.pi / 2), (-112, 2, math.pi / 2),
                      (-104, -30, 0.0), (-70, -48, 0.0), (20, -48, 0.0),
                      (-20, 18, 0.0), (44, 18, 0.0), (-60, 30, 0.0)):
        props.bench(mb, x, y, GZ(x, y), ang=a)
    # picnic tables in the shaded courtyards
    for (x, y) in ((-88, -50), (-30, -50), (34, -50), (-6, 18), (62, 18)):
        props.picnic_table(mb, x, y, GZ(x, y), ang=rng.uniform(0, math.pi))
    # bins at entrances and along the spine
    for x in range(-108, 100, 16):
        props.bin_litter(mb, float(x), -4.2, GZ(x, -4.2))
    for d in SP.BUILDINGS.values():
        x0, y0, x1, y1 = d["rect"]
        cx = (x0 + x1) / 2
        props.bin_litter(mb, cx + 5.5, y0 - 2.2, d["z"])
    # drinking fountains
    for (x, y) in ((-100, -4), (-20, -4), (52, -4), (20, 30)):
        props.drinking_fountain(mb, x, y, GZ(x, y))
    # bike parking near the main gate
    for i in range(4):
        props.bike_rack(mb, -116.0, -34.0 - i * 2.2, GZ(-116, -34 - i * 2.2),
                        ang=0.0, hoops=6)
    # bollards protecting the plaza from the service road
    for i in range(14):
        x = -124 + i * 1.9
        props.bollard(mb, x, -33.5, GZ(x, -33.5))
    # street-furniture services
    for (x, y) in ((-98, 3), (-14, 3), (58, 3), (24, 34), (-64, 44)):
        props.electrical_box(mb, x, y, GZ(x, y), ang=rng.uniform(0, math.pi))
    for _ in range(40):
        x, y = rng.uniform(-118, 118), rng.uniform(-96, 96)
        props.manhole(mb, x, y, GZ(x, y))
    for x in range(-110, 110, 14):
        props.gully(mb, float(x), -3.0, GZ(x, -3.0))

    # --- the memorial outside the library (documented) ---
    lib = SP.BUILDINGS["LIBRARY_REICH"]
    lx0, ly0, lx1, ly1 = lib["rect"]
    props.memorial_wall(mb, (lx0 + lx1) / 2 - 6.0, ly0 - 7.5, lib["z"],
                        length=9.0, height=2.6, ang=0.0, plaques=16)

    # --- flagpoles on the entrance plaza ---
    for i in range(3):
        props.flagpole(mb, -106.0, -18.0 + i * 6.0, GZ(-106, -18 + i * 6), h=9.0)

    # --- sports equipment ---
    sp = SP.SPORTS
    px0, py0, px1, py1 = sp["pitch"]
    props.goal(mb, (px0 + px1) / 2, py0 + 2.5, -4.5, ang=0.0)
    props.goal(mb, (px0 + px1) / 2, py1 - 2.5, -4.5, ang=math.pi)
    props.tiered_seating(mb, (px0 + px1) / 2, py0 - 8.0, -4.5, width=34.0, rows=5)
    cx0, cy0, cx1, cy1 = sp["courts"]
    for k in range(2):
        a = cx0 + 2.0 + k * ((cx1 - cx0) / 2)
        b = a + 28.0
        if b > cx1 - 1:
            continue
        props.basketball_hoop(mb, a + 0.6, (cy0 + 17.0 + cy0 + 2.0) / 2, 0.5, ang=0.0)
        props.basketball_hoop(mb, b - 0.6, (cy0 + 17.0 + cy0 + 2.0) / 2, 0.5,
                              ang=math.pi)

    # --- parked cars ---
    for k, r in SP.PARKING.items():
        x0, y0, x1, y1 = r
        z = T.ground_z(*SP.rect_center(r))
        rows = int((y1 - y0) / 5.4)
        cols = int((x1 - x0) / 2.6)
        n = 0
        for i in range(cols):
            for j in range(rows):
                if rng.random() < 0.42:
                    continue
                cx = x0 + 1.3 + i * 2.6
                cy = y0 + 2.7 + j * 5.4
                props.car(mb, cx, cy, z, ang=math.pi / 2 + rng.uniform(-0.05, 0.05),
                          seed=rng.randint(0, 9999))
                n += 1

    ob = mb.to_object("SITE_FURNITURE", c, mats=prop_mats())
    return ob


def build_lighting_props():
    c = coll("BEIT_BIRAM/LIGHTING")
    mb = MeshBuilder()
    # lamp columns along the spine and the main paths
    for x in range(-108, 104, 18):
        props.lamp_post(mb, float(x), -8.6, GZ(x, -8.6), h=5.0, ang=math.pi / 2)
        props.lamp_post(mb, float(x), 8.6, GZ(x, 8.6), h=5.0, ang=-math.pi / 2)
    for p in SP.PATHS:
        for i in range(len(p) - 1):
            ax, ay = p[i]
            bx, by = p[i + 1]
            L = math.hypot(bx - ax, by - ay)
            n = max(1, int(L / 20))
            for k in range(n):
                t = (k + 0.5) / n
                x, y = ax + (bx - ax) * t, ay + (by - ay) * t
                props.lamp_post(mb, x, y, GZ(x, y), h=4.6,
                                ang=random.Random(int(x * 7 + y)).uniform(0, math.tau))
    # bollard lights along the pergola
    for x in range(-104, 100, 7):
        props.bollard_light(mb, float(x), -2.6, GZ(x, -2.6))
    # car-park lighting
    for k, r in SP.PARKING.items():
        x0, y0, x1, y1 = r
        z = T.ground_z(*SP.rect_center(r))
        for i in range(3):
            props.lamp_post(mb, (x0 + x1) / 2, y0 + (i + 0.5) * (y1 - y0) / 3, z,
                            h=7.0, arm=1.6)
    # stadium floodlights
    px0, py0, px1, py1 = SP.SPORTS["pitch"]
    for (x, y) in ((px0 + 4, py0 + 4), (px1 - 4, py0 + 4), (px0 + 4, py1 - 4),
                   (px1 - 4, py1 - 4)):
        props.flood_mast(mb, x, y, -4.5, h=14.0, heads=4)
    # wall lamps beside every building entrance
    for d in SP.BUILDINGS.values():
        x0, y0, x1, y1 = d["rect"]
        cx = (x0 + x1) / 2
        for ox in (-3.0, 3.0):
            props.wall_lamp(mb, cx + ox, y0 - 0.05, d["z"] + 3.1,
                            ang=-math.pi / 2)
    ob = mb.to_object("EXTERIOR_LIGHTING", c, mats=prop_mats())
    return ob


def build_signs():
    """Signage as separate, easily editable objects.

    Wording uses the school's documented institutional names. The physical
    design of the real signs could not be verified from any reachable source,
    so the boards are modelled as plain panels carrying that text.
    """
    c = coll("BEIT_BIRAM/SIGNS")
    made = []
    font = _hebrew_font()

    mb = MeshBuilder()
    # main gate sign on the pier beside the entrance
    props.sign_panel(mb, -118.0, -12.0, GZ(-118, -12), w=5.6, h=1.5, ang=0.0,
                     posts=2, post_h=1.15)
    # campus wayfinding boards at the path junctions
    for (x, y, a) in ((-100.0, -6.0, 0.0), (-24.0, -6.0, 0.0), (36.0, -6.0, 0.0),
                      (20.0, 30.0, 0.0), (-8.0, 44.0, 0.0)):
        props.sign_panel(mb, x, y, GZ(x, y), w=1.7, h=1.1, ang=a, posts=2,
                         post_h=1.0)
    # building identification plates beside each entrance
    for d in SP.BUILDINGS.values():
        x0, y0, x1, y1 = d["rect"]
        cx = (x0 + x1) / 2
        props.wall_sign(mb, cx + 4.2, y0 - 0.02, d["z"] + 2.3, w=1.6, h=0.42,
                        ang=0.0, proj=0.05)
    ob = mb.to_object("SIGN_BOARDS", c,
                      mats=[M.concrete_board("CONCRETE_Precast", tone=0.50,
                                             board_h=1.4), M.steel_galv(),
                            M.wood(), M.metal_paint(), M.glass(),
                            M.rubber_dark(), M.sign_blue(), M.emissive()])
    made.append(ob)

    if font is not None:
        texts = [
            ("SIGN_TEXT_SchoolName", "בית הספר הריאלי העברי בחיפה",
             (-118.0, -12.15, GZ(-118, -12) + 2.10), 0.52),
            ("SIGN_TEXT_CampusName", "בית בירם",
             (-118.0, -12.15, GZ(-118, -12) + 1.45), 0.62),
            ("SIGN_TEXT_Address", "שדרות אבא חושי 15",
             (-118.0, -12.15, GZ(-118, -12) + 1.05), 0.26),
        ]
        for name, body, loc, size in texts:
            cu = bpy.data.curves.new(name, type="FONT")
            cu.body = _rtl(body)
            cu.font = font
            cu.size = size
            cu.align_x = "CENTER"
            cu.align_y = "CENTER"
            cu.extrude = 0.012
            ob = bpy.data.objects.new(name, cu)
            ob.location = loc
            ob.rotation_euler = (math.pi / 2, 0, 0)
            ob.data.materials.append(M.sign_white())
            c.objects.link(ob)
            made.append(ob)
    return made


def _rtl(text):
    """Blender lays glyphs out in code-point order, with no bidi engine, so a
    Hebrew string would come out mirrored. Reverse the Hebrew runs (keeping
    digit groups in their own order) to get the correct visual result."""
    import unicodedata
    out = []
    run = []

    def flush():
        if run:
            out.extend(reversed(run))
            run.clear()

    i = 0
    while i < len(text):
        ch = text[i]
        if "\u0590" <= ch <= "\u05FF":
            run.append(ch)
            i += 1
        elif ch.isdigit():
            j = i
            while j < len(text) and text[j].isdigit():
                j += 1
            run.append(text[i:j])          # digits stay left-to-right
            i = j
        elif ch == " " and run:
            run.append(ch)
            i += 1
        else:
            flush()
            out.append(ch)
            i += 1
    flush()
    return "".join(out).strip()


def _hebrew_font():
    """Find a system font that actually has Hebrew glyphs."""
    import glob
    cands = []
    for pat in ("/usr/share/fonts/**/*.ttf", "/usr/share/fonts/**/*.otf",
                "/usr/local/share/fonts/**/*.ttf"):
        cands += glob.glob(pat, recursive=True)
    prefer = ("NotoSansHebrew", "DejaVuSans.ttf", "LiberationSans-Regular",
               "FreeSans.ttf")
    cands.sort(key=lambda p: min((i for i, k in enumerate(prefer)
                                  if k.lower() in os.path.basename(p).lower()),
                                 default=99))
    for path in cands[:6]:
        try:
            if not _font_has_hebrew(path):
                continue
            return bpy.data.fonts.load(path, check_existing=True)
        except Exception:
            continue
    return None


def _font_has_hebrew(path):
    """Scan the TrueType cmap for U+05D0 (alef) without any font library."""
    try:
        with open(path, "rb") as f:
            data = f.read()
    except Exception:
        return False
    import struct
    if len(data) < 12 or data[:4] not in (b"\x00\x01\x00\x00", b"true", b"OTTO"):
        return False
    num = struct.unpack(">H", data[4:6])[0]
    cmap_off = None
    for i in range(num):
        rec = 12 + i * 16
        if data[rec:rec + 4] == b"cmap":
            cmap_off = struct.unpack(">I", data[rec + 8:rec + 12])[0]
            break
    if cmap_off is None or cmap_off + 4 > len(data):
        return False
    n_tab = struct.unpack(">H", data[cmap_off + 2:cmap_off + 4])[0]
    for i in range(n_tab):
        rec = cmap_off + 4 + i * 8
        if rec + 8 > len(data):
            break
        off = struct.unpack(">I", data[rec + 4:rec + 8])[0] + cmap_off
        if off + 4 > len(data):
            continue
        fmt = struct.unpack(">H", data[off:off + 2])[0]
        if fmt != 4 or off + 14 > len(data):
            continue
        segx2 = struct.unpack(">H", data[off + 6:off + 8])[0]
        ends = off + 14
        for s in range(segx2 // 2):
            if ends + s * 2 + 2 > len(data):
                break
            end = struct.unpack(">H", data[ends + s * 2:ends + s * 2 + 2])[0]
            start_off = ends + segx2 + 2 + s * 2
            if start_off + 2 > len(data):
                break
            start = struct.unpack(">H", data[start_off:start_off + 2])[0]
            if start <= 0x05D0 <= end:
                return True
    return False


# --------------------------------------------------------------------------
# streets and the surrounding neighbourhood
# --------------------------------------------------------------------------

def build_streets():
    """Abba Hushi Blvd (west), Einstein St (south) and Yaarot St (east) — the
    three streets documented as bounding the campus — plus their pavements and
    a band of Ahuza neighbourhood context."""
    c = coll("BEIT_BIRAM/STREET")
    mb = MeshBuilder()
    ASPH, PAV, KERB, LINE, SOIL = 0, 1, 2, 3, 4

    def road(p0, p1, width, median=0.0):
        (ax, ay), (bx, by) = p0, p1
        L = math.hypot(bx - ax, by - ay)
        ux, uy = (bx - ax) / L, (by - ay) / L
        nx, ny = -uy, ux
        n = max(1, int(L / 5.0))
        for k in range(n):
            t0, t1 = k / n, (k + 1) / n
            x0, y0 = ax + (bx - ax) * t0, ay + (by - ay) * t0
            x1, y1 = ax + (bx - ax) * t1, ay + (by - ay) * t1
            z0 = T.base_height(x0, y0) + 0.05
            z1 = T.base_height(x1, y1) + 0.05
            hw = width / 2
            mb.quad((x0 + nx * hw, y0 + ny * hw, z0), (x1 + nx * hw, y1 + ny * hw, z1),
                    (x1 - nx * hw, y1 - ny * hw, z1), (x0 - nx * hw, y0 - ny * hw, z0),
                    ASPH)
            # pavements either side
            for s in (-1, 1):
                a = hw + 0.15
                b = hw + 3.2
                mb.quad((x0 + nx * s * a, y0 + ny * s * a, z0 + 0.14),
                        (x1 + nx * s * a, y1 + ny * s * a, z1 + 0.14),
                        (x1 + nx * s * b, y1 + ny * s * b, z1 + 0.14),
                        (x0 + nx * s * b, y0 + ny * s * b, z0 + 0.14), PAV)
                mb.quad((x0 + nx * s * hw, y0 + ny * s * hw, z0),
                        (x1 + nx * s * hw, y1 + ny * s * hw, z1),
                        (x1 + nx * s * a, y1 + ny * s * a, z1 + 0.14),
                        (x0 + nx * s * a, y0 + ny * s * a, z0 + 0.14), KERB)
            if median > 0:
                mb.quad((x0 + nx * median / 2, y0 + ny * median / 2, z0 + 0.15),
                        (x1 + nx * median / 2, y1 + ny * median / 2, z1 + 0.15),
                        (x1 - nx * median / 2, y1 - ny * median / 2, z1 + 0.15),
                        (x0 - nx * median / 2, y0 - ny * median / 2, z0 + 0.15),
                        SOIL)
            elif k % 2 == 0:
                mb.quad((x0 + nx * 0.08, y0 + ny * 0.08, z0 + 0.008),
                        (x1 + nx * 0.08, y1 + ny * 0.08, z1 + 0.008),
                        (x1 - nx * 0.08, y1 - ny * 0.08, z1 + 0.008),
                        (x0 - nx * 0.08, y0 - ny * 0.08, z0 + 0.008), LINE)

    road((SP.ST_ABBA_HUSHI_X, -190), (SP.ST_ABBA_HUSHI_X, 190), 15.0, median=2.6)
    road((-195, SP.ST_EINSTEIN_Y), (195, SP.ST_EINSTEIN_Y), 10.0)
    road((SP.ST_YAAROT_X, -190), (SP.ST_YAAROT_X, 190), 9.0)

    ob = mb.to_object("STREETS", c, mats=[M.asphalt(), M.paving_slab(),
                                          M.concrete_board("CONCRETE_Kerb",
                                                           tone=0.52, board_h=1.2),
                                          M.line_paint("LINE_Road",
                                                       (0.78, 0.74, 0.35)),
                                          M.soil()])

    # --- street furniture ---
    fmb = MeshBuilder()
    for y in range(-180, 185, 26):
        props.lamp_post(fmb, SP.ST_ABBA_HUSHI_X - 8.4, float(y),
                        T.base_height(SP.ST_ABBA_HUSHI_X - 8.4, y) + 0.14,
                        h=8.0, arm=1.8, ang=0.0)
        props.lamp_post(fmb, SP.ST_ABBA_HUSHI_X + 8.4, float(y),
                        T.base_height(SP.ST_ABBA_HUSHI_X + 8.4, y) + 0.14,
                        h=8.0, arm=1.8, ang=math.pi)
    for x in range(-190, 195, 30):
        props.lamp_post(fmb, float(x), SP.ST_EINSTEIN_Y - 6.0,
                        T.base_height(x, SP.ST_EINSTEIN_Y - 6.0) + 0.14, h=7.0)
    rng = random.Random(31337)
    for y in range(-170, 175, 11):
        for x in (SP.ST_ABBA_HUSHI_X - 12.5, SP.ST_YAAROT_X + 7.0):
            if rng.random() < 0.3:
                continue
            props.car(fmb, x, float(y), T.base_height(x, y) + 0.14,
                      ang=math.pi / 2, seed=rng.randint(0, 9999))
    ob2 = fmb.to_object("STREET_FURNITURE", c, mats=prop_mats())
    return [ob, ob2]


def build_neighbourhood():
    """A band of Ahuza context: 3–5 storey apartment blocks and villas.

    Generic (tier C) — included so the campus reads as embedded in Haifa, not
    floating. Kept deliberately simple and set back from the campus.
    """
    c = coll("BEIT_BIRAM/STREET/NEIGHBOURHOOD")
    rng = random.Random(9090)
    mb = MeshBuilder()
    slots = []
    for y in range(-175, 180, 30):
        slots.append((SP.ST_ABBA_HUSHI_X - 46.0, float(y), rng.randint(3, 5)))
        slots.append((SP.ST_YAAROT_X + 40.0, float(y), rng.randint(2, 4)))
    for x in range(-170, 175, 34):
        slots.append((float(x), SP.ST_EINSTEIN_Y - 40.0, rng.randint(3, 5)))
    for i, (cx, cy, floors) in enumerate(slots):
        w = rng.uniform(16, 26)
        d = rng.uniform(12, 18)
        fh = 3.0
        z = T.base_height(cx, cy)
        rect = (cx - w / 2, cy - d / 2, cx + w / 2, cy + d / 2)
        spec = B.WinSpec(kind="punched", win_w=1.3, win_h=1.5, sill=1.0,
                         bay=3.1, margin=1.6, cols=2, recess=0.16, shutter=True)
        for (a, b) in ((rect[:2], (rect[2], rect[1])),
                       ((rect[2], rect[1]), rect[2:]),
                       (rect[2:], (rect[0], rect[3])),
                       ((rect[0], rect[3]), rect[:2])):
            B.facade(mb, a, b, z, floors, fh, 0.3, spec, wall_mat=M_WALL,
                     plinth=0.4)
        H = floors * fh
        mb.box(rect[0] - 0.4, rect[1] - 0.4, z + H - 0.2, rect[2] + 0.4,
               rect[3] + 0.4, z + H, M_ROOF)
        arch.parapet(mb, [(rect[0], rect[1]), (rect[2], rect[1]),
                          (rect[2], rect[3]), (rect[0], rect[3])], z + H,
                     height=0.6, thick=0.3, mat=M_WALL2)
        arch.roof_plant(mb, cx, cy, z + H, seed=i, count=2)
    ob = mb.to_object("NEIGHBOURHOOD", c, mats=[
        M.plaster_cream(), M.concrete_board("CONCRETE_Fair", tone=0.44,
                                            board_h=0.90),
        M.aluminium(), M.glass(), M.metal_paint(), M.roof_membrane(),
        M.plaster_cream(), M.limestone(), M.rubber_dark()])
    return ob


# --------------------------------------------------------------------------
# lighting, world and cameras
# --------------------------------------------------------------------------

def build_sun_and_sky(elev_deg=52.0, azim_deg=214.0, strength=2.55,
                      sky_strength=0.38, sky_view_strength=0.60):
    """Haifa daylight: a strong sun plus a physical sky.

    Haifa sits at ~32.8 degrees N; a 52-degree elevation from the south-south-west
    gives late-morning-to-early-afternoon light with shadows long enough to read
    the pergola slats and the deep concrete reveals.

    The sun/sky ratio is measured, not guessed: Blender's physical sky is bright
    enough that at strength 1.0 it swamps the sun and flattens the scene into a
    shadowless haze, so it is dialled back to a fill that keeps shadows blue but
    readable.
    """
    c = coll("BEIT_BIRAM/LIGHTING")
    sun_data = bpy.data.lights.new("SUN_Haifa", type="SUN")
    sun_data.energy = strength
    sun_data.angle = math.radians(0.53)       # real solar disc -> crisp shadows
    sun_data.color = (1.0, 0.945, 0.878)      # warm midday sun over the Carmel
    sun = bpy.data.objects.new("SUN_Haifa", sun_data)
    sun.location = (0, 0, 120)
    sun.rotation_euler = (math.radians(90.0 - elev_deg), 0.0,
                          -math.radians(azim_deg - 180.0))
    c.objects.link(sun)

    world = bpy.data.worlds.new("WORLD_HaifaSky")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.location = (-260, 0)
    sky = nt.nodes.new("ShaderNodeTexSky")
    sky.location = (-560, 0)
    # Blender renamed the physical sky model (NISHITA -> MULTIPLE_SCATTERING) and
    # dust_density -> aerosol_density, so set each property defensively: one bad
    # name must not skip the rest, or the sky keeps its own second sun disc.
    def _set(obj, name, value, *alts):
        for key in (name,) + alts:
            try:
                setattr(obj, key, value)
                return True
            except (AttributeError, TypeError):
                continue
        return False

    for st in ("MULTIPLE_SCATTERING", "NISHITA", "HOSEK_WILKIE"):
        if _set(sky, "sky_type", st):
            break
    _set(sky, "sun_disc", False)              # the sun lamp provides the disc
    _set(sky, "sun_elevation", math.radians(elev_deg))
    _set(sky, "sun_rotation", math.radians(azim_deg - 180.0))
    _set(sky, "altitude", 260.0)              # the campus sits high on the Carmel
    _set(sky, "air_density", 1.0)
    _set(sky, "aerosol_density", 0.5, "dust_density")   # light coastal haze
    _set(sky, "ozone_density", 1.0)
    _set(sky, "ground_albedo", 0.28)
    # The visible sky and the sky-as-a-light-source want different strengths.
    # A physical sky bright enough to look right behind the buildings floods the
    # scene with ambient and kills every shadow. Split them with a Light Path
    # node: camera rays see the full-strength sky, while diffuse and glossy rays
    # get a dialled-back version that fills the shadows without flattening them.
    lp = nt.nodes.new("ShaderNodeLightPath")
    lp.location = (-560, 320)
    dim = nt.nodes.new("ShaderNodeBackground")
    dim.location = (-260, -180)
    mix = nt.nodes.new("ShaderNodeMixShader")
    mix.location = (-60, 0)
    bg.inputs["Strength"].default_value = sky_view_strength
    dim.inputs["Strength"].default_value = sky_strength
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    nt.links.new(sky.outputs["Color"], dim.inputs["Color"])
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
    nt.links.new(dim.outputs["Background"], mix.inputs[1])
    nt.links.new(bg.outputs["Background"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    return sun


CAMERAS = [
    # name, location, look-at target, focal length (mm on a 36 mm sensor)
    ("CAM_01_MainEntrance",     (-119.0, -19.0, 5.6),  (-58.0, -3.0, 8.0),  30),
    ("CAM_02_CampusOverview",   (-176.0, -148.0, 78.0), (-8.0, -8.0, 10.0), 45),
    ("CAM_03_HistoricBiram",    (30.0, -88.0, 14.0),   (36.0, -27.0, 9.5),  38),
    ("CAM_04_CentralCourtyard", (-51.0, -30.0, 6.3),   (-45.0, 20.0, 8.5),  30),
    ("CAM_05_AerialOverview",   (-118.0, -205.0, 228.0), (0.0, 2.0, 6.0),   50),
    ("CAM_06_StreetLevel",      (-149.0, -46.0, 1.8),  (-120.0, -22.0, 7.5), 32),
    ("CAM_07_PevznerHall",      (-62.0, 78.0, 2.0),    (-22.0, 28.0, 12.5), 40),
    ("CAM_08_Landscape",        (128.0, 122.0, 40.0),  (-34.0, 66.0, -2.0), 45),
    ("REFERENCE_CAMERA",        (-134.0, -36.0, 2.0),  (-48.0, -12.0, 8.0), 35),
]


def _inside_building(p, pad=1.5):
    """Is this point inside a building shell?

    The buildings are hollow, so a camera standing inside one casts no short
    rays and a pure ray test happily calls it 'clear'. Test the volumes instead.
    """
    for d in SP.BUILDINGS.values():
        x0, y0, x1, y1 = d["rect"]
        top = d["z"] + d["floors"] * 4.4 + 4.0
        if (x0 - pad < p[0] < x1 + pad and y0 - pad < p[1] < y1 + pad
                and d["z"] - 2.0 < p[2] < top):
            return True
    # Pevzner's hall volume is one tall space, and its fly tower is taller still
    px0, py0, px1, py1 = SP.BUILDINGS["PEVZNER_HALL"]["rect"]
    if px0 - 10 < p[0] < px1 + pad and py0 - pad < p[1] < py1 + pad \
            and 2.0 < p[2] < 22.0:
        return True
    return False


def _underground(p, clear=1.4):
    return p[2] < T.ground_z(p[0], p[1]) + clear


def _clearance(origin, target, lens, dg, sc, fan=2):
    """Fraction of a ray fan that hits geometry within 4 m of the camera.

    A camera standing inside a wall or a tree crown scores near 1.0; an open
    view scores 0. Also checks that the aim point itself is reachable.
    """
    from mathutils import Vector
    origin = Vector(origin)
    target = Vector(target)
    d0 = (target - origin)
    dist_to_target = d0.length
    if dist_to_target < 1e-3:
        return 1.0
    q = d0.to_track_quat("-Z", "Y")
    fov = 2 * math.atan(36.0 / (2 * lens))
    aspect = sc.render.resolution_y / max(1, sc.render.resolution_x)
    hits = 0.0
    total = 0.0
    for iy in range(-fan, fan + 1):
        for ix in range(-fan, fan + 1):
            ax = (ix / max(1, fan)) * fov / 2
            ay = (iy / max(1, fan)) * fov / 2 * aspect
            d = q @ Vector((math.tan(ax), math.tan(ay), -1.0))
            d.normalize()
            ok, loc, _, _, _, _ = sc.ray_cast(dg, origin, d)
            central = abs(ix) <= 1 and abs(iy) <= 1
            # a trunk or a post 6 m away dead centre ruins the shot even though
            # it leaves the frame technically "unblocked", so the middle of the
            # frame is held to a longer clear distance than the edges
            limit = 9.0 if central else 4.0
            weight = 2.0 if central else 1.0
            total += weight
            if ok and (loc - origin).length < limit:
                hits += weight
    # penalise an aim point we cannot actually see
    ok, loc, _, _, _, _ = sc.ray_cast(dg, origin, d0.normalized())
    blocked_target = 1.0 if (ok and (loc - origin).length < dist_to_target * 0.55) \
        else 0.0
    return hits / total + 0.35 * blocked_target


def _find_clear(loc, target, lens, dg, sc, max_side=14.0, max_back=55.0):
    """Nudge a camera out of an obstruction while keeping its composition.

    Correction is tried in this order: lift, step sideways, then back away along
    the sight line. Backing away is the move that always preserves what the shot
    is pointing at, so it is the fallback rather than an arbitrary offset -- an
    earlier version searched a plain circle and happily parked the camera two
    metres from the wall it was meant to photograph.
    """
    from mathutils import Vector

    def bad(p):
        return _inside_building(p) or _underground(p)

    # A camera given an absolute height can end up under a hillside that rises
    # away from the campus; lift it to eye level over whatever ground is there.
    gz = T.ground_z(loc[0], loc[1])
    if loc[2] < gz + 1.5:
        loc = (loc[0], loc[1], gz + 1.7)

    base = _clearance(loc, target, lens, dg, sc) + (1.0 if bad(loc) else 0.0)
    if base < 0.08:
        return loc, base, 0.0

    o = Vector(loc)
    t = Vector(target)
    back = (o - t)
    if back.length < 1e-3:
        return loc, base, 0.0
    back.normalize()
    side = Vector((-back.y, back.x, 0.0))
    if side.length < 1e-3:
        side = Vector((1.0, 0.0, 0.0))
    side.normalize()

    cands = []
    for dz in (0.0, 1.5, 3.0, 5.0, 8.0):
        for ds in (0.0, 3.0, -3.0, 6.0, -6.0, 10.0, -10.0, 14.0, -14.0):
            if abs(ds) > max_side:
                continue
            for db in (0.0, 5.0, 10.0, 16.0, 24.0, 34.0, 45.0, 55.0):
                if db > max_back:
                    continue
                cands.append((db, abs(ds) + dz,
                              o + back * db + side * ds + Vector((0, 0, dz))))
    cands.sort(key=lambda c: (c[0] + c[1]))
    best = (loc, base, 0.0)
    for db, _, p in cands:
        cand = (p.x, p.y, max(p.z, T.ground_z(p.x, p.y) + 1.7))
        if bad(cand):
            continue
        score = _clearance(cand, target, lens, dg, sc)
        if score < best[1]:
            best = (cand, score, math.dist(cand, loc))
        if score < 0.04:
            return cand, score, math.dist(cand, loc)
    return best


def build_cameras(auto_clear=True):
    from mathutils import Vector
    c = coll("BEIT_BIRAM/CAMERAS")
    sc = bpy.context.scene
    dg = bpy.context.evaluated_depsgraph_get() if auto_clear else None
    made = []
    for name, loc, target, lens in CAMERAS:
        if auto_clear:
            loc, score, moved = _find_clear(loc, target, lens, dg, sc)
            if moved > 0.01:
                print(f"    {name}: view was obstructed, moved {moved:.1f} m "
                      f"(obstruction now {score:.0%})")
        cd = bpy.data.cameras.new(name)
        cd.lens = lens
        cd.clip_start = 0.10
        cd.clip_end = 2000.0
        cd.sensor_width = 36.0
        cd.dof.use_dof = False
        ob = bpy.data.objects.new(name, cd)
        ob.location = loc
        d = Vector(target) - Vector(loc)
        ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        c.objects.link(ob)
        made.append(ob)
    bpy.context.scene.camera = made[1]
    return made


def setup_scene(light=False):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 64 if light else 256
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 6 if light else 10
    sc.cycles.diffuse_bounces = 3
    sc.cycles.glossy_bounces = 3
    sc.cycles.transmission_bounces = 6
    sc.cycles.transparent_max_bounces = 8
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.012
    sc.render.resolution_x = 1920
    sc.render.resolution_y = 1080
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    try:
        sc.view_settings.view_transform = "AgX"
        sc.view_settings.look = "AgX - Medium Contrast"
    except Exception:
        pass
    sc.view_settings.exposure = 0.30
    return sc


# --------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "..", "out",
                                                  "beit_biram.blend"))
    ap.add_argument("--light", action="store_true",
                    help="lighter render sampling for fast iteration")
    ap.add_argument("--lite", action="store_true",
                    help="thin the planting and the grass tufts for a lighter "
                         "viewport scene (same layout, fewer instances)")
    args = ap.parse_args()

    global LITE
    LITE = args.lite
    core.reset_scene()
    core.clear_coll_cache()
    # reset_scene() invalidates every datablock, so drop the cached handles
    M._CACHE.clear()
    global PROP_MATS
    PROP_MATS = None
    setup_scene(args.light)

    print("  terrain ...")
    _, nq = build_terrain()
    print("  ground surfaces ...")
    build_ground_surfaces()
    print("  retaining walls ...")
    build_retaining()
    print("  buildings ...")
    bs = build_buildings()
    print("  pergola avenue ...")
    build_pergola()
    print("  boundary wall, fences and gates ...")
    build_boundary()
    print("  vegetation ...")
    trees, bushes, tufts = build_vegetation()
    print("  site furniture ...")
    build_furniture()
    print("  exterior lighting ...")
    build_lighting_props()
    print("  signage ...")
    build_signs()
    print("  streets ...")
    build_streets()
    print("  neighbourhood context ...")
    build_neighbourhood()
    print("  sun, sky and cameras ...")
    build_sun_and_sky()
    build_cameras()

    # hide the instancing templates from renders
    for ob in coll("BEIT_BIRAM/_TEMPLATES").objects:
        ob.hide_render = True
        ob.hide_viewport = True

    tris = 0
    for ob in bpy.data.objects:
        if ob.type == "MESH" and not ob.hide_render:
            tris += sum(len(p.vertices) - 2 for p in ob.data.polygons)
    print(f"\n  objects            : {len(bpy.data.objects)}")
    print(f"  unique meshes      : {len(bpy.data.meshes)}")
    print(f"  materials          : {len(bpy.data.materials)}")
    print(f"  trees / bushes     : {trees} / {bushes}")
    print(f"  grass tufts        : {tufts}")
    print(f"  visible triangles  : {tris:,}")

    out = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=out)
    print(f"\n  saved {out}  ({os.path.getsize(out) / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
