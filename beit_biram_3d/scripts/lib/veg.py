"""Vegetation for a Carmel hillside campus.

Species chosen for Haifa / Mount Carmel and for Israeli institutional planting:
Jerusalem pine (Pinus halepensis, the signature Carmel tree), Italian cypress,
olive, carob, ficus (the classic Israeli schoolyard shade tree), Washingtonia
palm, and flowering Delonix/jacaranda.

Each species is generated once as a template mesh; everything placed on site is a
linked duplicate, so 300 trees cost 8 meshes.
"""
import math
import random

from core import MeshBuilder

M_BARK = 0
M_LEAF = 1


def _blob(mb, cx, cy, cz, rx, ry, rz, *, rings=5, seg=8, noise=0.20, rng=None,
          mat=M_LEAF, squash_bottom=1.0):
    """A deformed spheroid — one clump of canopy."""
    rng = rng or random.Random(0)
    grid = []
    for i in range(rings + 1):
        v = math.pi * i / rings
        row = []
        for j in range(seg):
            u = 2 * math.pi * j / seg
            n = 1.0 + rng.uniform(-noise, noise)
            sx = math.sin(v) * math.cos(u) * rx * n
            sy = math.sin(v) * math.sin(u) * ry * n
            sz = math.cos(v) * rz * n
            if sz < 0:
                sz *= squash_bottom
            row.append((cx + sx, cy + sy, cz + sz))
        grid.append(row)
    for i in range(rings):
        for j in range(seg):
            a = grid[i][j]
            b = grid[i][(j + 1) % seg]
            c = grid[i + 1][(j + 1) % seg]
            d = grid[i + 1][j]
            mb.face((a, b, c, d), mat)


def _cluster(mb, cx, cy, cz, r, rng, *, mat=M_LEAF, n=3, flat=1.0,
             spread=0.85, noise=0.24, leaves=True, leaf_size=0.125,
             leaf_density=1.0):
    """A lumpy clump built from several small spheroids.

    A single large smooth blob reads as plastic; a handful of overlapping
    smaller ones catches the light in separate masses the way real foliage does.
    """
    for _ in range(n):
        ox = rng.uniform(-r * spread, r * spread)
        oy = rng.uniform(-r * spread, r * spread)
        oz = rng.uniform(-r * spread * flat, r * spread * flat)
        rr = r * rng.uniform(0.48, 0.80)
        ry_ = rr * rng.uniform(0.85, 1.15)
        rz_ = rr * flat * rng.uniform(0.8, 1.1)
        _blob(mb, cx + ox, cy + oy, cz + oz, rr * 0.86, ry_ * 0.86, rz_ * 0.86,
              rings=4, seg=8, noise=noise, rng=rng, mat=mat, squash_bottom=0.85)
        if leaves:
            _leaf_shell(mb, cx + ox, cy + oy, cz + oz, rr, ry_, rz_, rng,
                        n=int(115 * leaf_density), size=leaf_size, mat=mat)


def _leaf_shell(mb, cx, cy, cz, rx, ry, rz, rng, *, n=70, size=0.13,
                mat=M_LEAF, jitter=0.75):
    """Scatter small leaf cards over a spheroid's surface.

    Overlapping smooth blobs alone read as artichoke plates: the silhouette is
    made of a few big curved shells. A shell of small quads, roughly tangent to
    the crown with a random tilt, breaks that outline into leaf-sized pieces,
    which is what actually sells foliage at close range.
    """
    for _ in range(n):
        u = rng.uniform(0.0, math.tau)
        w = math.acos(rng.uniform(-1.0, 1.0))
        sv, cv = math.sin(w), math.cos(w)
        nx, ny, nz = sv * math.cos(u), sv * math.sin(u), cv
        px = cx + nx * rx
        py = cy + ny * ry
        pz = cz + nz * rz
        # a frame on the surface, then tilted randomly so leaves catch the light
        if abs(nz) < 0.9:
            ax, ay, az = -ny, nx, 0.0
        else:
            ax, ay, az = 1.0, 0.0, 0.0
        al = math.sqrt(ax * ax + ay * ay + az * az) or 1.0
        ax, ay, az = ax / al, ay / al, az / al
        bx = ny * az - nz * ay
        by = nz * ax - nx * az
        bz = nx * ay - ny * ax
        t = rng.uniform(-jitter, jitter)
        ax, ay, az = ax + nx * t, ay + ny * t, az + nz * t
        al = math.sqrt(ax * ax + ay * ay + az * az) or 1.0
        ax, ay, az = ax / al, ay / al, az / al
        s = size * rng.uniform(0.6, 1.4)
        h = s * rng.uniform(0.5, 0.9)
        mb.face(((px - ax * s - bx * h, py - ay * s - by * h, pz - az * s - bz * h),
                 (px + ax * s - bx * h, py + ay * s - by * h, pz + az * s - bz * h),
                 (px + ax * s + bx * h, py + ay * s + by * h, pz + az * s + bz * h),
                 (px - ax * s + bx * h, py - ay * s + by * h, pz - az * s + bz * h)),
                mat)


def _taper_limb(mb, p0, p1, r0, r1, seg=7, mat=M_BARK):
    """A tapered branch segment between two 3D points."""
    ax, ay, az = p0
    bx, by, bz = p1
    dx, dy, dz = bx - ax, by - ay, bz - az
    L = math.sqrt(dx * dx + dy * dy + dz * dz)
    if L < 1e-4:
        return
    dx, dy, dz = dx / L, dy / L, dz / L
    # build an orthonormal frame
    if abs(dz) < 0.9:
        ux, uy, uz = -dy, dx, 0.0
    else:
        ux, uy, uz = 1.0, 0.0, 0.0
    ul = math.sqrt(ux * ux + uy * uy + uz * uz)
    ux, uy, uz = ux / ul, uy / ul, uz / ul
    vx = dy * uz - dz * uy
    vy = dz * ux - dx * uz
    vz = dx * uy - dy * ux
    ring0, ring1 = [], []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        c, s = math.cos(a), math.sin(a)
        ring0.append((ax + (ux * c + vx * s) * r0, ay + (uy * c + vy * s) * r0,
                      az + (uz * c + vz * s) * r0))
        ring1.append((bx + (ux * c + vx * s) * r1, by + (uy * c + vy * s) * r1,
                      bz + (uz * c + vz * s) * r1))
    for i in range(seg):
        j = (i + 1) % seg
        mb.face((ring0[i], ring0[j], ring1[j], ring1[i]), mat)
    return ring1


def _branch(mb, p, direction, length, radius, depth, rng, tips, *,
            split=2, drop=0.22, mat=M_BARK):
    """Recursive limb generation; collects canopy attachment points in `tips`."""
    if depth <= 0 or length < 0.35 or radius < 0.018:
        tips.append((p, radius, length))
        return
    dx, dy, dz = direction
    steps = 2
    cur = p
    for s in range(steps):
        t = (s + 1) / steps
        nx = dx + rng.uniform(-0.12, 0.12)
        ny = dy + rng.uniform(-0.12, 0.12)
        nz = dz - drop * t * 0.35
        L = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
        nx, ny, nz = nx / L, ny / L, nz / L
        nxt = (cur[0] + nx * length / steps, cur[1] + ny * length / steps,
               cur[2] + nz * length / steps)
        _taper_limb(mb, cur, nxt, radius * (1 - 0.35 * s / steps),
                    radius * (1 - 0.35 * (s + 1) / steps), mat=mat)
        cur = nxt
    n_sub = split if rng.random() > 0.2 else split + 1
    for k in range(n_sub):
        ang = 2 * math.pi * k / n_sub + rng.uniform(-0.5, 0.5)
        spread = rng.uniform(0.45, 0.85)
        ndir = (dx + math.cos(ang) * spread, dy + math.sin(ang) * spread,
                max(0.12, dz - 0.10))
        L = math.sqrt(sum(c * c for c in ndir)) or 1.0
        ndir = tuple(c / L for c in ndir)
        _branch(mb, cur, ndir, length * rng.uniform(0.58, 0.78),
                radius * rng.uniform(0.52, 0.68), depth - 1, rng, tips,
                split=split, drop=drop, mat=mat)


# --------------------------------------------------------------------------
# species
# --------------------------------------------------------------------------

def pine_aleppo(height=11.0, seed=0):
    """Pinus halepensis — the Carmel pine: bare leaning trunk, umbrella crown."""
    rng = random.Random(seed)
    mb = MeshBuilder()
    trunk_h = height * rng.uniform(0.50, 0.62)
    lean = (rng.uniform(-0.10, 0.10), rng.uniform(-0.10, 0.10))
    r0 = height * 0.030
    cur = (0, 0, 0)
    segs = 5
    for i in range(segs):
        t = (i + 1) / segs
        nxt = (lean[0] * trunk_h * t, lean[1] * trunk_h * t, trunk_h * t)
        _taper_limb(mb, cur, nxt, r0 * (1 - 0.45 * i / segs),
                    r0 * (1 - 0.45 * (i + 1) / segs), seg=8)
        cur = nxt
    tips = []
    for k in range(rng.randint(3, 4)):
        ang = 2 * math.pi * k / 3.5 + rng.uniform(-0.4, 0.4)
        d = (math.cos(ang) * 0.75, math.sin(ang) * 0.75, 0.62)
        L = math.sqrt(sum(c * c for c in d))
        _branch(mb, cur, tuple(c / L for c in d), height * 0.26,
                r0 * 0.55, 2, rng, tips, split=2, drop=0.12)
    # flattened umbrella of needle clumps
    crown_r = height * rng.uniform(0.40, 0.52)
    for (p, r, l) in tips:
        _cluster(mb, p[0], p[1], p[2] + 0.30, crown_r * 0.44, rng,
                 n=rng.randint(4, 7), flat=0.34, spread=1.25, noise=0.30,
                 leaf_size=0.085, leaf_density=1.15)
    _cluster(mb, cur[0], cur[1], cur[2] + height * 0.20, crown_r * 0.72, rng,
             n=4, flat=0.34, spread=1.10, noise=0.34, leaf_size=0.085,
             leaf_density=1.15)
    return mb


def cypress(height=12.0, seed=0):
    """Cupressus sempervirens — the dark exclamation mark of the Israeli landscape."""
    rng = random.Random(seed)
    mb = MeshBuilder()
    r0 = height * 0.020
    _taper_limb(mb, (0, 0, 0), (0, 0, height * 0.9), r0, r0 * 0.25, seg=7)
    n = 12
    for i in range(n):
        t = i / (n - 1)
        z = height * (0.05 + 0.90 * t)
        rad = height * 0.082 * math.sin(math.pi * (0.16 + 0.78 * t)) ** 0.45
        _blob(mb, rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05), z,
              rad, rad * rng.uniform(0.92, 1.08), height * 0.085,
              rings=5, seg=9, noise=0.13, rng=rng)
        _leaf_shell(mb, rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05), z,
                    rad, rad, height * 0.085, rng, n=42, size=0.07)
    return mb


def broadleaf(height=10.0, seed=0, spread=1.0):
    """Ficus / carob — the dense schoolyard shade tree."""
    rng = random.Random(seed)
    mb = MeshBuilder()
    trunk_h = height * rng.uniform(0.28, 0.38)
    r0 = height * 0.042
    _taper_limb(mb, (0, 0, 0), (0, 0, trunk_h * 0.5), r0 * 1.2, r0, seg=9)
    _taper_limb(mb, (0, 0, trunk_h * 0.5), (0, 0, trunk_h), r0, r0 * 0.85, seg=9)
    tips = []
    for k in range(rng.randint(3, 5)):
        ang = 2 * math.pi * k / 4 + rng.uniform(-0.4, 0.4)
        d = (math.cos(ang) * 0.68, math.sin(ang) * 0.68, 0.72)
        L = math.sqrt(sum(c * c for c in d))
        _branch(mb, (0, 0, trunk_h), tuple(c / L for c in d),
                height * 0.30, r0 * 0.62, 3, rng, tips, split=2, drop=0.18)
    cr = height * 0.24 * spread
    for (p, r, l) in tips:
        _cluster(mb, p[0], p[1], p[2], cr * rng.uniform(0.55, 0.88), rng,
                 n=rng.randint(3, 6), flat=0.80, spread=1.15, noise=0.26)
    return mb


def olive(height=6.5, seed=0):
    """Olea europaea — multi-stem, gnarled, grey-green."""
    rng = random.Random(seed)
    mb = MeshBuilder()
    stems = rng.randint(2, 3)
    tips = []
    for s in range(stems):
        ang = 2 * math.pi * s / stems + rng.uniform(-0.3, 0.3)
        ox, oy = math.cos(ang) * 0.22, math.sin(ang) * 0.22
        th = height * rng.uniform(0.26, 0.36)
        r0 = height * 0.052
        _taper_limb(mb, (ox * 0.3, oy * 0.3, 0), (ox, oy, th), r0, r0 * 0.7, seg=8)
        for k in range(2):
            a2 = ang + rng.uniform(-1.1, 1.1)
            d = (math.cos(a2) * 0.6, math.sin(a2) * 0.6, 0.78)
            L = math.sqrt(sum(c * c for c in d))
            _branch(mb, (ox, oy, th), tuple(c / L for c in d), height * 0.26,
                    r0 * 0.55, 2, rng, tips, split=2, drop=0.10)
    cr = height * 0.32
    for (p, r, l) in tips:
        _cluster(mb, p[0], p[1], p[2], cr * 0.62, rng, n=rng.randint(2, 3),
                 flat=0.80, spread=0.9, noise=0.40)
    return mb


def palm_washingtonia(height=12.0, seed=0):
    """Washingtonia — planted along Israeli institutional drives and forecourts."""
    rng = random.Random(seed)
    mb = MeshBuilder()
    r0 = 0.30
    segs = 8
    cur = (0, 0, 0)
    lean = rng.uniform(-0.02, 0.02)
    for i in range(segs):
        t1 = (i + 1) / segs
        nxt = (lean * height * t1, 0, height * t1)
        _taper_limb(mb, cur, nxt, r0 * (1 - 0.30 * i / segs),
                    r0 * (1 - 0.30 * t1), seg=10)
        cur = nxt
    n_fronds = 26
    for i in range(n_fronds):
        ang = 2 * math.pi * i / n_fronds + rng.uniform(-0.18, 0.18)
        droop = rng.uniform(0.10, 0.95)
        fl = rng.uniform(3.2, 4.6)
        dirs = (math.cos(ang), math.sin(ang), 0.55 - droop)
        L = math.sqrt(sum(c * c for c in dirs))
        dirs = tuple(c / L for c in dirs)
        steps = 4
        prev_w = 0.14
        p = cur
        for s in range(steps):
            t = (s + 1) / steps
            w = 0.14 + 0.80 * math.sin(math.pi * t) ** 0.6
            nxt = (cur[0] + dirs[0] * fl * t,
                   cur[1] + dirs[1] * fl * t,
                   cur[2] + dirs[2] * fl * t - 0.55 * t * t * droop)
            px, py = -dirs[1], dirs[0]
            mb.face(((p[0] + px * prev_w, p[1] + py * prev_w, p[2]),
                     (nxt[0] + px * w, nxt[1] + py * w, nxt[2]),
                     (nxt[0] - px * w, nxt[1] - py * w, nxt[2]),
                     (p[0] - px * prev_w, p[1] - py * prev_w, p[2])), M_LEAF)
            p, prev_w = nxt, w
    return mb


def flowering_tree(height=8.0, seed=0):
    """Delonix regia / jacaranda — wide flat flowering crown."""
    rng = random.Random(seed)
    mb = MeshBuilder()
    trunk_h = height * 0.34
    r0 = height * 0.040
    _taper_limb(mb, (0, 0, 0), (0, 0, trunk_h), r0 * 1.15, r0 * 0.85, seg=9)
    tips = []
    for k in range(4):
        ang = 2 * math.pi * k / 4 + rng.uniform(-0.3, 0.3)
        d = (math.cos(ang) * 0.95, math.sin(ang) * 0.95, 0.52)
        L = math.sqrt(sum(c * c for c in d))
        _branch(mb, (0, 0, trunk_h), tuple(c / L for c in d), height * 0.30,
                r0 * 0.58, 3, rng, tips, split=2, drop=0.06)
    cr = height * 0.34
    for (p, r, l) in tips:
        _cluster(mb, p[0], p[1], p[2] + 0.2, cr * 0.66, rng, n=3, flat=0.34,
                 spread=1.0, noise=0.32)
    return mb


# --------------------------------------------------------------------------
# understorey
# --------------------------------------------------------------------------

def bush(radius=0.55, seed=0, squat=0.92):
    rng = random.Random(seed)
    mb = MeshBuilder()
    for k in range(rng.randint(3, 5)):
        ox = rng.uniform(-radius * 0.45, radius * 0.45)
        oy = rng.uniform(-radius * 0.45, radius * 0.45)
        r = radius * rng.uniform(0.50, 0.85)
        _blob(mb, ox, oy, r * squat * 0.95, r, r * rng.uniform(0.85, 1.15),
              r * squat, rings=4, seg=8, noise=0.26, rng=rng,
              squash_bottom=0.45)
    return mb


def hedge_run(mb, path, *, width=0.9, height=1.1, mat=M_LEAF, seed=0, step=0.7):
    """Clipped hedge along a polyline — slightly irregular so it reads as planting."""
    rng = random.Random(seed)
    for i in range(len(path) - 1):
        (x0, y0), (x1, y1) = path[i], path[i + 1]
        L = math.hypot(x1 - x0, y1 - y0)
        n = max(1, int(L / step))
        ux, uy = (x1 - x0) / (L or 1), (y1 - y0) / (L or 1)
        nx, ny = -uy * width / 2, ux * width / 2
        for k in range(n):
            a = k / n
            b = (k + 1) / n
            ax, ay = x0 + (x1 - x0) * a, y0 + (y1 - y0) * a
            bx, by = x0 + (x1 - x0) * b, y0 + (y1 - y0) * b
            h = height * rng.uniform(0.92, 1.08)
            poly = [(ax + nx, ay + ny), (bx + nx, by + ny),
                    (bx - nx, by - ny), (ax - nx, ay - ny)]
            mb.prism(poly, 0, h, mat, cap_bottom=False)


def grass_tuft(seed=0, height=0.13, blades=7):
    """A small crossed-blade clump for path edges and tree bases."""
    rng = random.Random(seed)
    mb = MeshBuilder()
    for i in range(blades):
        a = rng.uniform(0, math.pi)
        w = rng.uniform(0.010, 0.022)
        h = height * rng.uniform(0.7, 1.3)
        dx, dy = math.cos(a) * w, math.sin(a) * w
        lean_x, lean_y = rng.uniform(-0.08, 0.08), rng.uniform(-0.08, 0.08)
        mb.face(((-dx, -dy, 0), (dx, dy, 0),
                 (dx + lean_x, dy + lean_y, h), (-dx + lean_x, -dy + lean_y, h)),
                M_LEAF)
    return mb


def planter(mb, x, y, z, *, w=1.2, d=1.2, h=0.55, mat_pot=0, mat_leaf=M_LEAF,
            seed=0):
    """Precast concrete planter with a shrub in it."""
    rng = random.Random(seed)
    t = 0.09
    mb.box(x - w / 2, y - d / 2, z, x + w / 2, y + d / 2, z + h, mat_pot)
    mb.box(x - w / 2 + t, y - d / 2 + t, z + h - 0.05,
           x + w / 2 - t, y + d / 2 - t, z + h - 0.02, 0)
    r = min(w, d) * 0.42
    for k in range(rng.randint(1, 3)):
        _blob(mb, x + rng.uniform(-r * 0.4, r * 0.4), y + rng.uniform(-r * 0.4, r * 0.4),
              z + h + r * 0.55, r * rng.uniform(0.7, 1.0), r * rng.uniform(0.7, 1.0),
              r * rng.uniform(0.6, 0.95), rings=4, seg=7, noise=0.32, rng=rng,
              mat=mat_leaf)


def flower_bed(mb, rect, z, *, mat_soil=0, mat_flower=M_LEAF, seed=0, density=0.55):
    """Massed bedding plants inside a rectangle."""
    rng = random.Random(seed)
    x0, y0, x1, y1 = rect
    mb.box(x0, y0, z - 0.25, x1, y1, z + 0.06, mat_soil)
    n = int((x1 - x0) * (y1 - y0) * density)
    for _ in range(n):
        px = rng.uniform(x0 + 0.15, x1 - 0.15)
        py = rng.uniform(y0 + 0.15, y1 - 0.15)
        r = rng.uniform(0.11, 0.19)
        _blob(mb, px, py, z + 0.05 + r * 0.7, r, r * rng.uniform(0.85, 1.15),
              r * 0.85, rings=4, seg=8, noise=0.22, rng=rng, mat=mat_flower,
              squash_bottom=0.5)


def climber(mb, path, z_base, height, *, mat=M_LEAF, seed=0, step=1.1):
    """Creeper growing up a wall — vegetation touching the concrete."""
    rng = random.Random(seed)
    for i in range(len(path) - 1):
        (x0, y0), (x1, y1) = path[i], path[i + 1]
        L = math.hypot(x1 - x0, y1 - y0)
        n = max(1, int(L / step))
        for k in range(n):
            t = (k + 0.5) / n
            px = x0 + (x1 - x0) * t
            py = y0 + (y1 - y0) * t
            h = height * rng.uniform(0.35, 1.0)
            r = rng.uniform(0.35, 0.75)
            for j in range(max(1, int(h / 0.8))):
                zz = z_base + j * 0.8 + rng.uniform(0, 0.3)
                _blob(mb, px + rng.uniform(-0.3, 0.3), py + rng.uniform(-0.2, 0.2),
                      zz, r, r * 0.45, r * 0.8, rings=3, seg=6, noise=0.4,
                      rng=rng, mat=mat)
