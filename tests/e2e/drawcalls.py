# 绘制调用数对比：几个固定机位各取多帧的最大 / 中位数。python3 tests/e2e/drawcalls.py <base-url> [q]
import asyncio, sys, json, statistics
sys.path.insert(0,__import__('os').path.dirname(__file__))
from common import *
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8123/'
Q=sys.argv[2] if len(sys.argv)>2 else '1'
POSES=[('street',0,0.05,-49,0,0.12,'third'),('concourse-gates',0,-5.95,-11,0,0.1,'third'),('concourse-west',8,-5.95,-6,-1.57,0.05,'first'),
       ('platform',30,-11.95,10.6,-1.75,0.1,'third')]
async def sample(pg, n=6):
    v=[]
    for _ in range(n):
        await asyncio.sleep(0.4); v.append((await st(pg))['drawCalls'] or 0)
    return {'max':max(v),'med':statistics.median(v)}
async def main():
  R={}
  async with async_playwright() as p:
    b,pg,logs=await open_game(p,BASE+'?q='+Q)
    await asyncio.sleep(2)
    for name,x,y,z,yaw,pitch,v in POSES:
        if await pg.evaluate('__game.player.view')!=v: await pg.evaluate('__game.toggleView()')
        await pg.evaluate(f'__game.teleport({x},{y},{z},{yaw}); __game.player.pitch={pitch}')
        R[name]=await sample(pg)
    # 车厢内：叫车，等停站后传送进车厢
    await pg.evaluate('__game.teleport(24.6,-11.95,9.6,Math.PI)')
    for _ in range(600):
        await pg.evaluate('__game.call(1,1)')
        if await pg.evaluate("(__game.state().metro.slots.find(s=>s.line==1&&s.step==1)||{}).state=='dwell'"): break
        await asyncio.sleep(0.5)
    if await pg.evaluate('__game.player.view')!='first': await pg.evaluate('__game.toggleView()')
    await pg.evaluate('__game.teleport(22,-11.95,6.4,-1.57); __game.player.pitch=0.06')
    R['train-interior']=await sample(pg)
    R['errors']=errs(logs)
    print('DRAWCALLS', json.dumps(R, ensure_ascii=False))
    await b.close()
asyncio.run(main())
