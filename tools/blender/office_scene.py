"""模型帝國 辦公室場景：用 Blender 腳本從零搭建「鯨魚實驗室」等距剖面模型並渲染（不參考任何生成圖）。

用法（Blender 5.x，背景執行）：
  blender --background --factory-startup --python tools/blender/office_scene.py -- 0          # 渲染第 0 級
  blender --background --factory-startup --python tools/blender/office_scene.py -- all        # 6 級全部
  blender --background --factory-startup --python tools/blender/office_scene.py -- 2 --preview  # 低解析度快速預覽
輸出：art/raw/office_{lv}.png（透明背景）與 art/blender/office_{lv}.blend（可用 Blender 打開微調）
貼圖先用 tools/blender/make_textures.py 產生。

座標：房間佔 x∈[0,W]、y∈[0,D]；左牆在 x=0（內面朝 +x）、右牆在 y=D（內面朝 -y）；相機從 (+x,-y) 斜上方看過去。
"""
import bpy
import bmesh
import math
import os
import random
import sys
from mathutils import Euler, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
TEX = os.path.join(ROOT, 'art', 'blender', 'textures')

# ---------- 色票（大肥魚的深海藍 + 白 + 金，配暖白牆與橡木） ----------
PAL = {
    'navy': '#1f3a7a', 'cobalt': '#2f5fc4', 'sea': '#5aa9e6', 'pale': '#d6e6f5', 'wall': '#f4efe7', 'oak': '#d9b48a',
    'oak_dark': '#a97e55', 'white': '#f6f6f2', 'ink': '#1b2133', 'gold': '#e2b85c', 'coral': '#ef8f8f', 'mint': '#8fd3b6',
    'mustard': '#e8c26a', 'lavender': '#b7a6e6', 'green': '#5fae6e', 'green2': '#3f8f5a', 'green3': '#7cc47f',
    'concrete': '#c3c7cc', 'rack': '#1a2135', 'steel': '#9aa6b8', 'skin': '#ffdcc4', 'card': '#c99a62', 'tile': '#e3e8ee',
}
SHIRTS = ['white', 'sea', 'coral', 'navy', 'mint', 'mustard', 'lavender', 'cobalt']
HAIRS = ['#2b211d', '#3a2a24', '#1f1f24', '#5b3b2c', '#2b211d', '#1f1f24', '#7a4a2a', '#2c3e78', '#d9a35b', '#c9789a']


def lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c) + (1.0,)


def col(name_or_hex):
    return PAL.get(name_or_hex, name_or_hex)


# ---------- 材質 ----------
_mats = {}


def _bsdf(m):
    return m.node_tree.nodes['Principled BSDF']


def mat(color, rough=0.55, metal=0.0, coat=0.0, emit=None, emit_str=0.0, name=None):
    key = name or f'{color}_{rough}_{metal}_{coat}_{emit}_{emit_str}'
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(key); m.use_nodes = True
    b = _bsdf(m)
    b.inputs['Base Color'].default_value = lin(col(color))
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    if emit:
        b.inputs['Emission Color'].default_value = lin(col(emit)); b.inputs['Emission Strength'].default_value = emit_str
    _mats[key] = m
    return m


def glass(tint='#dff1ff', rough=0.03, name=None):
    key = name or f'glass_{tint}_{rough}'
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(key); m.use_nodes = True
    b = _bsdf(m)
    b.inputs['Base Color'].default_value = lin(tint)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Transmission Weight'].default_value = 1.0
    b.inputs['IOR'].default_value = 1.45
    _mats[key] = m
    return m


def img_mat(file, emit=0.0, rough=0.5, alpha=False, scale=None, name=None):
    key = name or f'img_{file}_{emit}_{scale}'
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(key); m.use_nodes = True
    nt = m.node_tree; b = _bsdf(m)
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(os.path.join(TEX, file), check_existing=True)
    if scale:
        tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (scale[0], scale[1], 1)
        nt.links.new(tc.outputs['UV'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], tex.inputs['Vector'])
    nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough
    if emit:
        nt.links.new(tex.outputs['Color'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = emit
    if alpha:
        nt.links.new(tex.outputs['Alpha'], b.inputs['Alpha'])
    _mats[key] = m
    return m


def node_mat(kind, name):
    """程序材質：水泥（帶雜訊）與機房地磚（棋盤格）"""
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = _bsdf(m)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    if kind == 'concrete':
        nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 2.5; nz.inputs['Detail'].default_value = 6
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = lin('#b9bec4'); ramp.color_ramp.elements[1].color = lin('#d2d5d9')
        nt.links.new(tc.outputs['Object'], nz.inputs['Vector']); nt.links.new(nz.outputs['Fac'], ramp.inputs['Fac'])
        nt.links.new(ramp.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 0.8
    else:
        ck = nt.nodes.new('ShaderNodeTexChecker'); ck.inputs['Scale'].default_value = 1.0
        ck.inputs['Color1'].default_value = lin('#dfe5ec'); ck.inputs['Color2'].default_value = lin('#cfd7e1')
        mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1.67, 1.67, 1.67)
        nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], ck.inputs['Vector'])
        nt.links.new(ck.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 0.35
    _mats[name] = m
    return m


# ---------- 幾何 ----------
def _link(ob, parent=None):
    bpy.context.scene.collection.objects.link(ob)
    if parent:
        ob.parent = parent
    return ob


def grp(x=0.0, y=0.0, z=0.0, rot=0.0, parent=None, name='grp'):
    e = bpy.data.objects.new(name, None)
    e.location = (x, y, z); e.rotation_euler = (0, 0, math.radians(rot))
    return _link(e, parent)


def _mesh_obj(name, bm, m, parent, loc=(0, 0, 0), smooth=False):
    if smooth:
        for f in bm.faces:
            f.smooth = True
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    if m:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me); ob.location = loc
    return _link(ob, parent)


def box(x, y, z, w, d, h, m, bevel=0.012, parent=None, name='box'):
    """軸對齊方塊：最小角落在 (x,y,z)，尺寸 w×d×h（以父物件座標計）"""
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = (v.co.x + 0.5) * w; v.co.y = (v.co.y + 0.5) * d; v.co.z = (v.co.z + 0.5) * h
    ob = _mesh_obj(name, bm, m, parent, (x, y, z))
    if bevel > 0:
        md = ob.modifiers.new('bevel', 'BEVEL'); md.width = min(bevel, w / 2.2, d / 2.2, h / 2.2); md.segments = 3
    return ob


def cyl(cx, cy, z, r, h, m, r_top=None, seg=28, parent=None, name='cyl', smooth=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r_top is None else r_top, depth=h)
    for v in bm.verts:
        v.co.z += h / 2
    ob = _mesh_obj(name, bm, m, parent, (cx, cy, z), smooth)
    if smooth:  # 蓋子保持平整：靠角度自動平滑
        ob.data.set_sharp_from_angle(angle=math.radians(40)) if hasattr(ob.data, 'set_sharp_from_angle') else None
    return ob


def sph(cx, cy, cz, r, m, sc=(1, 1, 1), parent=None, name='sph', ico=0, seg=24):
    bm = bmesh.new()
    if ico:
        bmesh.ops.create_icosphere(bm, subdivisions=ico, radius=r)
    else:
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(8, seg // 2), radius=r)
    for v in bm.verts:
        v.co.x *= sc[0]; v.co.y *= sc[1]; v.co.z *= sc[2]
    return _mesh_obj(name, bm, m, parent, (cx, cy, cz), smooth=not ico)


def torus(cx, cy, cz, R, r, m, parent=None, tilt=(0, 0, 0), seg=64, seg2=12, name='torus'):
    bm = bmesh.new(); rows = []
    for i in range(seg):
        a = 2 * math.pi * i / seg; row = []
        for j in range(seg2):
            b = 2 * math.pi * j / seg2
            row.append(bm.verts.new(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b))))
        rows.append(row)
    for i in range(seg):
        for j in range(seg2):
            bm.faces.new((rows[i][j], rows[(i + 1) % seg][j], rows[(i + 1) % seg][(j + 1) % seg2], rows[i][(j + 1) % seg2]))
    ob = _mesh_obj(name, bm, m, parent, (cx, cy, cz), smooth=True)
    ob.rotation_euler = Euler(tuple(math.radians(t) for t in tilt))
    return ob


def quad(cx, cy, cz, w, h, facing, m, parent=None, name='quad'):
    """貼圖平面：中心 (cx,cy,cz)，寬 w 高 h，facing ∈ '+x','-x','+y','-y','+z'（貼圖從正面看是正的）"""
    hw, hh = w / 2, h / 2
    if facing == '+z':
        pts = [(-hw, -hh, 0), (hw, -hh, 0), (hw, hh, 0), (-hw, hh, 0)]
    else:
        right = {'+x': (0, 1, 0), '-x': (0, -1, 0), '+y': (-1, 0, 0), '-y': (1, 0, 0)}[facing]
        pts = [(right[0] * sx * hw, right[1] * sx * hw, sz * hh) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    bm = bmesh.new(); uv = bm.loops.layers.uv.new()
    f = bm.faces.new([bm.verts.new(p) for p in pts])
    for loop, t in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop[uv].uv = t
    return _mesh_obj(name, bm, m, parent, (cx, cy, cz))


def wire(points, m, radius=0.006, parent=None):
    cu = bpy.data.curves.new('wire', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = radius
    sp = cu.splines.new('POLY'); sp.points.add(len(points) - 1)
    for p, q in zip(sp.points, points):
        p.co = (q[0], q[1], q[2], 1)
    ob = bpy.data.objects.new('wire', cu); cu.materials.append(m)
    return _link(ob, parent)


# ---------- 道具 ----------
def person(parent, x, y, z, rnd, facing=0.0, seated=True, shirt=None, hair=None):
    """Q 版小員工：大頭、圓身體；面向本地 +y（facing 為額外旋轉角）"""
    g = grp(x, y, z, facing, parent, 'person')
    shirt = shirt or rnd.choice(SHIRTS); hair = hair or rnd.choice(HAIRS)
    base = 0.0 if seated else 0.3
    skin = mat('skin', 0.6); hm = mat(hair, 0.5); sm = mat(shirt, 0.6)
    if not seated:
        for sx in (-0.07, 0.07):
            cyl(sx, 0, 0, 0.055, 0.42, mat('ink', 0.6), parent=g)
    sph(0, 0, base + 0.62, 0.2, sm, (1.0, 0.82, 1.2), g)
    sph(0, 0.02, base + 1.02, 0.21, skin, parent=g)
    sph(0, -0.035, base + 1.065, 0.226, hm, (1.02, 1.0, 0.95), g)
    sph(0, 0.1, base + 1.15, 0.165, hm, (1.2, 0.65, 0.5), g)
    style = rnd.randint(0, 2)
    if style == 1:
        sph(0, -0.12, base + 0.9, 0.2, hm, (1.05, 0.7, 1.25), g)          # 長髮披在背後
    elif style == 2:
        sph(0, -0.25, base + 0.96, 0.085, hm, (0.8, 0.8, 1.6), g)         # 馬尾
    for sx in (-0.075, 0.075):
        sph(sx, 0.2, base + 1.0, 0.026, mat('ink', 0.4), (1, 0.6, 1.35), g)
        sph(sx * 1.6, 0.185, base + 0.94, 0.032, mat('#ffb3b3', 0.7), (1, 0.4, 0.55), g)
    for sx in (-0.15, 0.15):
        sph(sx, 0.2 if seated else 0.06, base + 0.7, 0.055, skin, parent=g)
    return g


def chair(parent, x, y, rot=0.0, color='navy'):
    g = grp(x, y, 0, rot, parent, 'chair'); c = mat(color, 0.6)
    box(-0.23, -0.23, 0.36, 0.46, 0.46, 0.09, c, 0.04, g)
    box(-0.21, -0.32, 0.45, 0.42, 0.08, 0.46, c, 0.035, g)
    cyl(0, 0, 0.06, 0.03, 0.3, mat('steel', 0.3, 0.6), parent=g)
    cyl(0, 0, 0.02, 0.22, 0.04, mat('ink', 0.5), parent=g)
    return g


def desk(parent, x, y, rot=0.0, rnd=None, worker=True, screen='screen_code_a.png'):
    """單人桌組：桌面在本地 y∈[0,0.65]，員工坐在 y≈-0.3 面向 +y，螢幕朝員工"""
    g = grp(x, y, 0, rot, parent, 'desk')
    box(-0.6, 0.0, 0.72, 1.2, 0.65, 0.05, mat('oak', 0.5), 0.015, g)
    for lx in (-0.57, 0.52):
        box(lx, 0.05, 0.0, 0.05, 0.55, 0.72, mat('white', 0.5), 0.01, g)
    cyl(0, 0.5, 0.77, 0.03, 0.12, mat('steel', 0.3, 0.6), parent=g)
    box(-0.32, 0.46, 0.85, 0.64, 0.05, 0.38, mat('ink', 0.4), 0.012, g)
    quad(0, 0.455, 1.04, 0.58, 0.33, '-y', img_mat(screen, emit=2.2), g)
    box(-0.22, 0.1, 0.77, 0.44, 0.15, 0.02, mat('white', 0.5), 0.006, g)
    cyl(0.42, 0.2, 0.77, 0.045, 0.1, mat(rnd.choice(['coral', 'sea', 'mustard', 'white']) if rnd else 'coral', 0.5), parent=g)
    chair(g, 0, -0.38)
    if worker and rnd:
        person(g, 0, -0.3, 0.0, rnd)
    return g


def pod(parent, cx, cy, rnd, n_workers=4, screens=None):
    """四人島型桌：前排面向 +y（看得到螢幕），後排面向 -y（看得到臉）"""
    screens = screens or ['screen_code_a.png', 'screen_loss.png', 'screen_code_b.png', 'screen_dash.png']
    k = 0
    for i, (dx, dy, rot) in enumerate([(-0.6, -0.65, 0), (0.6, -0.65, 0), (-0.6, 0.65, 180), (0.6, 0.65, 180)]):
        desk(parent, cx + dx, cy + dy, rot, rnd, worker=k < n_workers, screen=screens[i % len(screens)]); k += 1
    box(cx - 1.22, cy - 0.04, 0.0, 2.44, 0.08, 1.05, mat('pale', 0.6), 0.02, parent)   # 中間隔板
    box(cx - 1.6, cy - 1.45, 0.0, 3.2, 2.9, 0.014, mat('#dbe7f4', 0.95), 0.03, parent)   # 地毯區


def rack(parent, x, y, rot=0.0, h=2.0):
    """GPU 機櫃：正面朝本地 +y，面板發光"""
    g = grp(x, y, 0, rot, parent, 'rack')
    box(-0.32, -0.5, 0.0, 0.64, 1.0, h, mat('rack', 0.35, 0.2), 0.02, g)
    quad(0, 0.505, h / 2, 0.54, h - 0.12, '+y', img_mat('rack_front.png', emit=2.6, rough=0.3), g)
    box(-0.3, 0.42, h, 0.6, 0.06, 0.03, mat('#5ed6ff', emit='#5ed6ff', emit_str=8), 0.0, g)
    box(-0.33, 0.47, 0.0, 0.66, 0.04, 0.06, mat('cobalt', 0.4), 0.0, g)
    return g


def plant(parent, x, y, size=1.0, kind='bush', rnd=None, pot='white'):
    rnd = rnd or random.Random(int(x * 100 + y))
    g = grp(x, y, 0, rnd.uniform(0, 90), parent, 'plant'); s = size
    cyl(0, 0, 0, 0.17 * s, 0.34 * s, mat(pot, 0.5), r_top=0.2 * s, parent=g)
    cyl(0, 0, 0.3 * s, 0.18 * s, 0.04 * s, mat('#6b4a36', 0.9), parent=g)
    greens = [mat('green', 0.6), mat('green2', 0.6), mat('green3', 0.6)]
    if kind == 'tall':
        cyl(0, 0, 0.3 * s, 0.025 * s, 0.9 * s, mat('#6b4a36', 0.8), parent=g)
        for i in range(7):
            a = i * 2.4
            sph(math.cos(a) * 0.2 * s, math.sin(a) * 0.2 * s, (0.75 + i * 0.12) * s, 0.2 * s, greens[i % 3], (1.1, 0.8, 0.6), g, ico=1)
    else:
        for i in range(5):
            a = i * 1.3
            sph(math.cos(a) * 0.12 * s, math.sin(a) * 0.12 * s, (0.48 + (i % 3) * 0.1) * s, (0.2 - i * 0.012) * s, greens[i % 3], parent=g, ico=1)
    return g


def whale_toy(parent, x, y, z, s=1.0, rot=0.0):
    """鯨魚抱枕：本地 +x 是頭"""
    g = grp(x, y, z, rot, parent, 'whale')
    body = mat('cobalt', 0.75); belly = mat('white', 0.8)
    sph(0, 0, 0.22 * s, 0.26 * s, body, (1.35, 1.0, 0.85), g)
    sph(0.08 * s, 0, 0.14 * s, 0.22 * s, belly, (1.15, 0.92, 0.55), g)
    sph(-0.38 * s, 0, 0.3 * s, 0.1 * s, body, (1.2, 0.7, 0.7), g)
    for sy in (-1, 1):
        f = sph(-0.5 * s, sy * 0.1 * s, 0.4 * s, 0.1 * s, body, (1.2, 0.55, 0.28), g)
        f.rotation_euler = (math.radians(sy * 25), math.radians(-20), 0)
        sph(0.27 * s, sy * 0.17 * s, 0.27 * s, 0.022 * s, mat('ink', 0.4), parent=g)
        sph(0.3 * s, sy * 0.21 * s, 0.2 * s, 0.03 * s, mat('#ffb3b3', 0.7), (1, 0.5, 0.6), g)
    return g


def sofa(parent, x, y, rot=0.0, w=1.8, color='cobalt'):
    g = grp(x, y, 0, rot, parent, 'sofa'); c = mat(color, 0.75)
    box(-w / 2, -0.4, 0.0, w, 0.8, 0.38, c, 0.06, g)
    box(-w / 2, 0.22, 0.38, w, 0.2, 0.42, c, 0.08, g)
    for sx in (-w / 2, w / 2 - 0.16):
        box(sx, -0.4, 0.38, 0.16, 0.8, 0.22, c, 0.06, g)
    sph(-w / 2 + 0.38, 0.1, 0.62, 0.17, mat('coral', 0.8), (1, 0.55, 1), g)
    sph(w / 2 - 0.42, 0.1, 0.62, 0.17, mat('white', 0.8), (1, 0.55, 1), g)
    return g


def coffee_table(parent, x, y, r=0.38):
    cyl(x, y, 0, 0.05, 0.38, mat('steel', 0.3, 0.6), parent=parent)
    cyl(x, y, 0.38, r, 0.04, mat('oak', 0.5), parent=parent)
    cyl(x + 0.1, y, 0.42, 0.04, 0.09, mat('coral', 0.5), parent=parent)


def bookshelf(parent, x, y, rot=0.0, w=1.2, h=1.8, rnd=None):
    rnd = rnd or random.Random(3)
    g = grp(x, y, 0, rot, parent, 'shelf'); wood = mat('oak', 0.55)
    box(-w / 2, -0.15, 0, w, 0.3, 0.04, wood, 0.01, g)
    for sx in (-w / 2, w / 2 - 0.04):
        box(sx, -0.15, 0, 0.04, 0.3, h, wood, 0.01, g)
    for i in range(4):
        z = 0.04 + i * (h - 0.08) / 4
        box(-w / 2, -0.15, z, w, 0.3, 0.03, wood, 0.01, g)
        bx = -w / 2 + 0.06
        while bx < w / 2 - 0.14:
            bw = rnd.uniform(0.05, 0.09); bh = rnd.uniform(0.22, 0.34)
            box(bx, -0.1, z + 0.03, bw, 0.22, bh, mat(rnd.choice(['navy', 'cobalt', 'sea', 'coral', 'mustard', 'white', 'mint'])), 0.005, g)
            bx += bw + 0.01
    box(-w / 2, -0.15, h - 0.03, w, 0.3, 0.04, wood, 0.01, g)
    return g


def coffee_bar(parent, x, y, rot=0.0, w=1.6):
    g = grp(x, y, 0, rot, parent, 'bar')
    box(-w / 2, -0.3, 0, w, 0.6, 0.86, mat('white', 0.5), 0.02, g)
    box(-w / 2 - 0.02, -0.32, 0.86, w + 0.04, 0.64, 0.05, mat('oak', 0.45), 0.012, g)
    box(-w / 2 + 0.15, -0.15, 0.91, 0.36, 0.34, 0.42, mat('ink', 0.35, 0.3), 0.03, g)
    box(-w / 2 + 0.2, 0.0, 1.05, 0.26, 0.2, 0.06, mat('steel', 0.25, 0.8), 0.01, g)
    for i, c in enumerate(['coral', 'sea', 'mustard']):
        cyl(0.05 + i * 0.16, 0.05, 0.91, 0.045, 0.1, mat(c, 0.5), parent=g)
    return g


def whiteboard(parent, cx, cy, cz, w, h, facing):
    m = mat('white', 0.4)
    if facing == '-y':
        box(cx - w / 2 - 0.04, cy - 0.03, cz - h / 2 - 0.04, w + 0.08, 0.04, h + 0.08, mat('steel', 0.3, 0.5), 0.01, parent)
        quad(cx, cy - 0.032, cz, w, h, '-y', img_mat('whiteboard.png', rough=0.25), parent)
    else:
        box(cx - 0.01, cy - w / 2 - 0.04, cz - h / 2 - 0.04, 0.04, w + 0.08, h + 0.08, mat('steel', 0.3, 0.5), 0.01, parent)
        quad(cx + 0.032, cy, cz, w, h, '+x', img_mat('whiteboard.png', rough=0.25), parent)
    return m


def framed(parent, cx, cy, cz, w, h, facing, file, frame='gold', emit=0.0):
    """牆上的框：海報、標誌、螢幕"""
    t = 0.04
    if facing == '-y':
        box(cx - w / 2 - 0.05, cy - t, cz - h / 2 - 0.05, w + 0.1, t, h + 0.1, mat(frame, 0.4, 0.3 if frame == 'gold' else 0), 0.01, parent)
        quad(cx, cy - t - 0.002, cz, w, h, '-y', img_mat(file, emit=emit, rough=0.45), parent)
    else:
        box(cx, cy - w / 2 - 0.05, cz - h / 2 - 0.05, t, w + 0.1, h + 0.1, mat(frame, 0.4, 0.3 if frame == 'gold' else 0), 0.01, parent)
        quad(cx + t + 0.002, cy, cz, w, h, '+x', img_mat(file, emit=emit, rough=0.45), parent)


def decal(parent, cx, cy, cz, w, h, facing, file, emit=0.0):
    off = {'-y': (0, -0.006), '+x': (0.006, 0)}[facing]
    quad(cx + off[0], cy + off[1], cz, w, h, facing, img_mat(file, emit=emit, alpha=True, rough=0.5), parent)


def rug(parent, cx, cy, size):
    quad(cx, cy, 0.006, size, size, '+z', img_mat('rug_whale.png', alpha=True, rough=0.9), parent)


def floor_lamp(parent, x, y):
    cyl(x, y, 0, 0.16, 0.03, mat('ink', 0.4), parent=parent)
    cyl(x, y, 0.03, 0.02, 1.45, mat('ink', 0.4), parent=parent)
    cyl(x, y, 1.42, 0.22, 0.26, mat('#fff4dc', 0.6, emit='#ffd89a', emit_str=5), r_top=0.14, parent=parent)


def boxes(parent, x, y, rnd, n=3):
    z = 0
    for i in range(n):
        w = rnd.uniform(0.45, 0.6); d = rnd.uniform(0.4, 0.55); h = rnd.uniform(0.3, 0.42)
        g = grp(x + rnd.uniform(-0.05, 0.05), y + rnd.uniform(-0.05, 0.05), z, rnd.uniform(-12, 12), parent, 'carton')
        box(-w / 2, -d / 2, 0, w, d, h, mat('card', 0.85), 0.012, g)
        box(-w / 2 - 0.002, -0.04, h - 0.004, w + 0.004, 0.08, 0.01, mat('#e6c48f', 0.7), 0.0, g)
        z += h


def beanbag(parent, x, y, color='sea'):
    sph(x, y, 0.22, 0.42, mat(color, 0.85), (1.0, 1.0, 0.55), parent)


def glass_wall(parent, x0, y0, x1, y1, h=2.2):
    """玻璃隔間（沿 x 或 y 方向一段）"""
    fr = mat('navy', 0.45)
    if abs(y1 - y0) < 1e-6:
        box(x0, y0 - 0.03, 0, x1 - x0, 0.06, 0.08, fr, 0.005, parent)
        box(x0, y0 - 0.03, h - 0.06, x1 - x0, 0.06, 0.06, fr, 0.005, parent)
        box(x0, y0 - 0.012, 0.08, x1 - x0, 0.024, h - 0.14, glass(), 0.0, parent)
        n = max(1, int((x1 - x0) / 1.2))
        for i in range(n + 1):
            box(x0 + (x1 - x0) * i / n - 0.025, y0 - 0.03, 0, 0.05, 0.06, h, fr, 0.005, parent)
    else:
        box(x0 - 0.03, y0, 0, 0.06, y1 - y0, 0.08, fr, 0.005, parent)
        box(x0 - 0.03, y0, h - 0.06, 0.06, y1 - y0, 0.06, fr, 0.005, parent)
        box(x0 - 0.012, y0, 0.08, 0.024, y1 - y0, h - 0.14, glass(), 0.0, parent)
        n = max(1, int((y1 - y0) / 1.2))
        for i in range(n + 1):
            box(x0 - 0.03, y0 + (y1 - y0) * i / n - 0.025, 0, 0.06, 0.05, h, fr, 0.005, parent)


def aquarium(parent, x0, y, w, h=1.6, rnd=None):
    """靠右牆的長水族箱，裡面有一隻小鯨魚"""
    rnd = rnd or random.Random(5)
    d = 0.7
    box(x0, y - d, 0, w, d, 0.55, mat('navy', 0.5), 0.02, parent)
    box(x0, y - d, 0.55 + h, w, d, 0.1, mat('navy', 0.5), 0.02, parent)
    quad(x0 + w / 2, y - 0.02, 0.55 + h / 2, w - 0.04, h, '-y', img_mat('water.png', emit=1.6), parent)
    box(x0 + 0.02, y - d + 0.02, 0.55, w - 0.04, d - 0.04, 0.12, mat('#e8d6a8', 0.9), 0.02, parent)
    box(x0 + 0.01, y - d + 0.01, 0.55, w - 0.02, d - 0.02, h, glass('#cfefff', 0.02), 0.0, parent)
    for i in range(int(w * 2.2)):
        sx = x0 + 0.2 + i * (w - 0.4) / max(1, int(w * 2.2) - 1)
        sph(sx, y - 0.25 - rnd.uniform(0, 0.2), 0.67 + rnd.uniform(0.15, 0.4), 0.08, mat(rnd.choice(['green', 'green2', 'green3']), 0.6), (0.6, 0.6, 3.0), parent, ico=1)
    whale_toy(parent, x0 + w * 0.55, y - 0.38, 0.55 + h * 0.36, 0.95, 160)
    for i in range(6):
        sph(x0 + rnd.uniform(0.3, w - 0.3), y - 0.3, 0.55 + rnd.uniform(0.4, h - 0.2), 0.05, mat('#ff9d5c', 0.5), (1.6, 0.7, 0.9), parent)
    for i in range(14):
        sph(x0 + rnd.uniform(0.2, w - 0.2), y - 0.3, 0.55 + rnd.uniform(0.3, h - 0.1), rnd.uniform(0.015, 0.03), mat('white', 0.2, emit='#e9fbff', emit_str=1.5), parent=parent)
    light(parent, 'POINT', (x0 + w / 2, y - 0.9, 1.5), 120, '#7fd4ff', 1.2)


def big_screen(parent, cx, cy, cz, w, h, file, facing='-y'):
    if facing == '-y':
        box(cx - w / 2 - 0.06, cy - 0.06, cz - h / 2 - 0.06, w + 0.12, 0.06, h + 0.12, mat('ink', 0.35), 0.015, parent)
        quad(cx, cy - 0.062, cz, w, h, '-y', img_mat(file, emit=2.4), parent)
    else:
        box(cx, cy - w / 2 - 0.06, cz - h / 2 - 0.06, 0.06, w + 0.12, h + 0.12, mat('ink', 0.35), 0.015, parent)
        quad(cx + 0.062, cy, cz, w, h, '+x', img_mat(file, emit=2.4), parent)


def indoor_tree(parent, x, y, s=1.0):
    cyl(x, y, 0, 1.05 * s, 0.45, mat('white', 0.5), parent=parent)
    cyl(x, y, 0.45, 1.0 * s, 0.03, mat('#6b4a36', 0.9), parent=parent)
    cyl(x, y, 0.45, 0.13 * s, 1.6 * s, mat('#8a5f3e', 0.8), r_top=0.08 * s, parent=parent)
    rnd = random.Random(11)
    for i in range(14):
        a = i * 2.39; rr = 0.25 + (i % 4) * 0.18
        sph(x + math.cos(a) * rr * s, y + math.sin(a) * rr * s, (1.95 + (i % 5) * 0.16) * s, (0.42 - (i % 3) * 0.06) * s,
            mat(['green', 'green2', 'green3'][i % 3], 0.65), parent=parent, ico=1)
    for i in range(10):
        a = i * 0.63
        sph(x + math.cos(a) * 0.8 * s, y + math.sin(a) * 0.8 * s, 0.55, 0.13, mat(['green3', 'coral', 'mustard'][i % 3], 0.6), parent=parent, ico=1)


def robot_arm(parent, x, y, rot=0.0, s=1.4):
    """機器手臂：本地 +y 是手伸出去的方向；關節用空物件串起來"""
    g = grp(x, y, 0, rot, parent, 'robot')
    w, n = mat('white', 0.3), mat('cobalt', 0.4)
    led = mat('#5ed6ff', emit='#5ed6ff', emit_str=6)
    cyl(0, 0, 0, 0.42 * s, 0.08 * s, mat('navy', 0.4), parent=g)
    cyl(0, 0, 0.08 * s, 0.26 * s, 0.32 * s, w, parent=g)
    cyl(0, 0, 0.4 * s, 0.27 * s, 0.05 * s, led, parent=g)
    j1 = grp(0, 0, 0.5 * s, 0, g, 'shoulder'); j1.rotation_euler = (math.radians(-30), 0, 0)
    sph(0, 0, 0, 0.17 * s, n, parent=j1)
    box(-0.1 * s, -0.1 * s, 0, 0.2 * s, 0.2 * s, 0.95 * s, w, 0.06 * s, j1)
    j2 = grp(0, 0, 0.95 * s, 0, j1, 'elbow'); j2.rotation_euler = (math.radians(-95), 0, 0)
    sph(0, 0, 0, 0.14 * s, n, parent=j2)
    box(-0.08 * s, -0.08 * s, 0, 0.16 * s, 0.16 * s, 0.75 * s, w, 0.05 * s, j2)
    j3 = grp(0, 0, 0.75 * s, 0, j2, 'wrist')
    cyl(0, 0, 0, 0.09 * s, 0.06 * s, led, parent=j3)
    for sx in (-0.06, 0.06):
        box((sx - 0.02) * s, -0.03 * s, 0.06 * s, 0.04 * s, 0.06 * s, 0.16 * s, mat('steel', 0.3, 0.7), 0.01, j3)
    return g


def mini_bot(parent, x, y, rot=0.0):
    """圓滾滾的小機器人：白色身體、深色面罩、藍光眼睛"""
    g = grp(x, y, 0, rot, parent, 'bot')
    cyl(0, 0, 0.0, 0.26, 0.1, mat('navy', 0.4), parent=g)
    sph(0, 0, 0.42, 0.34, mat('white', 0.3), (1, 1, 1.05), g)
    sph(0, 0.12, 0.52, 0.24, mat('ink', 0.2), (1.05, 0.72, 0.72), g)
    for sx in (-0.08, 0.08):
        sph(sx, 0.285, 0.54, 0.035, mat('#5ed6ff', emit='#5ed6ff', emit_str=8), (1, 0.5, 1.3), g)
    cyl(0, 0, 0.78, 0.012, 0.16, mat('steel', 0.3, 0.7), parent=g)
    sph(0, 0, 0.96, 0.04, mat('coral', emit='#ff8f8f', emit_str=3), parent=g)
    return g


def sign_panel(r, cx, cz, w, h, D):
    """右牆上的深藍招牌底板 + 「模型帝國」字樣"""
    box(cx - w / 2 - 0.15, D - 0.06, cz - h / 2 - 0.12, w + 0.3, 0.05, h + 0.24, mat('navy', 0.5), 0.02, r)
    decal(r, cx, D - 0.065, cz, w, h, '-y', 'sign.png', emit=0.25)


def holo_globe(parent, x, y, r=1.0):
    cyan = mat('#7fe6ff', 0.3, emit='#53d8ff', emit_str=7)
    gold = mat('gold', 0.3, 0.5, emit='#ffd27a', emit_str=4)
    cyl(x, y, 0, 1.6 * r, 0.18, mat('navy', 0.4), parent=parent)
    cyl(x, y, 0.18, 1.45 * r, 0.03, mat('#bfefff', 0.2, emit='#53d8ff', emit_str=3), parent=parent)
    cyl(x, y, 0.21, 0.35 * r, 0.25, mat('ink', 0.4), parent=parent)
    g = sph(x, y, 1.75 * r, 0.95 * r, cyan, parent=parent, seg=32)
    md = g.modifiers.new('wf', 'WIREFRAME'); md.thickness = 0.022; md.use_replace = True
    sph(x, y, 1.75 * r, 0.9 * r, mat('#2f6fd6', 0.4, emit='#2f6fd6', emit_str=0.8), parent=parent, seg=32)
    torus(x, y, 1.75 * r, 1.25 * r, 0.018, gold, parent, tilt=(70, 10, 0))
    torus(x, y, 1.75 * r, 1.4 * r, 0.014, cyan, parent, tilt=(105, -20, 30))
    light(parent, 'POINT', (x, y, 1.75 * r), 400, '#7fe6ff', 1.5)


def light(parent, kind, loc, power, color, size=0.5):
    ld = bpy.data.lights.new('l', kind); ld.energy = power; ld.color = lin(color)[:3]
    if kind in ('POINT', 'SPOT'):
        ld.shadow_soft_size = size
    ob = bpy.data.objects.new('l', ld); ob.location = loc
    return _link(ob, parent)


def string_lights(parent, pts):
    """沿牆頂的小燈串"""
    bulbs = mat('#fff1c9', 0.3, emit='#ffd27a', emit_str=10); out = []
    for (a, b) in zip(pts, pts[1:]):
        n = max(2, int((Vector(b) - Vector(a)).length / 0.32))
        for i in range(n):
            t = i / n
            p = Vector(a).lerp(Vector(b), t); p.z -= math.sin(math.pi * t) * 0.18
            out.append(tuple(p)); sph(p.x, p.y, p.z - 0.05, 0.035, bulbs, parent=parent)
    out.append(pts[-1])
    wire(out, mat('ink', 0.5), 0.005, parent)


# ---------- 房間 ----------
def room(W, D, H, floor='wood', windows=(), sky='sky_day.png'):
    """底座 + 地板 + 左右兩面牆（含窗戶、腰牆、踢腳板、牆頂深藍收邊）"""
    root = grp(name='room')
    T = 0.25
    box(-T, 0, -0.32, W + T, D + T, 0.32, mat('navy', 0.55), 0.03, root)
    if floor == 'wood':
        fm = img_mat('wood_floor.png', rough=0.45, scale=(W / 3.2, D / 3.2), name=f'floor_wood_{W}_{D}')
    else:
        fm = node_mat('concrete', 'concrete')
    q = quad(W / 2, D / 2, 0.002, W, D, '+z', fm, root)
    wallm = mat('wall', 0.85); pale = mat('pale', 0.8); navy = mat('navy', 0.5); trim = mat('white', 0.5)
    # 右牆（y=D，內面朝 -y）：整面
    box(0, D, 0, W, T, H, wallm, 0.0, root)
    box(0, D - 0.015, 0, W, 0.02, 0.95, pale, 0.0, root)
    box(0, D - 0.03, 0.93, W, 0.03, 0.04, trim, 0.0, root)
    box(0, D - 0.025, 0, W, 0.025, 0.09, navy, 0.0, root)
    # 左牆（x=0，內面朝 +x）：依窗戶切成數段
    ys = sorted(windows)
    edges = [0.0]
    for (y0, y1, z0, z1) in ys:
        edges += [y0, y1]
    edges.append(D + T)
    for i in range(0, len(edges), 2):
        a, b = edges[i], edges[i + 1]
        if b > a:
            box(-T, a, 0, T, b - a, H, wallm, 0.0, root)
    for (y0, y1, z0, z1) in ys:
        box(-T, y0, 0, T, y1 - y0, z0, wallm, 0.0, root)
        box(-T, y0, z1, T, y1 - y0, H - z1, wallm, 0.0, root)
        fr = mat('white', 0.4)
        # 窗框一路做到玻璃，窗台內側才不會留一條陰影縫
        box(-0.16, y0 - 0.06, z0 - 0.06, 0.2, y1 - y0 + 0.12, 0.08, fr, 0.01, root)
        box(-0.16, y0 - 0.06, z1 - 0.02, 0.2, y1 - y0 + 0.12, 0.08, fr, 0.01, root)
        box(-0.16, y0 - 0.06, z0, 0.2, 0.08, z1 - z0, fr, 0.01, root)
        box(-0.16, y1 - 0.02, z0, 0.2, 0.08, z1 - z0, fr, 0.01, root)
        box(-0.1, (y0 + y1) / 2 - 0.025, z0, 0.1, 0.05, z1 - z0, fr, 0.01, root)
        box(-0.02, y0 - 0.08, z0 - 0.06, 0.16, y1 - y0 + 0.16, 0.04, trim, 0.01, root)
        box(-0.16, y0, z0, 0.01, y1 - y0, z1 - z0, glass('#e8f6ff', 0.02), 0.0, root)
        # 窗外景：貼在牆後 0.4m，往 +y、-z 偏移（視線斜著穿過窗戶），不超出房間範圍以免從牆角露出
        quad(-0.4, (y0 + y1) / 2 + 0.35, (z0 + z1) / 2 - 0.25, (y1 - y0) + 0.7, (z1 - z0) + 0.5, '+x', img_mat(sky, emit=1.4), root)
    for i in range(0, len(edges), 2):
        a, b = max(0.0, edges[i]), min(D, edges[i + 1])
        if b > a:
            box(0, a, 0, 0.015, b - a, 0.95, pale, 0.0, root)
            box(0, a, 0.93, 0.03, b - a, 0.04, trim, 0.0, root)
    for (y0, y1, z0, z1) in ys:
        box(0, y0 - 0.06, 0, 0.015, y1 - y0 + 0.12, min(0.95, z0 - 0.06), pale, 0.0, root)
    box(0, 0, 0, 0.025, D, 0.09, navy, 0.0, root)
    # 牆頂收邊
    box(-T - 0.01, -0.01, H, T + 0.02, D + T + 0.02, 0.05, navy, 0.01, root)
    box(-T - 0.01, D - 0.01, H, W + T + 0.02, T + 0.02, 0.05, navy, 0.01, root)
    return root


# ---------- 相機、燈光、輸出 ----------
def setup(W, D, H, preview, extra_top=0.0):
    sc = bpy.context.scene
    world = bpy.data.worlds.new('world'); sc.world = world; world.use_nodes = True
    bg = world.node_tree.nodes['Background']; bg.inputs[0].default_value = lin('#e3eefa'); bg.inputs[1].default_value = 0.9
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.4; sun.angle = math.radians(10); sun.color = (1.0, 0.95, 0.88)
    so = bpy.data.objects.new('sun', sun); _link(so)
    so.rotation_euler = Vector((-0.38, 0.75, -0.95)).to_track_quat('-Z', 'Y').to_euler()
    fill = bpy.data.lights.new('fill', 'AREA'); fill.energy = 55 * W * D / 10; fill.size = max(W, D); fill.color = (1.0, 0.97, 0.92)
    fo = bpy.data.objects.new('fill', fill); fo.location = (W / 2, D / 2, H + 4); _link(fo)
    # 不放陰影承接面：牆的投影會被畫面邊緣切掉；底座的落影改由介面 CSS drop-shadow 處理
    # 正交相機：依房間 8 個角落算取景
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.clip_end = 300
    cam = bpy.data.objects.new('cam', cd); _link(cam); sc.camera = cam
    rot = Euler((math.radians(60), 0, math.radians(45)))
    cam.rotation_euler = rot
    m = rot.to_matrix(); right = m @ Vector((1, 0, 0)); up = m @ Vector((0, 1, 0)); fwd = m @ Vector((0, 0, -1))
    pts = [Vector((x, y, z)) for x in (-0.3, W) for y in (0, D + 0.3) for z in (-0.34, H + 0.06 + extra_top)]
    xs = [p.dot(right) for p in pts]; ys = [p.dot(up) for p in pts]
    rx, ry = (1600, 1100) if not preview else (800, 550)
    sc.render.resolution_x, sc.render.resolution_y = rx, ry
    wv, hv = max(xs) - min(xs), max(ys) - min(ys)
    cd.ortho_scale = max(wv, hv * rx / ry) * 1.06
    center = right * ((max(xs) + min(xs)) / 2) + up * ((max(ys) + min(ys)) / 2)
    cam.location = center - fwd * 60
    # 輸出
    sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'OPTIX'
    prefs.refresh_devices() if hasattr(prefs, 'refresh_devices') else prefs.get_devices()
    for dv in prefs.devices:
        dv.use = dv.type == 'OPTIX'
    sc.cycles.device = 'GPU'
    sc.cycles.samples = 32 if preview else 192
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'AgX'
    for look in ('AgX - Medium High Contrast', 'Medium High Contrast'):
        try:
            sc.view_settings.look = look; break
        except TypeError:
            pass
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'


# ---------- 各級辦公室 ----------
def lounge(r, x, y, w=2.0):
    """沙發朝 -y（面向鏡頭左前方），前面放茶几與地毯"""
    rug(r, x, y - 0.75, 2.2)
    sofa(r, x, y, 0, w); coffee_table(r, x, y - 1.0); whale_toy(r, x - 0.45, y - 0.05, 0.4, 0.7, -60)


def meeting(r, x, y, rnd, n=3):
    cyl(x, y, 0, 0.06, 0.72, mat('steel', 0.3, 0.6), parent=r)
    cyl(x, y, 0.72, 0.55, 0.04, mat('white', 0.4), parent=r)
    cyl(x + 0.15, y - 0.1, 0.76, 0.12, 0.01, mat('#cfe3ff', 0.4), parent=r)
    for k in range(n):
        a = math.radians(-90 + k * 360 / n)
        px, py = x + math.cos(a) * 0.95, y + math.sin(a) * 0.95
        face = math.degrees(math.atan2(-(x - px), (y - py)))
        chair(r, px, py, face); person(r, px, py, 0.0, rnd, face)


def level0(rnd):
    """車庫：水泥地、捲門、燈串、兩座二手機櫃、紙箱與鯨魚抱枕"""
    W, D, H = 6.0, 5.0, 2.6
    r = room(W, D, H, floor='concrete', windows=[(1.4, 2.6, 1.2, 2.05)])
    door = mat('#cfd6df', 0.45, 0.35)
    for i in range(14):
        box(1.0, D - 0.06, 0.05 + i * 0.165, 3.4, 0.05, 0.15, door, 0.01, r)
    for x in (0.9, 4.4):
        box(x, D - 0.1, 0, 0.12, 0.1, 2.4, mat('steel', 0.4, 0.5), 0.01, r)
    box(0.9, D - 0.12, 2.36, 3.62, 0.12, 0.16, mat('steel', 0.4, 0.5), 0.01, r)
    decal(r, 2.7, D - 0.075, 1.35, 1.1, 1.1, '-y', 'whale_logo.png')
    string_lights(r, [(0.02, 0.3, H - 0.08), (0.02, D - 0.05, H - 0.08), (W - 0.2, D - 0.03, H - 0.08)])
    rug(r, 2.7, 2.35, 2.8)
    desk(r, 2.7, 1.7, 0, rnd, screen='screen_loss.png')
    desk(r, 2.7, 3.0, 180, rnd, screen='screen_code_a.png')
    box(3.35, 2.6, 0.0, 0.5, 0.45, 0.42, mat('card', 0.85), 0.012, r)
    box(3.37, 2.62, 0.42, 0.46, 0.41, 0.05, mat('#d9b27c', 0.8), 0.01, r)
    rack(r, 0.55, 3.6, -90, h=1.5)
    rack(r, 0.55, 4.35, -90, h=1.5)
    boxes(r, 5.35, 4.45, rnd, 2)
    boxes(r, 5.4, 3.5, rnd, 3)
    beanbag(r, 1.2, 0.85, 'coral'); whale_toy(r, 1.2, 0.85, 0.32, 0.8, -30)
    box(0.22, 1.55, 0, 0.55, 0.55, 0.85, mat('white', 0.4), 0.03, r)
    sofa(r, 4.9, 1.0, 0, 1.6, 'sea')
    framed(r, 0.03, 3.0, 1.55, 0.5, 0.66, '+x', 'poster_dafeiyu.png', frame='oak')
    floor_lamp(r, 5.7, 2.15)
    plant(r, 0.5, 2.85, 0.9, 'bush', rnd, 'coral')
    return W, D, H


def level1(rnd):
    """新創辦公室：木地板、兩扇窗、島型桌、玻璃機房角、咖啡吧、書櫃"""
    W, D, H = 8.0, 6.5, 2.7
    r = room(W, D, H, windows=[(0.8, 2.2, 0.95, 2.2), (3.4, 4.8, 0.95, 2.2)])
    box(0.6, D - 0.04, 0.2, 2.6, 0.03, 2.3, mat('cobalt', 0.6), 0.0, r)
    decal(r, 1.9, D - 0.045, 1.45, 1.5, 1.5, '-y', 'whale_logo.png', emit=0.4)
    whiteboard(r, 4.4, D - 0.02, 1.5, 1.8, 1.1, '-y')
    framed(r, 5.85, D - 0.02, 1.6, 0.48, 0.64, '-y', 'poster_dafeiyu.png')
    pod(r, 3.9, 2.7, rnd, 4)
    glass_wall(r, 6.2, D - 1.6, W, D - 1.6, 2.2)
    for x in (6.65, 7.35):
        rack(r, x, D - 0.62, 180)
    box(6.2, D - 1.6, 0.003, W - 6.2, 1.6, 0.004, node_mat('tile', 'tile'), 0.0, r)
    coffee_bar(r, 0.45, 5.6, -90, 1.3)
    bookshelf(r, 0.2, 2.8, -90, 1.0, 1.7, rnd)
    beanbag(r, 6.6, 1.3, 'sea'); whale_toy(r, 6.6, 1.3, 0.32, 0.8, -40)
    rug(r, 6.5, 1.5, 1.8)
    plant(r, 0.45, 0.45, 1.2, 'tall', rnd); plant(r, 5.4, D - 0.45, 1.0, 'bush', rnd)
    plant(r, W - 0.5, 0.5, 1.0, 'bush', rnd, 'coral')
    floor_lamp(r, 7.5, 2.3)
    return W, D, H


def level2(rnd):
    """科技園整層：兩組島型桌、玻璃會議室、四櫃機房、休息區、大螢幕"""
    W, D, H = 11.0, 8.0, 2.8
    r = room(W, D, H, windows=[(0.8, 2.3, 0.95, 2.3), (2.9, 4.4, 0.95, 2.3), (5.0, 6.5, 0.95, 2.3)], sky='sky_city.png')
    # 會議室（左後角）：品牌牆 + 圓桌
    glass_wall(r, 0.0, D - 2.6, 3.0, D - 2.6, 2.3); glass_wall(r, 3.0, D - 2.6, 3.0, D, 2.3)
    box(0.3, D - 0.04, 0.2, 2.4, 0.03, 2.4, mat('cobalt', 0.6), 0.0, r)
    decal(r, 1.5, D - 0.045, 1.55, 1.4, 1.4, '-y', 'whale_logo.png', emit=0.4)
    meeting(r, 1.5, D - 1.35, rnd, 3)
    big_screen(r, 5.3, D - 0.02, 1.6, 2.6, 1.46, 'screen_wall.png')
    framed(r, 7.05, D - 0.02, 1.6, 0.48, 0.64, '-y', 'poster_dafeiyu.png')
    pod(r, 3.6, 3.4, rnd, 4); pod(r, 6.3, 3.4, rnd, 3)
    # 機房（右後角）
    glass_wall(r, 7.6, D - 2.1, W, D - 2.1, 2.3); glass_wall(r, 7.6, D - 2.1, 7.6, D, 2.3)
    box(7.6, D - 2.1, 0.003, W - 7.6, 2.1, 0.004, node_mat('tile', 'tile'), 0.0, r)
    for i in range(4):
        rack(r, 8.1 + i * 0.72, D - 0.62, 180)
    lounge(r, 9.4, 2.9)
    coffee_bar(r, 0.45, 1.2, -90, 1.6)
    plant(r, 0.45, 4.65, 1.2, 'tall', rnd); plant(r, 7.25, D - 0.45, 1.0, 'bush', rnd)
    plant(r, W - 0.45, 0.45, 1.1, 'tall', rnd); plant(r, 3.0, 0.45, 0.9, 'bush', rnd, 'coral')
    floor_lamp(r, W - 0.5, 4.2)
    return W, D, H


def level3(rnd):
    """總部大樓：鯨魚水族箱牆、接待櫃台與招牌、三組島型桌、六櫃機房"""
    W, D, H = 13.0, 9.5, 2.9
    r = room(W, D, H, windows=[(0.8, 2.4, 0.95, 2.4), (3.0, 4.6, 0.95, 2.4), (5.2, 6.8, 0.95, 2.4)], sky='sky_city.png')
    aquarium(r, 0.5, D, 4.6, 1.7, rnd)
    sign_panel(r, 7.0, 2.3, 3.2, 0.8, D)
    box(5.6, D - 1.4, 0, 2.8, 0.6, 1.05, mat('navy', 0.5), 0.03, r)
    box(5.55, D - 1.45, 1.05, 2.9, 0.7, 0.05, mat('white', 0.4), 0.015, r)
    decal(r, 7.0, D - 1.405, 0.55, 0.7, 0.7, '-y', 'whale_logo.png', emit=0.3)
    person(r, 7.0, D - 0.55, 0.0, rnd, 180, seated=False, shirt='navy')
    pod(r, 3.4, 4.0, rnd, 4); pod(r, 6.1, 4.0, rnd, 4); pod(r, 8.8, 4.0, rnd, 3)
    glass_wall(r, 8.9, D - 2.3, W, D - 2.3, 2.4); glass_wall(r, 8.9, D - 2.3, 8.9, D, 2.4)
    box(8.9, D - 2.3, 0.003, W - 8.9, 2.3, 0.004, node_mat('tile', 'tile'), 0.0, r)
    for i in range(6):
        rack(r, 9.3 + i * 0.66, D - 0.62, 180)
    big_screen(r, 0.02, 7.6, 1.5, 1.4, 0.8, 'screen_dash.png', '+x')
    lounge(r, 11.4, 2.6)
    coffee_bar(r, 0.45, 1.2, -90, 1.6)
    for (x, y, k) in [(0.45, 2.7, 'tall'), (12.5, 0.5, 'tall'), (4.6, 0.5, 'bush'), (8.5, D - 0.5, 'bush'), (0.45, 7.0, 'bush')]:
        plant(r, x, y, 1.1, k, rnd)
    return W, D, H


def level4(rnd):
    """研發園區：室內大樹中庭、機器手臂實驗區、四組島型桌、六櫃機房與冷卻管"""
    W, D, H = 15.0, 10.5, 3.0
    r = room(W, D, H, windows=[(0.8, 2.6, 0.95, 2.5), (3.2, 5.0, 0.95, 2.5), (5.6, 7.4, 0.95, 2.5), (7.9, 9.5, 0.95, 2.5)], sky='sky_park.png')
    indoor_tree(r, 7.6, 4.9, 1.1)
    for k, a in enumerate(range(15, 360, 60)):
        px, py = 7.6 + math.cos(math.radians(a)) * 1.6, 4.9 + math.sin(math.radians(a)) * 1.6
        cyl(px, py, 0, 0.2, 0.42, mat(['mustard', 'coral', 'sea'][k % 3], 0.6), parent=r)
    pod(r, 4.0, 2.4, rnd, 4); pod(r, 4.0, 5.6, rnd, 4); pod(r, 11.6, 2.4, rnd, 4); pod(r, 11.6, 5.6, rnd, 3)
    big_screen(r, 7.6, D - 0.02, 1.7, 3.0, 1.68, 'screen_wall.png')
    sign_panel(r, 3.4, 2.25, 3.2, 0.8, D)
    glass_wall(r, 10.6, D - 2.4, W, D - 2.4, 2.5); glass_wall(r, 10.6, D - 2.4, 10.6, D, 2.5)
    box(10.6, D - 2.4, 0.003, W - 10.6, 2.4, 0.004, node_mat('tile', 'tile'), 0.0, r)
    for i in range(6):
        rack(r, 11.05 + i * 0.68, D - 0.62, 180, h=2.2)
    for k in range(3):
        cyl(10.7, D - 0.25 - k * 0.14, 2.55, 0.06, W - 10.7, mat('steel', 0.3, 0.7), parent=r).rotation_euler = (0, math.radians(90), 0)
    # 機器人實驗區（左前）
    box(0.0, 0.0, 0.003, 2.6, 2.6, 0.006, mat('#ffe7a8', 0.7), 0.0, r)
    for i in range(10):
        c = mat('ink', 0.6) if i % 2 else mat('#ffcf5a', 0.5)
        box(2.55, i * 0.26, 0.003, 0.1, 0.26, 0.012, c, 0.0, r)
        box(i * 0.26, 2.55, 0.003, 0.26, 0.1, 0.012, c, 0.0, r)
    robot_arm(r, 0.85, 1.55, -90)
    box(1.75, 1.25, 0, 0.6, 0.6, 0.7, mat('white', 0.4), 0.02, r)
    box(1.88, 1.4, 0.7, 0.3, 0.3, 0.22, mat('card', 0.85), 0.012, r)
    mini_bot(r, 0.65, 0.6, -135)
    person(r, 2.15, 0.55, 0.0, rnd, -150, seated=False, shirt='white')
    framed(r, 0.02, 2.9, 1.7, 0.48, 0.64, '+x', 'poster_dafeiyu.png')
    lounge(r, 13.6, 1.75)
    for (x, y, k) in [(0.45, 9.85, 'tall'), (14.5, 4.0, 'bush'), (6.2, 0.5, 'bush'), (9.0, 0.5, 'tall')]:
        plant(r, x, y, 1.15, k, rnd)
    return W, D, H


def level5(rnd):
    """全球研發網：全息地球指揮中心、環形控制台、全球網路大螢幕、三排機房、海景"""
    W, D, H = 17.0, 11.5, 3.1
    r = room(W, D, H, windows=[(0.8, 2.8, 0.95, 2.6), (3.4, 5.4, 0.95, 2.6), (6.0, 8.0, 0.95, 2.6), (8.4, 10.4, 0.95, 2.6)], sky='sky_sea.png')
    gx, gy = 7.9, 5.6
    holo_globe(r, gx, gy, 1.15)
    for i in range(8):
        a = math.radians(22.5 + i * 45)
        dx, dy = math.cos(a) * 2.95, math.sin(a) * 2.95
        desk(r, gx + dx, gy + dy, math.degrees(math.atan2(dx, -dy)), rnd, screen=['screen_loss.png', 'screen_dash.png', 'screen_code_a.png'][i % 3])
    big_screen(r, gx, D - 0.02, 1.85, 4.6, 2.3, 'screen_net.png')
    aquarium(r, 0.5, D, 3.2, 1.6, rnd)
    sign_panel(r, 2.1, 2.66, 2.2, 0.55, D)
    framed(r, 4.6, D - 0.02, 1.7, 0.48, 0.64, '-y', 'poster_dafeiyu.png')
    pod(r, 2.6, 2.6, rnd, 4); pod(r, 2.6, 5.5, rnd, 4)
    glass_wall(r, 12.2, 3.6, 12.2, D, 2.6); glass_wall(r, 12.2, 3.6, W, 3.6, 2.6)
    box(12.2, 3.6, 0.003, W - 12.2, D - 3.6, 0.004, node_mat('tile', 'tile'), 0.0, r)
    for row_y in (D - 0.62, 8.0, 5.2):
        for i in range(6):
            rack(r, 12.65 + i * 0.7, row_y, 180, h=2.3)
    lounge(r, 14.6, 1.95, 2.2)
    for (x, y, k) in [(0.45, 3.1, 'tall'), (11.6, 0.5, 'tall'), (16.5, 0.5, 'bush'), (5.4, 0.5, 'bush')]:
        plant(r, x, y, 1.2, k, rnd)
    return W, D, H


LEVELS = [level0, level1, level2, level3, level4, level5]


def build(lv, preview):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()
    rnd = random.Random(100 + lv)
    W, D, H = LEVELS[lv](rnd)
    setup(W, D, H, preview, extra_top=1.4 if lv == 5 else 0.0)
    out_png = os.path.join(ROOT, 'art', 'raw', f'office_{lv}' + ('_preview' if preview else '') + '.png')
    bpy.context.scene.render.filepath = out_png
    os.makedirs(os.path.join(ROOT, 'art', 'blender'), exist_ok=True)
    if not preview:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'art', 'blender', f'office_{lv}.blend'), relative_remap=True)
    bpy.ops.render.render(write_still=True)
    print('RENDERED', out_png)


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['0']
    preview = '--preview' in args
    which = [a for a in args if not a.startswith('--')]
    lvs = range(6) if (not which or which[0] == 'all') else [int(a) for a in which]
    for lv in lvs:
        build(lv, preview)
