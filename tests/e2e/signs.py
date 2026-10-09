# 导向牌：python3 tests/e2e/signs.py <url> <截图目录>   每个位置一张（第一人称，走路时的视线）
# 站口 / 刚过闸机 / 站厅下站台楼梯口 / 1 号线站台换乘楼梯口 / 换乘通道 / 通道尽头 / 2 号线楼梯口；再加一张站台墙站名牌（拼音英文）
import asyncio, sys, os, json, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/?q=2'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/workspace/gz-shots-3d/').rstrip('/') + '/'
ONLY = os.environ.get('ONLY')
os.makedirs(OUT, exist_ok=True); T0 = time.time(); R = {}
def log(*a): print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)
import math
SPOTS = [  # 名字, x, y(脚), z, yaw, pitch
    ('8a-sign-entrance', 0, 0.05, -45.5, 0, -0.12),
    ('8b-sign-past-gates', 0, -5.95, -6.0, 0, -0.16),
    ('8c-sign-stair-head-concourse', -8.5, -5.95, 14, math.pi / 2, -0.12),
    ('8d-sign-l1-transfer-stair', 4, -11.95, 14, -math.pi / 2, -0.18),
    ('8e-sign-transfer-corridor', -21.5, -16.95, 21.5, 0, -0.22),
    ('8f-sign-corridor-end', -21.5, -16.95, 38.6, 0, -0.18),
    ('8g-sign-l2-stair-head', -23.3, -16.95, 43, math.pi / 2, -0.15),
    ('9-platform-wall-name-pinyin-v2', -11.5, -11.95, 18.5, 0, -0.05),
]
async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, URL)
    await asyncio.sleep(1.5); await pg.touchscreen.tap(1112 * 0.7, 834 * 0.4); log('loaded')
    if await pg.evaluate("__game.player.view") != 'first': await pg.evaluate('__game.toggleView()')
    for name, x, y, z, yaw, pitch in SPOTS:
        if ONLY and ONLY not in name: continue
        await pg.evaluate(f'__game.teleport({x},{y},{z},{yaw}); __game.player.pitch={pitch}'); await asyncio.sleep(1.6)
        await pg.screenshot(path=OUT + name + '.png', timeout=240000); log('shot', name)
    R['atlas'] = (await st(pg))['atlas']; R['errors'] = errs(logs)
    print(json.dumps(R, ensure_ascii=False), flush=True)
    chk = {'atlasNoOverflow': R['atlas'] and R['atlas']['overflow'] == 0, 'noErrors': not R['errors']}
    print('CHECKS', chk, 'PASS' if all(chk.values()) else 'FAIL', flush=True)
    await b.close()
asyncio.run(main())
