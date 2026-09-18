"""Site furniture, boundary elements and the small objects that make close
camera shots hold up: benches, bins, lamps, bollards, bike racks, signs,
fences, gates, kerbs, manholes, goals, hoops and parked cars.

Material slot convention for prop meshes:
"""
import math
import random

from core import MeshBuilder

P_CONCRETE = 0
P_METAL = 1
P_WOOD = 2
P_PAINT = 3
P_GLASS = 4
P_DARK = 5
P_SIGN = 6
P_LIGHT = 7


# --------------------------------------------------------------------------
# seating & bins
# --------------------------------------------------------------------------

def bench(mb, x, y, z, *, ang=0.0, length=1.9, back=True, seed=0):
    """Timber-slat bench on cast concrete legs — the Israeli municipal standard."""
    ca, sa = math.cos(ang), math.sin(ang)

    def wp(u, v):
        return (x + u * ca - v * sa, y + u * sa + v * ca)

    seat_z = z + 0.44
    for s in (-1, 1):
        u = s * (length / 2 - 0.16)
        poly = [wp(u - 0.07, -0.24), wp(u + 0.07, -0.24),
                wp(u + 0.07, 0.24), wp(u - 0.07, 0.24)]
        mb.prism(poly, z, seat_z, P_CONCRETE)
    for i in range(4):
        v = -0.22 + i * 0.135
        poly = [wp(-length / 2, v), wp(length / 2, v),
                wp(length / 2, v + 0.105), wp(-length / 2, v + 0.105)]
        mb.prism(poly, seat_z, seat_z + 0.045, P_WOOD)
    if back:
        for i in range(3):
            zz = seat_z + 0.22 + i * 0.145
            poly = [wp(-length / 2, 0.20), wp(length / 2, 0.20),
                    wp(length / 2, 0.245), wp(-length / 2, 0.245)]
            mb.prism(poly, zz, zz + 0.10, P_WOOD)
        for s in (-1, 1):
            u = s * (length / 2 - 0.16)
            poly = [wp(u - 0.05, 0.19), wp(u + 0.05, 0.19),
                    wp(u + 0.05, 0.255), wp(u - 0.05, 0.255)]
            mb.prism(poly, seat_z, seat_z + 0.62, P_METAL)


def picnic_table(mb, x, y, z, *, ang=0.0, length=2.0):
    ca, sa = math.cos(ang), math.sin(ang)

    def wp(u, v):
        return (x + u * ca - v * sa, y + u * sa + v * ca)

    top = z + 0.74
    mb.prism([wp(-length / 2, -0.38), wp(length / 2, -0.38),
              wp(length / 2, 0.38), wp(-length / 2, 0.38)], top, top + 0.05, P_WOOD)
    for s in (-1, 1):
        mb.prism([wp(-length / 2, s * 0.78 - 0.16), wp(length / 2, s * 0.78 - 0.16),
                  wp(length / 2, s * 0.78 + 0.16), wp(-length / 2, s * 0.78 + 0.16)],
                 z + 0.45, z + 0.50, P_WOOD)
    for s in (-1, 1):
        u = s * (length / 2 - 0.25)
        for t in (-1, 1):
            mb.prism([wp(u - 0.05, t * 0.78 - 0.05), wp(u + 0.05, t * 0.78 - 0.05),
                      wp(u + 0.05, t * 0.78 + 0.05), wp(u - 0.05, t * 0.78 + 0.05)],
                     z, z + 0.50, P_METAL)
        mb.prism([wp(u - 0.05, -0.05), wp(u + 0.05, -0.05),
                  wp(u + 0.05, 0.05), wp(u - 0.05, 0.05)], z, top, P_METAL)


def bin_litter(mb, x, y, z, *, r=0.28, h=0.86, seg=10):
    pts = [(x + r * math.cos(2 * math.pi * i / seg),
            y + r * math.sin(2 * math.pi * i / seg)) for i in range(seg)]
    mb.prism(pts, z + 0.20, z + h, P_METAL, cap_top=False)
    inner = [(x + (r - 0.03) * math.cos(2 * math.pi * i / seg),
              y + (r - 0.03) * math.sin(2 * math.pi * i / seg)) for i in range(seg)]
    mb.prism(inner, z + 0.30, z + h - 0.02, P_DARK, cap_top=False)
    mb.prism([(x - 0.05, y - 0.05), (x + 0.05, y - 0.05),
              (x + 0.05, y + 0.05), (x - 0.05, y + 0.05)], z, z + 0.22, P_METAL)
    mb.prism([(x - 0.22, y - 0.22), (x + 0.22, y - 0.22),
              (x + 0.22, y + 0.22), (x - 0.22, y + 0.22)], z, z + 0.04, P_METAL)


def drinking_fountain(mb, x, y, z):
    mb.box(x - 0.22, y - 0.18, z, x + 0.22, y + 0.18, z + 0.92, P_CONCRETE)
    mb.box(x - 0.18, y - 0.14, z + 0.92, x + 0.18, y + 0.14, z + 0.98, P_METAL)
    mb.box(x - 0.03, y - 0.03, z + 0.98, x + 0.03, y + 0.03, z + 1.18, P_METAL)


# --------------------------------------------------------------------------
# lighting
# --------------------------------------------------------------------------

def lamp_post(mb, x, y, z, *, h=5.2, arm=1.1, ang=0.0, seg=8, r=0.085):
    pts = [(x + r * math.cos(2 * math.pi * i / seg),
            y + r * math.sin(2 * math.pi * i / seg)) for i in range(seg)]
    mb.prism(pts, z, z + h, P_METAL)
    mb.prism([(x - 0.17, y - 0.17), (x + 0.17, y - 0.17),
              (x + 0.17, y + 0.17), (x - 0.17, y + 0.17)], z, z + 0.32, P_CONCRETE)
    ca, sa = math.cos(ang), math.sin(ang)
    hx, hy = x + ca * arm, y + sa * arm
    mb.box(min(x, hx) - 0.05, min(y, hy) - 0.05, z + h - 0.10,
           max(x, hx) + 0.05, max(y, hy) + 0.05, z + h, P_METAL)
    mb.box(hx - 0.26, hy - 0.16, z + h - 0.22, hx + 0.26, hy + 0.16, z + h - 0.08,
           P_METAL)
    mb.box(hx - 0.22, hy - 0.13, z + h - 0.235, hx + 0.22, hy + 0.13, z + h - 0.215,
           P_LIGHT)


def bollard_light(mb, x, y, z, *, h=0.95, r=0.09, seg=8):
    pts = [(x + r * math.cos(2 * math.pi * i / seg),
            y + r * math.sin(2 * math.pi * i / seg)) for i in range(seg)]
    mb.prism(pts, z, z + h - 0.12, P_METAL)
    mb.prism(pts, z + h - 0.12, z + h - 0.03, P_LIGHT)
    mb.prism(pts, z + h - 0.03, z + h, P_METAL)


def flood_mast(mb, x, y, z, *, h=12.0, heads=4, r=0.14, seg=8):
    """Stadium floodlight mast."""
    pts = [(x + r * math.cos(2 * math.pi * i / seg),
            y + r * math.sin(2 * math.pi * i / seg)) for i in range(seg)]
    mb.prism(pts, z, z + h, P_METAL)
    mb.prism([(x - 0.35, y - 0.35), (x + 0.35, y - 0.35),
              (x + 0.35, y + 0.35), (x - 0.35, y + 0.35)], z, z + 0.45, P_CONCRETE)
    mb.box(x - 1.5, y - 0.12, z + h - 0.2, x + 1.5, y + 0.12, z + h, P_METAL)
    for i in range(heads):
        hx = x - 1.3 + i * 2.6 / max(1, heads - 1)
        mb.box(hx - 0.28, y - 0.22, z + h - 0.62, hx + 0.28, y + 0.22, z + h - 0.24,
               P_METAL)
        mb.box(hx - 0.25, y - 0.19, z + h - 0.64, hx + 0.25, y + 0.19, z + h - 0.60,
               P_LIGHT)


def wall_lamp(mb, x, y, z, *, ang=0.0, proj=0.28):
    ca, sa = math.cos(ang), math.sin(ang)
    hx, hy = x + ca * proj, y + sa * proj
    mb.box(min(x, hx) - 0.04, min(y, hy) - 0.04, z - 0.04,
           max(x, hx) + 0.04, max(y, hy) + 0.04, z + 0.04, P_METAL)
    mb.box(hx - 0.14, hy - 0.14, z - 0.14, hx + 0.14, hy + 0.14, z + 0.02, P_METAL)
    mb.box(hx - 0.11, hy - 0.11, z - 0.155, hx + 0.11, hy + 0.11, z - 0.13, P_LIGHT)


# --------------------------------------------------------------------------
# boundary: the documented concrete acoustic wall, fences and gates
# --------------------------------------------------------------------------

def acoustic_wall(mb, path, ground_z, *, height=3.2, thick=0.35, panel=4.0,
                  mat=P_CONCRETE, cap=True, pilaster=0.12):
    """The concrete wall that shuts the road noise out of the campus.

    Built as discrete cast panels between slightly proud pilasters, which is how
    such a wall is actually made and gives it a real shadow rhythm.
    """
    for i in range(len(path) - 1):
        (x0, y0), (x1, y1) = path[i], path[i + 1]
        L = math.hypot(x1 - x0, y1 - y0)
        if L < 0.1:
            continue
        ux, uy = (x1 - x0) / L, (y1 - y0) / L
        nx, ny = -uy, ux
        n = max(1, round(L / panel))
        for k in range(n):
            a, b = k / n, (k + 1) / n
            ax, ay = x0 + (x1 - x0) * a, y0 + (y1 - y0) * a
            bx, by = x0 + (x1 - x0) * b, y0 + (y1 - y0) * b
            gz = min(ground_z(ax, ay), ground_z(bx, by))
            t = thick / 2
            poly = [(ax + nx * t, ay + ny * t), (bx + nx * t, by + ny * t),
                    (bx - nx * t, by - ny * t), (ax - nx * t, ay - ny * t)]
            mb.prism(poly, gz - 0.7, gz + height, mat)
            # pilaster at the panel joint
            t2 = t + pilaster
            pw = 0.22
            for px, py in ((ax, ay),):
                pp = [(px + nx * t2 + ux * pw, py + ny * t2 + uy * pw),
                      (px + nx * t2 - ux * pw, py + ny * t2 - uy * pw),
                      (px - nx * t2 - ux * pw, py - ny * t2 - uy * pw),
                      (px - nx * t2 + ux * pw, py - ny * t2 + uy * pw)]
                mb.prism(pp, gz - 0.7, gz + height + 0.10, mat)
        if cap:
            gz0 = ground_z(x0, y0)
            gz1 = ground_z(x1, y1)
            t = thick / 2 + 0.05
            poly = [(x0 + nx * t, y0 + ny * t), (x1 + nx * t, y1 + ny * t),
                    (x1 - nx * t, y1 - ny * t), (x0 - nx * t, y0 - ny * t)]
            mb.prism(poly, max(gz0, gz1) + height, max(gz0, gz1) + height + 0.09, mat)


def palisade_fence(mb, path, ground_z, *, height=2.2, post_every=2.5,
                   bar_gap=0.115, mat=P_PAINT):
    """Welded steel palisade — standard Israeli school perimeter fencing."""
    for i in range(len(path) - 1):
        (x0, y0), (x1, y1) = path[i], path[i + 1]
        L = math.hypot(x1 - x0, y1 - y0)
        if L < 0.1:
            continue
        ux, uy = (x1 - x0) / L, (y1 - y0) / L
        nx, ny = -uy, ux
        n_posts = max(2, int(L / post_every) + 1)
        for p in range(n_posts):
            d = L * p / (n_posts - 1)
            px, py = x0 + ux * d, y0 + uy * d
            gz = ground_z(px, py)
            s = 0.07
            mb.prism([(px + ux * s + nx * s, py + uy * s + ny * s),
                      (px - ux * s + nx * s, py - uy * s + ny * s),
                      (px - ux * s - nx * s, py - uy * s - ny * s),
                      (px + ux * s - nx * s, py + uy * s - ny * s)],
                     gz - 0.4, gz + height + 0.1, mat)
        gz = ground_z((x0 + x1) / 2, (y0 + y1) / 2)
        for zz in (gz + 0.28, gz + height - 0.22):
            t = 0.035
            mb.prism([(x0 + nx * t, y0 + ny * t), (x1 + nx * t, y1 + ny * t),
                      (x1 - nx * t, y1 - ny * t), (x0 - nx * t, y0 - ny * t)],
                     zz, zz + 0.06, mat)
        n_bars = int(L / bar_gap)
        for b in range(1, n_bars):
            d = L * b / n_bars
            px, py = x0 + ux * d, y0 + uy * d
            t = 0.014
            g = ground_z(px, py)
            mb.prism([(px + ux * t + nx * t, py + uy * t + ny * t),
                      (px - ux * t + nx * t, py - uy * t + ny * t),
                      (px - ux * t - nx * t, py - uy * t - ny * t),
                      (px + ux * t - nx * t, py + uy * t - ny * t)],
                     g + 0.18, g + height, mat)


def sliding_gate(mb, x, y, z, *, width=7.0, height=2.3, ang=0.0, open_frac=0.25,
                 mat=P_PAINT):
    ca, sa = math.cos(ang), math.sin(ang)

    def wp(u, v):
        return (x + u * ca - v * sa, y + u * sa + v * ca)

    off = width * open_frac
    a, b = -width / 2 + off, width / 2 + off
    for zz in (z + 0.1, z + height - 0.12):
        mb.prism([wp(a, -0.04), wp(b, -0.04), wp(b, 0.04), wp(a, 0.04)],
                 zz, zz + 0.12, mat)
    n = int(width / 0.13)
    for i in range(n + 1):
        u = a + (b - a) * i / n
        mb.prism([wp(u - 0.015, -0.02), wp(u + 0.015, -0.02),
                  wp(u + 0.015, 0.02), wp(u - 0.015, 0.02)],
                 z + 0.1, z + height, mat)
    for u in (a, b):
        mb.prism([wp(u - 0.05, -0.05), wp(u + 0.05, -0.05),
                  wp(u + 0.05, 0.05), wp(u - 0.05, 0.05)], z, z + height + 0.05, mat)


def turnstile(mb, x, y, z, *, ang=0.0):
    """Controlled pedestrian entry — students must identify at the gate."""
    ca, sa = math.cos(ang), math.sin(ang)
    for s in (-1, 1):
        px, py = x - sa * s * 0.62, y + ca * s * 0.62
        mb.prism([(px - 0.14, py - 0.20), (px + 0.14, py - 0.20),
                  (px + 0.14, py + 0.20), (px - 0.14, py + 0.20)],
                 z, z + 1.02, P_METAL)
    for k in range(3):
        a = ang + k * 2 * math.pi / 3
        mb.box(x - 0.02, y - 0.02, z + 0.95,
               x + math.cos(a) * 0.55, y + math.sin(a) * 0.55, z + 1.0, P_METAL)


def bollard(mb, x, y, z, *, h=0.85, r=0.075, seg=8, mat=P_METAL):
    pts = [(x + r * math.cos(2 * math.pi * i / seg),
            y + r * math.sin(2 * math.pi * i / seg)) for i in range(seg)]
    mb.prism(pts, z, z + h, mat)
    top = [(x + r * 0.9 * math.cos(2 * math.pi * i / seg),
            y + r * 0.9 * math.sin(2 * math.pi * i / seg)) for i in range(seg)]
    mb.prism(top, z + h, z + h + 0.05, mat)


def bike_rack(mb, x, y, z, *, ang=0.0, hoops=5, pitch=0.75):
    ca, sa = math.cos(ang), math.sin(ang)
    for i in range(hoops):
        u = (i - (hoops - 1) / 2) * pitch
        px, py = x + u * ca, y + u * sa
        for s in (-1, 1):
            qx, qy = px - sa * s * 0.32, py + ca * s * 0.32
            mb.prism([(qx - 0.025, qy - 0.025), (qx + 0.025, qy - 0.025),
                      (qx + 0.025, qy + 0.025), (qx - 0.025, qy + 0.025)],
                     z, z + 0.72, P_METAL)
        mb.box(px - 0.025 - abs(sa) * 0.33, py - 0.025 - abs(ca) * 0.33,
               z + 0.72, px + 0.025 + abs(sa) * 0.33, py + 0.025 + abs(ca) * 0.33,
               z + 0.77, P_METAL)


# --------------------------------------------------------------------------
# signage
# --------------------------------------------------------------------------

def sign_panel(mb, x, y, z, *, w=3.2, h=1.1, ang=0.0, posts=2, post_h=0.9,
               thick=0.09, mat=P_SIGN, frame=P_METAL):
    """Free-standing sign board. Faces are separate so text can be applied later."""
    ca, sa = math.cos(ang), math.sin(ang)

    def wp(u, v):
        return (x + u * ca - v * sa, y + u * sa + v * ca)

    z0 = z + post_h
    poly = [wp(-w / 2, -thick / 2), wp(w / 2, -thick / 2),
            wp(w / 2, thick / 2), wp(-w / 2, thick / 2)]
    mb.prism(poly, z0, z0 + h, mat)
    for i in range(posts):
        u = (-w / 2 + 0.35) + i * (w - 0.7) / max(1, posts - 1)
        mb.prism([wp(u - 0.05, -0.05), wp(u + 0.05, -0.05),
                  wp(u + 0.05, 0.05), wp(u - 0.05, 0.05)], z, z0 + 0.1, frame)


def wall_sign(mb, x, y, z, *, w=4.5, h=0.9, ang=0.0, proj=0.06, mat=P_SIGN):
    """Flush sign on a wall face (e.g. the school name at the main gate)."""
    ca, sa = math.cos(ang), math.sin(ang)
    nx, ny = -sa, ca
    poly = [(x - ca * w / 2, y - sa * w / 2),
            (x + ca * w / 2, y + sa * w / 2),
            (x + ca * w / 2 + nx * proj, y + sa * w / 2 + ny * proj),
            (x - ca * w / 2 + nx * proj, y - sa * w / 2 + ny * proj)]
    mb.prism(poly, z, z + h, mat)


def flagpole(mb, x, y, z, *, h=9.0, r=0.06, seg=8):
    pts = [(x + r * math.cos(2 * math.pi * i / seg),
            y + r * math.sin(2 * math.pi * i / seg)) for i in range(seg)]
    mb.prism(pts, z, z + h, P_METAL)
    mb.prism([(x - 0.30, y - 0.30), (x + 0.30, y - 0.30),
              (x + 0.30, y + 0.30), (x - 0.30, y + 0.30)], z - 0.05, z + 0.28,
             P_CONCRETE)


def memorial_wall(mb, x, y, z, *, length=9.0, height=2.6, ang=0.0, plaques=14):
    """The memorial outside the library: plaques naming the school's 306 fallen,
    with a digital information screen alongside. (Documented.)"""
    ca, sa = math.cos(ang), math.sin(ang)

    def wp(u, v):
        return (x + u * ca - v * sa, y + u * sa + v * ca)

    mb.prism([wp(-length / 2, -0.20), wp(length / 2, -0.20),
              wp(length / 2, 0.20), wp(-length / 2, 0.20)], z, z + height,
             P_CONCRETE)
    mb.prism([wp(-length / 2 - 0.25, -0.45), wp(length / 2 + 0.25, -0.45),
              wp(length / 2 + 0.25, 0.45), wp(-length / 2 - 0.25, 0.45)],
             z - 0.15, z + 0.18, P_CONCRETE)
    cols = plaques // 2
    for r in range(2):
        for c in range(cols):
            u = -length / 2 + 0.6 + c * (length - 1.2) / max(1, cols - 1)
            zz = z + 0.75 + r * 0.85
            mb.prism([wp(u - 0.26, -0.235), wp(u + 0.26, -0.235),
                      wp(u + 0.26, -0.20), wp(u - 0.26, -0.20)],
                     zz, zz + 0.62, P_SIGN)
    # digital screen
    mb.prism([wp(length / 2 - 0.05, -0.30), wp(length / 2 + 1.35, -0.30),
              wp(length / 2 + 1.35, -0.24), wp(length / 2 - 0.05, -0.24)],
             z + 0.95, z + 1.75, P_DARK)


# --------------------------------------------------------------------------
# ground detail
# --------------------------------------------------------------------------

def kerb(mb, path, ground_z, *, width=0.16, up=0.13, mat=P_CONCRETE, seg_len=3.0):
    for i in range(len(path) - 1):
        (x0, y0), (x1, y1) = path[i], path[i + 1]
        L = math.hypot(x1 - x0, y1 - y0)
        if L < 0.1:
            continue
        n = max(1, int(L / seg_len))
        ux, uy = (x1 - x0) / L, (y1 - y0) / L
        nx, ny = -uy * width / 2, ux * width / 2
        for k in range(n):
            a, b = k / n, (k + 1) / n
            ax, ay = x0 + (x1 - x0) * a, y0 + (y1 - y0) * a
            bx, by = x0 + (x1 - x0) * b, y0 + (y1 - y0) * b
            gz = max(ground_z(ax, ay), ground_z(bx, by))
            mb.prism([(ax + nx, ay + ny), (bx + nx, by + ny),
                      (bx - nx, by - ny), (ax - nx, ay - ny)],
                     gz - 0.35, gz + up, mat)


def manhole(mb, x, y, z, *, r=0.33, seg=10, mat=P_METAL):
    pts = [(x + r * math.cos(2 * math.pi * i / seg),
            y + r * math.sin(2 * math.pi * i / seg)) for i in range(seg)]
    mb.prism(pts, z - 0.04, z + 0.012, mat)


def gully(mb, x, y, z, *, w=0.45, d=0.30, mat=P_METAL):
    mb.box(x - w / 2, y - d / 2, z - 0.05, x + w / 2, y + d / 2, z + 0.01, mat)


def electrical_box(mb, x, y, z, *, w=0.75, d=0.35, h=1.35, ang=0.0, mat=P_METAL):
    ca, sa = math.cos(ang), math.sin(ang)
    poly = [(x + (-w / 2) * ca - (-d / 2) * sa, y + (-w / 2) * sa + (-d / 2) * ca),
            (x + (w / 2) * ca - (-d / 2) * sa, y + (w / 2) * sa + (-d / 2) * ca),
            (x + (w / 2) * ca - (d / 2) * sa, y + (w / 2) * sa + (d / 2) * ca),
            (x + (-w / 2) * ca - (d / 2) * sa, y + (-w / 2) * sa + (d / 2) * ca)]
    mb.prism(poly, z, z + h, mat)
    mb.prism(poly, z + h, z + h + 0.05, mat)


# --------------------------------------------------------------------------
# sports equipment
# --------------------------------------------------------------------------

def basketball_hoop(mb, x, y, z, *, ang=0.0, rim_h=3.05):
    ca, sa = math.cos(ang), math.sin(ang)
    mb.prism([(x - 0.09, y - 0.09), (x + 0.09, y - 0.09),
              (x + 0.09, y + 0.09), (x - 0.09, y + 0.09)], z, z + rim_h + 0.55,
             P_METAL)
    bx, by = x + ca * 1.15, y + sa * 1.15
    mb.box(bx - 0.06 - abs(sa) * 0.9, by - 0.06 - abs(ca) * 0.9, z + rim_h + 0.15,
           bx + 0.06 + abs(sa) * 0.9, by + 0.06 + abs(ca) * 0.9, z + rim_h + 1.20,
           P_GLASS)
    mb.box(min(x, bx) - 0.05, min(y, by) - 0.05, z + rim_h + 0.6,
           max(x, bx) + 0.05, max(y, by) + 0.05, z + rim_h + 0.7, P_METAL)
    rx, ry = x + ca * 1.30, y + sa * 1.30
    r = 0.225
    seg = 10
    ring = [(rx + r * math.cos(2 * math.pi * i / seg),
             ry + r * math.sin(2 * math.pi * i / seg)) for i in range(seg)]
    mb.prism(ring, z + rim_h, z + rim_h + 0.02, P_PAINT, cap_top=False,
             cap_bottom=False)
    for i in range(seg):
        a = ring[i]
        b = ring[(i + 1) % seg]
        mb.quad((a[0], a[1], z + rim_h), (b[0], b[1], z + rim_h),
                ((b[0] + rx) / 2, (b[1] + ry) / 2, z + rim_h - 0.42),
                ((a[0] + rx) / 2, (a[1] + ry) / 2, z + rim_h - 0.42), P_PAINT)


def goal(mb, x, y, z, *, width=7.32, height=2.44, ang=0.0, depth=2.0):
    ca, sa = math.cos(ang), math.sin(ang)

    def wp(u, v):
        return (x + u * ca - v * sa, y + u * sa + v * ca)

    r = 0.06
    for s in (-1, 1):
        u = s * width / 2
        mb.prism([wp(u - r, -r), wp(u + r, -r), wp(u + r, r), wp(u - r, r)],
                 z, z + height, P_PAINT)
        mb.prism([wp(u - r, -depth - r), wp(u + r, -depth - r),
                  wp(u + r, -depth + r), wp(u - r, -depth + r)],
                 z, z + height * 0.35, P_PAINT)
    mb.prism([wp(-width / 2 - r, -r), wp(width / 2 + r, -r),
              wp(width / 2 + r, r), wp(-width / 2 - r, r)],
             z + height, z + height + 2 * r, P_PAINT)
    # net: back panel plus the two side triangles, as a coarse sagging mesh
    for s in (-1, 1):
        u = s * width / 2
        mb.face((wp(u, 0) + (z,), wp(u, 0) + (z + height,),
                 wp(u, -depth) + (z + height * 0.35,), wp(u, -depth) + (z,)),
                P_DARK)
    mb.quad(wp(-width / 2, -depth) + (z,), wp(width / 2, -depth) + (z,),
            wp(width / 2, -depth) + (z + height * 0.35,),
            wp(-width / 2, -depth) + (z + height * 0.35,), P_DARK)
    mb.quad(wp(-width / 2, 0) + (z + height,), wp(width / 2, 0) + (z + height,),
            wp(width / 2, -depth) + (z + height * 0.35,),
            wp(-width / 2, -depth) + (z + height * 0.35,), P_DARK)


def tiered_seating(mb, x, y, z, *, width=24.0, rows=5, ang=0.0, rise=0.42,
                   tread=0.78, mat=P_CONCRETE):
    """Concrete spectator steps beside the pitch / parade ground."""
    ca, sa = math.cos(ang), math.sin(ang)

    def wp(u, v):
        return (x + u * ca - v * sa, y + u * sa + v * ca)

    for r in range(rows):
        v0 = r * tread
        poly = [wp(-width / 2, v0), wp(width / 2, v0),
                wp(width / 2, v0 + tread), wp(-width / 2, v0 + tread)]
        mb.prism(poly, z - 0.4, z + (r + 1) * rise, mat)


# --------------------------------------------------------------------------
# vehicles (low detail — background dressing only)
# --------------------------------------------------------------------------

def car(mb, x, y, z, *, ang=0.0, L=4.35, W=1.78, seed=0):
    rng = random.Random(seed)
    ca, sa = math.cos(ang), math.sin(ang)

    def wp(u, v):
        return (x + u * ca - v * sa, y + u * sa + v * ca)

    body_z0 = z + 0.30
    body_z1 = z + 0.80
    hull = [wp(-L / 2 + 0.18, -W / 2), wp(L / 2 - 0.18, -W / 2),
            wp(L / 2, -W / 2 + 0.3), wp(L / 2, W / 2 - 0.3),
            wp(L / 2 - 0.18, W / 2), wp(-L / 2 + 0.18, W / 2),
            wp(-L / 2, W / 2 - 0.3), wp(-L / 2, -W / 2 + 0.3)]
    mb.prism(hull, body_z0, body_z1, P_PAINT)
    cab = [wp(-L * 0.22, -W / 2 + 0.12), wp(L * 0.18, -W / 2 + 0.12),
           wp(L * 0.30, -W / 2 + 0.26), wp(L * 0.30, W / 2 - 0.26),
           wp(L * 0.18, W / 2 - 0.12), wp(-L * 0.22, W / 2 - 0.12),
           wp(-L * 0.34, W / 2 - 0.26), wp(-L * 0.34, -W / 2 + 0.26)]
    mb.prism(cab, body_z1, z + 1.42, P_GLASS)
    mb.prism([wp(-L * 0.16, -W / 2 + 0.16), wp(L * 0.12, -W / 2 + 0.16),
              wp(L * 0.12, W / 2 - 0.16), wp(-L * 0.16, W / 2 - 0.16)],
             z + 1.40, z + 1.46, P_PAINT)
    for sx in (-1, 1):
        for sy in (-1, 1):
            wx, wy = wp(sx * L * 0.31, sy * (W / 2 - 0.02))
            mb.prism([(wx - 0.30, wy - 0.10), (wx + 0.30, wy - 0.10),
                      (wx + 0.30, wy + 0.10), (wx - 0.30, wy + 0.10)],
                     z + 0.04, z + 0.62, P_DARK)
