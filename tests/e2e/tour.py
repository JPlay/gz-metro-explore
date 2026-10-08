import asyncio, sys
sys.path.insert(0,__import__('os').path.dirname(__file__))
from common import *
URL=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8123/?q=1'
SPOTS=[('street',0,0,-48,0,'third'),('security',0,-6,-17,0,'third'),('gates',1.5,-6,-6,0,'first'),('stairs',-3,-6,14,1.57,'third'),
       ('platform',20,-12,12,1.57,'third'),('transfer',-21.5,-17,20,0,'third'),('l2plat',8,-22,44,-1.57,'third')]
async def main():
  async with async_playwright() as p:
    b,pg,logs=await open_game(p,URL)
    await pg.wait_for_timeout(1500)
    for name,x,y,z,yaw,view in SPOTS:
      await pg.evaluate(f'__game.teleport({x},{y}+0.05,{z},{yaw})')
      v=await pg.evaluate('__game.player.view')
      if v!=view: await pg.evaluate('__game.toggleView()')
      await pg.wait_for_timeout(700)
      s=await st(pg); print(name, s['pos'], s['zone'], s['grounded'], 'dc',s['drawCalls'], s['atlas'])
      await pg.screenshot(path=f'/workspace/gz-shots-3d/_t_{name}.png')
    print('ERRS', errs(logs)[:20])
    await b.close()
asyncio.run(main())
