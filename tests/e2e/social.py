# 路人互动 + 问路：python3 tests/e2e/social.py <url> <截图目录> [w h]
#   PART=greet：四种路人并排 → 依次打招呼（对方转身挥手、玩家挥手、气泡粤语 + 普通话）→ 走动的路人让路 + “唔该借借”
#   PART=seat ：车厢里坐到乘客旁边 → 旁边的人转头点头（url 用 ?start=gyq&line=1）
#   PART=ask  ：客服中心问路 → 选站面板 → 1 号线目的地 / 需要在公园前换乘的 2 号线目的地（url 用 ?start=njs&line=1）
# 气泡检查：在安全区里，不压摇杆提示、跳 / 动作按钮、右上角按钮；同时最多 2 个。
import asyncio, sys, os, json, time
sys.path.insert(0, os.path.dirname(__file__))
from common import *
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/?q=2'
OUT = (sys.argv[2] if len(sys.argv) > 2 else '/workspace/gz-shots-3d/').rstrip('/') + '/'
W = int(sys.argv[3]) if len(sys.argv) > 3 else 1112; H = int(sys.argv[4]) if len(sys.argv) > 4 else 834
TAG = 'landscape' if W > H else 'portrait'; PART = os.environ.get('PART', 'greet')
os.makedirs(OUT, exist_ok=True); T0 = time.time(); R = {}
def log(*a): print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)
async def shot(pg, name): await pg.screenshot(path=OUT + name + '.png', timeout=240000); log('shot', name)
async def until(pg, js, t=60):
    for _ in range(int(t / 0.25)):
        if await pg.evaluate(js): return True
        await asyncio.sleep(0.25)
    return False
async def tap(pg, sel):
    box = await pg.locator(sel).first.bounding_box()
    await pg.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
# 气泡不压按钮 / 摇杆：返回每个气泡和这些控件的重叠
OVERLAP = """(()=>{const ctl=['bAct','bJump','stickHint','stick','btns','where'].map(id=>document.getElementById(id)).filter(e=>e&&!e.hidden&&e.offsetParent!==null).map(e=>[e.id,e.getBoundingClientRect()]);
  return [...document.querySelectorAll('#bubbles .bubble:not(.out)')].map(b=>{const r=b.getBoundingClientRect(); return ctl.filter(([id,c])=>r.left<c.right&&r.right>c.left&&r.top<c.bottom&&r.bottom>c.top).map(([id])=>id);}).flat();})()"""
async def bubble_ok(pg, key):
    R[key + 'Overlap'] = await pg.evaluate(OVERLAP); R[key + 'Count'] = await pg.evaluate("document.querySelectorAll('#bubbles .bubble:not(.out)').length")
    R[key + 'Text'] = await pg.evaluate("[...document.querySelectorAll('#bubbles .bubble:not(.out)')].map(b=>b.textContent)")
G = "__game.station.greeters.find(g=>g.kind=='{k}').n.p.mesh"
async def greet_part(pg):
    await pg.evaluate('__game.teleport(0,-5.95,1.2,0)'); await asyncio.sleep(1)
    # ① 四种路人并排（暂时挪到镜头前，拍完放回去）
    R['lineup'] = await pg.evaluate("""(()=>{const g=__game.station.greeters; window.__save=g.map(o=>[o.n.p.mesh.position.clone(), o.n.p.mesh.rotation.y, o.n.sh.position.clone()]);
      ['granny','student','office','tourist'].forEach((k,i)=>{const o=g.find(q=>q.kind==k), m=o.n.p.mesh; m.position.x=-2.1+i*1.4; m.position.z=5.2; m.rotation.y=Math.PI; o.n.sh.position.x=m.position.x; o.n.sh.position.z=5.2;}); return g.map(o=>o.kind);})()""")
    if await pg.evaluate("__game.player.view") != 'first': await pg.evaluate('__game.toggleView()')
    await pg.evaluate('__game.teleport(0,-5.95,1.6,0); __game.player.pitch=0.12'); await asyncio.sleep(1.5)
    await shot(pg, '6a-archetypes-lineup')
    await pg.evaluate("__game.station.greeters.forEach((o,i)=>{const s=__save[i]; o.n.p.mesh.position.copyFrom(s[0]); o.n.p.mesh.rotation.y=s[1]; o.n.sh.position.copyFrom(s[2]);})")
    await pg.evaluate('__game.toggleView()')
    # ② 依次打招呼
    for k in ['granny', 'student', 'office', 'tourist']:
        await pg.evaluate(f"""(()=>{{const m={G.format(k=k)}, a=m.rotation.y; __game.teleport(m.position.x+Math.sin(a)*1.5, -5.95, m.position.z+Math.cos(a)*1.5, a+Math.PI);}})()""")
        R['act_' + k] = await until(pg, f"__game.social.near=='{k}' && (__game.state().act||{{}}).id=='greet'", 15)
        await pg.evaluate(f"""(()=>{{const m={G.format(k=k)}, p=__game.player; p.yaw=Math.atan2(m.position.x-p.position.x, m.position.z-p.position.z)+0.55; p.pitch=0.1; p.dist=3.3;}})()""")
        await tap(pg, '#bAct'); await asyncio.sleep(0.9)
        R['greet_' + k] = await pg.evaluate('__game.state().social.lastGreet')
        await bubble_ok(pg, 'b_' + k)
        R['npcWaving_' + k] = await pg.evaluate(f"(()=>{{const n=__game.station.greeters.find(g=>g.kind=='{k}').n; return !!n.act && n.act.mode=='wave';}})()")
        await shot(pg, f'6b-greet-{k}')
        await pg.evaluate('__game.bubbles.clear()')
    # ③ 让路：站到走动路人的前方
    await pg.evaluate('__game.social.sidestepChance=1; __game.social.sayCool=0')
    w = await pg.evaluate("""(()=>{const n=__game.station.crowd.list.find(n=>n.path&&n.path[0][0]==5&&n.path[0][1]==-10.5); n.wait=0; n.sayCool=0; n.i=1; n.bx=5; n.bz=-10.5; n.off=0;
      __game.teleport(7.6, -5.95, -10.5, -Math.PI/2); const p=__game.player; p.yaw=-Math.PI/2+1.35; p.pitch=0.15; p.dist=4.6; window.__w=n; return [n.bx,n.bz];})()""")
    R['sidestepSaid'] = await until(pg, '__game.state().social.count.excuse>0', 30)
    await until(pg, 'Math.abs(__w.off)>0.5', 6)
    R['sideOff'] = await pg.evaluate('+__w.off.toFixed(2)')
    await pg.evaluate('__game.setDtMax && __game.setDtMax(0.0001)')  # 冻住画面再拍（路人别走出镜头）
    # 镜头对准让路的人（第三人称，从玩家身后斜着看过去）
    R['walkerAt'] = await pg.evaluate("""(()=>{const m=__w.p.mesh.position, p=__game.player; p.yaw=Math.atan2(m.x-p.position.x, m.z-p.position.z)+0.5; p.pitch=0.12; p.dist=3.6; p.camDist=3.6; return [+m.x.toFixed(2), +m.z.toFixed(2)];})()""")
    await asyncio.sleep(1.5)
    await bubble_ok(pg, 'b_excuse')
    R['excuseInfo'] = await pg.evaluate('__game.bubbles.info()')
    await shot(pg, '6c-sidestep-excuse')
async def seat_part(pg):
    SLOT = "__game.metro.slots.find(s=>s.line==1&&s.step==1)"
    await pg.evaluate('__game.call(1,1)'); await until(pg, SLOT + ".state=='dwell'", 200); await pg.evaluate(SLOT + '.t = 1e4'); log('dwell')
    # 选一个紧挨着坐着乘客的空座位
    R['seat'] = await pg.evaluate(f"""(()=>{{const t={SLOT}.train, r=t.root.position; const pax=t.pax.filter(q=>q.seated);
      let best=null, bd=9; for (const s of t.seats) if (s.free) for (const q of pax) if (q.sd===s.sd) {{const d=Math.abs(q.x-s.x); if (d<bd) {{bd=d; best=s;}}}}
      __game.teleport(r.x+best.x, r.y+0.02, r.z+best.sd*0.62, 0); return {{x:best.x, sd:best.sd, d:bd}};}})()""")
    R['actSit'] = await until(pg, "(__game.state().act||{}).id=='sit'", 20)
    await pg.evaluate('__game.act()'); await until(pg, '__game.state().seat.seated', 10)
    R['nodded'] = await until(pg, '!!__game.state().social.lastNod', 10)
    R['nod'] = await pg.evaluate('__game.state().social.lastNod')
    await pg.evaluate(f"""(()=>{{const p=__game.player, n=__game.state().social.lastNod; p.yaw=p.facing+Math.PI+(n&&n.dx>0? -0.35:0.35); p.pitch=0.12; p.dist=2.6;}})()""")
    await asyncio.sleep(0.2)
    R['nodActive'] = await pg.evaluate(f"{SLOT}.train.pax.some(q=>q.p.nodT>0)")
    await shot(pg, '6d-seat-neighbour-nod')
    R['paxModes'] = await pg.evaluate(f"[...new Set({SLOT}.train.pax.map(q=>q.p.mode))]")
async def ask_part(pg):
    await pg.evaluate('__game.teleport(15,-5.95,-3.9,Math.PI)'); await asyncio.sleep(0.8)
    R['actAsk'] = await until(pg, "(__game.state().act||{}).id=='ask'", 15)
    await pg.evaluate(f'__game.player.yaw=Math.PI-{0.75 if W > H else 0.35}; __game.player.pitch=0.12; __game.player.dist=3.4')  # 竖屏视野窄：多转一点，让工作人员入镜
    for dest, name in [('xl', 'line1'), ('yxgy', 'line2-transfer')]:
        await tap(pg, '#bAct'); await until(pg, '__game.state().social.pickerOpen', 10); await asyncio.sleep(0.6)
        if name == 'line1': await shot(pg, f'7a-ask-picker-{TAG}')
        # 点地图上的车站（站点圆点的屏幕坐标）
        xy = await pg.evaluate(f"""(async()=>{{const {{networkLayout, svgMap}}=await import('/js/ui/netmap.js'); const svg=document.querySelector('#askway .mapbox svg'); const [x,y]=networkLayout(innerHeight>innerWidth).pos['{dest}'];
          return svgMap(svg).toClient(x,y);}})()""")
        R['click_' + name] = xy
        await pg.mouse.click(xy[0], xy[1]); await asyncio.sleep(1.2)
        R['answer_' + name] = await pg.evaluate('__game.state().social.lastAnswer')
        await bubble_ok(pg, 'b_' + name)
        R['pointing_' + name] = await pg.evaluate("__game.station.staff.act && __game.station.staff.act.mode")
        await shot(pg, f'7b-ask-answer-{name}-{TAG}')
        await pg.evaluate('__game.bubbles.clear()'); await asyncio.sleep(0.3)
async def main():
  async with async_playwright() as p:
    b, pg, logs = await open_game(p, URL, w=W, h=H)
    await asyncio.sleep(1.5); await pg.touchscreen.tap(W * 0.7, H * 0.4); await pg.evaluate('__game.setDtMax(0.25)'); log('loaded')
    await {'greet': greet_part, 'seat': seat_part, 'ask': ask_part}[PART](pg)
    R['errors'] = errs(logs)
    print(json.dumps(R, ensure_ascii=False, indent=1), flush=True)
    ov = {k: v for k, v in R.items() if k.endswith('Overlap') and v}; cnt = all(v <= 2 for k, v in R.items() if k.endswith('Count'))
    chk = {'bubblesClear': not ov, 'max2': cnt, 'noErrors': not R['errors']}
    if PART == 'greet': chk.update({k: bool(R.get(k)) for k in R if k.startswith('act_') or k.startswith('greet_') or k.startswith('npcWaving_')}); chk['sidestep'] = R['sidestepSaid'] and abs(R['sideOff']) > 0.3
    if PART == 'seat': chk.update({'nodded': R['nodded'], 'chatPhone': 'sitChat' in R['paxModes'] and 'sitPhone' in R['paxModes']})
    if PART == 'ask':
        a1, a2 = R['answer_line1'], R['answer_line2-transfer']
        chk.update({'actAsk': R['actAsk'], 'l1': a1 and a1['legs'][0]['line'] == 1 and a1['legs'][0]['toward'] == '西塱' and not a1['transfer'],
                    'l2xfer': a2 and a2['transfer'] == 'gyq' and [l['line'] for l in a2['legs']] == [1, 2] and a2['legs'][1]['toward'] == '嘉禾望岗', 'pointing': R['pointing_line1'] == 'point'})
    print('CHECKS', chk, 'PASS' if all(chk.values()) else 'FAIL', flush=True)
    await b.close()
asyncio.run(main())
