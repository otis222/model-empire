"""去背與壓縮：把生成圖的純白背景變透明，裁切後輸出 PNG 與 WebP（已是透明背景的圖只裁切壓縮）。

用法：python3 tools/cutout.py <輸入.png> <輸出前綴> [--max-h 900] [--max-w 1400] [--no-holes]
  輸出 <前綴>.png（RGBA 原尺寸裁切）與 <前綴>.webp（縮圖、遊戲用）
"""
import sys
import numpy as np
from PIL import Image
import scipy.ndimage as nd


def white_to_alpha(a, holes=True, t_bg=26, t_edge=80, tint_tol=0.5):
    """把純白背景變透明，回傳 (RGBA 陣列, alpha)"""
    # 與白色的距離：取三個通道中最暗的那個，彩色像素一定會被判為非背景
    d = 255.0 - a.min(axis=2)
    cand = d < t_bg
    lab, n = nd.label(cand)
    border = np.unique(np.concatenate([lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, border[border > 0])
    if holes:
        # 被角色包住的大塊純白（例如手臂與身體之間）也視為背景：面積夠大、幾乎全白，
        # 而且色偏要跟外圍背景一致。有些生圖的白色布料（圍裙、蕾絲）只比背景暖一點點，靠色偏才不會被挖空
        flat = d < 10
        lab2, n2 = nd.label(flat & ~bg)
        if n2:
            idx = np.arange(1, n2 + 1)
            sizes = nd.sum(np.ones_like(d), lab2, index=idx)
            means = nd.mean(d, lab2, index=idx)
            rg = nd.mean(a[..., 0] - a[..., 1], lab2, index=idx)
            bgg = nd.mean(a[..., 2] - a[..., 1], lab2, index=idx)
            outer = bg & flat
            bg_rg, bg_bg = (a[..., 0] - a[..., 1])[outer].mean(), (a[..., 2] - a[..., 1])[outer].mean()
            for i, (sz, mu, r, b) in enumerate(zip(sizes, means, rg, bgg), start=1):
                # 暖度（R−G）最能分辨布料；藍偏（B−G）會被旁邊的藍髮帶偏，只做寬鬆檢查
                if sz > 900 and mu < 3.5 and abs(r - bg_rg) < tint_tol and abs(b - bg_bg) < tint_tol * 2:
                    bg |= nd.binary_dilation(lab2 == i, iterations=1) & cand
    # 邊緣帶：背景外 3px 內依「離白色多遠」給半透明，消除白邊
    near = nd.binary_dilation(bg, iterations=3) & ~bg
    alpha = np.where(bg, 0.0, 1.0)
    alpha[near] = np.clip((d[near] - 6.0) / (t_edge - 6.0), 0.0, 1.0)
    # 去除白色溢色：觀察色 = α·前景 + (1-α)·白
    al = alpha[..., None]
    rgb = np.where(al > 0.02, (a - (1.0 - al) * 255.0) / np.maximum(al, 0.02), a)
    rgb = np.clip(rgb, 0, 255)
    return np.dstack([rgb, alpha * 255.0]).astype(np.uint8), alpha


def cutout(src, out_prefix, max_h=900, max_w=1400, holes=True, pad=16):
    im = Image.open(src)
    if im.mode == 'RGBA' and np.asarray(im)[..., 3].min() < 250:
        # 已經是透明背景（例如 Blender 渲染）：沿用原本的 alpha，只做裁切與壓縮
        rgba = np.asarray(im); alpha = rgba[..., 3] / 255.0
    else:
        rgba, alpha = white_to_alpha(np.asarray(im.convert('RGB')).astype(np.float32), holes)
    ys, xs = np.where(alpha > 0.04)
    if len(ys) == 0:
        raise SystemExit('nothing left after cutout: ' + src)
    y0, y1 = max(0, ys.min() - pad), min(rgba.shape[0], ys.max() + pad + 1)
    x0, x1 = max(0, xs.min() - pad), min(rgba.shape[1], xs.max() + pad + 1)
    out = Image.fromarray(rgba[y0:y1, x0:x1], 'RGBA')
    out.save(out_prefix + '.png', optimize=True)
    small = out.copy()
    small.thumbnail((max_w, max_h), Image.LANCZOS)
    small.save(out_prefix + '.webp', 'WEBP', quality=86, method=6)
    return out.size, small.size


if __name__ == '__main__':
    args = sys.argv[1:]
    mh, mw, holes = 900, 1400, True
    if '--max-h' in args:
        i = args.index('--max-h'); mh = int(args[i + 1]); del args[i:i + 2]
    if '--max-w' in args:
        i = args.index('--max-w'); mw = int(args[i + 1]); del args[i:i + 2]
    if '--no-holes' in args:
        args.remove('--no-holes'); holes = False
    full, small = cutout(args[0], args[1], max_h=mh, max_w=mw, holes=holes)
    print(args[1], 'full', full, 'webp', small)
