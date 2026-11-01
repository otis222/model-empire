"""背景後製：給 Blender 輸出的 art/raw/bg_*.png 加光暈與輕微暗角，再壓成 WebP 放到 art/cut/。

用法：python tools/bg_post.py hall canyon studio
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def post(name, bloom=0.32, threshold=0.72, radius=26, vignette=0.12, quality=86):
    src = os.path.join(ROOT, 'art', 'raw', f'bg_{name}.png')
    im = Image.open(src).convert('RGB')
    a = np.asarray(im).astype(np.float32) / 255.0
    # 光暈：只取亮部、模糊後用 screen 疊回去
    lum = a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    mask = np.clip((lum - threshold) / (1 - threshold), 0, 1)[..., None]
    bright = Image.fromarray((a * mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
    b = np.asarray(bright).astype(np.float32) / 255.0 * bloom
    out = 1 - (1 - a) * (1 - b)
    # 暗角
    h, w = lum.shape
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2) / np.sqrt(2)
    out *= (1 - vignette * np.clip(r, 0, 1) ** 2)[..., None]
    img = Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))
    os.makedirs(os.path.join(ROOT, 'art', 'cut'), exist_ok=True)
    dst = os.path.join(ROOT, 'art', 'cut', f'bg_{name}.webp')
    img.save(dst, 'WEBP', quality=quality, method=6)
    print(dst, img.size, os.path.getsize(dst) // 1024, 'KB')


if __name__ == '__main__':
    for n in sys.argv[1:] or ['hall', 'canyon', 'studio']:
        post(n)
