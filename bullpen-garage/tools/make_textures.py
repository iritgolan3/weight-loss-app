"""
Generate the image assets used by the scene (posters, TV screen, clock face,
licence plates) into ../textures. All artwork is original and generic: no
real brands, logos or trademarked liveries.

Requires Pillow:  pip install pillow
Run:              python tools/make_textures.py
"""

import math
import os
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "textures")
os.makedirs(OUT, exist_ok=True)

FONT_DIRS = ["/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/truetype/freefont",
             "/usr/share/fonts/truetype/liberation", "C:/Windows/Fonts", "/Library/Fonts"]


def font(names, size):
    for d in FONT_DIRS:
        for n in names:
            p = os.path.join(d, n)
            if os.path.exists(p):
                return ImageFont.truetype(p, size)
    return ImageFont.load_default()


BOLD = ["DejaVuSans-Bold.ttf", "FreeSansBold.ttf", "LiberationSans-Bold.ttf", "arialbd.ttf"]
COND = ["DejaVuSansCondensed-Bold.ttf", "FreeSansBold.ttf", "LiberationSansNarrow-Bold.ttf"]
SERIF = ["DejaVuSerif-Bold.ttf", "FreeSerifBold.ttf", "LiberationSerif-Bold.ttf"]
MONO = ["DejaVuSansMono-Bold.ttf", "FreeMonoBold.ttf", "LiberationMono-Bold.ttf"]


def car_side(draw, x, y, w, color, wheel=None, kind="gt"):
    """Generic sports-car side silhouette (no real model)."""
    h = w * 0.27
    if kind == "gt":
        pts = [(0.00, 0.78), (0.02, 0.60), (0.10, 0.52), (0.30, 0.46), (0.40, 0.22), (0.50, 0.12),
               (0.66, 0.13), (0.80, 0.30), (0.95, 0.40), (1.00, 0.55), (0.99, 0.80)]
    else:  # vintage racer
        pts = [(0.00, 0.80), (0.03, 0.55), (0.18, 0.45), (0.36, 0.40), (0.45, 0.20), (0.56, 0.18),
               (0.62, 0.36), (0.85, 0.40), (0.98, 0.50), (1.00, 0.80)]
    poly = [(x + px * w, y + py * h) for px, py in pts]
    draw.polygon(poly, fill=color)
    wr = h * 0.25
    for cx in (0.20, 0.80):
        draw.ellipse([x + cx * w - wr, y + 0.80 * h - wr, x + cx * w + wr, y + 0.80 * h + wr],
                     fill=wheel or (20, 20, 20))
        draw.ellipse([x + cx * w - wr * 0.5, y + 0.80 * h - wr * 0.5, x + cx * w + wr * 0.5,
                      y + 0.80 * h + wr * 0.5], fill=(150, 150, 150))


def grain(img, amount=10, seed=1):
    rnd = random.Random(seed)
    px = img.load()
    w, h = img.size
    for _ in range(w * h // 6):
        x, y = rnd.randrange(w), rnd.randrange(h)
        r, g, b = px[x, y][:3]
        d = rnd.randint(-amount, amount)
        px[x, y] = (max(0, min(255, r + d)), max(0, min(255, g + d)), max(0, min(255, b + d)))
    return img


def centered(draw, text, cx, y, f, fill):
    bb = draw.textbbox((0, 0), text, font=f)
    draw.text((cx - (bb[2] - bb[0]) / 2, y), text, font=f, fill=fill)


def poster_grand_prix():
    W, H = 1200, 1700
    img = Image.new("RGB", (W, H), (236, 226, 202))
    d = ImageDraw.Draw(img)
    d.ellipse([200, 260, 1000, 1060], fill=(196, 52, 38))
    for i in range(9):
        d.rectangle([0, 900 + i * 40, W, 900 + i * 40 + 18], fill=(30, 52, 86))
    car_side(d, 140, 820, 920, (24, 24, 26), kind="vintage")
    d.rectangle([60, 60, W - 60, H - 60], outline=(30, 30, 30), width=8)
    centered(d, "GRAND PRIX", W / 2, 1180, font(SERIF, 150), (30, 30, 30))
    centered(d, "CIRCUIT DE LA COTE  -  1966", W / 2, 1360, font(COND, 56), (196, 52, 38))
    centered(d, "XXXIV  COURSE INTERNATIONALE", W / 2, 1450, font(COND, 44), (30, 52, 86))
    grain(img, 14, 1).save(os.path.join(OUT, "poster_grand_prix.jpg"), quality=90)


def poster_endurance():
    W, H = 1200, 1700
    img = Image.new("RGB", (W, H), (22, 34, 58))
    d = ImageDraw.Draw(img)
    for i, col in enumerate([(238, 140, 40), (240, 240, 235), (238, 140, 40)]):
        d.polygon([(0, 500 + i * 120), (W, 200 + i * 120), (W, 280 + i * 120), (0, 580 + i * 120)], fill=col)
    car_side(d, 120, 760, 960, (240, 240, 235), kind="gt")
    d.ellipse([480, 820, 640, 900], fill=(22, 34, 58))
    centered(d, "9", 560, 815, font(BOLD, 80), (240, 240, 235))
    centered(d, "24", W / 2, 1060, font(BOLD, 320), (238, 140, 40))
    centered(d, "HOURS OF ENDURANCE", W / 2, 1400, font(COND, 76), (240, 240, 235))
    centered(d, "JUNE 15-16  -  LE CIRCUIT", W / 2, 1500, font(COND, 44), (180, 190, 210))
    grain(img, 10, 2).save(os.path.join(OUT, "poster_endurance.jpg"), quality=90)


def poster_bullpen():
    W, H = 1200, 1700
    img = Image.new("RGB", (W, H), (28, 28, 30))
    d = ImageDraw.Draw(img)
    # baseball diamond + home plate (the space is called "The Bullpen")
    cx, cy = W / 2, 760
    d.polygon([(cx, cy - 380), (cx + 380, cy), (cx, cy + 380), (cx - 380, cy)], outline=(220, 220, 215), width=10)
    for (x, y) in [(cx, cy - 380), (cx + 380, cy), (cx - 380, cy)]:
        d.rectangle([x - 26, y - 26, x + 26, y + 26], fill=(220, 220, 215))
    d.polygon([(cx - 40, cy + 340), (cx + 40, cy + 340), (cx + 40, cy + 380), (cx, cy + 420), (cx - 40, cy + 380)],
              fill=(220, 220, 215))
    d.ellipse([cx - 70, cy - 70, cx + 70, cy + 70], fill=(178, 34, 34))
    car_side(d, 230, 640, 740, (178, 34, 34), kind="gt")
    centered(d, "THE BULLPEN", W / 2, 1230, font(BOLD, 130), (235, 235, 230))
    centered(d, "CARS  -  COFFEE  -  RELIEF", W / 2, 1390, font(COND, 60), (178, 34, 34))
    centered(d, "EST. 2023", W / 2, 1480, font(COND, 48), (150, 150, 150))
    grain(img, 8, 3).save(os.path.join(OUT, "poster_bullpen.jpg"), quality=90)


def poster_blueprint():
    W, H = 1700, 1100
    img = Image.new("RGB", (W, H), (20, 54, 110))
    d = ImageDraw.Draw(img)
    for x in range(0, W, 50):
        d.line([(x, 0), (x, H)], fill=(36, 74, 132), width=1)
    for y in range(0, H, 50):
        d.line([(0, y), (W, y)], fill=(36, 74, 132), width=1)
    # side + top view outlines
    def outline(x, y, w, kind):
        h = w * 0.27
        pts = [(0.00, 0.78), (0.02, 0.60), (0.10, 0.52), (0.30, 0.46), (0.40, 0.22), (0.50, 0.12),
               (0.66, 0.13), (0.80, 0.30), (0.95, 0.40), (1.00, 0.55), (0.99, 0.80), (0.0, 0.78)]
        d.line([(x + px * w, y + py * h) for px, py in pts], fill=(225, 235, 250), width=4)
        for cxw in (0.2, 0.8):
            r = h * 0.25
            d.ellipse([x + cxw * w - r, y + 0.8 * h - r, x + cxw * w + r, y + 0.8 * h + r], outline=(225, 235, 250), width=4)
    outline(150, 150, 1000, "gt")
    d.rounded_rectangle([150, 620, 1150, 960], radius=120, outline=(225, 235, 250), width=4)
    d.rounded_rectangle([450, 670, 850, 910], radius=60, outline=(225, 235, 250), width=3)
    for x in (350, 950):
        d.rectangle([x - 70, 600, x + 70, 640], outline=(225, 235, 250), width=3)
        d.rectangle([x - 70, 940, x + 70, 980], outline=(225, 235, 250), width=3)
    f = font(MONO, 30)
    d.line([(150, 520), (1150, 520)], fill=(225, 235, 250), width=2)
    d.text((560, 530), "4573 mm", font=f, fill=(225, 235, 250))
    d.line([(1220, 150), (1220, 420)], fill=(225, 235, 250), width=2)
    d.text((1240, 270), "1300", font=f, fill=(225, 235, 250))
    d.rectangle([1250, 820, 1650, 1060], outline=(225, 235, 250), width=3)
    d.text((1270, 840), "PROJECT: COUPE 901", font=f, fill=(225, 235, 250))
    d.text((1270, 890), "SCALE 1:20", font=f, fill=(225, 235, 250))
    d.text((1270, 940), "DWG NO. BP-0027", font=f, fill=(225, 235, 250))
    d.text((1270, 990), "THE BULLPEN", font=f, fill=(225, 235, 250))
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    grain(img, 8, 4).save(os.path.join(OUT, "poster_blueprint.jpg"), quality=90)


def poster_track_map():
    W, H = 1200, 1600
    img = Image.new("RGB", (W, H), (242, 240, 234))
    d = ImageDraw.Draw(img)
    pts = []
    for i in range(240):
        t = 2 * math.pi * i / 240
        r = 380 + 90 * math.sin(3 * t) + 50 * math.cos(5 * t + 1)
        pts.append((W / 2 + r * math.cos(t) * 1.05, 700 + r * math.sin(t) * 1.25))
    d.line(pts + [pts[0]], fill=(20, 20, 20), width=26, joint="curve")
    d.line(pts + [pts[0]], fill=(242, 240, 234), width=8, joint="curve")
    for k, i in enumerate(range(0, 240, 24)):
        x, y = pts[i]
        d.ellipse([x - 26, y - 26, x + 26, y + 26], fill=(200, 40, 30))
        centered(d, str(k + 1), x, y - 18, font(BOLD, 28), (255, 255, 255))
    centered(d, "CIRCUIT No. 27", W / 2, 1290, font(BOLD, 96), (20, 20, 20))
    centered(d, "5.471 KM   -   15 TURNS   -   LAP RECORD 1:41.2", W / 2, 1420, font(COND, 40), (120, 120, 120))
    grain(img, 6, 5).save(os.path.join(OUT, "poster_track_map.jpg"), quality=90)


def poster_speed_shop():
    W, H = 1500, 1000
    img = Image.new("RGB", (W, H), (180, 30, 28))
    d = ImageDraw.Draw(img)
    d.rectangle([40, 40, W - 40, H - 40], outline=(240, 220, 170), width=14)
    centered(d, "SPEED SHOP", W / 2, 150, font(BOLD, 200), (240, 220, 170))
    for i in range(6):
        d.rectangle([150 + i * 200, 470, 150 + i * 200 + 100, 570], fill=(25, 25, 25))
        d.rectangle([250 + i * 200, 470, 250 + i * 200 + 100, 570], fill=(240, 220, 170))
        d.rectangle([150 + i * 200, 570, 150 + i * 200 + 100, 670], fill=(240, 220, 170))
        d.rectangle([250 + i * 200, 570, 250 + i * 200 + 100, 670], fill=(25, 25, 25))
    centered(d, "PARTS  -  SERVICE  -  TUNING", W / 2, 740, font(COND, 80), (240, 220, 170))
    centered(d, "EST. 1958", W / 2, 850, font(COND, 56), (25, 25, 25))
    grain(img, 14, 6).save(os.path.join(OUT, "sign_speed_shop.jpg"), quality=90)


def tv_telemetry():
    W, H = 1920, 1080
    img = Image.new("RGB", (W, H), (8, 10, 14))
    d = ImageDraw.Draw(img)
    pts = []
    for i in range(200):
        t = 2 * math.pi * i / 200
        r = 300 + 70 * math.sin(3 * t) + 40 * math.cos(5 * t + 1)
        pts.append((560 + r * math.cos(t), 540 + r * math.sin(t) * 0.85))
    d.line(pts + [pts[0]], fill=(230, 230, 230), width=10, joint="curve")
    x, y = pts[37]
    d.ellipse([x - 16, y - 16, x + 16, y + 16], fill=(230, 40, 30))
    # speed trace
    gx0, gy0, gw, gh = 1100, 180, 720, 300
    d.rectangle([gx0, gy0, gx0 + gw, gy0 + gh], outline=(60, 70, 80), width=2)
    prev = None
    for i in range(gw):
        v = 0.5 + 0.35 * math.sin(i / 45.0) + 0.1 * math.sin(i / 11.0)
        p = (gx0 + i, gy0 + gh - v * gh)
        if prev:
            d.line([prev, p], fill=(40, 200, 255), width=3)
        prev = p
    f = font(MONO, 44)
    f2 = font(MONO, 30)
    d.text((1100, 560), "LAP 12/30", font=f, fill=(230, 230, 230))
    d.text((1100, 630), "BEST  1:41.287", font=f, fill=(120, 230, 120))
    d.text((1100, 700), "LAST  1:41.904", font=f, fill=(230, 230, 230))
    d.text((1100, 770), "GAP   +0.617", font=f, fill=(250, 190, 60))
    d.text((1100, 880), "SPEED 247 KM/H   GEAR 6   RPM 8150", font=f2, fill=(160, 170, 180))
    d.text((60, 40), "SESSION: PRACTICE  -  TRACK 27", font=f2, fill=(160, 170, 180))
    img.save(os.path.join(OUT, "tv_telemetry.png"))


def clock_face():
    S = 1024
    img = Image.new("RGB", (S, S), (240, 238, 232))
    d = ImageDraw.Draw(img)
    c = S / 2
    d.ellipse([20, 20, S - 20, S - 20], outline=(30, 30, 30), width=24)
    # baseball stitching arcs (theme of "The Bullpen")
    for sgn in (-1, 1):
        for k in range(16):
            a = math.radians(-60 + k * 7.5)
            x = c + sgn * (c - 150) * math.cos(a) * 0.55 + sgn * 150
            y = c + (c - 150) * math.sin(a)
            d.line([(x - 14, y - 10), (x + 14, y + 10)], fill=(190, 40, 40), width=6)
    f = font(BOLD, 90)
    for h in range(1, 13):
        a = math.radians(h * 30 - 90)
        x, y = c + 380 * math.cos(a), c + 380 * math.sin(a)
        bb = d.textbbox((0, 0), str(h), font=f)
        d.text((x - (bb[2] - bb[0]) / 2, y - (bb[3] - bb[1]) / 2 - 12), str(h), font=f, fill=(30, 30, 30))
    centered(d, "THE BULLPEN", c, c + 140, font(COND, 56), (30, 30, 30))
    img.save(os.path.join(OUT, "clock_face.png"))


def plate(text, fname):
    W, H = 1200, 600
    img = Image.new("RGB", (W, H), (245, 245, 242))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([10, 10, W - 10, H - 10], radius=40, outline=(30, 30, 30), width=14)
    centered(d, "SUNCOAST", W / 2, 40, font(COND, 70), (30, 70, 140))
    centered(d, text, W / 2, 170, font(BOLD, 250), (25, 40, 90))
    for x in (110, W - 110):
        d.ellipse([x - 22, 70 - 22, x + 22, 70 + 22], fill=(150, 150, 150))
    img.save(os.path.join(OUT, fname))


if __name__ == "__main__":
    poster_grand_prix()
    poster_endurance()
    poster_bullpen()
    poster_blueprint()
    poster_track_map()
    poster_speed_shop()
    tv_telemetry()
    clock_face()
    plate("BLLPN1", "plate_car01.png")
    plate("RELIEF", "plate_car02.png")
    print("textures written to", os.path.abspath(OUT))
