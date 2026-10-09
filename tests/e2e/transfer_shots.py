# 公园前换乘导向：像第一次来的玩家一样，在每个要做决定的地方截一张（第三人称默认镜头，面朝自然走路方向）
# python3 tests/e2e/transfer_shots.py <url> <截图目录>   ONLY=名字片段 只拍一部分
import asyncio, sys, os, json, time, math
sys.path.insert(0, os.path.dirname(__file__))
from common import *
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/?q=2'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/workspace/gz-shots-polish/transfer-r2/').rstrip('/') + '/'
ONLY = os.environ.get('ONLY'); os.makedirs(OUT, exist_ok=True); T0 = time.time()
def log(*a): print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)
H = math.pi / 2
SPOTS = [  # 名字, x, y(脚), z, yaw, view, 竖屏?
    ('01-street-entrance', 0, 0.05, -47, 0, 'third', True),
    ('02-before-gates', 0, -5.95, -9.5, 0, 'third', True),
    ('03-l1-stair-foot', 16.0, -11.95, 13.1, H, 'third', True),
    ('04-l1-down-escalator-foot', 16.9, -11.95, 17.1, H, 'third', False),
    ('05-l1-north-walkway', 13.5, -11.95, 18.6, -H, 'third', False),
    ('06-l1-transfer-stair-head', 1.5, -11.95, 18.6, -H, 'third', False),
    ('07-transfer-stairs-down', -7.5, -12.4, 14.7, -H, 'third', False),
    ('08-corridor-bridge', -20.8, -16.95, 19.5, 0, 'third', False),
    ('09-corridor-l2-stair-head', -21.0, -16.95, 39.5, 0, 'third', False),
    ('10-l2-platform-arrival', -5.2, -21.95, 42.3, H, 'third', True),
    ('11-rev-l2-to-l1', 2, -21.95, 43.7, -H, 'third', True),
    ('12-rev-corridor-south', -22.2, -16.95, 40, math.pi, 'third', False),
]
async def main():
  async with async_playwright() as p:
    for portrait in (False, True):
        w, h = (834, 1112) if portrait else (1112, 834)
        spots = [s for s in SPOTS if (s[6] if portrait else True) and (not ONLY or ONLY in s[0])]
        if not spots: continue
        b, pg, logs = await open_game(p, URL, w, h)
        await asyncio.sleep(1.5); await pg.evaluate('__game.setDtMax(0.25)'); log('loaded', w, h)
        for name, x, y, z, yaw, view, _ in spots:
            if await pg.evaluate('__game.player.view') != view: await pg.evaluate('__game.toggleView()')
            await pg.evaluate(f'__game.teleport({x},{y},{z},{yaw})')
            await asyncio.sleep(4 if 'bridge' in name else 2.0)
            fn = OUT + name + ('-portrait' if portrait else '') + '.png'
            await pg.screenshot(path=fn, timeout=240000); log('shot', fn, (await st(pg)).get('drawCalls'))
        e = errs(logs); a = (await st(pg)).get('atlas'); print('ERRORS', e, 'ATLAS', a, flush=True)
        await b.close()
asyncio.run(main())
