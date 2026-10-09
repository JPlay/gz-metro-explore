# 视觉升级前后对比截图：python3 tests/e2e/polish_shots.py <base-url> <输出目录> [q]
# 覆盖：街面站口（第三人称）、安检、闸机、站厅、扶梯、站台屏蔽门、列车进站、车厢内（含车门内侧）、换乘通道、招牌站、HUD 特写、天空、竖屏
# 软件渲染下单帧可能很慢，截图超时放宽到 120 秒
import asyncio, sys, json
sys.path.insert(0,__import__('os').path.dirname(__file__))
from common import *
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8123/'
OUT=(sys.argv[2] if len(sys.argv)>2 else '/workspace/gz-shots-polish/after/').rstrip('/')+'/'
Q=sys.argv[3] if len(sys.argv)>3 else '1'
async def view(pg, v):
    if await pg.evaluate('__game.player.view')!=v: await pg.evaluate('__game.toggleView()')
async def pose(pg, x,y,z,yaw,pitch,v, settle=0.9):
    await view(pg,v)
    await pg.evaluate(f'__game.teleport({x},{y},{z},{yaw}); __game.player.pitch={pitch}')
    await asyncio.sleep(settle)
async def shot(pg, name, R):
    await pg.screenshot(path=OUT+name+'.png', timeout=120000); s=await st(pg); R[name]={'dc':s['drawCalls'],'active':s['activeMeshes'],'fps':s['fps'],'zone':s['zone']}
async def wait(pg, js, timeout=120):
    for _ in range(int(timeout/0.5)):
        if await pg.evaluate(js): return True
        await asyncio.sleep(0.5)
    return False
async def main():
  R={}
  async with async_playwright() as p:
    b,pg,logs=await open_game(p,BASE+'?q='+Q)
    await asyncio.sleep(2.5)
    await pose(pg,0,0.05,-49,0,0.12,'third',1.5); await shot(pg,'01-street-entrance',R)
    await pose(pg,1.6,-5.95,-16.5,-0.35,0.15,'third'); await pg.evaluate('__game.autopilot([[0.2,-12.6]])'); await asyncio.sleep(0.5); await shot(pg,'02-security',R)
    await pose(pg,3.2,-5.95,-7,-0.25,0.2,'third'); await pg.evaluate('__game.autopilot([[2,-3.4]])'); await asyncio.sleep(0.7); await shot(pg,'03-gates',R)
    await pose(pg,-15,-5.95,-17,0.55,0.05,'first'); await shot(pg,'04-concourse',R)
    await pose(pg,-3.2,-5.95,13.6,1.57,0.32,'third'); await shot(pg,'05-escalator',R)
    await pose(pg,30,-11.95,10.6,-1.75,0.1,'third'); await shot(pg,'06-platform-psd',R)
    # 列车进站（站台西端看向隧道口）
    await pose(pg,-30,-11.95,10.4,-1.95,0.04,'first',0.3)
    await pg.evaluate('__game.call(1,1)')
    await wait(pg,"(__game.state().metro.slots.find(s=>s.line==1&&s.step==1)||{}).state=='arriving' && (__game.state().metro.slots.find(s=>s.line==1&&s.step==1)||{}).x>-75",120)
    await asyncio.sleep(0.2); await shot(pg,'07-train-arriving',R)
    await wait(pg,"(__game.state().metro.slots.find(s=>s.line==1&&s.step==1)||{}).state=='dwell'",120)
    await view(pg,'third'); await pg.evaluate('__game.teleport(24.6,-11.95,9.6,Math.PI)'); await asyncio.sleep(0.3)
    await pg.evaluate('__game.autopilot([[24.6,6.6],[22,6.6]])'); await asyncio.sleep(3.5)
    await view(pg,'first'); await pg.evaluate('__game.player.yaw=-1.57; __game.player.pitch=0.06'); await asyncio.sleep(0.6); await shot(pg,'08-train-interior',R)
    # 车门内侧（对面那侧车门关着，看内侧是否为浅灰不锈钢）
    await pg.evaluate('__game.player.yaw=2.19; __game.player.pitch=0.12'); await asyncio.sleep(0.6); await shot(pg,'08b-train-door-inside',R)
    await view(pg,'first'); await pg.evaluate('__game.teleport(-21.5,-16.95,18,0)'); await pg.evaluate('__game.player.pitch=0.02'); await asyncio.sleep(1.2); await shot(pg,'09-transfer-corridor',R)
    # 天空（街面抬头看）
    await pose(pg,0,0.05,-49,0.6,-0.55,'first',1.2); await shot(pg,'13-sky',R)
    # HUD 特写
    await pose(pg,0,0.05,-49,0,0.12,'third',0.8)
    await pg.screenshot(path=OUT+'11-hud-closeup.png', clip={'x':0,'y':0,'width':1112,'height':150}, timeout=120000)
    await pg.screenshot(path=OUT+'11b-hud-bottom.png', clip={'x':0,'y':560,'width':1112,'height':274}, timeout=120000)
    R['errors']=errs(logs); await b.close()
    # 招牌站
    for code,name,pos in [('njs','10-signature-nongjiangsuo',(0,0.05,-50,0,0.1)),('dsk','10b-signature-dongshankou',(-6,0.05,-56,-0.45,0.08))]:
        b,pg,logs=await open_game(p,BASE+f'?q={Q}&start={code}')
        await asyncio.sleep(2.5); x,y,z,yaw,pt=pos; await pose(pg,x,y,z,yaw,pt,'third',1.5); await shot(pg,name,R)
        R['errors_'+code]=errs(logs); await b.close()
    b,pg,logs=await open_game(p,BASE+'?q='+Q,w=834,h=1112)
    await asyncio.sleep(2.5); await pg.evaluate('__game.setMove(0,1,false)'); await asyncio.sleep(1.2); await pg.evaluate('__game.setMove(0,0)'); await asyncio.sleep(0.6)
    await shot(pg,'12-portrait',R)
    await pose(pg,0,0.05,-49,0,0.12,'third',1.5); await shot(pg,'12b-portrait-entrance',R)
    R['portraitBtns']=await pg.evaluate("[...document.querySelectorAll('#btns .btn')].map(b=>{const r=b.getBoundingClientRect();return [b.id,Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]})")
    R['portraitErrors']=errs(logs); await b.close()
  print(json.dumps(R, ensure_ascii=False, indent=1))
asyncio.run(main())
