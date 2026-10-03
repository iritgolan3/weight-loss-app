"""
Lighting: real light sources (area / spot / point / sun) paired with modelled
fixtures. Emissive surfaces are only used for what the camera sees directly
(diffusers, lenses); they are hidden from diffuse rays so energy is not
counted twice.

Photometric convention used throughout: Blender radiant watts ~= lumens / 250
for white LED light, which puts a ~400 lux interior near exposure 0 under
AgX.
"""

import math
import bpy
from . import config as C
from .core import (box, cylinder, pipe, lathe, group, new_object, collection,
                   ray_visibility, uv_sphere)

COL = "LIGHTING"
LM_PER_W = 250.0


def _light(name, kind, loc, rot=(0, 0, 0), power=10.0, kelvin=4000, parent=None, **kw):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = power
    ld.use_temperature = True
    ld.temperature = kelvin
    ld.color = (1, 1, 1)
    for k, v in kw.items():
        setattr(ld, k, v)
    obj = new_object(name, ld, COL, loc, rot, parent)
    return obj


def area(name, loc, size, size_y=None, lumens=1000, kelvin=4000, rot=(0, 0, 0), parent=None,
         spread=180.0, shape='RECTANGLE'):
    o = _light(name, 'AREA', loc, rot, lumens / LM_PER_W, kelvin, parent,
               shape=shape, size=size, size_y=size_y if size_y else size)
    o.data.spread = math.radians(spread)
    return o


def spot(name, loc, lumens=900, kelvin=3000, angle=90.0, blend=0.5, radius=0.03,
         rot=(0, 0, 0), parent=None):
    # point/spot 'Power' is total flux; Blender spots keep sphere-equivalent
    # power, so scale up for the cone to keep lux right
    cone = 2 * math.pi * (1 - math.cos(math.radians(angle) / 2))
    o = _light(name, 'SPOT', loc, rot, lumens / LM_PER_W * (4 * math.pi / cone), kelvin, parent,
               spot_size=math.radians(angle), spot_blend=blend, shadow_soft_size=radius)
    return o


def point(name, loc, lumens=800, kelvin=2700, radius=0.02, parent=None):
    return _light(name, 'POINT', loc, (0, 0, 0), lumens / LM_PER_W, kelvin, parent,
                  shadow_soft_size=radius)


def camera_only(obj):
    """Emissive fixture faces: visible to camera + reflections, not GI."""
    ray_visibility(obj, camera=True, diffuse=False, glossy=True, transmission=True,
                   shadow=False)


# ---------------------------------------------------------------- fixtures

def linear_pendant(name, x, y, z, L, length=2.44, rotz=0.0, kelvin=5000, lumens=10000,
                   ceiling_z=None, diffuser_mat=None, uplight=0.22):
    """Suspended aluminium linear LED with opal diffuser, aircraft cables."""
    g = group(name, COL, loc=(x, y, z), rot=(0, 0, rotz))
    w, h = 0.10, 0.075
    box(f"{name}_Housing", (length, w, h), (0, 0, h / 2), L.alu_brushed, COL, bevel=0.006,
        segments=3, parent=g)
    box(f"{name}_EndCap_A", (0.008, w + 0.004, h + 0.004), (length / 2, 0, h / 2), L.plastic_grey,
        COL, bevel=0.002, parent=g)
    box(f"{name}_EndCap_B", (0.008, w + 0.004, h + 0.004), (-length / 2, 0, h / 2), L.plastic_grey,
        COL, bevel=0.002, parent=g)
    dif = box(f"{name}_Diffuser", (length - 0.02, w - 0.012, 0.012), (0, 0, -0.004),
              diffuser_mat or L.led_bay, COL, bevel=0.004, parent=g)
    camera_only(dif)
    area(f"{name}_Light", (0, 0, -0.012), length - 0.03, w - 0.02, lumens * (1 - uplight),
         kelvin, parent=g, spread=150.0)
    if uplight > 0:
        area(f"{name}_Uplight", (0, 0, h + 0.005), length - 0.03, w - 0.03, lumens * uplight,
             kelvin, rot=(math.pi, 0, 0), parent=g, spread=160.0)
    if ceiling_z is not None:
        for s in (-1, 1):
            xx = s * (length / 2 - 0.25)
            pipe(f"{name}_Cable", [(xx, 0, h), (xx, 0, ceiling_z - z)], 0.0012, L.steel_bare, COL,
                 sides=6, parent=g)
            cylinder(f"{name}_Cable_Gripper", 0.006, 0.03, (xx, 0, h + 0.015), L.chrome, COL,
                     verts=12, parent=g)
            cylinder(f"{name}_Canopy", 0.025, 0.012, (xx, 0, ceiling_z - z - 0.006), L.alu_brushed,
                     COL, verts=24, parent=g)
        # power cord (light grey SO cord) draped to the joist
        xx = length / 2 - 0.1
        pipe(f"{name}_Power_Cord", [(xx, 0.02, h), (xx + 0.05, 0.03, h + 0.3), (xx + 0.08, 0.04, ceiling_z - z)],
             0.0035, L.plastic_grey, COL, sides=6, bend_radius=0.15, parent=g)
    return g


def downlight(name, x, y, zc, L, kelvin=3000, lumens=900, aperture=0.10):
    """Wafer-style recessed LED: trim ring + opal lens flush with the ceiling
    plane at zc (the ceiling board above is solid), spot source just below."""
    g = group(name, COL, loc=(x, y, zc))
    lathe(f"{name}_Trim", [(0.0, -0.001), (aperture / 2 + 0.018, -0.001), (aperture / 2 + 0.018, -0.004),
                           (aperture / 2 + 0.012, -0.007), (0.0, -0.007)], L.plastic_white, COL, segments=48,
          parent=g, share_key="downlight_trim")
    lens = cylinder(f"{name}_Lens", aperture / 2 - 0.006, 0.002, (0, 0, -0.008), L.led_warm, COL,
                    verts=32, parent=g)
    camera_only(lens)
    spot(f"{name}_Light", (0, 0, -0.012), lumens, kelvin, angle=100, blend=0.8,
         radius=aperture / 2 - 0.015, parent=g)
    return g


def led_strip(name, p0, p1, L, kelvin=4000, lm_per_m=600, rot=(0, 0, 0), mat=None,
              width=0.012):
    """Aluminium channel with diffuser + matching thin area light (faces -Z of rot)."""
    import mathutils
    a, b = mathutils.Vector(p0), mathutils.Vector(p1)
    mid = (a + b) / 2
    length = (b - a).length
    ang = math.atan2(b.y - a.y, b.x - a.x)
    g = group(name, COL, loc=mid, rot=(rot[0], rot[1], ang))
    box(f"{name}_Channel", (length, 0.017, 0.007), (0, 0, 0.0035), L.alu_brushed, COL,
        bevel=0.001, parent=g)
    dif = box(f"{name}_Diffuser", (length - 0.004, width, 0.002), (0, 0, -0.0005),
              mat or L.led_strip, COL, bevel=0.0, parent=g)
    camera_only(dif)
    area(f"{name}_Light", (0, 0, -0.002), length, width, lm_per_m * length, kelvin, parent=g,
         spread=140.0)
    return g


def glass_pendant(name, x, y, zc, drop, L, kelvin=2700, lumens=450):
    """Bar pendant: smoked glass cylinder shade, black canopy, filament bulb."""
    g = group(name, COL, loc=(x, y, zc))
    cylinder(f"{name}_Canopy", 0.06, 0.025, (0, 0, -0.0125), L.black_metal, COL, verts=32, parent=g)
    pipe(f"{name}_Cord", [(0, 0, -0.025), (0, 0, -drop + 0.20)], 0.003, L.plastic_black, COL,
         sides=8, parent=g)
    cylinder(f"{name}_Socket", 0.018, 0.06, (0, 0, -drop + 0.17), L.black_metal, COL, verts=24,
             parent=g)
    lathe(f"{name}_Shade", [(0.02, 0.0), (0.06, -0.01), (0.075, -0.05), (0.075, -0.24),
                            (0.072, -0.245), (0.072, -0.05), (0.057, -0.012), (0.02, -0.005)],
          L.glass_bottle_amber, COL, loc=(0, 0, -drop + 0.20), segments=48, parent=g,
          share_key="pendant_shade")
    bulb = uv_sphere(f"{name}_Bulb", 0.032, (0, 0, -drop + 0.08), L.bulb, COL, 24, 12,
                     scale=(1, 1, 1.3), parent=g)
    ray_visibility(bulb, camera=True, diffuse=False, glossy=True, transmission=True, shadow=False)
    point(f"{name}_Light", (0, 0, -drop + 0.08), lumens, kelvin, radius=0.03, parent=g)
    return g


# ---------------------------------------------------------------- scene lighting

def build(L):
    joist_bot = C.DECK_Z - C.JOIST_DEPTH
    z_fix = 5.35
    # bay: two rows x three, running along Y
    for i, y in enumerate((2.0, 5.2, 8.4)):
        for j, x in enumerate((-2.35, 2.35)):
            linear_pendant(f"Light_Bay_Linear_{i * 2 + j + 1:02d}", x, y, z_fix, L,
                           rotz=math.radians(90), kelvin=C.LIGHT_BAY_K, lumens=10000,
                           ceiling_z=joist_bot)
    # over the mezzanine (higher, so less glare for the office)
    for j, x in enumerate((-2.35, 2.35)):
        linear_pendant(f"Light_Mezzanine_Linear_{j + 1:02d}", x, 14.6, 5.45, L,
                       rotz=math.radians(90), kelvin=4000, lumens=8000, ceiling_z=joist_bot)
    # lounge downlights in the soffit (4" wafer LEDs, ~1,100 lm)
    k = 1
    for x in (-3.45, -1.55, 0.35, 2.75):
        for y in (12.0, 13.75, 15.5, 17.2):
            if x > 1.9 and y > 15.0:
                continue  # bathroom
            if x < -3.0 and y > 15.0:
                continue
            downlight(f"Light_Lounge_Downlight_{k:02d}", x, y, C.MEZZ_SOFFIT_Z, L,
                      kelvin=C.LIGHT_LOUNGE_K, lumens=1100)
            k += 1
    # bathroom ceiling light
    downlight("Light_Bathroom_Downlight", C.X1 - C.BATH_W / 2, C.Y1 - C.BATH_D / 2, C.MEZZ_SOFFIT_Z,
              L, kelvin=3000, lumens=700)
    # bar pendants over the bar counter
    bar_x = C.BAR_X_FACE - 0.30
    for i, y in enumerate((12.45, 13.55, 14.65)):
        glass_pendant(f"Light_Bar_Pendant_{i + 1:02d}", bar_x, y, C.MEZZ_SOFFIT_Z, 0.95, L,
                      kelvin=C.LIGHT_BAR_K, lumens=450)
    # stair step lights (housings modelled in mezzanine.py)
    bpy.context.view_layer.update()
    for o in [o for o in bpy.data.objects if o.name.startswith("Stair_Step_Light_Lens")]:
        camera_only(o)
        p = o.matrix_world.translation
        area(f"Light_Stair_Step_{o.name[-2:]}", (p.x + 0.004, p.y, p.z - 0.004), 0.08, 0.01,
             lumens=40, kelvin=3000, rot=(0, math.radians(-90), 0), spread=120)
    # exterior sun
    sun = _light("Light_Sun", 'SUN', (0, -20, 30),
                 (math.radians(90 - C.SUN_ELEVATION_DEG), 0, math.radians(C.SUN_ROTATION_DEG)),
                 power=28.0, kelvin=5600, angle=math.radians(0.6))
    return sun
