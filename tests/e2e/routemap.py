# 车厢线路图 + LCD：python3 tests/e2e/routemap.py <url> <截图目录>
# 从公园前 1 号线站台开始（?start=gyq&line=1），叫一班往广州东站的车，进车厢：
#   停站时线路图高亮“公园前”（到站），关门开出后高亮“农讲所”、LCD 显示“下一站”；贴图只在换站时重画。
import asyncio, sys, os, json, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/?q=2&start=gyq&line=1'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/workspace/gz-shots-3d/').rstrip('/') + '/'
LINE = int(os.environ.get('LINE', '1')); STEP = int(os.environ.get('STEP', '1'))
os.makedirs(OUT, exist_ok=True); T0 = time.time(); R = {}
def log(*a): print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)
SUF = os.environ.get('SUFFIX', '')
async def shot(pg, name): name += SUF; await pg.screenshot(path=OUT + name + '.png', timeout=180000); log('shot', name)
async def until(pg, js, t=120):
    for _ in range(int(t / 0.25)):
        if await pg.evaluate(js): return True
        await asyncio.sleep(0.25)
    return False
SLOT = f"__game.metro.slots.find(s=>s.line=={LINE}&&s.step=={STEP})"
async def look(pg, dx, z, yaw, pitch):
    # 第一人称站在车厢里（相对列车中心 dx, z），朝 yaw 看
    await pg.evaluate(f"(()=>{{const r={SLOT}.train.root.position; __game.teleport(r.x+{dx}, r.y+0.02, r.z+{z}, {yaw}); __game.player.pitch={pitch};}})()")
    await asyncio.sleep(1.2)
async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, URL)
    await asyncio.sleep(1.5); await pg.touchscreen.tap(1112 * 0.7, 834 * 0.4); await pg.evaluate('__game.setDtMax(0.25)'); log('loaded')
    await pg.evaluate(f'__game.call({LINE},{STEP})')
    await until(pg, SLOT + ".state=='dwell'", 200); await pg.evaluate(SLOT + '.t = 1e4'); log('dwell')
    R['atStation'] = await pg.evaluate(SLOT + '.train.mapInfo'); d0 = await pg.evaluate(SLOT + '.train.mapDraws')
    if await pg.evaluate("__game.player.view") != 'first': await pg.evaluate('__game.toggleView()')
    # 门上方线路图特写（-z 侧 0 号车中门；站在 |z|<1 的过道上，不算“挡门”，避开中间立柱）
    await look(pg, -0.9, 0.95, 2.77, -0.30); await shot(pg, '3a-car-route-map')
    # 关门开出 → 线路图高亮下一站，LCD“下一站”
    await pg.evaluate(SLOT + '.t = 0.5')
    await until(pg, f"(()=>{{const i={SLOT}.train.mapInfo; return i && i.moving;}})()", 60); log('moving')
    R['moving'] = await pg.evaluate(SLOT + '.train.mapInfo'); R['redraws'] = await pg.evaluate(SLOT + '.train.mapDraws') - d0
    await asyncio.sleep(1.0); R['redrawsAfter1s'] = await pg.evaluate(SLOT + '.train.mapDraws') - d0
    await look(pg, 4.6, 0.3, -1.5708, -0.30); await shot(pg, '3b-car-lcd-next')
    await look(pg, -0.9, 0.95, 2.77, -0.30); await shot(pg, '3c-car-route-map-next')
    R['errors'] = errs(logs)
    print(json.dumps(R, ensure_ascii=False, indent=1), flush=True)
    chk = {'stationHot': R['atStation'] and R['atStation']['hot'] == R['atStation']['code'] and not R['atStation']['moving'],
           'nextHot': R['moving'] and R['moving']['hot'] == R['moving']['next'], 'oneRedraw': R['redraws'] == 1 and R['redrawsAfter1s'] == 1, 'noErrors': not R['errors']}
    print('CHECKS', chk, 'PASS' if all(chk.values()) else 'FAIL', flush=True)
    await b.close()
asyncio.run(main())
