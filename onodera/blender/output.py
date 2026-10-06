"""Cameras, render settings and exports."""
import math
import bpy
from mathutils import Vector
from helpers import collection


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.unit_settings.system = 'METRIC'
    return s


def render_settings(s, samples=192, res=(1600, 900)):
    s.render.engine = 'CYCLES'
    s.cycles.device = 'CPU'
    s.cycles.samples = samples
    s.cycles.use_adaptive_sampling = True
    s.cycles.adaptive_threshold = 0.02
    s.cycles.use_denoising = True
    s.cycles.denoiser = 'OPENIMAGEDENOISE'
    s.cycles.max_bounces = 8
    s.cycles.diffuse_bounces = 4
    s.cycles.glossy_bounces = 4
    s.cycles.transmission_bounces = 6
    s.cycles.caustics_reflective = False
    s.cycles.caustics_refractive = False
    s.cycles.blur_glossy = 1.0
    s.cycles.sample_clamp_indirect = 8.0
    s.render.resolution_x, s.render.resolution_y = res
    s.render.resolution_percentage = 100
    s.render.image_settings.file_format = 'PNG'
    s.view_settings.view_transform = 'AgX'
    s.view_settings.look = 'AgX - Medium High Contrast'
    s.render.threads_mode = 'AUTO'


def world(s, color=(0.02, 0.02, 0.025), strength=1.0):
    w = bpy.data.worlds.new('World')
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (*color, 1)
    bg.inputs['Strength'].default_value = strength
    s.world = w


def camera(name, loc, look_at, lens=24, coll='Cameras'):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.clip_start = 0.05
    cd.clip_end = 200
    ob = bpy.data.objects.new(name, cd)
    collection(coll).objects.link(ob)
    ob.location = loc
    d = Vector(look_at) - Vector(loc)
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return ob


def render(s, cam, path, exposure=0.0, hide=()):
    s.camera = cam
    s.view_settings.exposure = exposure
    hidden = [bpy.data.collections[n] for n in hide if n in bpy.data.collections]
    for c in hidden:
        c.hide_render = True
    s.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for c in hidden:
        c.hide_render = False


def export_glb(path):
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_lights=False,
        export_cameras=False,
        export_yup=True,
        export_image_format='JPEG',
        export_image_quality=82,
    )


_saved = {}


def daylight(s, on):
    """Swap the dim interior world for a Nishita sky + sun (street views)."""
    if on:
        _saved['world'] = s.world
        w = bpy.data.worlds.new('Sky')
        w.use_nodes = True
        nt = w.node_tree
        sky = nt.nodes.new('ShaderNodeTexSky')
        for attr, val in (('sky_type', 'NISHITA'), ('sun_elevation', math.radians(38)), ('sun_rotation', math.radians(200)),
                          ('altitude', 30.0), ('air_density', 1.2), ('dust_density', 1.5)):
            if hasattr(sky, attr):
                try:
                    setattr(sky, attr, val)
                except TypeError:
                    pass
        bg = nt.nodes['Background']
        bg.inputs['Strength'].default_value = 0.25
        nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
        s.world = w
        ld = bpy.data.lights.new('Sun', 'SUN')
        ld.energy = 3.5
        ld.angle = math.radians(1.0)
        ob = bpy.data.objects.new('Sun', ld)
        ob.rotation_euler = (math.radians(52), 0, math.radians(200 - 90))
        bpy.context.scene.collection.objects.link(ob)
        _saved['sun'] = ob
    else:
        s.world = _saved.pop('world')
        bpy.data.objects.remove(_saved.pop('sun'))
