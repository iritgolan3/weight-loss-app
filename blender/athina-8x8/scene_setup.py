# -*- coding: utf-8 -*-
"""White-cyclorama studio set, cameras and Cycles render settings."""
import bpy, math, os
from math import radians
from mathutils import Vector, Euler
from lib_build import MB, MATS


def build_studio():
    """Seamless white cove backdrop, matching the reference product photography."""
    white = bpy.data.materials.new("Backdrop")
    white.use_nodes = True
    n = white.node_tree.nodes["Principled BSDF"]
    # the cove is self-lit, exactly like a lit backdrop in a real studio: it
    # renders clean white AND acts as the huge soft source the black body needs
    n.inputs["Base Color"].default_value = (0.55, 0.55, 0.555, 1.0)
    n.inputs["Roughness"].default_value = 0.62
    n.inputs["Emission Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    n.inputs["Emission Strength"].default_value = 0.80
    if "Specular IOR Level" in n.inputs:
        n.inputs["Specular IOR Level"].default_value = 0.10

    b = MB()
    prof = [(0.002, 0.0), (8.0, 0.0), (16.0, 0.0), (23.0, 0.05),
            (27.0, 1.10), (30.0, 3.60), (31.6, 8.0), (32.0, 16.0), (32.0, 34.0)]
    b.revolve(prof, segments=64, mat=0, axis='Z', closed=False)
    cyc = b.finish("Backdrop", recalc=False, smooth_angle=45)
    cyc.data.materials.clear()
    cyc.data.materials.append(white)
    for p in cyc.data.polygons:
        p.material_index = 0
    cyc.visible_shadow = True

    # world: soft neutral fill so the matte black keeps its form
    w = bpy.data.worlds.new("World")
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.08, 0.082, 0.088, 1.0)
    bg.inputs[1].default_value = 1.0
    bpy.context.scene.world = w
    return cyc


def _area(name, loc, target, size, power, shape='SQUARE', size_y=None):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.shape = shape
    ld.size = size
    if size_y is not None:
        ld.size_y = size_y
    ld.energy = power
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    bpy.context.collection.objects.link(ob)
    return ob


def build_lights():
    L = []
    # broad overhead softbox -- the main shaper
    L.append(_area("Key_Top", (1.5, 3.0, 13.0), (0.0, 0.0, 2.0),
                   size=14.0, size_y=9.0, shape='RECTANGLE', power=1050))
    # three-quarter key from the front left
    L.append(_area("Key_FL", (11.0, 9.5, 7.5), (1.0, 0.0, 2.1),
                   size=9.0, power=360))
    # fill from the front right
    L.append(_area("Fill_FR", (10.0, -9.0, 5.0), (0.5, 0.0, 2.0),
                   size=10.0, power=310))
    # rear kicker to separate the black body from the white ground
    L.append(_area("Rim_Back", (-12.0, 6.0, 6.5), (-2.5, 0.0, 2.4),
                   size=8.0, power=390))
    L.append(_area("Rim_Back2", (-11.0, -7.0, 6.0), (-2.5, 0.0, 2.2),
                   size=8.0, power=230))
    # head-on fill so the front view reads
    L.append(_area("Fill_Front", (16.0, 0.0, 3.4), (4.0, 0.0, 2.0),
                   size=9.0, power=360))
    # low bounce to lift the underside / tires
    L.append(_area("Bounce_Low", (9.0, 0.0, 0.6), (0.0, 0.0, 1.0),
                   size=12.0, power=120))
    # floor wash so the cyclorama reads pure white
    L.append(_area("Cyc_Wash", (0.0, 0.0, 16.0), (0.0, 0.0, 0.0),
                   size=34.0, power=2600))
    return L


def _cam(name, loc, target, lens=70.0, ortho=None, shift=(0.0, 0.0)):
    cd = bpy.data.cameras.new(name)
    if ortho is not None:
        cd.type = 'ORTHO'
        cd.ortho_scale = ortho
    else:
        cd.lens = lens
    cd.shift_x, cd.shift_y = shift
    cd.clip_end = 500.0
    ob = bpy.data.objects.new(name, cd)
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    bpy.context.collection.objects.link(ob)
    return ob


def build_cameras():
    cams = {}
    # orthographic left-side elevation -- same framing as reference photo 1
    c = _cam("CAM_side", (0.0, 24.0, 2.30), (0.0, 0.0, 2.30), ortho=11.6)
    c.rotation_euler = Euler((radians(90), 0.0, radians(180)), 'XYZ')
    cams["side"] = (c, 1800, 720)

    # orthographic front elevation -- same framing as reference photo 2
    c = _cam("CAM_front", (24.0, 0.0, 1.98), (0.0, 0.0, 1.98), ortho=5.2)
    c.rotation_euler = Euler((radians(90), 0.0, radians(90)), 'XYZ')
    cams["front"] = (c, 1500, 1150)

    # perspective hero shots
    cams["hero"] = (_cam("CAM_hero", (19.0, 15.0, 6.6), (-0.30, 0.0, 2.00), lens=78.0), 1700, 1100)
    cams["rear"] = (_cam("CAM_rear", (-17.5, 13.5, 6.0), (0.35, 0.0, 1.95), lens=80.0), 1600, 1050)
    cams["low"]  = (_cam("CAM_low",  (15.5, 8.5, 1.45), (-1.2, 0.0, 2.30), lens=58.0), 1600, 1000)
    return cams


def setup_render(samples=128, view_transform="Standard", exposure=0.0, threads=0):
    try:
        bpy.ops.preferences.addon_enable(module="cycles")
    except Exception:
        pass
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.012
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    sc.cycles.max_bounces = 8
    sc.cycles.diffuse_bounces = 3
    sc.cycles.glossy_bounces = 4
    sc.cycles.transmission_bounces = 8
    sc.cycles.transparent_max_bounces = 8
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.cycles.use_fast_gi = True
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.render.image_settings.compression = 20
    if threads:
        sc.render.threads_mode = 'FIXED'
        sc.render.threads = threads
    try:
        sc.display_settings.display_device = 'sRGB'
        sc.view_settings.view_transform = view_transform
        sc.view_settings.exposure = exposure
        sc.view_settings.look = 'None'
    except Exception as e:
        print("colour management:", e)
    return sc


def render_view(cams, key, outdir, scale=1.0, tag=""):
    sc = bpy.context.scene
    cam, rx, ry = cams[key]
    sc.camera = cam
    sc.render.resolution_x = int(rx * scale)
    sc.render.resolution_y = int(ry * scale)
    sc.render.resolution_percentage = 100
    path = os.path.join(outdir, "%s%s.png" % (key, tag))
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path
