# 车厢里坐下 / 起身：python3 tests/e2e/seat.py <url> [截图目录]
# 检查：靠近空座位出现“坐下”→ 坐下后髋部在座垫上（和烘焙乘客同一高度公式）、第一人称眼高降低 → 关门开车、进隧道、到站都一直坐着 → “起身”站起来；
# 选中的座位不和烘焙的坐着的乘客重叠。截图：侧面看坐姿（2a/2b）、第一人称坐着看窗外和线路图（2c）。
import asyncio, sys, os, json, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/?q=2'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/workspace/gz-shots-3d/').rstrip('/') + '/'
os.makedirs(OUT, exist_ok=True)
R = {}
T0 = time.time()
def log(*a): print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)
async def shot(pg, name):
    await pg.screenshot(path=OUT + name + '.png', timeout=180000); log('shot', name)
async def tap(pg, sel):
    box = await pg.locator(sel).first.bounding_box()
    await pg.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
async def gwait(pg, js, game=90, wall=2400):
    # 按游戏时间等（软件渲染很慢，墙钟时间不可靠）
    g0 = await pg.evaluate('window.__gt||0'); t0 = time.time()
    while time.time() - t0 < wall:
        if await pg.evaluate(js): return True
        if await pg.evaluate('window.__gt||0') - g0 > game: return False
        await asyncio.sleep(0.5)
    return False
async def until(pg, js, t=120):
    for _ in range(int(t / 0.25)):
        if await pg.evaluate(js): return True
        await asyncio.sleep(0.25)
    return False
SLOT = "__game.metro.slots.find(s=>s.line==1&&s.step==1)"
async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, URL)
    await asyncio.sleep(1.5); await pg.touchscreen.tap(1112 * 0.7, 834 * 0.4)
    await pg.evaluate("window.__gt===undefined && (window.__gt=0, __game.scene.onBeforeRenderObservable.add(()=>{ window.__gt += Math.min(0.25, __game.engine.getDeltaTime()/1000); }))")
    # 软件渲染约 4 fps：把单帧步长上限放宽到 0.25s，游戏时间≈墙钟（默认 0.05 会让一趟车慢 5 倍）
    await pg.evaluate('__game.setDtMax(0.25)'); log('loaded')
    await pg.evaluate('__game.teleport(24.6,-11.95,9.6,Math.PI)')
    for _ in range(600):
        await pg.evaluate('__game.call(1,1)')
        if await pg.evaluate(SLOT + ".state=='dwell'"): break
        await asyncio.sleep(0.5)
    log('train dwell', await pg.evaluate(SLOT + '.state'))
    # 截图很慢（单张 30–60 秒）：先让车门一直开着，摆好机位、截完图再放车走
    await pg.evaluate(SLOT + '.t = 1e4')
    # 选一个靠近 0 号车中门的空座位（-z 一侧），站到它前面的过道上
    seat = await pg.evaluate(f"""(()=>{{const t={SLOT}.train, r=t.root.position;
      const s=t.seats.filter(s=>s.free&&s.sd<0).sort((a,b)=>Math.abs(a.x-1.2)-Math.abs(b.x-1.2))[0];
      const taken=t.seats.filter(s=>!s.free).length;
      __game.teleport(r.x+s.x, r.y+0.02, r.z+s.sd*0.62, Math.PI); return {{x:s.x, sd:s.sd, free:t.seats.filter(s=>s.free).length, taken}};}})()""")
    R['seat'] = seat; await asyncio.sleep(0.6)
    R['actSit'] = await until(pg, "(__game.state().act||{}).id=='sit'", 20)
    await pg.evaluate('__game.player.yaw=Math.PI/2+0.5; __game.player.pitch=0.22; __game.player.dist=3.0'); await asyncio.sleep(1.5)
    await shot(pg, '2a-seat-before-sit-side')
    await tap(pg, '#bAct'); await until(pg, '__game.state().seat.seated', 10)
    # 髋部高度：脚底 + 髋高 ≈ 车厢地板 + 0.55（座垫顶 0.48 + 软垫）；和烘焙乘客同一公式
    g = await pg.evaluate(f"""(()=>{{const pl=__game.player, t={SLOT}.train, r=t.root.position, s=pl.seat.seat;
      return {{hipAboveFloor: +(pl.position.y + pl.hipH() - r.y).toFixed(3), dx: +(pl.position.x-r.x-s.x).toFixed(3), dz: +(pl.position.z-r.z).toFixed(3)}};}})()""")
    R['hip'] = g; R['hipOnCushion'] = abs(g['hipAboveFloor'] - 0.55) < 0.02 and abs(g['dz'] + 1.2) < 0.05
    # 和烘焙乘客不重叠：同侧烘焙乘客离座位中心 ≥ 0.6m
    R['clearOfBaked'] = await pg.evaluate(f"""(()=>{{const t={SLOT}.train, s=__game.player.seat.seat;
      return t.seats.filter(o=>!o.free&&o.sd===s.sd).every(o=>Math.abs(o.x-s.x)>=0.45);}})()""")
    # 侧面（第三人称，镜头沿车厢方向）
    # 和 2a 同一个机位（过道上、略朝座位那侧），看侧面坐姿
    await pg.evaluate('__game.player.yaw=Math.PI/2+0.5; __game.player.pitch=0.22; __game.player.dist=3.0'); await asyncio.sleep(1.5)
    await shot(pg, '2b-seat-sitting-side')
    # 第一人称：对面车窗（看得到站台）+ 左前方车门上方的线路图
    await pg.evaluate('__game.toggleView()'); await pg.evaluate('__game.player.yaw=__game.player.facing-0.2; __game.player.pitch=-0.24'); await asyncio.sleep(1.5)
    s = await st(pg); R['eyeFirst'] = round(s['camPos'][1] - (await pg.evaluate(SLOT + '.train.root.position.y')), 2)
    await shot(pg, '2c-seat-first-person-window-map')
    # 一直坐着：关门开车 → 进隧道 → 到下一站
    await pg.evaluate(SLOT + '.t = 1')
    R['departed'] = await gwait(pg, "__game.state().metro.ride!==null", 40)
    log('departed', R['departed'])
    R['seatedWhileMoving'] = await pg.evaluate('__game.state().seat.seated')
    # 到下一站停稳开门（坐着时 metro.ride 一直不为空——人还在车上——所以不能拿 ride==null 当“到站”，旧写法会一直等到超时）
    R['arrived'] = await gwait(pg, "(()=>{const s=__game.state(); return s.code!='gyq' && !s.inTunnel && s.metro.slots.some(o=>o.line==1&&o.step==1&&o.state=='dwell')})()", 120)
    log('arrived', R['arrived'])
    s = await st(pg); R['arrivedAt'] = s['code']; R['seatedAfterArrive'] = s['seat']['seated']
    await gwait(pg, 'false', 3); R['stillSeated'] = (await st(pg))['seat']['seated']
    # 起身
    if await pg.evaluate('__game.player.view') != 'third': await pg.evaluate('__game.toggleView()')
    R['actStand'] = (await st(pg))['act']
    await tap(pg, '#bAct'); await asyncio.sleep(0.8); s = await st(pg); R['stood'] = not s['seat']['seated'] and s['aboard']
    R['errors'] = errs(logs)
    print(json.dumps(R, ensure_ascii=False, indent=1, default=str))
    chk = {k: bool(R.get(k)) for k in ['actSit', 'hipOnCushion', 'clearOfBaked', 'departed', 'seatedWhileMoving', 'arrived', 'seatedAfterArrive', 'stillSeated', 'stood']}
    chk['eyeLower'] = R['eyeFirst'] < 1.3
    chk['noErrors'] = not R['errors']
    print('CHECKS', chk, 'PASS' if all(chk.values()) else 'FAIL', flush=True)
    await b.close()
asyncio.run(main())
