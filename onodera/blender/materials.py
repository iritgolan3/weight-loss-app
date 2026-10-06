"""Texture + material library for the restaurant."""
import os
import numpy as np
import textures as T
from helpers import material


def build(bpy, texdir, size=1024):
    os.makedirs(texdir, exist_ok=True)

    def img(name, arr):
        return T.to_blender_image(bpy, name, arr, os.path.join(texdir, name + '.jpg'))

    rng = np.random.default_rng(7)
    I = {
        'hinoki': img('hinoki', T.wood(size, (0.95, 0.86, 0.68), (0.82, 0.66, 0.44), 1, rings=30, fiber=0.28, warp=0.45)),
        'hinoki_ceiling': img('hinoki_ceiling', T.wood(size, (0.90, 0.78, 0.58), (0.74, 0.57, 0.36), 11, rings=22, fiber=0.3, warp=0.6)),
        'walnut': img('walnut', T.wood(size, (0.30, 0.20, 0.13), (0.13, 0.085, 0.055), 2, rings=14, fiber=0.35, warp=1.2)),
        'oak_dark': img('oak_dark', T.wood(size, (0.42, 0.30, 0.19), (0.22, 0.15, 0.09), 9, rings=18, fiber=0.4, warp=0.9)),
        'plaster': img('plaster', T.plaster(size, (0.80, 0.73, 0.62), 3, var=0.09)),
        'plaster_light': img('plaster_light', T.plaster(size, (0.86, 0.81, 0.72), 15, var=0.07)),
        'plaster_dark': img('plaster_dark', T.plaster(size, (0.36, 0.31, 0.26), 13, var=0.12)),
        'floor_stone': img('floor_stone', T.stone(size, (0.20, 0.19, 0.18), 4, var=0.16)),
        'stone_light': img('stone_light', T.stone(size, (0.74, 0.72, 0.68), 14, var=0.06, veins=0.15)),
        'washi': img('washi', T.washi(size, (0.96, 0.93, 0.86), 5)),
        'bizen': img('bizen', np.clip(T.stone(512, (0.47, 0.25, 0.14), 6, var=0.35) *
                                      (1 - 0.6 * (T.fbm(512, 512, 5, 5, rng, 4) > 0.62)[..., None]), 0, 1)),
        'limestone': img('limestone', T.stone(size, (0.80, 0.77, 0.71), 21, var=0.07)),
        'concrete': img('concrete', T.stone(512, (0.55, 0.54, 0.52), 22, var=0.12)),
        'bizen_tiles': img('bizen_tiles', T.bizen_tiles(2048, 12, 31)),
        'oya': img('oya', T.oya(size, 32)),
        'oak_light': img('oak_light', T.wood(size, (0.80, 0.68, 0.50), (0.64, 0.50, 0.34), 33, rings=20, fiber=0.3, warp=0.8)),
        'granite': img('granite', T.stone(size, (0.09, 0.09, 0.095), 34, var=0.25, grain=0.9)),
        'birch': img('birch', np.clip(T.plaster(512, (0.90, 0.88, 0.84), 41, var=0.05) *
                                      (1 - 0.85 * (T.fbm(512, 512, 40, 3, rng, 3) > 0.7))[..., None], 0, 1)),
        'limestone_old': img('limestone_old', T.stone(size, (0.74, 0.69, 0.60), 42, var=0.12)),
        'tatami': img('tatami', T.wood(512, (0.78, 0.74, 0.52), (0.62, 0.58, 0.38), 8, rings=90, fiber=0.15, warp=0.05)),
    }

    M = {}
    M['hinoki'] = material('Hinoki counter', image=I['hinoki'], rough=0.42, specular=0.45, bump=0.08)
    M['hinoki_ceiling'] = material('Hinoki ceiling', image=I['hinoki_ceiling'], rough=0.6)
    M['hinoki_raw'] = material('Hinoki chopsticks', color=(0.88, 0.76, 0.55), rough=0.6)
    M['walnut'] = material('Dark walnut', image=I['walnut'], rough=0.45, coat=0.15)
    M['oak_dark'] = material('Smoked oak', image=I['oak_dark'], rough=0.5)
    M['oak_light'] = material('Light oak', image=I['oak_light'], rough=0.5)
    M['chair_wood'] = M['oak_light']
    M['chair_fabric'] = material('Seat fabric', color=(0.42, 0.36, 0.29), rough=0.9)
    M['bizen_tiles'] = material('Bizen tile wall', image=I['bizen_tiles'], rough=0.75, bump=0.35)
    M['oya'] = material('Oya stone', image=I['oya'], rough=0.9, bump=0.2)
    M['granite'] = material('Black granite (brushed)', image=I['granite'], rough=0.32, specular=0.5)
    M['plaster'] = material('Earth plaster', image=I['plaster'], rough=0.9, bump=0.15)
    M['plaster_dark'] = material('Dark plaster', image=I['plaster_dark'], rough=0.9, bump=0.15)
    M['floor'] = material('Stone floor', image=I['floor_stone'], rough=0.35, specular=0.5)
    M['plaster_light'] = material('Light plaster', image=I['plaster_light'], rough=0.9, bump=0.12)
    M['stone_light'] = material('Light stone', image=I['stone_light'], rough=0.25)
    M['washi'] = material('Washi paper', image=I['washi'], rough=0.9, transmission=0.0)
    M['washi_glow'] = material('Washi lit', image=I['washi'], rough=0.9, emission=(1.0, 0.82, 0.6), strength=1.6)
    M['tatami'] = material('Tatami', image=I['tatami'], rough=0.8)
    M['plate_dark'] = material('Bizen ware', image=I['bizen'], rough=0.7)
    M['ceramic_white'] = material('White porcelain', color=(0.92, 0.91, 0.88), rough=0.15)
    M['ceramic_glaze'] = material('Celadon glaze', color=(0.62, 0.66, 0.58), rough=0.18)
    M['ceramic_dark'] = material('Dark glaze', color=(0.10, 0.09, 0.08), rough=0.25)
    M['lacquer_black'] = material('Black lacquer', color=(0.015, 0.012, 0.01), rough=0.12, coat=0.6)
    M['lacquer_red'] = material('Red lacquer', color=(0.42, 0.04, 0.03), rough=0.15, coat=0.5)
    M['towel'] = material('Oshibori', color=(0.93, 0.93, 0.90), rough=0.95)
    M['tea'] = material('Green tea', color=(0.38, 0.45, 0.12), rough=0.05)
    M['rice'] = material('Shari', color=(0.88, 0.84, 0.76), rough=0.7)
    M['tuna'] = material('Akami', color=(0.45, 0.04, 0.05), rough=0.3, coat=0.3)
    M['toro'] = material('Toro', color=(0.80, 0.42, 0.40), rough=0.35, coat=0.3)
    M['salmon'] = material('Salmon', color=(0.85, 0.35, 0.15), rough=0.35, coat=0.3)
    M['white_fish'] = material('Shiromi', color=(0.85, 0.82, 0.78), rough=0.3, coat=0.3)
    M['steel'] = material('Brushed steel', color=(0.75, 0.75, 0.74), rough=0.28, metal=1.0)
    M['brass'] = material('Brass', color=(0.78, 0.60, 0.32), rough=0.3, metal=1.0)
    M['glass'] = material('Glass', color=(0.95, 0.97, 0.97), rough=0.02, transmission=1.0, ior=1.5)
    M['black'] = material('Matte black', color=(0.02, 0.02, 0.02), rough=0.6)
    M['charcoal'] = material('Charcoal panel', color=(0.06, 0.055, 0.05), rough=0.55)
    M['leaf'] = material('Leaf', color=(0.20, 0.32, 0.10), rough=0.6)
    M['leaf_red'] = material('Maple leaf', color=(0.55, 0.12, 0.04), rough=0.6)
    M['branch'] = material('Branch', color=(0.12, 0.08, 0.05), rough=0.8)
    M['noren'] = material('Noren', color=(0.06, 0.07, 0.12), rough=0.95)
    M['noren_white'] = material('Noren white', color=(0.90, 0.88, 0.82), rough=0.95)
    M['emit_warm'] = material('LED warm', color=(1, 0.8, 0.55), emission=(1.0, 0.78, 0.52), strength=6.0)
    M['emit_soft'] = material('Lamp diffuser', color=(1, 0.9, 0.75), emission=(1.0, 0.86, 0.66), strength=3.0)
    M['ginger'] = material('Gari', color=(0.95, 0.78, 0.68), rough=0.35)
    M['wasabi'] = material('Wasabi', color=(0.45, 0.62, 0.22), rough=0.6)
    M['sake'] = material('Sake', color=(0.98, 0.98, 0.96), rough=0.02, transmission=1.0, ior=1.34)
    M['facade_metal'] = material('Bronze metal', color=(0.20, 0.15, 0.11), rough=0.35, metal=1.0)
    M['facade_stone'] = material('Limestone', image=I['limestone'], rough=0.75, bump=0.1)
    M['birch'] = material('Birch bark', image=I['birch'], rough=0.7)
    M['beige'] = material('Beige panel', color=(0.80, 0.72, 0.58), rough=0.7)
    M['gold'] = material('Gold leaf', color=(0.86, 0.68, 0.36), rough=0.25, metal=1.0)
    M['brass_dark'] = material('Bronze', color=(0.42, 0.30, 0.17), rough=0.35, metal=1.0)
    M['limestone_old'] = material('Old limestone', image=I['limestone_old'], rough=0.8, bump=0.1)
    M['glass_store'] = material('Storefront glass', color=(0.62, 0.66, 0.66), rough=0.02, transmission=1.0, ior=1.5)
    M['leaf_light'] = material('Leaf light', color=(0.30, 0.42, 0.14), rough=0.6)
    M['glass_dark'] = material('Dark glass', color=(0.02, 0.025, 0.03), rough=0.04, specular=0.8)
    M['teal'] = material('Teal glass panel', color=(0.30, 0.45, 0.48), rough=0.3)
    M['sidewalk'] = material('Sidewalk', image=I['concrete'], rough=0.8)
    M['asphalt'] = material('Asphalt', color=(0.035, 0.035, 0.038), rough=0.85)
    return M, I
