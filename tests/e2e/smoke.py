import asyncio, sys
sys.path.insert(0,__import__('os').path.dirname(__file__))
from common import *
URL=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8123/?q=1'
async def main():
  async with async_playwright() as p:
    b,pg,logs=await open_game(p,URL)
    await pg.wait_for_timeout(3000)
    s=await st(pg); s.pop('audio'); print(s)
    await pg.screenshot(path='/workspace/gz-shots-3d/_smoke.png', timeout=120000)  # 软件渲染下单帧可能超过 30 秒
    print('ERRS', errs(logs)[:20]); print('LOGS', [l for l in logs if l[0]!='error'][:20])
    # 视觉升级的基本检查：反射探针已建、标牌图集未溢出、绘制调用数在预算内、加载画面已移除
    chk={'noErrors': not errs(logs), 'probes': (s.get('probes') or 0) >= 1, 'atlasOk': (s.get('atlas') or {}).get('overflow',0)==0,
         'drawCallsOk': (s.get('drawCalls') or 0) < 150, 'loadingGone': await pg.evaluate('!document.getElementById("loading")'),
         'svgIcons': await pg.evaluate('document.querySelectorAll(".btn svg use").length>=3')}
    print('CHECKS', chk, 'PASS' if all(chk.values()) else 'FAIL')
    await b.close()
asyncio.run(main())
