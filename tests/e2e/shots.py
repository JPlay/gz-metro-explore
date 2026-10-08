import asyncio, sys, json
sys.path.insert(0,__import__('os').path.dirname(__file__))
from common import *
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8123/'
SHOT=(sys.argv[2] if len(sys.argv)>2 else '/workspace/gz-shots-3d/')
async def view(pg, v):
    if await pg.evaluate('__game.player.view')!=v: await pg.evaluate('__game.toggleView()')
async def main():
  R={}
  async with async_playwright() as p:
    b,pg,logs=await open_game(p,BASE+'?q=1')
    await asyncio.sleep(1.5)
    # 安检：走过安检门，拍闪灯
    await pg.evaluate('__game.teleport(0,-5.95,-16,0)'); await view(pg,'third')
    await pg.evaluate('__game.autopilot([[0,-12.2]])'); await asyncio.sleep(0.15); await pg.screenshot(path=SHOT+'security.png'); R['security']=(await st(pg))['security']
    # 闸机：走到闸机前，闸门打开
    await pg.evaluate('__game.teleport(2,-5.95,-6,0)'); await pg.evaluate('__game.autopilot([[2,-3.4]])'); await asyncio.sleep(0.6)
    await pg.evaluate('__game.look(0,40)'); await asyncio.sleep(0.3)
    await pg.screenshot(path=SHOT+'gates.png'); R['gates']=(await st(pg))['gates']
    # 站台 + 列车进站
    await pg.evaluate('__game.teleport(30,-11.95,10.5,-2.6)'); await pg.evaluate('__game.call(1,1)')
    for _ in range(80):
        s=await st(pg)
        if any(x['state']=='dwell' for x in s['metro']['slots']): break
        await asyncio.sleep(0.5)
    await pg.evaluate('__game.player.yaw=-1.9; __game.player.pitch=0.12'); await asyncio.sleep(0.4)
    await pg.screenshot(path=SHOT+'platform.png')
    # 车厢内（第一人称）
    await pg.evaluate('__game.autopilot([[24.6,9.6],[24.6,6.5],[22,6.5]])'); await asyncio.sleep(4)
    await view(pg,'first'); await pg.evaluate('__game.player.yaw=-1.57; __game.player.pitch=0.05'); await asyncio.sleep(0.4)
    await pg.screenshot(path=SHOT+'inside-train.png'); R['aboard']=(await st(pg))['aboard']
    await view(pg,'third')
    # 换乘通道 + 自己拼起来的桥（MV）
    await pg.evaluate('__game.teleport(-21.5,-16.95,21,0)'); await pg.evaluate('__game.autopilot([[-21.5,24.5]])'); await asyncio.sleep(1.4)
    await pg.screenshot(path=SHOT+'transfer.png')
    # Penrose 不可能三角（公园前街面）
    await pg.evaluate('__game.teleport(0,0.05,-48,0)'); await asyncio.sleep(0.3)
    await view(pg,'first')
    await pg.evaluate('(()=>{const a=0.95;__game.teleport(6-0.12*Math.sin(a),0.02,-50-0.12*Math.cos(a),a);__game.player.pitch=0;})()'); await asyncio.sleep(1.5)
    await pg.screenshot(path=SHOT+'mv-penrose.png'); R['mv']=(await st(pg))['mv']
    await view(pg,'third'); await pg.evaluate('__game.teleport(0,0.05,-48,0)'); await asyncio.sleep(0.8)
    await pg.screenshot(path=SHOT+'third-person.png')
    await view(pg,'first'); await asyncio.sleep(0.5); await pg.screenshot(path=SHOT+'first-person.png')
    R['errors']=errs(logs); await b.close()
    # 竖屏
    b,pg,logs=await open_game(p,BASE+'?q=1',w=834,h=1112)
    await asyncio.sleep(2); await pg.evaluate('__game.setMove(0,1,false)'); await asyncio.sleep(1.5); await pg.evaluate('__game.setMove(0,0)')
    await pg.screenshot(path=SHOT+'portrait.png')
    R['portrait']=await pg.evaluate("({w:innerWidth,h:innerHeight,btns:[...document.querySelectorAll('.btn')].map(b=>{const r=b.getBoundingClientRect();return [b.id,r.x|0,r.y|0,r.width,r.height]}),where:document.getElementById('where').getBoundingClientRect().width})")
    R['portraitState']=(await st(pg))['pos']; R['portraitErrors']=errs(logs)
    await b.close()
  print(json.dumps(R, ensure_ascii=False))
asyncio.run(main())
