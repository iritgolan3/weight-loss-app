"""Render settings, world, final scene clean-up and camera batch rendering."""

import math
import os
import time
import bpy
from . import config as C
from .core import collection


def setup(args=None):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    cy = scene.cycles
    cy.device = 'CPU'
    cy.samples = (args.samples if args and args.samples else C.RENDER_SAMPLES)
    cy.preview_samples = 64
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.015
    cy.use_denoising = True
    try:
        cy.denoiser = 'OPENIMAGEDENOISE'
        cy.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
        cy.denoising_prefilter = 'ACCURATE'
    except TypeError:
        pass
    cy.max_bounces = 10
    cy.diffuse_bounces = 4
    cy.glossy_bounces = 4
    cy.transmission_bounces = 8
    cy.transparent_max_bounces = 8
    cy.sample_clamp_direct = 0.0
    cy.sample_clamp_indirect = 6.0
    cy.blur_glossy = 0.5
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    cy.use_light_tree = True
    cy.light_sampling_threshold = 0.01
    if args and args.res:
        w, h = (int(v) for v in args.res.lower().split("x"))
    else:
        w, h = C.RENDER_W, C.RENDER_H
    scene.render.resolution_x = w
    scene.render.resolution_y = h
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.use_persistent_data = True
    vs = scene.view_settings
    vs.view_transform = 'AgX'
    for look in ('AgX - Medium High Contrast', 'Medium High Contrast', 'AgX - Base Contrast'):
        try:
            vs.look = look
            break
        except TypeError:
            continue
    vs.exposure = 0.0
    vs.gamma = 1.0
    scene.display_settings.display_device = 'sRGB'
    _world(scene)


def _world(scene):
    world = bpy.data.worlds.get("World_Daylight") or bpy.data.worlds.new("World_Daylight")
    scene.world = world
    nt = world.node_tree
    nt.nodes.clear()
    sky = nt.nodes.new('ShaderNodeTexSky')
    try:
        sky.sky_type = 'MULTIPLE_SCATTERING'
    except TypeError:
        pass
    for attr, val in (("sun_disc", False), ("sun_elevation", math.radians(C.SUN_ELEVATION_DEG)),
                      ("sun_rotation", math.radians(C.SUN_ROTATION_DEG)), ("altitude", 10.0),
                      ("air_density", 1.0), ("aerosol_density", 1.2), ("ozone_density", 1.0)):
        if hasattr(sky, attr):
            setattr(sky, attr, val)
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = 0.35
    out = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(sky.outputs[0], bg.inputs[0])
    nt.links.new(bg.outputs[0], out.inputs[0])
    world.cycles_visibility.diffuse = True


def finalize():
    """Scene hygiene: hide reference helpers from render, purge orphans."""
    ref = bpy.data.collections.get("REFERENCE")
    if ref:
        ref.hide_render = True
    # drop empty collections
    for col in list(bpy.data.collections):
        if not col.objects and not col.children:
            bpy.data.collections.remove(col)
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)


def render_cameras(args):
    scene = bpy.context.scene
    os.makedirs(args.renders, exist_ok=True)
    cams = [o for o in bpy.data.objects if o.type == 'CAMERA']
    want = args.render.split(",") if args.render != "all" else [c.name for c in cams]
    fmt = args.fmt.upper()
    scene.render.image_settings.file_format = fmt
    if fmt == 'JPEG':
        scene.render.image_settings.quality = 92
    ext = {'JPEG': 'jpg', 'PNG': 'png'}.get(fmt, 'png')
    for name in want:
        cam = bpy.data.objects.get(name.strip())
        if cam is None:
            print(f"[bullpen] camera {name} not found")
            continue
        scene.camera = cam
        exp = cam.get("exposure")
        if exp is not None:
            scene.view_settings.exposure = float(exp)
        scene.render.filepath = os.path.join(args.renders, f"{cam.name}.{ext}")
        t = time.time()
        bpy.ops.render.render(write_still=True)
        print(f"[bullpen] rendered {cam.name} in {time.time() - t:.0f}s -> {scene.render.filepath}")
