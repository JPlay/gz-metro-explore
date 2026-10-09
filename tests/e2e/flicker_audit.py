# 公园前换乘路线 闪烁（z-fighting）/ 穿模 排查：
#   1. 沿路线若干机位（近 / 远），每个机位停住主循环，手动渲染两帧：第二帧镜头只挪 1mm、转 0.0002 弧度。
#      正常几何只会在边缘差 1 像素；z-fighting 的面会整片出现雪花状差异。
#      EMU_NEAR：把近裁剪面压小来模拟 iPad 的低深度精度（深度分辨率 ≈ z²/(near·2^bits)：
#      16 位深度 + near 0.08 ≈ 24 位 + near 0.0003）。默认同时拍 “游戏设置” 和 “模拟 iPad” 两组。
#   2. 镜头穿模：沿路线每个点转一圈（12 个方向 × 2 个俯仰），看相机到玩家之间有没有可见几何挡着（= 镜头在墙里 / 墙外）。
# python3 tests/e2e/flicker_audit.py <url> <输出目录>    EMU_NEAR=0.0003
import asyncio, sys, os, json, math, base64, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
import numpy as np
from PIL import Image
import io
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/?q=2&start=gyq'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/tmp/flicker/').rstrip('/') + '/'
EMU = float(os.environ.get('EMU_NEAR', '0.0003')); os.makedirs(OUT, exist_ok=True); T0 = time.time()
def log(*a): print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)
H = math.pi / 2; y1, yc, y2 = -12, -17, -22
def ys1(x): return y1 + (yc - y1) * (x + 6) / (-19.33 + 6)       # 换乘楼梯（1 号线 → 通道）
def ys2(x): return yc + (y2 - yc) * (x + 19) / (-5.67 + 19)      # 2 号线楼梯
POSES = [  # 名字, x, y(脚), z, yaw, pitch, 镜头距离
    ('a-l1-walkway-far', 36, y1 + 0.05, 18.0, -H, 0.12, 4.2),
    ('b-l1-walkway-mid', 9, y1 + 0.05, 18.0, -H, 0.2, 4.2),
    ('c-l1-bigsign-far', 6, y1 + 0.05, 18.0, H, 0.05, 4.2),
    ('d-l1-stairhead', -3.5, y1 + 0.05, 14.0, -H, 0.3, 4.2),
    ('e-transfer-stair-mid', -12, ys1(-12) + 0.05, 14.0, -H, 0.25, 4.2),
    ('f-corridor-south-far', -21.5, yc + 0.05, 13.2, 0, 0.12, 4.2),
    ('g-corridor-bridge', -21.5, yc + 0.05, 23.5, 0, 0.3, 4.2),
    ('h-corridor-north-far-back', -21.5, yc + 0.05, 44.0, math.pi, 0.1, 4.2),
    ('i-l2-stairhead', -20.5, yc + 0.05, 43.0, H, 0.3, 4.2),
    ('j-l2-stair-mid', -12, ys2(-12) + 0.05, 43.0, H, 0.25, 4.2),
    ('k-l2-platform-far-back', 30, y2 + 0.05, 43.7, -H, 0.08, 4.2),
    ('l-l2-shot11', 2, y2 + 0.05, 43.7, -H, 0.12, 4.2),
    # 第 3 轮：小美指出的点（视频 walk 0:09-0:13 / 0:25-0:28 的机位）
    ('m-transfer-stairtop-look-down', -4.5, y1 + 0.05, 14.7, -H, 0.3, 4.2),
    ('n-transfer-stair-upper', -8, ys1(-8) + 0.05, 14.7, -H, 0.25, 4.2),
    ('o-transfer-stair-lower', -15, ys1(-15) + 0.05, 14.7, -H, 0.25, 4.2),
    ('p-l2-stair-lower-curve', -9, ys2(-9) + 0.05, 42.3, H, 0.25, 4.2),
    ('q-l2-curve-near', -3, y2 + 0.05, 42.3, H, 0.3, 4.2),
    ('r-l2-curve-from-east', 8, y2 + 0.05, 44.4, -H, 0.25, 4.2),
]
if os.environ.get('ONLY'): POSES = [q for q in POSES if q[0][0] in os.environ['ONLY']]
PATH = [(16, y1, 14), (17.4, y1, 18.6), (8, y1, 18.6), (-2.8, y1, 16), (-5, y1, 14.7), (-9, ys1(-9), 14), (-15, ys1(-15), 14), (-19, yc, 14),
        (-21.5, yc, 15), (-21.5, yc, 20), (-21.5, yc, 29.5), (-21.5, yc, 38), (-21.5, yc, 43), (-18, ys2(-18), 43), (-12, ys2(-12), 43), (-7, ys2(-7), 43), (-3, y2, 43), (2, y2, 43.7)]
JS_PREP = """
(() => { const g = __game; window.__loops = g.engine._activeRenderLoops.slice(); })()
"""
JS_RENDER = """
async ([emu, dx, dyaw]) => {
  const g = __game, c = g.scene.activeCamera, p = g.player;
  g.engine.stopRenderLoop();
  p.updateCamera(1, g.scene);
  const keep = c.minZ; if (emu > 0) c.minZ = emu;
  c.position.x += dx; c.position.y += dx * 0.5; c.rotation.y += dyaw;
  g.scene.render();
  const url = g.engine.getRenderingCanvas().toDataURL('image/png');
  c.minZ = keep;
  return url;
}
"""
JS_RESUME = "(() => { const g = __game; window.__loops.forEach(f => g.engine.runRenderLoop(f)); })()"
# 镜头穿模：相机 → 玩家头部的线段上，有没有可见网格（不算玩家自己、人、透明玻璃、贴地暗影）
JS_CAMCLIP = """
([pts]) => {
  const g = __game, p = g.player, sc = g.scene, B = BABYLON, bad = [];
  const vis = sc.meshes.filter(m => m.isVisible && m.isEnabled() && m.material && !/glass|halo|shade|blob|ghost|sky/.test(m.material.name) && !m.name.startsWith('player') && !/^(kid|person|npc|ped|crowd)/i.test(m.name) && !(m.metadata && m.metadata.collider));
  const keep = vis.map(m => m.isPickable); vis.forEach(m => m.isPickable = true);
  const set = new Set(vis);
  for (const [x, y, z] of pts) for (let i = 0; i < 12; i++) for (const pitch of [0.05, 0.45]) {
    p.position.set(x, y + 0.05, z); p.yaw = i * Math.PI / 6; p.pitch = pitch; p.camY = y + 0.05; p.camDist = p.dist;
    p.updateCamera(1, sc);
    const cam = sc.activeCamera.position.clone(), head = new B.Vector3(x, y + 0.05 + 1.25, z), d = head.subtract(cam), L = d.length();
    const hit = sc.pickWithRay(new B.Ray(cam, d.normalize(), L - 0.05), m => set.has(m));
    if (hit && hit.hit) bad.push({ at: [x, y, z], yaw: +(i * 30), pitch, camDist: +p.camDist.toFixed(2), mesh: hit.pickedMesh.name, d: +hit.distance.toFixed(2), cam: [cam.x, cam.y, cam.z].map(v => +v.toFixed(2)) });
  }
  vis.forEach((m, i) => m.isPickable = keep[i]);
  return bad;
}
"""
def img(url): return np.asarray(Image.open(io.BytesIO(base64.b64decode(url.split(',')[1]))).convert('RGB')).astype(np.int16)
def flicker_score(a, b):
    d = np.abs(a - b).max(axis=2)
    # 只数“孤立”的差异像素：边缘挪 1 像素会成线，z-fighting 是一片雪花。用 4 邻域里差异像素少于 2 的点近似
    m = d > 48
    nb = np.zeros_like(m, dtype=np.int8)
    nb[1:, :] += m[:-1, :]; nb[:-1, :] += m[1:, :]; nb[:, 1:] += m[:, :-1]; nb[:, :-1] += m[:, 1:]
    return int(m.sum()), int((m & (nb <= 1)).sum()), d
async def main():
  R = {'poses': {}, 'camclip': None}
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, URL, 1112, 834)
    await asyncio.sleep(1.5); await pg.evaluate('__game.setDtMax(0.25)')
    s = await st(pg); log('loaded', s.get('code'), 'depthBits', s.get('depthBits'), 'minZ', s.get('minZ'))
    R['depthBits'] = s.get('depthBits')
    await pg.evaluate(JS_PREP)
    for name, x, y, z, yaw, pitch, dist in POSES:
        if await pg.evaluate('__game.player.view') != 'third': await pg.evaluate('__game.toggleView()')
        await pg.evaluate(f'__game.teleport({x},{y},{z},{yaw}); __game.player.pitch={pitch}; __game.player.dist={dist}')
        await asyncio.sleep(3 if 'bridge' in name else 1.5)   # 桥要先拼好
        res = {}
        for tag, emu in (('game', 0), ('ipad', EMU)):
            a = img(await pg.evaluate(JS_RENDER, [emu, 0, 0]))
            b2 = img(await pg.evaluate(JS_RENDER, [emu, 0.001, 0.0002]))
            tot, iso, d = flicker_score(a, b2); res[tag] = {'diff': tot, 'isolated': iso}
            Image.fromarray(a.astype(np.uint8)).save(f'{OUT}{name}-{tag}.png')
            hm = np.clip(d * 4, 0, 255).astype(np.uint8); Image.fromarray(hm).save(f'{OUT}{name}-{tag}-diff.png')
        await pg.evaluate(JS_RESUME)
        R['poses'][name] = res; log(name, res)
    if os.environ.get('NOCLIP') == '1': R['camclip'] = []
    else:
      await pg.evaluate('__game.engine.stopRenderLoop()')
      R["camclip"] = await pg.evaluate(JS_CAMCLIP, [PATH]); await pg.evaluate(JS_RESUME)
    log('camclip', len(R['camclip']))
    R['errors'] = errs(logs)
    json.dump(R, open(OUT + 'audit.json', 'w'), ensure_ascii=False, indent=1)
    print('AUDIT', json.dumps({k: v for k, v in R.items() if k != 'camclip'}, ensure_ascii=False), 'camclip', len(R['camclip']), flush=True)
    await b.close()
asyncio.run(main())
