import asyncio, sys, json, time
sys.path.insert(0,__import__('os').path.dirname(__file__))
from common import *
URL=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8123/?q=3'
SHOT=(sys.argv[2] if len(sys.argv)>2 else '/workspace/gz-shots-3d/')
R={}
def log(*a): print(time.strftime('%H:%M:%S'),*a, flush=True)
async def auto(pg, pts, run=False):
    r=await pg.evaluate(f'__game.autopilot({json.dumps(pts)}, {str(run).lower()})')
    s=await st(pg); log('auto', pts[-1], '->', r['ok'], s['pos'], s['zone'], r.get('stuckAt'))
    return r['ok']
async def wait(pg, js, timeout=200, poll=0.5):
    t=time.time()
    while time.time()-t<timeout:
        if await pg.evaluate(js): return True
        await asyncio.sleep(poll)
    return False
def slot(line, step): return f"(__game.state().metro.slots.find(s=>s.line=={line}&&s.step=={step})||{{}})"
async def board(pg, line, step, door_pts):
    await pg.evaluate(f'__game.call({line},{step})')
    ok=await wait(pg, f"{slot(line,step)}.state=='dwell'", 90)
    log('train dwell', ok, await pg.evaluate(slot(line,step)))
    await auto(pg, door_pts)
    await asyncio.sleep(0.5)
    s=await st(pg); log('aboard?', s['aboard']); return s['aboard']
async def ride_to(pg, code, timeout=260):
    ok=await wait(pg, f"__game.state().code=='{code}' && ['dwell','opening'].includes((__game.state().metro.slots.find(s=>s.x!==undefined && __game.state().aboard)||{{}}).state) && __game.state().metro.ride && __game.state().metro.ride.phase!=='cruise'", timeout)
    # 等开门
    ok2=await wait(pg, "__game.state().metro.slots.some(s=>s.state=='dwell')", 60)
    s=await st(pg); log('arrived', code, ok, ok2, s['code'], s['aboard']); return s['code']==code
async def transfer(pg):
    ok=await auto(pg, [[20,19],[0,19],[-3.5,14],[-5,14],[-20.5,14],[-21.5,16],[-21.5,24]])
    await auto(pg, [[-21.5,30]]); await asyncio.sleep(0.3); await pg.screenshot(path=SHOT+'_j_transfer.png')
    await auto(pg, [[-21.5,43],[-18.5,43],[-5,43],[2,42]])
    s=await st(pg); R['l2platform']=[s['zone'], s['pos']]; log('L2', s['pos'], s['zone'])
    R['board3']=await board(pg,2,1,[[6,39.6],[6,36.6]])
    R['l2stop']=await ride_to(pg,'jnt')
async def main():
  async with async_playwright() as p:
    b,pg,logs=await open_game(p,URL)
    if 'start=gyq' in URL:
        await pg.touchscreen.tap(560,300); await asyncio.sleep(1); await transfer(pg)
        s=await st(pg); R['announced']=s['audio']['log']['announced'][-8:]; R['errors']=errs(logs); print(json.dumps(R, ensure_ascii=False, indent=1, default=str)); await b.close(); return
    await pg.touchscreen.tap(560,300)   # 解锁音频
    await asyncio.sleep(1)
    s=await st(pg); R['start']=s['pos']; R['startZone']=s['zone']; log('start', s['pos'], s['zone'])
    # 1. 街 → 楼梯 → 安检
    await auto(pg, [[0,-30],[0,-20],[0,-14]])
    await auto(pg, [[0,-10]]); s=await st(pg); R['security']=s['security'] or s['audio']['log']['played'][-3:]
    log('security flash', s['security'], [x for x in s['audio']['log']['played'] if 'ecurity' in str(x)][-1:])
    # 2. 闸机
    await auto(pg, [[0,-3.2]]); await asyncio.sleep(0.4); s=await st(pg); R['gateOpen']=max(s['gates']); log('gates', s['gates'])
    await auto(pg, [[0,2],[-2.5,8],[-2.5,14],[16,14],[20,12.5]])
    s=await st(pg); R['platform']=s['zone']; log('platform', s['pos'], s['zone'])
    # 3. 1 号线往广州东站，坐 2 站：公园前 → 农讲所 → 烈士陵园
    R['board1']=await board(pg,1,1,[[24.6,10],[24.6,6.6]])
    await pg.evaluate('__game.toggleView()')  # 第一人称看车厢
    await wait(pg, "__game.state().inTunnel", 120); log('tunnel', (await st(pg))['metro']['ride'])
    await pg.screenshot(path=SHOT+'_j_inside_train.png')
    R['stop1']=await ride_to(pg,'njs')
    R['stop2']=await ride_to(pg,'lsly')
    await pg.evaluate('__game.toggleView()')
    await auto(pg, [[24.6,9.5],[24.6,12]]); s=await st(pg); R['offAt']=s['code']; R['offZone']=s['zone']; log('got off', s['code'], s['zone'], s['aboard'])
    # 4. 坐回公园前（往西塱，B 侧）
    R['board2']=await board(pg,1,-1,[[24.6,18.4],[24.6,21.4]])
    R['back1']=await ride_to(pg,'njs'); R['back2']=await ride_to(pg,'gyq')
    await auto(pg, [[24.6,18.4],[20,19]]); s=await st(pg); log('off at', s['code'], s['zone'])
    await transfer(pg)
    s=await st(pg); a=s['audio']
    R['announced']=a['log']['announced'][-12:]; R['fallbacks']=len(a['log']['fallbacks']); R['played']=len(a['log']['played']); R['audioErrors']=a['log']['errors'][-5:]
    R['mv']=s['mv']; R['errors']=errs(logs); R['avgFps']=s['avgFps']
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    await b.close()
asyncio.run(main())
