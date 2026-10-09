# 主角外形截图：python3 tests/e2e/hero_shots.py <base-url> <out-dir> [ONLY=name,name]
# 自由机位：暂时接管 player.updateCamera，镜头对准主角（模型保持显示）
import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from common import *
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/workspace/gz-shots-polish/hero-r1'
ONLY = [s for s in os.environ.get('ONLY', '').split(',') if s]
os.makedirs(OUT, exist_ok=True)
FREE = '''(()=>{const g=__game,pl=g.player; if(!pl._uc){pl._uc=pl.updateCamera; pl.updateCamera=function(dt,sc){ if(this.freeCam){ const f=this.freeCam,p=this.position,cam=this.cam; const yaw=this.facing+f.az; const tx=p.x,ty=p.y+f.ty,tz=p.z;
 cam.position.set(tx+Math.sin(yaw)*f.d*Math.cos(f.el), ty+Math.sin(f.el)*f.d, tz+Math.cos(yaw)*f.d*Math.cos(f.el)); cam.setTarget(new BABYLON.Vector3(tx,ty,tz)); cam.fov=f.fov||0.8; this.model.setEnabled(true); this.blob.setEnabled(true);} else this._uc(dt,sc); };}})()'''
async def cam(pg, az, el, d, ty, fov=0.8):
    await pg.evaluate(f'__game.player.freeCam={{az:{az},el:{el},d:{d},ty:{ty},fov:{fov}}}')
async def free_off(pg): await pg.evaluate('__game.player.freeCam=null; __game.player.cam.fov=0.92')
async def shot(pg, name, wait=1.2):
    await asyncio.sleep(wait)
    path = f'{OUT}/{name}.png'; await pg.screenshot(path=path, timeout=240000)
    dc = (await st(pg))['drawCalls']; print('SHOT', name, path, 'dc=', dc, flush=True)
def want(n): return not ONLY or n in ONLY
async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, BASE + '?q=2')
    await pg.evaluate('__game.setDtMax(0.25)')
    await asyncio.sleep(2); await pg.evaluate(FREE)
    # 街面：正面 / 背面 / 3/4 近景
    await pg.evaluate('__game.teleport(0,0.05,-47,Math.PI)')
    if want('01-street-front'): await cam(pg, 0, 0.12, 3.0, 0.75); await shot(pg, '01-street-front', 2)
    # 主角自身的绘制调用：同一机位关掉 / 打开主角（身体 + 眼镜）各取一次
    dcs = {}
    for k in ['hero_off', 'hero_on']:
        if k == 'hero_off': await pg.evaluate('(()=>{const pl=__game.player,f=pl.updateCamera;pl._saveUC=f;pl.updateCamera=function(a,b){f.call(this,a,b);this.model.setEnabled(false);}})()')
        else: await pg.evaluate('__game.player.updateCamera=__game.player._saveUC; 0')
        await asyncio.sleep(1.5); v = []
        for _ in range(4): await asyncio.sleep(0.3); v.append((await st(pg))['drawCalls'])
        dcs[k] = v
    print('HERO_DC', dcs)
    if want('02-street-back'): await cam(pg, 3.1416, 0.15, 3.0, 0.75); await shot(pg, '02-street-back')
    if want('03-street-34-closeup'): await cam(pg, 0.75, 0.1, 1.6, 0.95, 0.7); await shot(pg, '03-street-34-closeup')
    if want('04-portrait'): await cam(pg, 0.12, 0.04, 0.9, 1.12, 0.6); await shot(pg, '04-portrait')
    if want('05-glasses-closeup'): await cam(pg, 0.3, 0.03, 0.8, 1.1, 0.5); await shot(pg, '05-glasses-closeup')
    if want('06-greet-rock'):
        await pg.evaluate('__game.player.emote={mode:"wave",yaw:__game.player.facing,t:30}')
        await cam(pg, -0.35, 0.08, 2.2, 0.8); await shot(pg, '06-greet-rock', 1.5)
        await cam(pg, -0.25, 0.04, 1.1, 1.0, 0.65); await shot(pg, '06b-greet-rock-close', 1.0)
        await pg.evaluate('__game.player.emote=null')
    if want('07-cheer'):
        await pg.evaluate('__game.player.emote={mode:"cheer",yaw:__game.player.facing,t:30}')
        await cam(pg, 0.1, 0.1, 2.8, 0.75); await shot(pg, '07-cheer', 1.5)
        await pg.evaluate('__game.player.emote=null')
    # 站厅：自然第三人称走路 + 灯光对比
    if want('08-concourse-walk'):
        await free_off(pg)
        await pg.evaluate('__game.teleport(0,-5.95,-14,0); __game.player.pitch=0.12; __game.player.dist=3.2')
        await asyncio.sleep(1.5); await pg.evaluate('__game.setMove(0.35,0.75)'); await shot(pg, '08-concourse-walk', 2.0)
        await pg.evaluate('__game.setMove(0,0)')
    if want('09-concourse-light'):
        await pg.evaluate('__game.teleport(0,-5.95,-12,0)'); await cam(pg, 0.3, 0.1, 2.0, 0.85, 0.7); await shot(pg, '09-concourse-light', 2.0)
    if want('10-platform-light'):
        await pg.evaluate('__game.teleport(30,-11.95,10.6,-1.75)'); await cam(pg, 0.3, 0.1, 2.0, 0.85, 0.7); await shot(pg, '10-platform-light', 2.5)
    if want('11-platform-cheer'):
        await pg.evaluate('__game.player.emote={mode:"cheer",yaw:__game.player.facing,t:30}')
        await cam(pg, 0.0, 0.12, 2.8, 0.75); await shot(pg, '11-platform-cheer', 1.5)
        await pg.evaluate('__game.player.emote=null')
    # 第一人称：确认看不到头发 / 头
    if want('12-first-person'):
        await free_off(pg)
        await pg.evaluate('__game.teleport(0,-5.95,-12,0); __game.player.pitch=0.05')
        if await pg.evaluate('__game.player.view') != 'first': await pg.evaluate('__game.toggleView()')
        await shot(pg, '12-first-person', 1.5)
        await pg.evaluate('__game.player.pitch=-0.9'); await shot(pg, '12b-first-person-lookup', 1.0)
        await pg.evaluate('__game.player.pitch=1.2'); await shot(pg, '12c-first-person-lookdown', 1.0)
        await pg.evaluate('__game.toggleView()')
    # 车厢里坐着
    if want('13-seated-train'):
        await free_off(pg)
        await pg.evaluate('__game.teleport(24.6,-11.95,9.6,Math.PI)')
        for _ in range(600):
            await pg.evaluate('__game.call(1,1)')
            if await pg.evaluate("(__game.state().metro.slots.find(s=>s.line==1&&s.step==1)||{}).state=='dwell'"): break
            await asyncio.sleep(0.5)
        await pg.evaluate('__game.teleport(22,-11.95,6.4,-1.57)'); await asyncio.sleep(1)
        ok = await pg.evaluate('''(()=>{const g=__game,pl=g.player,tr=g.metro.trains.find(t=>t.root.isEnabled()&&t.contains(pl.position)); if(!tr) return 'no train';
            const s=(tr.seats||[]).filter(q=>q.free).sort((a,b)=>Math.abs(tr.root.position.x+a.x-22)-Math.abs(tr.root.position.x+b.x-22))[0]; if(!s) return 'no seats'; g.seats.sit(tr,s); return 'ok'})()''')
        print('sit', ok)
        await cam(pg, 0.35, 0.15, 2.0, 0.6, 0.85); await shot(pg, '13-seated-train', 2.0)
    # 到站下车庆祝：真实触发链（ride arrive 事件 → 走出车厢 → 站定后自动 cheer）
    if want('14-alight-cheer'):
        await free_off(pg)
        if await pg.evaluate('!!__game.player.seat'): await pg.evaluate('__game.seats.stand()')
        await pg.evaluate('__game.teleport(24.6,-11.95,9.6,Math.PI)')
        for _ in range(600):
            await pg.evaluate('__game.call(1,1)')
            if await pg.evaluate("(__game.state().metro.slots.find(s=>s.line==1&&s.step==1)||{}).state=='dwell'"): break
            await asyncio.sleep(0.5)
        await pg.evaluate('__game.teleport(22,-11.95,6.4,-1.57)'); await asyncio.sleep(1.0)
        print('aboard', (await st(pg))['aboard'])
        await pg.evaluate('__game.events.emit("ride",{phase:"arrive",to:__game.state().code,line:1})')
        await pg.evaluate('__game.teleport(24.6,-11.95,10.4,Math.PI)'); await asyncio.sleep(1.5)
        em = await pg.evaluate('JSON.stringify(__game.player.emote)')
        print('ALIGHT_EMOTE', em, 'aboard', (await st(pg))['aboard'])
        await cam(pg, 0.0, 0.12, 2.8, 0.75); await shot(pg, '14-alight-cheer', 0.3)
    print('ERRORS', errs(logs))
    await b.close()
asyncio.run(main())
