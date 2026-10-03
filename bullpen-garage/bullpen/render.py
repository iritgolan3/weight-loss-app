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


ORGANIZE = [
    ("ARCHITECTURE", "Floor_Slab_And_Cove", ("Floor_",)),
    ("ARCHITECTURE", "Walls", ("Wall_", "OHD_Jamb", "ManDoor_Threshold")),
    ("ARCHITECTURE", "Garage_Door_Hardware", ("Garage_Door_Track", "Garage_Door_Torsion", "Garage_Door_Cable_Drum",
                                              "Garage_Door_End_Bearing", "Garage_Door_Center_Bracket",
                                              "Garage_Door_Lift_Cable", "Garage_Door_PhotoEye", "Opener_")),
    ("ARCHITECTURE", "Bathroom_Fixtures", ("Bathroom_WC", "Bathroom_Vanity", "Bathroom_Mirror")),
    ("ARCHITECTURE", "Exterior_Context", ("Exterior_",)),
    ("STRUCTURE", "Roof_Deck_And_Bridging", ("Roof_Metal_Deck", "Roof_Insulation", "Roof_Bearing", "Roof_Joist_Bridging")),
    ("STRUCTURE", "Sprinkler_System", ("Sprinkler_",)),
    ("STRUCTURE", "Mezzanine_Framing", ("Mezzanine_Joist", "Mezzanine_Ledger", "Mezzanine_Girder")),
    ("MEZZANINE", "Mezzanine_Deck", ("Mezzanine_Subfloor", "Mezzanine_Floor", "Mezzanine_Fascia", "Mezzanine_Edge",
                                     "Mezzanine_Soffit", "Mezzanine_Wall_Base")),
    ("DETAILS", "Electrical_Devices", ("Receptacle_", "Switch_", "RV_", "Electrical_", "Alarm_", "Garage_Door_Wall")),
    ("DETAILS", "Safety_Devices", ("Fire_", "Smoke_", "Security_", "WiFi_")),
    ("DETAILS", "Wheel_Stops", ("Wheel_Stop_",)),
    ("DECOR", "Wall_Art", ("Poster_", "Sign_Speed", "Stair_Gallery", "Mezzanine_Print", "Mezzanine_Blueprint",
                           "Bath_Wall_Print")),
    ("LIGHTING", "Lights_Bay", ("Light_Bay_",)),
    ("LIGHTING", "Lights_Mezzanine", ("Light_Mezzanine_",)),
    ("LIGHTING", "Lights_Lounge", ("Light_Lounge_", "Light_Bathroom", "Light_Bar_", "Light_TV", "Light_Sign")),
    ("LIGHTING", "Lights_Stair", ("Light_Stair_",)),
    ("LIGHTING", "Lights_UnderCabinet", ("Cabinet_Upper_", "Bar_Shelf_LED")),
    ("CABINETS", "Cabinet_Run_Right_Wall", ("Cabinet_0", "Cabinet_1", "Workbench_", "Slatwall_")),
    ("CABINETS", "Cabinet_Uppers", ("Cabinet_Upper_",)),
    ("CABINETS", "Storage_Under_Mezzanine", ("Cabinet_Locker_Mezz", "Refrigerator_")),
    ("WORKSHOP", "Workshop_Slatwall_Tools", ("Slatwall_", "Screwdriver_")),
    ("WORKSHOP", "Air_System", ("Air_", "Workshop_Air", "Compressor_")),
    ("WORKSHOP", "Workshop_Bench_Items", ("Workshop_Battery", "Workshop_Bench", "Workshop_Cordless", "Workshop_Paper",
                                          "Workshop_Shop_Stool", "Workshop_Trash")),
    ("WORKSHOP", "Workshop_Floor_Equipment", ("Workshop_Floor_Jack", "Workshop_Jack_Stand", "Workshop_Creeper",
                                              "Workshop_Shop_Vac", "ToolChest_")),
    ("WORKSHOP", "Detailing_Area", ("Detailing_",)),
    ("FURNITURE", "Bar_Area", ("Bar_", "Sign_The_Bullpen")),
    ("FURNITURE", "Mezzanine_Office_Area", ("Desk_", "Chair_Office", "Rug_Mezzanine", "Display_", "Sofa_Mezzanine",
                                            "Chair_Mezzanine", "Mezzanine_Plant", "Floor_Lamp", "Storage_Rack",
                                            "ArcLamp", "Coffee_Table_Mezzanine")),
    ("FURNITURE", "Lounge_Area", ("Sofa_Main", "Chair_0", "Coffee_Table", "Side_Table", "Rug_Lounge", "Lounge_",
                                  "TV_", "Media_Console")),
]


def organize():
    from .core import adopt
    for col, name, prefixes in ORGANIZE:
        adopt(name, col, prefixes)


def finalize():
    """Scene hygiene: tidy outliner, hide reference helpers from render,
    purge orphans."""
    organize()
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
