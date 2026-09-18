"""Architectural element builders: real geometry for windows, doors, railings,
stairs, pergolas, brise-soleil, parapets and building services.

All builders write into a `core.MeshBuilder` in *wall-local* coordinates unless
stated otherwise: the wall runs along +X, its thickness runs 0..t along +Y with
the OUTER face at y = 0, and height runs along +Z.
"""
import math
import random

from core import MeshBuilder

# material slot convention shared by every building mesh
M_WALL = 0      # primary wall surface
M_WALL2 = 1     # secondary wall / exposed concrete
M_FRAME = 2     # window & door frames
M_GLASS = 3     # glazing
M_METAL = 4     # railings, louvres, pipes, plant
M_ROOF = 5      # roof surface
M_SOFFIT = 6    # reveals, soffits, undersides
M_ACCENT = 7    # stone, timber, signage panels
M_DARK = 8      # recessed / shadow-gap surfaces

MAT_ORDER = [M_WALL, M_WALL2, M_FRAME, M_GLASS, M_METAL, M_ROOF, M_SOFFIT,
             M_ACCENT, M_DARK]


# --------------------------------------------------------------------------
# windows
# --------------------------------------------------------------------------

def window(mb, u, v, w, h, wall_t, *, cols=2, rows=1, recess=0.10,
           frame_w=0.055, frame_d=0.075, mullion_w=0.045, sill=True,
           sill_proj=0.06, sill_h=0.05, glass_mat=M_GLASS, frame_mat=M_FRAME,
           open_leaf=None, transom_at=None, interior=True, interior_depth=1.6):
    """A real window assembly inside an already-punched opening.

    cols/rows set the pane grid; `transom_at` (0..1) puts a single horizontal
    transom at that fraction of the height instead of an even row split.
    `open_leaf` = (col_index, angle_deg) swings one leaf open.
    """
    y0 = recess
    y1 = recess + frame_d
    fw = frame_w

    # --- outer frame (four members, mitred visually by simple boxes) ---
    mb.box(u, y0, v, u + w, y1, v + fw, frame_mat)                     # bottom
    mb.box(u, y0, v + h - fw, u + w, y1, v + h, frame_mat)             # head
    mb.box(u, y0, v + fw, u + fw, y1, v + h - fw, frame_mat)           # left
    mb.box(u + w - fw, y0, v + fw, u + w, y1, v + h - fw, frame_mat)   # right

    iu0, iu1 = u + fw, u + w - fw
    iv0, iv1 = v + fw, v + h - fw
    iw, ih = iu1 - iu0, iv1 - iv0
    if iw <= 0 or ih <= 0:
        return

    # --- mullions and transoms ---
    xs = [iu0]
    for c in range(1, cols):
        cx = iu0 + iw * c / cols
        mb.box(cx - mullion_w / 2, y0, iv0, cx + mullion_w / 2, y1, iv1, frame_mat)
        xs.append(cx + mullion_w / 2)
        xs.insert(-1, cx - mullion_w / 2)
    xs.append(iu1)

    zs = [iv0]
    if transom_at is not None:
        tz = iv0 + ih * transom_at
        mb.box(iu0, y0, tz - mullion_w / 2, iu1, y1, tz + mullion_w / 2, frame_mat)
        zs += [tz - mullion_w / 2, tz + mullion_w / 2]
    else:
        for r in range(1, rows):
            rz = iv0 + ih * r / rows
            mb.box(iu0, y0, rz - mullion_w / 2, iu1, y1, rz + mullion_w / 2, frame_mat)
            zs += [rz - mullion_w / 2, rz + mullion_w / 2]
    zs.append(iv1)

    # --- glazing: one pane per cell, set at the back of the frame ---
    gy = y1 - 0.012
    for i in range(0, len(xs) - 1, 2):
        for j in range(0, len(zs) - 1, 2):
            a, b = xs[i], xs[i + 1]
            c, d = zs[j], zs[j + 1]
            if b - a < 1e-4 or d - c < 1e-4:
                continue
            mb.quad((a, gy, c), (b, gy, c), (b, gy, d), (a, gy, d), glass_mat)
            mb.quad((a, gy + 0.008, c), (a, gy + 0.008, d),
                    (b, gy + 0.008, d), (b, gy + 0.008, c), glass_mat)

    # --- interior backing ---
    # The buildings are modelled as shells. Without this, a window is a hole you
    # can see straight through to the far facade, which instantly reads as fake.
    # A shallow dark recess behind the glass gives the room depth instead.
    if interior:
        d = wall_t + interior_depth
        mb.quad((u, d, v), (u + w, d, v), (u + w, d, v + h), (u, d, v + h), M_DARK)
        mb.quad((u, wall_t, v), (u, d, v), (u, d, v + h), (u, wall_t, v + h),
                M_DARK)
        mb.quad((u + w, wall_t, v), (u + w, wall_t, v + h), (u + w, d, v + h),
                (u + w, d, v), M_DARK)
        mb.quad((u, wall_t, v + h), (u, d, v + h), (u + w, d, v + h),
                (u + w, wall_t, v + h), M_DARK)
        mb.quad((u, wall_t, v), (u + w, wall_t, v), (u + w, d, v), (u, d, v),
                M_DARK)

    # --- projecting sill, weathered and slightly sloped ---
    if sill:
        mb.box(u - 0.04, -sill_proj, v - sill_h, u + w + 0.04, 0.02, v, M_WALL2)

    if open_leaf is not None:
        ci, ang = open_leaf
        ci = max(0, min(cols - 1, ci))
        a = iu0 + iw * ci / cols
        b = iu0 + iw * (ci + 1) / cols
        _swing_leaf(mb, a, b, iv0, iv1, y0, ang, frame_mat, glass_mat)


def _swing_leaf(mb, a, b, c, d, y, angle_deg, frame_mat, glass_mat):
    """An opened casement, hinged on its left stile."""
    ang = math.radians(angle_deg)
    lw = b - a
    t = 0.04
    ca, sa = math.cos(ang), math.sin(ang)

    def p(du, dy, z):
        return (a + du * ca - dy * sa, y + du * sa + dy * ca, z)

    for (u0, u1, z0, z1) in ((0, lw, 0, 0.06), (0, lw, d - c - 0.06, d - c),
                             (0, 0.06, 0, d - c), (lw - 0.06, lw, 0, d - c)):
        pts = [(u0, 0), (u1, 0), (u1, -t), (u0, -t)]
        bot = [p(px, py, c + z0) for px, py in pts]
        top = [p(px, py, c + z1) for px, py in pts]
        for i in range(4):
            mb.quad(bot[i], bot[(i + 1) % 4], top[(i + 1) % 4], top[i], frame_mat)
        mb.face(top, frame_mat)
        mb.face(list(reversed(bot)), frame_mat)
    gz0, gz1 = c + 0.06, d - 0.06
    g = [p(0.06, -t / 2, gz0), p(lw - 0.06, -t / 2, gz0),
         p(lw - 0.06, -t / 2, gz1), p(0.06, -t / 2, gz1)]
    mb.face(g, glass_mat)
    mb.face(list(reversed(g)), glass_mat)


def shutter_box(mb, u, v, w, wall_t, *, box_h=0.30, drop=0.0, recess=0.10):
    """External roller-shutter box with optional partly-lowered slat curtain."""
    mb.box(u - 0.03, recess - 0.02, v, u + w + 0.03, recess + 0.22, v + box_h, M_WALL2)
    if drop > 0.01:
        y = recess + 0.03
        n = max(1, int(drop / 0.055))
        for i in range(n):
            z1 = v - i * 0.055
            mb.box(u + 0.01, y, z1 - 0.050, u + w - 0.01, y + 0.022, z1, M_METAL)


def louvre_screen(mb, u, v, w, h, *, y=0.0, depth=0.16, blades=None,
                  pitch=0.16, tilt=32.0, mat=M_METAL):
    """Fixed louvre sunscreen — very common on Israeli institutional facades."""
    n = blades if blades else max(2, int(h / pitch))
    ang = math.radians(tilt)
    dz = depth * math.sin(ang) * 0.5
    dy = depth * math.cos(ang) * 0.5
    for i in range(n):
        z = v + (i + 0.5) * h / n
        c = [(u, y - dy, z - dz), (u + w, y - dy, z - dz),
             (u + w, y + dy, z + dz), (u, y + dy, z + dz)]
        mb.face(c, mat)
        mb.face(list(reversed([(p[0], p[1], p[2] - 0.022) for p in c])), mat)
        for i2 in range(4):
            a = c[i2]
            b = c[(i2 + 1) % 4]
            mb.quad(a, b, (b[0], b[1], b[2] - 0.022), (a[0], a[1], a[2] - 0.022), mat)


def door(mb, u, v, w, h, wall_t, *, leaves=2, recess=0.08, frame_w=0.07,
         glazed=True, kick=0.32, mat=M_FRAME, transom_h=0.0):
    """Entrance door set with frame, leaves, vision panels and a kick plate."""
    y0, y1 = recess, recess + 0.09
    fw = frame_w
    dh = h - transom_h
    mb.box(u, y0, v + dh - fw, u + w, y1, v + dh, mat)
    mb.box(u, y0, v, u + fw, y1, v + dh - fw, mat)
    mb.box(u + w - fw, y0, v, u + w, y1, v + dh - fw, mat)
    if transom_h > 0.01:
        mb.box(u, y0, v + dh, u + w, y1, v + h, mat)
        mb.quad((u + fw, y1 - 0.02, v + dh), (u + w - fw, y1 - 0.02, v + dh),
                (u + w - fw, y1 - 0.02, v + h - fw), (u + fw, y1 - 0.02, v + h - fw),
                M_GLASS)

    iu0, iu1 = u + fw, u + w - fw
    lw = (iu1 - iu0) / leaves
    for L in range(leaves):
        a = iu0 + L * lw
        b = a + lw
        sty = 0.075
        mb.box(a, y0 + 0.01, v, b, y0 + 0.055, v + kick, mat)
        mb.box(a, y0 + 0.01, v + dh - fw - sty, b, y0 + 0.055, v + dh - fw, mat)
        mb.box(a, y0 + 0.01, v + kick, a + sty, y0 + 0.055, v + dh - fw, mat)
        mb.box(b - sty, y0 + 0.01, v + kick, b, y0 + 0.055, v + dh - fw, mat)
        if glazed:
            mb.quad((a + sty, y0 + 0.032, v + kick), (b - sty, y0 + 0.032, v + kick),
                    (b - sty, y0 + 0.032, v + dh - fw - sty),
                    (a + sty, y0 + 0.032, v + dh - fw - sty), M_GLASS)
        else:
            mb.box(a + sty, y0 + 0.02, v + kick, b - sty, y0 + 0.05,
                   v + dh - fw - sty, mat)
        # pull handle
        hx = b - sty - 0.08 if L == 0 else a + sty + 0.08
        mb.box(hx - 0.02, y0 - 0.06, v + 1.00, hx + 0.02, y0 + 0.01, v + 1.22, M_METAL)


# --------------------------------------------------------------------------
# railings, stairs, ramps  (these build in WORLD coordinates)
# --------------------------------------------------------------------------

def railing(mb, path, z, *, height=1.05, post_every=1.8, post=0.05,
            rail=0.045, balusters=True, bal_gap=0.11, mat=M_METAL,
            infill_panel=False):
    """Metal railing along a world-space polyline [(x, y), ...] at height z."""
    for i in range(len(path) - 1):
        (x0, y0), (x1, y1) = path[i], path[i + 1]
        seg = math.hypot(x1 - x0, y1 - y0)
        if seg < 1e-3:
            continue
        ux, uy = (x1 - x0) / seg, (y1 - y0) / seg
        nx, ny = -uy, ux

        def at(d, off=0.0, zz=0.0):
            return (x0 + ux * d + nx * off, y0 + uy * d + ny * off, z + zz)

        n_posts = max(2, int(seg / post_every) + 1)
        for p in range(n_posts):
            d = seg * p / (n_posts - 1)
            _bar(mb, at(d, -post / 2, 0), at(d, post / 2, height),
                 ux, uy, post, mat)
        for zz in (height - rail, height * 0.5 - rail / 2):
            _rail_run(mb, at(0), at(seg), zz, rail, mat)
        if infill_panel:
            _panel(mb, at(0, 0, 0.06), at(seg, 0, 0.06), height - 0.16, 0.02, mat)
        elif balusters:
            n_b = max(1, int(seg / bal_gap))
            for bnum in range(1, n_b):
                d = seg * bnum / n_b
                _bar(mb, at(d), at(d), ux, uy, 0.016, mat, z0=0.02,
                     z1=height - rail)


def _bar(mb, p0, p1, ux, uy, s, mat, z0=None, z1=None):
    x, y = p0[0], p0[1]
    za = p0[2] if z0 is None else p0[2] + z0
    zb = p1[2] if z1 is None else p0[2] + z1
    nx, ny = -uy, ux
    h = s / 2
    poly = [(x + ux * h + nx * h, y + uy * h + ny * h),
            (x - ux * h + nx * h, y - uy * h + ny * h),
            (x - ux * h - nx * h, y - uy * h - ny * h),
            (x + ux * h - nx * h, y + uy * h - ny * h)]
    mb.prism(poly, za, zb, mat)


def _rail_run(mb, p0, p1, zoff, s, mat):
    x0, y0, z = p0
    x1, y1, _ = p1
    d = math.hypot(x1 - x0, y1 - y0)
    if d < 1e-4:
        return
    ux, uy = (x1 - x0) / d, (y1 - y0) / d
    nx, ny = -uy, ux
    h = s / 2
    za, zb = z + zoff, z + zoff + s
    poly = [(x0 + nx * h, y0 + ny * h), (x1 + nx * h, y1 + ny * h),
            (x1 - nx * h, y1 - ny * h), (x0 - nx * h, y0 - ny * h)]
    mb.prism(poly, za, zb, mat)


def _panel(mb, p0, p1, h, t, mat):
    x0, y0, z = p0
    x1, y1, _ = p1
    d = math.hypot(x1 - x0, y1 - y0)
    if d < 1e-4:
        return
    ux, uy = (x1 - x0) / d, (y1 - y0) / d
    nx, ny = -uy, ux
    poly = [(x0 + nx * t / 2, y0 + ny * t / 2), (x1 + nx * t / 2, y1 + ny * t / 2),
            (x1 - nx * t / 2, y1 - ny * t / 2), (x0 - nx * t / 2, y0 - ny * t / 2)]
    mb.prism(poly, z, z + h, mat)


def stairs(mb, x, y, z, width, n_steps, rise=0.165, run=0.30, *, ang=0.0,
           mat=0, nosing=0.025):
    """Flight of steps starting at (x, y, z), climbing along +Y rotated by `ang`."""
    ca, sa = math.cos(ang), math.sin(ang)

    def wp(u, v, zz):
        return (x + u * ca - v * sa, y + u * sa + v * ca, zz)

    for i in range(n_steps):
        z0 = z + i * rise
        z1 = z0 + rise
        v0 = i * run
        v1 = v0 + run
        tread = [wp(0, v0 - nosing, z1), wp(width, v0 - nosing, z1),
                 wp(width, v1, z1), wp(0, v1, z1)]
        mb.face(tread, mat)
        riser = [wp(0, v0 - nosing, z0), wp(0, v0 - nosing, z1),
                 wp(width, v0 - nosing, z1), wp(width, v0 - nosing, z0)]
        mb.face(riser, mat)
    # solid flanks so the flight reads as cast concrete, not floating planes
    for side in ((0.0, -1), (width, 1)):
        u, _ = side
        pts = []
        for i in range(n_steps + 1):
            pts.append(wp(u, i * run, z + i * rise))
            if i < n_steps:
                pts.append(wp(u, i * run, z + (i + 1) * rise))
        base = [wp(u, n_steps * run, z), wp(u, 0, z)]
        poly = pts + base
        mb.face(poly if side[1] > 0 else list(reversed(poly)), mat)


def ramp(mb, x, y, z0, z1, width, length, *, ang=0.0, mat=0, kerb=0.12):
    ca, sa = math.cos(ang), math.sin(ang)

    def wp(u, v, zz):
        return (x + u * ca - v * sa, y + u * sa + v * ca, zz)

    mb.face([wp(0, 0, z0), wp(width, 0, z0), wp(width, length, z1),
             wp(0, length, z1)], mat)
    for u, s in ((0.0, -1), (width, 1)):
        top = [wp(u, 0, z0 + kerb), wp(u, length, z1 + kerb)]
        bot = [wp(u, length, z1 - 0.25), wp(u, 0, z0 - 0.25)]
        poly = top + bot
        mb.face(poly if s > 0 else list(reversed(poly)), mat)


# --------------------------------------------------------------------------
# the pergola spine  — "שדרת הפרגולה"
# --------------------------------------------------------------------------

def pergola(mb, path, zs, *, width=3.6, post_every=3.6, height=3.1,
            post=0.26, beam=0.22, slat_w=0.09, slat_gap=0.22,
            mat_struct=M_WALL2, mat_slat=M_WALL2, slats=True):
    """Covered walkway linking the campus buildings.

    `path` is a world polyline [(x, y), ...]; `zs` is a callable returning
    ground height at (x, y). Concrete posts in pairs carry longitudinal beams
    with a slatted top that throws the characteristic ladder of shadow.
    """
    for i in range(len(path) - 1):
        (x0, y0), (x1, y1) = path[i], path[i + 1]
        seg = math.hypot(x1 - x0, y1 - y0)
        if seg < 0.5:
            continue
        ux, uy = (x1 - x0) / seg, (y1 - y0) / seg
        nx, ny = -uy, ux
        hw = width / 2
        n_bays = max(1, round(seg / post_every))
        step = seg / n_bays

        # posts
        for b in range(n_bays + 1):
            d = b * step
            px, py = x0 + ux * d, y0 + uy * d
            for s in (-1, 1):
                cx, cy = px + nx * hw * s, py + ny * hw * s
                g = zs(cx, cy)
                poly = [(cx + ux * post / 2 + nx * post / 2,
                         cy + uy * post / 2 + ny * post / 2),
                        (cx - ux * post / 2 + nx * post / 2,
                         cy - uy * post / 2 + ny * post / 2),
                        (cx - ux * post / 2 - nx * post / 2,
                         cy - uy * post / 2 - ny * post / 2),
                        (cx + ux * post / 2 - nx * post / 2,
                         cy + uy * post / 2 - ny * post / 2)]
                mb.prism(poly, g - 0.35, g + height, mat_struct)

        gz = zs((x0 + x1) / 2, (y0 + y1) / 2)
        top = gz + height
        # longitudinal beams
        for s in (-1, 1):
            ax, ay = x0 + nx * hw * s, y0 + ny * hw * s
            bx, by = x1 + nx * hw * s, y1 + ny * hw * s
            poly = [(ax + nx * beam / 2, ay + ny * beam / 2),
                    (bx + nx * beam / 2, by + ny * beam / 2),
                    (bx - nx * beam / 2, by - ny * beam / 2),
                    (ax - nx * beam / 2, ay - ny * beam / 2)]
            mb.prism(poly, top, top + 0.30, mat_struct)
        # transverse slats
        if slats:
            n_s = max(1, int(seg / slat_gap))
            for k in range(n_s):
                d = (k + 0.5) * seg / n_s
                px, py = x0 + ux * d, y0 + uy * d
                a = (px + nx * (hw + 0.30), py + ny * (hw + 0.30))
                b = (px - nx * (hw + 0.30), py - ny * (hw + 0.30))
                poly = [(a[0] + ux * slat_w / 2, a[1] + uy * slat_w / 2),
                        (b[0] + ux * slat_w / 2, b[1] + uy * slat_w / 2),
                        (b[0] - ux * slat_w / 2, b[1] - uy * slat_w / 2),
                        (a[0] - ux * slat_w / 2, a[1] - uy * slat_w / 2)]
                mb.prism(poly, top + 0.30, top + 0.42, mat_slat)


# --------------------------------------------------------------------------
# facade furniture / building services
# --------------------------------------------------------------------------

def brise_soleil(mb, u, v, w, h, *, y=0.0, proj=1.6, fins=None, pitch=1.2,
                 thick=0.14, mat=M_WALL2):
    """Deep horizontal concrete shading fins.

    Documented at Beit Biram: the library building is shaded by a horizontal
    concrete surface attached to it that stops it overheating in summer.
    """
    n = fins if fins else max(1, int(h / pitch))
    for i in range(n):
        z = v + (i + 1) * h / (n + 1)
        mb.box(u, -proj, z, u + w, y + 0.02, z + thick, mat)
        # end returns so the fins read as a cast assembly
        if i == 0 or i == n - 1:
            pass
    mb.box(u - 0.10, -proj - 0.10, v, u, y + 0.02, v + h, mat)
    mb.box(u + w, -proj - 0.10, v, u + w + 0.10, y + 0.02, v + h, mat)


def canopy(mb, u, v, w, *, y=0.0, proj=2.8, thick=0.26, z=0.0, mat=M_WALL2,
           columns=0, col_size=0.24):
    """Cantilevered or column-supported entrance canopy (wall-local)."""
    mb.box(u, -proj, z, u + w, y + 0.02, z + thick, mat)
    if columns:
        for i in range(columns):
            cx = u + (i + 0.5) * w / columns
            mb.box(cx - col_size / 2, -proj + 0.25, 0,
                   cx + col_size / 2, -proj + 0.25 + col_size, z, mat)


def parapet(mb, poly, z, *, height=0.95, thick=0.24, mat=M_WALL2, coping=True):
    """Upstand parapet around a roof outline (world coords, CCW polygon)."""
    n = len(poly)
    inner = _offset_poly(poly, -thick)
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        ai, bi = inner[i], inner[(i + 1) % n]
        mb.prism([a, b, bi, ai], z, z + height, mat, cap_bottom=False)
    if coping:
        outer = _offset_poly(poly, 0.05)
        inner2 = _offset_poly(poly, -thick - 0.05)
        for i in range(n):
            a, b = outer[i], outer[(i + 1) % n]
            ai, bi = inner2[i], inner2[(i + 1) % n]
            mb.prism([a, b, bi, ai], z + height, z + height + 0.07, mat,
                     cap_bottom=False)


def _offset_poly(poly, d):
    """Offset a convex-ish polygon by d (positive = outward) via vertex normals."""
    n = len(poly)
    out = []
    cx = sum(p[0] for p in poly) / n
    cy = sum(p[1] for p in poly) / n
    for x, y in poly:
        vx, vy = x - cx, y - cy
        L = math.hypot(vx, vy) or 1.0
        out.append((x + vx / L * d, y + vy / L * d))
    return out


def downpipe(mb, x, y, z0, z1, *, r=0.055, mat=M_METAL, seg=8):
    pts = [(x + r * math.cos(2 * math.pi * i / seg),
            y + r * math.sin(2 * math.pi * i / seg)) for i in range(seg)]
    mb.prism(pts, z0, z1, mat)
    for zc in (z0 + 0.9, (z0 + z1) / 2, z1 - 0.6):
        if z0 < zc < z1:
            big = [(x + (r + 0.02) * math.cos(2 * math.pi * i / seg),
                    y + (r + 0.02) * math.sin(2 * math.pi * i / seg))
                   for i in range(seg)]
            mb.prism(big, zc - 0.05, zc + 0.05, mat)


def ac_unit(mb, x, y, z, *, w=0.92, d=0.36, h=0.66, ang=0.0, mat=M_METAL):
    """Wall-mounted condenser on a bracket — ubiquitous on Israeli buildings."""
    ca, sa = math.cos(ang), math.sin(ang)

    def wp(u, v):
        return (x + u * ca - v * sa, y + u * sa + v * ca)

    poly = [wp(-w / 2, 0), wp(w / 2, 0), wp(w / 2, d), wp(-w / 2, d)]
    mb.prism(poly, z, z + h, mat)
    # grille recess
    gp = [wp(-w / 2 + 0.06, d - 0.02), wp(w / 2 - 0.06, d - 0.02),
          wp(w / 2 - 0.06, d + 0.01), wp(-w / 2 + 0.06, d + 0.01)]
    mb.prism(gp, z + 0.08, z + h - 0.08, M_DARK)
    for s in (-1, 1):
        bp = [wp(s * (w / 2 - 0.08), 0), wp(s * (w / 2 - 0.05), 0),
              wp(s * (w / 2 - 0.05), d), wp(s * (w / 2 - 0.08), d)]
        mb.prism(bp, z - 0.10, z, mat)


def roof_plant(mb, x, y, z, *, seed=0, count=3, mat=M_METAL):
    """Roof-top services: AHUs, ducts, water tanks, lift overrun."""
    rng = random.Random(seed)
    for i in range(count):
        w = rng.uniform(1.1, 2.4)
        d = rng.uniform(0.9, 1.8)
        h = rng.uniform(0.7, 1.5)
        ox = x + rng.uniform(-6, 6)
        oy = y + rng.uniform(-5, 5)
        mb.box(ox - w / 2, oy - d / 2, z + 0.12, ox + w / 2, oy + d / 2,
               z + 0.12 + h, mat)
        for s in (-1, 1):
            mb.box(ox - w / 2 + 0.1, oy + s * (d / 2 - 0.12), z,
                   ox + w / 2 - 0.1, oy + s * (d / 2 - 0.05), z + 0.12, mat)
    # dudim: the white solar water tanks on every Israeli roof
    for i in range(2):
        tx = x + rng.uniform(-5, 5)
        ty = y + rng.uniform(-4, 4)
        r = 0.35
        pts = [(tx + r * math.cos(a * math.pi / 6), ty + r * math.sin(a * math.pi / 6))
               for a in range(12)]
        mb.prism(pts, z + 0.5, z + 2.1, mat)
        mb.box(tx - 1.0, ty - 0.7, z + 0.05, tx + 1.0, ty + 0.7, z + 0.12, mat)


def column_round(mb, x, y, z0, z1, r=0.22, mat=M_WALL2, seg=12):
    pts = [(x + r * math.cos(2 * math.pi * i / seg),
            y + r * math.sin(2 * math.pi * i / seg)) for i in range(seg)]
    mb.prism(pts, z0, z1, mat)


def relief_symbols(mb, u, v, w, h, *, y=0.0, seed=0, depth=0.05, mat=M_WALL2,
                   density=5):
    """Shallow cast-in relief panel.

    Documented: the Brutalist buildings are 'decorated with various symbols',
    each specialised building 'according to its field of knowledge'. Exact
    motifs are not recorded anywhere reachable, so this renders an abstract
    incised composition rather than inventing specific emblems.
    """
    if w <= 0.05 or h <= 0.05 or density < 1:
        return
    rng = random.Random(seed)
    cell_w = w / density
    cell_h = h / max(1, int(density * h / max(w, 0.1))) if density * h / max(w, 0.1) >= 1 else h
    nz = max(1, int(h / cell_h))
    for i in range(density):
        for j in range(nz):
            if rng.random() < 0.45:
                continue
            a = u + i * cell_w + cell_w * 0.18
            b = u + (i + 1) * cell_w - cell_w * 0.18
            c = v + j * cell_h + cell_h * 0.18
            d = v + (j + 1) * cell_h - cell_h * 0.18
            mb.box(a, y - depth, c, b, y + 0.01, d, mat)
