import asyncio, sys, json, time
sys.path.insert(0,__import__('os').path.dirname(__file__))
from common import *
URL=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8123/?q=3'
SHOT=(sys.argv[2] if len(sys.argv)>2 else '/workspace/gz-shots-3d/')
R={}
def log(*a): print(time.strftime('%H:%M:%S'),*a, flush=True)
# 软件渲染（SwiftShader）下只有 1–5 fps，而游戏每帧 dt 上限 0.05s，游戏时间只走真实时间的 1/10 左右。
# 所以所有等待都按“游戏时间”计（页面里累加和主循环一样被夹住的 dt），真实时间只设一个很大的保底上限。
GCLOCK = "window.__gt===undefined && (window.__gt=0, __game.scene.onBeforeRenderObservable.add(()=>{ window.__gt += Math.min(0.05, __game.engine.getDeltaTime()/1000); }))"
async def gt(pg): return await pg.evaluate('window.__gt||0')
async def auto(pg, pts, run=False):
    r=await pg.evaluate(f'__game.autopilot({json.dumps(pts)}, {str(run).lower()})')
    s=await st(pg); log('auto', pts[-1], '->', r['ok'], s['pos'], s['zone'], r.get('stuckAt'), 'fps', s['fps'])
    return r['ok']
async def wait(pg, js, game=60, wall=1800, poll=0.5):
    """等 js 为真；超过 game 秒游戏时间（或 wall 秒真实时间）算超时"""
    g0=await gt(pg); t0=time.time()
    while time.time()-t0<wall:
        if await pg.evaluate(js): return True
        if await gt(pg)-g0>game: return False
        await asyncio.sleep(poll)
    return False
def slot(line, step): return f"(__game.state().metro.slots.find(s=>s.line=={line}&&s.step=={step})||{{}})"
async def board(pg, line, step, door_pts, back_pt, tries=3):
    for k in range(tries):
        # 叫车：__game.call 只在该侧是 away 时生效；上一班还在进站/停站/出站时要等它走完再叫，所以每次轮询都叫一次
        ok=await wait(pg, f"(__game.call({line},{step}), {slot(line,step)}.state=='dwell' && {slot(line,step)}.t>4)", 90)
        log('train dwell', ok, await pg.evaluate(slot(line,step)))
        if ok:
            await auto(pg, door_pts)
            await wait(pg, '__game.state().aboard', 1.5)
            s=await st(pg); log('aboard?', s['aboard'], s['pos'])
            if s['aboard']: return True
        # 没上去（车门已关 / 没等到车）：退回站台再来一次
        log('board retry', k+1); await auto(pg, [back_pt])
    return False
async def ride_to(pg, code, game=120):
    ok=await wait(pg, f"__game.state().code=='{code}' && ['dwell','opening'].includes((__game.state().metro.slots.find(s=>s.x!==undefined && __game.state().aboard)||{{}}).state) && __game.state().metro.ride && __game.state().metro.ride.phase!=='cruise'", game)
    # 等开门
    ok2=await wait(pg, "__game.state().metro.slots.some(s=>s.state=='dwell')", 30)
    s=await st(pg); log('arrived', code, ok, ok2, s['code'], s['aboard']); return s['code']==code and s['aboard']
async def transfer(pg):
    ok=await auto(pg, [[20,19],[0,19],[-3.5,14],[-5,14],[-20.5,14],[-21.5,16],[-21.5,24]])
    await auto(pg, [[-21.5,30]]); await asyncio.sleep(0.3); await pg.screenshot(path=SHOT+'_j_transfer.png')
    await auto(pg, [[-21.5,43],[-18.5,43],[-5,43],[2,42]])
    s=await st(pg); R['l2platform']=[s['zone'], s['pos']]; log('L2', s['pos'], s['zone'])
    R['board3']=await board(pg,2,1,[[6,39.6],[6,36.6]],[6,40.5])
    R['l2stop']=await ride_to(pg,'jnt')
async def tap(pg, sel):
    box=await pg.locator(sel).first.bounding_box(); await pg.touchscreen.tap(box['x']+box['width']/2, box['y']+box['height']/2)
async def buy_ticket(pg, code):
    await auto(pg, [[-3,-8],[-7.4,-7.6]]); await pg.evaluate('__game.player.yaw=0')
    await wait(pg, "(__game.state().act||{}).id=='buy'", 10); await tap(pg, '#bAct')
    await wait(pg, '__game.state().ticket.panel.open', 10, wall=60)
    await tap(pg, f'#tvm .st[data-code="{code}"] .hit'); await asyncio.sleep(0.3); await tap(pg, '#tvm .go')
    await wait(pg, "__game.state().ticket.panel.step=='pay'", 10, wall=60)
    fare=(await st(pg))['ticket']['panel']['fare']
    for _ in range(fare):
        await tap(pg, '#tvm .coin1'); await asyncio.sleep(0.8)
    # 出票动画是真实时间（约 3.5 秒），等面板自己关掉
    for _ in range(60):
        if not await pg.evaluate('__game.state().ticket.panel.open'): break
        await asyncio.sleep(0.5)
    inv=(await st(pg))['ticket']['inv']; log('ticket', inv); return bool(inv) and inv['to']==code
async def main():
  async with async_playwright() as p:
    b,pg,logs=await open_game(p,URL)
    await pg.evaluate(GCLOCK)
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
    # 2. 售票机买一张去烈士陵园的单程票（选站 → 投币 → 出票进背包）
    R['ticket']=await buy_ticket(pg, 'lsly')
    # 3. 闸机：走到通道前，点“刷票”
    await auto(pg, [[-7.4,-8.2],[-4,-8.2],[0,-3.4]])
    await wait(pg, "(__game.state().act||{}).id=='tapIn'", 10); await tap(pg, '#bAct')
    R['gateOpen']=await wait(pg, 'Math.max(...__game.state().gates)>0.5', 10); s=await st(pg); log('gates', s['gates'], s['ticket']['inv'])
    await auto(pg, [[0,2],[-2.5,8],[-2.5,14],[16,14],[20,12.5]])
    s=await st(pg); R['platform']=s['zone']; log('platform', s['pos'], s['zone'])
    # 3. 1 号线往广州东站，坐 2 站：公园前 → 农讲所 → 烈士陵园
    R['board1']=await board(pg,1,1,[[24.6,10],[24.6,6.6]],[24.6,10.5])
    await pg.evaluate('__game.toggleView()')  # 第一人称看车厢
    R['tunnel']=await wait(pg, "__game.state().inTunnel", 60); log('tunnel', R['tunnel'], (await st(pg))['metro']['ride'])
    await pg.screenshot(path=SHOT+'_j_inside_train.png')
    R['stop1']=await ride_to(pg,'njs')
    R['stop2']=await ride_to(pg,'lsly')
    await pg.evaluate('__game.toggleView()')
    await auto(pg, [[24.6,9.5],[24.6,12]]); s=await st(pg); R['offAt']=s['code']; R['offZone']=s['zone']; log('got off', s['code'], s['zone'], s['aboard'])
    # 4. 坐回公园前（往西塱，B 侧）
    R['board2']=await board(pg,1,-1,[[24.6,18.4],[24.6,21.4]],[24.6,17.5])
    R['back1']=await ride_to(pg,'njs'); R['back2']=await ride_to(pg,'gyq')
    await auto(pg, [[24.6,18.4],[20,19]]); s=await st(pg); log('off at', s['code'], s['zone'])
    await transfer(pg)
    s=await st(pg); a=s['audio']
    R['announced']=a['log']['announced'][-12:]; R['fallbacks']=len(a['log']['fallbacks']); R['played']=len(a['log']['played']); R['audioErrors']=a['log']['errors'][-5:]
    R['mv']=s['mv']; R['errors']=errs(logs); R['avgFps']=s['avgFps']; R['gameSeconds']=round(await gt(pg),1)
    await pg.screenshot(path=SHOT+'_j_end.png')
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    keys=['ticket','gateOpen','board1','tunnel','stop1','stop2','board2','back1','back2','board3','l2stop']
    bad=[k for k in keys if not R.get(k)]
    print('JOURNEY', 'PASS' if not bad and R.get('platform')=='platform' and R.get('offAt')=='lsly' else 'FAIL', bad, flush=True)
    await b.close()
    if bad: sys.exit(1)
asyncio.run(main())
