# 镜头穿模回归（第 3 轮）：按游戏时间逐帧走小美指出的两段路，每帧检查
#   - 头 → 镜头这条线段上有没有可见几何（有 = 镜头在墙 / 天花 / 吊牌里或背后）；
#   - 镜头离上方最近的可见几何的距离（< 近裁剪面 0.25 就会切进去）；
#   - 主角网格可见度 vs 镜头到身体的距离（< 0.5m 必须藏起来）。
#   每 3 帧截一张小图，算上半屏“几乎全黑”的比例。
# python3 tests/e2e/cam_path.py <url> <输出目录>
import asyncio, sys, os, json, time, math
sys.path.insert(0, os.path.dirname(__file__))
from common import *
import numpy as np
from PIL import Image
import importlib.util
spec = importlib.util.spec_from_file_location('rj', os.path.join(os.path.dirname(__file__), 'record_journey.py')); rj = importlib.util.module_from_spec(spec)
sys.argv_keep = sys.argv; sys.argv = sys.argv[:1]; spec.loader.exec_module(rj); sys.argv = sys.argv_keep
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/?q=2&start=gyq'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/tmp/campath/').rstrip('/') + '/'; os.makedirs(OUT, exist_ok=True)
T0 = time.time()
def log(*a): print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)
PROBE = """
() => {
  const g = __game, sc = g.scene, p = g.player, B = BABYLON, cam = sc.activeCamera;
  if (!window.__vis) window.__vis = new Set(sc.meshes.filter(m => m.material && !/glass|halo|shade|blob|ghost|sky/.test(m.material.name) && m !== p.model && !p.model.getChildMeshes().includes(m) && !/^(kid|person|npc|ped|crowd|nb)/i.test(m.name) && !(m.metadata && m.metadata.collider)));
  const vis = m => window.__vis.has(m) && m.isEnabled();
  const pp = p.position, head = new B.Vector3(pp.x, pp.y + 1.25, pp.z), c = cam.position.clone(), d = c.subtract(head), L = d.length();
  const h1 = L > 0.05 ? sc.pickWithRay(new B.Ray(head, d.normalize(), L), vis) : null;
  const up = sc.pickWithRay(new B.Ray(c, new B.Vector3(0, 1, 0), 3), vis);
  // 镜头周围 6 个方向最近的可见几何
  let near = 9; for (const v of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) { const h = sc.pickWithRay(new B.Ray(c, new B.Vector3(...v), 1), vis); if (h && h.hit) near = Math.min(near, h.distance); }
  const ay = Math.min(pp.y + 1.45, Math.max(pp.y + 0.1, c.y)), dBody = Math.hypot(c.x - pp.x, c.y - ay, c.z - pp.z);
  return { pos: [pp.x, pp.y, pp.z].map(v => +v.toFixed(2)), cam: [c.x, c.y, c.z].map(v => +v.toFixed(2)), blocked: !!(h1 && h1.hit), blockedBy: h1 && h1.hit ? h1.pickedMesh.name : null,
           up: up && up.hit ? +up.distance.toFixed(2) : null, near: +near.toFixed(2), dBody: +dBody.toFixed(2), heroOn: p.model.isEnabled(), heroVis: +p.model.visibility.toFixed(2), camDist: +p.camDist.toFixed(2), minZ: cam.minZ };
}
"""
async def main():
    R = {}
    async with async_playwright() as pw:
        b, pg, logs = await open_game(pw, URL, 1112, 834)
        await asyncio.sleep(1.5)
        if await pg.evaluate('__game.player.view') != 'third': await pg.evaluate('__game.toggleView()')
        await pg.evaluate(rj.SETUP, 15)
        async def run(name, tele, legs):
            await pg.evaluate(tele); await pg.evaluate(rj.STEP, 8)
            rows = []; n = 0
            for pts, pitch in legs:
                await pg.evaluate(f'window.__rec.follow = {{ pts: {json.dumps(pts)}, i: 0, time: 0, speed: 1, turn: 2.6, pitch: {json.dumps(pitch)}, done: false }}')
                for _ in range(15 * 40):
                    await pg.evaluate(rj.STEP, 1); n += 1
                    r = await pg.evaluate(PROBE)
                    if os.environ.get('SHOTS') == '1' and n % 3 == 0:
                        fn = f'{OUT}{name}-{n:04d}.jpg'; await pg.screenshot(path=fn, type='jpeg', quality=70)
                        a = np.asarray(Image.open(fn).convert('L')); top = a[: a.shape[0] // 2]; r['darkTop'] = round(float((top < 40).mean()), 3)
                    rows.append(r)
                    if await pg.evaluate('window.__rec.follow.done'): break
            bad = [r for r in rows if r['blocked'] or r['near'] < 0.25 or (r['heroOn'] and r['dBody'] < 0.5) or r.get('darkTop', 0) > 0.25]
            R[name] = {'frames': len(rows), 'bad': bad, 'minNear': min(r['near'] for r in rows), 'maxDarkTop': max(r.get('darkTop', 0) for r in rows), 'minUp': min((r['up'] for r in rows if r['up'] is not None), default=None)}
            log(name, 'frames', len(rows), 'bad', len(bad), 'minNear', R[name]['minNear'], 'maxDarkTop', R[name]['maxDarkTop'], 'minUp', R[name]['minUp'])
            for r in bad[:8]: log('  ', r)
        # 1. 换乘楼梯下半段 → 楼梯脚 → 通道（视频 walk 0:14-0:15 / journey 1:14-1:15）
        await run('stair-to-corridor', '__game.teleport(-13, -14.5, 14.7, -Math.PI/2); __game.player.pitch = 0.25',
                  [([[-19.3, 14.7], [-20.8, 15.6], [-20.8, 24]], 0.25), ([[-20.8, 30]], 0.15)])
        # 2. 售票机关掉之后转身走向闸机（journey 0:31）
        await run('tvm-to-gate', '__game.teleport(-7.4, -6, -7.6, 0); __game.player.pitch = 0.15',
                  [([[-7.4, -8.2], [-4, -8.2], [0, -4.2], [0, -3.4]], None)])
        R['errors'] = errs(logs); await b.close()
    json.dump(R, open(OUT + 'campath.json', 'w'), indent=1)
    print('CAMPATH', json.dumps({k: {kk: vv for kk, vv in v.items() if kk != 'bad'} | {'bad': len(v['bad'])} for k, v in R.items() if k != 'errors'}), 'errors', R['errors'][:3], flush=True)
asyncio.run(main())
