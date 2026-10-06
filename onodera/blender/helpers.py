"""Small modelling helpers: boxes, cylinders, materials and world-space box UVs."""
import math
import bmesh
import bpy
from mathutils import Vector

COLL = {}


def collection(name):
    if name not in COLL:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
        COLL[name] = c
    return COLL[name]


def _link(obj, coll):
    collection(coll).objects.link(obj)
    return obj


def box_uv(bm, tile=1.0, offset=(0.0, 0.0, 0.0), rot_grain=False):
    """World-ish box projection so textures keep a constant real-world scale."""
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            co = l.vert.co + Vector(offset)
            if ax == 0:
                u, v = co.y, co.z
            elif ax == 1:
                u, v = co.x, co.z
            else:
                u, v = co.x, co.y
                if rot_grain:
                    u, v = co.y, co.x
            l[uv].uv = (u / tile, v / tile)


def mesh_obj(name, bm, mat=None, coll='Interior', tile=1.0, smooth=False,
             rot_grain=False, uv=True):
    if uv:
        box_uv(bm, tile, rot_grain=rot_grain)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    if mat:
        if isinstance(mat, (list, tuple)):
            for m in mat:
                me.materials.append(m)
        else:
            me.materials.append(mat)
    return _link(ob, coll)


def box(name, size, loc, mat=None, coll='Interior', tile=1.0, bevel=0.0,
        rot=(0, 0, 0), rot_grain=False, segments=2):
    """Axis-aligned box; size=(sx,sy,sz), loc = centre."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=bm.edges[:] + bm.verts[:], offset=bevel,
                        segments=segments, profile=0.5, affect='EDGES')
    bmesh.ops.translate(bm, vec=Vector(loc), verts=bm.verts)
    bm.normal_update()
    ob = mesh_obj(name, bm, mat, coll, tile, rot_grain=rot_grain)
    if any(rot):
        # rotate about its own centre
        ob.data.transform(__import__('mathutils').Matrix.Translation(-Vector(loc)))
        ob.location = loc
        ob.rotation_euler = rot
    if bevel > 0:
        for p in ob.data.polygons:
            p.use_smooth = False
    return ob


def cylinder(name, r, depth, loc, mat=None, coll='Interior', seg=32,
             r2=None, tile=1.0, smooth=True, cap=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=seg,
                          radius1=r, radius2=r if r2 is None else r2, depth=depth)
    bmesh.ops.translate(bm, vec=Vector(loc), verts=bm.verts)
    bm.normal_update()
    ob = mesh_obj(name, bm, mat, coll, tile)
    if smooth:
        for p in ob.data.polygons:
            if abs(p.normal.z) < 0.9:
                p.use_smooth = True
    return ob


def lathe(name, profile, loc, mat=None, coll='Interior', seg=48, tile=0.3):
    """Revolve a (radius, z) profile around Z – used for bowls, cups, vases."""
    bm = bmesh.new()
    rings = []
    for (r, z) in profile:
        ring = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            ring.append(bm.verts.new((loc[0] + r * math.cos(a), loc[1] + r * math.sin(a), loc[2] + z)))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for i in range(seg):
            j = (i + 1) % seg
            a, b, c, d = rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]
            if a.co == b.co and d.co == c.co:
                continue
            verts = [a, b, c, d]
            if a.co == d.co:
                verts = [a, b, c]
            elif b.co == c.co:
                verts = [a, b, d]
            try:
                bm.faces.new(verts)
            except ValueError:
                pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    ob = mesh_obj(name, bm, mat, coll, tile, smooth=True)
    return ob


# ---------------------------------------------------------------- materials
def _bsdf(m):
    return m.node_tree.nodes.get('Principled BSDF')


def material(name, color=(0.8, 0.8, 0.8), rough=0.5, metal=0.0, image=None,
             emission=None, strength=0.0, alpha=1.0, transmission=0.0,
             ior=1.45, coat=0.0, specular=0.5, normal_img=None, bump=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = _bsdf(m)
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['IOR'].default_value = ior
    if 'Specular IOR Level' in b.inputs:
        b.inputs['Specular IOR Level'].default_value = specular
    if coat:
        b.inputs['Coat Weight'].default_value = coat
        b.inputs['Coat Roughness'].default_value = 0.08
    if transmission:
        b.inputs['Transmission Weight'].default_value = transmission
    if image is not None:
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = image
        tex.location = (-400, 200)
        nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
        if bump:
            bmp = nt.nodes.new('ShaderNodeBump')
            bmp.inputs['Strength'].default_value = bump
            bmp.inputs['Distance'].default_value = 0.002
            bmp.location = (-200, -300)
            nt.links.new(tex.outputs['Color'], bmp.inputs['Height'])
            nt.links.new(bmp.outputs['Normal'], b.inputs['Normal'])
    if emission is not None:
        b.inputs['Emission Color'].default_value = (*emission, 1)
        b.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED' if hasattr(m, 'surface_render_method') else None
    return m


def kelvin(k):
    """Approximate RGB for a colour temperature (Tanner Helland)."""
    t = k / 100.0
    r = 255 if t <= 66 else 329.698727446 * ((t - 60) ** -0.1332047592)
    g = 99.4708025861 * math.log(t) - 161.1195681661 if t <= 66 else 288.1221695283 * ((t - 60) ** -0.0755148492)
    b = 255 if t >= 66 else (0 if t <= 19 else 138.5177312231 * math.log(t - 10) - 305.0447927307)
    c = [max(0, min(255, x)) / 255.0 for x in (r, g, b)]
    return tuple(c)


def spot(name, loc, energy, size_deg=60, blend=0.6, k=3000, radius=0.03,
         rot=(0, 0, 0), coll='Lights'):
    ld = bpy.data.lights.new(name, 'SPOT')
    ld.energy = energy
    ld.spot_size = math.radians(size_deg)
    ld.spot_blend = blend
    ld.color = kelvin(k)
    ld.shadow_soft_size = radius
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    ob.rotation_euler = rot
    return _link(ob, coll)


def area(name, loc, energy, size=(1, 1), k=3000, rot=(0, 0, 0), coll='Lights',
         shape='RECTANGLE', spread=180):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.energy = energy
    ld.shape = shape
    ld.size = size[0]
    ld.size_y = size[1]
    ld.color = kelvin(k)
    ld.spread = math.radians(spread)
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    ob.rotation_euler = rot
    return _link(ob, coll)


def point(name, loc, energy, k=2700, radius=0.05, coll='Lights'):
    ld = bpy.data.lights.new(name, 'POINT')
    ld.energy = energy
    ld.color = kelvin(k)
    ld.shadow_soft_size = radius
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    return _link(ob, coll)


def lattice(name, plane, c, r0, r1, n0, n1, t=0.015, d=0.03, mat=None, coll='Interior', tile=0.5,
            border=True):
    """Kumiko-style grid of square bars in an axis plane.
    plane 'x': YZ plane at x=c, r0=(y0,y1) with n0 cells, r1=(z0,z1) with n1 cells.
    plane 'y': XZ plane at y=c, r0=(x0,x1), r1=(z0,z1).
    plane 'z': XY plane at z=c, r0=(x0,x1), r1=(y0,y1)."""
    from mathutils import Matrix
    bm = bmesh.new()
    a0, a1 = r0
    b0, b1 = r1

    def put(p, sc):
        if plane == 'x':
            loc, s = (c, p[0], p[1]), (d, sc[0], sc[1])
        elif plane == 'y':
            loc, s = (p[0], c, p[1]), (sc[0], d, sc[1])
        else:
            loc, s = (p[0], p[1], c), (sc[0], sc[1], d)
        bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.LocRotScale(Vector(loc), None, Vector(s)))

    rng0 = range(0, n0 + 1) if border else range(1, n0)
    rng1 = range(0, n1 + 1) if border else range(1, n1)
    for i in rng0:
        put((a0 + (a1 - a0) * i / n0, (b0 + b1) / 2), (t, b1 - b0))
    for j in rng1:
        put(((a0 + a1) / 2, b0 + (b1 - b0) * j / n1), (a1 - a0, t))
    bm.normal_update()
    return mesh_obj(name, bm, mat, coll, tile)


def bars(name, items, mat, coll='Interior', tile=0.5):
    """Many boxes as ONE mesh: items = [(center, size), ...]."""
    from mathutils import Matrix
    bm = bmesh.new()
    for (loc, size) in items:
        bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.LocRotScale(Vector(loc), None, Vector(size)))
    bm.normal_update()
    return mesh_obj(name, bm, mat, coll, tile)
