"""產生 Blender 辦公室場景用的貼圖：螢幕、白板、鯨魚標誌、招牌、海報、窗景、木地板、機櫃面板。
用法：python tools/blender/make_textures.py   → art/blender/textures/*.png
全部用程式畫；只有海報用到 art/cut/char_whale.png（大肥魚立繪）。"""
import os
import math
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'art', 'blender', 'textures')
FONT_TC = 'C:/Windows/Fonts/msjhbd.ttc'
FONT_EN = 'C:/Windows/Fonts/bahnschrift.ttf'

NAVY = (31, 58, 122)
COBALT = (47, 95, 196)
AQUA = (94, 214, 255)
GOLD = (232, 190, 98)
PAPER = (251, 251, 247)
CODE = [(94, 210, 255), (255, 143, 177), (255, 212, 121), (200, 214, 255), (140, 230, 170)]
S = 2  # 先畫兩倍大再縮小，邊緣比較乾淨


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def save(im, name, size=None):
    if size:
        im = im.resize(size, Image.LANCZOS)
    im.save(os.path.join(OUT, name))


def glow_line(base, pts, color, width, blur):
    """畫一條帶光暈的線（光暈先模糊再疊回去）"""
    layer = Image.new('RGBA', base.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).line(pts, fill=color + (255,), width=width * 3, joint='curve')
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))
    ImageDraw.Draw(base).line(pts, fill=color + (255,), width=width, joint='curve')


def title_bar(d, w, h=26):
    d.rectangle((0, 0, w, h * S), fill=(22, 36, 70))
    for i, c in enumerate([(255, 110, 110), (255, 200, 90), (110, 220, 140)]):
        d.ellipse(((10 + 16 * i) * S, 8 * S, (20 + 16 * i) * S, 18 * S), fill=c)


def screen_code(name, seed):
    W, H = 512 * S, 320 * S
    im = Image.new('RGB', (W, H), (14, 24, 48)); d = ImageDraw.Draw(im)
    title_bar(d, W)
    d.rectangle((0, 26 * S, 40 * S, H), fill=(18, 30, 58))
    r = random.Random(seed); y = 38 * S; indent = 0
    while y < H - 14 * S:
        d.rectangle((12 * S, y + 3 * S, 28 * S, y + 7 * S), fill=(52, 70, 110))
        x = (52 + indent * 18) * S
        for _ in range(r.randint(1, 4)):
            w = r.randint(18, 70) * S
            d.rounded_rectangle((x, y, x + w, y + 10 * S), radius=4 * S, fill=r.choice(CODE)); x += w + 8 * S
        y += 18 * S
        indent = max(0, min(4, indent + r.choice([-1, 0, 0, 1])))
    save(im, name, (512, 320))


def loss_curve(x0, y0, x1, y1, seed, n=90):
    r = random.Random(seed); pts = []
    for i in range(n):
        t = i / (n - 1)
        v = 0.12 + 0.85 * math.exp(-4.2 * t) + r.uniform(-0.025, 0.025) * (1 - t * 0.6)
        pts.append((x0 + (x1 - x0) * t, y1 - (y1 - y0) * v))
    return pts


def screen_loss(name, seed=3, progress=0.72):
    W, H = 512 * S, 320 * S
    im = Image.new('RGBA', (W, H), (12, 22, 46, 255)); d = ImageDraw.Draw(im)
    title_bar(d, W)
    f = font(FONT_EN, 15 * S)
    d.text((70 * S, 5 * S), 'LOSS  1.84', font=f, fill=AQUA)
    d.text((330 * S, 5 * S), 'STEP 12,400', font=f, fill=(150, 170, 220))
    for gx in range(40, 512, 48):
        d.line((gx * S, 40 * S, gx * S, 270 * S), fill=(26, 42, 78), width=S)
    for gy in range(40, 272, 46):
        d.line((30 * S, gy * S, 500 * S, gy * S), fill=(26, 42, 78), width=S)
    glow_line(im, loss_curve(34 * S, 50 * S, 496 * S, 262 * S, seed), AQUA, 4 * S, 6 * S)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((30 * S, 288 * S, 482 * S, 302 * S), radius=7 * S, fill=(30, 48, 90))
    d.rounded_rectangle((30 * S, 288 * S, (30 + 452 * progress) * S, 302 * S), radius=7 * S, fill=AQUA)
    save(im.convert('RGB'), name, (512, 320))


def screen_dash(name, seed=5):
    W, H = 512 * S, 320 * S
    im = Image.new('RGBA', (W, H), (14, 24, 48, 255)); d = ImageDraw.Draw(im)
    title_bar(d, W)
    r = random.Random(seed)
    # 長條圖
    for i in range(9):
        h = r.randint(40, 150)
        d.rounded_rectangle(((24 + i * 26) * S, (230 - h) * S, (42 + i * 26) * S, 230 * S), radius=4 * S, fill=AQUA if i % 3 else COBALT)
    # 圓環
    cx, cy, rr = 390 * S, 120 * S, 62 * S
    d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), outline=(30, 48, 90), width=16 * S)
    d.arc((cx - rr, cy - rr, cx + rr, cy + rr), start=-90, end=180, fill=GOLD, width=16 * S)
    d.text((cx - 30 * S, cy - 14 * S), '78%', font=font(FONT_EN, 24 * S), fill=(235, 240, 255))
    # 小折線
    pts = [((300 + i * 22) * S, (270 - r.randint(0, 40) - i * 4) * S) for i in range(9)]
    glow_line(im, pts, (255, 143, 177), 3 * S, 4 * S)
    save(im.convert('RGB'), name, (512, 320))


def screen_wall(name):
    """大螢幕：訓練儀表板（大型辦公室用）"""
    W, H = 1024 * S, 576 * S
    im = Image.new('RGBA', (W, H), (10, 19, 40, 255)); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 54 * S), fill=(20, 34, 68))
    whale(d, 34 * S, 27 * S, 22 * S, (235, 242, 255))
    d.text((70 * S, 12 * S), '模型帝國  訓練儀表板', font=font(FONT_TC, 26 * S), fill=(235, 242, 255))
    d.text((760 * S, 16 * S), 'WHALE-4 · 72%', font=font(FONT_EN, 22 * S), fill=AQUA)
    d.rounded_rectangle((24 * S, 74 * S, 660 * S, 552 * S), radius=14 * S, fill=(15, 28, 56))
    for gx in range(60, 660, 60):
        d.line((gx * S, 90 * S, gx * S, 530 * S), fill=(28, 46, 84), width=S)
    for gy in range(100, 540, 60):
        d.line((40 * S, gy * S, 644 * S, gy * S), fill=(28, 46, 84), width=S)
    glow_line(im, loss_curve(44 * S, 100 * S, 640 * S, 520 * S, 11, 120), AQUA, 5 * S, 8 * S)
    glow_line(im, loss_curve(44 * S, 180 * S, 640 * S, 525 * S, 23, 120), (255, 143, 177), 3 * S, 5 * S)
    d = ImageDraw.Draw(im); r = random.Random(9)
    for i, (label, col) in enumerate([('GPU', AQUA), ('MFU', GOLD), ('TOK/S', (140, 230, 170)), ('EVAL', (255, 143, 177))]):
        y = 74 + i * 120
        d.rounded_rectangle((684 * S, y * S, 1000 * S, (y + 104) * S), radius=14 * S, fill=(15, 28, 56))
        d.text((704 * S, (y + 12) * S), label, font=font(FONT_EN, 20 * S), fill=(150, 170, 220))
        for k in range(12):
            h = r.randint(14, 54)
            d.rounded_rectangle(((704 + k * 24) * S, (y + 92 - h) * S, (720 + k * 24) * S, (y + 92) * S), radius=3 * S, fill=col)
    save(im.convert('RGB'), name, (1024, 576))


def screen_net(name):
    """全球研發網大螢幕：抽象世界節點與連線"""
    W, H = 1024 * S, 512 * S
    im = Image.new('RGBA', (W, H), (8, 16, 36, 255)); d = ImageDraw.Draw(im)
    r = random.Random(4)
    blobs = [(0.2, 0.35, 0.12, 0.16), (0.27, 0.68, 0.06, 0.14), (0.48, 0.3, 0.07, 0.1), (0.52, 0.6, 0.07, 0.16),
             (0.7, 0.35, 0.16, 0.13), (0.82, 0.72, 0.06, 0.06)]
    for gx in range(0, 1024, 12):
        for gy in range(0, 512, 12):
            u, v = gx / 1024, gy / 512
            if any(((u - bx) / sx) ** 2 + ((v - by) / sy) ** 2 < 1 + r.uniform(-0.25, 0.1) for bx, by, sx, sy in blobs):
                d.ellipse(((gx - 2.4) * S, (gy - 2.4) * S, (gx + 2.4) * S, (gy + 2.4) * S), fill=(48, 86, 150))
    nodes = [(205, 170), (275, 345), (490, 150), (530, 300), (700, 170), (780, 210), (835, 365), (160, 215)]
    for i in range(len(nodes)):
        for j in range(i + 1, len(nodes)):
            if r.random() < 0.45:
                (x0, y0), (x1, y1) = nodes[i], nodes[j]
                mx, my = (x0 + x1) / 2, min(y0, y1) - 60 - abs(x1 - x0) * 0.15
                pts = [((1 - t) ** 2 * x0 + 2 * (1 - t) * t * mx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * my + t * t * y1) for t in np.linspace(0, 1, 40)]
                glow_line(im, [(x * S, y * S) for x, y in pts], AQUA, 2 * S, 4 * S)
    d = ImageDraw.Draw(im)
    for x, y in nodes:
        glow = Image.new('RGBA', im.size, (0, 0, 0, 0))
        ImageDraw.Draw(glow).ellipse(((x - 16) * S, (y - 16) * S, (x + 16) * S, (y + 16) * S), fill=GOLD + (200,))
        im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(8 * S)))
        d.ellipse(((x - 6) * S, (y - 6) * S, (x + 6) * S, (y + 6) * S), fill=(255, 236, 180))
    d.text((24 * S, 18 * S), 'GLOBAL R&D NETWORK', font=font(FONT_EN, 26 * S), fill=GOLD)
    save(im.convert('RGB'), name, (1024, 512))


def bezier(p0, p1, p2, n=24):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in np.linspace(0, 1, n)]


def leaf(cx, cy, rx, ry, ang, n=32):
    a = math.radians(ang)
    return [(cx + rx * math.cos(t) * math.cos(a) - ry * math.sin(t) * math.sin(a), cy + rx * math.cos(t) * math.sin(a) + ry * math.sin(t) * math.cos(a)) for t in np.linspace(0, 2 * math.pi, n)]


def whale(d, cx, cy, s, fill, spout=None, eye=None):
    """可愛小鯨魚剪影：圓頭朝左、尾巴往右上翹、尾鰭左右張開（中心 cx, cy；s ≈ 身長的一半）"""
    P = lambda x, y: (cx + x * s, cy + y * s)
    d.ellipse((cx - 1.0 * s, cy - 0.58 * s, cx + 0.9 * s, cy + 0.72 * s), fill=fill)
    upper = bezier(P(0.45, -0.42), P(1.0, -0.4), P(1.18, -0.86))
    lower = bezier(P(1.36, -0.86), P(1.36, 0.25), P(0.6, 0.6))
    d.polygon(upper + lower, fill=fill)
    d.polygon(leaf(cx + 1.02 * s, cy - 1.0 * s, 0.36 * s, 0.15 * s, -28), fill=fill)
    d.polygon(leaf(cx + 1.52 * s, cy - 1.0 * s, 0.36 * s, 0.15 * s, 28), fill=fill)
    if eye:
        d.ellipse((cx - 0.62 * s, cy - 0.05 * s, cx - 0.46 * s, cy + 0.11 * s), fill=eye)
        d.arc((cx - 0.78 * s, cy + 0.02 * s, cx - 0.42 * s, cy + 0.32 * s), start=40, end=140, fill=eye, width=max(2, int(s * 0.05)))
    if spout:
        for k, (dx, dy) in enumerate([(-0.24, -0.98), (0.0, -1.12), (0.24, -0.98)]):
            x, y = cx - 0.2 * s + dx * s, cy + dy * s
            d.ellipse((x - 0.09 * s, y - 0.12 * s, x + 0.09 * s, y + 0.12 * s), fill=spout)


def whale_logo(name):
    W = 512 * S
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    c = W // 2; R = 236 * S
    d.ellipse((c - R, c - R, c + R, c + R), outline=GOLD, width=16 * S)
    whale(d, c - 40 * S, c + 40 * S, 130 * S, (250, 252, 255), spout=AQUA, eye=COBALT)
    save(im, name, (512, 512))


def sign(name):
    W, H = 1024 * S, 256 * S
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    whale(d, 100 * S, 140 * S, 64 * S, (250, 252, 255), spout=AQUA, eye=COBALT)
    d.text((250 * S, 30 * S), '模型帝國', font=font(FONT_TC, 128 * S), fill=(250, 252, 255))
    d.text((256 * S, 192 * S), 'MODEL EMPIRE  ·  WHALE LAB', font=font(FONT_EN, 38 * S), fill=GOLD)
    save(im, name, (1024, 256))


def rug(name):
    W = 512 * S
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    c = W // 2
    d.ellipse((4 * S, 4 * S, W - 4 * S, W - 4 * S), fill=NAVY)
    d.ellipse((30 * S, 30 * S, W - 30 * S, W - 30 * S), outline=(70, 118, 214), width=10 * S)
    whale(d, c - 44 * S, c + 40 * S, 120 * S, (236, 243, 255), spout=(120, 200, 240), eye=NAVY)
    save(im, name, (512, 512))


def poster(name):
    W, H = 480 * S, 640 * S
    top, bot = np.array([196, 230, 255]), np.array([252, 253, 255])
    g = np.linspace(0, 1, H)[:, None, None]
    arr = (top * (1 - g) + bot * g).repeat(W, axis=1).astype(np.uint8)
    im = Image.fromarray(arr, 'RGB').convert('RGBA'); d = ImageDraw.Draw(im)
    r = random.Random(2)
    for _ in range(14):
        x, y, rr = r.randint(20, 460) * S, r.randint(20, 480) * S, r.randint(6, 22) * S
        d.ellipse((x - rr, y - rr, x + rr, y + rr), outline=(255, 255, 255, 200), width=3 * S)
    src = os.path.join(ROOT, 'art', 'cut', 'char_whale.png')
    if os.path.exists(src):
        ch = Image.open(src).convert('RGBA')
        ch.thumbnail((420 * S, 520 * S), Image.LANCZOS)
        im.alpha_composite(ch, ((W - ch.width) // 2, 24 * S))
    d.rectangle((0, 548 * S, W, H), fill=NAVY)
    d.text((32 * S, 562 * S), 'WHALE LAB', font=font(FONT_EN, 44 * S), fill=(250, 252, 255))
    d.text((300 * S, 572 * S), '大肥魚', font=font(FONT_TC, 34 * S), fill=GOLD)
    save(im.convert('RGB'), name, (480, 640))


def sky(name, kind):
    W, H = 1024, 512
    top, bot = np.array([128, 196, 244]), np.array([226, 243, 255])
    g = np.linspace(0, 1, H)[:, None, None]
    arr = (top * (1 - g) + bot * g).repeat(W, axis=1).astype(np.uint8)
    im = Image.fromarray(arr, 'RGB').convert('RGBA')
    r = random.Random(len(kind))
    clouds = Image.new('RGBA', (W, H), (0, 0, 0, 0)); cd = ImageDraw.Draw(clouds)
    for _ in range(7):
        x, y = r.randint(0, W), r.randint(30, 200)
        for k in range(5):
            rx, ry = r.randint(40, 90), r.randint(20, 40)
            ox = x + k * r.randint(25, 45)
            cd.ellipse((ox - rx, y - ry, ox + rx, y + ry), fill=(255, 255, 255, 230))
    im.alpha_composite(clouds.filter(ImageFilter.GaussianBlur(6)))
    d = ImageDraw.Draw(im)
    if kind == 'city':
        for layer, (col, base, hmin, hmax) in enumerate([((168, 190, 218), 400, 80, 200), ((104, 132, 178), 512, 120, 300)]):
            x = -20
            while x < W:
                w = r.randint(50, 110); h = r.randint(hmin, hmax)
                d.rectangle((x, base - h - (0 if layer else 60), x + w, H), fill=col)
                if layer:
                    for wy in range(base - h + 14, H - 10, 22):
                        for wx in range(x + 10, x + w - 10, 18):
                            if r.random() < 0.35:
                                d.rectangle((wx, wy, wx + 8, wy + 10), fill=(255, 236, 170))
                x += w + r.randint(4, 14)
    elif kind == 'park':
        d.rectangle((0, 400, W, H), fill=(140, 200, 120))
        for _ in range(26):
            x, y, rr = r.randint(-40, W + 40), r.randint(330, 430), r.randint(40, 80)
            d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=r.choice([(74, 150, 96), (96, 172, 104), (60, 128, 86)]))
    elif kind == 'sea':
        sea = np.array([60, 140, 214]); far = np.array([140, 205, 240])
        for yy in range(300, H):
            t = (yy - 300) / (H - 300)
            d.line((0, yy, W, yy), fill=tuple(int(v) for v in far * (1 - t) + sea * t))
        # 遠方海面露出的鯨魚尾巴與水花
        tail = (34, 64, 132)
        d.polygon(bezier((682, 318), (690, 290), (700, 268)) + bezier((712, 268), (708, 292), (716, 318)), fill=tail)
        d.polygon(leaf(690, 262, 22, 8, -24), fill=tail)
        d.polygon(leaf(722, 262, 22, 8, 24), fill=tail)
        for k in range(7):
            x = 668 + k * 10
            d.ellipse((x, 306 - (k % 3) * 6, x + 8, 314 - (k % 3) * 6), fill=(255, 255, 255))
    save(im.convert('RGB'), name)


def wood(name):
    W = 1024
    r = random.Random(1)
    im = Image.new('RGB', (W, W), (205, 168, 124)); d = ImageDraw.Draw(im)
    row_h = 64
    for row in range(W // row_h):
        x = -r.randint(0, 400)
        while x < W:
            ln = r.randint(260, 520)
            base = np.array([216, 182, 140]) + r.randint(-12, 10)
            col = tuple(int(v) for v in base)
            for xx in (x, x - W, x + W):
                d.rectangle((xx + 2, row * row_h + 2, xx + ln - 2, row * row_h + row_h - 2), fill=col)
                for _ in range(4):
                    gy = row * row_h + r.randint(8, row_h - 8)
                    d.line((xx + 10, gy, xx + ln - 10, gy + r.randint(-3, 3)), fill=tuple(int(v) for v in base - 14), width=1)
            x += ln
    save(im.filter(ImageFilter.GaussianBlur(0.6)), name)


def rack_front(name):
    W, H = 256 * S, 512 * S
    im = Image.new('RGB', (W, H), (18, 23, 38)); d = ImageDraw.Draw(im)
    r = random.Random(8)
    for i in range(11):
        y = (14 + i * 44) * S
        d.rounded_rectangle((14 * S, y, 242 * S, y + 36 * S), radius=4 * S, fill=(34, 42, 64))
        for vx in range(24, 150, 8):
            d.line((vx * S, y + 8 * S, vx * S, y + 28 * S), fill=(24, 30, 48), width=2 * S)
        for k in range(4):
            c = r.choice([AQUA, AQUA, (110, 240, 150), (255, 190, 80)])
            d.ellipse(((168 + k * 16) * S, y + 13 * S, (176 + k * 16) * S, y + 21 * S), fill=c)
        d.rectangle((24 * S, y + 30 * S, (24 + r.randint(40, 120)) * S, y + 32 * S), fill=(60, 120, 220))
    save(im, name, (256, 512))


def whiteboard(name):
    W, H = 1024 * S, 640 * S
    im = Image.new('RGBA', (W, H), PAPER + (255,)); d = ImageDraw.Draw(im)
    blue, red, black = (40, 90, 200), (220, 70, 80), (40, 44, 56)
    d.line((90 * S, 80 * S, 90 * S, 520 * S), fill=black, width=5 * S)
    d.line((90 * S, 520 * S, 560 * S, 520 * S), fill=black, width=5 * S)
    d.polygon([(90 * S, 66 * S), (80 * S, 88 * S), (100 * S, 88 * S)], fill=black)
    d.polygon([(574 * S, 520 * S), (552 * S, 510 * S), (552 * S, 530 * S)], fill=black)
    d.line(loss_curve(100 * S, 100 * S, 540 * S, 500 * S, 2, 70), fill=blue, width=7 * S, joint='curve')
    d.text((400 * S, 116 * S), 'loss', font=font(FONT_EN, 44 * S), fill=blue)
    d.line((500 * S, 124 * S, 500 * S, 166 * S), fill=blue, width=6 * S)
    d.polygon([(486 * S, 156 * S), (514 * S, 156 * S), (500 * S, 178 * S)], fill=blue)
    # 小型神經網路圖
    cols = [[200, 300, 400], [170, 260, 350, 440], [250, 350]]
    pos = [[((660 + ci * 120) * S, y * S) for y in ys] for ci, ys in enumerate(cols)]
    for a, b in zip(pos, pos[1:]):
        for p in a:
            for q in b:
                d.line((p, q), fill=(170, 176, 190), width=2 * S)
    for ci, layer in enumerate(pos):
        for (x, y) in layer:
            d.ellipse((x - 20 * S, y - 20 * S, x + 20 * S, y + 20 * S), fill=PAPER, outline=red if ci != 1 else blue, width=5 * S)
    r = random.Random(3)
    for (x, y, c) in [(640, 470, (255, 226, 120)), (780, 500, (255, 178, 196)), (900, 455, (150, 225, 240))]:
        d.rectangle((x * S, y * S, (x + 100) * S, (y + 100) * S), fill=c)
        for k in range(3):
            d.line(((x + 14) * S, (y + 26 + k * 24) * S, (x + 14 + r.randint(40, 70)) * S, (y + 26 + k * 24) * S), fill=(90, 90, 110), width=4 * S)
    save(im.convert('RGB'), name, (1024, 640))


def water(name):
    W, H = 512, 256
    top, bot = np.array([120, 214, 245]), np.array([24, 92, 178])
    g = np.linspace(0, 1, H)[:, None, None]
    arr = (top * (1 - g) + bot * g).repeat(W, axis=1).astype(np.uint8)
    im = Image.fromarray(arr, 'RGB').convert('RGBA')
    rays = Image.new('RGBA', (W, H), (0, 0, 0, 0)); rd = ImageDraw.Draw(rays)
    r = random.Random(6)
    for _ in range(6):
        x = r.randint(0, W)
        rd.polygon([(x, 0), (x + 30, 0), (x - 40 + r.randint(-20, 20), H), (x - 90, H)], fill=(255, 255, 255, 40))
    im.alpha_composite(rays.filter(ImageFilter.GaussianBlur(8)))
    d = ImageDraw.Draw(im)
    for _ in range(40):
        x, y, rr = r.randint(0, W), r.randint(0, H), r.randint(2, 6)
        d.ellipse((x - rr, y - rr, x + rr, y + rr), outline=(230, 250, 255, 180), width=1)
    save(im.convert('RGB'), name)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    screen_code('screen_code_a.png', 1); screen_code('screen_code_b.png', 2)
    screen_loss('screen_loss.png'); screen_dash('screen_dash.png')
    screen_wall('screen_wall.png'); screen_net('screen_net.png')
    whale_logo('whale_logo.png'); sign('sign.png'); rug('rug_whale.png'); poster('poster_dafeiyu.png')
    for k in ('day', 'city', 'park', 'sea'):
        sky(f'sky_{k}.png', k)
    wood('wood_floor.png'); rack_front('rack_front.png'); whiteboard('whiteboard.png'); water('water.png')
    print('textures ->', OUT, sorted(os.listdir(OUT)))
