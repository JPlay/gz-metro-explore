import asyncio, sys
sys.path.insert(0,__import__('os').path.dirname(__file__))
from common import *
URL=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8123/?q=1'
async def main():
  async with async_playwright() as p:
    b,pg,logs=await open_game(p,URL)
    await pg.wait_for_timeout(3000)
    s=await st(pg); s.pop('audio'); print(s)
    await pg.screenshot(path='/workspace/gz-shots-3d/_smoke.png')
    print('ERRS', errs(logs)[:20]); print('LOGS', [l for l in logs if l[0]!='error'][:20])
    await b.close()
asyncio.run(main())
