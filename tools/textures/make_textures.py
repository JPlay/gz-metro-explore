"""
生成游戏用的可平铺贴图（全部程序化生成，无第三方素材）。
python3 tools/textures/make_textures.py  →  assets/tex/*.jpg
每张贴图代表的真实尺寸见 js/core/mats.js 的 TEX 表（uv = 世界坐标米数 / 尺寸）。
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import os
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'tex')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(20261008)

def noise(n, scale, seed=None, aniso=(1, 1)):
    """可平铺的分形噪声（FFT 滤波白噪声）。scale 越大越粗。"""
    r = np.random.default_rng(seed) if seed is not None else rng
    w = r.standard_normal((n, n))
    fy = np.fft.fftfreq(n)[:, None] * aniso[1]; fx = np.fft.fftfreq(n)[None, :] * aniso[0]
    f = np.sqrt(fx * fx + fy * fy); f[0, 0] = 1
    amp = 1 / (f ** 1.0) * np.exp(-(f * scale) ** 2 * 0.0) 
    amp = np.exp(-(f * n / scale) ** 2)
    out = np.real(np.fft.ifft2(np.fft.fft2(w) * amp))
    out -= out.min(); out /= max(1e-9, out.max())
    return out

def save(name, arr, q=86):
    a = np.clip(arr * 255, 0, 255).astype(np.uint8)
    Image.fromarray(a).save(os.path.join(OUT, name), quality=q, optimize=True, progressive=True)

def normal_from_height(h, strength=4.0):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    nz = np.ones_like(h)
    l = np.sqrt(dx * dx + dy * dy + nz * nz)
    n = np.stack([-dx / l, dy / l, nz / l], -1)
    return n * 0.5 + 0.5

def rgb(a, col):
    col = np.array(col, dtype=float) / 255
    return a[..., None] * col[None, None, :]

def grid_lines(n, cells_x, cells_y, width, soft=1.0):
    """返回 0..1 的缝隙遮罩（1 = 缝）。"""
    y, x = np.mgrid[0:n, 0:n].astype(float)
    cx = n / cells_x; cy = n / cells_y
    dx = np.minimum(x % cx, cx - (x % cx)); dy = np.minimum(y % cy, cy - (y % cy))
    d = np.minimum(dx, dy)
    return np.clip(1 - (d - width / 2) / soft, 0, 1)

N = 512
# ---------- 芝麻白花岗岩地砖（2×2 块，每块 0.6m）----------
def floor():
    base = 0.86 + 0.05 * (noise(N, 40) - 0.5)
    speck = rng.random((N, N))
    g = base.copy()
    g[speck > 0.985] -= 0.45; g[(speck > 0.94) & (speck <= 0.985)] -= 0.16; g[speck < 0.02] += 0.06
    g = np.array(Image.fromarray((np.clip(g, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))) / 255.0
    # 每块砖略有色差
    tile = np.zeros((N, N)); h = N // 2
    for i in range(2):
        for j in range(2): tile[i*h:(i+1)*h, j*h:(j+1)*h] = rng.uniform(-0.025, 0.025)
    g = g + tile
    seam = grid_lines(N, 2, 2, 2.2)
    g = g * (1 - seam * 0.35)
    col = np.stack([g * 1.0, g * 0.995, g * 0.985], -1)
    save('floor.jpg', col)
    save('floor_n.jpg', normal_from_height(1 - seam, 2.0), 90)
# ---------- 盲道提示砖（圆点）----------
def tactile():
    n = 256; y, x = np.mgrid[0:n, 0:n].astype(float)
    c = n / 5; dx = (x % c) - c / 2; dy = (y % c) - c / 2; r = np.sqrt(dx * dx + dy * dy)
    dome = np.clip(1 - (r / (c * 0.34)) ** 2, 0, 1) ** 0.5
    seam = grid_lines(n, 1, 1, 2.0)
    h = dome * 0.9 - seam * 0.5
    g = 0.88 + 0.06 * (noise(n, 20) - 0.5) + dome * 0.1 - seam * 0.3
    col = np.stack([g, g * 0.98, g * 0.95], -1)
    Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, 'tactile.jpg'), quality=86)
    save('tactile_n.jpg', normal_from_height(h, 3.0), 90)
# ---------- 铝扣板天花（2×2 块，每块 0.6m，带微孔）----------
def ceiling():
    y, x = np.mgrid[0:N, 0:N].astype(float)
    seam = grid_lines(N, 2, 2, 3.0, 1.5)
    perf = ((np.sin(x * np.pi / 4) > 0.75) & (np.sin(y * np.pi / 4) > 0.75)).astype(float)
    g = 0.93 + 0.02 * (noise(N, 60) - 0.5) - perf * 0.05
    edge = grid_lines(N, 2, 2, 12, 6) - seam  # 板边略亮（倒角）
    g = g + np.clip(edge, 0, 1) * 0.03 - seam * 0.5
    save('ceiling.jpg', np.stack([g, g, g * 0.99], -1))
    save('ceiling_n.jpg', normal_from_height(1 - seam - perf * 0.1, 2.0), 90)
# ---------- 搪瓷钢板墙面（2.4m：2×3 块）----------
def wall():
    seam = np.maximum(grid_lines(N, 2, 3, 2.5, 1.2), 0)
    g = 0.93 + 0.025 * (noise(N, 80) - 0.5)
    tile = np.zeros((N, N)); hw = N // 2; hh = N / 3
    for i in range(3):
        for j in range(2): tile[int(i*hh):int((i+1)*hh), j*hw:(j+1)*hw] = rng.uniform(-0.015, 0.015)
    g = g + tile - seam * 0.4
    save('wall.jpg', np.stack([g, g, g], -1))
    save('wall_n.jpg', normal_from_height(1 - seam, 2.0), 90)
# ---------- 拉丝不锈钢（1m）----------
def steel():
    n1 = noise(N, 1.5, aniso=(0.02, 1.0))
    g = 0.78 + 0.16 * (n1 - 0.5) + 0.03 * (noise(N, 30) - 0.5)
    save('steel.jpg', np.stack([g, g * 1.0, g * 1.01], -1))
# ---------- 混凝土（2m）----------
def concrete():
    g = 0.62 + 0.18 * (noise(N, 60) - 0.5) + 0.08 * (noise(N, 8) - 0.5)
    pores = rng.random((N, N)) > 0.992; g[pores] -= 0.15
    save('concrete.jpg', np.stack([g, g * 0.99, g * 0.97], -1))
# ---------- 红砖（1m，顺砌）----------
def brick():
    img = np.zeros((N, N)); hmap = np.zeros((N, N))
    rows = 15; bw = N / 4.2; bh = N / rows
    mortar_w = 3
    col = np.zeros((N, N, 3))
    for r in range(rows + 1):
        off = (r % 2) * bw / 2
        for c in range(-1, 6):
            x0 = int(c * bw + off); y0 = int(r * bh)
            tone = rng.uniform(0.75, 1.1)
            base = np.array([0.66, 0.30, 0.22]) * tone + rng.uniform(-0.03, 0.03, 3)
            xs = slice(max(0, x0 + mortar_w), min(N, int(x0 + bw))); ys = slice(max(0, y0 + mortar_w), min(N, int(y0 + bh)))
            col[ys, xs] = base; hmap[ys, xs] = 1
    col = np.where(hmap[..., None] > 0, col, np.array([0.78, 0.74, 0.68]))
    col = col * (0.9 + 0.2 * noise(N, 12)[..., None])
    save('brick.jpg', col)
    save('brick_n.jpg', normal_from_height(np.array(Image.fromarray((hmap * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))) / 255.0, 3.0), 90)
# ---------- 沥青（4m）----------
def asphalt():
    g = 0.30 + 0.06 * (noise(N, 50) - 0.5)
    s = rng.random((N, N)); g[s > 0.97] += 0.12; g[s < 0.03] -= 0.06
    g = np.array(Image.fromarray((np.clip(g, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.5))) / 255.0
    save('asphalt.jpg', np.stack([g, g, g * 1.02], -1))
# ---------- 人行道花岗岩铺装（1.2m：0.3×0.6 错缝）----------
def paving():
    n = N; hmap = np.ones((n, n)); col = np.zeros((n, n))
    rows = 4; bh = n / rows; bw = n / 2
    for r in range(rows):
        off = (r % 2) * bw / 2
        for c in range(-1, 3):
            x0 = int(c * bw + off); y0 = int(r * bh)
            xs = slice(max(0, x0), min(n, int(x0 + bw))); ys = slice(y0, int(y0 + bh))
            col[ys, xs] = rng.uniform(0.7, 0.8)
    seamx = np.zeros((n, n))
    for r in range(rows):
        off = (r % 2) * bw / 2; y0 = int(r * bh)
        seamx[max(0, y0 - 1):y0 + 2, :] = 1
        for c in range(-1, 4):
            x0 = int(c * bw + off) % n; seamx[y0:int(y0 + bh), max(0, x0 - 1):x0 + 2] = 1
    speck = rng.random((n, n))
    g = col + 0.06 * (noise(n, 30) - 0.5); g[speck > 0.98] -= 0.2; g = g * (1 - seamx * 0.45)
    save('paving.jpg', np.stack([g, g * 0.99, g * 0.97], -1))
    save('paving_n.jpg', normal_from_height(1 - seamx, 2.0), 90)
# ---------- 草地（2m）----------
def grass():
    a = noise(N, 6); b = noise(N, 40)
    g = 0.55 + 0.35 * a + 0.15 * (b - 0.5)
    col = np.stack([g * 0.50, g * 0.68, g * 0.36], -1)
    save('grass.jpg', col / 0.8)
# ---------- 楼房立面（6m×6m：2 跨 × 2 层）----------
def facade():
    n = N; img = Image.new('RGB', (n, n), (236, 232, 224)); d = ImageDraw.Draw(img)
    cw = n // 2
    for fy in range(2):
        for fx in range(2):
            x0, y0 = fx * cw, fy * cw
            # 层间线
            d.rectangle([x0, y0 + cw - 10, x0 + cw, y0 + cw], fill=(214, 208, 198))
            wx0, wy0, wx1, wy1 = x0 + 34, y0 + 46, x0 + cw - 34, y0 + cw - 50
            d.rectangle([wx0 - 6, wy0 - 6, wx1 + 6, wy1 + 10], fill=(200, 196, 188))
            lit = rng.random() < 0.25
            for yy in range(wy0, wy1):
                t = (yy - wy0) / (wy1 - wy0)
                c = (int(150 + 60 * (1 - t)), int(185 + 45 * (1 - t)), int(210 + 30 * (1 - t))) if not lit else (250, 228, 170)
                d.line([wx0, yy, wx1, yy], fill=c)
            if rng.random() < 0.5:  # 窗帘
                d.rectangle([wx0, wy0, wx0 + (wx1 - wx0) * 0.35, wy1], fill=(226, 214, 190) if rng.random() < 0.5 else (190, 206, 214))
            mx = (wx0 + wx1) // 2
            d.rectangle([mx - 3, wy0, mx + 3, wy1], fill=(120, 126, 132)); d.rectangle([wx0, wy0 + (wy1 - wy0) // 3 - 2, wx1, wy0 + (wy1 - wy0) // 3 + 2], fill=(120, 126, 132))
            d.rectangle([wx0 - 10, wy1 + 4, wx1 + 10, wy1 + 14], fill=(250, 250, 248))
            if rng.random() < 0.45:  # 空调外机
                ax = wx1 - 70 if rng.random() < 0.5 else wx0
                d.rectangle([ax, wy1 + 16, ax + 70, wy1 + 44], fill=(240, 240, 238), outline=(170, 170, 170))
                d.ellipse([ax + 30, wy1 + 19, ax + 54, wy1 + 41], outline=(150, 150, 150), width=2)
    arr = np.asarray(img).astype(float) / 255 * (0.95 + 0.07 * noise(n, 30)[..., None])
    save('facade.jpg', arr)
# ---------- 天空（等距柱状投影 1024×512）：更深的晴空蓝 + 几朵软白云 ----------
def sky():
    # 等距柱状投影：图像上边 = 天顶，中线 = 地平线（render.js 里以 invertY=false 加载，FIXED_EQUIRECTANGULAR 映射）。
    # 行 y∈[0,0.5] 对应仰角 90°→0°：仰角 = (0.5 - y) × 180°。下半张在地面以下，几乎看不到，用地平线色填满。
    W, H = 2048, 1024
    y = (np.arange(H)[:, None] + 0.5) / H * np.ones((1, W))
    elev = (0.5 - y) * 180.0
    # 晴空蓝：天顶深蓝，地平线是干净的浅蓝（不发灰）。色调映射会压亮部，所以地平线也不能太接近白色
    zen = np.array([0.15, 0.37, 0.80]); mid = np.array([0.30, 0.56, 0.91]); hor = np.array([0.54, 0.75, 0.96])
    e = np.clip(elev / 90.0, 0, 1)[..., None]
    t1 = np.clip(e / 0.35, 0, 1) ** 0.8          # 地平线 → 中空（0°–32°）
    t2 = np.clip((e - 0.35) / 0.65, 0, 1) ** 0.9  # 中空 → 天顶
    col = hor * (1 - t1) + mid * t1
    col = col * (1 - t2) + zen * t2
    # 软白云：横向拉长的大团（低频）+ 中频碎边，云团之间留出蓝天；只分布在仰角约 5°–55°，峰值约 25°（站在街上平视/抬头都看得见）
    n = 2048
    nn = noise(n, 16, seed=11, aniso=(1, 2.0))[:H, :]
    n2 = noise(n, 40, seed=12, aniso=(1, 1.6))[:H, :]
    n3 = noise(n, 70, seed=13)[:H, :]
    n4 = noise(n, 170, seed=14)[:H, :]
    f = nn * 0.75 + n2 * 0.4 + n3 * 0.18 + n4 * 0.08
    f = (f - f.mean()) / (f.std() + 1e-9)
    band = np.exp(-((elev - 25.0) / 18.0) ** 2) * np.clip((elev - 3.0) / 6.0, 0, 1)
    c = np.clip((f - 0.05) * 2.0 + (band - 0.6) * 2.2, 0, 1) * np.clip(band * 1.6, 0, 1)
    c = c ** 0.8
    # 云的明暗：顶亮底略灰蓝，带一点体积感
    white = np.array([1.0, 1.0, 1.0]); belly = np.array([0.86, 0.90, 0.97])
    shade = np.clip(0.65 + (n2 - 0.5) * 1.2, 0, 1)[..., None]
    cloud = white * shade + belly * (1 - shade)
    col = col * (1 - c[..., None] * 0.95) + cloud * c[..., None] * 0.95
    col = np.where((y > 0.5)[..., None], hor[None, None] * np.ones_like(col), col)
    a = np.clip(col * 255, 0, 255).astype(np.uint8)
    Image.fromarray(a).save(os.path.join(OUT, 'sky.jpg'), quality=85, optimize=True, progressive=True)
# ---------- 圆形柔和阴影（贴地）----------
def blob():
    n = 128; y, x = np.mgrid[0:n, 0:n].astype(float); r = np.sqrt((x - n / 2 + .5) ** 2 + (y - n / 2 + .5) ** 2) / (n / 2)
    a = np.clip(1 - r, 0, 1) ** 1.6
    img = np.zeros((n, n, 4), np.uint8); img[..., 3] = (a * 255).astype(np.uint8)
    Image.fromarray(img, 'RGBA').save(os.path.join(OUT, 'blob.png'), optimize=True)

import sys
ALL = [floor, tactile, ceiling, wall, steel, concrete, brick, asphalt, paving, grass, facade, sky, blob]
# 可只生成部分贴图：python3 tools/textures/make_textures.py sky（sky 用固定种子，单独生成结果一致）
want = set(sys.argv[1:])
for f in ALL:
    if want and f.__name__ not in want: continue
    f(); print('ok', f.__name__)
