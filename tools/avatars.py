"""從去背立繪裁出圓形頭像用的正方形小圖。用法：python3 tools/avatars.py [角色 id …]（不給就全部）"""
import sys
from PIL import Image
import numpy as np
NAMES = ['whale', 'gpt', 'claude', 'gemini', 'grok', 'kimi', 'qwen', 'glm']
# 每位角色的微調：(x 位移比例, y 位移比例, 尺寸比例)。Q 版大頭上方常有角、耳朵或皇冠，要往下裁到臉；
# 耳朵與長髮會讓中心偏移，所以有些角色要往右補一點
TWEAK = {'whale': (0.0, 0.13, 0.52), 'gpt': (0.0, 0.10, 0.50), 'claude': (0.02, 0.10, 0.50), 'gemini': (0.06, 0.11, 0.48),
         'grok': (0.0, 0.10, 0.50), 'kimi': (0.03, 0.11, 0.48), 'qwen': (0.05, 0.11, 0.48), 'glm': (0.0, 0.11, 0.48)}
for n in sys.argv[1:] or NAMES:
    im = Image.open(f'art/cut/char_{n}.png').convert('RGBA')
    a = np.asarray(im)[..., 3] > 30
    h, w = a.shape
    top = np.where(a.any(axis=1))[0].min()
    xs = np.where(a[top: top + int(h * 0.30)])[1]
    dx, dy, s = TWEAK[n]
    size = int(w * s); cx = int(np.median(xs) + dx * w); y0 = int(top + dy * h)
    x0 = min(max(0, cx - size // 2), w - size)
    im.crop((x0, y0, x0 + size, y0 + size)).resize((192, 192), Image.LANCZOS).save(f'art/cut/avatar_{n}.webp', 'WEBP', quality=88, method=6)
print('ok')
