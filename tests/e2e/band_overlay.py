# 地面引导带“闪”的回归测试（第 3 轮）：
#   1. 同一机位渲染两次：正常 / 把贴地暗影（shade）和光斑（halo）藏起来。色带像素（线路蓝 / 黄）如果因为暗影改变颜色，
#      说明暗影在掠射角下盖到了色带上——走动时角度一变，这片暗斑就时有时无（视频里看到的闪）。
#   2. 同机位镜头挪 1mm 再渲染一次，数色带像素的孤立差异（z-fighting）。
#   3. 沿楼梯 / 站台走一小段（每帧 4cm），每帧都做 1，统计最大值。
# python3 tests/e2e/band_overlay.py <url> <输出目录>
import asyncio, sys, os, json, math, base64, io, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
import numpy as np
from PIL import Image
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/?q=2&start=gyq'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/tmp/band/').rstrip('/') + '/'; os.makedirs(OUT, exist_ok=True)
EMU = float(os.environ.get('EMU_NEAR', '0.0003')); T0 = time.time()
def log(*a): print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)
H = math.pi / 2; y1, yc, y2 = -12, -17, -22
def ys1(x): return y1 + (yc - y1) * (x + 6) / (-19.33 + 6)
def ys2(x): return yc + (y2 - yc) * (x + 19) / (-5.67 + 19)
# 名字, 起点 x, z, 每帧位移 dx, dz, 帧数, yaw, pitch, y(x)
WALKS = [
    # ('stair1-top', -4.0, 14.7, -0.04, 0, 7, -H, 0.3, lambda x: y1 if x > -6 else ys1(x)),
    ('stair1-mid', -11.0, 14.7, -0.04, 0, 7, -H, 0.25, ys1),
    ('stair2-mid', -10.0, 42.3, 0.04, 0, 7, H, 0.25, ys2),
    ('l2-curve-approach', -7.0, 42.3, 0.04, 0, 7, H, 0.2, lambda x: ys2(x) if x < -5.67 else y2),
    # ('l2-curve-east', 9.0, 45.1, -0.04, 0, 7, -H, 0.15, lambda x: y2),
    # ('l1-walkway-far', 30.0, 18.6, -0.04, 0, 6, -H, 0.1, lambda x: y1),
]
JS = """
async ([x, y, z, yaw, pitch, mode, emu, nudge]) => {
  const g = __game, sc = g.scene, c = sc.activeCamera, p = g.player;
  g.engine.stopRenderLoop();
  p.position.set(x, y + 0.05, z); p.yaw = yaw; p.pitch = pitch; p.camY = y + 0.05; p.camDist = p.dist; p.facing = yaw;
  p.collider.computeWorldMatrix(true);
  p.updateCamera(1, sc);
  // 主角和它的影子不算（动画 / 影子本来就该盖在色带上）
  const heroOff = [p.model, ...p.model.getChildMeshes(), p.blob].filter(m => m.isEnabled()); heroOff.forEach(m => m.setEnabled(false));
  const hide = sc.meshes.filter(m => m.material && /^(shade|halo)$/.test(m.material.name) && m.isEnabled());
  if (mode === 'noshade') hide.forEach(m => m.setEnabled(false));
  // bandonly：只留引导带所在的网格（新：band 桶 + 桥上的实例；旧：和灯带同在 glow 桶）
  const isBand = m => /^(band|glow|bridgeStripe)/.test(m.name) || (m.material && /^(band|glow)$/.test(m.material.name));
  const others = mode === 'bandonly' ? sc.meshes.filter(m => m.isEnabled() && !isBand(m)) : [];
  others.forEach(m => m.setEnabled(false)); const cc = sc.clearColor.clone(); if (mode === 'bandonly') sc.clearColor.set(1, 0, 1, 1);
  const keep = c.minZ; if (emu > 0) c.minZ = emu;
  c.position.x += nudge; c.position.y += nudge * 0.5;
  sc.render();
  const url = g.engine.getRenderingCanvas().toDataURL('image/png');
  c.minZ = keep; heroOff.forEach(m => m.setEnabled(true)); hide.forEach(m => m.setEnabled(true)); others.forEach(m => m.setEnabled(true)); sc.clearColor.copyFrom(cc);
  return url;
}
"""
def img(url): return np.asarray(Image.open(io.BytesIO(base64.b64decode(url.split(',')[1]))).convert('RGB')).astype(np.int16)
def band_mask(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    blue = (b > 120) & (b - r > 70) & (b - g > 25)          # 2 号线蓝
    yellow = (r > 150) & (g > 110) & (b < 90) & (r - b > 90)  # 1 号线黄
    return blue | yellow
async def main():
    R = {}
    async with async_playwright() as p:
        b, pg, logs = await open_game(p, URL, 1112, 834)
        await asyncio.sleep(1.5)
        s = await st(pg); log('loaded', s.get('code'), 'depthBits', s.get('depthBits'))
        if await pg.evaluate('__game.player.view') != 'third': await pg.evaluate('__game.toggleView()')
        loops = await pg.evaluate('(() => { window.__loops = __game.engine._activeRenderLoops.slice(); return 1; })()')
        for name, x0, z0, dx, dz, n, yaw, pitch, yf in WALKS:
            res = {'shade_over_band': [], 'zfight_band': [], 'osc': []}; prev = []
            for i in range(n):
                x, z = x0 + dx * i, z0 + dz * i; y = yf(x)
                A = img(await pg.evaluate(JS, [x, y, z, yaw, pitch, 'normal', EMU, 0]))
                Bn = img(await pg.evaluate(JS, [x, y, z, yaw, pitch, 'noshade', EMU, 0]))
                C = img(await pg.evaluate(JS, [x, y, z, yaw, pitch, 'normal', EMU, 0.001]))
                O = img(await pg.evaluate(JS, [x, y, z, yaw, pitch, 'bandonly', EMU, 0]))
                m = band_mask(O) & (np.abs(O - Bn).max(axis=2) < 24)   # 引导带像素且在完整画面里没被挡住
                d1 = (np.abs(A - Bn).max(axis=2) > 10) & m
                d2 = (np.abs(A - C).max(axis=2) > 40) & m
                res['shade_over_band'].append(int(d1.sum())); res['zfight_band'].append(int(d2.sum()))
                # 走动闪烁：连续三帧里同一像素先变亮再变暗（或反过来），只数色带附近（膨胀 2 像素）的点
                prev.append((A, m))
                if len(prev) >= 3:
                    (f0, m0), (f1, m1), (f2, m2) = prev[-3:]
                    g0, g1, g2 = f0.mean(axis=2), f1.mean(axis=2), f2.mean(axis=2)
                    mm = m0 | m1 | m2; mm[1:] |= mm[:-1].copy(); mm[:-1] |= mm[1:].copy(); mm[:, 1:] |= mm[:, :-1].copy(); mm[:, :-1] |= mm[:, 1:].copy()
                    a1, a2 = g1 - g0, g2 - g1
                    osc = (np.abs(a1) > 40) & (np.abs(a2) > 40) & (np.sign(a1) != np.sign(a2)) & mm
                    res['osc'].append(int(osc.sum()))
                if i == 0 or d1.sum() == max(res['shade_over_band']):
                    Image.fromarray(A.astype(np.uint8)).save(f'{OUT}{name}.png')
                    hm = np.zeros_like(A, dtype=np.uint8); hm[m] = (60, 60, 60); hm[d1] = (255, 0, 0); hm[d2] = (0, 255, 0)
                    Image.fromarray(hm).save(f'{OUT}{name}-mask.png')
            res['band_px'] = int(m.sum()); R[name] = res; log(name, 'shade>band max', max(res['shade_over_band']), 'zfight max', max(res['zfight_band']), 'osc', res['osc'], 'band px', res['band_px'])
        await pg.evaluate('(() => { window.__loops.forEach(f => __game.engine.runRenderLoop(f)); })()')
        R['errors'] = errs(logs); await b.close()
    json.dump(R, open(OUT + 'band.json', 'w'), indent=1)
    print('BAND', json.dumps({k: (max(v['shade_over_band']), max(v['zfight_band']), sum(v['osc'])) for k, v in R.items() if k != 'errors'}), 'errors', R['errors'][:3], flush=True)
asyncio.run(main())
