"""The Beit Biram buildings.

Each building is generated into its own MeshBuilder in world coordinates and
carries the shared material-slot convention from `arch`.

Architectural character per building follows the documented record
(REFERENCES.md sections 2 and 3):
  * BIRAM_BUILDING  - 1940s, International Style (first building on campus)
  * PEVZNER_HALL    - 1962, Yohanan Ratner, suspended concave roof, 650 seats
  * LIBRARY_REICH   - 1967, shaded by a horizontal concrete slab attached to it
  * COMPUTER_CENTRE - 1955, ex-physics labs
  * SCIENCE/OU/PED  - Brutalist: bare unplastered concrete, relief symbols
  * RUACH_VERE_UT   - 2022, contemporary
Footprints and window grids are reconstructions (tier B).
"""
import math
import random

from core import MeshBuilder, wall_panel
import arch
from arch import (M_WALL, M_WALL2, M_FRAME, M_GLASS, M_METAL, M_ROOF, M_SOFFIT,
                  M_ACCENT, M_DARK)


# --------------------------------------------------------------------------
# facade system
# --------------------------------------------------------------------------

class WinSpec:
    """How a facade is fenestrated."""

    def __init__(self, kind="punched", win_w=1.75, win_h=1.75, sill=0.95,
                 bay=3.2, margin=1.6, cols=2, rows=1, recess=0.12,
                 band_inset=0.0, panes_per_m=0.55, spandrel=0.0,
                 shutter=False, transom=None, ground_kind=None):
        self.kind = kind            # punched | ribbon | strip | none
        self.win_w = win_w
        self.win_h = win_h
        self.sill = sill
        self.bay = bay
        self.margin = margin
        self.cols = cols
        self.rows = rows
        self.recess = recess
        self.band_inset = band_inset
        self.panes_per_m = panes_per_m
        self.spandrel = spandrel
        self.shutter = shutter
        self.transom = transom
        self.ground_kind = ground_kind   # override spec for the ground floor


def _openings_for(spec, length, floors, floor_h, floor_idx):
    """Return [(u, v, w, h, cols, rows)] for one storey of one facade."""
    out = []
    z0 = floor_idx * floor_h
    if spec.kind == "none":
        return out
    if spec.kind in ("ribbon", "strip"):
        u0 = spec.margin
        w = length - 2 * spec.margin
        if w <= 0.5:
            return out
        cols = max(2, int(w * spec.panes_per_m))
        out.append((u0, z0 + spec.sill, w, spec.win_h, cols, spec.rows))
        return out
    n = max(1, int((length - 2 * spec.margin + spec.bay * 0.01) / spec.bay))
    usable = length - 2 * spec.margin
    if n < 1 or usable < spec.win_w:
        return out
    step = usable / n if n else usable
    for i in range(n):
        u = spec.margin + i * step + (step - spec.win_w) / 2
        out.append((u, z0 + spec.sill, spec.win_w, spec.win_h, spec.cols, spec.rows))
    return out


def facade(mb, p0, p1, z_base, floors, floor_h, thick, spec, *,
           wall_mat=M_WALL, plinth=0.0, plinth_mat=M_WALL2, close_ends=True,
           extra=None, parapet_up=0.0):
    """Build one facade from world point p0 to p1 (outer face on the left of p0->p1)."""
    x0, y0 = p0
    x1, y1 = p1
    L = math.hypot(x1 - x0, y1 - y0)
    if L < 0.2:
        return
    ang = math.atan2(y1 - y0, x1 - x0)
    sub = MeshBuilder()
    H = floors * floor_h + parapet_up

    ops = []
    win_jobs = []
    for f in range(floors):
        s = spec.ground_kind if (f == 0 and spec.ground_kind) else spec
        for (u, v, w, h, cols, rows) in _openings_for(s, L, floors, floor_h, f):
            ops.append((u, v, w, h))
            win_jobs.append((u, v, w, h, cols, rows, s))

    wall_panel(sub, L, H, thick, openings=ops, mat=wall_mat,
               reveal_mat=M_SOFFIT, close_ends=close_ends)

    for (u, v, w, h, cols, rows, s) in win_jobs:
        arch.window(sub, u, v, w, h, thick, cols=cols, rows=rows,
                    recess=s.recess, transom_at=s.transom)
        if s.shutter:
            arch.shutter_box(sub, u, v + h, w, thick, recess=s.recess)

    if plinth > 0.01:
        sub.box(-0.06, -0.06, 0, L + 0.06, thick + 0.02, plinth, plinth_mat)

    if extra:
        extra(sub, L, H, thick)

    mb.append(sub, loc=(x0, y0, z_base), rot_z=ang)


def rect_shell(mb, rect, z, floors, floor_h, thick, specs, *, wall_mat=M_WALL,
               plinth=0.0, extras=None, parapet_h=0.95, parapet_mat=M_WALL2,
               roof_mat=M_ROOF, roof_plant_seed=None, slab_edge=0.18):
    """A rectangular building: four facades, floor slabs expressed on the outside,
    a flat roof with an upstand parapet, and roof-top plant.

    `specs` is a dict keyed 'S','E','N','W' of WinSpec; `extras` likewise of
    callables(sub, L, H, thick) for facade-specific detail.
    """
    x0, y0, x1, y1 = rect
    extras = extras or {}
    corners = {
        "S": ((x0, y0), (x1, y0)),
        "E": ((x1, y0), (x1, y1)),
        "N": ((x1, y1), (x0, y1)),
        "W": ((x0, y1), (x0, y0)),
    }
    for k, (a, b) in corners.items():
        facade(mb, a, b, z, floors, floor_h, thick, specs.get(k, specs["S"]),
               wall_mat=wall_mat, plinth=plinth, extra=extras.get(k))

    H = floors * floor_h
    # roof deck, recessed inside the parapet
    mb.box(x0 + thick, y0 + thick, z + H - 0.30, x1 - thick, y1 - thick,
           z + H - 0.10, roof_mat)
    poly = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    arch.parapet(mb, poly, z + H - 0.10, height=parapet_h, thick=thick,
                 mat=parapet_mat)
    if roof_plant_seed is not None:
        arch.roof_plant(mb, (x0 + x1) / 2, (y0 + y1) / 2, z + H - 0.10,
                        seed=roof_plant_seed,
                        count=max(2, int((x1 - x0) * (y1 - y0) / 420)))
    # expressed floor bands — a strong horizontal read on modernist facades
    if slab_edge > 0:
        for f in range(1, floors):
            zz = z + f * floor_h
            for (a, b) in corners.values():
                ax, ay = a
                bx, by = b
                L = math.hypot(bx - ax, by - ay)
                ang = math.atan2(by - ay, bx - ax)
                sub = MeshBuilder()
                sub.box(0, -0.07, -slab_edge / 2, L, 0.02, slab_edge / 2, M_WALL2)
                mb.append(sub, loc=(ax, ay, zz), rot_z=ang)


def ground_slab(mb, rect, z, *, drop=0.75, mat=M_WALL2, over=0.25):
    x0, y0, x1, y1 = rect
    mb.box(x0 - over, y0 - over, z - drop, x1 + over, y1 + over, z + 0.02, mat)


def entrance_steps(mb, x, y, z_top, width, n, *, ang=0.0, mat=M_WALL2, rise=0.16):
    arch.stairs(mb, x, y, z_top - n * rise, width, n, rise=rise, run=0.32,
                ang=ang, mat=mat)


# ==========================================================================
# BIRAM BUILDING — 1940s, International Style, the first building on campus
# ==========================================================================

def biram_building(rect, z, floors=3, floor_h=3.6, seed=1):
    """White-rendered International Style block.

    Style markers reproduced: flat roof with a thin parapet and no eaves;
    continuous horizontal ribbon windows; a cylindrical stair drum with a
    vertical glazed slot; cantilevered balconies with slim pipe railings; a
    recessed ground-floor loggia; a thin cantilevered entrance canopy.
    """
    mb = MeshBuilder()
    x0, y0, x1, y1 = rect
    W = x1 - x0
    D = y1 - y0
    H = floors * floor_h
    t = 0.32

    ground_slab(mb, rect, z, drop=1.1)

    ribbon = WinSpec(kind="ribbon", win_h=1.55, sill=1.00, margin=2.6,
                     panes_per_m=0.46, rows=1, recess=0.16)
    ribbon_n = WinSpec(kind="ribbon", win_h=1.45, sill=1.05, margin=3.4,
                       panes_per_m=0.42, rows=1, recess=0.16)
    end = WinSpec(kind="punched", win_w=1.30, win_h=1.55, sill=1.00, bay=3.6,
                  margin=2.2, cols=2, recess=0.16)
    ground = WinSpec(kind="ribbon", win_h=2.10, sill=0.85, margin=6.0,
                     panes_per_m=0.40, recess=0.18)

    specs = {"S": WinSpec(kind="ribbon", win_h=1.55, sill=1.00, margin=2.6,
                          panes_per_m=0.46, recess=0.16, ground_kind=ground),
             "N": ribbon_n, "E": end, "W": end}

    def south_extra(sub, L, Hh, th):
        # entrance: a wide opening with a thin cantilevered canopy
        cx = L * 0.5
        arch.canopy(sub, cx - 4.2, 0, 8.4, proj=3.0, thick=0.20, z=3.15,
                    mat=M_WALL2, columns=0)
        # cantilevered balconies on the upper two floors
        for f in (1, 2):
            bz = f * floor_h - 0.02
            bx0, bx1 = L * 0.62, L * 0.86
            sub.box(bx0, -1.55, bz - 0.20, bx1, 0.02, bz, M_WALL2)
        # downpipes
        for u in (L * 0.18, L * 0.47, L * 0.79):
            arch.downpipe(sub, u, -0.09, 0.0, Hh - 0.2)

    def north_extra(sub, L, Hh, th):
        for u in (L * 0.28, L * 0.70):
            arch.downpipe(sub, u, -0.09, 0.0, Hh - 0.2)
        for u in (L * 0.20, L * 0.52, L * 0.84):
            for f in (1, 2):
                arch.ac_unit(sub, u, -0.42, z + 0 + f * floor_h + 1.1, ang=0.0)

    corners = {"S": ((x0, y0), (x1, y0)), "E": ((x1, y0), (x1, y1)),
               "N": ((x1, y1), (x0, y1)), "W": ((x0, y1), (x0, y0))}
    extras = {"S": south_extra, "N": north_extra}
    for k, (a, b) in corners.items():
        facade(mb, a, b, z, floors, floor_h, t, specs[k], wall_mat=M_WALL,
               plinth=0.45, extra=extras.get(k))

    # roof, parapet, plant
    mb.box(x0 + t, y0 + t, z + H - 0.28, x1 - t, y1 - t, z + H - 0.08, M_ROOF)
    arch.parapet(mb, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z + H - 0.08,
                 height=0.72, thick=t, mat=M_WALL)
    arch.roof_plant(mb, (x0 + x1) / 2, (y0 + y1) / 2, z + H - 0.08, seed=seed,
                    count=3)

    # --- the cylindrical stair drum: the signature International Style move ---
    dx = x0 + W * 0.30
    dy = y1 + 0.2
    R = 3.5
    seg = 20
    outer = [(dx + R * math.cos(math.pi * i / (seg - 1)),
              dy + R * math.sin(math.pi * i / (seg - 1))) for i in range(seg)]
    drum = outer + [(x0 + W * 0.30 - R, dy), (x0 + W * 0.30 + R, dy)][::-1]
    mb.prism(outer + [(dx + R, dy), (dx - R, dy)], z, z + H + 1.5, M_WALL)
    # vertical glazed slot up the drum
    for i in range(1, 8):
        zz = z + 0.9 + i * (H - 0.4) / 8.0
        a = math.pi * 0.42
        b = math.pi * 0.58
        p0 = (dx + (R + 0.02) * math.cos(a), dy + (R + 0.02) * math.sin(a))
        p1 = (dx + (R + 0.02) * math.cos(b), dy + (R + 0.02) * math.sin(b))
        mb.quad((p0[0], p0[1], zz), (p1[0], p1[1], zz),
                (p1[0], p1[1], zz + 1.25), (p0[0], p0[1], zz + 1.25), M_GLASS)
    # drum coping
    mb.prism([(dx + (R + 0.12) * math.cos(math.pi * i / (seg - 1)),
               dy + (R + 0.12) * math.sin(math.pi * i / (seg - 1)))
              for i in range(seg)] + [(dx + R + 0.12, dy), (dx - R - 0.12, dy)],
             z + H + 1.5, z + H + 1.62, M_WALL2)

    # --- balcony railings (slim horizontal pipes, period-correct) ---
    for f in (1, 2):
        bz = z + f * floor_h
        bx0 = x0 + W * 0.62
        bx1 = x0 + W * 0.86
        path = [(bx0, y0 - 1.53), (bx1, y0 - 1.53)]
        arch.railing(mb, [(bx0, y0 - 0.02), (bx0, y0 - 1.53), (bx1, y0 - 1.53),
                          (bx1, y0 - 0.02)], bz, height=1.02, post_every=2.0,
                     balusters=False, mat=M_METAL)
        for zz in (0.34, 0.66):
            arch._rail_run(mb, (bx0, y0 - 1.53, bz), (bx1, y0 - 1.53, bz), zz,
                           0.035, M_METAL)

    # --- entrance steps and doors ---
    cx = (x0 + x1) / 2
    entrance_steps(mb, cx - 4.0, y0 - 2.4, z, 8.0, 5, ang=0.0)
    sub = MeshBuilder()
    arch.door(sub, 0, 0, 3.4, 2.85, t, leaves=2, transom_h=0.55, recess=0.18)
    mb.append(sub, loc=(cx - 1.7, y0, z), rot_z=0.0)
    return mb


# ==========================================================================
# PEVZNER HALL — 1962, Yohanan Ratner: suspended, concave roof, 650 seats
# ==========================================================================

def _sag_surface(mb, x0, y0, x1, y1, z_edge, sag, *, nx=16, ny=14, mat=M_ROOF,
                 thick=0.26, ribs=True, rib_every=2, rib_d=0.55):
    """A roof hanging in a parabola between two edge beams at y = y0 and y = y1.

    This is the documented character of Pevzner Hall: the deck is suspended and
    dishes downward, so the building reads as a shallow concave sweep between
    two raised edges rather than as a flat box.
    """
    ymid = (y0 + y1) / 2
    half = (y1 - y0) / 2

    def zf(x, y):
        t = (y - ymid) / half
        return z_edge - sag * (1.0 - t * t)

    for i in range(nx):
        ax = x0 + (x1 - x0) * i / nx
        bx = x0 + (x1 - x0) * (i + 1) / nx
        for j in range(ny):
            ay = y0 + (y1 - y0) * j / ny
            by = y0 + (y1 - y0) * (j + 1) / ny
            mb.quad((ax, ay, zf(ax, ay)), (bx, ay, zf(bx, ay)),
                    (bx, by, zf(bx, by)), (ax, by, zf(ax, by)), mat)
            # underside
            mb.quad((ax, ay, zf(ax, ay) - thick), (ax, by, zf(ax, by) - thick),
                    (bx, by, zf(bx, by) - thick), (bx, ay, zf(bx, ay) - thick),
                    M_SOFFIT)
    # gable-end fascia showing the catenary curve — the recognisable silhouette
    for xe in (x0, x1):
        prev = None
        for j in range(ny + 1):
            y = y0 + (y1 - y0) * j / ny
            zt = zf(xe, y)
            if prev is not None:
                py, pz = prev
                mb.quad((xe, py, pz), (xe, y, zt), (xe, y, zt - thick),
                        (xe, py, pz - thick), mat)
            prev = (y, zt)
    if ribs:
        for i in range(0, nx + 1, rib_every):
            x = x0 + (x1 - x0) * i / nx
            prev = None
            for j in range(ny + 1):
                y = y0 + (y1 - y0) * j / ny
                zt = zf(x, y) - thick
                if prev is not None:
                    py, pz = prev
                    for s in (-0.11, 0.11):
                        mb.quad((x + s, py, pz), (x + s, y, zt),
                                (x + s, y, zt - rib_d), (x + s, py, pz - rib_d),
                                M_SOFFIT)
                    mb.quad((x - 0.11, py, pz - rib_d), (x - 0.11, y, zt - rib_d),
                            (x + 0.11, y, zt - rib_d), (x + 0.11, py, pz - rib_d),
                            M_SOFFIT)
                prev = (y, zt)


def pevzner_hall(rect, z, seed=2):
    """The auditorium: 650 seats under a suspended, concave roof.

    Documented (haipo.co.il / he.wikipedia): inaugurated 1962, architect
    Prof. Yohanan Ratner with an engineer; unique for its suspended and concave
    roof. The span, beam depth and foyer are reconstructions sized to seat 650.
    """
    mb = MeshBuilder()
    x0, y0, x1, y1 = rect
    W = x1 - x0            # 48 m along X
    D = y1 - y0            # 36 m along Y — the suspended span
    t = 0.40
    wall_h = 8.6
    z_edge = z + 13.8
    sag = 4.7          # a deeper dish: the roof must read as hanging

    ground_slab(mb, rect, z, drop=1.2)

    # --- the two deep edge beams that the roof hangs from ---
    for ye in (y0, y1):
        mb.box(x0 - 0.9, ye - 0.75, z + wall_h, x1 + 0.9, ye + 0.75,
               z_edge + 0.55, M_WALL2)
    # buttress fins carrying the edge beams
    n_fin = 9
    for i in range(n_fin):
        fx = x0 + (i + 0.5) * W / n_fin
        for ye in (y0, y1):
            s = -1 if ye == y0 else 1
            mb.box(fx - 0.45, ye + s * 0.75, z, fx + 0.45, ye + s * 1.85,
                   z + wall_h + 2.4, M_WALL2)
            # raking face so the fins read as struts, not posts
            mb.face([(fx - 0.45, ye + s * 1.85, z + wall_h + 2.4),
                     (fx + 0.45, ye + s * 1.85, z + wall_h + 2.4),
                     (fx + 0.45, ye + s * 3.10, z + 1.2),
                     (fx - 0.45, ye + s * 3.10, z + 1.2)], M_WALL2)

    # --- solid flank walls between the fins ---
    blank = WinSpec(kind="none")
    for (a, b) in (((x0, y0), (x1, y0)), ((x1, y1), (x0, y1))):
        facade(mb, a, b, z, 1, wall_h, t, blank, wall_mat=M_WALL2, plinth=0.5)

    # --- stage / fly tower at the east end ---
    fly_x0 = x1 - 12.0
    mb.box(fly_x0, y0 + 1.2, z, x1, y1 - 1.2, z + 15.5, M_WALL2)
    arch.parapet(mb, [(fly_x0, y0 + 1.2), (x1, y0 + 1.2), (x1, y1 - 1.2),
                      (fly_x0, y1 - 1.2)], z + 15.5, height=0.8, thick=0.4,
                 mat=M_WALL2)

    # --- the suspended concave roof ---
    _sag_surface(mb, x0 - 0.9, y0, x1 + 0.9, y1, z_edge, sag, nx=18, ny=16)

    # --- glazed foyer on the west end, under a flat canopy ---
    fy0, fy1 = y0 + 3.0, y1 - 3.0
    fx1 = x0
    fx0 = x0 - 9.0
    mb.box(fx0, fy0, z, fx1, fy1, z + 0.25, M_WALL2)
    glaz = WinSpec(kind="ribbon", win_h=3.5, sill=0.35, margin=0.8,
                   panes_per_m=0.34, recess=0.10)
    for (a, b) in (((fx0, fy0), (fx1, fy0)), ((fx1, fy1), (fx0, fy1))):
        facade(mb, a, b, z, 1, 4.4, 0.28, glaz, wall_mat=M_WALL2)
    facade(mb, (fx0, fy1), (fx0, fy0), z, 1, 4.4, 0.28,
           WinSpec(kind="ribbon", win_h=3.5, sill=0.35, margin=3.6,
                   panes_per_m=0.34, recess=0.10), wall_mat=M_WALL2)
    mb.box(fx0 - 2.6, fy0 - 2.0, z + 4.4, fx1 + 0.3, fy1 + 2.0, z + 4.7, M_WALL2)
    for yy in (fy0 - 1.2, (fy0 + fy1) / 2, fy1 + 1.2):
        arch.column_round(mb, fx0 - 2.0, yy, z, z + 4.4, r=0.26, mat=M_WALL2)

    # entrance doors into the foyer
    sub = MeshBuilder()
    for k in range(3):
        arch.door(sub, k * 3.6, 0, 3.0, 2.9, 0.28, leaves=2, transom_h=0.5,
                  recess=0.12)
    mb.append(sub, loc=(fx0 + 0.4, fy0, z), rot_z=0.0)
    entrance_steps(mb, fx0 - 1.0, fy0 - 2.6, z, 12.0, 4, ang=0.0)

    arch.roof_plant(mb, (x0 + x1) / 2 - 6, (y0 + y1) / 2, z + wall_h, seed=seed,
                    count=2)
    return mb


# ==========================================================================
# LIBRARY (Menachem Reich, 1967) — shaded by a horizontal concrete slab
# ==========================================================================

def library_reich(rect, z, floors=3, floor_h=3.7, seed=3):
    """Documented: 'the library building is shaded by a horizontal concrete
    surface attached to it that prevents the building heating up in summer'.

    That slab is the building's defining element, so the south elevation is
    largely glazed and covered by a deep, free-standing concrete sunshade on
    its own row of columns. The blind volume at the east end is the Yoel Angel
    assembly hall (documented as housed here).
    """
    mb = MeshBuilder()
    x0, y0, x1, y1 = rect
    W, D = x1 - x0, y1 - y0
    H = floors * floor_h
    t = 0.34
    ground_slab(mb, rect, z, drop=1.0)

    south = WinSpec(kind="ribbon", win_h=2.35, sill=0.80, margin=1.8,
                    panes_per_m=0.42, recess=0.22)
    north = WinSpec(kind="punched", win_w=1.6, win_h=1.7, sill=1.05, bay=3.4,
                    margin=2.0, cols=2, recess=0.22)
    end = WinSpec(kind="punched", win_w=1.2, win_h=1.7, sill=1.05, bay=4.2,
                  margin=2.6, cols=1, recess=0.22)

    def south_extra(sub, L, Hh, th):
        for u in (L * 0.22, L * 0.74):
            arch.downpipe(sub, u, -0.09, 0.0, Hh - 0.2)

    corners = {"S": ((x0, y0), (x1, y0)), "E": ((x1, y0), (x1, y1)),
               "N": ((x1, y1), (x0, y1)), "W": ((x0, y1), (x0, y0))}
    specs = {"S": south, "E": end, "N": north, "W": end}
    for k, (a, b) in corners.items():
        facade(mb, a, b, z, floors, floor_h, t, specs[k], wall_mat=M_WALL2,
               plinth=0.5, extra=south_extra if k == "S" else None)

    mb.box(x0 + t, y0 + t, z + H - 0.30, x1 - t, y1 - t, z + H - 0.10, M_ROOF)
    arch.parapet(mb, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z + H - 0.10,
                 height=0.85, thick=t, mat=M_WALL2)
    arch.roof_plant(mb, (x0 + x1) / 2, (y0 + y1) / 2, z + H - 0.10, seed=seed,
                    count=3)

    # --- THE SHADING SLAB: a deep horizontal concrete plane on its own columns
    proj = 4.6
    sx0, sx1 = x0 - 0.6, x1 + 0.6
    sz = z + H + 0.55
    mb.box(sx0, y0 - proj, sz, sx1, y0 + 0.9, sz + 0.42, M_WALL2)
    # slotted openings in the slab so it reads as a brise-soleil, not a lid
    n_slot = 9
    for i in range(n_slot):
        cx = sx0 + (i + 0.5) * (sx1 - sx0) / n_slot
        mb.box(cx - 0.55, y0 - proj + 0.5, sz + 0.41, cx + 0.55, y0 - 0.5,
               sz + 0.45, M_DARK)
    for i in range(6):
        cx = sx0 + 1.6 + i * (sx1 - sx0 - 3.2) / 5
        mb.box(cx - 0.22, y0 - proj + 0.6, z, cx + 0.22, y0 - proj + 1.04, sz,
               M_WALL2)
    # a second, lower shade over the ground-floor glazing
    mb.box(sx0 + 1.0, y0 - 2.4, z + floor_h - 0.25, sx1 - 1.0, y0 + 0.4,
           z + floor_h - 0.03, M_WALL2)

    # --- entrance ---
    cx = x0 + W * 0.32
    sub = MeshBuilder()
    arch.door(sub, 0, 0, 3.6, 3.0, t, leaves=2, transom_h=0.6, recess=0.22)
    mb.append(sub, loc=(cx - 1.8, y0, z), rot_z=0.0)
    entrance_steps(mb, cx - 3.0, y0 - 2.2, z, 6.0, 4)
    return mb


# ==========================================================================
# Brutalist buildings — bare concrete, relief symbols, deep reveals
# ==========================================================================

def brutalist_block(rect, z, floors=3, floor_h=3.6, seed=4, *, fins=True,
                    reliefs=True, entrance="S", stair_tower=True):
    """Documented: several campus buildings are 'modern Brutalist ... built of
    unplastered concrete and decorated with various symbols', each specialised
    building 'decorated according to its field of knowledge'. The motifs
    themselves are not recorded in any reachable source, so the relief is an
    abstract incised composition rather than an invented emblem.
    """
    mb = MeshBuilder()
    x0, y0, x1, y1 = rect
    W, D = x1 - x0, y1 - y0
    H = floors * floor_h
    t = 0.42
    ground_slab(mb, rect, z, drop=1.0)

    deep = WinSpec(kind="punched", win_w=1.45, win_h=1.85, sill=1.00, bay=2.9,
                   margin=2.4, cols=2, recess=0.38)
    band = WinSpec(kind="ribbon", win_h=1.70, sill=1.05, margin=3.0,
                   panes_per_m=0.40, recess=0.34)
    ground = WinSpec(kind="punched", win_w=1.45, win_h=2.25, sill=0.70, bay=2.9,
                     margin=3.4, cols=2, recess=0.38)

    def add_fins(sub, L, Hh, th):
        if not fins:
            return
        n = max(2, int(L / 2.9))
        for i in range(n + 1):
            u = L * i / n
            sub.box(u - 0.20, -0.62, 0.35, u + 0.20, 0.02, Hh - 0.15, M_WALL2)

    corners = {"S": ((x0, y0), (x1, y0)), "E": ((x1, y0), (x1, y1)),
               "N": ((x1, y1), (x0, y1)), "W": ((x0, y1), (x0, y0))}
    specs = {"S": WinSpec(kind="punched", win_w=1.45, win_h=1.85, sill=1.00,
                          bay=2.9, margin=2.4, cols=2, recess=0.38,
                          ground_kind=ground),
             "E": band, "N": deep, "W": band}
    extras = {"S": add_fins, "N": add_fins}
    for k, (a, b) in corners.items():
        facade(mb, a, b, z, floors, floor_h, t, specs[k], wall_mat=M_WALL2,
               plinth=0.55, extra=extras.get(k))

    mb.box(x0 + t, y0 + t, z + H - 0.32, x1 - t, y1 - t, z + H - 0.12, M_ROOF)
    arch.parapet(mb, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z + H - 0.12,
                 height=1.05, thick=t, mat=M_WALL2)
    arch.roof_plant(mb, (x0 + x1) / 2, (y0 + y1) / 2, z + H - 0.12, seed=seed,
                    count=max(2, int(W * D / 460)))

    # blank relief panel on a gable end
    if reliefs:
        sub = MeshBuilder()
        arch.relief_symbols(sub, 1.5, 2.2, min(D - 3.0, 9.0), min(H - 4.0, 6.5),
                            seed=seed, depth=0.09, density=4)
        mb.append(sub, loc=(x1, y0, z), rot_z=math.pi / 2)

    # projecting stair tower — a Brutalist staple
    if stair_tower:
        tx = x0 + W * 0.18
        mb.box(tx - 2.6, y1 - 0.1, z, tx + 2.6, y1 + 4.2, z + H + 1.4, M_WALL2)
        for f in range(floors):
            zz = z + 0.9 + f * floor_h
            mb.box(tx - 0.9, y1 + 4.18, zz, tx + 0.9, y1 + 4.30, zz + 2.0, M_GLASS)

    # entrance with a heavy canopy
    if entrance == "S":
        cx = (x0 + x1) / 2
        sub = MeshBuilder()
        arch.door(sub, 0, 0, 3.2, 2.9, t, leaves=2, transom_h=0.5, recess=0.30)
        mb.append(sub, loc=(cx - 1.6, y0, z), rot_z=0.0)
        mb.box(cx - 4.0, y0 - 3.2, z + 3.6, cx + 4.0, y0 + 0.1, z + 3.95, M_WALL2)
        mb.box(cx - 3.6, y0 - 3.0, z, cx - 3.2, y0 - 2.6, z + 3.6, M_WALL2)
        mb.box(cx + 3.2, y0 - 3.0, z, cx + 3.6, y0 - 2.6, z + 3.6, M_WALL2)
        entrance_steps(mb, cx - 3.2, y0 - 4.6, z, 6.4, 4)
    return mb


# ==========================================================================
# COMPUTER & COMMUNICATIONS CENTRE — 1955 (former upper-division physics labs)
# ==========================================================================

def computer_centre(rect, z, floors=2, floor_h=3.8, seed=5):
    mb = MeshBuilder()
    x0, y0, x1, y1 = rect
    W, D = x1 - x0, y1 - y0
    H = floors * floor_h
    t = 0.34
    ground_slab(mb, rect, z, drop=0.9)

    lab = WinSpec(kind="ribbon", win_h=2.05, sill=1.05, margin=2.2,
                  panes_per_m=0.44, recess=0.20)
    back = WinSpec(kind="punched", win_w=1.3, win_h=1.5, sill=1.35, bay=3.0,
                   margin=2.0, cols=2, recess=0.20)
    end = WinSpec(kind="punched", win_w=1.1, win_h=1.5, sill=1.35, bay=4.0,
                  margin=2.4, cols=1, recess=0.20)

    def louvres(sub, L, Hh, th):
        for f in range(floors):
            arch.louvre_screen(sub, 2.2, f * floor_h + 3.20, L - 4.4, 0.55,
                               y=-0.30, pitch=0.18, tilt=38.0, mat=M_METAL)

    corners = {"S": ((x0, y0), (x1, y0)), "E": ((x1, y0), (x1, y1)),
               "N": ((x1, y1), (x0, y1)), "W": ((x0, y1), (x0, y0))}
    specs = {"S": lab, "E": end, "N": back, "W": end}
    for k, (a, b) in corners.items():
        facade(mb, a, b, z, floors, floor_h, t, specs[k], wall_mat=M_WALL2,
               plinth=0.45, extra=louvres if k == "S" else None)

    mb.box(x0 + t, y0 + t, z + H - 0.28, x1 - t, y1 - t, z + H - 0.10, M_ROOF)
    arch.parapet(mb, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z + H - 0.10,
                 height=0.80, thick=t, mat=M_WALL2)
    arch.roof_plant(mb, (x0 + x1) / 2, (y0 + y1) / 2, z + H - 0.10, seed=seed,
                    count=3)
    # small lecture-theatre bulge (the auditorium the centre is documented to hold)
    ax0, ax1 = x0 + W * 0.06, x0 + W * 0.40
    mb.box(ax0, y1 - 0.1, z, ax1, y1 + 8.5, z + 5.6, M_WALL2)
    mb.box(ax0 - 0.3, y1 - 0.1, z + 5.6, ax1 + 0.3, y1 + 8.8, z + 5.9, M_WALL2)

    cx = (x0 + x1) / 2
    sub = MeshBuilder()
    arch.door(sub, 0, 0, 3.0, 2.85, t, leaves=2, transom_h=0.5, recess=0.22)
    mb.append(sub, loc=(cx - 1.5, y0, z), rot_z=0.0)
    mb.box(cx - 3.4, y0 - 2.6, z + 3.5, cx + 3.4, y0 + 0.1, z + 3.75, M_WALL2)
    entrance_steps(mb, cx - 2.6, y0 - 3.4, z, 5.2, 3)
    return mb


# ==========================================================================
# ARCHIVE — 2004, stone-clad
# ==========================================================================

def archive(rect, z, floors=2, floor_h=3.6, seed=6):
    """The school archive and museum (est. 1995; this building 2004)."""
    mb = MeshBuilder()
    x0, y0, x1, y1 = rect
    W, D = x1 - x0, y1 - y0
    H = floors * floor_h
    t = 0.38
    ground_slab(mb, rect, z, drop=0.8)

    punched = WinSpec(kind="punched", win_w=1.15, win_h=1.55, sill=1.15,
                      bay=3.0, margin=2.2, cols=1, rows=1, recess=0.26)
    slot = WinSpec(kind="punched", win_w=0.55, win_h=2.40, sill=1.00, bay=2.4,
                   margin=2.0, cols=1, recess=0.30)

    corners = {"S": ((x0, y0), (x1, y0)), "E": ((x1, y0), (x1, y1)),
               "N": ((x1, y1), (x0, y1)), "W": ((x0, y1), (x0, y0))}
    specs = {"S": punched, "E": slot, "N": punched, "W": slot}
    for k, (a, b) in corners.items():
        facade(mb, a, b, z, floors, floor_h, t, specs[k], wall_mat=M_ACCENT,
               plinth=0.55)

    mb.box(x0 + t, y0 + t, z + H - 0.28, x1 - t, y1 - t, z + H - 0.10, M_ROOF)
    arch.parapet(mb, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z + H - 0.10,
                 height=0.70, thick=t, mat=M_ACCENT)
    arch.roof_plant(mb, (x0 + x1) / 2, (y0 + y1) / 2, z + H - 0.10, seed=seed,
                    count=2)
    # glazed entrance slot cut through the stone
    cx = x0 + W * 0.5
    mb.box(cx - 2.4, y0 - 1.6, z, cx + 2.4, y0 + 0.2, z + 0.20, M_WALL2)
    mb.box(cx - 2.6, y0 - 1.8, z + 4.4, cx + 2.6, y0 + 0.2, z + 4.7, M_WALL2)
    sub = MeshBuilder()
    arch.door(sub, 0, 0, 2.6, 2.9, t, leaves=2, transom_h=1.2, recess=0.20)
    mb.append(sub, loc=(cx - 1.3, y0, z), rot_z=0.0)
    return mb


# ==========================================================================
# RUACH ve-RE'UT — inaugurated 31 Aug 2022, humanities & social sciences
# ==========================================================================

def ruach_vereut(rect, z, floors=3, floor_h=3.9, seed=7):
    """The newest major building: a contemporary, largely glazed volume with a
    vertical aluminium fin screen and a deep recessed ground floor."""
    mb = MeshBuilder()
    x0, y0, x1, y1 = rect
    W, D = x1 - x0, y1 - y0
    H = floors * floor_h
    t = 0.30
    ground_slab(mb, rect, z, drop=0.9)

    curtain = WinSpec(kind="ribbon", win_h=2.75, sill=0.55, margin=1.2,
                      panes_per_m=0.38, recess=0.14)
    solid = WinSpec(kind="punched", win_w=1.4, win_h=1.9, sill=0.95, bay=3.6,
                    margin=2.0, cols=2, recess=0.20)

    def fins(sub, L, Hh, th):
        n = max(4, int(L / 1.25))
        for i in range(n + 1):
            u = L * i / n
            sub.box(u - 0.055, -0.72, floor_h - 0.3, u + 0.055, -0.10, Hh - 0.25,
                    M_METAL)
        for f in range(1, floors + 1):
            sub.box(-0.1, -0.80, f * floor_h - 0.42, L + 0.1, 0.02,
                    f * floor_h - 0.18, M_WALL)

    corners = {"S": ((x0, y0), (x1, y0)), "E": ((x1, y0), (x1, y1)),
               "N": ((x1, y1), (x0, y1)), "W": ((x0, y1), (x0, y0))}
    specs = {"S": curtain, "E": solid, "N": curtain, "W": solid}
    for k, (a, b) in corners.items():
        facade(mb, a, b, z, floors, floor_h, t, specs[k], wall_mat=M_WALL,
               plinth=0.0, extra=fins if k in ("S", "N") else None)

    mb.box(x0 + t, y0 + t, z + H - 0.26, x1 - t, y1 - t, z + H - 0.08, M_ROOF)
    arch.parapet(mb, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z + H - 0.08,
                 height=1.10, thick=t, mat=M_WALL)
    arch.roof_plant(mb, (x0 + x1) / 2, (y0 + y1) / 2, z + H - 0.08, seed=seed,
                    count=3)
    # a generous entrance loggia cut into the south-west corner
    mb.box(x0 - 3.4, y0 - 3.4, z + H - 0.08, x0 + W * 0.42, y0 + 0.2,
           z + H + 0.28, M_WALL)
    for i in range(3):
        arch.column_round(mb, x0 - 2.6 + i * (W * 0.42) / 3.0, y0 - 2.6, z,
                          z + H - 0.08, r=0.24, mat=M_WALL)
    cx = x0 + W * 0.20
    sub = MeshBuilder()
    for k in range(2):
        arch.door(sub, k * 3.2, 0, 2.8, 3.0, t, leaves=2, transom_h=0.8,
                  recess=0.12)
    mb.append(sub, loc=(cx - 3.0, y0, z), rot_z=0.0)
    return mb


# ==========================================================================
# SPORTS HALL — the 1955 sports complex: hall, indoor pool, fitness room
# ==========================================================================

def sports_hall(rect, z, seed=8):
    """Documented contents: 'sports hall, indoor swimming pool, fitness room and
    the office of the school sports coordinator'.

    Modelled as a tall clear-span hall with a shallow barrel roof and a
    continuous clerestory, plus a lower attached wing holding the pool and gym.
    """
    mb = MeshBuilder()
    x0, y0, x1, y1 = rect
    W, D = x1 - x0, y1 - y0
    t = 0.40
    ground_slab(mb, rect, z, drop=1.1)

    # --- the main hall: full-height volume on the north part of the footprint
    hy0 = y0 + D * 0.42
    hall_h = 11.6
    blank = WinSpec(kind="none")
    band = WinSpec(kind="ribbon", win_h=2.10, sill=8.30, margin=2.4,
                   panes_per_m=0.34, recess=0.24)
    corners = {"S": ((x0, hy0), (x1, hy0)), "E": ((x1, hy0), (x1, y1)),
               "N": ((x1, y1), (x0, y1)), "W": ((x0, y1), (x0, hy0))}
    specs = {"S": band, "E": band, "N": band, "W": band}
    for k, (a, b) in corners.items():
        facade(mb, a, b, z, 1, hall_h, t, specs[k], wall_mat=M_WALL2, plinth=0.6)

    # shallow barrel roof over the hall
    nseg = 18
    rise = 2.5
    for i in range(nseg):
        ax = x0 + W * i / nseg
        bx = x0 + W * (i + 1) / nseg

        def zc(x):
            u = (x - (x0 + x1) / 2) / (W / 2)
            return z + hall_h + rise * (1 - u * u)
        mb.quad((ax, hy0, zc(ax)), (bx, hy0, zc(bx)), (bx, y1, zc(bx)),
                (ax, y1, zc(ax)), M_ROOF)
        mb.quad((ax, hy0, zc(ax) - 0.30), (ax, y1, zc(ax) - 0.30),
                (bx, y1, zc(bx) - 0.30), (bx, hy0, zc(bx) - 0.30), M_SOFFIT)
        for ye in (hy0, y1):
            mb.quad((ax, ye, zc(ax)), (bx, ye, zc(bx)), (bx, ye, z + hall_h),
                    (ax, ye, z + hall_h), M_WALL2)
    # roof-light strip along the ridge
    for i in range(6):
        cx = x0 + W * (0.12 + i * 0.152)
        mb.box(cx - 1.6, hy0 + D * 0.12, z + hall_h + rise - 0.05,
               cx + 1.6, y1 - D * 0.12, z + hall_h + rise + 0.55, M_GLASS)

    # --- lower wing: indoor pool + fitness room + offices
    wy1 = hy0
    wing_h = 7.2
    pool_band = WinSpec(kind="ribbon", win_h=2.60, sill=2.60, margin=2.0,
                        panes_per_m=0.36, recess=0.20)
    low = WinSpec(kind="punched", win_w=1.5, win_h=1.6, sill=1.10, bay=3.2,
                  margin=2.2, cols=2, recess=0.22)
    wcorners = {"S": ((x0, y0), (x1, y0)), "E": ((x1, y0), (x1, wy1)),
                "W": ((x0, wy1), (x0, y0))}
    wspecs = {"S": pool_band, "E": low, "W": low}
    for k, (a, b) in wcorners.items():
        facade(mb, a, b, z, 1, wing_h, t, wspecs[k], wall_mat=M_WALL2, plinth=0.6)
    mb.box(x0 + t, y0 + t, z + wing_h - 0.30, x1 - t, wy1, z + wing_h - 0.10,
           M_ROOF)
    arch.parapet(mb, [(x0, y0), (x1, y0), (x1, wy1), (x0, wy1)],
                 z + wing_h - 0.10, height=0.85, thick=t, mat=M_WALL2)
    arch.roof_plant(mb, (x0 + x1) / 2, (y0 + wy1) / 2, z + wing_h - 0.10,
                    seed=seed, count=4)

    # entrance under a deep canopy
    cx = x0 + W * 0.30
    sub = MeshBuilder()
    for k in range(2):
        arch.door(sub, k * 3.4, 0, 3.0, 2.9, t, leaves=2, transom_h=0.6,
                  recess=0.22)
    mb.append(sub, loc=(cx - 3.2, y0, z), rot_z=0.0)
    mb.box(cx - 5.0, y0 - 3.6, z + 3.9, cx + 5.0, y0 + 0.1, z + 4.25, M_WALL2)
    for ox in (-4.2, 0.0, 4.2):
        arch.column_round(mb, cx + ox, y0 - 3.0, z, z + 3.9, r=0.22, mat=M_WALL2)
    entrance_steps(mb, cx - 4.0, y0 - 5.0, z, 8.0, 3)
    return mb


def swimming_pool(mb, rect, z, *, mat_water=M_GLASS, mat_deck=M_WALL2,
                  mat_tile=M_ACCENT, depth=1.6):
    """The indoor pool tank, visible through the pool-hall glazing."""
    x0, y0, x1, y1 = rect
    mb.box(x0 - 2.0, y0 - 2.0, z - 0.02, x1 + 2.0, y1 + 2.0, z + 0.02, mat_deck)
    mb.box(x0, y0, z - depth, x1, y1, z - depth + 0.05, mat_tile)
    for (ax, ay, bx, by) in ((x0, y0, x1, y0 + 0.12), (x0, y1 - 0.12, x1, y1),
                             (x0, y0, x0 + 0.12, y1), (x1 - 0.12, y0, x1, y1)):
        mb.box(ax, ay, z - depth, bx, by, z - 0.03, mat_tile)
    mb.box(x0 + 0.12, y0 + 0.12, z - 0.12, x1 - 0.12, y1 - 0.12, z - 0.10,
           mat_water)
    # lane markings on the tank floor
    lanes = 6
    for i in range(1, lanes):
        yy = y0 + (y1 - y0) * i / lanes
        mb.box(x0 + 0.4, yy - 0.07, z - depth + 0.05, x1 - 0.4, yy + 0.07,
               z - depth + 0.07, M_DARK)


# ==========================================================================
# small buildings
# ==========================================================================

def kindergarten(rect, z, seed=9):
    """The ecological kindergarten cluster (ages 3-5) documented on campus:
    low pavilions with mono-pitch roofs and a shaded play deck."""
    mb = MeshBuilder()
    x0, y0, x1, y1 = rect
    W, D = x1 - x0, y1 - y0
    n = 3
    for i in range(n):
        px0 = x0 + i * (W / n) + 1.4
        px1 = x0 + (i + 1) * (W / n) - 1.4
        py0, py1 = y0 + 2.0, y0 + D * 0.62
        h = 3.4
        spec = WinSpec(kind="ribbon", win_h=1.75, sill=0.70, margin=1.0,
                       panes_per_m=0.50, recess=0.12)
        blank = WinSpec(kind="punched", win_w=0.9, win_h=1.2, sill=1.2, bay=3.0,
                        margin=1.4, cols=1, recess=0.12)
        for (a, b, s) in (((px0, py0), (px1, py0), spec),
                          ((px1, py0), (px1, py1), blank),
                          ((px1, py1), (px0, py1), blank),
                          ((px0, py1), (px0, py0), blank)):
            facade(mb, a, b, z, 1, h, 0.26, s, wall_mat=M_WALL, plinth=0.35)
        # mono-pitch roof with an overhang
        mb.face([(px0 - 0.8, py0 - 0.8, z + h + 0.9), (px1 + 0.8, py0 - 0.8, z + h + 0.9),
                 (px1 + 0.8, py1 + 0.8, z + h + 0.1), (px0 - 0.8, py1 + 0.8, z + h + 0.1)],
                M_ROOF)
        mb.face([(px0 - 0.8, py1 + 0.8, z + h), (px1 + 0.8, py1 + 0.8, z + h),
                 (px1 + 0.8, py0 - 0.8, z + h + 0.8), (px0 - 0.8, py0 - 0.8, z + h + 0.8)],
                M_SOFFIT)
        for (ax, ay) in ((px0 - 0.8, py0 - 0.8), (px1 + 0.8, py0 - 0.8)):
            mb.box(ax - 0.06, ay - 0.06, z + h + 0.8, ax + 0.06, ay + 0.06,
                   z + h + 0.9, M_WALL)
        # shade sail posts over the play deck
        for ox in (px0 + 1.0, px1 - 1.0):
            mb.box(ox - 0.08, py0 - 4.2, z, ox + 0.08, py0 - 4.04, z + 2.8, M_METAL)
        mb.box(px0 + 0.6, py0 - 4.4, z + 2.75, px1 - 0.6, py0 - 0.4, z + 2.85,
               M_ACCENT)
    return mb


def utility_shed(rect, z, h=4.2, seed=10):
    mb = MeshBuilder()
    x0, y0, x1, y1 = rect
    spec = WinSpec(kind="punched", win_w=1.1, win_h=1.0, sill=2.2, bay=4.5,
                   margin=2.0, cols=1, recess=0.14)
    blank = WinSpec(kind="none")
    for (a, b, s) in (((x0, y0), (x1, y0), spec), ((x1, y0), (x1, y1), blank),
                      ((x1, y1), (x0, y1), spec), ((x0, y1), (x0, y0), blank)):
        facade(mb, a, b, z, 1, h, 0.25, s, wall_mat=M_WALL2, plinth=0.3)
    mb.box(x0 - 0.35, y0 - 0.35, z + h, x1 + 0.35, y1 + 0.35, z + h + 0.22, M_ROOF)
    # roller shutter door
    cx = (x0 + x1) / 2
    mb.box(cx - 2.2, y0 - 0.06, z, cx + 2.2, y0 + 0.06, z + 3.4, M_METAL)
    for i in range(20):
        zz = z + 0.1 + i * 0.165
        mb.box(cx - 2.15, y0 - 0.10, zz, cx + 2.15, y0 - 0.04, zz + 0.14, M_METAL)
    return mb


def gatehouse(rect, z, seed=11):
    """The gate lodge: students are checked in at the campus entrance."""
    mb = MeshBuilder()
    x0, y0, x1, y1 = rect
    h = 3.2
    spec = WinSpec(kind="ribbon", win_h=1.45, sill=1.05, margin=0.5,
                   panes_per_m=0.55, recess=0.10)
    for (a, b) in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)),
                   ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))):
        facade(mb, a, b, z, 1, h, 0.22, spec, wall_mat=M_WALL, plinth=0.3)
    mb.box(x0 - 0.7, y0 - 0.7, z + h, x1 + 0.7, y1 + 0.7, z + h + 0.24, M_ROOF)
    mb.box(x0 - 0.6, y0 - 0.6, z + h + 0.24, x1 + 0.6, y1 + 0.6, z + h + 0.30,
           M_WALL2)
    return mb
