"""Procedural, tileable textures generated with numpy (saved as JPEG so they
embed cleanly in both the .blend and the .glb)."""
import numpy as np


def _smooth(t):
    return t * t * (3 - 2 * t)


def value_noise(h, w, cy, cx, rng):
    """Tileable bilinear value noise with cy x cx lattice cells."""
    g = rng.random((cy, cx))
    y = np.arange(h) * cy / h
    x = np.arange(w) * cx / w
    y0 = np.floor(y).astype(int); x0 = np.floor(x).astype(int)
    ty = _smooth(y - y0)[:, None]; tx = _smooth(x - x0)[None, :]
    y1 = (y0 + 1) % cy; x1 = (x0 + 1) % cx
    a = g[y0][:, x0]; b = g[y0][:, x1]; c = g[y1][:, x0]; d = g[y1][:, x1]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


def fbm(h, w, cy, cx, rng, octaves=5, gain=0.5):
    out = np.zeros((h, w)); amp = 1.0; tot = 0.0
    for _ in range(octaves):
        out += amp * value_noise(h, w, cy, cx, rng)
        tot += amp; amp *= gain; cy *= 2; cx *= 2
    return out / tot


def mix(c1, c2, t):
    c1 = np.asarray(c1, float); c2 = np.asarray(c2, float)
    return c1 * (1 - t[..., None]) + c2 * t[..., None]


def wood(size, light, dark, seed, rings=18, fiber=0.25, warp=0.6):
    """Straight-grain (masame) wood, grain running along X (U)."""
    rng = np.random.default_rng(seed)
    h = w = size
    wv = fbm(h, w, 4, 1, rng, 4)            # slow warp across the board
    v = np.linspace(0, 1, h, endpoint=False)[:, None]
    phase = (v * rings + wv * warp) % 1.0
    lines = np.clip(1 - np.abs(phase - 0.5) * 2, 0, 1) ** 6   # thin late-wood lines
    fibers = fbm(h, w, 256, 4, rng, 3)        # long thin fibres along U
    blotch = fbm(h, w, 6, 3, rng, 4)
    t = np.clip(0.55 * lines + fiber * (fibers - 0.5) + 0.35 * (blotch - 0.5) + 0.2, 0, 1)
    return mix(light, dark, t)


def plaster(size, base, seed, var=0.10):
    """Earthen (tsuchi-kabe) plaster with fine aggregate."""
    rng = np.random.default_rng(seed)
    n = fbm(size, size, 8, 8, rng, 6)
    speck = (rng.random((size, size)) > 0.985) * rng.random((size, size)) * 0.5
    t = (n - 0.5) * 2 * var - speck * 0.25
    c = np.asarray(base, float)[None, None, :] * (1 + t[..., None])
    return np.clip(c, 0, 1)


def stone(size, base, seed, var=0.18, veins=0.0, grain=0.08):
    rng = np.random.default_rng(seed)
    n = fbm(size, size, 6, 6, rng, 6)
    fine = rng.random((size, size))
    t = (n - 0.5) * 2 * var + (fine - 0.5) * grain
    c = np.asarray(base, float)[None, None, :] * (1 + t[..., None])
    if veins:
        m = fbm(size, size, 3, 3, rng, 5)
        vein = np.clip(1 - np.abs(np.sin(m * 18)) * 6, 0, 1) * veins
        c = c * (1 - vein[..., None]) + 0.85 * vein[..., None]
    return np.clip(c, 0, 1)


def washi(size, base, seed):
    rng = np.random.default_rng(seed)
    n = fbm(size, size, 16, 16, rng, 5)
    fib = fbm(size, size, 128, 12, rng, 2) * fbm(size, size, 12, 128, rng, 2)
    t = (n - 0.5) * 0.08 + (fib - 0.25) * 0.15
    c = np.asarray(base, float)[None, None, :] * (1 + t[..., None])
    return np.clip(c, 0, 1)


def to_blender_image(bpy, name, arr, path, quality=88):
    """arr: HxWx3 float sRGB in [0,1]; saved as JPEG and packed."""
    h, w, _ = arr.shape
    img = bpy.data.images.new(name, w, h, alpha=False)
    rgba = np.ones((h, w, 4), np.float32)
    rgba[..., :3] = arr[::-1]           # Blender images are bottom-up
    img.pixels.foreach_set(rgba.ravel())
    img.filepath_raw = path
    img.file_format = 'JPEG'
    bpy.context.scene.render.image_settings.quality = quality
    img.save()
    img.reload()
    img.pack()
    return img


def bizen_tiles(size, n, seed, joint=0.022):
    """Grid of hand-made Bizen ceramic tiles (n x n per texture): rust/brown
    unglazed bodies, ash 'goma' speckle, red 'hidasuki' fire flashes, dark joints."""
    rng = np.random.default_rng(seed)
    h = w = size
    yy, xx = np.mgrid[0:h, 0:w] / size * n
    ty, tx = np.floor(yy).astype(int), np.floor(xx).astype(int)
    fy, fx = yy - ty, xx - tx
    palette = np.array([(0.42, 0.20, 0.10), (0.33, 0.16, 0.09), (0.50, 0.27, 0.14),
                        (0.24, 0.13, 0.08), (0.46, 0.30, 0.20), (0.36, 0.22, 0.14)])
    pick = rng.integers(0, len(palette), (n, n))
    base = palette[pick[ty % n, tx % n]]
    shade = rng.uniform(0.85, 1.12, (n, n))[ty % n, tx % n]
    body = base * shade[..., None]
    # in-tile kiln variation
    v = fbm(h, w, n * 3, n * 3, rng, 4)
    body *= (0.85 + 0.3 * v)[..., None]
    # goma ash speckles (yellow-grey)
    sp = (rng.random((h, w)) > 0.992) | ((fbm(h, w, n * 2, n * 2, rng, 3) > 0.68) & (rng.random((h, w)) > 0.9))
    body[sp] = body[sp] * 0.4 + np.array([0.62, 0.55, 0.38]) * 0.6
    # hidasuki flashes on some tiles: diagonal red streaks
    flash = rng.random((n, n))[ty % n, tx % n] > 0.8
    off = rng.uniform(0.2, 0.8, (n, n))[ty % n, tx % n]
    ang = rng.uniform(-0.8, 0.8, (n, n))[ty % n, tx % n]
    d = np.abs((fx - off) + (fy - 0.5) * ang + 0.08 * (fbm(h, w, n * 4, n * 4, rng, 2) - 0.5))
    k = np.clip(1 - d / 0.06, 0, 1) * flash
    body = body * (1 - 0.55 * k[..., None]) + np.array([0.60, 0.17, 0.07]) * 0.55 * k[..., None]
    # bevelled tile edges darken, joints are dark mortar
    edge = np.minimum(np.minimum(fx, 1 - fx), np.minimum(fy, 1 - fy))
    body *= np.clip(0.75 + edge * 6, 0.75, 1.0)[..., None]
    j = edge < joint
    body[j] = np.array([0.10, 0.09, 0.08])
    return np.clip(body, 0, 1)


def oya(size, seed):
    """Oya stone: soft green-grey tuff with brown 'miso' pockets."""
    rng = np.random.default_rng(seed)
    n = fbm(size, size, 6, 6, rng, 6)
    c = np.asarray((0.62, 0.63, 0.55))[None, None, :] * (0.9 + 0.2 * n[..., None])
    pockets = fbm(size, size, 24, 24, rng, 3) > 0.70
    c[pockets] = c[pockets] * 0.55 + np.array([0.45, 0.33, 0.20]) * 0.45
    return np.clip(c, 0, 1)
