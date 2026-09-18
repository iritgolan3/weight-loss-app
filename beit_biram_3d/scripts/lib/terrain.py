"""Mount Carmel terrain: a terraced hillside, not a flat plane.

The campus sits on a slope that falls toward the north, cut into four benches
(see siteplan.TERRACES). Between the benches are retaining walls with steps,
which is how a real Haifa hillside campus is built.
"""
import math
import random

import siteplan as SP
from core import MeshBuilder


def _smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def _rect_weight(x, y, x0, y0, x1, y1, margin):
    """1 inside the rect, falling smoothly to 0 `margin` metres outside it."""
    dx = min(x - x0, x1 - x) / margin
    dy = min(y - y0, y1 - y) / margin
    return _smoothstep(dx + 0.5) * _smoothstep(dy + 0.5)


def _hash_noise(x, y, freq, seed):
    """Cheap smooth value noise so the ground is never dead flat."""
    xf, yf = x * freq, y * freq
    xi, yi = math.floor(xf), math.floor(yf)
    tx, ty = _smoothstep(xf - xi), _smoothstep(yf - yi)

    def h(i, j):
        n = (i * 374761393 + j * 668265263 + seed * 1442695040888963407) & 0xFFFFFFFF
        n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
        return ((n ^ (n >> 16)) & 0xFFFF) / 32767.5 - 1.0

    a = h(xi, yi) + (h(xi + 1, yi) - h(xi, yi)) * tx
    b = h(xi, yi + 1) + (h(xi + 1, yi + 1) - h(xi, yi + 1)) * tx
    return a + (b - a) * ty


def base_height(x, y):
    """Regional Carmel slope before the campus benches are cut into it."""
    z = -SP.REGIONAL_FALL_N * y - SP.REGIONAL_FALL_W * x + 4.0
    z += 1.9 * _hash_noise(x, y, 1 / 78.0, 11)
    z += 0.55 * _hash_noise(x, y, 1 / 27.0, 23)
    z += 0.16 * _hash_noise(x, y, 1 / 9.0, 37)
    return z


def ground_z(x, y):
    """Final ground height, with the campus terraces blended in."""
    z = base_height(x, y)
    for name, x0, y0, x1, y1, level, margin in SP.TERRACES:
        w = _rect_weight(x, y, x0, y0, x1, y1, margin)
        if w > 1e-4:
            # each bench drains very slightly to the west, like a real one
            lz = level + 0.012 * (x * 0.5)
            lz += 0.05 * _hash_noise(x, y, 1 / 18.0, 71)
            z = z + (lz - z) * w
    return z


def terrace_of(y):
    for name, x0, y0, x1, y1, level, margin in SP.TERRACES:
        if y0 <= y <= y1:
            return name, level
    return None, base_height(0, y)


# --------------------------------------------------------------------------

def build_terrain(mb, x0, y0, x1, y1, step=2.5, mat=0, mat_map=None):
    """Heightfield mesh over the given extent.

    `mat_map(x, y)` may return a material index per cell so paved areas, lawns,
    sports surfaces and bare soil all live in one welded ground mesh.
    """
    nx = int(round((x1 - x0) / step))
    ny = int(round((y1 - y0) / step))
    zs = [[ground_z(x0 + i * step, y0 + j * step) for j in range(ny + 1)]
          for i in range(nx + 1)]
    for i in range(nx):
        for j in range(ny):
            ax, bx = x0 + i * step, x0 + (i + 1) * step
            ay, by = y0 + j * step, y0 + (j + 1) * step
            m = mat_map((ax + bx) / 2, (ay + by) / 2) if mat_map else mat
            mb.quad((ax, ay, zs[i][j]), (bx, ay, zs[i + 1][j]),
                    (bx, by, zs[i + 1][j + 1]), (ax, by, zs[i][j + 1]), m)
    return nx * ny


def retaining_wall(mb, path, *, top_z, base_drop=1.0, thick=0.6, mat=0,
                   coping=True, coping_mat=None):
    """Retaining wall along a world polyline, holding a bench up.

    The wall face follows the low-side ground; the top is level with the bench.
    """
    coping_mat = mat if coping_mat is None else coping_mat
    for i in range(len(path) - 1):
        (x0, y0), (x1, y1) = path[i], path[i + 1]
        seg = math.hypot(x1 - x0, y1 - y0)
        if seg < 0.2:
            continue
        n = max(1, int(seg / 4.0))
        for k in range(n):
            t0, t1 = k / n, (k + 1) / n
            ax, ay = x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0
            bx, by = x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1
            ux, uy = (bx - ax), (by - ay)
            L = math.hypot(ux, uy) or 1.0
            nx, ny = -uy / L * thick / 2, ux / L * thick / 2
            poly = [(ax + nx, ay + ny), (bx + nx, by + ny),
                    (bx - nx, by - ny), (ax - nx, ay - ny)]
            lo = min(ground_z(ax - nx * 4, ay - ny * 4),
                     ground_z(bx - nx * 4, by - ny * 4)) - base_drop
            mb.prism(poly, lo, top_z, mat)
            if coping:
                cp = [(ax + nx * 1.25, ay + ny * 1.25), (bx + nx * 1.25, by + ny * 1.25),
                      (bx - nx * 1.25, by - ny * 1.25), (ax - nx * 1.25, ay - ny * 1.25)]
                mb.prism(cp, top_z, top_z + 0.12, coping_mat)


def pad(mb, rect, z, *, mat=0, skirt=0.9, inset=0.0):
    """A flat pad (building plinth / court / car park) sunk into the terrain."""
    x0, y0, x1, y1 = rect
    x0 += inset; y0 += inset; x1 -= inset; y1 -= inset
    poly = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    mb.face([(x, y, z) for x, y in poly], mat)
    n = len(poly)
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        za = min(ground_z(a[0], a[1]), z) - skirt
        zb = min(ground_z(b[0], b[1]), z) - skirt
        mb.quad((a[0], a[1], z), (a[0], a[1], za), (b[0], b[1], zb), (b[0], b[1], z),
                mat)
    return poly
