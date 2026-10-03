"""
Physically based, procedural material library.

Every material is built from Principled BSDF plus layered imperfections
(tonal variation, roughness break-up, micro normal detail, smudges, dust,
scratches). Coordinates are object-space metres, so scale stays consistent
across objects. Materials are named M_<Family>_<Variant>.
"""

import math
import bpy
from . import config as C

_cache = {}

_ALIASES = {"Fac": "Factor", "Factor": "Fac"}


def _sock(coll, name, kind=None):
    for s in coll:
        if s.name == name and s.enabled and (kind is None or s.type == kind):
            return s
    alt = _ALIASES.get(name)
    if alt:
        for s in coll:
            if s.name == alt and s.enabled and (kind is None or s.type == kind):
                return s
    for s in coll:
        if s.name == name:
            return s
    raise KeyError(name)


class NB:
    """Tiny node-tree builder."""

    def __init__(self, mat):
        self.mat = mat
        self.nt = mat.node_tree
        self.nt.nodes.clear()
        self.x = 0

    # -- creation ----------------------------------------------------------
    def node(self, kind, inputs=None, **props):
        n = self.nt.nodes.new(kind)
        n.location = (self.x, 0)
        self.x -= 220
        for k, v in props.items():
            setattr(n, k, v)
        for k, v in (inputs or {}).items():
            self.set(n, k, v)
        return n

    def set(self, node, name, value):
        sock = _sock(node.inputs, name) if isinstance(name, str) else node.inputs[name]
        if isinstance(value, bpy.types.NodeSocket):
            self.nt.links.new(value, sock)
        else:
            if sock.type in ('RGBA',) and len(value) == 3:
                value = (*value, 1.0)
            sock.default_value = value

    def link(self, a, b):
        self.nt.links.new(a, b)

    @staticmethod
    def out(node, name=None):
        if name is None:
            for s in node.outputs:
                if s.enabled:
                    return s
        return _sock(node.outputs, name)

    # -- helpers -----------------------------------------------------------
    def coord(self, kind='Object'):
        n = self.node('ShaderNodeTexCoord')
        return self.out(n, kind)

    def mapping(self, vec, scale=(1, 1, 1), rot=(0, 0, 0), loc=(0, 0, 0)):
        n = self.node('ShaderNodeMapping', {'Vector': vec, 'Scale': scale,
                                            'Rotation': rot, 'Location': loc})
        return self.out(n, 'Vector')

    def noise(self, vec, scale=5.0, detail=4.0, rough=0.5, distortion=0.0,
              out='Fac', lacunarity=2.0, ntype='FBM'):
        n = self.node('ShaderNodeTexNoise', {'Vector': vec, 'Scale': scale,
                                             'Detail': detail, 'Roughness': rough,
                                             'Distortion': distortion,
                                             'Lacunarity': lacunarity},
                      noise_dimensions='3D', noise_type=ntype)
        return self.out(n, out)

    def voronoi(self, vec, scale=5.0, out='Distance', feature='F1',
                randomness=1.0, distance='EUCLIDEAN', dims='3D'):
        n = self.node('ShaderNodeTexVoronoi', {'Vector': vec, 'Scale': scale,
                                               'Randomness': randomness},
                      feature=feature, distance=distance, voronoi_dimensions=dims)
        return self.out(n, out)

    def wave(self, vec, scale=1.0, distortion=0.0, detail=2.0, dscale=1.0,
             kind='BANDS', direction='X', profile='SIN', out='Fac'):
        props = dict(wave_type=kind, wave_profile=profile)
        if kind == 'BANDS':
            props['bands_direction'] = direction
        else:
            props['rings_direction'] = direction
        n = self.node('ShaderNodeTexWave', {'Vector': vec, 'Scale': scale,
                                            'Distortion': distortion,
                                            'Detail': detail,
                                            'Detail Scale': dscale}, **props)
        return self.out(n, out)

    def math(self, op, a, b=0.0, c=0.0, clamp=False):
        n = self.node('ShaderNodeMath', operation=op, use_clamp=clamp)
        for i, v in enumerate((a, b, c)):
            if isinstance(v, bpy.types.NodeSocket):
                self.link(v, n.inputs[i])
            else:
                n.inputs[i].default_value = v
        return n.outputs[0]

    def maprange(self, v, fmin, fmax, tmin=0.0, tmax=1.0, clamp=True,
                 interp='LINEAR'):
        n = self.node('ShaderNodeMapRange', {'Value': v, 'From Min': fmin,
                                             'From Max': fmax, 'To Min': tmin,
                                             'To Max': tmax},
                      clamp=clamp, interpolation_type=interp)
        return self.out(n, 'Result')

    def mix(self, fac, a, b, blend='MIX', clamp=True):
        n = self.node('ShaderNodeMix', data_type='RGBA', blend_type=blend,
                      clamp_result=clamp)
        self.set(n, 0, fac) if not isinstance(fac, bpy.types.NodeSocket) else self.link(fac, n.inputs[0])
        for idx, v in ((6, a), (7, b)):
            if isinstance(v, bpy.types.NodeSocket):
                self.link(v, n.inputs[idx])
            else:
                n.inputs[idx].default_value = (*v[:3], 1.0)
        return n.outputs[2]

    def mixf(self, fac, a, b):
        n = self.node('ShaderNodeMix', data_type='FLOAT')
        for idx, v in ((0, fac), (2, a), (3, b)):
            if isinstance(v, bpy.types.NodeSocket):
                self.link(v, n.inputs[idx])
            else:
                n.inputs[idx].default_value = v
        return n.outputs[0]

    def ramp(self, fac, stops, interp='LINEAR'):
        n = self.node('ShaderNodeValToRGB')
        self.link(fac, n.inputs[0]) if isinstance(fac, bpy.types.NodeSocket) else None
        cr = n.color_ramp
        cr.interpolation = interp
        els = cr.elements
        while len(els) > 1:
            els.remove(els[-1])
        els[0].position = stops[0][0]
        els[0].color = (*stops[0][1][:3], 1.0)
        for pos, col in stops[1:]:
            e = els.new(pos)
            e.color = (*col[:3], 1.0)
        return n.outputs[0]

    def bump(self, height, strength=0.1, distance=0.01, normal=None):
        n = self.node('ShaderNodeBump', {'Height': height, 'Strength': strength,
                                         'Distance': distance})
        if normal is not None:
            self.set(n, 'Normal', normal)
        return self.out(n, 'Normal')

    def obj_random(self):
        return self.out(self.node('ShaderNodeObjectInfo'), 'Random')

    def geometry(self, name):
        return self.out(self.node('ShaderNodeNewGeometry'), name)

    def sepxyz(self, vec):
        n = self.node('ShaderNodeSeparateXYZ', {'Vector': vec})
        return n.outputs[0], n.outputs[1], n.outputs[2]

    def hsv(self, color, h=0.5, s=1.0, v=1.0, fac=1.0):
        n = self.node('ShaderNodeHueSaturation', {'Color': color, 'Hue': h,
                                                  'Saturation': s, 'Value': v,
                                                  'Fac': fac})
        return self.out(n, 'Color')

    def principled(self, **kw):
        names = {
            'base': 'Base Color', 'metallic': 'Metallic', 'rough': 'Roughness',
            'ior': 'IOR', 'alpha': 'Alpha', 'normal': 'Normal',
            'spec': 'Specular IOR Level', 'aniso': 'Anisotropic',
            'aniso_rot': 'Anisotropic Rotation', 'tangent': 'Tangent',
            'trans': 'Transmission Weight', 'coat': 'Coat Weight',
            'coat_rough': 'Coat Roughness', 'coat_normal': 'Coat Normal',
            'coat_tint': 'Coat Tint', 'sheen': 'Sheen Weight',
            'sheen_rough': 'Sheen Roughness', 'sheen_tint': 'Sheen Tint',
            'emit': 'Emission Color', 'emit_strength': 'Emission Strength',
            'sss': 'Subsurface Weight', 'sss_radius': 'Subsurface Radius',
            'diff_rough': 'Diffuse Roughness', 'thin_film': 'Thin Film Thickness',
        }
        n = self.node('ShaderNodeBsdfPrincipled')
        for k, v in kw.items():
            self.set(n, names[k], v)
        return n

    def output(self, shader_socket, displacement=None):
        o = self.node('ShaderNodeOutputMaterial', target='ALL')
        self.link(shader_socket, _sock(o.inputs, 'Surface'))
        if displacement is not None:
            self.link(displacement, _sock(o.inputs, 'Displacement'))
        o.location = (400, 0)
        return o


def _new(name):
    if name in _cache:
        return None, _cache[name]
    mat = bpy.data.materials.new(name)
    _cache[name] = mat
    return NB(mat), mat


def _finish(mat, viewport_color, rough=0.5, metal=0.0):
    mat.diffuse_color = (*viewport_color[:3], 1.0)
    mat.roughness = rough
    mat.metallic = metal
    return mat


# ======================================================================
# Generic layered PBR
# ======================================================================

def layered(name, color, rough=0.5, metallic=0.0, color_var=0.04,
            rough_var=0.08, bump=0.015, bump_scale=600.0, smudge=0.05,
            dust=0.0, scratch=0.0, coat=0.0, coat_rough=0.05, spec=0.5,
            sheen=0.0, tint_random=0.02, ior=1.5, macro_scale=2.0):
    """Generic material with subtle, physically plausible imperfections."""
    nb, mat = _new(name)
    if nb is None:
        return mat
    co = nb.coord('Object')
    # broad tonal variation + per-object random tint
    big = nb.noise(co, scale=macro_scale, detail=3, rough=0.55)
    var = nb.maprange(big, 0.3, 0.7, 1.0 - color_var, 1.0 + color_var)
    rnd = nb.obj_random()
    rvar = nb.maprange(rnd, 0, 1, 1.0 - tint_random, 1.0 + tint_random)
    tone = nb.math('MULTIPLY', var, rvar)
    base = nb.mix(1.0, color, (1, 1, 1), blend='MULTIPLY')
    tone_c = nb.node('ShaderNodeCombineXYZ', {'X': tone, 'Y': tone, 'Z': tone})
    base = nb.mix(1.0, base, nb.out(tone_c, 'Vector'), blend='MULTIPLY')
    # roughness break-up
    rn = nb.noise(co, scale=18.0, detail=8, rough=0.6)
    r = nb.maprange(rn, 0.25, 0.75, rough - rough_var, rough + rough_var)
    if smudge > 0:
        sm = nb.noise(co, scale=6.0, detail=2, rough=0.4, distortion=1.2)
        smm = nb.maprange(sm, 0.55, 0.75, 0.0, smudge)
        r = nb.math('ADD', r, smm, clamp=True)
    if scratch > 0:
        sc_coord = nb.mapping(co, scale=(1.0, 1.0, 40.0), rot=(0.3, 0.7, 0.2))
        sc = nb.noise(sc_coord, scale=30.0, detail=2, rough=0.3, ntype='RIDGED_MULTIFRACTAL')
        scm = nb.maprange(sc, 0.92, 1.0, 0.0, scratch)
        r = nb.math('ADD', r, scm, clamp=True)
    if dust > 0:
        nrm = nb.geometry('Normal')
        _, _, nz = nb.sepxyz(nrm)
        up = nb.maprange(nz, 0.6, 1.0, 0.0, 1.0)
        dn = nb.noise(co, scale=12.0, detail=6, rough=0.7)
        dmask = nb.math('MULTIPLY', up, nb.maprange(dn, 0.35, 0.8, 0.2, 1.0))
        dmask = nb.math('MULTIPLY', dmask, dust)
        base = nb.mix(dmask, base, (0.32, 0.30, 0.27))
        r = nb.mixf(dmask, r, 0.9)
    # micro surface
    micro = nb.noise(co, scale=bump_scale, detail=3, rough=0.5)
    nrm_out = nb.bump(micro, strength=bump, distance=0.002) if bump > 0 else None
    kw = dict(base=base, rough=r, metallic=metallic, spec=spec, ior=ior)
    if nrm_out is not None:
        kw['normal'] = nrm_out
    if coat > 0:
        kw.update(coat=coat, coat_rough=coat_rough)
    if sheen > 0:
        kw.update(sheen=sheen, sheen_rough=0.4)
    p = nb.principled(**kw)
    nb.output(nb.out(p, 'BSDF'))
    return _finish(mat, color, rough, metallic)


# ======================================================================
# Architectural
# ======================================================================

def wall_paint(name="M_Paint_Wall_Eggshell", color=(0.78, 0.78, 0.76)):
    nb, mat = _new(name)
    if nb is None:
        return mat
    co = nb.coord('Object')
    wpos = nb.geometry('Position')
    _, _, wz = nb.sepxyz(wpos)
    # roller texture / orange peel
    peel = nb.noise(co, scale=220.0, detail=4, rough=0.55)
    roller = nb.noise(nb.mapping(co, scale=(3.0, 3.0, 0.4)), scale=4.0, detail=2)
    big = nb.noise(co, scale=0.6, detail=3)
    tone = nb.maprange(big, 0.3, 0.7, 0.965, 1.02)
    base = nb.mix(1.0, color, (1, 1, 1), blend='MULTIPLY')
    tone_c = nb.out(nb.node('ShaderNodeCombineXYZ', {'X': tone, 'Y': tone, 'Z': tone}), 'Vector')
    base = nb.mix(1.0, base, tone_c, blend='MULTIPLY')
    # dust/scuff near floor
    lowmask = nb.maprange(wz, 0.0, 0.35, 1.0, 0.0)
    scuffn = nb.noise(co, scale=9.0, detail=6, rough=0.65)
    scuff = nb.math('MULTIPLY', lowmask, nb.maprange(scuffn, 0.45, 0.8, 0.0, 0.10))
    base = nb.mix(scuff, base, (0.25, 0.24, 0.22))
    r = nb.maprange(roller, 0.3, 0.7, 0.62, 0.74)
    nrm = nb.bump(peel, strength=0.08, distance=0.0015)
    p = nb.principled(base=base, rough=r, normal=nrm, spec=0.4)
    nb.output(nb.out(p, 'BSDF'))
    return _finish(mat, color, 0.7)


def cmu_paint(name="M_Paint_CMU", color=(0.80, 0.80, 0.78)):
    """Painted concrete block: 16x8 in coursing with struck joints."""
    nb, mat = _new(name)
    if nb is None:
        return mat
    co = nb.coord('Object')
    # rotate so that block runs along X (wall plane is XZ)
    vec = nb.mapping(co, rot=(math.radians(90), 0, 0))
    brick = nb.node('ShaderNodeTexBrick', {'Vector': vec, 'Scale': 1.0,
                                           'Mortar Size': 0.008, 'Mortar Smooth': 0.6,
                                           'Brick Width': 0.406, 'Row Height': 0.203,
                                           'Color1': (1, 1, 1), 'Color2': (0.97, 0.97, 0.97),
                                           'Mortar': (0, 0, 0)},
                    offset=0.5, offset_frequency=2)
    joints = nb.out(brick, 'Fac')
    pores = nb.voronoi(co, scale=350.0, out='Distance')
    poresm = nb.maprange(pores, 0.0, 0.18, 0.0, 1.0)
    h = nb.math('ADD', nb.math('MULTIPLY', nb.math('SUBTRACT', 1.0, joints), 0.6),
                nb.math('MULTIPLY', poresm, 0.4))
    nrm = nb.bump(h, strength=0.35, distance=0.003)
    big = nb.noise(co, scale=0.8, detail=3)
    tone = nb.maprange(big, 0.3, 0.7, 0.95, 1.02)
    tone_c = nb.out(nb.node('ShaderNodeCombineXYZ', {'X': tone, 'Y': tone, 'Z': tone}), 'Vector')
    base = nb.mix(1.0, color, tone_c, blend='MULTIPLY')
    base = nb.mix(nb.math('MULTIPLY', joints, 0.15), base, (0.5, 0.5, 0.48))
    p = nb.principled(base=base, rough=0.78, normal=nrm, spec=0.35)
    nb.output(nb.out(p, 'BSDF'))
    return _finish(mat, color, 0.78)


def concrete(name="M_Concrete_Broom", color=(0.42, 0.41, 0.39), broom=True):
    nb, mat = _new(name)
    if nb is None:
        return mat
    co = nb.coord('Object')
    n1 = nb.noise(co, scale=1.2, detail=6, rough=0.6)
    n2 = nb.noise(co, scale=30.0, detail=8, rough=0.7)
    stain = nb.noise(co, scale=0.35, detail=4, rough=0.6, distortion=0.8)
    base = nb.mix(nb.maprange(n1, 0.3, 0.7, 0.0, 1.0), [c * 0.85 for c in color], [c * 1.1 for c in color])
    base = nb.mix(nb.maprange(stain, 0.55, 0.75, 0.0, 0.25), base, (0.18, 0.17, 0.16))
    h = n2
    if broom:
        br = nb.noise(nb.mapping(co, scale=(1.0, 60.0, 1.0)), scale=8.0, detail=2)
        h = nb.math('ADD', nb.math('MULTIPLY', n2, 0.5), nb.math('MULTIPLY', br, 0.5))
    nrm = nb.bump(h, strength=0.25, distance=0.004)
    r = nb.maprange(n2, 0.3, 0.7, 0.72, 0.9)
    p = nb.principled(base=base, rough=r, normal=nrm, spec=0.4)
    nb.output(nb.out(p, 'BSDF'))
    return _finish(mat, color, 0.85)


def floor_flake(name="M_Floor_Polyaspartic_Flake"):
    """Grey broadcast-flake polyaspartic coating with a high-gloss clear coat.

    Flakes are ~4-6 mm Voronoi cells. Wear is subtle: tyre-path haze,
    micro scratches in the clear coat, faint dust in the corners."""
    nb, mat = _new(name)
    if nb is None:
        return mat
    pos = nb.geometry('Position')               # world space - floor spans many objects
    px, py, pz = nb.sepxyz(pos)
    cell = nb.voronoi(pos, scale=190.0, out='Color', randomness=1.0)
    cell_v = nb.out(nb.node('ShaderNodeRGBToBW', {'Color': cell}), 'Val')
    flake = nb.ramp(cell_v, [
        (0.00, (0.020, 0.020, 0.021)),   # black
        (0.30, (0.085, 0.086, 0.088)),   # charcoal
        (0.55, (0.20, 0.20, 0.205)),     # mid grey
        (0.78, (0.42, 0.42, 0.41)),      # light grey
        (0.92, (0.62, 0.60, 0.56)),      # white/tan
    ], interp='CONSTANT')
    # second flake layer, offset & different scale, to break regularity
    cell2 = nb.voronoi(nb.mapping(pos, loc=(3.3, 1.7, 0.0)), scale=120.0, out='Color')
    cell2_v = nb.out(nb.node('ShaderNodeRGBToBW', {'Color': cell2}), 'Val')
    flake2 = nb.ramp(cell2_v, [
        (0.0, (0.04, 0.04, 0.042)), (0.4, (0.13, 0.13, 0.135)),
        (0.7, (0.30, 0.30, 0.30)), (0.9, (0.52, 0.51, 0.49))], interp='CONSTANT')
    sel = nb.noise(pos, scale=60.0, detail=1)
    base = nb.mix(nb.maprange(sel, 0.45, 0.55, 0.0, 1.0), flake, flake2)
    # large tonal variation & tyre haze in the parking lanes
    big = nb.noise(pos, scale=0.25, detail=4, rough=0.6)
    tone = nb.maprange(big, 0.3, 0.7, 0.92, 1.05)
    tone_c = nb.out(nb.node('ShaderNodeCombineXYZ', {'X': tone, 'Y': tone, 'Z': tone}), 'Vector')
    base = nb.mix(1.0, base, tone_c, blend='MULTIPLY')
    # tyre haze: four faint lanes along Y where the cars roll in
    lane = nb.math('ABSOLUTE', nb.math('SUBTRACT', nb.math('MODULO', nb.math('ADD', px, 10.0), 1.62), 0.81))
    lane = nb.maprange(lane, 0.12, 0.35, 0.0, 1.0)
    lane = nb.math('SUBTRACT', 1.0, lane)
    lane_mask_y = nb.maprange(py, 0.0, 8.0, 1.0, 0.0)
    tyre = nb.math('MULTIPLY', lane, lane_mask_y)
    tn = nb.noise(nb.mapping(pos, scale=(4.0, 0.4, 1.0)), scale=6.0, detail=4)
    tyre = nb.math('MULTIPLY', tyre, nb.maprange(tn, 0.4, 0.75, 0.0, 0.35))
    base = nb.mix(tyre, base, (0.03, 0.03, 0.03))
    # roughness of the clear coat: very glossy with scuffs and micro-scratches
    scuff = nb.noise(pos, scale=3.0, detail=6, rough=0.65, distortion=0.6)
    coat_r = nb.maprange(scuff, 0.3, 0.75, 0.035, 0.11)
    scr_coord = nb.mapping(pos, scale=(1.0, 25.0, 1.0), rot=(0, 0, 0.35))
    scr = nb.noise(scr_coord, scale=40.0, detail=1, ntype='RIDGED_MULTIFRACTAL')
    scr = nb.maprange(scr, 0.93, 1.0, 0.0, 0.18)
    coat_r = nb.math('ADD', coat_r, scr, clamp=True)
    coat_r = nb.math('ADD', coat_r, nb.math('MULTIPLY', tyre, 0.3), clamp=True)
    # dust accumulation near walls (distance-to-wall gradient)
    dx = nb.math('MINIMUM', nb.math('SUBTRACT', px, C.X0), nb.math('SUBTRACT', C.X1, px))
    dy = nb.math('MINIMUM', py, nb.math('SUBTRACT', C.Y1, py))
    dwall = nb.math('MINIMUM', dx, dy)
    dust = nb.maprange(dwall, 0.0, 0.18, 0.45, 0.0)
    dn = nb.noise(pos, scale=14.0, detail=5)
    dust = nb.math('MULTIPLY', dust, nb.maprange(dn, 0.3, 0.8, 0.3, 1.0))
    base = nb.mix(dust, base, (0.30, 0.29, 0.27))
    coat_r = nb.mixf(dust, coat_r, 0.5)
    # orange-peel in the clear coat
    peel = nb.noise(pos, scale=90.0, detail=2)
    coat_n = nb.bump(peel, strength=0.02, distance=0.002)
    flake_n = nb.bump(cell_v, strength=0.03, distance=0.0005)
    p = nb.principled(base=base, rough=0.45, metallic=0.0, normal=flake_n,
                      coat=1.0, coat_rough=coat_r, coat_normal=coat_n, spec=0.5)
    _sock(p.inputs, 'Coat IOR').default_value = 1.52
    nb.output(nb.out(p, 'BSDF'))
    return _finish(mat, (0.16, 0.16, 0.16), 0.08)


def drywall_ceiling(name="M_Paint_Ceiling_Flat"):
    return layered(name, (0.80, 0.80, 0.79), rough=0.88, rough_var=0.03,
                   bump=0.05, bump_scale=300, smudge=0.0, tint_random=0.0)


def steel_paint(name, color, rough=0.45, dust=0.15, scratch=0.04):
    return layered(name, color, rough=rough, metallic=0.0, color_var=0.03,
                   rough_var=0.08, bump=0.02, bump_scale=500, smudge=0.04,
                   dust=dust, scratch=scratch, spec=0.5)


def metal_deck(name="M_Metal_Deck_Painted"):
    return layered(name, C.CEILING_COLOR, rough=0.55, color_var=0.03,
                   rough_var=0.1, bump=0.01, dust=0.1, tint_random=0.0)


def galvanized(name="M_Metal_Galvanized"):
    nb, mat = _new(name)
    if nb is None:
        return mat
    co = nb.coord('Object')
    spang = nb.voronoi(co, scale=25.0, out='Color')
    sv = nb.out(nb.node('ShaderNodeRGBToBW', {'Color': spang}), 'Val')
    base = nb.mix(sv, (0.55, 0.56, 0.57), (0.72, 0.73, 0.74))
    r = nb.maprange(sv, 0, 1, 0.28, 0.48)
    p = nb.principled(base=base, rough=r, metallic=1.0)
    nb.output(nb.out(p, 'BSDF'))
    return _finish(mat, (0.65, 0.65, 0.66), 0.38, 1.0)


# ======================================================================
# Metals
# ======================================================================

def brushed_metal(name, color=(0.80, 0.80, 0.80), rough=0.28, direction='X',
                  smudge=0.06):
    """Brushed metal with stretched noise and anisotropy along `direction`."""
    nb, mat = _new(name)
    if nb is None:
        return mat
    co = nb.coord('Object')
    sc = {'X': (0.02, 1.0, 1.0), 'Y': (1.0, 0.02, 1.0), 'Z': (1.0, 1.0, 0.02)}[direction]
    sv = tuple(s * 1.0 for s in sc)
    lines = nb.noise(nb.mapping(co, scale=sv), scale=900.0, detail=2, rough=0.6)
    lines2 = nb.noise(nb.mapping(co, scale=sv), scale=200.0, detail=1)
    h = nb.math('ADD', lines, nb.math('MULTIPLY', lines2, 0.5))
    nrm = nb.bump(h, strength=0.06, distance=0.0005)
    r = nb.maprange(lines, 0.3, 0.7, rough - 0.06, rough + 0.06)
    sm = nb.noise(co, scale=5.0, detail=3, distortion=1.5)
    r = nb.math('ADD', r, nb.maprange(sm, 0.55, 0.8, 0.0, smudge), clamp=True)
    tone = nb.maprange(lines2, 0.2, 0.8, 0.94, 1.03)
    tone_c = nb.out(nb.node('ShaderNodeCombineXYZ', {'X': tone, 'Y': tone, 'Z': tone}), 'Vector')
    base = nb.mix(1.0, color, tone_c, blend='MULTIPLY')
    tangent = nb.node('ShaderNodeTangent', direction_type='RADIAL',
                      axis={'X': 'X', 'Y': 'Y', 'Z': 'Z'}[direction])
    p = nb.principled(base=base, metallic=1.0, rough=r, normal=nrm,
                      aniso=0.6, tangent=nb.out(tangent, 'Tangent'))
    nb.output(nb.out(p, 'BSDF'))
    return _finish(mat, color, rough, 1.0)


def polished_metal(name, color=(0.9, 0.9, 0.9), rough=0.06):
    return layered(name, color, rough=rough, metallic=1.0, color_var=0.0,
                   rough_var=0.03, bump=0.004, bump_scale=900, smudge=0.05,
                   tint_random=0.0)


# ======================================================================
# Woods
# ======================================================================

def wood(name, light=(0.48, 0.32, 0.18), dark=(0.26, 0.15, 0.07),
         rough=0.45, grain_scale=1.0, axis='X', coat=0.3, pores=True):
    """Procedural plain-sawn wood: distorted ring bands + fine fibre noise."""
    nb, mat = _new(name)
    if nb is None:
        return mat
    co = nb.coord('Object')
    rnd = nb.obj_random()
    off = nb.node('ShaderNodeCombineXYZ', {'X': nb.math('MULTIPLY', rnd, 13.0),
                                           'Y': nb.math('MULTIPLY', rnd, 7.0),
                                           'Z': nb.math('MULTIPLY', rnd, 3.0)})
    vm = nb.node('ShaderNodeVectorMath', operation='ADD')
    nb.link(co, vm.inputs[0])
    nb.link(nb.out(off, 'Vector'), vm.inputs[1])
    vec = vm.outputs[0]
    stretch = {'X': (0.08, 1.0, 1.0), 'Y': (1.0, 0.08, 1.0), 'Z': (1.0, 1.0, 0.08)}[axis]
    v2 = nb.mapping(vec, scale=tuple(s * grain_scale for s in stretch))
    rings = nb.wave(v2, scale=6.0, distortion=7.0, detail=3.0, dscale=1.2,
                    kind='RINGS', direction='SPHERICAL', profile='SAW')
    fib = nb.noise(nb.mapping(vec, scale=tuple(s * 1.0 for s in stretch)), scale=160.0,
                   detail=3, rough=0.6)
    g = nb.math('ADD', nb.math('MULTIPLY', rings, 0.75), nb.math('MULTIPLY', fib, 0.25))
    base = nb.ramp(g, [(0.0, light), (0.55, [0.5 * (a + b) for a, b in zip(light, dark)]),
                       (1.0, dark)])
    tone = nb.maprange(rnd, 0, 1, 0.88, 1.08)
    tone_c = nb.out(nb.node('ShaderNodeCombineXYZ', {'X': tone, 'Y': tone, 'Z': tone}), 'Vector')
    base = nb.mix(1.0, base, tone_c, blend='MULTIPLY')
    h = fib
    if pores:
        pore = nb.noise(nb.mapping(vec, scale=tuple(s for s in stretch)), scale=700.0, detail=1)
        h = nb.math('ADD', nb.math('MULTIPLY', fib, 0.6), nb.math('MULTIPLY', pore, 0.4))
    nrm = nb.bump(h, strength=0.12, distance=0.001)
    r = nb.maprange(fib, 0.3, 0.7, rough - 0.08, rough + 0.08)
    kw = dict(base=base, rough=r, normal=nrm, spec=0.5)
    if coat > 0:
        kw.update(coat=coat, coat_rough=0.12)
    p = nb.principled(**kw)
    nb.output(nb.out(p, 'BSDF'))
    return _finish(mat, light, rough)


def lvp_planks(name="M_LVP_Oak_Planks", light=(0.56, 0.43, 0.30), dark=(0.36, 0.25, 0.155),
               plank_w=0.18, plank_l=1.22):
    """Luxury vinyl plank, oak visual, planks running along world Y with
    staggered end joints, per-plank tone/grain offset and micro bevel seams."""
    nb, mat = _new(name)
    if nb is None:
        return mat
    pos = nb.geometry('Position')
    rot = nb.mapping(pos, rot=(0, 0, math.radians(90)))       # planks along Y
    brick = nb.node('ShaderNodeTexBrick', {'Vector': rot, 'Scale': 1.0, 'Mortar Size': 0.0012,
                                           'Mortar Smooth': 0.3, 'Bias': 0.0,
                                           'Brick Width': plank_l, 'Row Height': plank_w,
                                           'Color1': (0, 0, 0), 'Color2': (1, 1, 1),
                                           'Mortar': (0, 0, 0)},
                    offset=0.37, offset_frequency=1, squash=1.0, squash_frequency=1)
    seam = nb.out(brick, 'Fac')
    pr = nb.out(nb.node('ShaderNodeRGBToBW', {'Color': nb.out(brick, 'Color')}), 'Val')
    off = nb.node('ShaderNodeCombineXYZ', {'X': nb.math('MULTIPLY', pr, 17.0),
                                           'Y': nb.math('MULTIPLY', pr, 5.0), 'Z': 0.0})
    vm = nb.node('ShaderNodeVectorMath', operation='ADD')
    nb.link(pos, vm.inputs[0])
    nb.link(nb.out(off, 'Vector'), vm.inputs[1])
    v2 = nb.mapping(vm.outputs[0], scale=(1.0, 0.08, 1.0))
    rings = nb.wave(v2, scale=5.0, distortion=8.0, detail=3.0, dscale=1.0, kind='RINGS',
                    direction='SPHERICAL', profile='SAW')
    fib = nb.noise(nb.mapping(vm.outputs[0], scale=(1.0, 0.05, 1.0)), scale=140.0, detail=3)
    g = nb.math('ADD', nb.math('MULTIPLY', rings, 0.7), nb.math('MULTIPLY', fib, 0.3))
    base = nb.ramp(g, [(0.0, light), (0.6, [0.5 * (a + b) for a, b in zip(light, dark)]),
                       (1.0, dark)])
    tone = nb.maprange(pr, 0, 1, 0.82, 1.12)
    tone_c = nb.out(nb.node('ShaderNodeCombineXYZ', {'X': tone, 'Y': tone, 'Z': tone}), 'Vector')
    base = nb.mix(1.0, base, tone_c, blend='MULTIPLY')
    base = nb.mix(nb.math('MULTIPLY', nb.math('SUBTRACT', 1.0, seam), 0.55), base, (0.08, 0.06, 0.04))
    h = nb.math('ADD', nb.math('MULTIPLY', seam, 0.8), nb.math('MULTIPLY', fib, 0.2))
    nrm = nb.bump(h, strength=0.2, distance=0.0008)
    wear = nb.noise(pos, scale=2.0, detail=4, distortion=0.4)
    r = nb.maprange(wear, 0.3, 0.7, 0.45, 0.62)
    p = nb.principled(base=base, rough=r, normal=nrm, spec=0.45, coat=0.12, coat_rough=0.28)
    nb.output(nb.out(p, 'BSDF'))
    return _finish(mat, light, 0.4)


# ======================================================================
# Glass / transparent
# ======================================================================

def _shadow_transparent(nb, shader_socket, tint=(1, 1, 1)):
    """Thin-glass trick: shadow rays see a transparent BSDF, so light (sun,
    lamps) passes through glazing even with refractive caustics disabled."""
    lp = nb.node('ShaderNodeLightPath')
    tr = nb.node('ShaderNodeBsdfTransparent', {'Color': tint})
    mix = nb.node('ShaderNodeMixShader')
    nb.link(nb.out(lp, 'Is Shadow Ray'), mix.inputs[0])
    nb.link(shader_socket, mix.inputs[1])
    nb.link(nb.out(tr, 'BSDF'), mix.inputs[2])
    return mix.outputs[0]


def glass(name, color=(1, 1, 1), rough=0.0, ior=1.52, tint=1.0):
    nb, mat = _new(name)
    if nb is None:
        return mat
    co = nb.coord('Object')
    sm = nb.noise(co, scale=8.0, detail=3, distortion=1.5)
    r = nb.maprange(sm, 0.6, 0.8, rough, rough + 0.04)
    p = nb.principled(base=color, rough=r, ior=ior, trans=1.0)
    out = nb.out(p, 'BSDF')
    if rough < 0.2:
        out = _shadow_transparent(nb, out, tuple(min(1.0, c * 0.95) for c in color))
    nb.output(out)
    return _finish(mat, (0.7, 0.8, 0.85), 0.0)


def tinted_glass(name="M_Glass_Car_Tinted", tint=(0.12, 0.13, 0.13)):
    """Automotive glass: dark tint, strong reflection; thin-shell friendly."""
    nb, mat = _new(name)
    if nb is None:
        return mat
    p = nb.principled(base=tint, rough=0.0, ior=1.52, trans=0.35, metallic=0.0,
                      spec=1.0)
    nb.output(_shadow_transparent(nb, nb.out(p, 'BSDF'), (0.35, 0.36, 0.36)))
    return _finish(mat, tint, 0.0)


def frosted_glass(name="M_Glass_Frosted"):
    return glass(name, (0.95, 0.96, 0.97), rough=0.35)


# ======================================================================
# Car paint
# ======================================================================

def car_paint(name, color, metallic=0.6, flake_scale=4000.0, coat_rough=0.02):
    nb, mat = _new(name)
    if nb is None:
        return mat
    co = nb.coord('Object')
    flk = nb.voronoi(co, scale=flake_scale, out='Color')
    flk_n = nb.node('ShaderNodeVectorMath', operation='SUBTRACT')
    nb.link(flk, flk_n.inputs[0])
    flk_n.inputs[1].default_value = (0.5, 0.5, 0.5)
    geo_n = nb.geometry('Normal')
    vm = nb.node('ShaderNodeVectorMath', operation='SCALE')
    nb.link(flk_n.outputs[0], vm.inputs[0])
    _sock(vm.inputs, 'Scale').default_value = 0.35 * metallic
    add = nb.node('ShaderNodeVectorMath', operation='ADD')
    nb.link(geo_n, add.inputs[0])
    nb.link(vm.outputs[0], add.inputs[1])
    norm = nb.node('ShaderNodeVectorMath', operation='NORMALIZE')
    nb.link(add.outputs[0], norm.inputs[0])
    lw = nb.node('ShaderNodeLayerWeight', {'Blend': 0.35})
    facing = nb.out(lw, 'Facing')
    edge_col = [c * 0.55 for c in color]
    base = nb.mix(facing, color, edge_col)
    # subtle dust on the horizontal panels + swirl marks in the clear coat
    nz = nb.sepxyz(geo_n)[2]
    up = nb.maprange(nz, 0.75, 1.0, 0.0, 1.0)
    dn = nb.noise(co, scale=25.0, detail=6)
    dust = nb.math('MULTIPLY', up, nb.maprange(dn, 0.45, 0.85, 0.0, 0.05))
    base = nb.mix(dust, base, (0.4, 0.39, 0.37))
    swirl = nb.noise(co, scale=12.0, detail=3, distortion=4.0)
    cr = nb.maprange(swirl, 0.4, 0.8, coat_rough, coat_rough + 0.03)
    cr = nb.math('ADD', cr, nb.math('MULTIPLY', dust, 3.0), clamp=True)
    peel = nb.noise(co, scale=180.0, detail=2)
    coat_n = nb.bump(peel, strength=0.012, distance=0.001)
    p = nb.principled(base=base, metallic=metallic, rough=0.32 if metallic > 0.4 else 0.4,
                      normal=nb.out(norm, 'Vector'), coat=1.0, coat_rough=cr,
                      coat_normal=coat_n, spec=0.5)
    nb.output(nb.out(p, 'BSDF'))
    return _finish(mat, color, 0.1, metallic)


# ======================================================================
# Soft goods
# ======================================================================

def fabric(name, color, rough=0.85, weave_scale=900.0):
    nb, mat = _new(name)
    if nb is None:
        return mat
    co = nb.coord('Object')
    w1 = nb.wave(co, scale=weave_scale, kind='BANDS', direction='X', profile='SIN')
    w2 = nb.wave(co, scale=weave_scale, kind='BANDS', direction='Z', profile='SIN')
    h = nb.math('MULTIPLY', w1, w2)
    fuzz = nb.noise(co, scale=300.0, detail=6, rough=0.8)
    h = nb.math('ADD', nb.math('MULTIPLY', h, 0.6), nb.math('MULTIPLY', fuzz, 0.4))
    nrm = nb.bump(h, strength=0.25, distance=0.001)
    big = nb.noise(co, scale=3.0, detail=4)
    tone = nb.maprange(big, 0.3, 0.7, 0.9, 1.06)
    tone_c = nb.out(nb.node('ShaderNodeCombineXYZ', {'X': tone, 'Y': tone, 'Z': tone}), 'Vector')
    base = nb.mix(1.0, color, tone_c, blend='MULTIPLY')
    p = nb.principled(base=base, rough=rough, normal=nrm, sheen=0.6, spec=0.3)
    _sock(p.inputs, 'Sheen Roughness').default_value = 0.4
    nb.output(nb.out(p, 'BSDF'))
    return _finish(mat, color, rough)


def leather(name, color, rough=0.42):
    nb, mat = _new(name)
    if nb is None:
        return mat
    co = nb.coord('Object')
    peb = nb.voronoi(co, scale=420.0, out='Distance', feature='F1')
    peb2 = nb.voronoi(co, scale=420.0, out='Distance', feature='DISTANCE_TO_EDGE')
    h = nb.maprange(peb2, 0.0, 0.08, 0.0, 1.0)
    nrm = nb.bump(h, strength=0.2, distance=0.0008)
    wear = nb.noise(co, scale=4.0, detail=5, distortion=0.5)
    base = nb.mix(nb.maprange(wear, 0.55, 0.8, 0.0, 0.25), color, [min(1, c * 1.5) for c in color])
    r = nb.maprange(wear, 0.4, 0.8, rough, rough - 0.1)
    p = nb.principled(base=base, rough=r, normal=nrm, spec=0.45, coat=0.15,
                      coat_rough=0.3)
    nb.output(nb.out(p, 'BSDF'))
    return _finish(mat, color, rough)


def rubber(name="M_Rubber_Black", color=(0.018, 0.018, 0.018), rough=0.82,
           dust=0.2):
    return layered(name, color, rough=rough, color_var=0.06, rough_var=0.06,
                   bump=0.03, bump_scale=700, dust=dust, spec=0.35,
                   tint_random=0.0)


def tire(name="M_Rubber_Tire"):
    nb, mat = _new(name)
    if nb is None:
        return mat
    co = nb.coord('Object')
    n = nb.noise(co, scale=40.0, detail=6)
    base = nb.mix(nb.maprange(n, 0.3, 0.7, 0.0, 1.0), (0.012, 0.012, 0.012), (0.03, 0.029, 0.028))
    r = nb.maprange(n, 0.3, 0.7, 0.62, 0.86)
    nrm = nb.bump(nb.noise(co, scale=900.0, detail=2), strength=0.08, distance=0.001)
    p = nb.principled(base=base, rough=r, normal=nrm, spec=0.4)
    nb.output(nb.out(p, 'BSDF'))
    return _finish(mat, (0.02, 0.02, 0.02), 0.75)


def plastic(name, color, rough=0.45, bump=0.02):
    return layered(name, color, rough=rough, color_var=0.02, rough_var=0.06,
                   bump=bump, bump_scale=1200, smudge=0.05, spec=0.5,
                   tint_random=0.01)


def powder_coat(name, color, rough=0.38):
    """Fine-texture powder coat used on the steel garage cabinets."""
    nb, mat = _new(name)
    if nb is None:
        return mat
    co = nb.coord('Object')
    tex = nb.noise(co, scale=1500.0, detail=2, rough=0.5)
    nrm = nb.bump(tex, strength=0.05, distance=0.0005)
    big = nb.noise(co, scale=3.0, detail=3)
    rnd = nb.obj_random()
    tone = nb.math('MULTIPLY', nb.maprange(big, 0.3, 0.7, 0.96, 1.04),
                   nb.maprange(rnd, 0, 1, 0.97, 1.03))
    tone_c = nb.out(nb.node('ShaderNodeCombineXYZ', {'X': tone, 'Y': tone, 'Z': tone}), 'Vector')
    base = nb.mix(1.0, color, tone_c, blend='MULTIPLY')
    sm = nb.noise(co, scale=7.0, detail=3, distortion=2.0)
    fp = nb.voronoi(co, scale=60.0, out='Distance')
    fpm = nb.math('MULTIPLY', nb.maprange(fp, 0.0, 0.25, 0.08, 0.0),
                  nb.maprange(sm, 0.5, 0.7, 0.0, 1.0))
    r = nb.math('ADD', nb.maprange(big, 0.3, 0.7, rough - 0.04, rough + 0.04), fpm)
    p = nb.principled(base=base, rough=r, normal=nrm, spec=0.5, coat=0.25,
                      coat_rough=0.25)
    nb.output(nb.out(p, 'BSDF'))
    return _finish(mat, color, rough)


def quartz(name="M_Quartz_White", color=(0.80, 0.80, 0.79)):
    nb, mat = _new(name)
    if nb is None:
        return mat
    co = nb.coord('Object')
    speck = nb.voronoi(co, scale=500.0, out='Color')
    sv = nb.out(nb.node('ShaderNodeRGBToBW', {'Color': speck}), 'Val')
    vein = nb.wave(nb.mapping(co, scale=(1.0, 1.0, 1.0)), scale=1.2, distortion=12.0,
                   detail=6, kind='BANDS', direction='DIAGONAL', profile='SIN')
    veinm = nb.maprange(vein, 0.0, 0.08, 0.35, 0.0)
    base = nb.mix(nb.maprange(sv, 0.85, 0.95, 0.0, 0.5), color, (0.45, 0.45, 0.45))
    base = nb.mix(veinm, base, (0.55, 0.55, 0.56))
    sm = nb.noise(co, scale=6.0, detail=3, distortion=1.5)
    r = nb.maprange(sm, 0.5, 0.8, 0.06, 0.16)
    p = nb.principled(base=base, rough=r, spec=0.5, coat=0.5, coat_rough=0.04)
    nb.output(nb.out(p, 'BSDF'))
    return _finish(mat, color, 0.1)


def porcelain(name="M_Porcelain_White"):
    return layered(name, (0.86, 0.86, 0.85), rough=0.08, rough_var=0.02,
                   bump=0.0, smudge=0.02, coat=0.6, coat_rough=0.03,
                   tint_random=0.0)


def emission(name, color=(1, 1, 1), strength=5.0, kelvin=None):
    nb, mat = _new(name)
    if nb is None:
        return mat
    if kelvin:
        bb = nb.node('ShaderNodeBlackbody', {'Temperature': float(kelvin)})
        col = nb.out(bb, 'Color')
    else:
        col = color
    em = nb.node('ShaderNodeEmission', {'Color': col, 'Strength': strength})
    nb.output(nb.out(em, 'Emission'))
    return _finish(mat, color, 0.5)


def diffuser(name, kelvin=4000, strength=6.0):
    """Opal LED diffuser: emissive for camera, slight specular sheen."""
    nb, mat = _new(name)
    if nb is None:
        return mat
    bb = nb.node('ShaderNodeBlackbody', {'Temperature': float(kelvin)})
    em = nb.node('ShaderNodeEmission', {'Color': nb.out(bb, 'Color'), 'Strength': strength})
    p = nb.principled(base=(0.9, 0.9, 0.9), rough=0.3)
    add = nb.node('ShaderNodeAddShader')
    nb.link(nb.out(em, 'Emission'), add.inputs[0])
    nb.link(nb.out(p, 'BSDF'), add.inputs[1])
    nb.output(add.outputs[0])
    return _finish(mat, (1, 1, 1), 0.3)


def screen(name="M_TV_Screen", image=None, strength=1.6):
    """Glossy black panel; optional image content as low emission."""
    nb, mat = _new(name)
    if nb is None:
        return mat
    p = nb.principled(base=(0.005, 0.005, 0.006), rough=0.04, spec=0.5)
    if image is not None:
        uv = nb.coord('UV')
        tex = nb.node('ShaderNodeTexImage', {'Vector': uv}, image=image)
        em = nb.node('ShaderNodeEmission', {'Color': nb.out(tex, 'Color'), 'Strength': strength})
        add = nb.node('ShaderNodeAddShader')
        nb.link(nb.out(em, 'Emission'), add.inputs[0])
        nb.link(nb.out(p, 'BSDF'), add.inputs[1])
        nb.output(add.outputs[0])
    else:
        nb.output(nb.out(p, 'BSDF'))
    return _finish(mat, (0.01, 0.01, 0.01), 0.04)


def image_print(name, image, rough=0.55, gloss=False):
    """Printed poster/graphic: UV-mapped image on paper or satin."""
    nb, mat = _new(name)
    if nb is None:
        return mat
    uv = nb.coord('UV')
    tex = nb.node('ShaderNodeTexImage', {'Vector': uv}, image=image,
                  interpolation='Cubic')
    co = nb.coord('Object')
    paper = nb.noise(co, scale=600.0, detail=2)
    nrm = nb.bump(paper, strength=0.03, distance=0.0005)
    p = nb.principled(base=nb.out(tex, 'Color'), rough=0.12 if gloss else rough,
                      normal=nrm, spec=0.5)
    nb.output(nb.out(p, 'BSDF'))
    return _finish(mat, (0.5, 0.5, 0.5), rough)


def mirror(name="M_Mirror"):
    nb, mat = _new(name)
    if nb is None:
        return mat
    p = nb.principled(base=(0.92, 0.93, 0.94), metallic=1.0, rough=0.01)
    nb.output(nb.out(p, 'BSDF'))
    return _finish(mat, (0.9, 0.9, 0.9), 0.0, 1.0)


def liquid(name, color, ior=1.34):
    nb, mat = _new(name)
    if nb is None:
        return mat
    p = nb.principled(base=color, rough=0.02, ior=ior, trans=1.0)
    nb.output(_shadow_transparent(nb, nb.out(p, 'BSDF'), color))
    return _finish(mat, color, 0.0)


# ======================================================================
# Library
# ======================================================================

class Lib:
    """Lazily-instantiated named material palette used by all builders."""

    def __init__(self):
        k = C
        self.wall = wall_paint()
        self.wall_accent = wall_paint("M_Paint_Wall_Accent_Charcoal", (0.075, 0.078, 0.082))
        self.cmu = cmu_paint()
        self.ceiling = drywall_ceiling()
        self.concrete = concrete()
        self.concrete_smooth = concrete("M_Concrete_Smooth", (0.5, 0.49, 0.47), broom=False)
        self.floor = floor_flake()
        self.deck = metal_deck()
        self.steel_white = steel_paint("M_Steel_Painted_White", C.CEILING_COLOR, rough=0.5, dust=0.25)
        self.steel_black = steel_paint("M_Steel_Powdercoat_Black", (0.018, 0.018, 0.019), rough=0.42, dust=0.12)
        self.steel_red = steel_paint("M_Steel_Painted_Red_Sprinkler", (0.35, 0.02, 0.02), rough=0.45, dust=0.25)
        self.steel_grey = steel_paint("M_Steel_Painted_Grey", (0.25, 0.26, 0.27), rough=0.5)
        self.galv = galvanized()
        self.alu_brushed = brushed_metal("M_Metal_Aluminium_Brushed", (0.86, 0.87, 0.88), 0.3, 'X')
        self.alu_brushed_z = brushed_metal("M_Metal_Aluminium_Brushed_Vertical", (0.86, 0.87, 0.88), 0.3, 'Z')
        self.stainless = brushed_metal("M_Metal_Stainless_Brushed", (0.70, 0.70, 0.70), 0.27, 'X', smudge=0.035)
        self.stainless_y = brushed_metal("M_Metal_Stainless_Brushed_Y", (0.70, 0.70, 0.70), 0.27, 'Y', smudge=0.035)
        self.chrome = polished_metal("M_Metal_Chrome", (0.95, 0.95, 0.96), 0.03)
        self.steel_bare = layered("M_Metal_Steel_Machined", (0.55, 0.55, 0.56), rough=0.3, metallic=1.0, scratch=0.1)
        self.alu_cast = layered("M_Metal_Aluminium_Cast", (0.75, 0.75, 0.76), rough=0.4, metallic=1.0)
        self.brass = polished_metal("M_Metal_Brass", (0.80, 0.60, 0.30), 0.2)
        self.black_metal = layered("M_Metal_Black_Anodised", (0.02, 0.02, 0.022), rough=0.35, metallic=0.9)
        self.gunmetal = layered("M_Metal_Gunmetal_Wheel", (0.10, 0.10, 0.11), rough=0.28, metallic=1.0, coat=0.6, coat_rough=0.05)
        self.wheel_silver = layered("M_Metal_Wheel_Silver", (0.62, 0.63, 0.64), rough=0.22, metallic=1.0, coat=0.8, coat_rough=0.03)
        self.cab = powder_coat("M_Powdercoat_Cabinet_Graphite", C.CAB_COLOR, 0.36)
        self.cab_carcass = powder_coat("M_Powdercoat_Cabinet_Carcass", (0.025, 0.026, 0.028), 0.45)
        self.oak = wood("M_Wood_White_Oak", (0.50, 0.36, 0.22), (0.30, 0.19, 0.10), 0.42)
        self.oak_y = wood("M_Wood_White_Oak_Y", (0.50, 0.36, 0.22), (0.30, 0.19, 0.10), 0.42, axis='Y')
        self.oak_z = wood("M_Wood_White_Oak_Z", (0.50, 0.36, 0.22), (0.30, 0.19, 0.10), 0.42, axis='Z')
        self.walnut = wood("M_Wood_Walnut", (0.20, 0.11, 0.06), (0.08, 0.04, 0.02), 0.38)
        self.walnut_y = wood("M_Wood_Walnut_Y", (0.20, 0.11, 0.06), (0.08, 0.04, 0.02), 0.38, axis='Y')
        self.maple_block = wood("M_Wood_Maple_ButcherBlock", (0.62, 0.45, 0.28), (0.45, 0.30, 0.16), 0.5, coat=0.1)
        self.lvp = lvp_planks()
        self.ply = wood("M_Wood_Plywood_Raw", (0.62, 0.48, 0.32), (0.48, 0.35, 0.22), 0.7, coat=0.0)
        self.glass = glass("M_Glass_Clear")
        self.glass_door = glass("M_Glass_Door_Lite", (0.95, 0.97, 0.97), 0.0)
        self.glass_frosted = frosted_glass()
        self.glass_car = tinted_glass()
        self.glass_lens = glass("M_Glass_Lamp_Lens", (1, 1, 1), 0.02)
        self.glass_bottle_green = liquid("M_Glass_Bottle_Green", (0.12, 0.30, 0.10), 1.5)
        self.glass_bottle_amber = liquid("M_Glass_Bottle_Amber", (0.45, 0.20, 0.04), 1.5)
        self.glass_bottle_clear = liquid("M_Glass_Bottle_Clear", (0.92, 0.95, 0.95), 1.5)
        self.tire = tire()
        self.rubber = rubber()
        self.rubber_mat = rubber("M_Rubber_Mat_Ribbed", (0.03, 0.03, 0.03), 0.7, dust=0.3)
        self.plastic_black = plastic("M_Plastic_Black_Satin", (0.022, 0.022, 0.024), 0.45)
        self.plastic_black_gloss = plastic("M_Plastic_Black_Gloss", (0.01, 0.01, 0.011), 0.08, bump=0.0)
        self.plastic_white = plastic("M_Plastic_White", (0.78, 0.78, 0.76), 0.35)
        self.plastic_grey = plastic("M_Plastic_Grey", (0.25, 0.25, 0.26), 0.45)
        self.plastic_red = plastic("M_Plastic_Red", (0.45, 0.02, 0.02), 0.35)
        self.plastic_yellow = plastic("M_Plastic_Yellow", (0.75, 0.48, 0.02), 0.4)
        self.plastic_blue = plastic("M_Plastic_Blue", (0.02, 0.08, 0.35), 0.4)
        self.plastic_orange = plastic("M_Plastic_Orange", (0.8, 0.22, 0.02), 0.4)
        self.taillight = glass("M_Glass_Taillight_Red", (0.7, 0.02, 0.02), 0.02)
        self.indicator = glass("M_Glass_Indicator_Amber", (0.9, 0.4, 0.02), 0.02)
        self.fabric_sofa = fabric("M_Fabric_Sofa_Charcoal", (0.075, 0.075, 0.078))
        self.fabric_cushion = fabric("M_Fabric_Cushion_Oatmeal", (0.42, 0.38, 0.32))
        self.fabric_rug = fabric("M_Fabric_Rug_Grey", (0.16, 0.16, 0.17), 0.95, 400)
        self.fabric_towel = fabric("M_Fabric_Microfiber_Blue", (0.03, 0.12, 0.35), 0.95, 1500)
        self.leather_brown = leather("M_Leather_Cognac", (0.20, 0.075, 0.025))
        self.leather_black = leather("M_Leather_Black", (0.018, 0.017, 0.017), 0.38)
        self.porcelain = porcelain()
        self.quartz = quartz()
        self.mirror = mirror()
        self.screen = screen()
        self.led_bay = diffuser("M_LED_Diffuser_5000K", C.LIGHT_BAY_K, 9.0)
        self.led_warm = diffuser("M_LED_Diffuser_3000K", C.LIGHT_LOUNGE_K, 9.0)
        self.led_strip = diffuser("M_LED_Strip_4000K", C.LIGHT_UNDERCAB_K, 12.0)
        self.bulb = emission("M_Bulb_Filament_2700K", strength=30.0, kelvin=2200)
        self.neon_red = emission("M_Neon_Red", (1.0, 0.06, 0.03), 18.0)
        self.neon_white = emission("M_Neon_White", strength=14.0, kelvin=4500)
        self.label_white = layered("M_Label_Paper_White", (0.75, 0.75, 0.73), rough=0.6)
        self.cardboard = layered("M_Cardboard", (0.35, 0.24, 0.13), rough=0.85, bump=0.05)
        self.drywall_edge = self.wall
        self.felt = fabric("M_Felt_Black", (0.015, 0.015, 0.015), 0.95, 2000)
        self.paper = layered("M_Paper_Matte", (0.7, 0.7, 0.68), rough=0.7)
        self.water = liquid("M_Water", (0.9, 0.95, 1.0), 1.33)
        self.soil = layered("M_Soil", (0.05, 0.035, 0.025), rough=0.95, bump=0.3, bump_scale=200)
        self.leaf = layered("M_Plant_Leaf", (0.03, 0.10, 0.025), rough=0.5, color_var=0.15, sheen=0.3)
        self.ceramic_black = layered("M_Ceramic_Planter_Black", (0.03, 0.03, 0.03), rough=0.35, coat=0.4)
        self.stucco = concrete("M_Stucco_Exterior", (0.62, 0.60, 0.56), broom=False)
        self.asphalt = layered("M_Asphalt", (0.05, 0.05, 0.05), rough=0.9, bump=0.4, bump_scale=300, color_var=0.15)
        self.grass = layered("M_Grass", (0.04, 0.09, 0.02), rough=0.9, bump=0.5, bump_scale=150, color_var=0.25)
        self.weatherstrip = rubber("M_Rubber_Weatherstrip", (0.015, 0.015, 0.015), 0.6, dust=0.0)
        self.ohd_panel = layered("M_Steel_OHD_Panel_White", (0.80, 0.80, 0.78), rough=0.35, smudge=0.05, scratch=0.04, dust=0.1)
        self.door_steel = layered("M_Steel_Door_Painted", (0.70, 0.70, 0.68), rough=0.35, smudge=0.06)
        self.red_paint = layered("M_Paint_Gloss_Red", (0.45, 0.015, 0.015), rough=0.15, coat=0.4)
        self.tool_red = layered("M_Paint_ToolChest_Red", (0.38, 0.012, 0.012), rough=0.22, coat=0.8, coat_rough=0.04, smudge=0.05)
        self.chrome_tool = polished_metal("M_Metal_Chrome_Tool", (0.85, 0.85, 0.86), 0.1)
        self.carbon = layered("M_Carbon_Fibre", (0.02, 0.02, 0.022), rough=0.15, coat=1.0, coat_rough=0.02)
        self.brake_red = layered("M_Brake_Caliper_Red", (0.5, 0.02, 0.015), rough=0.3, coat=0.5)
        self.brake_yellow = layered("M_Brake_Caliper_Yellow", (0.75, 0.48, 0.02), rough=0.3, coat=0.5)
        self.brake_disc = layered("M_Brake_Disc_Iron", (0.22, 0.21, 0.20), rough=0.45, metallic=1.0, scratch=0.15)
