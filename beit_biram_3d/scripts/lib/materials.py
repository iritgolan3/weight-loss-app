"""Procedural PBR materials for the Beit Biram reconstruction.

Every material is node-based and procedural: no external texture files, so the
.blend is fully self-contained. Each surface carries colour variation, roughness
variation and bump detail, plus (where appropriate) a subtle height-driven
weathering gradient so wall bases pick up dirt the way real ones do.
"""
import math
import bpy

_CACHE = {}


# --------------------------------------------------------------------------
# node helpers
# --------------------------------------------------------------------------

def _new(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (-300, 0)
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m, nt, bsdf


def _noise(nt, scale=5.0, detail=8.0, roughness=0.5, distortion=0.0, loc=(-1400, 0)):
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.location = loc
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = roughness
    n.inputs["Distortion"].default_value = distortion
    return n


def _ramp(nt, stops, loc=(-1100, 0), interp="LINEAR"):
    """stops: [(position, (r,g,b,a)), ...]"""
    r = nt.nodes.new("ShaderNodeValToRGB")
    r.location = loc
    r.color_ramp.interpolation = interp
    el = r.color_ramp.elements
    while len(el) > len(stops):
        el.remove(el[-1])
    for i, (pos, col) in enumerate(stops):
        if i < len(el):
            el[i].position = pos
            el[i].color = col
        else:
            e = el.new(pos)
            e.color = col
    return r


def _mix(nt, fac, a, b, loc=(-800, 0), blend="MIX"):
    m = nt.nodes.new("ShaderNodeMixRGB")
    m.location = loc
    m.blend_type = blend
    if hasattr(fac, "default_value") or isinstance(fac, (int, float)):
        if isinstance(fac, (int, float)):
            m.inputs["Fac"].default_value = fac
        else:
            nt.links.new(fac, m.inputs["Fac"])
    else:
        nt.links.new(fac, m.inputs["Fac"])
    for sock, inp in ((a, "Color1"), (b, "Color2")):
        if isinstance(sock, (tuple, list)):
            m.inputs[inp].default_value = tuple(sock) + (1.0,) * (4 - len(sock))
        else:
            nt.links.new(sock, m.inputs[inp])
    return m


def _bump(nt, height_socket, bsdf, strength=0.25, distance=0.02, loc=(-500, -450)):
    b = nt.nodes.new("ShaderNodeBump")
    b.location = loc
    b.inputs["Strength"].default_value = strength
    b.inputs["Distance"].default_value = distance
    nt.links.new(height_socket, b.inputs["Height"])
    nt.links.new(b.outputs["Normal"], bsdf.inputs["Normal"])
    return b


def _world_z(nt, loc=(-1700, -600)):
    g = nt.nodes.new("ShaderNodeNewGeometry")
    g.location = loc
    s = nt.nodes.new("ShaderNodeSeparateXYZ")
    s.location = (loc[0] + 200, loc[1])
    nt.links.new(g.outputs["Position"], s.inputs["Vector"])
    return s.outputs["Z"]


def _weather(nt, bsdf, base_socket, dirt_color=(0.18, 0.16, 0.14),
             z_lo=0.0, z_hi=2.4, amount=0.28, noise_scale=0.85):
    """Mix a dirt tone into the base colour near the foot of a wall."""
    z = _world_z(nt)
    mp = nt.nodes.new("ShaderNodeMapRange")
    mp.location = (-1300, -620)
    mp.inputs["From Min"].default_value = z_lo
    mp.inputs["From Max"].default_value = z_hi
    mp.inputs["To Min"].default_value = amount
    mp.inputs["To Max"].default_value = 0.0
    mp.clamp = True
    nt.links.new(z, mp.inputs["Value"])
    streak = _noise(nt, scale=noise_scale, detail=9.0, roughness=0.7,
                    loc=(-1300, -820))
    streak.inputs["Scale"].default_value = noise_scale
    sr = _ramp(nt, [(0.35, (0, 0, 0, 1)), (0.75, (1, 1, 1, 1))], loc=(-1100, -820))
    nt.links.new(streak.outputs["Fac"], sr.inputs["Fac"])
    gate = nt.nodes.new("ShaderNodeMath")
    gate.location = (-900, -700)
    gate.operation = "MULTIPLY"
    nt.links.new(mp.outputs["Result"], gate.inputs[0])
    nt.links.new(sr.outputs["Color"], gate.inputs[1])
    return _mix(nt, gate.outputs["Value"], base_socket, dirt_color, loc=(-620, -250))


def _finish(m, bsdf, nt, color_socket, rough_socket=None, roughness=0.6,
            metallic=0.0, ior=1.45, wall=False):
    if isinstance(color_socket, (tuple, list)):
        bsdf.inputs["Base Color"].default_value = tuple(color_socket) + (1.0,)
    else:
        nt.links.new(color_socket, bsdf.inputs["Base Color"])
    if rough_socket is not None:
        nt.links.new(rough_socket, bsdf.inputs["Roughness"])
    else:
        bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["IOR"].default_value = ior
    _wire_coords(nt, wall=wall)
    return m



# --------------------------------------------------------------------------
# world-space texture coordinates
#
# Blender defaults every procedural texture to "Generated" coordinates, which
# are normalised to each object's bounding box. On a 250 m terrain mesh that
# stretches a 0.6 m board mark across the whole site and the detail disappears;
# on a bench it becomes microscopic. Driving every texture from the world
# POSITION instead makes one Blender unit one metre for every surface in the
# scene, so board marks, paving joints and stone courses are all at true size.
# --------------------------------------------------------------------------

def _pos(nt):
    """World-space position, created once per node tree."""
    for n in nt.nodes:
        if n.type == "NEW_GEOMETRY" and n.label == "WORLDPOS":
            return n.outputs["Position"]
    g = nt.nodes.new("ShaderNodeNewGeometry")
    g.label = "WORLDPOS"
    g.location = (-2400, 400)
    return g.outputs["Position"]


def _wall_uv(nt):
    """(x + y, z, 0): a horizontal run coordinate that works for a wall facing
    either axis, so coursed stone and brick read correctly on vertical faces."""
    for n in nt.nodes:
        if n.type == "COMBXYZ" and n.label == "WALLUV":
            return n.outputs["Vector"]
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    sep.location = (-2200, 250)
    nt.links.new(_pos(nt), sep.inputs["Vector"])
    add = nt.nodes.new("ShaderNodeMath")
    add.operation = "ADD"
    add.location = (-2020, 250)
    nt.links.new(sep.outputs["X"], add.inputs[0])
    nt.links.new(sep.outputs["Y"], add.inputs[1])
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    comb.label = "WALLUV"
    comb.location = (-1880, 250)
    nt.links.new(add.outputs["Value"], comb.inputs["X"])
    nt.links.new(sep.outputs["Z"], comb.inputs["Y"])
    return comb.outputs["Vector"]


_TEX_TYPES = {"TEX_NOISE", "TEX_WAVE", "TEX_VORONOI", "TEX_BRICK", "TEX_MAGIC",
              "TEX_GRADIENT", "TEX_MUSGRAVE", "TEX_CHECKER"}
_PATTERN_TYPES = {"TEX_BRICK", "TEX_WAVE", "TEX_CHECKER", "TEX_GRADIENT"}


def _wire_coords(nt, wall=False):
    """Point every unconnected texture Vector input at world coordinates."""
    for n in list(nt.nodes):
        if n.type not in _TEX_TYPES:
            continue
        vin = n.inputs.get("Vector")
        if vin is None or vin.is_linked:
            continue
        if wall and n.type in _PATTERN_TYPES:
            nt.links.new(_wall_uv(nt), vin)
        else:
            nt.links.new(_pos(nt), vin)


def cached(fn):
    def wrap(*a, **k):
        key = (fn.__name__,) + a + tuple(sorted(k.items()))
        if key not in _CACHE:
            _CACHE[key] = fn(*a, **k)
        return _CACHE[key]
    return wrap


# --------------------------------------------------------------------------
# surface library
# --------------------------------------------------------------------------

@cached
def concrete_board(name="CONCRETE_BoardFormed", tone=0.36, board_h=0.62):
    """Brutalist béton brut: board-marked shuttering lines, aggregate blotching.

    Documented: several Beit Biram buildings are 'unplastered concrete'.
    """
    m, nt, b = _new(name)
    base = (tone, tone * 0.985, tone * 0.95)

    blotch = _noise(nt, scale=0.42, detail=10.0, roughness=0.6, loc=(-1700, 300))
    br = _ramp(nt, [(0.32, (tone * 0.84,) * 3 + (1,)),
                    (0.55, (tone,) * 3 + (1,)),
                    (0.78, (tone * 1.16,) * 3 + (1,))], loc=(-1450, 300))
    nt.links.new(blotch.outputs["Fac"], br.inputs["Fac"])

    # horizontal board-marking: repeating shutter boards with joint lines
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.location = (-1700, 40)
    wave.wave_type = "BANDS"
    wave.bands_direction = "Z"
    wave.wave_profile = "SAW"
    wave.inputs["Scale"].default_value = 1.0 / max(board_h, 0.05)
    wave.inputs["Distortion"].default_value = 0.6
    wave.inputs["Detail"].default_value = 2.0
    joint = _ramp(nt, [(0.0, (0, 0, 0, 1)), (0.06, (1, 1, 1, 1)),
                       (0.94, (1, 1, 1, 1)), (1.0, (0, 0, 0, 1))],
                  loc=(-1450, 40))
    nt.links.new(wave.outputs["Fac"], joint.inputs["Fac"])

    shaded = _mix(nt, 0.22, br.outputs["Color"], (tone * 0.6,) * 3, loc=(-1200, 180),
                  blend="MIX")
    nt.links.new(joint.outputs["Color"], shaded.inputs["Fac"])
    inv = nt.nodes.new("ShaderNodeInvert")
    inv.location = (-1300, 40)
    nt.links.new(joint.outputs["Color"], inv.inputs["Color"])
    nt.links.new(inv.outputs["Color"], shaded.inputs["Fac"])

    grain = _noise(nt, scale=34.0, detail=6.0, loc=(-1700, -180))
    weath = _weather(nt, b, shaded.outputs["Color"], dirt_color=(0.15, 0.14, 0.13),
                     z_hi=3.0, amount=0.22)

    rg = _ramp(nt, [(0.3, (0.74,) * 3 + (1,)), (0.7, (0.93,) * 3 + (1,))],
               loc=(-800, -450))
    nt.links.new(blotch.outputs["Fac"], rg.inputs["Fac"])

    hmix = _mix(nt, 0.6, joint.outputs["Color"], grain.outputs["Fac"],
                loc=(-900, -900), blend="MULTIPLY")
    _bump(nt, hmix.outputs["Color"], b, strength=0.45, distance=0.012)
    return _finish(m, b, nt, weath.outputs["Color"], rg.outputs["Color"],
                   wall=True)


@cached
def plaster_white(name="PLASTER_White", tone=(0.82, 0.80, 0.755)):
    """Painted render — the 1940s International Style palette."""
    m, nt, b = _new(name)
    n = _noise(nt, scale=0.30, detail=9.0, roughness=0.55, loc=(-1700, 200))
    r = _ramp(nt, [(0.35, tuple(c * 0.90 for c in tone) + (1,)),
                   (0.65, tuple(min(1, c * 1.05) for c in tone) + (1,))],
              loc=(-1450, 200))
    nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
    w = _weather(nt, b, r.outputs["Color"], dirt_color=(0.42, 0.40, 0.36),
                 z_hi=2.0, amount=0.22)
    fine = _noise(nt, scale=48.0, detail=4.0, loc=(-1000, -900))
    _bump(nt, fine.outputs["Fac"], b, strength=0.18, distance=0.004)
    rg = _ramp(nt, [(0.3, (0.62,) * 3 + (1,)), (0.8, (0.80,) * 3 + (1,))],
               loc=(-800, -480))
    nt.links.new(n.outputs["Fac"], rg.inputs["Fac"])
    return _finish(m, b, nt, w.outputs["Color"], rg.outputs["Color"])


@cached
def plaster_cream(name="PLASTER_Cream"):
    return plaster_white(name, tone=(0.80, 0.745, 0.64))


@cached
def limestone(name="STONE_Limestone"):
    """Local Carmel/Jerusalem-type limestone cladding, coursed."""
    m, nt, b = _new(name)
    brick = nt.nodes.new("ShaderNodeTexBrick")
    brick.location = (-1700, 200)
    brick.inputs["Scale"].default_value = 1.0
    brick.inputs["Mortar Size"].default_value = 0.012
    brick.inputs["Mortar Smooth"].default_value = 0.2
    brick.inputs["Bias"].default_value = 0.0
    brick.inputs["Brick Width"].default_value = 0.52
    brick.inputs["Row Height"].default_value = 0.26
    brick.inputs["Color1"].default_value = (0.66, 0.605, 0.50, 1)
    brick.inputs["Color2"].default_value = (0.735, 0.685, 0.575, 1)
    brick.inputs["Mortar"].default_value = (0.52, 0.50, 0.455, 1)

    n = _noise(nt, scale=0.85, detail=10.0, roughness=0.6, loc=(-1700, -150))
    tint = _mix(nt, 0.22, brick.outputs["Color"], (0.60, 0.55, 0.44),
                loc=(-1300, 100))
    nt.links.new(n.outputs["Fac"], tint.inputs["Fac"])
    w = _weather(nt, b, tint.outputs["Color"], dirt_color=(0.30, 0.28, 0.24),
                 z_hi=2.6, amount=0.24)
    pit = _noise(nt, scale=55.0, detail=6.0, loc=(-1100, -950))
    hm = _mix(nt, 0.5, brick.outputs["Fac"], pit.outputs["Fac"],
              loc=(-900, -950), blend="MULTIPLY")
    _bump(nt, hm.outputs["Color"], b, strength=0.5, distance=0.02)
    return _finish(m, b, nt, w.outputs["Color"], roughness=0.78, wall=True)


@cached
def glass(name="GLASS_Window", tint=(0.62, 0.70, 0.72), rough=0.02):
    m, nt, b = _new(name)
    b.inputs["Base Color"].default_value = tuple(tint) + (1,)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = 0.0
    b.inputs["Transmission Weight"].default_value = 0.92
    b.inputs["IOR"].default_value = 1.52
    m.use_backface_culling = False
    _wire_coords(nt)
    return m


@cached
def glass_dark(name="GLASS_Dark"):
    return glass(name, tint=(0.14, 0.17, 0.19), rough=0.05)


@cached
def metal_paint(name="METAL_Painted", color=(0.24, 0.26, 0.27), rough=0.42):
    m, nt, b = _new(name)
    n = _noise(nt, scale=28.0, detail=6.0, loc=(-1400, 0))
    r = _ramp(nt, [(0.35, tuple(c * 0.88 for c in color) + (1,)),
                   (0.7, tuple(min(1, c * 1.1) for c in color) + (1,))],
              loc=(-1150, 0))
    nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
    _bump(nt, n.outputs["Fac"], b, strength=0.10, distance=0.002)
    return _finish(m, b, nt, r.outputs["Color"], roughness=rough, metallic=0.25)


@cached
def aluminium(name="METAL_Aluminium"):
    m, nt, b = _new(name)
    n = _noise(nt, scale=45.0, detail=4.0, loc=(-1400, 0))
    r = _ramp(nt, [(0.3, (0.55, 0.56, 0.57, 1)), (0.75, (0.70, 0.71, 0.72, 1))],
              loc=(-1150, 0))
    nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
    _bump(nt, n.outputs["Fac"], b, strength=0.08, distance=0.0015)
    return _finish(m, b, nt, r.outputs["Color"], roughness=0.35, metallic=0.85)


@cached
def steel_galv(name="METAL_Galvanised"):
    m, nt, b = _new(name)
    n = _noise(nt, scale=12.0, detail=8.0, loc=(-1400, 0))
    r = _ramp(nt, [(0.3, (0.44, 0.45, 0.47, 1)), (0.8, (0.62, 0.63, 0.64, 1))],
              loc=(-1150, 0))
    nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
    return _finish(m, b, nt, r.outputs["Color"], roughness=0.48, metallic=0.9)


@cached
def wood(name="WOOD_Slat", color=(0.30, 0.185, 0.10)):
    m, nt, b = _new(name)
    w = nt.nodes.new("ShaderNodeTexWave")
    w.location = (-1600, 100)
    w.wave_type = "BANDS"
    w.bands_direction = "X"
    w.inputs["Scale"].default_value = 26.0
    w.inputs["Distortion"].default_value = 9.0
    w.inputs["Detail"].default_value = 5.0
    r = _ramp(nt, [(0.25, tuple(c * 0.72 for c in color) + (1,)),
                   (0.8, tuple(min(1, c * 1.28) for c in color) + (1,))],
              loc=(-1300, 100))
    nt.links.new(w.outputs["Fac"], r.inputs["Fac"])
    _bump(nt, w.outputs["Fac"], b, strength=0.22, distance=0.004)
    return _finish(m, b, nt, r.outputs["Color"], roughness=0.60, wall=True)


@cached
def asphalt(name="GROUND_Asphalt"):
    m, nt, b = _new(name)
    n = _noise(nt, scale=0.55, detail=12.0, roughness=0.65, loc=(-1700, 100))
    g = _noise(nt, scale=90.0, detail=6.0, loc=(-1700, -250))
    r = _ramp(nt, [(0.3, (0.052, 0.052, 0.056, 1)), (0.75, (0.105, 0.104, 0.108, 1))],
              loc=(-1400, 100))
    nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
    _bump(nt, g.outputs["Fac"], b, strength=0.45, distance=0.01)
    rg = _ramp(nt, [(0.3, (0.72,) * 3 + (1,)), (0.8, (0.92,) * 3 + (1,))],
               loc=(-1150, -250))
    nt.links.new(n.outputs["Fac"], rg.inputs["Fac"])
    return _finish(m, b, nt, r.outputs["Color"], rg.outputs["Color"])


@cached
def paving_slab(name="GROUND_PavingSlab", c1=(0.56, 0.545, 0.515),
                c2=(0.62, 0.605, 0.575), size=0.50):
    """Cast-concrete paving slabs with real joints."""
    m, nt, b = _new(name)
    brick = nt.nodes.new("ShaderNodeTexBrick")
    brick.location = (-1700, 150)
    brick.inputs["Scale"].default_value = 1.0
    brick.inputs["Brick Width"].default_value = size
    brick.inputs["Row Height"].default_value = size
    brick.inputs["Mortar Size"].default_value = 0.008
    brick.inputs["Mortar Smooth"].default_value = 0.1
    brick.inputs["Bias"].default_value = 0.0
    brick.offset = 0.5
    brick.inputs["Color1"].default_value = tuple(c1) + (1,)
    brick.inputs["Color2"].default_value = tuple(c2) + (1,)
    brick.inputs["Mortar"].default_value = (0.40, 0.395, 0.38, 1)
    n = _noise(nt, scale=0.35, detail=9.0, loc=(-1700, -200))
    worn = _mix(nt, 0.25, brick.outputs["Color"], (0.46, 0.45, 0.43),
                loc=(-1300, 80))
    nt.links.new(n.outputs["Fac"], worn.inputs["Fac"])
    grit = _noise(nt, scale=60.0, detail=5.0, loc=(-1300, -400))
    hm = _mix(nt, 0.45, brick.outputs["Fac"], grit.outputs["Fac"],
              loc=(-1050, -400), blend="MULTIPLY")
    _bump(nt, hm.outputs["Color"], b, strength=0.4, distance=0.008)
    return _finish(m, b, nt, worn.outputs["Color"], roughness=0.72)


@cached
def grass(name="GROUND_Grass"):
    """Irrigated campus lawn — the 'wide lawns between the buildings'."""
    m, nt, b = _new(name)
    n = _noise(nt, scale=0.55, detail=12.0, roughness=0.62, loc=(-1700, 150))
    n2 = _noise(nt, scale=14.0, detail=8.0, loc=(-1700, -150))
    r = _ramp(nt, [(0.28, (0.072, 0.112, 0.026, 1)),
                   (0.52, (0.112, 0.176, 0.040, 1)),
                   (0.78, (0.168, 0.232, 0.058, 1))], loc=(-1400, 150))
    nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
    dry = _mix(nt, 0.18, r.outputs["Color"], (0.26, 0.24, 0.10), loc=(-1150, 150))
    nt.links.new(n2.outputs["Fac"], dry.inputs["Fac"])
    _bump(nt, n2.outputs["Fac"], b, strength=0.55, distance=0.02)
    return _finish(m, b, nt, dry.outputs["Color"], roughness=0.88)


@cached
def soil(name="GROUND_Soil"):
    m, nt, b = _new(name)
    n = _noise(nt, scale=1.1, detail=12.0, roughness=0.7, loc=(-1700, 100))
    r = _ramp(nt, [(0.3, (0.085, 0.058, 0.035, 1)), (0.7, (0.155, 0.108, 0.068, 1))],
              loc=(-1400, 100))
    nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
    g = _noise(nt, scale=22.0, detail=8.0, loc=(-1400, -250))
    _bump(nt, g.outputs["Fac"], b, strength=0.7, distance=0.03)
    return _finish(m, b, nt, r.outputs["Color"], roughness=0.93)


@cached
def rock_carmel(name="GROUND_CarmelRock"):
    m, nt, b = _new(name)
    v = nt.nodes.new("ShaderNodeTexVoronoi")
    v.location = (-1700, 100)
    v.inputs["Scale"].default_value = 1.4
    n = _noise(nt, scale=4.0, detail=10.0, loc=(-1700, -200))
    r = _ramp(nt, [(0.2, (0.36, 0.345, 0.305, 1)), (0.75, (0.53, 0.51, 0.455, 1))],
              loc=(-1400, 100))
    nt.links.new(v.outputs["Distance"], r.inputs["Fac"])
    hm = _mix(nt, 0.5, v.outputs["Distance"], n.outputs["Fac"], loc=(-1150, -200),
              blend="MULTIPLY")
    _bump(nt, hm.outputs["Color"], b, strength=0.8, distance=0.06)
    return _finish(m, b, nt, r.outputs["Color"], roughness=0.85)


@cached
def track_rubber(name="SPORT_TrackRubber"):
    """Red polyurethane running track."""
    m, nt, b = _new(name)
    n = _noise(nt, scale=70.0, detail=6.0, loc=(-1400, 0))
    r = _ramp(nt, [(0.35, (0.29, 0.058, 0.032, 1)), (0.75, (0.40, 0.088, 0.050, 1))],
              loc=(-1150, 0))
    nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
    _bump(nt, n.outputs["Fac"], b, strength=0.35, distance=0.004)
    return _finish(m, b, nt, r.outputs["Color"], roughness=0.80)


@cached
def court_surface(name="SPORT_Court", color=(0.075, 0.17, 0.33)):
    m, nt, b = _new(name)
    n = _noise(nt, scale=55.0, detail=5.0, loc=(-1400, 0))
    r = _ramp(nt, [(0.35, tuple(c * 0.85 for c in color) + (1,)),
                   (0.75, tuple(min(1, c * 1.15) for c in color) + (1,))],
              loc=(-1150, 0))
    nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
    _bump(nt, n.outputs["Fac"], b, strength=0.25, distance=0.003)
    return _finish(m, b, nt, r.outputs["Color"], roughness=0.70)


@cached
def synthetic_turf(name="SPORT_SyntheticTurf"):
    m, nt, b = _new(name)
    n = _noise(nt, scale=26.0, detail=10.0, loc=(-1400, 0))
    r = _ramp(nt, [(0.3, (0.045, 0.135, 0.050, 1)), (0.8, (0.085, 0.215, 0.080, 1))],
              loc=(-1150, 0))
    nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
    _bump(nt, n.outputs["Fac"], b, strength=0.4, distance=0.006)
    return _finish(m, b, nt, r.outputs["Color"], roughness=0.90)


@cached
def line_paint(name="SPORT_LinePaint", color=(0.88, 0.88, 0.86)):
    m, nt, b = _new(name)
    return _finish(m, b, nt, color, roughness=0.55)


@cached
def water_pool(name="WATER_Pool"):
    m, nt, b = _new(name)
    b.inputs["Base Color"].default_value = (0.055, 0.30, 0.38, 1)
    b.inputs["Roughness"].default_value = 0.04
    b.inputs["Transmission Weight"].default_value = 0.75
    b.inputs["IOR"].default_value = 1.33
    n = _noise(nt, scale=6.0, detail=8.0, loc=(-1400, -400))
    _bump(nt, n.outputs["Fac"], b, strength=0.12, distance=0.012)
    _wire_coords(nt)
    return m


@cached
def bark(name="VEG_Bark", color=(0.115, 0.082, 0.056)):
    m, nt, b = _new(name)
    w = nt.nodes.new("ShaderNodeTexWave")
    w.location = (-1600, 0)
    w.wave_type = "BANDS"
    w.bands_direction = "Z"
    w.inputs["Scale"].default_value = 9.0
    w.inputs["Distortion"].default_value = 14.0
    w.inputs["Detail"].default_value = 6.0
    r = _ramp(nt, [(0.25, tuple(c * 0.62 for c in color) + (1,)),
                   (0.8, tuple(min(1, c * 1.5) for c in color) + (1,))],
              loc=(-1300, 0))
    nt.links.new(w.outputs["Fac"], r.inputs["Fac"])
    _bump(nt, w.outputs["Fac"], b, strength=0.65, distance=0.02)
    return _finish(m, b, nt, r.outputs["Color"], roughness=0.85)


@cached
def foliage(name="VEG_Foliage", color=(0.082, 0.132, 0.034), rough=0.68):
    """Leaf canopy: translucent so sunlight reads through the crown."""
    m, nt, b = _new(name)
    n = _noise(nt, scale=2.6, detail=10.0, roughness=0.6, loc=(-1500, 0))
    r = _ramp(nt, [(0.28, tuple(c * 0.65 for c in color) + (1,)),
                   (0.55, tuple(c for c in color) + (1,)),
                   (0.82, tuple(min(1, c * 1.65) for c in color) + (1,))],
              loc=(-1200, 0))
    nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
    nt.links.new(r.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough
    b.inputs["Subsurface Weight"].default_value = 0.22
    b.inputs["Subsurface Radius"].default_value = (0.09, 0.13, 0.025)
    b.inputs["Subsurface Scale"].default_value = 0.08
    _wire_coords(nt)
    return m


@cached
def foliage_pine(name="VEG_FoliagePine"):
    return foliage(name, color=(0.052, 0.094, 0.030), rough=0.72)


@cached
def foliage_olive(name="VEG_FoliageOlive"):
    return foliage(name, color=(0.135, 0.150, 0.070), rough=0.62)


@cached
def foliage_cypress(name="VEG_FoliageCypress"):
    return foliage(name, color=(0.042, 0.080, 0.028), rough=0.74)


@cached
def hedge(name="VEG_Hedge"):
    return foliage(name, color=(0.068, 0.120, 0.030), rough=0.75)


@cached
def flowers(name="VEG_Flowers", color=(0.34, 0.085, 0.125)):
    """A bedding mass: mostly foliage with blooms scattered through it.

    A hard two-tone split reads as coloured facets rather than planting, so the
    ramp stays soft and the flower colour stays subordinate to the leaf green.
    """
    m, nt, b = _new(name)
    n = _noise(nt, scale=26.0, detail=8.0, roughness=0.6, loc=(-1400, 0))
    r = _ramp(nt, [(0.30, (0.055, 0.105, 0.030, 1)),
                   (0.52, (0.085, 0.140, 0.038, 1)),
                   (0.68, tuple(color) + (1,)),
                   (0.86, tuple(min(1, c * 1.35) for c in color) + (1,))],
              loc=(-1150, 0))
    nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
    _bump(nt, n.outputs["Fac"], b, strength=0.3, distance=0.006)
    return _finish(m, b, nt, r.outputs["Color"], roughness=0.72)


@cached
def rubber_dark(name="MISC_RubberDark"):
    m, nt, b = _new(name)
    return _finish(m, b, nt, (0.022, 0.022, 0.024), roughness=0.80)


@cached
def plastic(name="MISC_Plastic", color=(0.12, 0.28, 0.14)):
    m, nt, b = _new(name)
    return _finish(m, b, nt, color, roughness=0.42)


@cached
def emissive(name="MISC_Emissive", color=(1.0, 0.93, 0.78), strength=8.0):
    m, nt, b = _new(name)
    b.inputs["Base Color"].default_value = tuple(color) + (1,)
    b.inputs["Emission Color"].default_value = tuple(color) + (1,)
    b.inputs["Emission Strength"].default_value = strength
    b.inputs["Roughness"].default_value = 0.3
    _wire_coords(nt)
    return m


@cached
def sign_blue(name="SIGN_Blue"):
    m, nt, b = _new(name)
    return _finish(m, b, nt, (0.035, 0.085, 0.22), roughness=0.34)


@cached
def sign_white(name="SIGN_White"):
    m, nt, b = _new(name)
    return _finish(m, b, nt, (0.80, 0.79, 0.76), roughness=0.40)


@cached
def bronze(name="METAL_Bronze"):
    """Memorial plaques outside the library."""
    m, nt, b = _new(name)
    n = _noise(nt, scale=18.0, detail=8.0, loc=(-1400, 0))
    r = _ramp(nt, [(0.3, (0.135, 0.092, 0.042, 1)), (0.75, (0.26, 0.185, 0.085, 1))],
              loc=(-1150, 0))
    nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
    _bump(nt, n.outputs["Fac"], b, strength=0.2, distance=0.002)
    return _finish(m, b, nt, r.outputs["Color"], roughness=0.38, metallic=0.85)


@cached
def car_paint(name="CAR_Paint", color=(0.35, 0.36, 0.38)):
    m, nt, b = _new(name)
    b.inputs["Base Color"].default_value = tuple(color) + (1,)
    b.inputs["Roughness"].default_value = 0.22
    b.inputs["Metallic"].default_value = 0.55
    b.inputs["Coat Weight"].default_value = 0.8
    b.inputs["Coat Roughness"].default_value = 0.06
    _wire_coords(nt)
    return m


@cached
def roof_membrane(name="ROOF_Membrane"):
    m, nt, b = _new(name)
    n = _noise(nt, scale=1.6, detail=10.0, loc=(-1400, 0))
    r = _ramp(nt, [(0.3, (0.185, 0.180, 0.170, 1)), (0.75, (0.275, 0.268, 0.255, 1))],
              loc=(-1150, 0))
    nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
    _bump(nt, n.outputs["Fac"], b, strength=0.3, distance=0.01)
    return _finish(m, b, nt, r.outputs["Color"], roughness=0.82)


@cached
def roof_gravel(name="ROOF_Gravel"):
    m, nt, b = _new(name)
    v = nt.nodes.new("ShaderNodeTexVoronoi")
    v.location = (-1400, 0)
    v.inputs["Scale"].default_value = 42.0
    r = _ramp(nt, [(0.1, (0.30, 0.285, 0.255, 1)), (0.6, (0.44, 0.42, 0.385, 1))],
              loc=(-1150, 0))
    nt.links.new(v.outputs["Distance"], r.inputs["Fac"])
    _bump(nt, v.outputs["Distance"], b, strength=0.6, distance=0.02)
    return _finish(m, b, nt, r.outputs["Color"], roughness=0.90)
