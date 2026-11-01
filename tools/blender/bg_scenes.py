"""模型帝國 UI 背景：用 Blender 腳本程序化生成 16:9 背景，給第二輪「舟味懸浮 UI」使用。

用法（Blender 5.x，背景執行）：
  blender --background --factory-startup --python tools/blender/bg_scenes.py -- hall            # E 眺望前沿：算力大殿
  blender --background --factory-startup --python tools/blender/bg_scenes.py -- canyon          # F 深層機房：機櫃峽谷
  blender --background --factory-startup --python tools/blender/bg_scenes.py -- studio          # H 白色工業：純白展台
  加 --preview 會用低解析度、低取樣快速預覽。
輸出：art/raw/bg_{scene}.png（預覽版為 bg_{scene}_preview.png），正式版另存 art/blender/bg_{scene}.blend。
之後用 tools/bg_post.py 加光暈、壓 WebP 到 art/cut/。

做法參考 art/ui-research/ark-ui-breakdown.md 第 6 節：
- 全部程序化生成，大量重複模組
- 一點透視
- 灰白工業材質配一個飽和色
- 日光光束加體積霧
"""
import bpy
import bmesh
import math
import os
import random
import sys
from mathutils import Euler, Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))


def lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c) + (1.0,)


# ---------- 材質 ----------
_mats = {}


def mat(key, color, rough=0.5, metal=0.0, emit=None, emit_str=0.0, coat=0.0):
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(key); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = lin(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    if emit:
        b.inputs['Emission Color'].default_value = lin(emit); b.inputs['Emission Strength'].default_value = emit_str
    _mats[key] = m
    return m


def _noise_ramp(m, c1, c2, scale, detail=10.0):
    nt = m.node_tree
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = detail; nz.inputs['Roughness'].default_value = 0.62
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.3; ramp.color_ramp.elements[0].color = lin(c1)
    ramp.color_ramp.elements[1].position = 0.75; ramp.color_ramp.elements[1].color = lin(c2)
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    nt.links.new(nz.outputs['Fac'], ramp.inputs['Fac'])
    return nz, ramp


def concrete(key, c1, c2, scale=0.9, rough=0.82, bump=0.12):
    """清水混凝土：雜訊明暗＋輕微凹凸"""
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(key); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    nz, ramp = _noise_ramp(m, c1, c2, scale)
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump
    nt.links.new(nz.outputs['Fac'], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = rough
    _mats[key] = m
    return m


def varied(key, c1, c2, rough=0.3, metal=1.0):
    """每個物件隨機取 c1~c2 之間的顏色（金色晶圓、機殼深淺）"""
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(key); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    oi = nt.nodes.new('ShaderNodeObjectInfo')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = lin(c1); ramp.color_ramp.elements[1].color = lin(c2)
    nt.links.new(oi.outputs['Random'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    _mats[key] = m
    return m


# ---------- 幾何（全部以中心點定位，單位公尺） ----------
def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def mesh_obj(name, bm, m, loc=(0, 0, 0), rot=(0, 0, 0), smooth=False):
    if smooth:
        for f in bm.faces:
            f.smooth = True
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    if m:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me); ob.location = loc; ob.rotation_euler = rot
    return link(ob)


def box(cx, cy, cz, sx, sy, sz, m, bevel=0.0, rot=(0, 0, 0), name='box'):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= sx; v.co.y *= sy; v.co.z *= sz
    ob = mesh_obj(name, bm, m, (cx, cy, cz), rot)
    if bevel > 0:
        md = ob.modifiers.new('bevel', 'BEVEL'); md.width = min(bevel, sx / 2.2, sy / 2.2, sz / 2.2); md.segments = 2
    return ob


_AXIS_ROT = {'z': (0, 0, 0), 'y': (-math.pi / 2, 0, 0), 'x': (0, math.pi / 2, 0)}


def cyl(cx, cy, cz, r, length, m, axis='z', seg=32, r2=None, smooth=True, name='cyl'):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=length)
    ob = mesh_obj(name, bm, m, (cx, cy, cz), _AXIS_ROT[axis], smooth)
    if smooth and hasattr(ob.data, 'set_sharp_from_angle'):
        ob.data.set_sharp_from_angle(angle=math.radians(40))
    return ob


def ring(cx, cy, cz, R, r, m, axis='y', seg=128, seg2=16, name='ring'):
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
    return mesh_obj(name, bm, m, (cx, cy, cz), _AXIS_ROT[axis], smooth=True)


def text(body, loc, rot_deg, size, m, extrude=0.0, font=None, align='CENTER', spacing=1.0):
    cu = bpy.data.curves.new('txt', 'FONT'); cu.body = body; cu.size = size; cu.extrude = extrude
    cu.align_x = align; cu.align_y = 'CENTER'; cu.space_character = spacing
    if font:
        cu.font = font
    cu.materials.append(m)
    ob = bpy.data.objects.new('txt', cu); ob.location = loc
    ob.rotation_euler = Euler(tuple(math.radians(a) for a in rot_deg))
    return link(ob)


def load_font(*names):
    for n in names:
        p = os.path.join('C:/Windows/Fonts', n)
        if os.path.exists(p):
            try:
                return bpy.data.fonts.load(p)
            except RuntimeError:
                pass
    return None


class Kit:
    """把很多方塊合成一個多材質網格，再用連結複製（共用網格）大量擺放，數千個模組也很快。"""

    def __init__(self, name):
        self.name = name; self.bm = bmesh.new(); self.mats = []

    def box(self, cx, cy, cz, sx, sy, sz, m):
        if m not in self.mats:
            self.mats.append(m)
        idx = self.mats.index(m)
        geom = bmesh.ops.create_cube(self.bm, size=1.0, matrix=Matrix.Translation((cx, cy, cz)) @ Matrix.Diagonal((sx, sy, sz, 1.0)))
        for v in geom['verts']:
            for f in v.link_faces:
                f.material_index = idx
        return self

    def mesh(self):
        me = bpy.data.meshes.new(self.name); self.bm.to_mesh(me); self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        return me


def place(me, loc, rot_z=0.0, name='inst'):
    ob = bpy.data.objects.new(name, me); ob.location = loc; ob.rotation_euler = (0, 0, rot_z)
    return link(ob)


# ---------- 真實 GPU 設備 ----------
# 造型參考：DGX H100／DGX B200 的金色打孔前面板、GB200 NVL72 整櫃（上下電源架、運算托盤、
# 中間 9 個 NVLink 交換托盤），以及 B200／B300 雙晶粒＋8 顆 HBM 封裝、H100 SXM 模組。
# 只做外形，不放任何品牌商標。
U = 2.24 / 48  # 1U（公尺）


def perforated(key, metal='#c6a86c', hole='#0c0c0e', density=70.0, radius=0.32, rough=0.3):
    """金色打孔面板：用物件座標的 Y、Z 算出規則圓孔，給正面朝 ±X 的方塊用。"""
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(key); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mul = nt.nodes.new('ShaderNodeVectorMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = (0.0, density, density)
    fr = nt.nodes.new('ShaderNodeVectorMath'); fr.operation = 'FRACTION'
    sub = nt.nodes.new('ShaderNodeVectorMath'); sub.operation = 'SUBTRACT'; sub.inputs[1].default_value = (0.0, 0.5, 0.5)
    ln = nt.nodes.new('ShaderNodeVectorMath'); ln.operation = 'LENGTH'
    lt = nt.nodes.new('ShaderNodeMath'); lt.operation = 'LESS_THAN'; lt.inputs[1].default_value = radius
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.interpolation = 'CONSTANT'
    ramp.color_ramp.elements[0].position = 0.0; ramp.color_ramp.elements[0].color = lin(metal)
    ramp.color_ramp.elements[1].position = 0.5; ramp.color_ramp.elements[1].color = lin(hole)
    met = nt.nodes.new('ShaderNodeMath'); met.operation = 'SUBTRACT'; met.inputs[0].default_value = 1.0
    rg = nt.nodes.new('ShaderNodeMath'); rg.operation = 'MULTIPLY_ADD'; rg.inputs[1].default_value = 0.9 - rough; rg.inputs[2].default_value = rough
    lk = nt.links.new
    lk(tc.outputs['Object'], mul.inputs[0]); lk(mul.outputs[0], fr.inputs[0]); lk(fr.outputs[0], sub.inputs[0])
    lk(sub.outputs[0], ln.inputs[0]); lk(ln.outputs['Value'], lt.inputs[0])
    lk(lt.outputs[0], ramp.inputs['Fac']); lk(ramp.outputs['Color'], b.inputs['Base Color'])
    lk(lt.outputs[0], met.inputs[1]); lk(met.outputs[0], b.inputs['Metallic'])
    lk(lt.outputs[0], rg.inputs[0]); lk(rg.outputs[0], b.inputs['Roughness'])
    _mats[key] = m
    return m


def gpu_mats(density=70.0, frame='#17181c'):
    return {
        'blk': mat('rack_blk_' + frame, frame, 0.42, 0.55),
        'dark': mat('rack_dark', '#0d0e11', 0.5, 0.3),
        'gold': perforated(f'bezel_{int(density)}', density=density),
        'led': mat('led_nv', '#7fd400', 0.4, emit='#8be000', emit_str=7),
        'ledb': mat('led_nvb', '#4a66ff', 0.4, emit='#4a66ff', emit_str=7),
    }


def add_rack(k, kind, M, oy=0.0, s=1.0):
    """一座 48U 機櫃，正面朝 +X、底部在 z=0。kind：nvl72／dgx_h100／dgx_b200"""
    W, H, D = 0.6 * s, 2.24 * s, 1.2 * s
    u = U * s; fx = 0.012 * s; fw = W * 0.9
    k.box(-D / 2, oy, H / 2, D, W, H, M['blk'])
    if kind == 'nvl72':
        for zc in (3.2 * u, H - 3.2 * u):  # 上下電源架
            k.box(fx, oy, zc, 0.024 * s, fw, 5.6 * u, M['dark'])
            for i in range(6):
                k.box(fx + 0.014 * s, oy - fw * 0.42 + i * fw * 0.168, zc + 1.6 * u, 0.006 * s, 0.03 * s, 0.5 * u, M['led'])
        z = 6.4 * u
        for i in range(8):  # 下段運算托盤
            k.box(fx, oy, z + (i + 0.5) * u, 0.024 * s, fw, u * 0.86, M['gold'])
        z += 8 * u
        for i in range(9):  # NVLink 交換托盤
            zc = z + (i + 0.5) * u
            k.box(fx, oy, zc, 0.024 * s, fw, u * 0.86, M['dark'])
            for j in range(4):
                k.box(fx + 0.014 * s, oy - fw * 0.36 + j * fw * 0.24, zc, 0.006 * s, 0.05 * s, u * 0.3, M['led'] if j == 0 else M['blk'])
        z += 9 * u
        for i in range(10):  # 上段運算托盤
            k.box(fx, oy, z + (i + 0.5) * u, 0.024 * s, fw, u * 0.86, M['gold'])
        z += 10 * u
        for i in range(4):  # 管理交換器
            k.box(fx, oy, z + (i + 0.8) * u * 1.1, 0.024 * s, fw, u * 0.8, M['dark'])
    else:
        n, units = (4, 8) if kind == 'dgx_h100' else (3, 10)
        for i in range(2):  # 頂部交換器
            zc = H - (i + 1.6) * u
            k.box(fx, oy, zc, 0.024 * s, fw, u * 0.86, M['dark'])
            k.box(fx + 0.014 * s, oy - fw * 0.4, zc, 0.006 * s, 0.03 * s, u * 0.4, M['ledb'])
        z = 2.0 * u
        for i in range(n):  # DGX 主機：黑框＋金色打孔面板＋底部硬碟槽
            h = units * u
            k.box(fx, oy, z + h / 2, 0.024 * s, W * 0.94, h * 0.97, M['blk'])
            k.box(fx + 0.012 * s, oy, z + h * 0.57, 0.012 * s, W * 0.86, h * 0.72, M['gold'])
            k.box(fx + 0.012 * s, oy, z + h * 0.11, 0.012 * s, W * 0.86, h * 0.1, M['dark'])
            k.box(fx + 0.02 * s, oy + W * 0.38, z + h * 0.11, 0.006 * s, 0.02 * s, h * 0.05, M['led'])
            z += h + 0.4 * u


def rack_row(name, kinds, M, gap=0.02, s=1.0):
    """一排機櫃合成一個網格（正面朝 +X，以排的中心為原點）"""
    k = Kit(name); W = 0.6 * s
    total = len(kinds) * (W + gap) - gap
    for i, kind in enumerate(kinds):
        add_rack(k, kind, M, oy=-total / 2 + W / 2 + i * (W + gap), s=s)
    return k.mesh()


def row_variants(rnd, M, n_racks, count=4, weights=('nvl72', 'nvl72', 'dgx_h100', 'dgx_b200')):
    return [rack_row(f'row{i}', [rnd.choice(weights) for _ in range(n_racks)], M) for i in range(count)]


def chip_package(kind, s=1.0):
    """平放的晶片封裝，頂面朝 +Z、原點在底面中心。b300／b200：雙晶粒＋8 顆 HBM；h100：SXM 模組"""
    k = Kit('pkg_' + kind)
    sub_m = mat('substrate', '#1b2f25', 0.5)
    die_m = mat('die', '#232936', 0.1, 0.8)
    hbm_m = mat('hbm', '#2c2f36', 0.28, 0.45)
    gold_m = mat('pkg_gold', '#d2ae4a', 0.24, 1.0)
    if kind in ('b300', 'b200'):
        SW, SD = 1.0 * s, 0.82 * s
        k.box(0, 0, 0.02 * s, SW, SD, 0.04 * s, sub_m)
        for (cx, cy, w, d) in ((0, SD * 0.46, SW * 0.96, SD * 0.05), (0, -SD * 0.46, SW * 0.96, SD * 0.05),
                               (SW * 0.46, 0, SW * 0.05, SD * 0.88), (-SW * 0.46, 0, SW * 0.05, SD * 0.88)):
            k.box(cx, cy, 0.06 * s, w, d, 0.04 * s, gold_m)
        for dx in (-0.19, 0.19):
            k.box(dx * s, 0, 0.055 * s, 0.36 * s, 0.4 * s, 0.03 * s, die_m)
        for dx in (-0.29, -0.1, 0.1, 0.29):
            for dy in (-0.29, 0.29):
                k.box(dx * s, dy * s, 0.058 * s, 0.15 * s, 0.13 * s, 0.036 * s, hbm_m)
    else:
        k.box(0, 0, 0.012 * s, 1.0 * s, 0.56 * s, 0.024 * s, mat('pcb', '#10241a', 0.45))
        k.box(0, 0.02 * s, 0.03 * s, 0.6 * s, 0.4 * s, 0.014 * s, sub_m)
        k.box(0, 0.02 * s, 0.045 * s, 0.26 * s, 0.26 * s, 0.024 * s, die_m)
        for dx in (-0.21, 0.21):
            for dy in (-0.1, 0.02, 0.14):
                k.box(dx * s, dy * s, 0.047 * s, 0.1 * s, 0.1 * s, 0.03 * s, hbm_m)
        for i in range(24):
            k.box((-0.46 + i * 0.04) * s, -0.262 * s, 0.025 * s, 0.025 * s, 0.03 * s, 0.003 * s, gold_m)
        for i in range(12):
            for y in (0.2, -0.17):
                k.box((-0.44 + i * 0.08) * s, y * s, 0.03 * s, 0.03 * s, 0.018 * s, 0.012 * s, mat('cap', '#8a7a5a', 0.4, 0.6))
    return k.mesh()


def wire(points, m, radius=0.05):
    cu = bpy.data.curves.new('wire', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = radius; cu.bevel_resolution = 2
    sp = cu.splines.new('POLY'); sp.points.add(len(points) - 1)
    for p, q in zip(sp.points, points):
        p.co = (q[0], q[1], q[2], 1)
    cu.materials.append(m)
    return link(bpy.data.objects.new('wire', cu))


def catenary(x0, x1, y, z, sag, m, radius=0.05, n=24):
    pts = []
    for i in range(n + 1):
        t = i / n; x = x0 + (x1 - x0) * t
        pts.append((x, y, z - sag * (1 - (2 * t - 1) ** 2)))
    return wire(pts, m, radius)


def person(x, y, z, m, h=1.75):
    """比例尺用的小人剪影"""
    cyl(x, y, z + h * 0.36, h * 0.13, h * 0.72, m, seg=12)
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=h * 0.09)
    mesh_obj('head', bm, m, (x, y, z + h * 0.83), smooth=True)


# ---------- 燈光、世界、相機、輸出 ----------
def sun(direction, strength, color='#fff1dc', angle=1.5):
    ld = bpy.data.lights.new('sun', 'SUN'); ld.energy = strength; ld.angle = math.radians(angle); ld.color = lin(color)[:3]
    ob = bpy.data.objects.new('sun', ld)
    ob.rotation_euler = Vector(direction).normalized().to_track_quat('-Z', 'Y').to_euler()
    return link(ob)


def area(loc, size, power, color='#ffffff', direction=(0, 0, -1), shape='SQUARE', size_y=None):
    ld = bpy.data.lights.new('area', 'AREA'); ld.energy = power; ld.size = size; ld.color = lin(color)[:3]
    if size_y:
        ld.shape = 'RECTANGLE'; ld.size_y = size_y
    ob = bpy.data.objects.new('area', ld); ob.location = loc
    ob.rotation_euler = Vector(direction).normalized().to_track_quat('-Z', 'Y').to_euler()
    return link(ob)


def fog_box(cx, cy, cz, sx, sy, sz, density, aniso=0.4, color='#ffffff'):
    """有邊界的體積霧。不要用世界體積：太陽在無限遠，光會被整片吃掉，光束就出不來。"""
    m = bpy.data.materials.new('fog'); m.use_nodes = True; nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    pv = nt.nodes.new('ShaderNodeVolumePrincipled')
    pv.inputs['Density'].default_value = density; pv.inputs['Anisotropy'].default_value = aniso
    pv.inputs['Color'].default_value = lin(color)
    nt.links.new(pv.outputs[0], nt.nodes['Material Output'].inputs['Volume'])
    return box(cx, cy, cz, sx, sy, sz, m, name='fog')


def hide_from_camera(ob):
    ob.visible_camera = False
    return ob


def world(color, strength, density=0.0, aniso=0.3, vol_color='#ffffff'):
    sc = bpy.context.scene
    w = bpy.data.worlds.new('world'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = lin(color); bg.inputs[1].default_value = strength
    if density > 0:
        vs = w.node_tree.nodes.new('ShaderNodeVolumeScatter')
        vs.inputs['Density'].default_value = density; vs.inputs['Anisotropy'].default_value = aniso
        vs.inputs['Color'].default_value = lin(vol_color)
        w.node_tree.links.new(vs.outputs[0], w.node_tree.nodes['World Output'].inputs['Volume'])
    return w


def camera(loc, lens, shift=(0.0, 0.0), rot_deg=(90, 0, 0), clip=800):
    sc = bpy.context.scene
    cd = bpy.data.cameras.new('cam'); cd.lens = lens; cd.sensor_fit = 'HORIZONTAL'; cd.sensor_width = 36
    cd.shift_x, cd.shift_y = shift; cd.clip_start = 0.1; cd.clip_end = clip
    cam = bpy.data.objects.new('cam', cd); cam.location = loc
    cam.rotation_euler = Euler(tuple(math.radians(a) for a in rot_deg))
    link(cam); sc.camera = cam
    return cam


def render_setup(preview, samples):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'OPTIX'
    prefs.refresh_devices() if hasattr(prefs, 'refresh_devices') else prefs.get_devices()
    for dv in prefs.devices:
        dv.use = dv.type == 'OPTIX'
    sc.cycles.device = 'GPU'
    sc.cycles.samples = 32 if preview else samples
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 6; sc.cycles.diffuse_bounces = 3; sc.cycles.glossy_bounces = 3
    sc.cycles.volume_bounces = 1; sc.cycles.transparent_max_bounces = 8
    sc.render.resolution_x, sc.render.resolution_y = (960, 540) if preview else (2400, 1350)
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = 'AgX'
    for look in ('AgX - Medium High Contrast', 'Medium High Contrast'):
        try:
            sc.view_settings.look = look; break
        except TypeError:
            pass
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGB'


# ---------- E 眺望前沿：算力大殿 ----------
def scene_hall(preview):
    """長廊盡頭是一面開圓洞的混凝土牆，洞裡是一圈金色六角晶圓（像望遠鏡主鏡，也像 GPU 晶片陣列），
    中央透出「前沿恆星」。兩側是層層疊疊的白色機櫃模組、鈷藍管線和走道，屋頂百葉灑下日光光束。"""
    rnd = random.Random(7)
    conc = concrete('conc', '#a9a399', '#c9c3b8', 0.9)
    conc_dark = concrete('conc_dark', '#77736c', '#958f86', 1.1)
    floor_m = concrete('floor', '#948f86', '#b2ada3', 0.5, rough=0.42, bump=0.04)
    white = mat('white', '#e6e4de', 0.38)
    white2 = mat('white2', '#d3d1cb', 0.42)
    steel = mat('steel', '#2c2f35', 0.34, 0.85)
    cobalt = mat('cobalt', '#2a3fd0', 0.42)
    led_b = mat('led_b', '#3b5bff', 0.4, emit='#4a66ff', emit_str=12)
    led_g = mat('led_g', '#ffc75a', 0.4, emit='#ffc75a', emit_str=9)
    led_w = mat('led_w', '#ffffff', 0.4, emit='#fff4e0', emit_str=7)
    yellow = mat('yellow', '#f2c200', 0.55)
    paint_w = mat('paint_w', '#ecebe6', 0.6)
    gold = varied('gold', '#b8862f', '#f5d47a', rough=0.32, metal=1.0)
    star = mat('star', '#fff3dc', 0.5, emit='#fff0d2', emit_str=90)
    figure = mat('figure', '#1b1c20', 0.6)
    font = load_font('bahnschrift.ttf', 'arialbd.ttf')
    fiber = mat('fiber', '#f2c200', 0.5)
    lamp = mat('lamp', '#ffffff', 0.5, emit='#fff1dc', emit_str=6)
    rows = row_variants(rnd, gpu_mats(70.0, frame='#d9d7d1'), 9)  # 白色機櫃框＋金色打孔面板，配合亮色大殿

    L, HW = 118.0, 28.0
    RC = Vector((0.0, 112.0, 21.0)); R = 21.0

    # 地面與地面標線
    box(0, L / 2 - 6, -0.25, 2 * HW + 6, L + 16, 0.5, floor_m)
    for x in (-6.0, 6.0):
        box(x, L / 2, 0.006, 0.3, L - 8, 0.012, yellow)
    for i in range(22):
        box(0, 6 + i * 4.8, 0.006, 0.18, 2.4, 0.012, paint_w)
    for i in range(10):  # 斜線警示區
        box(-12 + i * 2.7, 46, 0.006, 0.45, 5.0, 0.012, yellow, rot=(0, 0, math.radians(35)))
    text('07', (13.0, 42.0, 0.01), (0, 0, 0), 7.0, yellow, font=font)
    text('COMPUTE HALL', (13.0, 36.5, 0.01), (0, 0, 0), 1.6, paint_w, font=font, spacing=1.2)

    # 盡頭的牆，挖一個圓洞
    wall = box(0, 113.5, 26, 2 * HW + 6, 3.0, 56, conc)
    cutter = cyl(RC.x, 113.5, RC.z, R - 0.8, 10, None, axis='y', seg=128, smooth=False)
    cutter.hide_render = True; cutter.display_type = 'WIRE'
    md = wall.modifiers.new('hole', 'BOOLEAN'); md.operation = 'DIFFERENCE'; md.object = cutter
    text('FRONTIER', (0, 111.9, RC.z + R + 6.5), (90, 0, 0), 4.2, paint_w, font=font, spacing=1.35)
    text('GAZE-07  /  ATTENTION IS ALL YOU NEED', (0, 111.9, RC.z + R + 3.2), (90, 0, 0), 1.0, paint_w, font=font, spacing=1.3)

    # 圓環龍門
    ring(RC.x, 111.0, RC.z, R + 0.4, 1.15, white, seg=192, seg2=18)
    ring(RC.x, 110.2, RC.z, R + 2.7, 0.42, steel, seg=192, seg2=12)
    ring(RC.x, 111.2, RC.z, R - 2.3, 0.32, steel, seg=192, seg2=12)
    for i in range(48):
        a = 2 * math.pi * i / 48; c, s = math.cos(a), math.sin(a)
        box(RC.x + c * (R + 1.3), 110.6, RC.z + s * (R + 1.3), 0.55, 1.6, 3.6 if i % 4 else 5.2,
            steel if i % 4 else white2, rot=(0, math.atan2(c, s), 0))
    for i in range(72):
        a = 2 * math.pi * (i + 0.5) / 72; c, s = math.cos(a), math.sin(a)
        cyl(RC.x + c * (R + 0.4), 109.75, RC.z + s * (R + 0.4), 0.16, 0.2, led_b if i % 6 else led_g, axis='y', seg=12)
    # 夾具
    for a_deg in (0, 90, 180, 270):
        a = math.radians(a_deg); c, s = math.cos(a), math.sin(a)
        box(RC.x + c * (R + 3.4), 110.4, RC.z + s * (R + 3.4), 3.2, 2.4, 3.2, white2, bevel=0.15, rot=(0, math.atan2(c, s), 0))

    # 六角晶圓光圈（平頂六角，局部 XY 立起來面向相機）
    rh = 1.6; gap = 0.9
    cols = int((R + 2) / (1.5 * rh)) + 2
    for q in range(-cols, cols + 1):
        for rr in range(-cols, cols + 1):
            x = q * 1.5 * rh; z = rr * math.sqrt(3) * rh + (math.sqrt(3) * rh / 2 if q % 2 else 0)
            d = math.hypot(x, z)
            if 7.2 < d < R - 2.9:
                tilt = (d - 7.2) / (R - 10) * 0.32
                ob = cyl(RC.x + x, 112.0 - 0.09 * (d - 7.2), RC.z + z, rh * gap, 0.35, gold, axis='y', seg=6, smooth=False)
                ob.rotation_euler = (-math.pi / 2 + tilt * (z / d) + rnd.uniform(-0.03, 0.03),
                                     -tilt * (x / d) + rnd.uniform(-0.03, 0.03), 0)
    # 前沿恆星
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=9.0)
    mesh_obj('star', bm, star, (RC.x, 195.0, RC.z + 1.0), smooth=True)

    # 兩側：混凝土鰭片＋白色機櫃模組＋LED＋管線＋走道
    for side in (-1, 1):
        box(side * (HW + 1.0), L / 2, 24, 2.0, L + 4, 52, conc_dark)
        for b in range(15):
            y0 = 4.0 + b * 7.4
            box(side * (HW - 1.2), y0, 21, 2.4, 1.6, 44, conc)
            for lv in range(10):
                z0 = 0.4 + lv * 3.6
                box(side * (HW - 1.6), y0 + 3.7, z0 + 0.06, 3.2, 5.8, 0.12, steel)  # 夾層地板
                if rnd.random() < 0.07:
                    continue
                place(rnd.choice(rows), (side * (HW - 0.45), y0 + 3.7, z0 + 0.12), 0.0 if side < 0 else math.pi)
                box(side * (HW - 0.9), y0 + 3.7, z0 + 2.72, 0.34, 5.6, 0.1, fiber)  # 黃色光纖線槽
                box(side * (HW - 1.5), y0 + 3.7, z0 + 3.42, 0.36, 5.2, 0.05, lamp)  # 走道頂燈，打亮機櫃正面
        cyl(side * (HW - 2.7), L / 2, 5.4, 0.36, L, cobalt, axis='y')
        cyl(side * (HW - 2.9), L / 2, 16.2, 0.55, L, cobalt, axis='y')
        cyl(side * (HW - 2.6), L / 2, 28.4, 0.3, L, steel, axis='y')
        for zc in (11.0, 22.0):
            box(side * (HW - 3.9), L / 2, zc, 3.4, L - 4, 0.25, steel)
            for zr in (zc + 1.05, zc + 0.55):
                box(side * (HW - 5.55), L / 2, zr, 0.07, L - 4, 0.07, white2)
            for k in range(36):
                box(side * (HW - 5.55), 2 + k * 3.2, zc + 0.55, 0.07, 0.07, 1.1, white2)

    # 屋頂：橫梁＋中央百葉（日光從縫隙灑下）
    for b in range(16):
        box(0, 2 + b * 7.4, 47, 2 * HW, 1.2, 2.6, steel)
    for k in range(13):
        box(-19.2 + k * 3.2, L / 2, 49.5, 1.5, L + 4, 0.5, conc_dark)
    for side in (-1, 1):
        box(side * (HW - 3.0), L / 2, 50, 12, L + 4, 0.8, conc_dark)

    # 比例尺小人
    for (x, y, z) in ((-3.2, 93, 0), (2.6, 96, 0), (6.4, 89, 0), (-(HW - 3.9), 64, 11.13), (HW - 3.9, 40, 22.13)):
        person(x, y, z, figure)

    # 光：屋頂百葉灑下的日光＋圓洞透進來的恆星光，霧只放在大殿裡
    sun((0.16, -0.5, -0.85), 5.5, '#ffe4c4', angle=0.8)
    world('#d9e0e8', 0.6)
    fog_box(0, L / 2 - 4, 24.5, 2 * HW, L + 12, 49, density=0.0042, aniso=0.55)
    fog_box(0, 172, 24, 120, 112, 90, density=0.012, aniso=0.2, color='#fff2dc')  # 牆後：讓恆星有光暈
    hide_from_camera(area((0, 80, 30), 16, 26000, '#fff1dd', direction=(0, 1, -0.3)))  # 打亮金色晶圓正面
    # 圓環置中、拉近：角色站左側，右側留給懸浮選單，圓環和恆星露在兩者之間
    camera((0, 12.0, 5.6), 22, shift=(0.0, 0.05))
    bpy.context.scene.view_settings.exposure = -0.3


# ---------- F 深層機房：機櫃峽谷 ----------
def scene_canyon(preview):
    """Red-Null 式的一點透視：兩面四十公尺高的機櫃牆夾出一條峽谷，白色機殼配螢光黃綠格柵，
    鈷藍鋼梁橫跨上空，纜線垂掛。天光從頂上縫隙灑下，盡頭是一片亮霧。"""
    rnd = random.Random(11)
    white = mat('white', '#e7e6e1', 0.4)
    white2 = mat('white2', '#cfcfca', 0.45)
    lime = mat('lime', '#c4ee36', 0.45)
    dark = mat('dark', '#16181c', 0.6)
    steel = mat('steel', '#2b2e33', 0.32, 0.85)
    cobalt = mat('cobalt', '#2a3fd0', 0.4, 0.3)
    led_l = mat('led_l', '#d4ff3a', 0.4, emit='#d4ff3a', emit_str=9)
    led_b = mat('led_b', '#4a66ff', 0.4, emit='#4a66ff', emit_str=10)
    led_w = mat('led_w', '#ffffff', 0.4, emit='#f2f6ff', emit_str=6)
    conc = concrete('conc', '#77736d', '#99948c', 0.8)
    floor_m = concrete('floor', '#2f3032', '#46474a', 0.6, rough=0.24, bump=0.03)
    font = load_font('bahnschrift.ttf', 'arialbd.ttf')

    # 兩面牆是 12 層夾層機房：每層一排真實機櫃（NVL72／DGX H100／DGX B200）、格柵地板、欄杆、黃色光纖線槽
    M = gpu_mats(70.0)
    rows = row_variants(rnd, M, 6, count=5)
    fiber = mat('fiber', '#f2c200', 0.5)
    lamp = mat('lamp_c', '#ffffff', 0.5, emit='#e6efff', emit_str=3.5)
    HW, L = 6.0, 112.0
    for side in (-1, 1):
        rot = 0.0 if side < 0 else math.pi
        for lv in range(12):
            z = lv * 3.62
            setback = 0.0 if lv < 8 else -0.8 * (lv - 7)
            xf = side * (HW - setback)
            box(side * (HW - setback - 0.75), L / 2, z + 0.05, 1.5, L, 0.1, steel)  # 夾層格柵地板
            for zr in (z + 1.05, z + 0.55):
                box(side * (HW - setback - 1.48), L / 2, zr, 0.05, L, 0.05, white2)
            box(side * (HW - setback + 0.25), L / 2, z + 2.62, 0.3, L, 0.09, fiber)
            box(side * (HW - setback - 0.9), L / 2, z + 3.4, 0.3, L, 0.04, lamp)
            for b_ in range(26):
                y = 2.2 + b_ * 4.35
                if b_ % 5 == 0:
                    if lv == 0:
                        box(side * (HW + 1.2), y, 22, 3.0, 1.2, 44, conc)
                    continue
                if rnd.random() < 0.06:
                    continue
                place(rnd.choice(rows), (xf, y, z + 0.1), rot)
            for k_ in range(0, 112, 3):  # 欄杆立柱
                box(side * (HW - setback - 1.48), k_ + 1.0, z + 0.6, 0.05, 0.05, 1.1, white2)
        box(side * (HW + 3.6), L / 2, 22, 1.0, L + 4, 46, conc)
    # 地面：深色反光混凝土＋中央格柵走道＋黃綠導引燈
    box(0, L / 2, -0.2, 2 * HW + 4, L + 20, 0.4, floor_m)
    box(0, L / 2, 0.02, 3.2, L, 0.06, steel)
    for i in range(52):
        for x in (-1.75, 1.75):
            box(x, 1 + i * 2.15, 0.06, 0.12, 0.7, 0.05, led_l)
    for i in range(8):
        box(-HW + 1.2 + i * 1.4, 7.0, 0.012, 0.5, 3.2, 0.01, lime, rot=(0, 0, math.radians(38)))
    text('F-02', (-3.6, 13.0, 0.03), (0, 0, 90), 3.2, white, font=font)
    # 上空：鈷藍鋼梁、天橋、纜線
    for k_ in range(10):
        y = 6 + k_ * 11.0
        for z in (14.5, 27.5, 40.0):
            if (k_ + int(z)) % 3 == 0:
                continue
            box(0, y, z, 2 * HW + 2, 0.7, 1.1, cobalt)
        if k_ % 2 == 0:
            box(0, y + 1.4, 14.0, 2 * HW, 2.0, 0.22, steel)
            box(0, y + 0.45, 14.9, 2 * HW, 0.05, 0.05, white2); box(0, y + 2.35, 14.9, 2 * HW, 0.05, 0.05, white2)
    black = mat('cable', '#101114', 0.5)
    for k_ in range(16):
        y = 3 + k_ * 7.0 + rnd.uniform(-1.5, 1.5)
        catenary(-HW + 0.3, HW - 0.3, y, rnd.uniform(18, 38), rnd.uniform(1.2, 3.8), black, radius=rnd.choice((0.04, 0.06, 0.09)))
    # 盡頭的牆：中央留一道 7×22 公尺的門，門外是亮霧
    side_w = (2 * HW + 8 - 7.0) / 2
    for sgn in (-1, 1):
        box(sgn * (3.5 + side_w / 2), L + 6, 22, side_w, 1.0, 46, conc)
    box(0, L + 6, 33.5, 7.0, 1.0, 23, conc)
    hide_from_camera(area((0, L + 30, 12), 16, 60000, '#e8f0ff', direction=(0, -1, 0)))
    for i in range(3):
        person(rnd.uniform(-1.2, 1.2), 70 + i * 9, 0.05, dark)
    person(-0.6, 29.6, 14.11, dark)

    sun((0.32, -0.3, -0.9), 6.0, '#fff4e6', angle=0.6)
    world('#d5dde6', 0.8)
    fog_box(0, L / 2, 23, 2 * HW + 10, L + 40, 46, density=0.0065, aniso=0.5)
    camera((0, -3.0, 1.7), 19, shift=(0.06, 0.07))
    bpy.context.scene.view_settings.exposure = 0.15


# ---------- H 白色工業：純白展台 ----------
def cove(m, depth=8.0, radius=6.0, height=40.0, half_w=60.0, seg=16):
    """攝影棚無縫背景：地板經過 1/4 圓弧接上背牆（沿 X 擠出）"""
    prof = [(-40.0, 0.0), (depth, 0.0)]
    for i in range(1, seg + 1):
        t = math.pi / 2 * i / seg
        prof.append((depth + radius * math.sin(t), radius - radius * math.cos(t)))
    prof.append((depth + radius, height))
    bm = bmesh.new()
    left = [bm.verts.new((-half_w, y, z)) for y, z in prof]
    right = [bm.verts.new((half_w, y, z)) for y, z in prof]
    for i in range(len(prof) - 1):
        bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
    return mesh_obj('cove', bm, m, smooth=True)


def scene_studio(preview):
    """參考 Red-Null 的產品棚拍：無縫白背景上立著幾座白色機櫃塔，青色纜線、洋紅零件，
    中央一個圓台加一道細圓環，留給角色站。"""
    rnd = random.Random(23)
    white_bg = mat('white_bg', '#ecebe7', 0.55)
    white = mat('white', '#f1f0ec', 0.36)
    white2 = mat('white2', '#dddcd7', 0.4)
    dark = mat('dark', '#1b1d22', 0.5, 0.4)
    cyan = mat('cyan', '#00b4dc', 0.35, emit='#00c8f0', emit_str=0.35)
    magenta = mat('magenta', '#ff2d8f', 0.4, emit='#ff2d8f', emit_str=0.3)
    limem = mat('lime', '#b4f000', 0.4, emit='#c6ff1a', emit_str=0.25)
    screen = mat('screen', '#0e1014', 0.3, emit='#18d6f0', emit_str=0.0)
    led_c = mat('led_c', '#18d6f0', 0.4, emit='#18d6f0', emit_str=6)
    ink = mat('ink', '#16181c', 0.6)
    font = load_font('bahnschrift.ttf', 'arialbd.ttf')

    cove(white_bg, depth=10.0, radius=7.0)

    # 真實硬體當展品：左邊 GB200 NVL72 整櫃＋DGX B200，右邊 DGX H100 整櫃，空中漂著 B300 與 H100 的封裝
    MS = gpu_mats(18.0, frame='#1b1c20')
    s4 = 4.0

    def solo_rack(kind, x, y, rot_deg):
        k = Kit('rack_' + kind); add_rack(k, kind, MS, s=s4)
        return place(k.mesh(), (x, y, 0), math.radians(rot_deg))

    solo_rack('nvl72', -8.6, 4.5, -62)
    solo_rack('dgx_h100', 9.4, 5.2, -118)
    k = Kit('dgx_b200_box')  # 單台 DGX B200（10U）放在地上
    k.box(-0.45 * s4, 0, 0.22 * s4, 0.9 * s4, 0.48 * s4, 0.44 * s4, MS['blk'])
    k.box(0.006 * s4, 0, 0.25 * s4, 0.012 * s4, 0.42 * s4, 0.32 * s4, MS['gold'])
    k.box(0.006 * s4, 0, 0.06 * s4, 0.012 * s4, 0.42 * s4, 0.05 * s4, MS['dark'])
    place(k.mesh(), (-5.4, 0.2, 0), math.radians(-35))
    b300 = place(chip_package('b300', s=3.2), (-4.2, 3.0, 7.6))
    b300.rotation_euler = (math.radians(62), math.radians(-12), math.radians(-24))
    h100 = place(chip_package('h100', s=2.6), (5.0, 2.6, 9.2))
    h100.rotation_euler = (math.radians(58), math.radians(10), math.radians(18))

    def plaque(x, y, rot_deg, title, sub):
        p = box(x, y, 0.32, 1.9, 0.08, 0.64, dark, rot=(math.radians(-12), 0, math.radians(rot_deg)))
        t = text(title, (0, -0.05, 0.08), (90, 0, 0), 0.2, mat('plaque_txt', '#f2f2ee', 0.5), font=font)
        t.parent = p
        t2 = text(sub, (0, -0.05, -0.16), (90, 0, 0), 0.11, cyan, font=font, spacing=1.2)
        t2.parent = p

    plaque(-6.4, -2.4, 18, 'GB200 NVL72', 'B200 x 72  /  2025')
    plaque(6.6, -2.0, -16, 'DGX H100', 'H100 x 8  /  2023')
    plaque(-1.9, -4.4, 6, 'B300', 'BLACKWELL ULTRA  /  2025.09')

    # 中央圓台＋細圓環＋地面標記
    cyl(0, 2.5, 0.2, 3.4, 0.4, white, seg=96)
    cyl(0, 2.5, 0.42, 3.0, 0.04, white2, seg=96)
    ring(0, 6.0, 6.5, 5.6, 0.2, white, seg=192, seg2=12)
    ring(0, 6.3, 6.5, 5.1, 0.05, dark, seg=192, seg2=8)
    for a_deg, m in ((90, magenta), (210, cyan), (330, limem)):
        a = math.radians(a_deg)
        box(math.cos(a) * 5.6, 6.0, 6.5 + math.sin(a) * 5.6, 0.6, 0.6, 0.6, m, bevel=0.06)
    ring(0, 2.5, 0.01, 4.6, 0.025, ink, axis='z', seg=160, seg2=6)
    for sx in (-1, 1):
        box(sx * 5.6, 2.5, 0.01, 1.4, 0.05, 0.02, ink); box(sx * 5.6, 2.5, 0.01, 0.05, 1.4, 0.02, ink)
    text('H-01  WHITE INDUSTRY  /  MODEL EMPIRE', (0, -1.6, 0.012), (0, 0, 0), 0.32, ink, font=font, spacing=1.4)
    # 漂浮方塊
    for (x, y, z, s, m) in ((-3.8, 4.5, 8.6, 0.9, white), (4.6, 5.0, 10.2, 0.6, white), (3.2, 3.0, 5.6, 0.45, cyan),
                            (-5.6, 5.5, 4.2, 0.35, magenta)):
        box(x, y, z, s, s, s, m, bevel=0.05, rot=(rnd.uniform(0, 1), rnd.uniform(0, 1), rnd.uniform(0, 1)))
    # 地上的纜線
    for (x0, c) in ((-6.6, cyan), (7.4, cyan), (-8.8, magenta)):
        pts = [(x0 + (0 - x0) * t, -0.6 + 2.2 * math.sin(t * 3.1) * (1 - t), 0.06) for t in [i / 20 for i in range(17)]]
        wire(pts, c, radius=0.06)

    hide_from_camera(area((-13, -9, 15), 5, 9000, '#fff8f0', direction=(0.62, 0.55, -0.6)))  # 左前上方主光，做出明暗面
    hide_from_camera(area((0, 2, 22), 18, 4000, '#ffffff', direction=(0, 0, -1)))
    hide_from_camera(area((16, -4, 5), 6, 1200, '#eef4ff', direction=(-1, 0.3, -0.1)))
    world('#f0f0ee', 0.32)
    camera((0, -28.0, 5.4), 38, shift=(0.07, 0.0))
    bpy.context.scene.view_settings.exposure = -0.35


# ---------- 主程式 ----------
SCENES = {'hall': (scene_hall, 160), 'canyon': (scene_canyon, 160), 'studio': (scene_studio, 192)}


def build(name, preview):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()
    fn, samples = SCENES[name]
    fn(preview)
    render_setup(preview, samples)
    out_png = os.path.join(ROOT, 'art', 'raw', f'bg_{name}' + ('_preview' if preview else '') + '.png')
    bpy.context.scene.render.filepath = out_png
    if not preview:
        os.makedirs(os.path.join(ROOT, 'art', 'blender'), exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'art', 'blender', f'bg_{name}.blend'))
    bpy.ops.render.render(write_still=True)
    print('RENDERED', out_png)


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['hall']
    preview = '--preview' in args
    for n in [a for a in args if not a.startswith('--')] or ['hall']:
        build(n, preview)
